// 0.16 DEV — A Hub indítása ablak nélkül. A szerver kimenete a data/logs/hub.log naplóba megy.
// Közvetlen futtatás (a Start-CreatorHub.ps1 hívja): elindítja a szervert rejtve, megvárja, amíg kiírja a címét,
// majd „PORT=…” sorral kilép (0). Ha a szerver elszáll, a napló végét kiírja, és 1-es kóddal lép ki.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const logFile=dir=>path.join(dir,'data','logs','hub.log');

export function openLog(dir,now=new Date()){
  const file=logFile(dir);fs.mkdirSync(path.dirname(file),{recursive:true});
  try{if(fs.statSync(file).size>5*1024**2)fs.renameSync(file,path.join(path.dirname(file),'hub.prev.log'));}catch{}
  let start=0;try{start=fs.statSync(file).size;}catch{}
  const fd=fs.openSync(file,'a');fs.writeSync(fd,`\n==== Creator Hub indítása · ${now.toLocaleString('hu-HU')} ====\n`);
  return {file,fd,start};
}

export function spawnHidden({node=process.execPath,dir=HERE,args=[],spawnImpl=spawn}={}){
  const {file,fd,start}=openLog(dir);
  try{
    const child=spawnImpl(node,[path.join(dir,'server.mjs'),...args],{cwd:dir,detached:true,stdio:['ignore',fd,fd],windowsHide:true});
    child.unref?.();return {child,file,start};
  }finally{fs.closeSync(fd);}
}

export function readSince(file,start){try{const b=fs.readFileSync(file);return b.subarray(Math.min(start,b.length)).toString('utf8');}catch{return '';}}
const tail=(text,n=30)=>text.trim().split(/\r?\n/).slice(-n).join('\n');

export async function launch({dir=HERE,args=[],timeoutMS=90000,node=process.execPath,out=console.log}={}){
  const {child,file,start}=spawnHidden({node,dir,args});let exited=null;child.on?.('exit',c=>{exited=c??0;});child.on?.('error',e=>{exited=e.message;});
  const t0=Date.now();
  while(Date.now()-t0<timeoutMS){
    await new Promise(r=>setTimeout(r,250));
    const text=readSince(file,start),m=text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if(m){out(text.includes('Már fut.')?'A Hub már futott – megnyitom.':'A Hub elindult a háttérben (ablak nélkül).');out('Napló: '+file);out('PORT='+m[1]);return 0;}
    if(exited!==null){out('A Hub nem indult el. A napló vége:\n'+tail(text));return 1;}
  }
  out('A Hub nem jelzett vissza '+Math.round(timeoutMS/1000)+' másodpercen belül. A napló vége:\n'+tail(readSince(file,start)));return 1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  process.exitCode=await launch({args:process.argv.slice(2)});
}
