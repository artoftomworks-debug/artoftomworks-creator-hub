// 0.16 DEV — ComfyUI V3 widget formats (COMBO, 'FLOAT,INT' + widgetType, DynamicCombo, autogrow)
// in UI-workflow import. Object shapes copied from the user's ComfyUI 0.46 /object_info.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {realObjects} from './fixtures/real_object_info_subset.mjs';
import {uiToBundle,inspectRenderSource} from '../workflow.mjs';
import {validateSampling} from '../automatic.mjs';
const F=fileURLToPath(new URL('./fixtures/ltx_two_stage_global.ui.json',import.meta.url));
const bundle=()=>uiToBundle(JSON.parse(readFileSync(F,'utf8')),realObjects([F]));
test('COMBO widgets are kept (sampler, upscaler model)',()=>{const p=bundle().prompt;
 assert.equal(p['417'].inputs.sampler_name,'euler_ancestral');assert.equal(p['441'].inputs.sampler_name,'euler_ancestral');
 assert.equal(p['421'].inputs.model_name,'ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors');});
test('DynamicCombo becomes flat dotted keys',()=>{const p=bundle().prompt;
 assert.deepEqual(p['428'].inputs,{input:['395',0],resize_type:'scale longer dimension','resize_type.longer_size':1536,scale_method:'lanczos'});
 assert.equal(p['75'].inputs.format,'auto');assert.equal(p['75'].inputs['format.codec'],'auto');});
test('typed-union widget keeps the widget slot (audio batch_size stays 1)',()=>{assert.equal(bundle().prompt['425'].inputs.batch_size,1);});
test('optional widget missing from an older saved node is not shifted',()=>{const i=bundle().prompt['446'].inputs;assert.equal(i.codec,'none');assert.equal(i.chroma_subsampling,undefined);assert.equal(i.color_space,'sRGB');});
test('inspect reads sampler and fps',()=>{const info=inspectRenderSource(bundle());assert.equal(info.sampling.sampler,'euler_ancestral');assert.equal(info.fps,24);assert.equal(info.twoStage,true);});
test('sampling check: imported LTX without scheduler passes in partial mode only',()=>{const s={steps:20,cfg:1,denoise:1,guidance:3.5,sampler:'euler_ancestral'},o={samplers:['euler_ancestral'],schedulers:['simple']};
 assert.doesNotThrow(()=>validateSampling(s,o,{partial:true}));assert.throws(()=>validateSampling(s,o));
 assert.throws(()=>validateSampling({...s,sampler:'nope'},o,{partial:true}));});
