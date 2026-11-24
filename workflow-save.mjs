// 0.16 DEV — "Workflow mentése" from Előzmények.
// Saves the exact graph a finished result was generated with into the Hub's own folder
// (Mentett_workflowk), never overwriting anything: a ComfyUI-loadable JSON, a preview image
// (the result itself for images, the start image for videos) and a short human-readable recipe.
// The folder is registered once as a Készlettár workflow folder, so saved items can be loaded back.
import {mkdir,writeFile,copyFile,readFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {inspectRenderSource} from './workflow.mjs';

export const SAVED_DIR='Mentett_workflowk';

export function slug(text,max=40){
 const s=String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
 return s.slice(0,max).replace(/_+$/,'');
}
const modelLabel=name=>slug(path.basename(String(name||'').replace(/\\/g,'/')).replace(/\.(safetensors|sft|ckpt|gguf|pt|pth|bin)$/i,''),28);
const stamp=d=>{const t=new Date(d);if(!Number.isFinite(t.getTime()))return 'ismeretlen_ido';const p=n=>String(n).padStart(2,'0');return `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}_${p(t.getHours())}${p(t.getMinutes())}`;};

export function describeJob(entry,job){
 let info=null;try{info=inspectRenderSource({prompt:job.prompt},job.output);}catch{}
 const prompt=info?.prompt||'',model=info?.models?.[0]||'';
 const kind=entry.mode==='video'||job.mode==='video'?'video':'kep';
 const parts=[stamp(entry.created),kind,modelLabel(model),slug(prompt.split(/\s+/).slice(0,6).join(' '),36),entry.seed!==undefined&&entry.seed!==null&&entry.seed!==''?'seed'+slug(entry.seed,20):''].filter(Boolean);
 const recipe=[
  'ArtofTomworks Creator Hub · mentett workflow',
  'Készült: '+new Date(entry.created||Date.now()).toLocaleString('hu-HU'),
  'Eredmény: '+(entry.filename||''),
  'Típus: '+(kind==='video'?'videó':'kép'),
  model?'Modell: '+(info.models||[]).join(', '):'',
  entry.seed!==undefined&&entry.seed!==null?'Seed: '+entry.seed:'',
  entry.width&&entry.height?`Méret: ${entry.width}×${entry.height}`:'',
  job.fps?`Videó: ${job.frames||'?'} képkocka · ${job.fps} fps · ${Number(job.seconds||0).toFixed(2)} s`:'',
  info?.sampling&&Object.keys(info.sampling).length?'Mintavétel: '+Object.entries(info.sampling).map(([k,v])=>k+'='+v).join(', '):'',
  info?.loras?.filter(l=>l.on).length?'LoRA-k: '+info.loras.filter(l=>l.on).map(l=>`${l.name} (${l.strength??l.strength_model??''})`).join(', '):'',
  '',
  'Prompt:',prompt||'(nem olvasható ki)',
  info?.negative?'\nNegatív prompt:\n'+info.negative:'',
  '',
  job.workflow?'A .json fájl szerkeszthető ComfyUI-workflow: húzd be a ComfyUI-ba, vagy töltsd be a Hubban.':'Az .api.json fájl a pontos futtatott gráf (API-formátum): behúzható a ComfyUI-ba, és a Hub Készlettárából is betölthető.',
 ].filter(v=>v!=='').join('\r\n');
 return {base:parts.join('_'),ext:job.workflow?'.json':'.api.json',content:JSON.stringify(job.workflow||job.prompt,null,2),recipe,kind};
}

async function writeNew(dir,base,ext,write){
 for(let n=1;n<1000;n++){const file=path.join(dir,base+(n>1?'_'+n:'')+ext);try{await write(file);return file;}catch(e){if(e.code!=='EEXIST')throw e;}}
 throw Error('Nem találok szabad fájlnevet a mentéshez.');
}

export function createWorkflowSaver({root,history,runner,library,fetchImpl=fetch,openFolder,openFile,comfyDir,chooseSave}){
 const dir=path.join(root,SAVED_DIR),marker=path.join(root,'data','workflow-save.json');
 async function register(){
  let state={};try{state=JSON.parse(await readFile(marker,'utf8'));}catch{}
  if(state.registered||!library)return;
  try{await library.add(dir,'workflow','Creator Hub · mentett workflow-k');state.registered=true;await mkdir(path.dirname(marker),{recursive:true});await writeFile(marker,JSON.stringify(state),'utf8');}catch{}
 }
 async function preview(entry,job,run,base){
  try{
   if(entry.mode!=='video'&&job.mode!=='video'){const loc=await history.location(entry.id);if(!loc.available)return null;const ext=path.extname(loc.path).toLowerCase();if(!['.png','.jpg','.jpeg','.webp'].includes(ext))return null;const file=path.join(dir,base+'.preview'+ext);await copyFile(loc.path,file,constants.COPYFILE_EXCL);return file;}
   if(!job.imagePath||!run.backend)return null;const parts=job.imagePath.split('/'),filename=parts.pop(),subfolder=parts.join('/');
   const r=await fetchImpl(run.backend+'/view?'+new URLSearchParams({filename,subfolder,type:'input'}),{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)return null;
   const bytes=Buffer.from(await r.arrayBuffer());if(!bytes.length||bytes.length>8*1024**2)return null;
   const ext=/\.png$/i.test(filename)?'.png':/\.webp$/i.test(filename)?'.webp':'.jpg';const file=path.join(dir,base+'.preview'+ext);await writeFile(file,bytes,{flag:'wx'});return file;
  }catch{return null;}
 }
 async function save(data){
  const entry=await history.item(data?.id);if(!entry.runId)throw Error('Ehhez az eredményhez nincs mentett generálási recept.');
  const run=await runner.load(entry.runId),job=run.jobs.find(j=>j.shotId===entry.shotId);
  if(!job?.prompt)throw Error('Ehhez a régi eredményhez nincs mentett generálási recept.');
  const d=describeJob(entry,{...job,mode:job.mode||run.mode});await mkdir(dir,{recursive:true});
  const file=await writeNew(dir,d.base,d.ext,f=>writeFile(f,d.content,{encoding:'utf8',flag:'wx'}));
  const stem=path.basename(file,'.json');
  await writeFile(path.join(dir,stem+'.txt'),d.recipe,{encoding:'utf8',flag:'wx'}).catch(()=>{});
  const image=await preview(entry,job,run,stem);
  await register();let listed=false;try{listed=!!await library?.remember(file,'workflow');}catch{}
  return {saved:true,path:file,folder:dir,name:path.basename(file),preview:image?path.basename(image):null,listed};
 }
 // Saves the currently loaded source workflow unchanged (no Hub prompt/seed/size/LoRA settings) as a new file.
 // target: 'hub' = Mentett_workflowk (Készlettár), 'comfy' = ComfyUI workflow list (…/user/default/workflows/ArtofTomworks_Hub),
 // 'custom' = Windows "Save as" dialog. Never overwrites: an existing name gets _2, _3 …
 const recent=new Set();let customFolder='';
 async function saveSource(data){
  const src=data?.source;if(!src||typeof src!=='object'||Array.isArray(src))throw Error('Nincs betöltött workflow. Előbb tölts be egyet.');
  const ui=Array.isArray(src.nodes);if(!ui&&!Object.values(src).some(n=>n&&typeof n==='object'&&typeof n.class_type==='string'))throw Error('A betöltött forrás nem ComfyUI-workflow.');
  const content=JSON.stringify(src,null,2);if(content.length>6*1024**2)throw Error('Legfeljebb 6 MiB-os workflow menthető.');
  const target=['hub','comfy','custom'].includes(data.target)?data.target:'hub';
  const name=String(data.name||'workflow').replace(/\.api\.json$|\.json$/i,'');let base=stamp(Date.now())+'_'+(slug(name,70)||'workflow'),ext=ui?'.json':'.api.json',folder=dir;
  if(target==='comfy'){
   if(!ui)throw Error('A ComfyUI workflow-listájába szerkeszthető (UI) workflow menthető, ez a forrás API-formátumú. Mentsd a Hub mappába – a ComfyUI-ba a fájl behúzásával így is megnyitható.');
   const comfy=await comfyDir?.();if(!comfy)throw Error('Nem ismert a ComfyUI mappája. A Motor beállításainál add meg, vagy mentsd a Hub mappába.');
   folder=path.join(comfy,'user','default','workflows','ArtofTomworks_Hub');
  }
  if(target==='custom'){
   if(!chooseSave)throw Error('A „Máshova…” mentés itt nem érhető el.');
   const chosen=await chooseSave(base+ext,{folder:customFolder});if(!chosen)return {saved:false,cancelled:true};
   const parsed=path.parse(chosen);folder=parsed.dir;customFolder=folder;base=parsed.name.replace(/\.api$/i,'')||base;ext=/\.api$/i.test(parsed.name)?'.api.json':'.json';
  }
  await mkdir(folder,{recursive:true});const file=await writeNew(folder,base,ext,f=>writeFile(f,content,{encoding:'utf8',flag:'wx'}));recent.add(file);
  if(target==='hub')await register();let listed=false;try{listed=!!await library?.remember(file,'workflow');}catch{}
  return {saved:true,target,path:file,folder,name:path.basename(file),listed};
 }
 async function reveal(data){const file=data?.path;if(!recent.has(file))throw Error('Csak az ebben a munkamenetben mentett fájl helye nyitható meg innen.');if(!openFolder)throw Error('A mappa megnyitása itt nem érhető el: '+path.dirname(file));await openFile?.(file);return {opened:true};}
 // 0.16 DEV: "Workflow betöltése" in Előzmények – the exact graph a result was generated with, its seed and start image.
 async function loadInfo(data){
  const entry=await history.item(data?.id);if(!entry.runId)throw Error('Ehhez az eredményhez nincs mentett generálási recept.');
  const run=await runner.load(entry.runId),job=run.jobs.find(j=>j.shotId===entry.shotId);
  if(!job?.prompt)throw Error('Ehhez a régi eredményhez nincs mentett generálási recept.');
  const base=String(entry.filename||'eredmeny').replace(/\.[a-z0-9]+$/i,'');
  return {source:job.workflow||job.prompt,name:'Előzmény · '+base+(job.workflow?'.json':'.api.json'),seed:entry.seed??job.seed??null,runId:entry.runId,shotId:entry.shotId,hasStartImage:!!job.imagePath,mode:entry.mode||job.mode||run.mode||'',duration:Number.isFinite(Number(job.requested))&&Number(job.requested)>0?Number(job.requested):Number.isFinite(job.seconds)&&job.seconds>0?Math.round(job.seconds*10)/10:null,seconds:Number.isFinite(job.seconds)?job.seconds:null};
 }
 async function open(){await mkdir(dir,{recursive:true});if(!openFolder)throw Error('A mappa megnyitása itt nem érhető el: '+dir);await openFolder(dir);return {opened:true,folder:dir};}
 return {save,saveSource,loadInfo,reveal,open,dir};
}
