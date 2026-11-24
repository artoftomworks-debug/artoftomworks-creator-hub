import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticSamplingDefaults,selectionSampling,migrateSampling,samplingProfileKey,saveSamplingProfile,cleanSampling} from '../sampling-policy.mjs';
const flux={family:'flux1'},krea={family:'krea2'};
test('unseen model starts with native pair and its own step count (0.16+: steps belong to the model), and does not inherit another family sampler',()=>{
 const sampling={steps:32,cfg:7,sampler:'lcm',scheduler:'karras',denoise:.25};
 const s=selectionSampling({sampling,model:flux,previousFamily:'sdxl'});assert.equal(s.steps,automaticSamplingDefaults(flux).steps);assert.equal(s.cfg,1);assert.equal(s.sampler,'euler');assert.equal(s.scheduler,'normal');assert.equal(s.denoise,1);
 assert.equal(selectionSampling({sampling,model:flux,previousFamily:'sdxl',useImage:true}).denoise,.25);
 assert.deepEqual(selectionSampling({sampling,model:flux,policy:'manual'}),{...automaticSamplingDefaults(flux),...sampling});
});

test('MOSS starts at CFG 1 and preserves user CFG values through exact model profiles',()=>{
 const moss={family:'moss'};assert.equal(automaticSamplingDefaults(moss).cfg,1);
 for(const cfg of [1,1.5,2]){const state={},key='moss';saveSamplingProfile(state,key,{steps:8,cfg,sampler:'euler',scheduler:'simple',denoise:1});const values=selectionSampling({model:moss,profile:state.modelSamplingProfiles[key],sampling:{cfg:7,steps:40},previousFamily:'sdxl'});assert.equal(values.cfg,cfg);assert.equal(values.steps,8);}
 assert.equal(selectionSampling({model:moss,profile:{sampling:{cfg:3,steps:8}}}).cfg,1);
 assert.equal(selectionSampling({model:moss,policy:'manual',sampling:{cfg:3,steps:8}}).cfg,3);
});

test('MOSS CFG baseline upgrade changes only the old 3 and never replays old card recommendations',()=>{
 for(const cfg of [1,1.5,2,3]){const c={modelSamplingVersion:1,modelSamplingPolicy:'remember',controls:{sampling:{cfg,steps:8,sampler:'euler',scheduler:'simple'}},modelRecommendation:{values:{steps:8,cfg:1}}};const changed=migrateSampling(c,{family:'moss'});assert.equal(changed,cfg===3);assert.equal(c.controls.sampling.cfg,cfg===3?1:cfg);assert.equal(c.controls.sampling.steps,8);c.controls.sampling.cfg=3;assert.equal(migrateSampling(c,{family:'moss'}),false);assert.equal(c.controls.sampling.cfg,3);}
 const c={modelSamplingVersion:1,modelSamplingPolicy:'manual',controls:{sampling:{cfg:3,steps:8}}};assert.equal(migrateSampling(c,{family:'moss'}),false);assert.equal(c.controls.sampling.cfg,3);
});
test('exact model/backend/mode profiles restore values and invalid numeric fields cannot poison settings',()=>{
 const state={},key=samplingProfileKey('http://127.0.0.1:8188/','image','diffusion_models|krea.safetensors');
 saveSamplingProfile(state,key,{steps:11,cfg:1,sampler:'euler',scheduler:'simple',denoise:1});
 const saved=JSON.parse(JSON.stringify(state)).modelSamplingProfiles[key];const s=selectionSampling({sampling:{steps:40},model:krea,profile:saved});assert.equal(s.steps,11);assert.equal(s.scheduler,'simple');
 assert.notEqual(key,samplingProfileKey('http://127.0.0.1:8189','image','diffusion_models|krea.safetensors'));assert.notEqual(key,samplingProfileKey('http://127.0.0.1:8188','video','diffusion_models|krea.safetensors'));
 assert.deepEqual(cleanSampling({steps:NaN,cfg:-3,denoise:0,guidance:Infinity,sampler:'euler'}),{sampler:'euler'});
 for(let i=0;i<150;i++)saveSamplingProfile(state,'other'+i,{steps:20});assert.equal(Object.keys(state.modelSamplingProfiles).length,128);
});
test('legacy inferred card values are repaired once without discarding user changes or explicit manual settings',()=>{
 const c={modelSamplingPolicy:'card',controls:{sampling:{steps:6,cfg:1,sampler:'lcm',scheduler:'karras',denoise:1}},modelRecommendation:{kind:'examples',values:{steps:6,cfg:1,sampler:'lcm',scheduler:'karras'}}};
 assert.equal(migrateSampling(c,flux),true);assert.equal(c.controls.sampling.steps,20);assert.equal(c.controls.sampling.sampler,'euler');assert.equal(c.controls.sampling.scheduler,'normal');assert.equal(c.modelSamplingPolicy,'remember');
 c.controls.sampling.steps=6;assert.equal(migrateSampling(c,flux),false);assert.equal(c.controls.sampling.steps,6);
 const custom={controls:{sampling:{steps:31,scheduler:'simple'}},modelRecommendation:{values:{steps:6,scheduler:'beta'}}};assert.equal(migrateSampling(custom,krea),false);assert.equal(custom.controls.sampling.steps,31);assert.equal(custom.controls.sampling.scheduler,'simple');
 const manual={modelSamplingPolicy:'manual',controls:{sampling:{steps:6,sampler:'lcm',scheduler:'karras'}},modelRecommendation:{values:{steps:6,sampler:'lcm',scheduler:'karras'}}};assert.equal(migrateSampling(manual,flux),false);assert.equal(manual.controls.sampling.sampler,'lcm');
 const stale={controls:{sampling:{steps:6,sampler:'lcm',scheduler:'karras'}},modelRecommendation:{values:{steps:6,sampler:'euler',scheduler:'beta'}}};assert(migrateSampling(stale,flux));assert.equal(stale.controls.sampling.steps,20);assert.equal(stale.controls.sampling.sampler,'euler');assert.equal(stale.controls.sampling.scheduler,'normal');
});
