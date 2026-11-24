// 0.16 DEV — Önjavítás memóriahiánynál. Csak a valódi memóriahibát kezeli (ComfyUI „out of memory”),
// legfeljebb két lépésben, és mindent naplóz a feladatnál (job.heal):
//   1. a ComfyUI memóriájának felszabadítása (modellek kiürítése), majd újrapróbálás VÁLTOZATLAN beállítással;
//   2. ha a hiba a dekódolásnál volt (vagy a gráfban csempés dekódolás van): fele akkora csempék, újrapróbálás.
// A kép/videó tartalmát (prompt, méret, hossz, seed, lépésszám) soha nem változtatja.
// Kikapcsolva (mode 'off') a Hub pontosan a beállított értékekkel dolgozik, és a hibánál megáll.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {atomicJSON} from './storage.mjs';

export const MAX_HEAL=2;
export function healStep(job){
  const done=job?.heal?.length||0,info=job?.errorInfo;
  if(!info?.memory||done>=MAX_HEAL)return null;
  if(done===0)return {kind:'free',note:'Memóriahiány: a ComfyUI memóriája felszabadítva (modellek kiürítve), újrapróbálás változatlan beállítással.'};
  const tiled=Object.entries(job.prompt||{}).filter(([,n])=>n?.class_type==='VAEDecodeTiled'&&typeof n.inputs?.tile_size==='number');
  if(!tiled.length)return null;
  const changes=[];
  for(const [,n] of tiled){const i=n.inputs,from=i.tile_size,to=Math.max(256,Math.floor(from/2/32)*32);
    if(to<from){i.tile_size=to;if(typeof i.overlap==='number')i.overlap=Math.min(i.overlap,Math.floor(to/4));changes.push(from+'→'+to);}
    if(typeof i.temporal_size==='number'&&i.temporal_size>16){const t=Math.max(16,Math.floor(i.temporal_size/2/8)*8);if(typeof i.temporal_overlap==='number')i.temporal_overlap=Math.min(i.temporal_overlap,Math.floor(t/4));i.temporal_size=t;}}
  if(!changes.length)return null;
  return {kind:'tiles',note:'Memóriahiány ismét: dekódolás kisebb csempékkel ('+changes.join(', ')+' px), újrapróbálás. A kép tartalma nem változik, csak a dekódolás lassabb.'};
}

export function createSelfHeal({root,fetchImpl=fetch,log=()=>{}}){
  const file=path.join(root,'data','self-heal.json');let mode=null;const recent=[];
  async function load(){if(mode)return mode;try{const v=JSON.parse(await readFile(file,'utf8'));mode=v.mode==='off'?'off':'auto';}catch{mode='auto';}return mode;}
  async function status(){return {mode:await load(),recent:recent.slice(-5)};}
  async function configure({mode:next}={}){if(!['auto','off'].includes(next))throw Error('Érvénytelen önjavítási mód.');mode=next;await atomicJSON(file,{mode});return status();}
  async function onFailure(run,job){
    if(await load()==='off')return null;
    const step=healStep(job);if(!step)return null;
    if(step.kind==='free'){try{await fetchImpl(String(run.backend).replace(/\/+$/,'')+'/free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(8000)});}catch{}}
    const entry={kind:step.kind,note:step.note,error:String(job.error||'').slice(0,240),node:job.errorInfo?.nodeType||'',at:Date.now()};
    (job.heal||=[]).push(entry);recent.push({...entry,run:run.id,shot:job.shotId});if(recent.length>20)recent.shift();
    log(step.note);return {retry:true,note:step.note};
  }
  return {status,configure,onFailure};
}
