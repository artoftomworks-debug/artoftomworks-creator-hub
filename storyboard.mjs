// 0.16 DEV — Storyboard: jelenetkártyák tárolása (data/storyboards.json).
import {profileDataFile} from './profiles.mjs';import {readFile} from 'node:fs/promises';import path from 'node:path';import {atomicJSON} from './storage.mjs';
import {cleanBoard} from './storyboard-model.mjs';
const clip=(v,n)=>String(v??'').slice(0,n);
export function createStoryboards({root}){const file=profileDataFile(root,'storyboards.json');let lock=Promise.resolve();
  async function read(){try{const v=JSON.parse(await readFile(file,'utf8'));return Array.isArray(v.boards)?v.boards:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  const serial=fn=>{const run=lock.then(fn,fn);lock=run.catch(()=>{});return run;};
  return {list:async()=>({boards:(await read()).sort((a,b)=>b.updated-a.updated)}),
    save:data=>serial(async()=>{const b=cleanBoard(data?.board),all=(await read()).filter(x=>x.id!==b.id);all.unshift(b);await atomicJSON(file,{schema:'artoftomworks.creator-hub.storyboards',boards:all.slice(0,100)});return {board:b};}),
    remove:data=>serial(async()=>{const id=clip(data?.id,64),all=await read();await atomicJSON(file,{schema:'artoftomworks.creator-hub.storyboards',boards:all.filter(x=>x.id!==id)});return {removed:id};})};
}
