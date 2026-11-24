// 0.16 DEV — Storyboardból kisfilm: a jelenetek videóit sorrendben, áttűnéssel (és ha kéred, zenével) egy MP4-be fűzi.
// Az eredmény az Előzményekbe kerül „Storyboard · <név> · kisfilm” néven; a forrásvideók érintetlenek maradnak.
import {mkdir,readFile,readdir,stat,unlink,writeFile,realpath} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {runVideoTool,parseVideoProbe} from './vendor/tools/prompt-studio/video-workshop-server.mjs';
import {outputFolder,localDateFolder} from './history.mjs';import {profileOutputSegment} from './profiles.mjs';
import {atomicJSON} from './storage.mjs';
import {videoIndexOf} from './storyboard-model.mjs';

// Pure: jelenetenként melyik videó kerüljön a filmbe (a kiválasztott, különben a legfrissebb).
export function filmPlan(board,videos){const per=new Map();for(const v of videos){const i=videoIndexOf(v.project,board);if(i<0||v.mode!=='video'||v.trashed||v.incomplete)continue;(per.get(i)||per.set(i,[]).get(i)).push(v);}
 const clips=[],missing=[];board.shots.forEach((s,i)=>{const list=(per.get(i)||[]).sort((a,b)=>(b.created||0)-(a.created||0));const v=list.find(x=>x.id===s.video)||list[0];if(v)clips.push({index:i,id:v.id});else missing.push(i);});return {clips,missing};}
// Pure: xfade + acrossfade lánc. durations: a normalizált klipek hossza másodpercben.
export function xfadeGraph(durations,fade){if(durations.length<2)return null;const parts=[];let v='[0:v]',a='[0:a]',offset=0;
 for(let i=1;i<durations.length;i++){offset+=durations[i-1]-fade;const vo=i===durations.length-1?'[vout]':`[v${i}]`,ao=i===durations.length-1?'[aout]':`[a${i}]`;parts.push(`${v}[${i}:v]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}${vo}`,`${a}[${i}:a]acrossfade=d=${fade.toFixed(3)}${ao}`);v=vo;a=ao;}
 return {graph:parts.join(';'),length:durations.reduce((s,d)=>s+d,0)-fade*(durations.length-1)};}
export function fadeFor(durations){const m=Math.min(...durations);return Math.max(0.1,Math.min(0.6,m/3));}

export async function findFfmpeg({root,engine}){const cands=[];try{const saved=JSON.parse(await readFile(path.join(root,'data','VideoStudio','engine.json'),'utf8'));if(path.isAbsolute(saved.ffmpeg||''))cands.push(saved.ffmpeg);}catch{}
  cands.push(path.join(root,'data','VideoStudio','tools','ffmpeg.exe'));for(const f of (process.env.PATH||'').split(process.platform==='win32'?';':':'))if(f)cands.push(path.join(f,process.platform==='win32'?'ffmpeg.exe':'ffmpeg'));
  try{const e=await engine.status(false),dir=e?.config?.directory;if(dir)for(const env of ['venv','.venv','python_embeded']){const bin=path.join(dir,env,'Lib','site-packages','imageio_ffmpeg','binaries');try{for(const n of await readdir(bin))if(/^ffmpeg.*\.exe$/i.test(n))cands.push(path.join(bin,n));}catch{}}}catch{}
  for(const c of [...new Set(cands)])try{if(!(await stat(c)).isFile())continue;const r=await runVideoTool(c,['-hide_banner','-encoders'],{timeout:8000});if(/\blibx264\b/.test(r.out)&&/\baac\b/.test(r.out))return c;}catch{}
  throw Error('A kisfilmhez FFmpeg kell (libx264 + AAC). A Videó műhelyben megadhatod az elérési útját, vagy a ComfyUI imageio_ffmpeg csomagja is jó.');}

