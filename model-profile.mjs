import {metadataFamily} from './catalog.mjs';
// MiniMax H3: hidden=5376, attention inner=56*128, gated FFN=14336*2.
// Match a complete block's low-rank pairs in either native or flattened names.
function h3Structure(header,keys){
 const pair=(name,input,output)=>[['lora_down','lora_up'],['lora_A','lora_B']].some(([down,up])=>{const a=header[name+'.'+down+'.weight']?.shape,b=header[name+'.'+up+'.weight']?.shape;return a?.length===2&&b?.length===2&&a.every(Number.isSafeInteger)&&b.every(Number.isSafeInteger)&&a[0]>0&&a[0]<=4096&&a[1]===input&&b[0]===output&&b[1]===a[0];});
 for(const key of keys){const match=/^(.*blocks[._]\d+[._])attn([._])qkv_proj\.(?:lora_A|lora_down)\.weight$/.exec(key);if(match){const p=match[1],s=match[2];if(pair(p+'attn'+s+'qkv_proj',5376,21504)&&pair(p+'attn'+s+'out_proj',7168,5376)&&pair(p+'mlp'+s+'fc1',5376,28672)&&pair(p+'mlp'+s+'fc2',14336,5376))return true;}}
 return keys.some(k=>/blocks\.\d+\.attn\.qkv_proj\.weight$/.test(k)&&header[k]?.shape?.[0]===21504&&header[k]?.shape?.[1]===5376&&header[k.replace('attn.qkv_proj','mlp.fc1')]?.shape?.[0]===28672&&header[k.replace('attn.qkv_proj','mlp.fc2')]?.shape?.[1]===14336);
}
// Krea2's native block names and dimensions are defined by ComfyUI's
// comfy/ldm/krea2/model.py: 6144 features, 1536 K/V, gated 16384-wide MLP.
// Require matching low-rank pairs in one block; a filename is never evidence.
function krea2Lora(header,keys){
 const pair=(prefix,input,output)=>{for(const [down,up]of [['lora_A','lora_B'],['lora_down','lora_up']]){const a=header[prefix+'.'+down+'.weight']?.shape,b=header[prefix+'.'+up+'.weight']?.shape;if(a?.length===2&&b?.length===2&&a.every(Number.isSafeInteger)&&b.every(Number.isSafeInteger)&&a[0]>0&&a[0]<=4096&&a[1]===input&&b[0]===output&&b[1]===a[0])return true;}return false;};
 for(const key of keys){const match=/^(.*\bblocks\.\d+\.)attn\.wq\.(?:lora_A|lora_down)\.weight$/.exec(key);if(!match)continue;const b=match[1];if(pair(b+'attn.wq',6144,6144)&&pair(b+'attn.wk',6144,1536)&&pair(b+'attn.wv',6144,1536)&&pair(b+'attn.gate',6144,6144)&&pair(b+'mlp.down',16384,6144))return true;}return false;
}
// 0.17.1: LoRA-szerkezet felismerése a tenzorok nevéből és méretéből (kohya, diffusers és ComfyUI írásmód).
// A fájlba írt adatlap (ss_base_model_version, modelspec.architecture) gyakran hibás – a tartalom dönt.
export function loraStructure(header,keys){
 const any=re=>keys.some(k=>re.test(k));
 // Krea 2: kohya „lapos” írásmód (lora_unet_blocks_0_attn_wq) → a natív blocks.0.attn.wq alakra fordítva ugyanaz a szigorú méretpróba
 if(any(/^lora_unet_blocks_\d+_(attn|mlp)_/)){const flat={};for(const k of keys){const m=/^lora_unet_blocks_(\d+)_(attn|mlp)_([a-z0-9]+)\.(.+)$/.exec(k);flat[m?'blocks.'+m[1]+'.'+m[2]+'.'+m[3]+'.'+m[4]:k]=header[k];}if(krea2Lora(flat,Object.keys(flat)))return 'krea2';}
 if(any(/(^|\.)txtfusion\./)&&any(/lora/))return 'krea2';
 // MiniMax H3: már egyetlen MLP-pár is egyértelmű (5376 → 28672, 14336 → 5376) – a csúszkák csak néhány blokkot tanítanak
 for(const k of keys){const m=/^(.*blocks[._]\d+[._])mlp([._])fc1\.(lora_A|lora_down)\.weight$/.exec(k);if(!m)continue;const up=header[k.replace(/(lora_A|lora_down)\.weight$/,m[3]==='lora_A'?'lora_B.weight':'lora_up.weight')]?.shape,dn=header[k]?.shape;if(dn?.[1]===5376&&up?.[0]===28672)return 'h3';}
 if(any(/(^|[._])layers[._]\d+[._]proj[._]ffn_(up_gate|down)/))return 'moss';
 if(any(/(^|[._])double_blocks[._]\d+[._]img_attn/)||any(/(^|\.)lora_unet_(double|single)_blocks_\d+_/)||any(/(^|\.)single_transformer_blocks\.\d+\./)&&any(/(^|\.)transformer_blocks\.\d+\.(attn|ff_context|norm1_context)/))return 'flux1';
 if(any(/audio_to_video_attn|video_to_audio_attn|(^|\.)audio_attn1\./))return 'ltx';
 if(any(/(^|\.)layers\.\d+\.proj\.ffn_up_gate\.(lora|weight)/))return 'moss';
 const q=keys.find(k=>/(^|\.)transformer_blocks\.\d+\.attn1\.to_q\.(lora_A|lora_down|lora\.down)\.weight$/.test(k));
 if(q&&any(/(^|\.)transformer_blocks\.\d+\.attn2\./)&&!any(/(^|\.|_)(input|down)_blocks/)&&header[q]?.shape?.[1]===4096)return 'ltx';
 // UNet (SD 1.x / 2.x / SDXL): a keresztfigyelem to_k bemenete a szövegkódoló szélessége – 768 / 1024 / 2048.
 const cross=keys.find(k=>/attn2[._]to_k[._.](lora_down|lora_A|lora\.down)\.weight$/.test(k)||/attn2_to_k\.lora_down\.weight$/.test(k));
 const dim=cross?header[cross]?.shape?.[1]:null;
 if(dim===2048||any(/(^|\.)lora_te2_|(^|\.)text_encoder_2\./))return 'sdxl';
 if(dim===1024)return 'sd2';
 if(dim===768)return 'sd1';
 return null;
}
export function headerProfile(header={}){
 const keys=Object.keys(header).filter(k=>k!=='__metadata__'),has=part=>keys.some(k=>k.includes(part));
 const claimed=metadataFamily(header.__metadata__||{});let detected=null;
 if(h3Structure(header,keys))detected='h3';
 else if(has('audio_adaln_single.')&&has('transformer_blocks.0.audio_to_video_attn.')&&has('patchify_proj.'))detected='ltx';
 else if(has('shared_block_modulation.weight')&&has('layers.0.proj.ffn_up_gate.weight'))detected='moss';
 else if(has('txtfusion.')&&has('tmlp.')||krea2Lora(header,keys))detected='krea2';
 else if(has('double_blocks.0.img_attn.')&&has('single_blocks.0.'))detected='flux1';
 else if(has('conditioner.embedders.1.model.'))detected='sdxl';
 else {const cross=keys.find(k=>k.endsWith('input_blocks.1.1.transformer_blocks.0.attn2.to_k.weight'));const dim=header[cross]?.shape?.[1];if(dim===768)detected='sd1';else if(dim===1024)detected='sd2';else if(dim===2048)detected='sdxl';}
 if(!detected)detected=loraStructure(header,keys);
 /* 0.17.1: a tartalom (szerkezet) dönt; ha a fájl mást állít magáról, azt jelezzük (claimed / mismatch), de nem hiszünk neki */
 const family=detected||claimed,mismatch=!!(detected&&claimed&&detected!==claimed);
 const version=String(header.__metadata__?.model_version||'');return {family,detected,claimed,mismatch,conflict:mismatch,...(family==='ltx'&&detected==='ltx'&&/^2\.5(?:\.|$)/.test(version)?{variant:'ltx25'}:{}),embeddedClip:has('text_encoders.')||has('cond_stage_model.')||has('conditioner.embedders.'),embeddedVae:has('first_stage_model.decoder.')||has('vae.decoder.'),title:String(header.__metadata__?.['modelspec.title']||'')};
}

