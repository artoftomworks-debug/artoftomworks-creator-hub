import test from 'node:test';import assert from 'node:assert/strict';import {groupByFamily,setWanted,wanted} from '../multi-lora-ui.mjs';
test('LoRA-k modellenként: családonként csoportosít, a nem illőket külön jelzi',()=>{
 const models=[{id:'a',name:'krea.safetensors',family:'krea2'},{id:'b',name:'flux.safetensors',family:'flux1'},{id:'c',name:'flux2.safetensors',family:'flux1'}];
 const rows=[{name:'cine',on:true,family:'krea2'},{name:'rem',parked:true,family:'flux1'},{name:'old',on:false,family:'sd1'},{name:'gone',stripRemoved:true,family:'flux1'}];
 const {groups,other}=groupByFamily({models,rows,familyOf:r=>r.family});
 assert.deepEqual(groups.map(g=>[g.family,g.models.length,g.loras.map(r=>r.name)]),[['krea2',1,['cine']],['flux1',2,['rem']]]);
 assert.deepEqual(other.map(r=>r.name),['old']);
 const rem=rows[1];setWanted(rem,false,{rowFamily:'flux1',activeFamily:'krea2'});assert.equal(wanted(rem),false);
 setWanted(rem,true,{rowFamily:'flux1',activeFamily:'krea2'});assert.deepEqual([rem.on,rem.parked],[false,true]);
 setWanted(rem,true,{rowFamily:'flux1',activeFamily:'flux1'});assert.deepEqual([rem.on,rem.parked],[true,undefined]);
});
import {addLoraRow} from '../multi-lora-ui.mjs';
test('LoRA hozzáadása családhoz: az aktív családnál Be, másnál Vár; levett sor visszajön',()=>{
 const c={controls:{loras:[],addedLoras:[{name:'rem.safetensors',on:false,stripRemoved:true,strength:.5,family:'flux1'}]}};
 const a=addLoraRow(c,'rem.safetensors','flux1','krea2');assert.equal(a.stripRemoved,undefined);assert.deepEqual([a.on,a.parked,a.strength],[false,true,.5]);
 const b=addLoraRow(c,'cine.safetensors','krea2','krea2');assert.deepEqual([b.on,b.parked,b.strength,b.clip],[true,undefined,.8,null]);
 assert.equal(c.controls.addedLoras.length,2);
});
