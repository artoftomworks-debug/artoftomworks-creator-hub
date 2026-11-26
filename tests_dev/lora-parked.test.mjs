import test from 'node:test';import assert from 'node:assert/strict';import {retainLoras,loraEligibility} from '../lora-state.mjs';
test('„Vár” LoRA: a saját családja modelljénél újra bekapcsol, a többinél vár',()=>{
 const inventory={loras:[{name:'rembrandt.safetensors',family:'flux1'},{name:'cine.safetensors',family:'krea2'}]};
 const c={controls:{loras:[],addedLoras:[{name:'rembrandt.safetensors',on:false,parked:true,strength:.5},{name:'cine.safetensors',on:true,strength:.6}]}};
 const forKrea=retainLoras(c,'krea2',inventory),forFlux=retainLoras(c,'flux1',inventory);
 assert.deepEqual(forKrea.map(r=>[r.on,!!r.parked]),[[false,true],[true,false]]);
 assert.deepEqual(forFlux.map(r=>[r.on,!!r.parked]),[[true,false],[false,true]]);
 assert.equal(forFlux[0].strength,.5);
 const e=loraEligibility({controls:{loras:[]},catalog:{loras:inventory.loras}},{name:'rembrandt.safetensors'},'krea2');assert.equal(e.enabled,false);assert.equal(e.family,'flux1');
});
