import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
const tempBase=path.resolve('./tests/.runtime');await mkdir(tempBase,{recursive:true});
import {createGenerationManager} from '../generation-manager.mjs';
import {createRenderServices} from '../runner.mjs';
import {createHubServer} from '../server.mjs';
import {previewPlan} from '../generation-actions-ui.mjs';
import {plan,fakeBackend} from './fixtures.mjs';
async function fixture(fn){const root=await mkdtemp(path.join(tempBase,'hub-generation-')),f=fakeBackend(),r=createRenderServices({root:path.join(root,'runs'),fetchImpl:f.fetchImpl,pollMS:999999,liveSocket:null});let now=1000;const g=createGenerationManager({root,runner:r,clock:()=>now,pollMS:999999});try{await fn({g,r,f,root,time:n=>now=n});}finally{g.close();r.close();assert.equal(path.dirname(path.resolve(root)),tempBase);await rm(root,{recursive:true,force:true});}}
const configured=()=>{const p=plan();p.shots[0].controls={seed:100};return p;};
test('queue freezes plans, serializes jobs and does not expose private prompts',()=>fixture(async({g,r,f})=>{const p=configured();await g.enqueue(p);p.shots[0].prompt='changed editor';p.shots[0].controls.seed=999;await g.enqueue(configured());assert(!JSON.stringify(await g.status()).includes('lighthouse'));await g.tick();await r.tick();await g.tick();assert.equal(f.posts.length,1);assert.equal(f.posts[0].prompt['3'].inputs.text,'A calm seaside lighthouse');assert.equal(f.posts[0].prompt['6'].inputs.seed,100);f.finish();await r.tick();await r.tick();await g.tick();await r.tick();assert.equal(f.posts.length,2);f.finish();await r.tick();await r.tick();await g.tick();assert.equal((await g.status()).armed,false);}));
test('bounded continuous mode increments seed and stops exactly at count',()=>fixture(async({g,r,f})=>{await g.enqueue(configured(),{kind:'continuous',limits:{count:3,minutes:1,seeds:'increment',minFreeGiB:0}});for(let i=0;i<3;i++){await g.tick();await r.tick();assert.equal(f.posts.length,i+1);assert.equal(f.posts[i].prompt['6'].inputs.seed,100+i);f.finish();await r.tick();await r.tick();}await g.tick();await r.tick();assert.equal(f.posts.length,3);assert.equal((await g.status()).entries[0].done,3);assert.equal((await g.status()).armed,false);}));
test('time budget and explicit pause prevent another submission',()=>fixture(async({g,r,f,time})=>{await g.enqueue(configured(),{kind:'continuous',limits:{count:20,minutes:1,seeds:'increment',minFreeGiB:0}});await g.tick();await r.tick();time(62000);f.finish();await r.tick();await r.tick();await g.tick();await r.tick();assert.equal(f.posts.length,1);assert.equal((await g.status()).armed,false);await g.enqueue(configured());await g.stop({all:true,cancel:true});await g.tick();assert.equal(f.posts.length,1);}));
test('replacement waits for targeted cancellation; foreign work is never interrupted',()=>fixture(async({g,r,f})=>{await g.enqueue(configured());await g.tick();await r.tick();const p=configured();p.shots[0].controls.seed=200;await g.enqueue(p,{replace:true});await g.tick();assert.equal(f.posts.length,1);await r.tick();await g.tick();await r.tick();assert.equal(f.posts.length,2);assert.equal(f.posts[1].prompt['6'].inputs.seed,200);f.finish();await r.tick();await r.tick();await g.tick();f.busy(true);await g.enqueue(configured());await g.tick();await r.tick();assert.equal(f.posts.length,2);await g.stop({all:true,cancel:true});assert.equal(f.posts.length,2);}));
test('durable queue restarts paused and resumes only by request',()=>fixture(async({g,r,f,root})=>{await g.enqueue(configured());g.close();const copy=createGenerationManager({root,runner:r,pollMS:999999});try{assert.equal((await copy.status()).armed,false);assert.equal((await copy.status()).entries[0].state,'paused');await copy.tick();assert.equal(f.posts.length,0);await copy.resume();await copy.tick();await r.tick();assert.equal(f.posts.length,1);}finally{copy.close();}}));
test('continuous invalid budgets and deletion of started plans are rejected',()=>fixture(async({g,r})=>{await assert.rejects(g.enqueue(configured(),{kind:'continuous',limits:{count:0,minutes:1,seeds:'increment',minFreeGiB:0}}));await g.enqueue(configured());await g.tick();await r.tick();await assert.rejects(g.remove((await g.status()).entries[0].id));}));
test('quick preview uses its own small snapshot, preserving steps and editor dimensions',()=>{const p={video:true,payload:{width:1088,height:608,count:3,duration:10,sampling:{steps:12}}},q=previewPlan(p);assert.equal(p.payload.width,1088);assert.equal(q.payload.count,1);assert.equal(q.payload.duration,2);assert(q.payload.width<=640);assert.equal(q.payload.sampling.steps,12);});
test('a paused older run can resume after a newer run has completed',()=>fixture(async({g,r,f})=>{await g.enqueue(configured());await g.tick();await r.tick();await g.stop({cancel:true});await r.tick();const next=await r.prepare(configured());await g.start({id:next.id,contextKey:next.contextKey});await r.tick();f.finish();await r.tick();await r.tick();await g.tick();assert.equal((await g.status()).current,null);await g.resume();await g.tick();await r.tick();assert.equal(f.posts.length,3);assert.equal((await g.status()).entries[0].state,'running');}));
test('temporary preparation failure pauses with a visible reason and can resume',()=>fixture(async({g,r,f})=>{const prepare=r.prepare;let first=true;r.prepare=async p=>{if(first){first=false;throw Error('Temporary backend unavailable');}return prepare(p);};await g.enqueue(configured());await g.tick();let q=await g.status();assert.equal(q.armed,false);assert.equal(q.entries[0].state,'paused');assert.match(q.entries[0].error,/unavailable/);await g.resume();await g.tick();await r.tick();assert.equal(f.posts.length,1);}));
test('refused targeted cancellation never replaces the original with another job',()=>fixture(async({g,r,f})=>{await g.enqueue(configured());await g.tick();await r.tick();const before=await g.status();r.stop=async()=>({...await r.status(before.current),error:'Targeted bridge unavailable'});await assert.rejects(g.enqueue(configured(),{replace:true}),/bridge unavailable/);const after=await g.status();assert.equal(after.current,before.current);assert.equal(after.entries.length,1);await g.tick();await r.tick();assert.equal(f.posts.length,1);}));
test('check and export do not submit or alter a running plan',async()=>{const root=await mkdtemp(path.join(tempBase,'hub-check-')),f=fakeBackend(),app=createHubServer({root,fetchImpl:f.fetchImpl,pollMS:999999,liveSocket:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,post=async(route,payload)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};try{const p=configured(),input={mode:'workflow',payload:{...p,prompt:p.shots[0].prompt,controls:{seed:100}}};const a=await post('generation/check',input);await post('start',{id:a.id,contextKey:a.contextKey});await app.runner.tick();assert.equal(f.posts.length,1);const out=await post('generation/export',input);assert.equal(out.files.length,1);assert.equal(f.posts.length,1);assert.equal((await app.runner.status(a.id)).jobs[0].seed,100);assert.equal((await fetch(base+'/generation-actions-ui.mjs')).status,200);}finally{app.generation.close();app.runner.close();app.engine.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));assert.equal(path.dirname(path.resolve(root)),tempBase);await rm(root,{recursive:true,force:true});}});


