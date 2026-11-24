// 0.16 DEV — Hub önújraindítás és leállítás („⏻ Hub” gomb), csak ha semmi nem fut – vagy kérésre a futó munka után.
// Ugyanazokat a feltételeket nézi, mint a Restart-CreatorHub.ps1 (feladatsor, node-frissítés, ComfyUI-sor).
// Újraindításnál egy külön kis folyamat megvárja, amíg a port felszabadul, és ablak nélkül (naplóval: data/logs/hub.log) indítja a Hubot.
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const localBackend=b=>/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(b||'').replace(/\/+$/,''));
export async function hubBusyReason({generation,nodeUpdates,engine,fetchImpl=fetch}){
  const updates=await nodeUpdates?.status?.().catch(()=>null);
  if(updates?.active)return 'A node-csomagok frissítése még folyamatban van.';
  const queue=await generation.status();
  if(!queue||typeof queue!=='object')return 'A Hub feladatsora nem ellenőrizhető.';
  if(queue.armed||(queue.entries||[]).some(e=>['running','waiting-cancel'].includes(e.state)))return 'A Hub éppen generál vagy sorban álló munkája van.';
  const status=await engine?.status?.(false).catch(()=>null);const backend=String(status?.backend||'').replace(/\/+$/,'');
  if(backend&&localBackend(backend)){
    try{const r=await fetchImpl(backend+'/queue',{signal:AbortSignal.timeout(3000)});if(r.ok){const j=await r.json();if((j.queue_running||[]).length||(j.queue_pending||[]).length)return 'A ComfyUI még dolgozik vagy várakozó feladata van.';}}catch{}
  }
  return '';
}

// Separate tiny process: waits until the old Hub's port is free, then opens a new server window.
export const WAITER=`const port=process.env.HUB_PORT,node=process.env.HUB_NODE,dir=process.env.HUB_DIR,launcher=process.env.HUB_LAUNCHER;
const free=async()=>{try{await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(600)});return false;}catch{return true;}};
(async()=>{for(let i=0;i<120&&!(await free());i++)await new Promise(r=>setTimeout(r,250));await new Promise(r=>setTimeout(r,400));
const {spawnHidden}=await import(require('node:url').pathToFileURL(launcher).href);spawnHidden({node,dir});
setTimeout(()=>process.exit(0),500);})();`;

export function createHubRestart({generation,nodeUpdates,engine,fetchImpl=fetch,spawnImpl=spawn,serverFile,dir,nodeExe=process.execPath,exit=()=>process.exit(0),log=console.log,pollMS=3000}){
  let pending='',scheduled=null,timer=null,forceStop=false;
  const busy=()=>hubBusyReason({generation,nodeUpdates,engine,fetchImpl});
  // 0.16 DEV: újraindításkor a ComfyUI tovább fut (az új Hub visszaveszi, a modellek betöltve maradnak); csak a „Minden leállítása” állítja le.
  async function stopEngineIfOwned(force){try{const s=await engine?.status?.(false);if(s?.owned)await engine.stop({force});}catch{}}
  async function interruptComfy(){try{const s=await engine?.status?.(false);const b=String(s?.backend||'').replace(/\/+$/,'');if(b&&localBackend(b)){await fetchImpl(b+'/queue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clear:true}),signal:AbortSignal.timeout(3000)}).catch(()=>{});await fetchImpl(b+'/interrupt',{method:'POST',signal:AbortSignal.timeout(3000)}).catch(()=>{});}}catch{}}
  function go(kind,port){
    pending=kind;clearTimeout(timer);scheduled=null;
    setTimeout(async()=>{
      try{
        if(kind==='restart'){const w=spawnImpl(nodeExe,['-e',WAITER],{cwd:dir,detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,HUB_PORT:String(port),HUB_NODE:nodeExe,HUB_SERVER:serverFile,HUB_DIR:dir,HUB_LAUNCHER:path.join(dir||'.','hub-launch.mjs')}});w.on?.('error',()=>{});w.unref?.();}
        if(kind==='stop')await stopEngineIfOwned(forceStop);
        log?.(kind==='restart'?'A Hub újraindul…':'A Hub leállt (a ⏻ Hub gombbal).');
      }finally{exit();}
    },300);
  }
  async function restart({port,when='now'}={}){
    if(pending)return {restarting:true,already:true};
    if(!port)throw Error('A Hub portja nem ismert.');
    const reason=await busy();
    if(reason&&when==='after'){
      clearTimeout(timer);scheduled={kind:'restart',since:Date.now()};
      const tick=async()=>{if(!scheduled)return;let r='';try{r=await busy();}catch{r='?';}if(!r)go('restart',port);else timer=setTimeout(tick,pollMS);};
      timer=setTimeout(tick,pollMS);return {scheduled:true,reason};
    }
    if(reason)throw Object.assign(Error('Most nem indítom újra: '+reason),{code:'HUB_BUSY'});
    go('restart',port);return {restarting:true};
  }
  async function stop({force=false}={}){
    if(pending)return {stopping:true,already:true};
    const reason=await busy();
    if(reason&&!force)throw Object.assign(Error('Most nem állítom le: '+reason),{code:'HUB_BUSY'});
    if(reason&&force){try{const q=await generation.status();if(q?.current)await generation.stop?.({cancel:true}).catch(()=>{});}catch{}await interruptComfy();}
    forceStop=!!(reason&&force);go('stop');return {stopping:true,forced:forceStop};
  }
  function cancel(){const had=!!scheduled;clearTimeout(timer);scheduled=null;return {cancelled:had};}
  async function status(){return {busy:await busy().catch(e=>String(e?.message||e)),scheduled,pending};}
  return {restart,stop,cancel,status,busy};
}

// Windows: the Hub itself starts its tray icon (single instance per Hub folder; Hub-Tray.ps1 holds a mutex).
// Output and errors go to data/logs/tray.log.
export function startTray({dir,port,platform=process.platform,spawnImpl=spawn}={}){
  if(platform!=='win32')return false;
  const script=path.join(dir,'Hub-Tray.ps1');if(!fs.existsSync(script))return false;
  const logDir=path.join(dir,'data','logs'),log=path.join(logDir,'tray.log');fs.mkdirSync(logDir,{recursive:true});
  const note=t=>{try{fs.appendFileSync(log,`[${new Date().toLocaleString('hu-HU')}] Hub: ${t}\r\n`);}catch{}};
  note(`tálcaikon indítása (port ${port})`);
  // Not detached: the icon lives exactly as long as this Hub process (a restarted Hub starts a new one).
  // PowerShell's own console output (e.g. a parse error) goes to a separate file: tray.log is written by the script itself.
  const fd=fs.openSync(path.join(logDir,'tray.out.log'),'w');
  try{const p=spawnImpl('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-STA','-WindowStyle','Hidden','-File',script,'-Port',String(port),'-Root',dir],{cwd:dir,detached:false,stdio:['ignore',fd,fd],windowsHide:true});p.on?.('error',e=>note('a PowerShell nem indult: '+e.message));p.on?.('exit',(c,sig)=>note('a tálcaikon folyamata kilépett (kód: '+c+(sig?', jel: '+sig:'')+')'));p.unref?.();return true;}
  catch(e){note('a PowerShell nem indult: '+e.message);return false;}finally{fs.closeSync(fd);}
}
