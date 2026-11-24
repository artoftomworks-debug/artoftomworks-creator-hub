import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {atomicJSON} from './storage.mjs';
import {inspectRenderSource} from './workflow.mjs';
import {videoWorkshopCore} from './vendor/tools/prompt-studio/video-workshop-core.mjs';

export function continuationSource(raw,output){
 const source=structuredClone(raw),p=source.prompt,info=inspectRenderSource(source,output);if(info.needsImage)return {source,info};
 let id=1;const add=(class_type,inputs)=>{while(p[String(id)])id++;const key=String(id++);p[key]={class_type,inputs};return [key,0];};
 if(info.videoFamily==='ltx'){
  const concat=Object.values(p).filter(n=>n.class_type==='LTXVConcatAVLatent'&&n.inputs.video_latent?.[0]===info.ltxEmpty),decoder=p[p[info.create]?.inputs.images?.[0]];
  if(concat.length!==1||!/^VAEDecode/.test(decoder?.class_type||'')||!Array.isArray(decoder.inputs.vae))throw Error('Ehhez az LTX workflow-hoz nem illeszthető automatikusan kezdőkép.');
  concat[0].inputs.video_latent=add('LTXVImgToVideoInplace',{vae:decoder.inputs.vae,image:add('LoadImage',{image:'creator-hub-continuation.png'}),latent:[info.ltxEmpty,0],strength:1,bypass:false});
 }else if(info.h3){p[info.h3].inputs.first_frame=add('LoadImage',{image:'creator-hub-continuation.png'});}
 else throw Error('Ehhez a folytatáshoz képből videót készítő workflow szükséges.');
 return {source,info:inspectRenderSource(source,output)};
}

