// 0.16 DEV — a video model visible in both diffusion_models and checkpoints appears once (the working entry).
import test from 'node:test';import assert from 'node:assert/strict';
import {createAutomatic} from '../automatic.mjs';
const F='DasiwaMinimaxH3_dasiwaHybridV4Turbo_3281858.safetensors';
const objects={CheckpointLoaderSimple:{input:{required:{ckpt_name:[[F,'sdxl_only.safetensors']]}}},UNETLoader:{input:{required:{unet_name:[[F]]}}},
 CLIPLoader:{input:{required:{clip_name:[['qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors']],type:[['minimax']]}}},VAELoader:{input:{required:{vae_name:[['minimax_h3_video_vae_int8_convrot.safetensors','minimax_h3_audio_vae_fp32.safetensors']]}}},LoraLoader:{input:{required:{lora_name:[[]]}}}};
const fetchImpl=async url=>{const name=new URL(url).searchParams.get('filename');return new Response(JSON.stringify(name===F?{'modelspec.architecture':'minimax-h3'}:{'modelspec.architecture':'stable-diffusion-xl-v1-base'}));};
const library={state:async()=>null,list:async()=>({items:[],pages:1})};
test('checkpoint-branch twin of a working H3 model is hidden; other checkpoints stay',async()=>{
 const auto=createAutomatic({getObjects:async()=>objects,fetchImpl,library});const inv=await auto.list('http://c',true);
 const entries=inv.models.filter(m=>m.name===F);assert.equal(entries.length,1);assert.equal(entries[0].type,'UNETLoader');
 assert.ok(inv.models.some(m=>m.name==='sdxl_only.safetensors'));});
