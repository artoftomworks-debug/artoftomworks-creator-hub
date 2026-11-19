import {ltxTiming} from './ltx.mjs';
import {automaticSamplingDefaults,effectiveSampling} from './sampling-policy.mjs';
import {attachH3Preview} from './preview-image.mjs';
import {normalizeVideoOutputs,validateVideoOutputs} from './video-output.mjs';
import {open,stat} from 'node:fs/promises';
import path from 'node:path';
import {headerProfile} from './model-profile.mjs';
import {randomInt} from 'node:crypto';
import {choices,metadataFamily,compatibility} from './catalog.mjs';
import {h3RenderTiming,renderDimensions} from './workflow.mjs';

const norm=s=>String(s).replaceAll('\\','/').toLowerCase();
const supported=new Set(['sd1','sd2','sdxl','flux1','krea2','h3','moss','ltx']);
export {headerProfile} from './model-profile.mjs';
const aliases={ltxClip:['gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot-v2.safetensors','gemma412bwithprojltx25_v10.safetensors'],ltxVae:['ltx-2.5-video-vae-bf16.safetensors'],ltxAudio:['ltx-2.5-audio-vae-bf16.safetensors'],mossClip:['qwen3.5_9b_w4a8_gptq.safetensors','qwen3.5_9b_int8_convrot.safetensors'],mossVae:['flux2-vae_small.safetensors','flux2-vae.safetensors'],kreaClip:['qwen3vl_4b.safetensors'],kreaVae:['qwen_image_vae.safetensors'],fluxClip:['clip_l.safetensors'],fluxT5:['t5xxl_fp8_e4m3fn.safetensors','t5xxl_fp16.safetensors','t5xxl_enconly.safetensors'],fluxVae:['ae.safetensors'],h3Clip:['qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'],h3Vae:['minimax_h3_video_vae_int8_convrot.safetensors'],h3Audio:['minimax_h3_audio_vae_fp32.safetensors']};
function pick(names,role,override){
 if(override){if(!names.includes(override))throw Error('A megadott kiegészítő nincs a háttér listájában: '+override);return override;}
 for(const alias of aliases[role]){const hits=[...new Set(names)].filter(n=>path.posix.basename(norm(n))===alias);if(hits.length===1)return hits[0];if(hits.length>1){const exact=hits.find(n=>norm(n)===alias);if(exact)return exact;throw Error('Több lehetséges '+role+' kiegészítő található. Használj saját workflow-t a kívánt kiegészítővel.');}}
 throw Error('Hiányzó automatikus kiegészítő: '+aliases[role][0]+'. Telepítsd a megfelelő modellkönyvtárba, majd frissítsd a helyi listát.');
}
export function seriesSeeds(count,mode,seed,step=1){
 if(!Number.isInteger(count)||count<1||count>24)throw Error('1–24 alkotás kérhető egy sorozatban.');
 if(seed===-1){mode='random';seed=0;}
 if(!['random','fixed','increment'].includes(mode))throw Error('Ismeretlen seed mód.');
 if(!Number.isSafeInteger(step)||step<1||step>1000000)throw Error('A seed lépésköze 1–1000000 közötti egész szám legyen.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>Number.MAX_SAFE_INTEGER-(mode==='increment'?(count-1)*step:0))throw Error('A seed túl nagy vagy nem nemnegatív egész szám.');
 const used=new Set();return Array.from({length:count},(_,i)=>{if(mode!=='random')return mode==='increment'?seed+i*step:seed;let value;do{value=randomInt(0,2**48-1);}while(used.has(value));used.add(value);return value;});
}
export function createAutomatic({getObjects,fetchImpl,library}){
 const cache=new Map();let snapshot=null;
 async function profile(backend,folder,name){
  const key=backend+'|'+folder+'|'+name,old=cache.get(key);if(old&&Date.now()-old.time<120000)return old.value;
  let value={family:null,embeddedClip:false,embeddedVae:false,title:''};
  // Only indexed files are opened, and only the bounded safetensors JSON header.
  const listing=await library.list({query:path.posix.basename(norm(name))});
  const candidates=listing.items.filter(i=>['checkpoint','diffusion','lora'].includes(i.kind)&&norm(i.path).endsWith('/'+norm(name))),kind=folder==='checkpoints'?'checkpoint':folder==='diffusion_models'?'diffusion':null,typed=kind?candidates.filter(i=>i.kind===kind):[];const hits=typed.length?typed:candidates;if(hits.length===1)value.favorite=!!hits[0].favorite;
  if(hits.length===1&&/\.safetensors$/i.test(hits[0].path)){
   let f;try{const s=await stat(hits[0].path);f=await open(hits[0].path,'r');const len=Buffer.alloc(8);await f.read(len,0,8,0);const n=Number(len.readBigUInt64LE());if(n>1&&n<=16*1024**2&&n+8<=s.size){const b=Buffer.alloc(n);await f.read(b,0,n,8);value={...headerProfile(JSON.parse(b.toString('utf8'))),favorite:!!hits[0].favorite};}}catch{}finally{await f?.close();}
  }
  if(!value.family&&!value.conflict)try{const r=await fetchImpl(backend+'/view_metadata/'+folder+'?'+new URLSearchParams({filename:name}),{redirect:'error',signal:AbortSignal.timeout(1800)});if(r.ok){const text=await r.text();if(text.length<=2*1024**2){const m=JSON.parse(text);value={...value,family:metadataFamily(m),title:String(m['modelspec.title']||'')};}}}catch{}
  if(hits.length===1){value.localId=hits[0].id;value.preview=!!hits[0].preview;}cache.set(key,{time:Date.now(),value});return value;
 }
 async function list(backend,refresh=false){
  let inventoryState=await library.state?.();if(inventoryState?.scan.state==='scanning')await Promise.race([library.wait(),new Promise(r=>setTimeout(r,1800))]);inventoryState=await library.state?.();const stamp=inventoryState?inventoryState.total+':'+inventoryState.scan.finished:'';
  if(!refresh&&snapshot?.backend===backend&&snapshot.stamp===stamp&&Date.now()-snapshot.time<60000)return snapshot.value;
  if(refresh)cache.clear();const objects=await getObjects(backend,refresh),models=[];
  for(const [type,key,folder]of [['CheckpointLoaderSimple','ckpt_name','checkpoints'],['UNETLoader','unet_name','diffusion_models']])for(const name of choices(objects,type,key))models.push({id:folder+'|'+name,name,folder,type});
  let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<models.length){const m=models[next++];Object.assign(m,await profile(backend,m.folder,m.name));m.mode=['h3','ltx'].includes(m.family)?'video':'image';m.supported=supported.has(m.family)&&(m.family==='ltx'?m.type==='UNETLoader'&&m.variant==='ltx25':m.family==='h3'?m.type==='UNETLoader':m.family==='moss'?['UNETLoader','CheckpointLoaderSimple'].includes(m.type):['sd1','sd2','sdxl'].includes(m.family)?m.type==='CheckpointLoaderSimple':true);m.reason=m.supported?'':'Ehhez a családhoz még nincs automatikus összeállítás, vagy a fájl betöltőtípusa nem megfelelő. Saját workflow továbbra is használható.';}}));
  for(const m of models){m.status=m.supported?'ready':'unsupported';m.missing=[];if(m.supported&&m.type==='CheckpointLoaderSimple'&&['flux1','krea2'].includes(m.family)&&(!m.embeddedClip||!m.embeddedVae)){m.status='unsupported';m.reason='Ez nem igazolt teljes checkpoint. A külön generálómodell betöltőjével és megfelelő kódolókkal, vagy saját workflow-val használható.';continue;}if(!m.supported){m.reason=m.conflict?'A fájl metaadata és belső szerkezete eltérő családot jelez. Ellenőrizd a modell forrását.':['h3','ltx'].includes(m.family)&&m.type==='CheckpointLoaderSimple'?'Ehhez a '+m.family+' modellhez a generálómodell-betöltő szükséges. Ez a bejegyzés a checkpoint-ágból érkezett; ez nem hiányzó kiegészítőt jelent.':m.family?'A '+m.family+' családot felismerem, de ehhez a betöltési ághoz még nincs automatikus támogatás.':'A modellcsalád nem igazolható a fájl adataiból. A modell részletei és a forrásoldal segíthetnek.';continue;}const roles=m.family==='ltx'?['ltxClip','ltxVae','ltxAudio']:m.family==='moss'?['mossClip','mossVae']:m.family==='h3'?['h3Clip','h3Vae','h3Audio']:m.family==='krea2'&&m.type==='UNETLoader'?['kreaClip','kreaVae']:m.family==='flux1'&&m.type==='UNETLoader'?['fluxClip','fluxT5','fluxVae']:[];for(const role of roles)try{pick(role.toLowerCase().includes('clip')||['fluxT5'].includes(role)?choices(objects,'CLIPLoader','clip_name'):choices(objects,'VAELoader','vae_name'),role);}catch{m.missing.push({role,names:aliases[role],query:aliases[role][0]});}if(m.family==='ltx'){const required=['EmptyLTXVLatentVideo','LTXVEmptyLatentAudio','LTXVConcatAVLatent','LTXVSeparateAVLatent','LTXVAudioVAEDecode','LTXVConditioning','LTXVDualCFGGuider'];const absent=required.filter(t=>!objects[t]);if(absent.length){m.status='backend-update';m.reason='Hiányzó LTX motorfunkció: '+absent.join(', ');continue;}}if(m.family==='moss'){const typeSpec=choices(objects,'CLIPLoader','type');if(!objects.EmptyFlux2LatentImage||typeSpec.length&&!typeSpec.includes('moss_image')){m.status='backend-update';m.reason='A telepített ComfyUI még nem kínálja a MOSS kódolóját vagy a Flux2 látens képet. A motor frissítése szükséges.';continue;}}if(m.missing.length){m.status='missing-components';m.reason='Hiányzó vagy nem egyértelmű kiegészítők: '+m.missing.map(r=>r.names.join(' / ')).join('; ')+'. A modellböngészőben megkeresheted őket.';}else m.reason='Használatra kész.';}
  const loras=choices(objects,'LoraLoader','lora_name').length?choices(objects,'LoraLoader','lora_name'):choices(objects,'LoraLoaderModelOnly','lora_name');
  // Reuse local metadata; do not make hundreds of metadata HTTP calls on startup.
  const local=await library.list({kind:'lora',page:1});const loraItems=[];for(let page=1;page<=Math.min(local.pages||1,300);page++){const batch=page===1?local:await library.list({kind:'lora',page});loraItems.push(...batch.items);}
  const lorainfo=await Promise.all(loras.map(async name=>{const hits=loraItems.filter(i=>norm(i.path).endsWith('/'+norm(name)));let family=null;if(hits.length===1){const detail=await library.detail(hits[0].id);family=detail.family;}return {name,family,favorite:!!hits[0]?.favorite,localId:hits.length===1?hits[0].id:null};}));
  const value={models,loras:lorainfo,samplers:choices(objects,'KSampler','sampler_name').length?choices(objects,'KSampler','sampler_name'):choices(objects,'KSamplerSelect','sampler_name'),schedulers:choices(objects,'KSampler','scheduler').length?choices(objects,'KSampler','scheduler'):choices(objects,'BasicScheduler','scheduler'),components:{vae:choices(objects,'VAELoader','vae_name'),clip:choices(objects,'CLIPLoader','clip_name')},supports:{lora:!!objects.LoraLoader,loraModelOnly:!!objects.LoraLoaderModelOnly}};
  snapshot={backend,stamp,time:Date.now(),value};return value;
 }
 async function build(backend,data){
  const all=await list(backend),model=all.models.find(m=>m.id===data.id);if(!model||!model.supported)throw Error(model?.reason||'Válassz támogatott modellt a helyi listából.');if(model.status!=='ready')throw Error(model.reason);
  const objects=await getObjects(backend),family=model.family,component=data.components||{},dims=renderDimensions(data.width||1024,data.height||1024),deps=[];
  const p={},add=(type,inputs)=>{if(!objects[type])throw Error('Hiányzó ComfyUI node: '+type);const id=String(Object.keys(p).length+1);p[id]={class_type:type,inputs,_meta:{title:'Creator Hub · '+type}};return [id,0];};
  const choose=(role,kind)=>{const name=pick(all.components[kind],role,component[role]);deps.push({role,name});return name;};
  let m=add(model.type,model.type==='CheckpointLoaderSimple'?{ckpt_name:model.name}:{unet_name:model.name,weight_dtype:'default'}),clip,vae,audio;
  if(model.type==='CheckpointLoaderSimple'&&family!=='moss'){
   // SD checkpoints use their embedded VAE/encoder. Flux/Krea require confirmed AIO contents.
   if(['flux1','krea2'].includes(family)&&(!model.embeddedClip||!model.embeddedVae))throw Error('Ez nem igazolt teljes checkpoint. Válaszd a generálómodell-változatát a külön kódolók automatikus használatához.');
   clip=[m[0],1];vae=[m[0],2];deps.push({role:'VAE + szövegkódoló',name:'A checkpoint beépített összetevői'});
  }else{
   if(family==='moss'){clip=add('CLIPLoader',{clip_name:choose('mossClip','clip'),type:'moss_image',device:'default'});vae=add('VAELoader',{vae_name:choose('mossVae','vae')});}
   if(family==='flux1'){clip=add('DualCLIPLoader',{clip_name1:choose('fluxClip','clip'),clip_name2:choose('fluxT5','clip'),type:'flux'});vae=add('VAELoader',{vae_name:choose('fluxVae','vae')});}
   if(family==='krea2'){clip=add('CLIPLoader',{clip_name:choose('kreaClip','clip'),type:'krea2',device:'default'});vae=add('VAELoader',{vae_name:choose('kreaVae','vae')});}
   if(family==='ltx'){clip=add('CLIPLoader',{clip_name:choose('ltxClip','clip'),type:'ltxv',device:'default'});vae=add('VAELoader',{vae_name:choose('ltxVae','vae')});audio=add('VAELoader',{vae_name:choose('ltxAudio','vae')});}
   if(family==='h3'){clip=add('CLIPLoader',{clip_name:choose('h3Clip','clip'),type:'minimax',device:'default'});vae=add('VAELoader',{vae_name:choose('h3Vae','vae')});audio=add('VAELoader',{vae_name:choose('h3Audio','vae')});}
  }
  if(!clip||!vae)throw Error('Nem állítható össze biztonságosan a modell kiegészítő készlete.');
  const defaults=automaticSamplingDefaults(model);
  const s=effectiveSampling(data.sampling,defaults,data.samplingOverrides||data.controls?.samplingOverrides);validateSampling(s,all);
  if(family==='krea2')m=add('ModelSamplingFlux',{model:m,width:dims.width,height:dims.height,max_shift:1.15,base_shift:1.15});
  let latent,pos,neg;
  if(family==='h3'){
   const h3=add('MiniMaxH3ImageToVideo',{clip,vae,prompt:'',...dims,length:h3RenderTiming(data.duration||5).frames});pos=h3;latent=[h3[0],1];
   if(data.useImage)p[h3[0]].inputs.first_frame=add('LoadImage',{image:'creator-hub-start.png'});
   neg=add('CLIPTextEncode',{clip,text:''});
  }else if(family==='ltx'){const frames=ltxTiming(data.duration||5).frames,positive=add('CLIPTextEncode',{clip,text:''}),negative=add('CLIPTextEncode',{clip,text:''}),cond=add('LTXVConditioning',{positive,negative,frame_rate:24});pos=cond;neg=[cond[0],1];let video=add('EmptyLTXVLatentVideo',{...dims,length:frames,batch_size:1});if(data.useImage)video=add('LTXVImgToVideoInplace',{vae,image:add('LoadImage',{image:'creator-hub-start.png'}),latent:video,strength:1,bypass:false});latent=add('LTXVConcatAVLatent',{video_latent:video,audio_latent:add('LTXVEmptyLatentAudio',{frames_number:frames,frame_rate:24,batch_size:1,audio_vae:audio})});
  }else{
   pos=add('CLIPTextEncode',{clip,text:''});neg=add('CLIPTextEncode',{clip,text:''});
   if(family==='flux1')pos=add('FluxGuidance',{conditioning:pos,guidance:s.guidance});
   latent=data.useImage?add('VAEEncode',{pixels:add('LoadImage',{image:'creator-hub-start.png'}),vae}):add(family==='moss'?'EmptyFlux2LatentImage':['flux1','krea2'].includes(family)?'EmptySD3LatentImage':'EmptyLatentImage',{...dims,batch_size:1});
  }
  let sampled;
  if(['h3','ltx'].includes(family))sampled=add('SamplerCustomAdvanced',{noise:add('RandomNoise',{noise_seed:42}),guider:add(family==='ltx'?'LTXVDualCFGGuider':'CFGGuider',{model:m,positive:pos,negative:neg,...(family==='ltx'?{video_cfg:s.cfg,audio_cfg:s.cfg}:{cfg:s.cfg})}),sampler:add('KSamplerSelect',{sampler_name:s.sampler}),sigmas:add('BasicScheduler',{model:m,scheduler:s.scheduler,steps:s.steps,denoise:s.denoise}),latent_image:latent});
  else sampled=add('KSampler',{model:m,seed:42,steps:s.steps,cfg:s.cfg,sampler_name:s.sampler,scheduler:s.scheduler,positive:pos,negative:neg,latent_image:latent,denoise:s.denoise});
  const separated=family==='ltx'?add('LTXVSeparateAVLatent',{av_latent:sampled}):null;const decoded=add('VAEDecode',{samples:separated||sampled,vae});
  if(['h3','ltx'].includes(family))add('SaveVideo',{video:add('CreateVideo',{images:decoded,audio:family==='ltx'?add('LTXVAudioVAEDecode',{samples:[separated[0],1],audio_vae:audio}):add('VAEDecodeAudio',{samples:sampled,vae:audio}),fps:24}),filename_prefix:'ArtofTomworks/CreatorHub',...(objects.SaveVideo?.input?.required?.format?.[0]==='COMFY_DYNAMICCOMBO_V3'?{format:{format:'mp4',codec:{codec:'h264'}}}:{format:'auto',codec:'auto'})});
  else add('SaveImage',{images:decoded,filename_prefix:'ArtofTomworks/CreatorHub'});
  attachH3Preview(p,objects);normalizeVideoOutputs(p,objects);validateGraph(p,objects);return {source:{prompt:p},model,dependencies:deps,defaults,sampling:s,fps:['h3','ltx'].includes(family)?24:null};
 }
 async function validateLoras(backend,model,controls){const all=await list(backend);for(const row of controls.addedLoras||[]){if(!row.on)continue;const item=all.loras.find(i=>i.name===row.name);if(!item)throw Error('A LoRA nincs a háttér listájában: '+row.name);const result=compatibility(model.family,item.family);if(result==='incompatible'||result==='unknown'&&!controls.allowUnknownLoras)throw Error('A LoRA családja eltér vagy még nem igazolt: '+row.name);}}
 return {list,build,validateLoras,invalidate(){cache.clear();snapshot=null;}};
}
export function validateSampling(s,options){
 if(!Number.isInteger(s.steps)||s.steps<1||s.steps>1000)throw Error('A lépésszám 1–1000 közötti egész szám legyen.');
 for(const [key,min,max]of [['cfg',0,100],['denoise',.01,1],['guidance',0,100]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error('Hibás generálási érték: '+key);
 if(!options.samplers.includes(s.sampler)||!options.schedulers.includes(s.scheduler))throw Error('A sampler vagy scheduler nincs a háttér támogatott listájában.');
}
export function validateGraph(prompt,objects){
 validateVideoOutputs(prompt,objects);
 for(const n of Object.values(prompt)){
  const required=objects[n.class_type]?.input?.required||{},optional=objects[n.class_type]?.input?.optional||{};
  for(const key of Object.keys(required))if(!(key in n.inputs))throw Error('A telepített node eltérő beállítást igényel: '+n.class_type+' / '+key);
  for(const[key,value]of Object.entries(n.inputs)){
   if(Array.isArray(value)){if(!prompt[value[0]])throw Error('Hiányzó belső kapcsolat.');continue;}
   const spec=required[key]||optional[key];if(!spec)continue;
   if(n.class_type==='LoadImage'&&key==='image')continue;
   const options=Array.isArray(spec[0])?spec[0]:spec[1]?.options?.map(o=>typeof o==='object'?o.key:o);
   const selected=value&&typeof value==='object'&&spec[0]==='COMFY_DYNAMICCOMBO_V3'?value[key]:value;
   if(options&&!options.includes(selected))throw Error('A háttér nem támogatja ezt az értéket: '+n.class_type+' / '+key+' = '+selected);
   if(['INT','FLOAT'].includes(spec[0])&&(!Number.isFinite(value)||spec[0]==='INT'&&!Number.isInteger(value)||spec[1]?.min!==undefined&&value<spec[1].min||spec[1]?.max!==undefined&&value>spec[1].max))throw Error('A háttér tartományán kívüli érték: '+n.class_type+' / '+key);
  }
 }
}
