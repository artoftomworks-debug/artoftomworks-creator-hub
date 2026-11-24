import test from 'node:test';import assert from 'node:assert/strict';
import {preflight,fitToImage} from '../preflight.mjs';
const ids=r=>r.map(i=>i.id+':'+i.level);
test('landscape start image + portrait video → warning with an area-keeping fix',()=>{
  const r=preflight({mode:'video',width:608,height:1088,duration:4,prompt:'x',image:{width:1344,height:768},model:{family:'ltx',name:'ltx25.safetensors'}});
  const o=r.find(i=>i.id==='orientation');assert.equal(o.level,'warn');assert.deepEqual(o.fix.patch,{width:896,height:448}.width?fitToImage(608,1088,1344,768,64):null);
  assert.ok(o.fix.patch.width>o.fix.patch.height&&o.fix.patch.width%64===0&&o.fix.patch.height%64===0);
});
test('matching plan is clean',()=>{assert.deepEqual(preflight({mode:'video',width:1088,height:640,duration:4,prompt:'walks',image:{width:1920,height:1080},model:{family:'ltx',name:'ltx'}}),[]);});
test('turbo / Eros step counts, LTX length, empty prompt, rounding',()=>{
  const turbo=preflight({mode:'video',width:640,height:1088,duration:4,prompt:'x',steps:20,model:{family:'h3',name:'DasiwaMinimaxH3_dasiwaHybridV4Turbo.safetensors'}});
  assert.deepEqual(ids(turbo),['steps:warn']);assert.deepEqual(turbo[0].fix.patch,{steps:8});
  assert.deepEqual(ids(preflight({mode:'video',width:640,height:1088,duration:4,prompt:'x',steps:6,model:{family:'h3',name:'h3ErosMax_beta5.safetensors'}})),[]);
  assert.deepEqual(ids(preflight({mode:'video',width:640,height:1088,duration:15,prompt:'',model:{family:'ltx',name:'ltx'}})),['prompt:warn','duration:info','load:info']);
  assert.deepEqual(preflight({mode:'image',width:1000,height:1000,prompt:'x'})[0].fix.patch,{width:992,height:992});
  assert.deepEqual(ids(preflight({mode:'video',width:1920,height:1088,duration:10,prompt:'x',model:{family:'ltx',name:'l'}})),['load:info']);
});
