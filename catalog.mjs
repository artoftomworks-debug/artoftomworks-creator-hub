// Read only the catalog and small metadata headers exposed by the local backend.
// File names are deliberately never used to infer architecture.
export function metadataFamily(meta={}) {
 const values=['modelspec.architecture','ss_base_model_version','base_model','base_model_version'].map(k=>meta[k]).filter(v=>typeof v==='string');
 const families=values.map(v=>{
  v=v.toLowerCase().replaceAll('_','-');
  if(/moss[ .-]?(?:image|imaginix)/.test(v))return 'moss';
  if(/ltx/.test(v))return 'ltx';
  if(/hunyuan/.test(v))return 'hunyuan';
  if(/^wan(?:$|[ .-]|\d)/.test(v))return 'wan';
  if(/minimax.*h3|^h3(?:$|[-.])/.test(v))return 'h3';
  if(/krea[ .-]?2/.test(v))return 'krea2';
  if(/flux[ .-]?2/.test(v))return 'flux2';
  if(/flux/.test(v))return 'flux1';
  if(/sdxl|stable-diffusion-xl|sd-xl/.test(v))return 'sdxl';
  if(/sd[ .-]?3|stable-diffusion-v?3/.test(v))return 'sd3';
  if(/sd[ .-]?v?1|stable-diffusion-v?1/.test(v))return 'sd1';
  if(/sd[ .-]?v?2|stable-diffusion-v?2/.test(v))return 'sd2';
  return null;
 }).filter(Boolean);
 return new Set(families).size===1?families[0]:null;
}
export function compatibility(expected,actual){return !expected||!actual?'unknown':expected===actual?'family-match':'incompatible';}
export function choices(objects,type,key){const input=objects[type]?.input;const spec=input?.required?.[key]||input?.optional?.[key];return (Array.isArray(spec?.[0])?spec[0]:spec?.[1]?.options||[]).filter(v=>typeof v==='string');}
export function createCatalog({fetchImpl,getObjects,library}){
 const cache=new Map();
 const cached=(backend,folder,name)=>cache.get(backend+'|'+folder+'|'+name)?.family||null;
 async function metadata(backend,folder,name){
  const key=backend+'|'+folder+'|'+name;if(library){const local=await library.list({query:name.split(/[\\/]/).at(-1),kind:folder==='loras'?'lora':'',profiles:true});const hits=local.items.filter(i=>i.path.replaceAll('\\','/').toLowerCase().endsWith('/'+name.replaceAll('\\','/').toLowerCase()));if(hits.length===1&&hits[0].family){cache.set(key,{family:hits[0].family,time:Date.now()});return hits[0].family;}}const old=cache.get(key);if(old&&Date.now()-old.time<120000)return old.family;
  try{const r=await fetchImpl(backend+'/view_metadata/'+folder+'?'+new URLSearchParams({filename:name}),{redirect:'error',signal:AbortSignal.timeout(1100)});if(!r.ok){if(r.status===404)cache.set(key,{family:null,time:Date.now()});return null;}const text=await r.text();if(text.length>1024**2)return null;const value=metadataFamily(JSON.parse(text));cache.set(key,{family:value,time:Date.now()});return value;}catch{return null;}
 }
 async function list(backend,source,info,{refresh=false}={}){
  const objects=await getObjects(backend,refresh),fields=[];
  for(const field of info.modelFields){const type=source.prompt[field.node].class_type,folder=type==='CheckpointLoaderSimple'?'checkpoints':'diffusion_models';const names=choices(objects,type,field.key);fields.push({...field,type,folder,names:[...new Set([field.name,...names])]});}
  let loras=choices(objects,'LoraLoader','lora_name');if(!loras.length)loras=choices(objects,'LoraLoaderModelOnly','lora_name');
  if(!loras.length)try{const r=await fetchImpl(backend+'/models/loras',{redirect:'error',signal:AbortSignal.timeout(2500)});if(r.ok){const v=await r.json();if(Array.isArray(v))loras=v.filter(n=>typeof n==='string');}}catch{}
  loras=[...new Set(loras)].slice(0,10000);
  const tasks=[...fields.flatMap(f=>f.names.map(name=>({folder:f.folder,name}))),...loras.map(name=>({folder:'loras',name}))];let next=0;const deadline=Date.now()+7000;
  await Promise.all(Array.from({length:6},async()=>{while(next<tasks.length&&Date.now()<deadline){const item=tasks[next++];await metadata(backend,item.folder,item.name);}}));
  for(const field of fields){field.family=info.mode==='video'?(info.videoFamily||'h3'):cached(backend,field.folder,field.name);field.items=field.names.map(name=>({name,family:cached(backend,field.folder,name)}));delete field.names;}
  const localLoras=[];if(library){const first=await library.list({kind:'lora'});localLoras.push(...first.items);for(let page=2;page<=first.pages;page++)localLoras.push(...(await library.list({kind:'lora',page})).items);}const norm=s=>s.replaceAll('\\','/').toLowerCase();return {fields,loras:loras.map(name=>{const hits=localLoras.filter(i=>norm(i.path).endsWith('/'+norm(name)));return {name,family:cached(backend,'loras',name),localId:hits.length===1?hits[0].id:null,favorite:hits.length===1&&hits[0].favorite};}),checked:next,total:tasks.length,loraLoader:!!objects.LoraLoader,loraModelOnly:!!objects.LoraLoaderModelOnly};
 }
 async function validate(backend,source,info,controls={}){
  const changes=controls.models||[],added=controls.addedLoras||[];
  if(!changes.length&&!added.some(r=>r.on)&&!controls.loras?.some(r=>r.on))return;
  const catalog=await list(backend,source,info);
  for(const field of catalog.fields){const selected=changes.find(c=>c.node===field.node&&c.key===field.key);if(!selected||selected.name===field.name)continue;
   const item=field.items.find(i=>i.name===selected.name);if(!item)throw Error('A kiválasztott modell nincs a háttér listájában. Frissítsd a katalógust.');
   const status=compatibility(field.family,item.family);if(status==='incompatible'||status==='unknown'&&!controls.allowUnknownModels)throw Error('A modell családja eltér, vagy nem ellenőrizhető. Válassz megfelelő workflow-t; ismeretlen családhoz külön engedély szükséges.');
  }
  if(added.some(r=>r.on)&&catalog.fields.length!==1)throw Error('Új LoRA-hoz egyértelműen egy modellbetöltő szükséges.');
  const field=catalog.fields[0],chosen=changes.find(c=>c.node===field?.node&&c.key===field?.key),family=chosen&&chosen.name!==field?.name?field.items.find(i=>i.name===chosen.name)?.family:field?.family;
  if(catalog.fields.length===1)for(const row of (controls.loras||[]).filter(r=>r.on)){const original=info.loras.find(r=>r.node===row.node&&r.key===row.key&&r.name===row.name),item=catalog.loras.find(i=>i.name===row.name);if(original&&compatibility(family,item?.family)==='incompatible')throw Error('A bekapcsolt LoRA más modellcsaládhoz tartozik: '+row.name);}
  for(const row of added.filter(r=>r.on)){const item=catalog.loras.find(i=>i.name===row.name);if(!item)throw Error('A LoRA nincs a háttér listájában: '+row.name);const status=compatibility(family,item.family);if(status==='incompatible'||status==='unknown'&&!controls.allowUnknownLoras)throw Error('A hozzáadott LoRA családja eltér vagy nem ellenőrizhető: '+row.name);if(field.type==='CheckpointLoaderSimple'&&!field.modelOnly?!catalog.loraLoader:!catalog.loraModelOnly)throw Error('A szükséges szabványos LoRA-betöltő nincs a háttérben.');}
 }
 return {list,validate,invalidate(){cache.clear();}};
}
