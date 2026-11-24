import {readFile,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {atomicJSON} from './storage.mjs';
const providers=['civitai','hf','github'];
const failure=()=>Error('A Windows nem tudta megvédeni vagy feloldani a kulcsot. Ugyanazzal a Windows-fiókkal indítsd a Hubot, vagy add meg újra a kulcsot.');

export async function windowsProtect(action,value,{spawnImpl=spawn}={}){
 if(!['encrypt','decrypt'].includes(action)||typeof value!=='string'||value.length>20000)throw failure();
 const child=spawnImpl('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./model-credentials.ps1',import.meta.url))],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
 return new Promise((resolve,reject)=>{let output='',settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};const timer=setTimeout(()=>{child.kill();finish(failure());},10000);
  child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>30000){child.kill();finish(failure());}});child.stderr.on('data',()=>{});child.stdin.on('error',()=>finish(failure()));
  child.once('error',()=>finish(failure()));child.once('close',code=>{let data;try{data=JSON.parse(output.trim().replace(/^\uFEFF/,''));}catch{}if(code!==0||typeof data?.value!=='string'||!data.value||data.value.length>20000)finish(failure());else finish(null,data.value);});
  // Credentials never appear in process arguments or an environment variable.
  child.stdin.end(JSON.stringify({action,value}));
 });
}

export function createModelCredentials({root,platform=process.platform,protect=windowsProtect}={}){
 const file=path.join(root,'data','model-credentials.dpapi.json'),tokens=new Map(),remembered=new Set(),issues=new Map();let encrypted={},initializing,serial=Promise.resolve(),storeError=false;
 async function init(){if(!initializing)initializing=(async()=>{
  try{if((await stat(file)).size>100000)throw Error();const data=JSON.parse(await readFile(file,'utf8'));if(data.schema!=='creator-hub.model-credentials.dpapi'||!data.providers||typeof data.providers!=='object')throw Error();encrypted=data.providers;
   for(const provider of providers)if(encrypted[provider]){remembered.add(provider);try{if(platform!=='win32')throw Error();const payload=JSON.parse(await protect('decrypt',encrypted[provider])),token=payload.token;if(payload.provider!==provider||typeof token!=='string'||!token.trim()||token.length>2000||/[\r\n\0]/.test(token))throw Error();tokens.set(provider,token);}catch{issues.set(provider,'unlock_failed');}}
  }catch(e){if(e.code!=='ENOENT')storeError=true;}
 })();await initializing;}
 const persist=values=>atomicJSON(file,{schema:'creator-hub.model-credentials.dpapi',version:1,providers:values});
 async function set({provider,token,remember=false}={}){
  if(!providers.includes(provider)||typeof token!=='string'||token.length>2000||/[\r\n\0]/.test(token)||typeof remember!=='boolean')throw Error('Érvénytelen forráskulcs.');token=token.trim();
  const next=serial.catch(()=>{}).then(async()=>{await init();if(storeError)throw Error('A mentett kulcstár nem olvasható. A meglévő fájlt érintetlenül hagytuk.');if(remember&&platform!=='win32')throw Error('Tartós kulcsmentés ezen a rendszeren nem érhető el. A munkameneti használat választható.');
   const values={...encrypted};if(remember&&token){const payload=JSON.stringify({provider,token});values[provider]=await protect('encrypt',payload);if(typeof values[provider]!=='string'||!values[provider]||values[provider]===payload||values[provider]===token)throw failure();}else delete values[provider];
   if(remember||encrypted[provider])await persist(values);
   encrypted=values;if(token)tokens.set(provider,token);else tokens.delete(provider);if(values[provider])remembered.add(provider);else remembered.delete(provider);issues.delete(provider);
   return {saved:!!token,temporary:!remember,remembered:remember&&!!token,removed:!token};
  });serial=next;return next;
 }
 return {ready:init,get:provider=>tokens.get(provider),set,async status(){await init();return {canRemember:platform==='win32',storeError,providers:Object.fromEntries(providers.map(p=>[p,{configured:tokens.has(p),remembered:remembered.has(p),error:issues.get(p)||null}]))};},clear(){tokens.clear();}};
}
