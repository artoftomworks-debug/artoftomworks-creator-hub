// 0.16 DEV — 💡 Ötlettár: gyorsan felírt ötletek (szöveg, opcionálisan kép) – data/ideas.json.
import {profileDataFile} from './profiles.mjs';import {readFile} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {atomicJSON} from './storage.mjs';
const SCHEMA='artoftomworks.creator-hub.ideas',TAGS=['kép','videó','storyboard'],locks=new Map();
const clip=(v,n)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').trim().slice(0,n);
export function cleanIdea(x){const text=clip(x?.text,2000),image=String(x?.image||'');const hasImage=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)&&image.length<=600*1024;
 if(!text&&!hasImage)throw Error('Írj le egy ötletet, vagy adj hozzá képet.');
 return {id:/^[a-f0-9-]{36}$/.test(String(x?.id||''))?String(x.id):randomUUID(),text,image:hasImage?image:'',ref:/^[a-f0-9]{32}$/.test(String(x?.ref||''))?String(x.ref):'',tags:[...new Set((Array.isArray(x?.tags)?x.tags:[]).map(String).filter(t=>TAGS.includes(t)))],done:x?.done===true,created:Number.isFinite(Number(x?.created))&&Number(x.created)>0?Number(x.created):Date.now(),updated:Date.now()};}
export function createIdeas({root}){const file=profileDataFile(root,'ideas.json');
 async function read(){try{const v=JSON.parse(await readFile(file,'utf8'));return Array.isArray(v.ideas)?v.ideas:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 const serial=fn=>{const prev=locks.get(file)||Promise.resolve();const run=prev.then(fn,fn);locks.set(file,run.catch(()=>{}));return run;};
 return {list:async()=>({ideas:(await read()).sort((a,b)=>Number(a.done)-Number(b.done)||b.created-a.created)}),
  save:data=>serial(async()=>{const i=cleanIdea(data?.idea),all=(await read()).filter(x=>x.id!==i.id);all.push(i);if(all.length>500)throw Error('Legfeljebb 500 ötlet tárolható. Töröld a régi, kész ötleteket.');await atomicJSON(file,{schema:SCHEMA,ideas:all});return {idea:i};}),
  remove:data=>serial(async()=>{const id=String(data?.id||''),all=await read();await atomicJSON(file,{schema:SCHEMA,ideas:all.filter(x=>x.id!==id)});return {removed:id};})};
}
