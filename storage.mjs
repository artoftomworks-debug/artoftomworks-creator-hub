import {writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const writes=new Map();let writeHook=null;
/* 0.16 DEV: profilok – írás előtti jelölés (pl. új futásfájl gazdája) */
export function setWriteHook(fn){writeHook=typeof fn==='function'?fn:null;}
// Windows indexers/readers can briefly prevent replacement. Keep the old file
// intact until the complete replacement succeeds; never fall back to truncation.
export function atomicJSON(file,value,{renameFile=rename,delays=[30,60,120,240,480,800]}={}){
 try{writeHook?.(file,value);}catch{}
 const snapshot=JSON.stringify(value),previous=writes.get(file)||Promise.resolve();
 const work=previous.catch(()=>{}).then(async()=>{
  await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
  try{for(let attempt=0;;attempt++)try{await writeFile(temp,snapshot,'utf8');break;}catch(e){if(!['EPERM','EACCES','EBUSY','UNKNOWN'].includes(e.code)||attempt>=delays.length)throw e;await delay(delays[attempt]);}for(let attempt=0;;attempt++)try{await renameFile(temp,file);break;}catch(e){if(!['EPERM','EACCES','EBUSY','UNKNOWN'].includes(e.code)||attempt>=delays.length)throw e;await delay(delays[attempt]);}}
  finally{await unlink(temp).catch(()=>{});}
 });writes.set(file,work);void work.finally(()=>{if(writes.get(file)===work)writes.delete(file);}).catch(()=>{});return work;
}
