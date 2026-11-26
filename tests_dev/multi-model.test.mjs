import test from 'node:test';import assert from 'node:assert/strict';
import {sizeForFamily,seedFor} from '../multi-model-ui.mjs';
test('SD1/SD2 get a size they were trained for (aspect kept), others keep the chosen size',()=>{
  assert.deepEqual(sizeForFamily('sdxl',1216,832),{width:1216,height:832});assert.deepEqual(sizeForFamily('flux1',1024,1024),{width:1024,height:1024});
  const s=sizeForFamily('sd1',1216,832);assert.equal(Math.max(s.width,s.height),768);assert.ok(Math.abs(s.width/s.height-1216/832)<0.08);assert.equal(s.width%64+s.height%64,0);
  assert.deepEqual(sizeForFamily('sd1',512,768),{width:512,height:768});
});
test('same seeds for every model by default, otherwise a fresh block per model',()=>{
  assert.deepEqual([0,1,2].map(i=>seedFor(100,i,4,true)),[100,100,100]);assert.deepEqual([0,1,2].map(i=>seedFor(100,i,4,false)),[100,104,108]);
});
import {formatSizes} from '../multi-model-ui.mjs';
import {knownModelProfile,automaticSamplingDefaults} from '../sampling-policy.mjs';
test('portrait / landscape / square variants keep the pixel budget',()=>{
  const f=formatSizes(832,1216);assert.deepEqual(f.portrait,{width:832,height:1216});assert.deepEqual(f.landscape,{width:1216,height:832});assert.equal(f.square.width,f.square.height);
  for(const v of Object.values(f))assert.ok(Math.abs(v.width*v.height/(832*1216)-1)<0.08&&v.width%64===0&&v.height%64===0);
  const q=formatSizes(1024,1024);assert.ok(q.portrait.height>q.portrait.width&&q.landscape.width>q.landscape.height);
});
test('Stable Yogi Realism Moss: 6 steps; other Moss models keep 50',()=>{
  const m={family:'moss',name:'Realism By Stable Yogi Moss V2.0 fp8-scaled C92.safetensors'};assert.equal(knownModelProfile(m).values.steps,6);assert.equal(automaticSamplingDefaults(m).steps,6);
  assert.equal(automaticSamplingDefaults({family:'moss',name:'moss_base.safetensors'}).steps,50);
});
// 0.16 DEV — mentett összehasonlító sablonok
import {loadTemplates,saveTemplate,deleteTemplate,applyTemplate} from '../multi-model-ui.mjs';
test('templates: save, replace by name, keep seed only when asked, delete; missing models are reported',()=>{const mem={v:null,getItem(){return this.v;},setItem(k,v){this.v=v;}};
 saveTemplate({name:'Portré',models:['a','b'],formats:['portrait','bogus'],count:3,same:true},mem);saveTemplate({name:'Táj',models:['c'],formats:['landscape'],count:2,same:false,seed:42},mem);
 let list=loadTemplates(mem);assert.equal(list.length,2);assert.equal(list[0].name,'Táj');assert.equal(list[0].seed,42);assert.equal(list[1].seed,undefined);assert.deepEqual(list[1].formats,['portrait']);
 saveTemplate({name:'Portré',models:['a'],formats:['square'],count:9},mem);list=loadTemplates(mem);assert.equal(list.length,2);assert.equal(list[0].name,'Portré');assert.equal(list[0].count,8);
 assert.deepEqual(applyTemplate({models:['a','x']},['a','b']),{found:['a'],missing:['x']});
 deleteTemplate('Táj',mem);assert.deepEqual(loadTemplates(mem).map(t=>t.name),['Portré']);});
test('group formats preserve an exact 16:9 size on the 32-pixel grid',()=>{
  const sizes=formatSizes(1536,864);
  assert.deepEqual(sizes.landscape,{width:1536,height:864});
  assert.deepEqual(sizes.portrait,{width:864,height:1536});
});
