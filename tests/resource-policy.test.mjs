import test from 'node:test';
import assert from 'node:assert/strict';
import {hardwareSummary,memoryPolicy,applyResourcePolicy} from '../resource-policy.mjs';
const stats={system:{ram_total:32*1024**3},devices:[{type:'cuda',name:'Test NVIDIA',vram_total:12*1024**3}]};
const rule=(type,extra={})=>[type,extra];
const objects={
 MiniMaxLowVRAMAttention:{input:{required:{model:rule('MODEL'),head_chunks:rule('INT',{min:1,max:56})}}},
 MiniMaxChunkFeedForward:{input:{required:{model:rule('MODEL'),chunks:rule('INT',{min:1,max:64}),seq_threshold:rule('INT',{min:256,max:262144})}}},
 ModelAttentionBackend:{input:{required:{model:rule('MODEL'),attention:rule('COMBO',{options:['pytorch attention','comfy kitchen attention']})}}},
 VAEDecodeTiled:{input:{required:{samples:rule('LATENT'),vae:rule('VAE'),tile_size:rule('INT',{min:64,max:4096}),overlap:rule('INT',{min:0,max:4096}),temporal_size:rule('INT',{min:8,max:4096}),temporal_overlap:rule('INT',{min:4,max:4096})}}}
};
const graph=()=>({'1':{class_type:'UNETLoader',inputs:{unet_name:'h3.safetensors',weight_dtype:'default'}},'2':{class_type:'LoraLoaderModelOnly',inputs:{model:['1',0],lora_name:'test.safetensors',strength_model:.6}},'3':{class_type:'MiniMaxH3ImageToVideo',inputs:{width:1024,height:576,length:243,prompt:'A lake.'}},'4':{class_type:'CFGGuider',inputs:{model:['2',0],cfg:1}},'5':{class_type:'VAEDecode',inputs:{samples:['8',0],vae:['6',0]}}});
test('RAM and VRAM stay distinct; automatic low-memory policy chooses from actual hardware and high mode warns without altering dimensions',()=>{
 const h=hardwareSummary(stats);assert.equal(h.ramGiB,32);assert.equal(h.vramGiB,12);assert.equal(memoryPolicy('auto',h).effective,'low');assert.match(memoryPolicy('high',h).warning,/szűkös/);assert.equal(memoryPolicy('auto',{}).effective,'high');assert.throws(()=>memoryPolicy('invented'),/Ismeretlen/);
});
test('low profile uses bounded available chunking and tiled decoding while preserving model, LoRA, seed, prompt and canvas',()=>{
 const p=graph(),before=structuredClone(p),r=applyResourcePolicy(p,objects,{memoryProfile:'low',stats});assert(r.changed);assert.equal(p['5'].class_type,'VAEDecodeTiled');const feed=p[p['4'].inputs.model[0]],attention=p[feed.inputs.model[0]];assert.equal(feed.class_type,'MiniMaxChunkFeedForward');assert.equal(attention.class_type,'MiniMaxLowVRAMAttention');assert.deepEqual(attention.inputs.model,['2',0]);assert.deepEqual(p['1'],before['1']);assert.deepEqual(p['2'],before['2']);assert.deepEqual(p['3'],before['3']);assert.equal(r.applied.length,3);
});
test('missing nodes retain the executable graph with explicit fallback notes and unknown hardware never enables INT8 acceleration',()=>{
 const p=graph(),before=structuredClone(p),r=applyResourcePolicy(p,{}, {memoryProfile:'low',h3Acceleration:'kitchen'});assert.equal(r.changed,false);assert.deepEqual(p,before);assert(r.notes.length>=3);
});
test('H3 acceleration is explicit and bounded; large/reference workloads keep the original backend, high mode alone preserves graph',()=>{
 const p=graph(),r=applyResourcePolicy(p,objects,{memoryProfile:'high',h3Acceleration:'kitchen',stats,width:1024,height:576,duration:10});assert(r.applied.some(v=>v.includes('Kitchen')));assert.equal(p[p['4'].inputs.model[0]].inputs.attention,'comfy kitchen attention');
 for(const extra of [{width:2048,height:1152,duration:15},{width:1024,height:576,duration:10,ref:true}]){const q=graph();if(extra.ref)q['9']={class_type:'MiniMaxH3AddGuide',inputs:{}};const out=applyResourcePolicy(q,objects,{memoryProfile:'high',h3Acceleration:'kitchen',stats,...extra});assert(!out.applied.some(v=>v.includes('Kitchen')));assert.equal(q['4'].inputs.model[0],'2');}
 const q=graph(),old=structuredClone(q);assert.equal(applyResourcePolicy(q,objects,{memoryProfile:'high',stats}).changed,false);assert.deepEqual(q,old);
});
test('a custom workflow attention choice is retained rather than silently overridden',()=>{
 const p=graph();p['7']={class_type:'ModelAttentionBackend',inputs:{model:['2',0],attention:'pytorch attention'}};p['4'].inputs.model=['7',0];const r=applyResourcePolicy(p,objects,{memoryProfile:'high',h3Acceleration:'kitchen',stats});assert.equal(p['7'].inputs.attention,'pytorch attention');assert.equal(r.changed,false);assert(r.notes.some(v=>v.includes('saját beállítása')));
});
