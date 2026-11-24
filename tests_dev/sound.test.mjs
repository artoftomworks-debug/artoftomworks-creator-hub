import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,readdir,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {soundGraph,cleanSound,createSound} from '../sound.mjs';
test('soundGraph builds own-audio, music and ducking chains',()=>{
 const a=soundGraph({hasAudio:true,length:5,fadeIn:1,fadeOut:1,volume:80});assert.match(a.graph,/^\[0:a\]/);assert.match(a.graph,/volume=0\.800/);assert.match(a.graph,/afade=t=out:st=4\.000/);assert.equal(a.musicInput,-1);
 const b=soundGraph({hasAudio:false,length:4,music:true,duck:true});assert.match(b.graph,/^\[2:a\]/);assert.match(b.graph,/sidechaincompress/);assert.equal(b.musicInput,2);
 const c=soundGraph({hasAudio:true,length:4,music:true,duck:false,mute:true,loudnorm:true});assert.doesNotMatch(c.graph,/sidechain/);assert.match(c.graph,/volume=0[^.]/);assert.match(c.graph,/loudnorm/);
 assert.equal(cleanSound({volume:999}).volume,300);});
let hasFfmpeg=true;try{execFileSync('ffmpeg',['-version'],{stdio:'ignore'});}catch{hasFfmpeg=false;}
test('sound job renders a new video with music (ffmpeg)',{skip:!hasFfmpeg},async()=>{const root=await mkdtemp(path.join(tmpdir(),'sound-'));try{
 const src=path.join(root,'in.mp4'),out=path.join(root,'out');await mkdir(out);execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc=size=320x240:rate=24:duration=3','-c:v','libx264','-pix_fmt','yuv420p',src]);
 const mus=execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-f','wav','-']);
 const history={location:async()=>({available:true,path:src,backend:'comfy',project:'Teszt'}),settings:async()=>({locations:{comfy:out},outputFolder:'Hub'})};
 const s=createSound({root,history,engine:{status:async()=>({config:{}})}});const j=s.start({id:'abc',music:'data:audio/wav;base64,'+mus.toString('base64'),fadeIn:0.5,fadeOut:0.5,loudnorm:true});const {id}=await j;
 let st;for(let i=0;i<100;i++){st=s.status(id);if(st.state!=='running')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(st.state,'complete',st.error);const runs=await readdir(path.join(root,'data','runs'));assert.equal(runs.length,1);const run=JSON.parse(await readFile(path.join(root,'data','runs',runs[0]),'utf8'));assert.equal(run.title,'Teszt · hang');
 const probe=execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type','-of','csv=p=0',path.join(out,run.jobs[0].results[0].subfolder,run.jobs[0].results[0].filename)]).toString();assert.match(probe,/video/);assert.match(probe,/audio/);
}finally{await rm(root,{recursive:true,force:true});}});
