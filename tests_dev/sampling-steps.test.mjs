// 0.16 DEV — the step count follows the selected model (no carry-over from the previous model).
import test from 'node:test';import assert from 'node:assert/strict';
import {automaticSamplingDefaults,selectionSampling,migrateSampling,saveSamplingProfile,SAMPLING_POLICY_VERSION} from '../sampling-policy.mjs';
const dasiwa={id:'diffusion_models|DasiwaMinimaxH3_dasiwaHybridV4Turbo_3281858.safetensors',name:'DasiwaMinimaxH3_dasiwaHybridV4Turbo_3281858.safetensors',title:'',family:'h3'};
const eros={id:'diffusion_models|h3ErosMax_beta5_3185144.safetensors',name:'h3ErosMax_beta5_3185144.safetensors',title:'',family:'h3'};
const h3plain={id:'x|minimax_h3_base.safetensors',name:'minimax_h3_base.safetensors',title:'',family:'h3'};
const ltx={id:'diffusion_models|ltx25FP8Comfyui_v10.safetensors',name:'ltx25FP8Comfyui_v10.safetensors',title:'',family:'ltx'};
test('Turbo is recognised from the file name even without an embedded title',()=>{assert.equal(automaticSamplingDefaults(dasiwa).steps,8);assert.equal(automaticSamplingDefaults(h3plain).steps,20);});
test('Eros Max gets its proven 6 steps with res_multistep',()=>{const d=automaticSamplingDefaults(eros);assert.equal(d.steps,6);assert.equal(d.sampler,'res_multistep');});
test('LTX (20 steps) → DaSiWa Turbo: 8 steps, not 20',()=>{const v=selectionSampling({sampling:{steps:20,cfg:1,sampler:'euler',scheduler:'simple',denoise:1},model:dasiwa,previousFamily:'ltx',mode:'video'});assert.equal(v.steps,8);});
test('DaSiWa Turbo → Eros Max (same family): 6 steps and its own sampler',()=>{const v=selectionSampling({sampling:{steps:8,sampler:'euler',scheduler:'simple'},model:eros,previousFamily:'h3',mode:'video'});assert.equal(v.steps,6);assert.equal(v.sampler,'res_multistep');});
test('an old (v2) profile with carried-over steps is ignored for steps only',()=>{const v=selectionSampling({model:dasiwa,previousFamily:'ltx',profile:{version:2,sampling:{steps:20,cfg:1.5}},mode:'video'});assert.equal(v.steps,8);assert.equal(v.cfg,1.5);});
test('a step count the user saved with the new version is respected',()=>{const state={};saveSamplingProfile(state,'k',{steps:10,cfg:1});const profile=state.modelSamplingProfiles.k;assert.equal(profile.version,SAMPLING_POLICY_VERSION);
 const v=selectionSampling({model:dasiwa,previousFamily:'ltx',profile,mode:'video'});assert.equal(v.steps,10);});
test('migration of the current plan: DaSiWa with 20 steps becomes 8 once, with a notice',()=>{const c={modelSamplingVersion:2,modelSamplingPolicy:'remember',automatic:{id:dasiwa.id},controls:{sampling:{steps:20,cfg:1}}};
 assert.equal(migrateSampling(c,dasiwa),true);assert.equal(c.controls.sampling.steps,8);assert.match(c.samplingPolicyNotice,/20 → 8/);assert.equal(migrateSampling(c,dasiwa),false);});
test('manual policy is never changed',()=>{const c={modelSamplingVersion:2,modelSamplingPolicy:'manual',controls:{sampling:{steps:20}}};assert.equal(migrateSampling(c,dasiwa),false);assert.equal(c.controls.sampling.steps,20);});
test('LTX keeps 20 steps',()=>{assert.equal(automaticSamplingDefaults(ltx).steps,20);});
