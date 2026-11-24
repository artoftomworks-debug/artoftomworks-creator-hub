// Real ComfyUI 0.46 /object_info shapes (copied from the user's running ComfyUI, 2026-11-22),
// overlaid on the synthetic catalogue so tests see COMBO / DynamicCombo / autogrow exactly like production.
import {synthObjects} from './synth_object_info.mjs';
const C=o=>['COMBO',{multiselect:false,options:o}];
const scale=(k,inputs)=>({key:k,inputs:{required:inputs}});
const codecAuto={key:'auto',inputs:{required:{}}};
const encoding=crf=>({optional:{encoding:['COMFY_DYNAMICCOMBO_V3',{options:[{key:'auto',inputs:{required:{}}},{key:'re-encode',inputs:{required:{crf:['FLOAT',{default:crf,min:0,max:63,step:1}]}}}]}]}});
const codecMp4=['COMFY_DYNAMICCOMBO_V3',{options:[codecAuto,{key:'h264',inputs:{required:{},...encoding(18)}},{key:'av1',inputs:{required:{},...encoding(24)}}]}];
const codecAll=['COMFY_DYNAMICCOMBO_V3',{options:[codecAuto,{key:'h264',inputs:{required:{},...encoding(18)}},{key:'av1',inputs:{required:{},...encoding(24)}},{key:'prores',inputs:{required:{}}}]}];
export const REAL={
 KSamplerSelect:{input:{required:{sampler_name:C(['euler','euler_ancestral','res_multistep'])}},input_order:{required:['sampler_name']}},
 LatentUpscaleModelLoader:{input:{required:{model_name:C(['ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors'])}},input_order:{required:['model_name']}},
 ComfyMathExpression:{input:{required:{expression:['STRING',{default:'a + b',multiline:true}],values:['COMFY_AUTOGROW_V3',{template:{input:{required:{value:['FLOAT,INT,BOOLEAN',{}]}}},names:'abcdefghijklmnopqrstuvwxyz'.split(''),min:1}]}},input_order:{required:['expression','values']}},
 LTXVEmptyLatentAudio:{input:{required:{frames_number:['INT',{default:97,min:1,max:1000}],frame_rate:['FLOAT,INT',{default:25,widgetType:'FLOAT',min:1,max:1000}],batch_size:['INT',{default:1,min:1,max:4096}],audio_vae:['VAE',{}]}},input_order:{required:['frames_number','frame_rate','batch_size','audio_vae']}},
 CreateVideo:{input:{required:{images:['IMAGE',{}],fps:['FLOAT',{default:30,min:1,max:120,step:1}]},optional:{audio:['AUDIO',{}],bit_depth:['COMBO',{default:'auto',options:['auto',8,10]}],color_space:C(['sRGB','HDR','HDR PQ']),chroma_subsampling:C(['auto','444','422','420','none']),codec:['COMBO',{advanced:true,default:'none',options:['none','auto','h264','av1','prores']}]}},input_order:{required:['images','fps'],optional:['audio','bit_depth','color_space','chroma_subsampling','codec']}},
 ResizeImageMaskNode:{input:{required:{input:['COMFY_MATCHTYPE_V3',{template:{template_id:'input_type',allowed_types:'IMAGE,MASK'}}],resize_type:['COMFY_DYNAMICCOMBO_V3',{options:[
   scale('scale dimensions',{width:['INT',{default:512,min:0,max:16384}],height:['INT',{default:512,min:0,max:16384}],crop:C(['disabled','center'])}),
   scale('scale by multiplier',{multiplier:['FLOAT',{default:1,min:0.01,max:8}]}),
   scale('scale longer dimension',{longer_size:['INT',{default:512,min:0,max:16384}]}),
   scale('scale shorter dimension',{shorter_size:['INT',{default:512,min:0,max:16384}]}),
   scale('scale to multiple',{multiple:['INT',{default:8,min:1,max:16384}]})]}],
   scale_method:C(['nearest-exact','bilinear','area','bicubic','lanczos'])}},input_order:{required:['input','resize_type','scale_method']}},
 SaveVideo:{input:{required:{video:['VIDEO',{}],filename_prefix:['STRING',{default:'video/ComfyUI'}],format:['COMFY_DYNAMICCOMBO_V3',{options:[
   {key:'auto',inputs:{required:{codec:codecAll}}},{key:'mp4',inputs:{required:{codec:codecMp4}}},{key:'webm',inputs:{required:{codec:['COMFY_DYNAMICCOMBO_V3',{options:[codecAuto,{key:'av1',inputs:{required:{},...encoding(24)}}]}]}}},{key:'mov',inputs:{required:{codec:['COMFY_DYNAMICCOMBO_V3',{options:[{key:'prores',inputs:{required:{}}}]}]}}}]}]},
   optional:{codec:['COMFY_DYNAMICCOMBO_V3',{hidden:true,options:[codecAuto,{key:'h264',inputs:{required:{},...encoding(18)}},{key:'av1',inputs:{required:{},...encoding(24)}},{key:'prores',inputs:{required:{}}}]}]}},
   input_order:{required:['video','filename_prefix','format'],optional:['codec']}},
 PrimitiveInt:{input:{required:{value:['INT',{min:-9e18,max:9e18,control_after_generate:'fixed'}]}},input_order:{required:['value']}},
 RandomNoise:{input:{required:{noise_seed:['INT',{default:0,min:0,max:18446744073709552000,control_after_generate:true}]}},input_order:{required:['noise_seed']}},
};
export function realObjects(files){return {...synthObjects(files),...REAL};}
