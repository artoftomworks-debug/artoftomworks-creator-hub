// 0.16 DEV — automatic memory clearing when the main model changes (e.g. LTX → H3).
import test from 'node:test';import assert from 'node:assert/strict';
import {modelSignature,createMemoryGuard} from '../memory-guard.mjs';
const ltx={1:{class_type:'UNETLoader',inputs:{unet_name:'ltx25FP8Comfyui_v10.safetensors'}},2:{class_type:'CLIPLoader',inputs:{clip_name:'gemma.safetensors'}}};
const h3={1:{class_type:'UNETLoader',inputs:{unet_name:'DasiwaMinimaxH3_dasiwaHybridV4Turbo_3281858.safetensors'}}};
const entry=(prompt,ts)=>({prompt:[0,'id',prompt,{},[]],status:{status_str:'success',messages:[['execution_start',{timestamp:ts}],['execution_success',{timestamp:ts+5}]]}});
function fake(history,{failFree=false}={}){const calls=[];return {calls,fetchImpl:async(url,o={})=>{calls.push([url,o.method||'GET',o.body]);if(url.includes('/history'))return new Response(JSON.stringify(history));if(url.endsWith('/free'))return failFree?new Response('x',{status:500}):new Response('');return new Response('',{status:404});}};}
test('signature uses the main model names only',()=>{assert.equal(modelSignature(ltx),'ltx25fp8comfyui_v10.safetensors');assert.equal(modelSignature({}),'');});
test('LTX ran last, H3 comes next → memory is freed before submitting',async()=>{const f=fake({a:entry(h3,100),b:entry(ltx,200)});const r=await createMemoryGuard({fetchImpl:f.fetchImpl})('http://c',h3);
 assert.equal(r.freed,true);const free=f.calls.find(c=>c[0]==='http://c/free');assert.ok(free);assert.deepEqual(JSON.parse(free[2]),{unload_models:true,free_memory:true});});
test('newest entry is chosen by timestamp, not by position',async()=>{const f=fake({b:entry(ltx,300),a:entry(h3,100)});const r=await createMemoryGuard({fetchImpl:f.fetchImpl})('http://c',ltx);assert.equal(r.freed,false);assert.equal(r.reason,'same-models');});
test('same model again → nothing is unloaded (models stay warm)',async()=>{const f=fake({a:entry(h3,100)});const r=await createMemoryGuard({fetchImpl:f.fetchImpl})('http://c',h3);assert.equal(r.freed,false);assert.ok(!f.calls.some(c=>c[0].endsWith('/free')));});
test('fresh engine (empty history) or tool graphs without a main model → no unload',async()=>{const f=fake({});assert.equal((await createMemoryGuard({fetchImpl:f.fetchImpl})('http://c',h3)).freed,false);
 const g=fake({a:entry(ltx,1)});assert.equal((await createMemoryGuard({fetchImpl:g.fetchImpl})('http://c',{1:{class_type:'RIFE VFI',inputs:{}}})).reason,'no-main-model');});
test('errors never block the generation',async()=>{const f=fake({a:entry(ltx,1)},{failFree:true});const r=await createMemoryGuard({fetchImpl:f.fetchImpl})('http://c',h3);assert.equal(r.freed,false);assert.equal(r.reason,'error');
 const dead=await createMemoryGuard({fetchImpl:async()=>{throw Error('offline')}})('http://c',h3);assert.equal(dead.reason,'error');});
