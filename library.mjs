import {writeAssetPreview} from './asset-preview.mjs';
import {openInExplorer} from './native-open.mjs';
import {readAssetSource} from './asset-source.mjs';
import {readdir,stat,readFile,open,mkdir,writeFile,rename} from 'node:fs/promises';
import {realpath as resolveLinks} from 'node:fs';
import {promisify} from 'node:util';
import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {headerProfile} from './model-profile.mjs';
import {metadataFamily} from './catalog.mjs';
const realpath=promisify(resolveLinks);
export const KINDS={checkpoint:'Checkpoint',diffusion:'Kép- / videómodell',lora:'LoRA / LyCORIS',controlnet:'ControlNet / adapter',vae:'VAE / Approx VAE',text_encoder:'Szövegkódoló',clip_vision:'CLIP Vision',upscale:'Felskálázó',embedding:'Embedding',ipadapter:'IP-Adapter',pose_depth:'Póz / mélység / szegmentálás',audio:'Hangmodell / hangkódoló',workflow:'Workflow',node_pack:'Node-csomag',other:'Egyéb modell'};
const ALIASES={checkpoint:'checkpoint',checkpoints:'checkpoint',stablediffusion:'checkpoint',diffusionmodels:'diffusion',diffusion_models:'diffusion',unet:'diffusion',diffusers:'diffusion',loras:'lora',lora:'lora',lycoris:'lora',controlnet:'controlnet',t2iadapter:'controlnet',t2i_adapter:'controlnet',model_patches:'controlnet',modelpatches:'controlnet',vae:'vae',vae_approx:'vae',approxvae:'vae',textencoders:'text_encoder',text_encoders:'text_encoder',clip:'text_encoder',clipvision:'clip_vision',clip_vision:'clip_vision',esrgan:'upscale',realesrgan:'upscale',swinir:'upscale',upscale_models:'upscale',upscale_models_dir:'upscale',upscale:'upscale','upscale-models':'upscale',latent_upscale_models:'upscale',embeddings:'embedding',embedding:'embedding',ipadapter:'ipadapter',ipadapters15:'ipadapter',ipadaptersxl:'ipadapter',ultralytics:'pose_depth',sams:'pose_depth',sam2:'pose_depth',depthanything:'pose_depth',depthanythingv2:'pose_depth',dwpose:'pose_depth',openpose:'pose_depth',audio_encoders:'audio',audioencoders:'audio',audio:'audio',workflows:'workflow',custom_nodes:'node_pack'};
const MODEL_EXT=new Set(['.safetensors','.sft','.ckpt','.gguf','.pt','.pth','.bin','.onnx','.tflite','.pkl']);
const IMAGE_EXT=new Set(['.png','.jpg','.jpeg','.webp']);
const SKIP=new Set(['.creator-hub-trash','.git','.venv','venv','node_modules','__pycache__','$recycle.bin','system volume information','windows','appdata']);
const key=p=>path.resolve(p).toLocaleLowerCase();const ident=p=>createHash('sha256').update(key(p)).digest('hex').slice(0,24);
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const exists=async p=>{try{return (await stat(p)).isDirectory();}catch{return false;}};
const cleanValue=v=>{v=v.trim().replace(/\s+#.*$/,'');if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);return v;};
const expand=v=>v.replace(/^~(?=[/\\]|$)/,os.homedir()).replace(/%([^%]+)%/g,(m,n)=>process.env[n]||m);

// Deliberately supports the ordinary extra_model_paths mapping, without executing YAML tags.
// Exotic YAML constructs are ignored, never interpreted as commands or guessed paths.
export function extraPaths(text,configFile){
 const groups=[];let group=null,block=null;
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  if(!raw.trim()||raw.trimStart().startsWith('#'))continue;
  const top=/^([^\s:#][^:]*):\s*(?:#.*)?$/.exec(raw);if(top){group={base:'',paths:[]};groups.push(group);block=null;continue;}
  if(!group)continue;
  if(block&&(raw.match(/^\s*/)?.[0].length||0)>block.indent){const value=cleanValue(raw);if(value&&!/^[!*&]/.test(value))group.paths.push({kind:block.kind,value});continue;}
  const field=/^(\s+)([\w-]+):\s*(.*)$/.exec(raw);
  if(field){block=null;const name=field[2],value=cleanValue(field[3]);if(name==='base_path'){group.base=value;continue;}const kind=ALIASES[name.toLowerCase()];if(!kind)continue;
   if(/^\|[-+]?$/.test(value)||/^>[-+]?$/.test(value)){block={indent:field[1].length,kind};continue;}
   if(value&&!/^[\[{!*&]/.test(value))group.paths.push({kind,value});continue;
  }
  if(block&&(raw.match(/^\s*/)?.[0].length||0)>block.indent){const value=cleanValue(raw);if(value&&!/^[!*&]/.test(value))group.paths.push({kind:block.kind,value});}
 }
 return groups.flatMap(g=>g.paths.map(p=>({path:path.resolve(g.base?path.resolve(path.dirname(configFile),expand(g.base)):path.dirname(configFile),expand(p.value)),kind:p.kind,origin:'Beállítás: '+path.basename(configFile)})));
}
export async function discoverFolders({seeds,configFiles=[],home=os.homedir()}={}){
 if(!seeds){
  seeds=[path.join(home,'ComfyUI'),path.join(home,'SwarmUI'),path.join(home,'StabilityMatrix'),path.join(home,'Documents','ComfyUI')];
  if(process.platform==='win32')for(const drive of ['C:','D:','E:','F:']){
   const driveRoot=drive+'\\';let entries=[];try{entries=await readdir(driveRoot,{withFileTypes:true});}catch{}
   for(const e of entries)if(e.isDirectory()&&/^(?:AIWorks?|AI|ComfyUI.*|SwarmUI.*|StabilityMatrix.*|Data|Packages)$/i.test(e.name))seeds.push(path.join(driveRoot,e.name));
  }
 }
 const found=[],configs=new Set(configFiles),visited=new Set(),queue=seeds.map(p=>({p,depth:0}));
 while(queue.length&&visited.size<500){const {p,depth}=queue.shift(),k=key(p);if(visited.has(k))continue;visited.add(k);if(!await exists(p))continue;
  const main=await stat(path.join(p,'main.py')).then(s=>s.isFile()).catch(()=>false),swarm=await exists(path.join(p,'src','BuiltinExtensions','ComfyUIBackend'));
  if(main){found.push({path:path.join(p,'models'),kind:'auto',origin:'ComfyUI'},{path:path.join(p,'custom_nodes'),kind:'node_pack',origin:'ComfyUI'},{path:path.join(p,'user','default','workflows'),kind:'workflow',origin:'ComfyUI'});configs.add(path.join(p,'extra_model_paths.yaml'));}
  if(swarm){found.push({path:path.join(p,'Models'),kind:'auto',origin:'SwarmUI'});configs.add(path.join(p,'Data','comfy-auto-model.yaml'));}
  let children=[];try{children=await readdir(p,{withFileTypes:true});}catch{}
  for(const e of children){if(!e.isDirectory()||e.isSymbolicLink())continue;
   if(/^(?:Models)$/i.test(e.name))found.push({path:path.join(p,e.name),kind:'auto',origin:'Helyi modellkönyvtár'});
   if(depth<4&&/^(?:Data|Packages|ComfyUI.*|SwarmUI|StabilityMatrix|dlbackend|backends|stable-diffusion-webui.*)$/i.test(e.name))queue.push({p:path.join(p,e.name),depth:depth+1});
  }
 }
 for(const file of configs){try{const s=await stat(file);if(s.size>1024**2)continue;found.push(...extraPaths(await readFile(file,'utf8'),file));}catch{}}
 const out=new Map();for(const f of found){try{const actual=await realpath(f.path);if(!await exists(actual))continue;const k=key(actual),old=out.get(k);if(!old||old.kind==='auto')out.set(k,{...f,path:actual});}catch{}}
 return [...out.values()];
}
export async function pickFolder(){
 if(process.platform!=='win32')throw Error('Írd be a mappa teljes elérési útját.');
 const script="Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Creator Hub - Select a model or workflow folder'; $d.ShowNewFolderButton = $false; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::Write($d.SelectedPath) }; $d.Dispose()";
 return new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='';p.stdout.on('data',b=>text+=b.toString('utf8'));p.once('error',reject);p.once('exit',code=>code===0?resolve(text.trim()):reject(Error('A mappaválasztó nem indult el. Írd be az útvonalat.')));});
}
export function createLibrary({root,discover=discoverFolders,openItem}={}){
 const settingsFile=path.join(root,'data','library.json'),indexFile=path.join(root,'data','library-index.json');
 const profiles=new Map();
 let settings={roots:[],favorites:[],hidden:[]},items=[],scan={state:'idle',files:0,folders:0,errors:0},initialized=false,initializing,write=Promise.resolve(),cancel=false,task=null;
 const ready=()=>initializing||=(async()=>{try{settings={...settings,...JSON.parse(await readFile(settingsFile,'utf8'))};}catch(e){if(e.code!=='ENOENT')scan.message='A készlettár beállításai nem olvashatók.';}try{items=JSON.parse(await readFile(indexFile,'utf8'));if(!Array.isArray(items))items=[];}catch{}initialized=true;})();
 async function persist(index=false){const value=JSON.stringify(index?items:settings),file=index?indexFile:settingsFile;write=write.catch(()=>{}).then(async()=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',value,'utf8');await rename(file+'.tmp',file);});await write;}
 function visible(){const enabled=new Set(settings.roots.filter(r=>r.enabled).map(r=>r.id));return items.filter(i=>i.roots.some(r=>enabled.has(r)));}
 async function state(){await ready();const counts={};for(const i of visible())counts[i.kind]=(counts[i.kind]||0)+1;return {roots:settings.roots,counts,total:visible().length,scan,kinds:KINDS};}
 async function add(folder,kind='auto',origin='Saját mappa'){
  await ready();if(scan.state==='scanning')throw Error('A mappák módosítása előtt állítsd le a keresést.');if(!path.isAbsolute(folder||''))throw Error('A mappa teljes elérési útját add meg.');if(kind!=='auto'&&!KINDS[kind])throw Error('Ismeretlen kategória.');const actual=await realpath(folder);if(!await exists(actual))throw Error('Nem könyvtár.');
  const id=ident(actual),old=settings.roots.find(r=>r.id===id);if(old){old.kind=kind;old.enabled=true;}else settings.roots.push({id,path:actual,kind,origin,enabled:true});settings.hidden=settings.hidden.filter(v=>v!==id);await persist();return state();
 }
 async function manage(id,action){await ready();if(scan.state==='scanning')throw Error('Előbb állítsd le a keresést.');const r=settings.roots.find(r=>r.id===id);if(!r)throw Error('Ismeretlen könyvtár.');if(action==='remove'){settings.roots=settings.roots.filter(r=>r.id!==id);settings.hidden=[...new Set([...settings.hidden,id])];items=items.map(i=>({...i,roots:i.roots.filter(v=>v!==id)})).filter(i=>i.roots.length);await persist(true);}else if(action==='toggle')r.enabled=!r.enabled;else throw Error('Ismeretlen művelet.');await persist();return state();}
 async function start({auto=true}={}){
  await ready();if(scan.state==='scanning')return state();cancel=false;scan={state:'scanning',files:0,folders:0,errors:0,started:Date.now(),message:'Mappák felderítése…'};
  task=scanAll(auto).catch(e=>{scan={...scan,state:'error',message:e.message};});return state();
 }
 async function scanAll(auto){
  if(auto){const found=await discover();for(const f of found){const id=ident(f.path);if(settings.hidden.includes(id)||settings.roots.some(r=>r.id===id))continue;settings.roots.push({...f,id,enabled:true});}await persist();}
  const map=new Map(),visited=new Map();let capped=false;
  const record=(file,kind,r,s,preview=null,directory=false)=>{const id=ident(file),old=map.get(id);if(old){old.roots=[...new Set([...old.roots,r.id])];if(old.kind==='other'&&kind!=='other')old.kind=kind;return;}
   map.set(id,{id,path:file,name:path.basename(file),kind,size:s.size,mtime:s.mtimeMs,preview,directory,roots:[r.id]});scan.files=map.size;
  };
  async function walk(dir,r,inherited,depth=0){
   if(cancel)return;if(map.size>=25000||scan.folders>=15000||depth>30){capped=true;return;}scan.folders++;scan.message=dir;
   let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{scan.errors++;return;}
   const imageFiles=new Map(entries.filter(e=>e.isFile()&&IMAGE_EXT.has(path.extname(e.name).toLowerCase())).map(e=>[e.name.toLowerCase(),e.name]));
   if(inherited==='diffusion'&&entries.some(e=>e.name==='model_index.json')){try{record(dir,'diffusion',r,await stat(dir),null,true);}catch{}return;}
   for(const entry of entries){if(cancel)break;if(entry.isSymbolicLink()||SKIP.has(entry.name.toLowerCase()))continue;const file=path.join(dir,entry.name);
    if(entry.isDirectory()){
     if(inherited==='node_pack'){try{record(file,'node_pack',r,await stat(file),null,true);}catch{scan.errors++;}continue;}
     const kind=inherited&&inherited!=='auto'?inherited:ALIASES[entry.name.toLowerCase()]||'auto';await walk(file,r,kind,depth+1);continue;
    }
    if(!entry.isFile())continue;const ext=path.extname(entry.name).toLowerCase();if(inherited==='node_pack'){if(ext==='.py')try{record(file,'node_pack',r,await stat(file));}catch{}continue;}
    if(!MODEL_EXT.has(ext)&&!(inherited==='workflow'&&ext==='.json'))continue;
    if(map.size>=25000){capped=true;break;}
    const kind=inherited&&inherited!=='auto'?inherited:'other',stem=path.basename(entry.name,ext).toLowerCase();let preview=null;
    for(const suffix of ['.hub-preview','.preview','.thumb','-preview','']){for(const imageExt of IMAGE_EXT){const match=imageFiles.get(stem+suffix+imageExt);if(match){preview=path.join(dir,match);break;}}if(preview)break;}
    try{record(file,kind,r,await stat(file),preview);}catch{scan.errors++;}
    if(map.size%100===0)await new Promise(r=>setImmediate(r));
   }
  }
  for(const r of settings.roots.filter(r=>r.enabled)){if(cancel)break;await walk(r.path,r,r.kind);}
  if(!cancel){items=[...map.values()];await persist(true);}
  scan={...scan,state:cancel?'cancelled':capped?'partial':'complete',finished:Date.now(),message:cancel?'A keresés leállt. Az előző teljes lista megmaradt.':capped?'Részleges lista: a keresési korlátot elértem. Adj meg szűkebb könyvtárakat.':`${map.size} készletelem megtalálva. ${scan.errors} nem olvasható hely.`};
 }
 async function profile(i){
  const key=i.id+':'+i.size+':'+i.mtime;if(profiles.has(key))return profiles.get(key);
  const task=(async()=>{let metadata={},family=null,conflict=false;if(path.extname(i.path).toLowerCase()==='.safetensors'){let handle;try{handle=await open(i.path,'r');const length=Buffer.alloc(8);await handle.read(length,0,8,0);const size=Number(length.readBigUInt64LE());if(size>1&&size<=16*1024**2&&size+8<=i.size){const header=Buffer.alloc(size);await handle.read(header,0,size,8);const parsed=JSON.parse(header.toString('utf8'));metadata=parsed.__metadata__||{};const profile=headerProfile(parsed);family=profile.family;conflict=!!profile.conflict;}}catch{}finally{await handle?.close();}}const source=await readAssetSource(i.path);if(!family&&!conflict)family=source?.family||null;metadata=Object.fromEntries(['modelspec.title','modelspec.description','modelspec.architecture','ss_base_model_version','modelspec.resolution','modelspec.license','ss_tag_frequency'].filter(k=>typeof metadata[k]==='string').map(k=>[k,metadata[k].slice(0,k==='ss_tag_frequency'?800:2500)]));return {metadata,family,source,conflict};})();if(profiles.size>=4096)profiles.delete(profiles.keys().next().value);profiles.set(key,task);return task;
 }
 async function list({query='',kind='',favorites=false,page=1,sort='name',profiles:includeProfiles=false,loraFamily='',filterLoras=false,showAllLoras=false,allowUnknownLoras=false}={}){
  await ready();let result=visible();const terms=String(query).toLocaleLowerCase().split(/\s+/).filter(Boolean);if(terms.length)result=result.filter(i=>terms.every(t=>(i.name+' '+i.path+' '+KINDS[i.kind]).toLocaleLowerCase().includes(t)));if(kind)result=result.filter(i=>kind==='model'?['checkpoint','diffusion'].includes(i.kind):i.kind===kind);if(favorites)result=result.filter(i=>settings.favorites.includes(i.id));
  if(filterLoras&&loraFamily||includeProfiles){let next=0;const enriched=new Array(result.length);await Promise.all(Array.from({length:4},async()=>{while(next<result.length){const n=next++,i=result[n];enriched[n]=i.kind==='lora'||includeProfiles?{...i,family:(await profile(i)).family}:i;}}));result=enriched;}
  const hiddenLoras=filterLoras&&loraFamily&&!showAllLoras?result.filter(i=>i.kind==='lora'&&(i.family?i.family!==loraFamily:!allowUnknownLoras)).length:0;
  if(filterLoras&&loraFamily&&!showAllLoras)result=result.filter(i=>i.kind!=='lora'||(i.family?i.family===loraFamily:allowUnknownLoras));
  result.sort((a,b)=>Number(settings.favorites.includes(b.id))-Number(settings.favorites.includes(a.id))||(sort==='recent'?b.mtime-a.mtime:sort==='size'?b.size-a.size:0)||a.name.localeCompare(b.name,'hu',{numeric:true}));const wanted=Number(page)||1;
  // 0.16 DEV: files deleted outside the Hub disappear at once – the shown page is checked on disk and missing
  // entries are dropped from the index (no rescan or restart needed). Folders and unreadable paths are left alone.
  for(let round=0;round<3;round++){page=Math.min(Math.max(1,wanted),Math.max(1,Math.ceil(result.length/36)));const gone=new Set();
   await Promise.all(result.slice((page-1)*36,page*36).map(async i=>{if(i.directory)return;try{await stat(i.path);}catch(e){if(e.code==='ENOENT')gone.add(i.id);}}));
   if(!gone.size)break;result=result.filter(i=>!gone.has(i.id));if(scan.state!=='scanning'){items=items.filter(i=>!gone.has(i.id));await persist(true);}}
  return {total:result.length,hiddenLoras,page,pages:Math.max(1,Math.ceil(result.length/36)),items:result.slice((page-1)*36,page*36).map(i=>({...i,preview:!!i.preview,favorite:settings.favorites.includes(i.id),kindLabel:KINDS[i.kind]}))};
 }
 async function item(id){await ready();const i=visible().find(i=>i.id===id);if(!i)throw Error('A készletelem már nem szerepel az aktív könyvtárakban.');return i;}
 async function detail(id){const i=await item(id),{metadata,family,source,conflict}=await profile(i);let description='';
  const fields=['modelspec.title','modelspec.description','modelspec.architecture','ss_base_model_version','modelspec.resolution','modelspec.license','ss_tag_frequency'];const meta=Object.fromEntries(fields.filter(k=>typeof metadata[k]==='string').map(k=>[k,metadata[k].slice(0,k==='ss_tag_frequency'?800:2500)]));
  const stem=i.path.slice(0,-path.extname(i.path).length);for(const filename of [stem+'.description.txt',stem+'.txt'])try{const real=await realpath(filename);if(path.dirname(real)!==path.dirname(i.path))continue;const s=await stat(real);if(s.size<=32000){description=(await readFile(real,'utf8')).slice(0,6000);break;}}catch{}
  return {...i,preview:!!i.preview,kindLabel:KINDS[i.kind],favorite:settings.favorites.includes(i.id),family,source,conflict,metadata:meta,description};
 }
 async function setPreview({id,image}){if(task)await task;const i=await item(id);if(i.directory||!MODEL_EXT.has(path.extname(i.path).toLowerCase()))throw Error('Ehhez az elemhez nem rendelhető modell-bélyegkép.');if(typeof image!=='string'||image.length>12*1024**2||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw Error('Érvénytelen bélyegkép.');const result=await writeAssetPreview(i.path,Buffer.from(image.split(',')[1],'base64'),{custom:true});if(task)await task;const current=await item(id);current.preview=result.path;await persist(true);return {saved:result.saved};}
 async function thumbnail(id,res){const i=await item(id);if(!i.preview)throw Error('Nincs helyi előnézeti kép.');const real=await realpath(i.preview);if(!inside(path.dirname(i.path),real)||!IMAGE_EXT.has(path.extname(real).toLowerCase()))throw Error('Az előnézet nem ebben a könyvtárban van.');const s=await stat(real);if(s.size>12*1024**2)throw Error('Túl nagy előnézeti kép.');const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};res.writeHead(200,{'Content-Type':types[path.extname(real).toLowerCase()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(real));}
 async function favorite(id,on){await item(id);settings.favorites=settings.favorites.filter(v=>v!==id);if(on)settings.favorites.push(id);await persist();return {saved:true};}
 async function workflow(id){const i=await item(id);if(i.kind!=='workflow'||path.extname(i.path).toLowerCase()!=='.json')throw Error('Nem workflow JSON.');const s=await stat(i.path);if(s.size>6*1024**2)throw Error('Legfeljebb 6 MiB-os workflow tölthető be.');return {source:JSON.parse(await readFile(i.path,'utf8'))};}
 async function openLocation(id){const i=await item(id);if(openItem)return openItem(i.path,i.directory);if(process.platform!=='win32')throw Error('Ezen a rendszeren másold ki az útvonalat.');return openInExplorer(i.path,{directory:!!i.directory});}
 // 0.16 DEV: puts one freshly written file (e.g. a saved workflow) into the index of an existing, enabled root,
 // so it shows up in Készlettár at once, without a full rescan. Returns false when that is not possible.
 async function remember(file,kind){await ready();if(scan.state==='scanning'||!KINDS[kind])return false;const actual=await realpath(file),s=await stat(actual);
  const root=settings.roots.filter(r=>r.enabled).find(r=>{const rel=path.relative(r.path,actual);return rel&&!rel.startsWith('..')&&!path.isAbsolute(rel);});if(!root)return false;
  const ext=path.extname(actual),stem=path.basename(actual,ext).toLowerCase(),dir=path.dirname(actual);let preview=null;try{const names=new Map((await readdir(dir)).map(n=>[n.toLowerCase(),n]));for(const suffix of ['.hub-preview','.preview','.thumb','-preview','']){for(const imageExt of IMAGE_EXT){const m=names.get(stem+suffix+imageExt);if(m){preview=path.join(dir,m);break;}}if(preview)break;}}catch{}
  const id=ident(actual);items=items.filter(i=>i.id!==id);items.push({id,path:actual,name:path.basename(actual),kind,size:s.size,mtime:s.mtimeMs,preview,directory:false,roots:[root.id]});await persist(true);return true;}
 return {state,add,manage,start,list,detail,thumbnail,setPreview,favorite,workflow,openLocation,remember,async stop(){cancel=true;return state();},async wait(){if(task)await task;return state();}};
}
