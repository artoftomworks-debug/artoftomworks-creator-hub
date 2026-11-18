import test from 'node:test';
import assert from 'node:assert/strict';
import {samplingForModelChange} from '../automatic-ui.mjs';
test('model changes retain user numeric settings and source-only values, including zero CFG',()=>{
 const c={source:{},info:{sampling:{steps:12,cfg:0,denoise:.8,guidance:4,sampler:'euler',scheduler:'simple'}},controls:{sampling:{steps:8}}},before=structuredClone(c);
 assert.deepEqual(samplingForModelChange(c),{steps:8,cfg:0,denoise:.8,guidance:4,sampler:'euler',scheduler:'simple'});
 assert.deepEqual(samplingForModelChange(c,{steps:16,cfg:1.5,denoise:.9,guidance:5}),{steps:16,cfg:1.5,denoise:.9,guidance:5,sampler:'euler',scheduler:'simple'});
 assert.deepEqual(c,before);
});
test('sampler and scheduler preferences remain independent of numeric retention and first-model defaults',()=>{
 const c={controls:{sampling:{steps:8,cfg:1,sampler:'dpmpp_2m',scheduler:'karras'}},keepSampling:{sampler:false,scheduler:true}};
 assert.deepEqual(samplingForModelChange(c),{steps:8,cfg:1,scheduler:'karras'});
 c.keepSampling={sampler:true,scheduler:false};assert.deepEqual(samplingForModelChange(c),{steps:8,cfg:1,sampler:'dpmpp_2m'});
 assert.deepEqual(samplingForModelChange({controls:{loras:[]}},{steps:20,cfg:7}),{},'disabled placeholder values must not replace first-model defaults such as Turbo H3 CFG 1');
});
