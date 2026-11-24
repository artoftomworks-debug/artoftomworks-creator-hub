// 0.16 DEV — Karakterkönyv: mentett szereplők (név, arckép, erősség, rövid leírás) – data/characters.json.
import {profileDataFile} from './profiles.mjs';import {readFile} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {atomicJSON} from './storage.mjs';
const SCHEMA='artoftomworks.creator-hub.characters',locks=new Map();
const clip=(v,n)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
export function cleanCharacter(c){const name=clip(c?.name,60);if(!name)throw Error('Adj nevet a karakternek.');
 const image=String(c?.image||'');if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>3*1024**2)throw Error('A karakter arcképe PNG, JPEG vagy WebP lehet, legfeljebb kb. 2 MiB.');
 const id=/^[a-f0-9-]{36}$/.test(String(c?.id||''))?String(c.id):randomUUID();const weight=Math.min(1.3,Math.max(0.5,Number(c?.weight)||0.9));
 return {id,name,image,weight:Math.round(weight*100)/100,note:clip(c?.note,240),updated:Date.now()};}
export function createCharacters({root}){const file=profileDataFile(root,'characters.json');
 async function read(){try{const v=JSON.parse(await readFile(file,'utf8'));return Array.isArray(v.characters)?v.characters:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 const serial=fn=>{const prev=locks.get(file)||Promise.resolve();const run=prev.then(fn,fn);locks.set(file,run.catch(()=>{}));return run;};
 return {
  list:async({full=false}={})=>({characters:(await read()).sort((a,b)=>a.name.localeCompare(b.name,'hu')).map(c=>full?c:{id:c.id,name:c.name,weight:c.weight,note:c.note,updated:c.updated})}),
  get:async id=>{const c=(await read()).find(x=>x.id===String(id));if(!c)throw Error('Nincs ilyen karakter.');return {character:c};},
  save:data=>serial(async()=>{const c=cleanCharacter(data?.character),all=(await read()).filter(x=>x.id!==c.id&&x.name.toLowerCase()!==c.name.toLowerCase());all.push(c);if(all.length>60)throw Error('Legfeljebb 60 karakter menthető.');await atomicJSON(file,{schema:SCHEMA,characters:all});return {character:{id:c.id,name:c.name}};}),
  remove:data=>serial(async()=>{const id=String(data?.id||''),all=await read();await atomicJSON(file,{schema:SCHEMA,characters:all.filter(x=>x.id!==id)});return {removed:id};})};
}
