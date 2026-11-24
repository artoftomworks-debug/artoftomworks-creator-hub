// 0.16 DEV — automatikus modellbeállítások és Próbasor
import test from 'node:test';import assert from 'node:assert/strict';
import {automaticSamplingDefaults,nameHints,trialSteps,isSettled,saveSamplingProfile,SAMPLING_POLICY_VERSION} from '../sampling-policy.mjs';
import {trialStepOf} from '../model-trial-ui.mjs';
test('file-name hints: explicit N steps, lightning/turbo, schnell; known profiles win',()=>{
 assert.equal(nameHints({family:'sdxl',name:'dreamshaperXL 8steps.safetensors'}).steps,8);
 assert.deepEqual(nameHints({family:'sdxl',name:'juggernautXL_v9Lightning'}),{steps:8,cfg:2});
 assert.equal(nameHints({family:'flux1',name:'flux1-schnell-fp8'}).steps,4);assert.equal(nameHints({family:'flux1',name:'flux1-schnell-fp8'}).cfg,undefined);
 assert.deepEqual(nameHints({family:'sdxl',name:'realvisxl_v5'}),{});
 assert.equal(automaticSamplingDefaults({family:'moss',name:'Realism By Stable Yogi Moss V2.0'}).steps,6);
 assert.equal(automaticSamplingDefaults({family:'sdxl',name:'plain_model'}).steps,20);});
test('trial steps around the starting value',()=>{assert.deepEqual(trialSteps(8),[4,8,12,16]);assert.deepEqual(trialSteps(20),[10,20,30]);assert.deepEqual(trialSteps(6),[3,6,9,12]);});
test('settled: tested, manual, dismissed or own step count; a fresh default profile is not',()=>{const d={steps:20};
 assert.equal(isSettled(null,d),false);assert.equal(isSettled({sampling:{steps:20},version:SAMPLING_POLICY_VERSION},d),false);
 assert.equal(isSettled({sampling:{steps:10},version:SAMPLING_POLICY_VERSION},d),true);assert.equal(isSettled({sampling:{steps:20},tested:true},d),true);assert.equal(isSettled({sampling:{steps:20},dismissed:true},d),true);});
test('profile flags survive later saves',()=>{const st={};saveSamplingProfile(st,'k',{steps:8},{},{tested:true});saveSamplingProfile(st,'k',{steps:9},{});assert.equal(st.modelSamplingProfiles.k.tested,true);assert.equal(st.modelSamplingProfiles.k.sampling.steps,9);});
test('trial project name → step value',()=>{assert.equal(trialStepOf('Próbasor · Moss · 16:40 · 8 lépés','Próbasor · Moss · 16:40'),8);assert.equal(trialStepOf('Más projekt','Próbasor · Moss · 16:40'),null);});