const jobs=new Map();
export function createStoryboardFilm({root,history,engine,storyboards}){
 const ffmpegPath=()=>findFfmpeg({root,engine});
 async function probe(exe,file){const r=await runVideoTool(exe,['-hide_banner','-nostdin','-i',file],{timeout:30000,allowFailure:true});return parseVideoProbe(r.err+r.out);}
 function status(id){const j=jobs.get(String(id));if(!j)throw Error('Nincs ilyen kisfilm-feladat.');const {child,...v}=j;return v;}
 async function start({id,music,fade:userFade}={}){
  for(const j of jobs.values())if(j.state==='running')throw Error('Már készül egy kisfilm. Várd meg, amíg elkészül.');
  const board=(await storyboards.list()).boards.find(b=>b.id===String(id));if(!board)throw Error('Nincs ilyen storyboard.');
  const all=[];let page=1,pages=1;do{const r=await history.list({page:String(page),q:'Storyboard · '+board.name,mode:'video'});pages=r.pages||1;all.push(...(r.items||[]));page++;}while(page<=pages&&page<=10);
  const plan=filmPlan(board,all);if(plan.clips.length<1)throw Error('Ehhez a storyboardhoz még nincs kész jelenetvideó. A jelenetkártyán a „🎬 Videó ebből” gombbal készíthetsz.');
  let musicBytes=null;if(music){if(typeof music!=='string'||music.length>22*1024**2||!/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|flac);base64,[A-Za-z0-9+/]+=*$/.test(music))throw Error('A zene MP3, WAV, OGG, AAC/M4A vagy FLAC lehet, legfeljebb kb. 16 MiB.');musicBytes=Buffer.from(music.slice(music.indexOf(',')+1),'base64');}
  const job={id:randomUUID().replaceAll('-',''),board:board.name,state:'running',step:'Előkészítés…',done:0,total:plan.clips.length,missing:plan.missing.map(i=>i+1),started:Date.now(),error:'',result:null};jobs.set(job.id,job);
  void work(job,board,plan,musicBytes,Number(userFade)).catch(e=>{job.state='failed';job.error=e.message;});return status(job.id);}
 async function work(job,board,plan,musicBytes,userFade){
  const exe=await ffmpegPath(),tmp=path.join(os.tmpdir(),'creator-hub-film-'+job.id);await mkdir(tmp,{recursive:true});const temps=[];
  try{
   const sources=[];for(const c of plan.clips){const loc=await history.location(c.id);if(!loc.available)throw Error((c.index+1)+'. jelenet videója nem érhető el: '+(loc.message||''));sources.push({...c,path:loc.path,backend:loc.backend});}
   const first=await probe(exe,sources[0].path),W=first.width-(first.width%2),H=first.height-(first.height%2),FPS=first.fps>0&&first.fps<=60?first.fps:24;
   const durations=[];
   for(const [i,s] of sources.entries()){job.step='Jelenetek egységesítése';job.done=i;const info=await probe(exe,s.path),out=path.join(tmp,'clip'+i+'.mp4');temps.push(out);
    const vf=`scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p`;
    const args=['-hide_banner','-nostdin','-y','-i',s.path,...(info.audio?[]:['-f','lavfi','-t',String(info.duration||5),'-i','anullsrc=r=48000:cl=stereo']),'-vf',vf,...(info.audio?['-af','aresample=48000']:[]),'-map','0:v:0','-map',info.audio?'0:a:0':'1:a:0','-c:v','libx264','-preset','veryfast','-crf','18','-c:a','aac','-ar','48000','-ac','2','-shortest',out];
    await runVideoTool(exe,args,{timeout:600000});durations.push((await probe(exe,out)).duration);}
   job.done=sources.length;job.step='Összefűzés áttűnéssel';
   const fade=Number.isFinite(userFade)&&userFade>0?Math.min(userFade,Math.min(...durations)/2.2):fadeFor(durations);
   const settings=await history.settings(),e=await engine.status(false),backend=sources[0].backend,baseDir=settings.locations?.[backend]||(e.config?.directory?path.join(e.config.directory,'output'):null);if(!baseDir)throw Error('Add meg a ComfyUI kimeneti mappáját az Előzmények beállításainál.');
   const base=await realpath(baseDir),folder=path.join(base,outputFolder(settings.outputFolder)+profileOutputSegment(),'Videos',localDateFolder());await mkdir(folder,{recursive:true});
   const safe=board.name.normalize('NFKD').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'storyboard',output=path.join(folder,'Storyboard_'+safe+'_'+job.id.slice(0,8)+'.mp4');
   const inputs=temps.flatMap(t=>['-i',t]),g=xfadeGraph(durations,fade),length=g?g.length:durations[0];let musicFile=null;if(musicBytes){musicFile=path.join(tmp,'music.bin');await writeFile(musicFile,musicBytes);temps.push(musicFile);}
   let filter=g?g.graph:'[0:v]null[vout];[0:a]anull[aout]';
   if(musicFile){const m=temps.length-1-0;const mi=sources.length;filter+=`;[${mi}:a]aresample=48000,volume=0.55,afade=t=out:st=${Math.max(0,length-2.5).toFixed(2)}:d=2.5,atrim=0:${length.toFixed(2)}[mus];[aout][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[afinal]`;}
   const args=['-hide_banner','-nostdin','-y',...inputs,...(musicFile?['-stream_loop','-1','-i',musicFile]:[]),'-filter_complex',filter,'-map','[vout]','-map',musicFile?'[afinal]':'[aout]','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',output];
   await runVideoTool(exe,args,{timeout:1800000});const info=await probe(exe,output);
   job.step='Mentés az Előzményekbe';const runId=randomUUID().replaceAll('-',''),subfolder=path.relative(base,path.dirname(output)).split(path.sep).join('/');
   await atomicJSON(path.join(root,'data','runs',runId+'.json'),{schema:'artoftomworks.scene-dna.run',version:1,id:runId,projectId:'creator-hub',title:'Storyboard · '+board.name+' · kisfilm',backend,created:job.started,state:'complete',autoRun:false,error:'',jobs:[{mode:'video',shotId:'film',number:1,state:'complete',width:info.width,height:info.height,seconds:info.duration,fps:FPS,finished:Date.now(),operation:'film',parentIds:sources.map(s=>s.id),results:[{filename:path.basename(output),subfolder,type:'output'}]}]});
   job.state='complete';job.step='Kész';job.result={filename:path.basename(output),seconds:Math.round(info.duration*10)/10,clips:sources.length};
  }finally{for(const t of temps)await unlink(t).catch(()=>{});}
 }
 return {start,status};
}
