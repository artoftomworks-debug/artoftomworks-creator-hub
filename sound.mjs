// 0.16 DEV — 🔊 Hang a videókhoz: be-/kiúsztatás, hangerő, némítás, hangosság-kiegyenlítés, háttérzene
// (opcionálisan „duckinggal”: a zene halkul, amikor a videó saját hangja szól). A kép változatlanul másolódik (-c:v copy),
// az eredmény új bejegyzés az Előzményekben „<eredeti> · hang” néven; a forrásvideó érintetlen marad.
import {mkdir,unlink,writeFile,realpath} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {runVideoTool,parseVideoProbe} from './vendor/tools/prompt-studio/video-workshop-server.mjs';
import {outputFolder,localDateFolder} from './history.mjs';import {profileOutputSegment} from './profiles.mjs';
import {atomicJSON} from './storage.mjs';
import {findFfmpeg} from './storyboard-film.mjs';

const num=(v,lo,hi,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):d;};
export function cleanSound(o={}){return {fadeIn:num(o.fadeIn,0,10,0),fadeOut:num(o.fadeOut,0,10,0),volume:num(o.volume,0,300,100),mute:o.mute===true,loudnorm:o.loudnorm===true,musicVolume:num(o.musicVolume,0,200,50),duck:o.duck!==false};}
// Pure: az ffmpeg -filter_complex lánc. Bemenetek: 0 = videó, (ha nincs hangja) 1 = csend, utána (ha van) a zene.
export function soundGraph({hasAudio,length,music,...raw}){const o=cleanSound(raw),L=Math.max(0.1,Number(length)||5),f=n=>n.toFixed(3);
 const mi=hasAudio?1:2,src=hasAudio?'[0:a]':'[1:a]',parts=[];
 const fades=(fi,fo)=>[...(fi>0?[`afade=t=in:st=0:d=${f(Math.min(fi,L/2))}`]:[]),...(fo>0?[`afade=t=out:st=${f(Math.max(0,L-Math.min(fo,L/2)))}:d=${f(Math.min(fo,L/2))}`]:[])];
 const own=['aresample=48000',`volume=${o.mute?0:f(o.volume/100)}`,`atrim=0:${f(L)}`,'apad',`atrim=0:${f(L)}`,...fades(o.fadeIn,o.fadeOut)];
 if(!music){parts.push(`${src}${own.join(',')}${o.loudnorm&&!o.mute?',loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000':''}[aout]`);return {graph:parts.join(';'),musicInput:-1};}
 const mus=['aresample=48000',`volume=${f(o.musicVolume/100)}`,`atrim=0:${f(L)}`,...fades(Math.max(0.5,o.fadeIn),Math.max(1.5,o.fadeOut))];
 parts.push(`[${mi}:a]${mus.join(',')}[mus]`);
 if(o.duck&&!o.mute){parts.push(`${src}${own.join(',')},asplit=2[own][side]`,`[mus][side]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=450[duck]`,`[own][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`);}
 else parts.push(`${src}${own.join(',')}[own]`,`[own][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`);
 parts.push(`[mix]${o.loudnorm?'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000':'anull'}[aout]`);
 return {graph:parts.join(';'),musicInput:mi};}

