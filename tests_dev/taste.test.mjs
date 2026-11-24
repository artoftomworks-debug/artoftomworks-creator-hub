// 0.16 DEV — ízlésprofil
import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeTaste,topicOf,scoreOf,suggestFor} from '../taste.mjs';
const r=(model,rating,extra={})=>({model:model+'.safetensors',rating,favorite:false,steps:8,width:768,height:1344,prompt:'portrait of a woman',loras:[],...extra});
test('score: rating wins, a favourite without rating counts as 5, nothing → excluded',()=>{assert.equal(scoreOf({rating:3,favorite:true}),3);assert.equal(scoreOf({favorite:true}),5);assert.equal(scoreOf({}),null);});
test('topics',()=>{assert.equal(topicOf('Portrait of a man'),'portrait');assert.equal(topicOf('sunset over the sea'),'landscape');assert.equal(topicOf('a red car'),'other');});
test('too few ratings → not enough, no strong dot',()=>{const a=analyzeTaste([r('Moss',5),r('Moss',4)]);assert.equal(a.enough,false);assert.equal(a.strong,false);assert.equal(a.rated,2);});
test('models, topic winner, best steps, LoRA effect and the strong flag',()=>{
 const rows=[r('Moss',5,{steps:6}),r('Moss',5,{steps:6}),r('Moss',4,{steps:6}),r('Moss',2,{steps:20}),r('Moss',2,{steps:20}),r('Ollie',2),r('Ollie',3),r('Ollie',2,{loras:['skin.safetensors']}),r('Ollie',2,{loras:['skin.safetensors']}),r('Moss',4,{prompt:'mountain landscape',width:1344,height:768})];
 const a=analyzeTaste(rows);assert.equal(a.enough,true);assert.equal(a.models[0].model,'Moss');assert.equal(a.models[0].bestSteps,6);
 const p=a.topics.find(t=>t.topic==='portrait');assert.equal(p.best.model,'Moss');assert.equal(p.second.model,'Ollie');assert.equal(a.strong,true);
 assert.equal(a.steps[0].best.steps,6);assert.equal(a.steps[0].worst.steps,20);assert.equal(a.loras[0].lora,'skin');assert.equal(a.loras[0].with.n,2);
 assert.deepEqual(suggestFor(a,'close-up portrait','Ollie.safetensors').best.model,'Moss');assert.equal(suggestFor(a,'portrait','Moss.safetensors').same,true);});
