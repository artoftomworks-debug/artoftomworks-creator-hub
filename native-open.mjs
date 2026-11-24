import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Ask the Windows shell directly, then require an observable folder/selection.
// Starting explorer.exe alone can report success without opening a window.
export async function openInExplorer(target,{directory=false,platform=process.platform,spawnImpl=spawn}={}){
 if(platform!=='win32')throw Error('Ezen a rendszeren az útvonal másolását használd.');
 if(typeof target!=='string'||!path.win32.isAbsolute(target)||/["\0\r\n]/.test(target))throw Error('Érvénytelen fájlmegnyitási útvonal.');
 const args=['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./native-open.ps1',import.meta.url)),'-TargetBase64',Buffer.from(target,'utf8').toString('base64'),...(directory?['-Directory']:[])];
 const child=spawnImpl('powershell.exe',args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
 return await new Promise((resolve,reject)=>{let stdout='',stderr='',settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};const timer=setTimeout(()=>{child.kill();finish(Error('Az Explorer megnyitása nem fejeződött be. A mentési útvonalat a Másolás gombbal is elérheted.'));},20000);child.stdout.on('data',c=>{stdout=(stdout+c.toString()).slice(-12000);});child.stderr.on('data',c=>{stderr=(stderr+c.toString()).slice(-4000);});child.once('error',e=>finish(e));child.once('close',code=>{let result;try{result=JSON.parse(stdout.trim().replace(/^\uFEFF/,''));}catch{}if(code===0&&result?.visible===true&&result?.opened===true)finish(null,result);else finish(Error(result?.error||stderr.trim()||'Az Explorer nem igazolta vissza az ablak megnyitását.'));});});
}

// 0.16 DEV: Windows "Save as" dialog (native-save.ps1). Resolves to the chosen absolute path, or null if cancelled.
export async function chooseSavePath(name,{folder='',platform=process.platform,spawnImpl=spawn,timeoutMS=10*60*1000}={}){
 if(platform!=='win32')throw Error('A „Máshova…” mentés Windows-on érhető el. Válaszd a Hub vagy a ComfyUI mappát.');
 if(typeof name!=='string'||!name||/[\0\r\n]/.test(name)||(folder&&/[\0\r\n]/.test(folder)))throw Error('Érvénytelen fájlnév.');
 const args=['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./native-save.ps1',import.meta.url)),'-NameBase64',Buffer.from(name,'utf8').toString('base64'),...(folder?['-FolderBase64',Buffer.from(folder,'utf8').toString('base64')]:[])];
 /* windowsHide: no console window (Windows Terminal would show an empty black one); the dialog itself is a normal GUI window */const child=spawnImpl('powershell.exe',args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
 return await new Promise((resolve,reject)=>{let stdout='',stderr='',done=false;const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve(v);};
  const timer=setTimeout(()=>{child.kill();finish(Error('A mentési ablak nem kapott választ.'));},timeoutMS);
  child.stdout.on('data',c=>{stdout=(stdout+c.toString()).slice(-12000);});child.stderr.on('data',c=>{stderr=(stderr+c.toString()).slice(-4000);});child.once('error',e=>finish(e));
  child.once('close',()=>{let r;try{r=JSON.parse(stdout.trim().replace(/^﻿/,''));}catch{}if(r?.chosen&&typeof r.path==='string'&&path.win32.isAbsolute(r.path))finish(null,r.path);else if(r&&!r.error)finish(null,null);else finish(Error(r?.error||stderr.trim()||'A mentési ablak nem nyitható meg.'));});});
}
