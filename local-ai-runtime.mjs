import {stat,mkdir,open,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';

// Daemon readiness only: no inference, installation, download or model loading.
export function createLocalAIRuntime({root,sourceRoot,fetchImpl=fetch,spawnProcess=spawn,env=process.env,platform=process.platform,waitMS=20000,pollMS=400,candidates,portBusy=checkPort}={}){
 let pending,state={state:'idle',ready:false,running:false,models:[],message:'A helyi MI még nincs ellenőrizve.'};
 const update=value=>(state={...value,updated:Date.now()});
 async function status(){try{
  const r=await fetchImpl('http://127.0.0.1:11434/api/tags',{redirect:'error',signal:AbortSignal.timeout(2000)});
  if(!r.ok)return null;const d=await r.json();if(!Array.isArray(d.models))return null;
  const models=d.models.map(v=>v.name).filter(v=>typeof v==='string'&&!/(?:-cloud|:cloud)$/i.test(v));
  return {state:models.length?'ready':'empty',ready:models.length>0,running:true,models,message:models.length?'Helyi MI használatra kész · '+models.length+' elérhető modell.':'Az Ollama fut, de még nincs telepített helyi modell. A Prompt Studio Helyi MI beállítása részében kiválaszthatod a következő lépést.'};
 }catch{return null;}}
 async function discover(){
  if(candidates)return candidates;const rows=[],seen=new Set();let at=sourceRoot||root||process.cwd();
  for(let n=0;n<8;n++){
   for(const base of [path.join(at,'runtime','ollama'),path.join(at,'tools','ollama-portable'),path.join(at,'sites','art-of-tomworks-prompt-studio','tools','ollama-portable')]){
    if(seen.has(base))continue;seen.add(base);const models=(await stat(path.join(base,'models')).catch(()=>null))?.isDirectory()?path.join(base,'models'):undefined;
    rows.push({exe:path.join(base,'ollama.exe'),models});
    const versions=(await readdir(base,{withFileTypes:true}).catch(()=>[])).filter(v=>v.isDirectory()&&/^v?\d+(?:\.\d+)+$/.test(v.name)).sort((a,b)=>b.name.localeCompare(a.name,undefined,{numeric:true}));
    for(const version of versions)rows.push({exe:path.join(base,version.name,'ollama.exe'),models});
   }
   const next=path.dirname(at);if(next===at)break;at=next;
  }
  const home=env.USERPROFILE||os.homedir(),local=env.LOCALAPPDATA||path.join(home,'AppData','Local');
  rows.push({exe:path.join(local,'Programs','Ollama','ollama.exe')},{exe:path.join(env.ProgramFiles||'C:/Program Files','Ollama','ollama.exe')});
  for(const folder of String(env.PATH||'').split(path.delimiter).filter(Boolean))rows.push({exe:path.join(folder,'ollama.exe')});return rows;
 }
 async function start(){
  update({state:'checking',ready:false,running:false,models:[],message:'Helyi MI ellenőrzése…'});
  const running=await status();if(running)return update({...running,reused:true});
  if(await portBusy())return update({state:'unavailable',ready:false,running:false,models:[],message:'Az Ollama címe már foglalt, de a modelllista nem olvasható. Ellenőrizd az Ollama állapotát, majd próbáld újra. Nem indítottam második példányt.'});
  if(platform!=='win32')return update({state:'unavailable',ready:false,running:false,models:[],message:'Indítsd el a helyi Ollamát, majd ellenőrizd újra a modelllistát.'});
  let selected;for(const row of await discover()){if(!(await stat(row.exe).catch(()=>null))?.isFile())continue;selected=row;break;}
  if(!selected)return update({state:'missing',ready:false,running:false,models:[],message:'Nincs telepített Ollama. A Prompt Studio kézi és külső MI-s eszközei használhatók. A Helyi MI beállítása rész megmutatja a telepítési lépéseket.'});
  // Recheck after discovery: another application may have started it meanwhile.
  const appeared=await status();if(appeared)return update({...appeared,reused:true});
  if(await portBusy())return update({state:'unavailable',ready:false,running:false,models:[],message:'Az Ollama már indul egy másik alkalmazásból. Várj néhány másodpercet, majd ellenőrizd újra a listát.'});
  update({state:'starting',ready:false,running:false,models:[],message:'Helyi MI indítása…'});
  const folder=path.join(root||sourceRoot,'data','logs');await mkdir(folder,{recursive:true});let output,error,child,spawnError;
  try{
   output=await open(path.join(folder,'ollama.stdout.log'),'a');error=await open(path.join(folder,'ollama.stderr.log'),'a');
   child=spawnProcess(selected.exe,['serve'],{cwd:path.dirname(selected.exe),detached:true,windowsHide:true,shell:false,stdio:['ignore',output.fd,error.fd],env:{...env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_NO_CLOUD:'1',OLLAMA_NUM_PARALLEL:'1',...(!env.OLLAMA_MODELS&&selected.models?{OLLAMA_MODELS:selected.models}:{})}});
   child.on('error',e=>spawnError=e);child.unref?.();
  }finally{await output?.close();await error?.close();}
  const deadline=Date.now()+waitMS;
  while(Date.now()<deadline){
   if(spawnError)throw Error('Az Ollama indítása nem sikerült. Ellenőrizd a telepítését; a napló a Hub data/logs mappájában található.');
   const ready=await status();if(ready)return update({...ready,started:true});
   if(child.exitCode!==null&&child.exitCode!==undefined)break;
   await new Promise(r=>setTimeout(r,pollMS));
  }
  return update({state:'unavailable',ready:false,running:false,models:[],message:'Az Ollama nem válaszolt az indítás után. A Prompt Studio kézi eszközei elérhetők. Próbáld újra a Hubból; a részletes indítási napló a Szerver nézetből elérhető.'});
 }
 async function logs(){let result='';for(const name of ['ollama.stderr.log','ollama.stdout.log']){let handle;try{handle=await open(path.join(root||sourceRoot,'data','logs',name),'r');const size=(await handle.stat()).size,bytes=Buffer.alloc(Math.min(6000,size));await handle.read(bytes,0,bytes.length,Math.max(0,size-bytes.length));result+=name+'\n'+bytes.toString('utf8')+'\n';}catch{}finally{await handle?.close();}}return result;}
 return {status,logs,snapshot:()=>structuredClone(state),ensure(){if(!pending)pending=start().catch(()=>update({state:'unavailable',ready:false,running:false,models:[],message:'A helyi MI nem indult el. A Prompt Studio kézi eszközei használhatók; az indítási napló a Hub data/logs mappájában található.'})).finally(()=>pending=null);return pending;}};
}
function checkPort(){return new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:11434});const finish=value=>{socket.destroy();resolve(value);};socket.setTimeout(700);socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));});}
