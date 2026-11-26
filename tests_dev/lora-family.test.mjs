import test from 'node:test';import assert from 'node:assert/strict';
import {headerProfile} from '../model-profile.mjs';
test('0.17.1: Flux LoRA kohya/diffusers kulcsnevekkel – a hibás beágyazott „sd_1.5” metaadat ellenére is Flux',()=>{
 const kohya={__metadata__:{ss_base_model_version:'sd_1.5'},'lora_unet_double_blocks_0_img_attn_qkv.lora_down.weight':{shape:[64,3072]},'lora_unet_single_blocks_0_linear1.lora_down.weight':{shape:[64,3072]}};
 assert.equal(headerProfile(kohya).family,'flux1');assert.equal(headerProfile(kohya).mismatch,true);assert.equal(headerProfile(kohya).claimed,'sd1');
 const diff={'transformer.single_transformer_blocks.0.attn.to_q.lora_A.weight':{shape:[16,3072]},'transformer.transformer_blocks.0.attn.to_q.lora_A.weight':{shape:[16,3072]}};
 assert.equal(headerProfile(diff).family,'flux1');
 const sd1={__metadata__:{ss_base_model_version:'sd_1.5'},'lora_unet_down_blocks_0_attentions_0_proj_in.lora_down.weight':{shape:[8,320]}};
 assert.equal(headerProfile(sd1).family,'sd1');
});
test('0.17.1: UNet LoRA-k a keresztfigyelem szélességéből (SD1 768 / SD2 1024 / SDXL 2048), LTX és MOSS LoRA felismerés',()=>{
 const k=(d)=>({'lora_unet_down_blocks_1_attentions_0_transformer_blocks_0_attn2_to_k.lora_down.weight':{shape:[16,d]}});
 assert.equal(headerProfile(k(768)).family,'sd1');assert.equal(headerProfile(k(1024)).family,'sd2');assert.equal(headerProfile(k(2048)).family,'sdxl');
 assert.equal(headerProfile({'unet.down_blocks.1.attentions.0.transformer_blocks.0.attn2.to_k.lora_A.weight':{shape:[8,2048]},__metadata__:{ss_base_model_version:'sd_v1'}}).family,'sdxl');
 assert.equal(headerProfile({'lora_te2_text_model_encoder_layers_0_mlp_fc1.lora_down.weight':{shape:[8,1280]}}).family,'sdxl');
 assert.equal(headerProfile({'diffusion_model.transformer_blocks.3.audio_attn1.to_q.lora_A.weight':{shape:[8,2048]}}).family,'ltx');
 assert.equal(headerProfile({'diffusion_model.transformer_blocks.0.attn1.to_q.lora_A.weight':{shape:[16,4096]},'diffusion_model.transformer_blocks.0.attn2.to_k.lora_A.weight':{shape:[16,4096]}}).family,'ltx');
 assert.equal(headerProfile({'diffusion_model.layers.3.proj.ffn_up_gate.lora_A.weight':{shape:[8,3072]}}).family,'moss');
 assert.equal(headerProfile({'foo.bar.lora_A.weight':{shape:[4,10]},__metadata__:{ss_base_model_version:'sdxl_base_v1-0'}}).family,'sdxl');
});
