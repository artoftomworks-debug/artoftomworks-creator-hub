// 0.16 DEV — karakter-hűség (PuLID-Flux)
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {identityImageNodes,inspectRenderSource,compileRenderShot} from '../workflow.mjs';
import {createCharacterPack,allowedURL,PACK,uploadCharacter} from '../character-pack.mjs';
import {createAutomatic} from '../automatic.mjs';
const graph=()=>({prompt:{
 '1':{class_type:'UNETLoader',inputs:{unet_name:'flux_dev.safetensors',weight_dtype:'default'}},
 '2':{class_type:'DualCLIPLoader',inputs:{clip_name1:'clip_l.safetensors',clip_name2:'t5.safetensors',type:'flux'}},
 '3':{class_type:'VAELoader',inputs:{vae_name:'ae.safetensors'}},
 '4':{class_type:'LoadImage',inputs:{image:'CreatorHub/character-0123456789abcdef.jpg'}},
 '5':{class_type:'ApplyPulidFlux',inputs:{model:['1',0],pulid_flux:['6',0],eva_clip:['7',0],face_analysis:['8',0],image:['4',0],weight:1,start_at:0,end_at:1,fusion:'mean',fusion_weight_max:1,fusion_weight_min:0,train_step:1000,use_gray:true}},
 '6':{class_type:'PulidFluxModelLoader',inputs:{pulid_file:'pulid_flux_v0.9.1.safetensors'}},'7':{class_type:'PulidFluxEvaClipLoader',inputs:{}},'8':{class_type:'PulidFluxInsightFaceLoader',inputs:{provider:'CPU'}},
 '9':{class_type:'CLIPTextEncode',inputs:{clip:['2',0],text:''}},'10':{class_type:'CLIPTextEncode',inputs:{clip:['2',0],text:''}},'11':{class_type:'FluxGuidance',inputs:{conditioning:['9',0],guidance:3.5}},
 '12':{class_type:'EmptySD3LatentImage',inputs:{width:1024,height:1024,batch_size:1}},
 '13':{class_type:'KSampler',inputs:{model:['5',0],seed:42,steps:20,cfg:1,sampler_name:'euler',scheduler:'simple',positive:['11',0],negative:['10',0],latent_image:['12',0],denoise:1}},
 '14':{class_type:'VAEDecode',inputs:{samples:['13',0],vae:['3',0]}},'15':{class_type:'SaveImage',inputs:{images:['14',0],filename_prefix:'x'}}}});
test('reference face LoadImage is not the start image',()=>{const g=graph();assert.deepEqual([...identityImageNodes(g.prompt)],['4']);const info=inspectRenderSource(g);assert.equal(info.needsImage,false);
 const out=compileRenderShot(g,{prompt:'a woman',negative:'',width:832,height:1216,output:info.output,controls:{seed:7}},null,'P');assert.equal(out.prompt['4'].inputs.image,'CreatorHub/character-0123456789abcdef.jpg');assert.equal(out.prompt['12'].inputs.width,832);});
test('a LoadImage feeding both PuLID and the sampler path stays a start image',()=>{const g=graph();g.prompt['12']={class_type:'VAEEncode',inputs:{pixels:['4',0],vae:['3',0]}};assert.equal(identityImageNodes(g.prompt).size,0);assert.equal(inspectRenderSource(g).needsImage,true);});
test('download sources are pinned to Hugging Face',()=>{assert.equal(PACK.length,6);for(const f of PACK)assert.ok(allowedURL(f.url));assert.ok(allowedURL('https://cas-bridge.xethub.hf.co/x'));assert.throws(()=>allowedURL('https://evil.example/x'));assert.throws(()=>allowedURL('http://huggingface.co/x'));});
test('pack status: missing files, then ready when sizes match',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'cp-'));const engine={status:async()=>({backend:'http://c',config:{directory:dir}})};
 const objects={ApplyPulidFlux:{},PulidFluxModelLoader:{},PulidFluxEvaClipLoader:{},PulidFluxInsightFaceLoader:{},UNETLoader:{input:{required:{unet_name:[['flux_dev.safetensors']]}}}};
 const pack=createCharacterPack({engine,getObjects:async()=>objects});let s=await pack.status();assert.equal(s.ready,false);assert.equal(s.nodes,true);assert.equal(s.flux,true);assert.equal(s.missingBytes,s.totalBytes);
 for(const f of PACK){const p=path.join(dir,'models',...f.dir);await mkdir(p,{recursive:true});const h=await (await import('node:fs/promises')).open(path.join(p,f.name),'w');await h.truncate(f.size);await h.close();}
 s=await pack.status();assert.equal(s.ready,true);assert.equal(s.missingBytes,0);});
test('reference upload uses a content-addressed name',async()=>{let sent;const fetchImpl=async(url,o)=>{sent=o.body.get('image').name;return new Response(JSON.stringify({name:sent,subfolder:'CreatorHub',type:'input'}));};
 const p=await uploadCharacter('http://c','data:image/png;base64,iVBORw0KGgo=',fetchImpl);assert.match(p,/^CreatorHub\/character-[a-f0-9]{16}\.png$/);assert.equal(p,'CreatorHub/'+sent);
 await assert.rejects(uploadCharacter('http://c','data:text/plain;base64,AAAA',fetchImpl));});
test('non-Flux model with a character gives a clear message',async()=>{const objects={CheckpointLoaderSimple:{input:{required:{ckpt_name:[['sdxl.safetensors']]}}},LoraLoader:{input:{required:{lora_name:[[]]}}},KSampler:{input:{required:{sampler_name:[['euler']],scheduler:[['normal']]}}}};
 const fetchImpl=async()=>new Response(JSON.stringify({'modelspec.architecture':'stable-diffusion-xl-v1-base'}));const auto=createAutomatic({getObjects:async()=>objects,fetchImpl,library:{state:async()=>null,list:async()=>({items:[],pages:1})}});
 const inv=await auto.list('http://c',true);const m=inv.models.find(x=>x.name==='sdxl.safetensors');assert.equal(m?.status,'ready',m?.reason);
 await assert.rejects(auto.build('http://c',{id:m.id,width:1024,height:1024,characterPath:'CreatorHub/character-0123456789abcdef.png'}),/Flux 1/);});
