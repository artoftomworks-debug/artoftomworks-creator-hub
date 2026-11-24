// 0.16 DEV — ✦ Kiegészítők
import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
const {styleOf,toggleTag,hasTag,groupsFor,negativesFor}=await import('../enhancers-ui.mjs');
test('style by family/name',()=>{assert.equal(styleOf({family:'sdxl',name:'ponyDiffusionV6.safetensors'}),'pony');assert.equal(styleOf({family:'illustrious'}),'tags');assert.equal(styleOf({family:'flux1'}),'natural');assert.equal(styleOf(null),'natural');});
test('toggle adds once, removes cleanly, keeps own text',()=>{let p='a woman in a red coat';p=toggleTag(p,'golden hour sunlight');assert.equal(p,'a woman in a red coat, golden hour sunlight');assert.equal(toggleTag(p,'golden hour sunlight'),'a woman in a red coat');
 let q=toggleTag('cat','score_9, score_8_up, score_7_up',{front:true});assert.equal(q,'score_9, score_8_up, score_7_up, cat');assert.ok(hasTag(q,'score_9, score_8_up, score_7_up'));assert.equal(toggleTag(q,'score_9, score_8_up, score_7_up'),'cat');
 assert.equal(hasTag('masterpiece, best quality','best quality'),true);assert.equal(hasTag('golden hour sunlight extra','golden hour sunlight'),false);});
test('groups: pony gets score tags, video gets motion, negatives only for tag models',()=>{assert.ok(groupsFor('pony','image')['Pony minőség']);assert.ok(groupsFor('natural','video')['Mozgás']);assert.equal(negativesFor('natural').length,0);assert.ok(negativesFor('tags').length>0);});
