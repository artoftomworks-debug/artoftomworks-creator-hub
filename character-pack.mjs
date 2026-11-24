// 0.16 DEV — Karakterkészlet (PuLID-Flux karakter-hűség).
// Fixed, verified file list; downloads only into the ComfyUI models folder (models/pulid, models/insightface/models/antelopev2).
// No custom node or Python package is installed: the PuLID-Flux nodes must already be present in ComfyUI.
// EVA-CLIP and the facexlib helper weights are fetched by the PuLID node itself on its first run.
import {mkdir,open,rename,stat,unlink,statfs} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const HF='https://huggingface.co/';
export const PACK=[
 {id:'pulid',dir:['pulid'],name:'pulid_flux_v0.9.1.safetensors',size:1142099520,url:HF+'guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors'},
 ...[['1k3d68.onnx',143607619],['2d106det.onnx',5030888],['genderage.onnx',1322532],['glintr100.onnx',260665334],['scrfd_10g_bnkps.onnx',16923827]]
  .map(([name,size])=>({id:name,dir:['insightface','models','antelopev2'],name,size,url:HF+'DIAMONIK7777/antelopev2/resolve/main/'+name}))
];
export const PACK_BYTES=PACK.reduce((a,f)=>a+f.size,0);
const HOSTS=['huggingface.co'],SUFFIXES=['.hf.co','.huggingface.co','.xethub.hf.co','.amazonaws.com','.cloudfront.net'];
export function allowedURL(url){const u=new URL(url),h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Csak HTTPS forrás engedélyezett.');if(!HOSTS.includes(h)&&!SUFFIXES.some(s=>h.endsWith(s)))throw Error('A forrás ismeretlen címre irányított: '+h);return u;}

export function createCharacterPack({engine,getObjects,fetchImpl=fetch}){
 let job={state:'idle',file:'',bytes:0,total:0,error:''},controller=null;
 async function engineInfo(){const s=await engine.status(false);if(!s?.config?.directory)throw Error('A ComfyUI mappája még nem ismert. Indítsd el a ComfyUI-t a Hubból.');return {models:path.join(s.config.directory,'models'),backend:s.backend};}
 async function files(models){return Promise.all(PACK.map(async f=>{const p=path.join(models,...f.dir,f.name);let size=0;try{size=(await stat(p)).size;}catch{}return {...f,path:p,present:size===f.size};}));}
 async function status(){
  let list=[],error='',nodes=null,flux=false;
  try{const {models,backend}=await engineInfo();list=await files(models);try{const o=await getObjects(backend,job.state==='complete');nodes=!!(o.ApplyPulidFlux&&o.PulidFluxModelLoader&&o.PulidFluxEvaClipLoader&&o.PulidFluxInsightFaceLoader);flux=(o.UNETLoader?.input?.required?.unet_name?.[0]||[]).some(n=>/flux/i.test(n))||(o.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]||[]).some(n=>/flux/i.test(n));}catch{nodes=null;}}
  catch(e){error=e.message;}
  const missing=list.filter(f=>!f.present);
  return {ready:!error&&nodes===true&&list.length>0&&!missing.length,nodes,flux,error,missingBytes:missing.reduce((a,f)=>a+f.size,0),totalBytes:PACK_BYTES,files:list.map(f=>({name:f.name,folder:f.dir.join('/'),size:f.size,present:f.present})),job:{...job}};
 }
 async function remote(url,offset){for(let i=0;i<8;i++){const u=allowedURL(url);const r=await fetchImpl(u.href,{headers:{'User-Agent':'ArtofTomworks-CreatorHub',...(offset?{Range:'bytes='+offset+'-'}:{})},redirect:'manual',signal:controller.signal});if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');await r.body?.cancel();if(!next)throw Error('Hiányos átirányítás.');url=new URL(next,u).href;continue;}if(!r.ok&&r.status!==206){await r.body?.cancel();throw Error('A forrás hibát adott ('+r.status+').');}return r;}throw Error('Túl sok átirányítás.');}
 async function fetchFile(f,target,done){
  await mkdir(path.dirname(target),{recursive:true});const part=target+'.creator-hub.part';let offset=0;try{offset=(await stat(part)).size;}catch{}if(offset>f.size)offset=0;
  if(offset<f.size){const r=await remote(f.url,offset);if(offset&&r.status!==206)offset=0;const h=await open(part,offset?'a':'w');try{let bytes=offset;for await(const chunk of r.body){if(controller.signal.aborted)throw Error('cancelled');bytes+=chunk.length;if(bytes>f.size)throw Error('A letöltés nagyobb a vártnál: '+f.name);await h.write(chunk);job.bytes=done+bytes;}}finally{await h.close();}}
  const size=(await stat(part)).size;if(size!==f.size)throw Error('Hiányos letöltés: '+f.name+'. Indítsd újra – onnan folytatja, ahol abbamaradt.');
  if(/\.safetensors$/.test(f.name)){const h=await open(part,'r');try{const b=Buffer.alloc(8);await h.read(b,0,8,0);const n=Number(b.readBigUInt64LE());if(n<2||n>16*1024**2)throw Error('Érvénytelen safetensors fájl: '+f.name);const head=Buffer.alloc(n);await h.read(head,0,n,8);JSON.parse(head.toString('utf8'));}finally{await h.close();}}
  await rename(part,target);
 }
 async function run(){
  try{const {models}=await engineInfo();const list=await files(models);const todo=list.filter(f=>!f.present);const need=todo.reduce((a,f)=>a+f.size,0);
   try{const d=await statfs(models);if(d.bavail*d.bsize<need+256*1024**2)throw Error('Nincs elég szabad hely: '+Math.ceil(need/1024**3)+' GB kell.');}catch(e){if(/szabad hely/.test(e.message))throw e;}
   job.total=need;let done=0;for(const f of todo){job.file=f.name;await fetchFile(f,f.path,done);done+=f.size;job.bytes=done;}
   job.state='complete';job.file='';try{const s=await engine.status(false);await getObjects(s.backend,true);}catch{}
  }catch(e){job.state=controller?.signal.aborted?'cancelled':'failed';job.error=job.state==='cancelled'?'':e.message;}finally{controller=null;}
 }
 async function install(){if(controller)return status();job={state:'downloading',file:'',bytes:0,total:0,error:''};controller=new AbortController();void run();return status();}
 async function cancel(){controller?.abort();return status();}
 return {status,install,cancel,close(){controller?.abort();}};
}

// Reference face upload: content-addressed name in the ComfyUI input folder, so repeats reuse the same file.
export async function uploadCharacter(backend,image,fetchImpl=fetch){
 if(typeof image!=='string'||image.length>12*1024**2||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))throw Error('A karakter-referencia PNG, JPEG vagy WebP kép lehet, legfeljebb 8 MiB.');
 const mime=image.slice(5,image.indexOf(';')),bytes=Buffer.from(image.slice(image.indexOf(',')+1),'base64');if(bytes.length>8*1024**2)throw Error('A karakter-referencia legfeljebb 8 MiB lehet.');
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime],name='character-'+createHash('sha256').update(bytes).digest('hex').slice(0,16)+'.'+ext;
 const form=new FormData();form.set('image',new Blob([bytes],{type:mime}),name);form.set('type','input');form.set('subfolder','CreatorHub');form.set('overwrite','true');
 const r=await fetchImpl(backend+'/upload/image',{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('A karakter-referencia nem tölthető fel a ComfyUI-ba.');
 const v=await r.json(),p=(v.subfolder?v.subfolder+'/':'')+v.name;if(p!=='CreatorHub/'+name)throw Error('Váratlan feltöltési útvonal: '+p);return p;
}