export function createSceneService({root,history,runner,videoTools}) {
 const file=path.join(root,'data','scene-sequences.json');let db,initializing,serial=Promise.resolve();
 async function init(){if(!initializing)initializing=(async()=>{try{db=JSON.parse(await readFile(file,'utf8'));if(db.schema!=='creator-hub.scene-sequences'||!db.choices||typeof db.choices!=='object')throw Error('A jelenetsor mentése nem olvasható.');}catch(e){if(e.code!=='ENOENT')throw e;db={schema:'creator-hub.scene-sequences',choices:{}};}})();await initializing;}
 async function entry(id){const e=await history.item(id);if(e.mode!=='video'||e.incomplete||e.preview||e.trashed)throw Error('Válassz elkészült, elérhető videót a jelenetfolytatáshoz.');return e;}
 async function context({id,regenerate=false}={}){
  if(typeof regenerate!=='boolean')throw Error('Érvénytelen jelenetművelet.');
  const e=await entry(id),rootId=e.scene?.rootId||e.id,part=e.scene?.part??0;
  if(!Number.isInteger(part)||part<0||part>=24)throw Error('A jelenetsor legfeljebb 24 részből állhat.');
  if(!regenerate&&part>=23)throw Error('A jelenetsor legfeljebb 24 részből állhat.');
  await entry(rootId);
  return {rootId,part:regenerate?part:part+1,previousId:regenerate?(e.scene?.previousId||null):e.id,sourceId:e.id};
 }
 async function prepare({id,regenerate=false}={}){
  const e=await entry(id),location=await history.location(id);if(!location.available)throw Error(location.message);
  const run=await runner.load(e.runId),job=run.jobs.find(j=>j.shotId===e.shotId);
  if(!job?.prompt||job.processingEdited||job.loopEdited||job.editorEdited)throw Error('Ehhez a feldolgozott videóhoz nincs közvetlen generálási recept. A generált forrásváltozatból indíts folytatást.');
  const original={prompt:structuredClone(job.prompt)},{source,info}=regenerate?{source:original,info:inspectRenderSource(original,job.output)}:continuationSource(original,job.output);
  if(info.mode!=='video')throw Error('Ehhez a folytatáshoz videós workflow szükséges.');
  const scene=await context({id,regenerate});let image='';
  if(regenerate){
   if(scene.previousId){const png=await videoTools.lastFrame({id:scene.previousId});if(png.length>8*1024**2)throw Error('Az utolsó képkocka túl nagy.');image='data:image/png;base64,'+png.toString('base64');}
  }else{const png=await videoTools.lastFrame({id});if(png.length>8*1024**2)throw Error('Az utolsó képkocka túl nagy.');image='data:image/png;base64,'+png.toString('base64');}
  return {id,filename:e.filename,backend:e.backend,source,info,image,regenerate,scene,width:job.width,height:job.height,duration:job.requested||job.seconds||5,seed:regenerate?(Number.isSafeInteger(job.seed)&&job.seed<Number.MAX_SAFE_INTEGER?job.seed+1:0):(Number.isSafeInteger(job.seed)?job.seed:42),intent:job.sceneIntent||{prompt:info.prompt||'',motion:{enabled:false}},startImage:regenerate&&!scene.previousId&&job.imagePath?'/api/run/start-image?'+new URLSearchParams({id:e.runId,shot:e.shotId}):null,chainReference:image?await chainReference(scene.rootId):null};
 }
 // 0.16 DEV: part 1's start image = colour reference for the chain refresh (null for text-to-video roots)
 async function chainReference(rootId){try{const r=await history.item(rootId),run=await runner.load(r.runId),j=run.jobs.find(x=>x.shotId===r.shotId);return j?.imagePath?'/api/run/start-image?'+new URLSearchParams({id:r.runId,shot:r.shotId}):null;}catch{return null;}}
 async function sequence(id,{explicit=false}={}){
  await init();const anchor=await entry(id),rootId=anchor.scene?.rootId||anchor.id,base=await entry(rootId),family=await history.family(rootId),rows=family.items.filter(e=>e.id===rootId||e.scene?.rootId===rootId),byId=new Map(rows.map(e=>[e.id,e])),forced=new Map();
  let at=anchor.id===rootId&&!explicit?null:anchor;const seen=new Set();
  while(at){if(seen.has(at.id)||seen.size>24)throw Error('A jelenetsor forráskapcsolata hibás.');seen.add(at.id);forced.set(at.scene?.previousId||'$root',at.id);at=at.scene?.previousId?byId.get(at.scene.previousId):null;}
  const parts=[];let previousId=null;
  for(let part=0;part<24;part++){
   const variants=rows.filter(e=>!e.trashed&&!e.incomplete&&!e.preview&&(part===0?e.id===rootId||e.scene?.part===0:e.scene?.part===part&&e.scene.previousId===previousId)).sort((a,b)=>a.created-b.created);
   if(!variants.length)break;
   const key=previousId||'$root',preferred=forced.get(key)||db.choices[rootId]?.[key],selected=variants.find(e=>e.id===preferred)||variants[0];
   parts.push({number:part+1,selected:selected.id,variants});previousId=selected.id;
  }
  return {rootId,title:base.project,anchor:id,parts};
 }
 async function choose({id}){const next=serial.catch(()=>{}).then(async()=>{const seq=await sequence(id,{explicit:true}),choices=db.choices[seq.rootId]||{};let previous='$root';for(const part of seq.parts){choices[previous]=part.selected;previous=part.selected;}for(const key of Object.keys(choices).slice(0,Math.max(0,Object.keys(choices).length-512)))delete choices[key];db.choices[seq.rootId]=choices;const roots=Object.keys(db.choices);for(const key of roots.slice(0,Math.max(0,roots.length-200)))delete db.choices[key];await atomicJSON(file,db);return seq;});serial=next;return next;}
 async function assembly({id}){const seq=await sequence(id);if(seq.parts.length<2)throw Error('Az összeállításhoz legalább két elkészült jelenetrész kell.');const ids=seq.parts.map(p=>p.selected);for(const id of ids){const e=await history.location(id);if(!e.available)throw Error(e.message);}const C=videoWorkshopCore();let project=C.fresh();project.name='Creator Hub · '+seq.parts.length+' jelenetrész';for(const id of ids){const {asset}=await videoTools.importVideo({id});project=C.add(project,asset,'clip');}return {project,ids,rootId:seq.rootId};}
 return {prepare,context,sequence,choose,assembly};
}
