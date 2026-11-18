import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterSnapshot,mergeParameters,saveSetupEntry,setupReadout} from '../setup-ui.mjs';
import {picture} from './fixtures.mjs';

const recipe=()=>({id:'one',name:'Portré',mode:'image',parameters:{source:picture,width:1024,height:576,count:3,seed:42,seedMode:'increment',seedStep:5,info:{models:['old.safetensors'],modelFields:[{node:'1',key:'ckpt_name',name:'old.safetensors'}]},controls:{models:[{node:'1',key:'ckpt_name',name:'selected.safetensors'}],sampling:{steps:8,cfg:1,sampler:'euler',scheduler:'simple'},addedLoras:[{name:'detail',on:true,strength:.7,clip:.4},{name:'off',on:false,strength:.2},{name:'removed',on:false,stripRemoved:true}]}}});
test('first recipe is retained in an empty list; overwrite is isolated and limits leave originals unchanged',()=>{
 const first=recipe(),saved=saveSetupEntry([],first);assert.equal(saved.length,1);first.parameters.controls.addedLoras[0].strength=99;assert.equal(saved[0].parameters.controls.addedLoras[0].strength,.7);
 const next=saveSetupEntry(saved,{...recipe(),name:'Updated'});assert.equal(next.length,1);assert.equal(saved[0].name,'Portré');assert.equal(next[0].name,'Updated');
 const full=Array.from({length:30},(_,i)=>({...recipe(),id:String(i)}));assert.throws(()=>saveSetupEntry(full,recipe()),/30/);assert.equal(full.length,30);
 assert.throws(()=>saveSetupEntry([],{...recipe(),reference:'x'.repeat(4*1024**2)}),/túl nagy/);
});
test('review shows effective workflow model, both LoRA weights, disabled rows and exact sampling',()=>{
 const rows=Object.fromEntries(setupReadout(recipe()));assert.equal(rows.Modell,'selected.safetensors');assert.match(rows['LoRA-k'],/✓ detail · modell 0.7 \/ CLIP 0.4/);assert.match(rows['LoRA-k'],/off.*inaktív/);assert.doesNotMatch(rows['LoRA-k'],/removed/);assert.equal(rows['Lépés / CFG'],'8 / 1');assert.equal(rows['Seed mód'],'Léptetés · 5');
});
test('selective application retains current prompt, image and coherent seed controls; explicit restore recovers motion and seed stride',()=>{
 const current={prompt:'Keep',negative:'Keep negative',image:'keep image',seed:123,seedMode:'random',seedStep:1,controls:{seed:123}},c={...recipe().parameters,prompt:'Saved',negative:'Saved negative',motion:{enabled:true,camera:'orbit',speed:'slow'},previewProfile:'detail',modelSamplingPolicy:'manual',catalog:{huge:'excluded'},image:'private'};
 const snapshot={...parameterSnapshot(c),prompt:c.prompt,negative:c.negative};assert(!('catalog'in snapshot));assert(!('image'in snapshot));
 const next=mergeParameters(current,snapshot);assert.equal(next.prompt,'Keep');assert.equal(next.negative,'Keep negative');assert.equal(next.seed,123);assert.equal(next.controls.seed,123);assert.equal(next.image,'keep image');assert.equal(next.motion.camera,'orbit');assert.equal(next.previewProfile,'detail');assert.equal(next.modelSamplingPolicy,'manual');assert.equal(next.prepared,false);
 const restored=mergeParameters(current,snapshot,{seed:true,prompt:true});assert.equal(restored.seed,42);assert.equal(restored.controls.seed,42);assert.equal(restored.seedStep,5);assert.equal(restored.prompt,'Saved');
 const view=Object.fromEntries(setupReadout({mode:'video',parameters:{...snapshot,duration:10}}));assert.match(view['Mozgás / kamera'],/orbit/);assert.equal(view['Kért videóhossz'],'10 mp');
});