const jobs=new Map();
export function createSound({root,history,engine}){
 function status(id){const j=jobs.get(String(id));if(!j)throw Error('Nincs ilyen hangszerkesztési feladat.');return {...j};}
 async function start({id,music,...opts}={}){
  for(const j of jobs.values())if(j.state==='running')throw Error('Már fut egy hangszerkesztés. Várd meg, amíg elkészül.');
  if(!/^[A-Za-z0-9_.:-]{1,200}$/.test(String(id||'')))throw Error('Érvénytelen videó.');
  let musicBytes=null;if(music){if(typeof music!=='string'||music.length>22*1024**2||!/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|flac);base64,[A-Za-z0-9+/]+=*$/.test(music))throw Error('A zene MP3, WAV, OGG, AAC/M4A vagy FLAC lehet, legfeljebb kb. 16 MiB.');musicBytes=Buffer.from(music.slice(music.indexOf(',')+1),'base64');}
  const o=cleanSound(opts);if(!musicBytes&&!o.mute&&!o.loudnorm&&!o.fadeIn&&!o.fadeOut&&o.volume===100)throw Error('Nincs mit változtatni: állíts be úsztatást, hangerőt, kiegyenlítést vagy zenét.');
  const job={id:randomUUID().replaceAll('-',''),state:'running',step:'Előkészítés…',started:Date.now(),error:'',result:null};jobs.set(job.id,job);
  void work(job,String(id),o,musicBytes).catch(e=>{job.state='failed';job.error=e.message;});return status(job.id);}
 async function work(job,id,o,musicBytes){
  const exe=await findFfmpeg({root,engine}),loc=await history.location(id);if(!loc.available)throw Error('A videó nem érhető el: '+(loc.message||''));
  const probe=async file=>parseVideoProbe(((r)=>r.err+r.out)(await runVideoTool(exe,['-hide_banner','-nostdin','-i',file],{timeout:30000,allowFailure:true})));
  const info=await probe(loc.path);if(!info.duration)throw Error('A videó hossza nem olvasható.');
  const tmp=path.join(os.tmpdir(),'creator-hub-sound-'+job.id);await mkdir(tmp,{recursive:true});let musicFile=null;
  try{if(musicBytes){musicFile=path.join(tmp,'music.bin');await writeFile(musicFile,musicBytes);}
   job.step='Hang feldolgozása';const g=soundGraph({hasAudio:!!info.audio,length:info.duration,music:!!musicFile,...o});
   const settings=await history.settings(),e=await engine.status(false),baseDir=settings.locations?.[loc.backend]||(e.config?.directory?path.join(e.config.directory,'output'):null);if(!baseDir)throw Error('Add meg a ComfyUI kimeneti mappáját az Előzmények beállításainál.');
   const base=await realpath(baseDir),folder=path.join(base,outputFolder(settings.outputFolder)+profileOutputSegment(),'Videos',localDateFolder());await mkdir(folder,{recursive:true});
   const stem=path.basename(loc.path,path.extname(loc.path)).slice(0,60),output=path.join(folder,stem+'_hang_'+job.id.slice(0,6)+'.mp4');
   const args=['-hide_banner','-nostdin','-y','-i',loc.path,...(info.audio?[]:['-f','lavfi','-t',String(info.duration),'-i','anullsrc=r=48000:cl=stereo']),...(musicFile?['-stream_loop','-1','-i',musicFile]:[]),'-filter_complex',g.graph,'-map','0:v:0','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',String(info.duration),'-movflags','+faststart',output];
   await runVideoTool(exe,args,{timeout:900000});const out=await probe(output);
   job.step='Mentés az Előzményekbe';const runId=randomUUID().replaceAll('-',''),subfolder=path.relative(base,path.dirname(output)).split(path.sep).join('/');
   const title=String(loc.project||'Videó').slice(0,140)+' · hang';
   await atomicJSON(path.join(root,'data','runs',runId+'.json'),{schema:'artoftomworks.scene-dna.run',version:1,id:runId,projectId:'creator-hub',title,backend:loc.backend,created:job.started,state:'complete',autoRun:false,error:'',jobs:[{mode:'video',shotId:'sound',number:1,state:'complete',width:out.width||info.width,height:out.height||info.height,seconds:out.duration||info.duration,fps:info.fps||24,finished:Date.now(),operation:'sound',parentIds:[id],prompt:loc.prompt||'',results:[{filename:path.basename(output),subfolder,type:'output'}]}]});
   job.state='complete';job.step='Kész';job.result={filename:path.basename(output),title,seconds:Math.round((out.duration||info.duration)*10)/10};
  }finally{if(musicFile)await unlink(musicFile).catch(()=>{});}
 }
 return {start,status};
}
