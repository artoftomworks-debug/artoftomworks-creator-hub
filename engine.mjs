import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {atomicJSON} from './storage.mjs';

const fileExists=async p=>!!p&&await stat(p).then(s=>s.isFile()).catch(()=>false);
export async function findInstallations(roots=[],explicit=[]){
 const folders=new Set(explicit);for(const entry of roots){let folder=typeof entry==='string'?entry:entry.path;if(!folder)continue;for(let i=0;i<8;i++){if(/^(comfyui|comfyui_windows_portable)$/i.test(path.basename(folder)))folders.add(folder);const parent=path.dirname(folder);if(parent===folder)break;folder=parent;}}
 for(const folder of [path.join(os.homedir(),'ComfyUI'),path.join(os.homedir(),'Documents','ComfyUI'),'C:/AIWorks/Data/Packages/ComfyUI','C:/ComfyUI','C:/ComfyUI_windows_portable'])folders.add(folder);
 const found=[];for(const folder of folders){const directory=await fileExists(path.join(folder,'main.py'))?folder:await fileExists(path.join(folder,'ComfyUI','main.py'))?path.join(folder,'ComfyUI'):null;if(!directory)continue;
  const interpreters=[path.join(directory,'venv','Scripts','python.exe'),path.join(directory,'.venv','Scripts','python.exe'),path.join(directory,'venv','bin','python'),path.join(directory,'.venv','bin','python'),path.join(path.dirname(directory),'python_embeded','python.exe'),path.join(path.dirname(directory),'python_embedded','python.exe')];
  for(const python of interpreters)if(await fileExists(python)){if(!found.some(i=>path.resolve(i.directory)===path.resolve(directory)))found.push({directory,python});break;}
 }return found;
}
const freePort=port=>new Promise(resolve=>{const s=createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});
export function createEngine({root,roots=async()=>[],fetchImpl=fetch,spawnProcess=spawn,portAvailable=freePort,enabled=true,startupMS=240000,now=Date.now}={}){
 const configFile=path.join(root,'data','engine.json');let config,initializing,child=null,state='stopped',error='',logs='',started=0,booting=null,owned=false,installations=[],checking=null,lastCheck=0,lastHealth=null;
 const append=text=>{logs=(logs+String(text).replace(/\x1b\[[0-9;]*m/g,'')).slice(-16000);};
 async function init(){if(!initializing)initializing=(async()=>{try{const saved=JSON.parse(await readFile(configFile,'utf8'));if(saved.schema!=='artoftomworks.creator-hub.engine')throw Error('Érvénytelen motorbeállítás.');config=saved;}catch(e){if(e.code!=='ENOENT')throw e;config={schema:'artoftomworks.creator-hub.engine',version:1,mode:'managed',directory:'',python:'',port:8190};}return config;})();return initializing;}
 const url=()=> 'http://127.0.0.1:'+config.port;
 async function health(backend=url()){
  try{const options={redirect:'error',signal:AbortSignal.timeout(1400)},s=await fetchImpl(backend+'/system_stats',options);if(!s.ok)return null;const stats=await s.json();if(!stats.system||!Array.isArray(stats.devices))return null;const q=await fetchImpl(backend+'/queue',{...options,signal:AbortSignal.timeout(1400)});if(!q.ok)return null;const queue=await q.json();if(!Array.isArray(queue.queue_running)||!Array.isArray(queue.queue_pending))return null;return {running:queue.queue_running.length,pending:queue.queue_pending.length};}catch{return null;}
 }
 async function discover(){await init();installations=await findInstallations(await roots());return installations;}
 async function validate(directory,python){if(typeof directory!=='string'||!path.isAbsolute(directory)||!await fileExists(path.join(directory,'main.py')))throw Error('A ComfyUI mappáját válaszd ki, amelyben a main.py található.');if(!python){const found=await findInstallations([],[directory]);python=found.find(i=>path.resolve(i.directory)===path.resolve(directory))?.python;}if(typeof python!=='string'||!path.isAbsolute(python)||!/^python(?:3(?:\.\d+)?)?(?:\.exe)?$/i.test(path.basename(python))||!await fileExists(python))throw Error('A ComfyUI saját Python-futtatója szükséges (venv/Scripts/python.exe vagy hordozható Python).');return {directory:path.resolve(directory),python:path.resolve(python)};}
 async function configure(data){await init();if(booting||child||state==='starting')throw Error('A motor beállításait leállított állapotban változtasd meg.');if(!['managed','external'].includes(data.mode))throw Error('Ismeretlen motorkezelési mód.');const next={...config,mode:data.mode};if(data.directory||data.python)Object.assign(next,await validate(data.directory,data.python));if(data.port!==undefined){if(!Number.isInteger(data.port)||data.port<1024||data.port>65525)throw Error('A motor portja 1024–65525 közötti egész szám legyen.');next.port=data.port;}config=next;await atomicJSON(configFile,config);lastCheck=0;lastHealth=null;return status(false);}
 async function status(probe=true){await init();if(!enabled)return {enabled:false,state:'external',mode:'external',backend:null,owned:false,config,installations,logs:''};
  if(probe&&config.mode==='managed'&&!checking&&now()-lastCheck>800){checking=health().then(value=>{lastCheck=now();lastHealth=value;if(value){state='ready';error='';}else if(state==='ready')state=child?'starting':'stopped';if(state==='starting'&&child&&now()-started>startupMS){state='error';error='A ComfyUI indítása túl sokáig tart. A napló mutatja, hol akadt el; nem indítok második motort.';}}).finally(()=>{checking=null;});}if(checking)await checking;
  return {enabled:true,state,mode:config.mode,backend:url(),owned:!!child&&owned,pid:child?.pid||null,config,installations,error,logs,started,queue:lastHealth};
 }
 async function start(){await init();if(!enabled||config.mode==='external')return status(false);if(booting)return booting;if(child)return status();
  booting=(async()=>{error='';logs='';const live=await health();if(live){state='ready';owned=false;lastHealth=live;lastCheck=now();return status(false);}
   if(!config.directory){for(const port of [8188,7821]){const existing=await health('http://127.0.0.1:'+port);if(existing){config={...config,port};await atomicJSON(configFile,config);state='ready';owned=false;lastHealth=existing;lastCheck=now();return status(false);}}}
   let selected=config.directory&&config.python?await validate(config.directory,config.python):null;if(!selected){const found=await discover();if(found.length!==1)throw Error(found.length?'Több ComfyUI-telepítést találtam. Válaszd ki a használni kívánt motort a Motor beállításainál.':'Nem található egyértelmű, saját Pythonnal rendelkező ComfyUI. A Motor beállításainál válaszd ki a telepítését.');selected=found[0];}
   let port=config.port,available=false;for(let i=0;i<10;i++){if(await portAvailable(port+i)){port+=i;available=true;break;}}if(!available)throw Error('Nincs szabad helyi port a ComfyUI-motornak.');config={...config,...selected,port};await atomicJSON(configFile,config);
   const args=['-u',path.join(config.directory,'main.py'),'--listen','127.0.0.1','--port',String(port),'--disable-auto-launch','--preview-method','latent2rgb'];
   // Keep installed model and node paths, but never start or update SwarmUI.
   const nodeFolders=(await roots()).filter(r=>r.kind==='nodepack'||/[/\\](?:DLNodes|ExtraNodes)$/i.test(r.path||'')).map(r=>r.path).filter(Boolean);const hubNodes=path.join(path.dirname(fileURLToPath(import.meta.url)),'comfy_nodes');if(await stat(hubNodes).then(s=>s.isDirectory()).catch(()=>false))nodeFolders.push(hubNodes);if(nodeFolders.length){const yaml='creator_hub_nodes:\n  custom_nodes: |\n'+[...new Set(nodeFolders)].map(p=>'    '+p.replaceAll('\\','/')).join('\n')+'\n';const {mkdir,writeFile}=await import('node:fs/promises');const target=path.join(root,'data','engine-node-paths.yaml');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,yaml);args.push('--extra-model-paths-config',target);}
   state='starting';started=now();owned=true;lastHealth=null;lastCheck=0;const p=spawnProcess(config.python,args,{cwd:config.directory,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1',PYTHONUTF8:'1'}});child=p;
   p.stdout?.on('data',append);p.stderr?.on('data',append);p.once('error',e=>{if(child!==p)return;append('\n'+e.message);error='A ComfyUI nem indítható: '+e.message;state='error';child=null;owned=false;});p.once('exit',(code,signal)=>{if(child!==p)return;child=null;owned=false;lastHealth=null;lastCheck=0;const requested=state==='stopping';state=code===0||requested?'stopped':'error';error=code===0||requested?'':'A ComfyUI leállt ('+(signal||code)+'). Részletek a motornaplóban.';});return status(false);
  })().catch(e=>{state='error';error=e.message;throw e;}).finally(()=>{booting=null;});return booting;
 }
 async function stop(){await init();if(!child||!owned)throw Error('Csak az ezzel a Hubbal indított motor állítható le. A már máshol futó motort nem állítom le.');const live=await health();if(live&&(live.running||live.pending))throw Error('A motor még dolgozik vagy várakozó feladata van. Előbb állítsd le vagy fejezd be a generálást.');const p=child;state='stopping';p.kill();return status(false);}
 function close(){if(child&&owned){const p=child;child=null;owned=false;p.kill();}}
 return {status,discover,configure,start,stop,close,health};
}
