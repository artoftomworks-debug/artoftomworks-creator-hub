import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreAutomaticCatalog} from '../automatic-ui.mjs';
import {compatibility} from '../catalog.mjs';
import {headerProfile} from '../model-profile.mjs';
test('reconnecting restores a missing automatic Krea2 catalog without changing active LoRAs or prompts',()=>{
 const c={automatic:{id:'diffusion_models|krea.safetensors'},source:{prompt:{1:{class_type:'UNETLoader'}}},info:{modelFields:[{node:'1',key:'unet_name',name:'krea.safetensors'}]},prompt:'Keep this prompt',controls:{addedLoras:[{name:'detail.safetensors',on:true,strength:.65,clip:.55}]}},before=structuredClone(c.controls),inventory={models:[{id:c.automatic.id,family:'krea2'}],loras:[{name:'detail.safetensors',family:'krea2'},{name:'flux.safetensors',family:'flux1'}],supports:{lora:true,loraModelOnly:true}};
 assert.equal(restoreAutomaticCatalog(c,inventory),true);assert.equal(c.catalog.fields[0].family,'krea2');assert.equal(compatibility(c.catalog.fields[0].family,c.catalog.loras[0].family),'family-match');assert.equal(compatibility(c.catalog.fields[0].family,c.catalog.loras[1].family),'incompatible');assert.deepEqual(c.controls,before);assert.equal(c.prompt,'Keep this prompt');assert.equal(restoreAutomaticCatalog({...c,automatic:{id:'missing'}},inventory),false);
});
test('unlabelled native Krea2 LoRAs need matching structural pairs, not a suggestive name',()=>{
 const h={};for(const [part,input,output]of [['attn.wq',6144,6144],['attn.wk',6144,1536],['attn.wv',6144,1536],['attn.gate',6144,6144],['mlp.down',16384,6144]]){h['diffusion_model.blocks.14.'+part+'.lora_A.weight']={shape:[4,input]};h['diffusion_model.blocks.14.'+part+'.lora_B.weight']={shape:[output,4]};}assert.equal(headerProfile(h).family,'krea2');const mismatch=structuredClone(h);mismatch['diffusion_model.blocks.14.attn.wv.lora_B.weight'].shape[0]=4096;assert.equal(headerProfile(mismatch).family,null);assert.equal(headerProfile({...h,__metadata__:{'modelspec.architecture':'flux.1-dev'}}).conflict,true);assert.equal(headerProfile({__metadata__:{'modelspec.title':'Krea2 detail'}}).family,null);
});
test('H3 LoRAs with unhelpful metadata are recognized by four matching block pairs',()=>{
 for(const style of ['flat','native']){const h={__metadata__:{'modelspec.architecture':'mini-morty/lorax','ss_base_model_version':'unknown custom label'}},base=style==='flat'?'lora_unet_blocks_24_':'diffusion_model.blocks.24.',sep=style==='flat'?'_':'.';for(const [name,input,output]of [['attn'+sep+'qkv_proj',5376,21504],['attn'+sep+'out_proj',7168,5376],['mlp'+sep+'fc1',5376,28672],['mlp'+sep+'fc2',14336,5376]]){h[base+name+'.lora_down.weight']={shape:[16,input]};h[base+name+'.lora_up.weight']={shape:[output,16]};}assert.equal(headerProfile(h).family,'h3');const bad=structuredClone(h);bad[base+'mlp'+sep+'fc2.lora_up.weight'].shape[1]=32;assert.equal(headerProfile(bad).family,null);assert.equal(headerProfile({...h,__metadata__:{'modelspec.architecture':'flux.1'}}).conflict,true);}
 assert.equal(headerProfile({__metadata__:{'modelspec.title':'H3 motion'}}).family,null);
});
