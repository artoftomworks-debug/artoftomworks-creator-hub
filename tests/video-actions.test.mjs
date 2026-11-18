import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {advanceSeriesSeed} from '../seed-reservation.mjs';
import {createVideoTools} from '../video-tools.mjs';
import {compileRenderShot,inspectRenderSource} from '../workflow.mjs';
import {picture,video} from './fixtures.mjs';
const runtime=path.resolve('./tests/.runtime');await mkdir(runtime,{recursive:true});

test('accepted separate series reserve new seeds, while fixed/random/edited plans remain unchanged',()=>{
 const c={seed:100,seedMode:'increment',controls:{seed:100}};
 assert(advanceSeriesSeed(c,{seed:100,seedMode:'increment',seedStep:5,count:1}));assert.equal(c.seed,105);
 assert(advanceSeriesSeed(c,{seed:105,seedMode:'increment',seedStep:5,count:3}));assert.equal(c.seed,120);
 assert(!advanceSeriesSeed(c,{seed:105,seedMode:'increment',count:1}));assert.equal(c.seed,120,'older accepted snapshot cannot overwrite edits');
 for(const seedMode of ['fixed','random'])assert(!advanceSeriesSeed(c,{seed:120,seedMode,count:1}));
 assert(!advanceSeriesSeed(c,{seed:-1,seedMode:'increment'}));assert.equal(c.controls.seed,120);
});

test('H3 video sampler receives distinct reserved seeds across separately started series',()=>{
 const c={seed:321,seedMode:'increment',controls:{seed:321}};
 const source=structuredClone(video);source.prompt['7'].class_type='KSampler';const actual=[];for(let i=0;i<3;i++){const compiled=compileRenderShot(source,{prompt:'A calm lighthouse',negative:'',duration:2,width:640,height:352,output:inspectRenderSource(video).output,controls:{seed:c.seed}},'fixture.png','Test/Video');actual.push(...Object.values(compiled.prompt).flatMap(n=>['seed','noise_seed'].filter(k=>Number.isSafeInteger(n.inputs[k])).map(k=>n.inputs[k])));assert(advanceSeriesSeed(c,{seed:c.seed,seedMode:'increment',seedStep:5}));}
 assert.deepEqual([...new Set(actual)],[321,326,331]);
});

test('video handoff validates the indexed video, reuses the real CPU editor importer and never queues generation',async()=>{
 const root=await mkdtemp(path.join(runtime,'video-tools-')),file=path.resolve('tests/fixtures/live-preview.mp4');let mode='video';const calls=[];
 const t=createVideoTools({root,sourceRoot:path.resolve('.'),history:{location:async id=>{assert.equal(id,'known');return {id,path:file,filename:'source.mp4',mode,available:true};}},studio:{openTool:async data=>{calls.push(data);return {url:'http://127.0.0.1:8190/prophetero_audio_fix/repair?language=HU'};}}});
 try{const before=await readFile(file);assert.match((await t.open({id:'known',tool:'video-studio'})).url,/history=known/);assert.match((await t.open({id:'known',tool:'loop-lab'})).url,/history=known/);
  const audio=await t.open({id:'known',tool:'audio-fix',backend:'http://127.0.0.1:8190'});assert.equal(JSON.parse(decodeURIComponent(new URL(audio.url).hash.slice(1))).video_path,file);
  const imported=await t.importVideo({id:'known'});assert(imported.asset.video);assert(imported.asset.duration>0);const png=await t.lastFrame({id:'known'});assert.equal(png.subarray(1,4).toString(),'PNG');const again=await t.importVideo({id:'known'});assert.equal(again.asset.id,imported.asset.id,'duplicate source is reused');assert.deepEqual(await readFile(file),before);assert.equal(calls.length,1,'native video tools do not contact the generation backend');
  const page=await t.page();assert.match(page,/api\/video-tools\/import/);assert.match(page,/addAsset\(a,'clip'\)/);assert.match(page,/creatorHub.videoStudio/);
  mode='image';await assert.rejects(t.open({id:'known',tool:'video-studio'}),/videót/);
 }finally{t.close();assert.equal(path.dirname(root),runtime);await rm(root,{recursive:true,force:true});}
});

test('Final Check bridge registers only the selected verified source and rejects unrelated proxy routes',async()=>{
 const root=await mkdtemp(path.join(runtime,'video-bridge-')),seen=[];const source={id:'known',mode:'video',available:true,path:'C:\\Output\\source.mp4',filename:'source.mp4'};
 const t=createVideoTools({root,sourceRoot:path.resolve('.'),history:{location:async()=>source},studio:{openTool:async()=>({})},fetchImpl:async url=>{seen.push(url);return new Response(url.includes('/assets/studio.mjs')?'async function addRecord(x){};async function init(){};void init();':'<script src="/prophetero_final_check/assets/studio.mjs"></script>',{headers:{'Content-Type':url.endsWith('.mjs')?'text/javascript':'text/html'}});}});
 try{const result=await t.open({id:'known',tool:'final-check',backend:'http://127.0.0.1:8190'}),url=new URL(result.url,'http://127.0.0.1:18901'),token=url.pathname.split('/')[2];assert.equal((await t.bridgeSource(token)).path,source.path);let body='';const res={writeHead(){},end(v){body=v;}};assert(await t.proxy({method:'GET',headers:{}},res,new URL('/video-tools/'+token+'/prophetero_final_check/assets/studio.mjs',url)));assert.match(body,/request\('register'/);assert.match(body,/api\/video-tools\/source/);assert(!body.includes(source.path));
  await assert.rejects(t.proxy({method:'GET',headers:{}},res,new URL('/video-tools/'+token+'/prophetero_final_check/unknown',url)),/nem érhető/);
 }finally{t.close();await rm(root,{recursive:true,force:true});}
});
