import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {healStep,createSelfHeal} from '../self-heal.mjs';
const oom={memory:true,message:'CUDA out of memory',nodeType:'VAEDecodeTiled'};
const job=()=>({shotId:'s1',error:'CUDA out of memory',errorInfo:{...oom},prompt:{'5':{class_type:'VAEDecodeTiled',inputs:{tile_size:512,overlap:64,temporal_size:256,temporal_overlap:32}},'6':{class_type:'KSampler',inputs:{steps:8,seed:1}}}});
test('step 1 frees memory without touching the graph, step 2 halves decode tiles, then stops',()=>{
  const j=job(),before=JSON.stringify(j.prompt);
  assert.equal(healStep(j).kind,'free');assert.equal(JSON.stringify(j.prompt),before);
  j.heal=[{kind:'free'}];const s=healStep(j);assert.equal(s.kind,'tiles');assert.equal(j.prompt['5'].inputs.tile_size,256);assert.equal(j.prompt['5'].inputs.temporal_size,128);assert.equal(j.prompt['6'].inputs.steps,8);
  j.heal.push({kind:'tiles'});assert.equal(healStep(j),null);
  assert.equal(healStep({...job(),errorInfo:{memory:false,message:'shape mismatch'}}),null);
  const noTiles={...job(),heal:[{kind:'free'}],prompt:{'1':{class_type:'VAEDecode',inputs:{}}}};assert.equal(healStep(noTiles),null);
});
test('service: auto retries with /free, off never retries; setting persists',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'heal-'));const calls=[];
  const h=createSelfHeal({root,fetchImpl:async(u,o)=>{calls.push(o?.method+' '+u);return {ok:true};}});
  assert.equal((await h.status()).mode,'auto');
  const j=job();const r=await h.onFailure({id:'r1',backend:'http://127.0.0.1:8191/'},j);
  assert.equal(r.retry,true);assert.deepEqual(calls,['POST http://127.0.0.1:8191/free']);assert.equal(j.heal.length,1);assert.equal((await h.status()).recent.length,1);
  await h.configure({mode:'off'});assert.equal(await h.onFailure({id:'r1',backend:'x'},job()),null);
  const h2=createSelfHeal({root});assert.equal((await h2.status()).mode,'off');
  await assert.rejects(h.configure({mode:'sometimes'}),/Érvénytelen/);
});
