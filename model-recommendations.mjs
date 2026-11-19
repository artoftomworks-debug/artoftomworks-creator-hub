import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {atomicJSON} from './storage.mjs';

const numeric={steps:[1,1000],cfg:[0,100],denoise:[.01,1],guidance:[0,100]};
const aliases={steps:['steps','Steps','num_inference_steps'],cfg:['cfg','CFG','cfgScale','CFGScale'],sampler:['sampler','Sampler','sampler_name'],scheduler:['scheduler','Scheduler','Schedule type'],denoise:['denoise','Denoise','Denoising strength'],guidance:['guidance','Guidance']};
const CACHE_VERSION=2;
const samplerAliases={'euler a':'euler_ancestral','euler ancestral':'euler_ancestral','dpm++ 2m':'dpmpp_2m','dpm++ 2m sde':'dpmpp_2m_sde','er sde':'er_sde'};
export function recommendationValues(raw={}){
 const values={};for(const[key,names]of Object.entries(aliases)){const name=names.find(n=>raw[n]!==undefined&&raw[n]!==null);if(!name)continue;const v=raw[name];if(numeric[key]){const n=Number(v),[min,max]=numeric[key];if((typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(n)&&n>=min&&n<=max&&(key!=='steps'||Number.isInteger(n)))values[key]=n;}else if(typeof v==='string'&&v.length<=80){const n=v.trim().toLowerCase();if(!n)continue;values[key]=key==='sampler'?(samplerAliases[n]||n.replace(/[ -]+/g,'_')):n.replace(/[ -]+/g,'_');}}
 return values;
}
// Only labelled settings in this exact version's notes, never the general
// model description (which can cover unrelated architectures or refiners).
export function versionRecommendations(description=''){
 const text=String(description).slice(0,100000).replace(/<\s*(?:br\s*\/?|\/p|\/div|\/li|\/h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(Math.min(0x10ffff,parseInt(hex||dec,hex?16:10))));
 const raw={},range=/^\s*Steps\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/im.exec(text);
 if(range){const lo=Number(range[1]),hi=Number(range[2]||range[1]);if(lo>=1&&hi>=lo&&hi<=1000)raw.steps=lo;}
 for(const[key,label]of [['cfg','CFG'],['guidance','(?:Flux\\s+)?Guidance'],['denoise','Denoise']]){const match=new RegExp('^\\s*'+label+'\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*$','im').exec(text);if(match)raw[key]=match[1];}
 const pairLine=/^\s*Sampler\s*\/\s*Scheduler\s*:\s*([^\n]+)$/im.exec(text),alternatives=[];
 if(pairLine)for(const part of pairLine[1].split(/\s+or\s+|\s*;\s*/i)){const match=/^\s*([\w+ .-]+)\s*\/\s*([\w .-]+)\s*$/.exec(part);if(match){const pair=recommendationValues({sampler:match[1],scheduler:match[2]});if(pair.sampler&&pair.scheduler)alternatives.push(pair);}}
 if(alternatives.length)Object.assign(raw,alternatives[0]);
 return {values:recommendationValues(raw),...(alternatives.length?{alternatives}:{})};
}
export function exampleRecommendations(version,sha){
 const examples=(version.images||[]).slice(0,24).map(v=>v.meta).filter(v=>v&&typeof v==='object').filter(v=>{const h=String(v['Model hash']||v.hashes?.model||'').toLowerCase();return !h||/^[a-f0-9]{8,64}$/.test(h)&&sha.startsWith(h);}).map(recommendationValues).filter(v=>v.denoise===undefined||v.denoise===1);
 const values={},counts={};for(const key of Object.keys(aliases)){const rows=examples.map(e=>e[key]).filter(v=>v!==undefined);if(rows.length<3)continue;const groups=new Map();for(const v of rows)groups.set(v,(groups.get(v)||0)+1);const sorted=[...groups].sort((a,b)=>b[1]-a[1]);if(sorted[0][1]>=3&&sorted[0][1]/rows.length>=.75&&(!sorted[1]||sorted[0][1]>sorted[1][1])){values[key]=sorted[0][0];counts[key]=sorted[0][1];}}
 return {values,examples:examples.length,counts};
}
export function usableRecommendation(profile,inventory){
 const values={...profile?.values},skipped=[];
 if(profile?.alternatives?.length){const pair=profile.alternatives.find(p=>inventory.samplers?.includes(p.sampler)&&inventory.schedulers?.includes(p.scheduler));if(pair)Object.assign(values,pair);else{delete values.sampler;delete values.scheduler;skipped.push('A javasolt sampler/scheduler páros nem érhető el a motorban.');}}
 for(const[key,list]of [['sampler',inventory.samplers],['scheduler',inventory.schedulers]])if(values[key]!==undefined&&!list?.includes(values[key])){skipped.push(key+': '+values[key]+' nem érhető el a motorban');delete values[key];}return {values,skipped};
}
export function createModelRecommendations({root,fetchImpl=fetch}={}){
 const file=path.join(root,'data','model-recommendations.json'),pending=new Map();let db,initializing,writing=Promise.resolve();
 async function init(){if(!initializing)initializing=(async()=>{try{db=JSON.parse(await readFile(file,'utf8'));if(db.schema!=='artoftomworks.model-recommendations')throw Error('Érvénytelen modelladatlap-gyorsítótár.');}catch(e){if(e.code!=='ENOENT')throw e;db={schema:'artoftomworks.model-recommendations',items:{}};}})();await initializing;}
 const persist=()=>{const next=writing.catch(()=>{}).then(()=>atomicJSON(file,db));writing=next;return next;};
 async function sidecar(asset){const parent=await realpath(path.dirname(path.resolve(asset.path))).catch(()=>null);if(!parent)return null;const stem=asset.path.slice(0,-path.extname(asset.path).length);for(const name of [stem+'.cm-info.json',stem+'.civitai.info',asset.path+'.civitai.info'])try{const actual=await realpath(name);if(path.dirname(actual)!==parent||(await stat(actual)).size>1024**2)continue;const d=JSON.parse(await readFile(actual,'utf8'));const id=Number(d.VersionId??d.modelVersionId??d.id);if(asset.source?.versionId&&id!==asset.source.versionId)continue;const v=recommendationValues(d.InferenceDefaults||d.inferenceDefaults||d.recommendedSettings);if(Object.keys(v).length)return {state:'ready',kind:'defaults',label:'A modell mentett alapbeállításai',values:v,checked:Date.now(),url:asset.source?.url||null};const notes=versionRecommendations(d.VersionDescription??d.description);if(Number.isSafeInteger(id)&&id>0&&Object.keys(notes.values).length)return {state:'ready',kind:'description',label:'A modell konkrét verziójának leírása',...notes,checked:Date.now(),url:asset.source?.url||null};}catch{}return null;}
 async function fetchProfile(asset,refresh){
  const local=await sidecar(asset);if(local)return local;const source=asset.source;
  if(source?.provider!=='civitai'||!Number.isSafeInteger(source.versionId)||!Number.isSafeInteger(source.modelId)||!/^[a-f0-9]{64}$/i.test(source.sha256||''))return {state:'unavailable',message:'Ehhez a fájlhoz nincs egyértelmű verzió- és fájlazonosítóval ellátott adatlap. A saját beállítások maradnak.'};
  await init();const key=source.versionId+':'+source.sha256.toLowerCase(),cached=db.items[key],old=cached?.cacheVersion===CACHE_VERSION?cached:null;if(!refresh&&old&&Date.now()-old.checked<7*86400000)return {...old,cached:true};
  try{
   const response=await fetchImpl('https://civitai.com/api/v1/model-versions/'+source.versionId,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('Az adatlap nem elérhető.');const text=await response.text();if(text.length>3*1024**2)throw Error('Túl nagy adatlap.');const d=JSON.parse(text);
   if(d.id!==source.versionId||d.modelId!==source.modelId||!d.files?.some(f=>String(f.hashes?.SHA256||'').toLowerCase()===source.sha256.toLowerCase()))return {state:'unavailable',message:'Az adatlap fájlazonosítója nem egyezik. Másik verzió beállításait nem alkalmazom.',url:source.url};
   let values=recommendationValues(d.inferenceDefaults||d.recommendedSettings),kind='defaults',label='A modell adatlapjának alapbeállításai',examples=0;
   let notes;if(!Object.keys(values).length){notes=versionRecommendations(d.description);if(Object.keys(notes.values).length){values=notes.values;kind='description';label='A modell konkrét verziójának leírása';}}
   if(!Object.keys(values).length){const result=exampleRecommendations(d,source.sha256.toLowerCase());values=result.values;examples=result.examples;kind='examples';label='Az adatlap példaképeinek beállításai';}
   const profile={state:Object.keys(values).length?'ready':'unavailable',cacheVersion:CACHE_VERSION,kind,label,values,...(notes?.alternatives?{alternatives:notes.alternatives}:{}),examples,checked:Date.now(),url:source.url,modelId:source.modelId,versionId:source.versionId,sha256:source.sha256,message:Object.keys(values).length?'':'Az adatlapon nincs egyértelmű, egyező beállítás. A saját értékek maradnak.'};db.items[key]=profile;
   const keys=Object.keys(db.items).sort((a,b)=>db.items[b].checked-db.items[a].checked);for(const k of keys.slice(500))delete db.items[k];await persist();return profile;
  }catch{if(old)return {...old,cached:true,stale:true,message:'A korábban ellenőrzött, ehhez a fájlhoz tartozó adatlapot használom; most nincs kapcsolat.'};return {state:'unavailable',message:'Az adatlap most nem olvasható. A beállításaid megmaradnak; később újra frissítheted.',url:source.url};}
 }
 return {async forAsset(asset,{refresh=false}={}){const key=asset.id+':'+!!refresh;if(pending.has(key))return pending.get(key);const p=fetchProfile(asset,refresh).finally(()=>pending.delete(key));pending.set(key,p);return p;}};
}