test('finish-current preserves the output and pauses both remaining shots and waiting plans',()=>fixture(async({g,r,f})=>{
 const p=configured();p.shots.push({...structuredClone(p.shots[0]),id:'work-2',controls:{seed:105}});
 await g.enqueue(p);await g.enqueue(configured());await g.tick();await r.tick();
 const id=(await g.status()).current;const stopped=await g.stop({cancel:false});
 assert.equal(stopped.run.stopAfterCurrent,true);assert.equal(stopped.run.jobs[0].cancelRequested,undefined);assert.equal(stopped.queue.armed,false);
 assert.equal(f.posts.length,1);f.finish();await r.tick();await r.tick();await g.tick();await r.tick();
 const ended=await r.status(id);assert.equal(ended.jobs[0].state,'complete');assert.equal(ended.jobs[0].results.length,1);assert.equal(ended.jobs[1].state,'planned');assert.equal(f.posts.length,1);
 await g.resume();await g.tick();await r.tick();assert.equal(f.posts.length,2);assert.equal((await r.status(id)).stopAfterCurrent,false);
}));

test('continuous mode respects the configured seed stride',()=>fixture(async({g,r,f})=>{
 const p=configured();p.seedStep=10;await g.enqueue(p,{kind:'continuous',limits:{count:3,minutes:1,seeds:'increment',minFreeGiB:0}});
 for(let i=0;i<3;i++){await g.tick();await r.tick();assert.equal(f.posts[i].prompt['6'].inputs.seed,100+i*10);f.finish();await r.tick();await r.tick();}
 await g.tick();assert.equal((await g.status()).armed,false);
}));


test('a new plan can start after finish-current without losing the paused remainder',()=>fixture(async({g,r,f})=>{
 const p=configured();p.shots.push({...structuredClone(p.shots[0]),id:'work-2',controls:{seed:105}});
 await g.enqueue(p);await g.tick();await r.tick();const old=(await g.status()).current;
 await g.stop({cancel:false});f.finish();await r.tick();await r.tick();
 const next=configured();next.shots[0].controls.seed=900;await g.enqueue(next);await g.tick();await r.tick();
 assert.equal(f.posts.length,2);assert.equal(f.posts[1].prompt['6'].inputs.seed,900);assert.equal((await r.status(old)).jobs[1].state,'planned');
 f.finish();await r.tick();await r.tick();await g.tick();await g.resume();await g.tick();await r.tick();
 assert.equal(f.posts.length,3);assert.equal(f.posts[2].prompt['6'].inputs.seed,105);
}));
