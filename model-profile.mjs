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
export function headerProfile(header={}){
 const keys=Object.keys(header).filter(k=>k!=='__metadata__'),has=part=>keys.some(k=>k.includes(part));
 let family=metadataFamily(header.__metadata__||{}),detected=null;
 if(h3Structure(header,keys))detected='h3';
 else if(has('audio_adaln_single.')&&has('transformer_blocks.0.audio_to_video_attn.')&&has('patchify_proj.'))detected='ltx';
 else if(has('shared_block_modulation.weight')&&has('layers.0.proj.ffn_up_gate.weight'))detected='moss';
 else if(has('txtfusion.')&&has('tmlp.')||krea2Lora(header,keys))detected='krea2';
 else if(has('double_blocks.0.img_attn.')&&has('single_blocks.0.'))detected='flux1';
 else if(has('conditioner.embedders.1.model.'))detected='sdxl';
 else {const cross=keys.find(k=>k.endsWith('input_blocks.1.1.transformer_blocks.0.attn2.to_k.weight'));const dim=header[cross]?.shape?.[1];if(dim===768)detected='sd1';else if(dim===1024)detected='sd2';else if(dim===2048)detected='sdxl';}
 if(family&&detected&&family!==detected)return {family:null,conflict:true};
 family||=detected;
 const version=String(header.__metadata__?.model_version||'');return {family,...(family==='ltx'&&detected==='ltx'&&/^2\.5(?:\.|$)/.test(version)?{variant:'ltx25'}:{}),embeddedClip:has('text_encoders.')||has('cond_stage_model.')||has('conditioner.embedders.'),embeddedVae:has('first_stage_model.decoder.')||has('vae.decoder.'),title:String(header.__metadata__?.['modelspec.title']||'')};
}
