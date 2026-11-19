import test from 'node:test';import assert from 'node:assert/strict';
import {effectiveSampling,syncSamplingOverrides,toggleSamplingOverride,saveSamplingProfile} from '../sampling-policy.mjs';
import {applyControls,inspectRenderSource} from '../workflow.mjs';
import {createAutomatic} from '../automatic.mjs';import {picture,fakeBackend} from './fixtures.mjs';
test('sampler/scheduler switches are independent, keep custom choices, and serialize with model profiles',()=>{
 const c={sampling:{steps:8,cfg:1,sampler:'dpmpp_2m',scheduler:'karras'}};const base={sampler:'euler',scheduler:'simple'};
 syncSamplingOverrides(c,base);toggleSamplingOverride(c,'sampler',false,base);assert.equal(c.sampling.sampler,'euler');assert.equal(c.sampling.scheduler,'karras');assert.equal(c.samplingChoices.sampler,'dpmpp_2m');
 toggleSamplingOverride(c,'scheduler',false,base);assert.equal(c.sampling.scheduler,'simple');toggleSamplingOverride(c,'sampler',true,base);assert.equal(c.sampling.sampler,'dpmpp_2m');assert.equal(c.sampling.scheduler,'simple');assert.equal(c.sampling.steps,8);
 const state={};saveSamplingProfile(state,'model',c.sampling,c);const profile=JSON.parse(JSON.stringify(state)).modelSamplingProfiles.model;assert.equal(profile.overrides.scheduler,false);assert.equal(profile.choices.scheduler,'karras');
 const restored={sampling:profile.sampling,samplingOverrides:profile.overrides,samplingChoices:profile.choices};toggleSamplingOverride(restored,'scheduler',true,base);assert.equal(restored.sampling.scheduler,'karras');
 assert.deepEqual(effectiveSampling({sampler:'missing',scheduler:'karras'},base,{sampler:false}),{sampler:'euler',scheduler:'karras'});
});
test('workflow switches OFF preserve original sampler fields while ON explicitly overrides them',()=>{
 const raw=structuredClone(picture);Object.assign(raw.prompt['6'].inputs,{sampler_name:'dpmpp_2m',scheduler:'karras'});
 const info=inspectRenderSource(raw);
 const off=applyControls(raw,info,{sampling:{sampler:'missing',scheduler:'missing',steps:31},samplingOverrides:{sampler:false,scheduler:false}}).prompt;
 assert.equal(off['6'].inputs.sampler_name,'dpmpp_2m');assert.equal(off['6'].inputs.scheduler,'karras');assert.equal(off['6'].inputs.steps,31);
 const mixed=applyControls(raw,info,{sampling:{sampler:'euler',scheduler:'simple'},samplingOverrides:{sampler:false,scheduler:true}}).prompt;assert.equal(mixed['6'].inputs.sampler_name,'dpmpp_2m');assert.equal(mixed['6'].inputs.scheduler,'simple');
 assert.equal(raw.prompt['6'].inputs.scheduler,'karras');
});
test('automatic backend ignores disabled custom fields before validation and compiles the actual values',async()=>{
 const fake=fakeBackend(),auto=createAutomatic({getObjects:async()=>fake.objects,fetchImpl:fake.fetchImpl,library:{list:async()=>({items:[],pages:1}),detail:async()=>({})}});
 const off=await auto.build('http://127.0.0.1:7821',{id:'checkpoints|fixture.safetensors',sampling:{steps:19,sampler:'missing',scheduler:'missing'},controls:{samplingOverrides:{sampler:false,scheduler:false}}});assert.equal(off.sampling.sampler,'euler');assert.equal(off.sampling.scheduler,'normal');assert.equal(inspectRenderSource(off.source).sampling.steps,19);
 const mixed=await auto.build('http://127.0.0.1:7821',{id:'checkpoints|fixture.safetensors',sampling:{sampler:'dpmpp_2m',scheduler:'missing'},samplingOverrides:{sampler:true,scheduler:false}});assert.equal(mixed.sampling.sampler,'dpmpp_2m');assert.equal(mixed.sampling.scheduler,'normal');assert.equal(fake.posts.length,0);
});

test('HTTP workflow preparation validates effective original values when custom switches are OFF',async()=>{
 const {mkdtemp,mkdir,rm}=await import('node:fs/promises'),path=await import('node:path'),{createHubServer}=await import('../server.mjs');const base=path.resolve('./tests/.runtime');await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'override-http-')),fake=fakeBackend(),app=createHubServer({root,fetchImpl:fake.fetchImpl,libraryOptions:{discover:async()=>[]},pollMS:999999,liveSocket:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const source=structuredClone(picture);Object.assign(source.prompt['6'].inputs,{sampler_name:'dpmpp_2m',scheduler:'karras'});const url='http://127.0.0.1:'+app.server.address().port;const res=await fetch(url+'/api/prepare',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({source,backend:'http://127.0.0.1:7821',prompt:'A lighthouse',width:1024,height:576,seed:42,controls:{sampling:{steps:31,sampler:'missing',scheduler:'missing'},samplingOverrides:{sampler:false,scheduler:false}}})});const data=await res.json();assert(res.ok,JSON.stringify(data));const run=await app.runner.load(data.id),s=inspectRenderSource({prompt:run.jobs[0].prompt}).sampling;assert.equal(s.sampler,'dpmpp_2m');assert.equal(s.scheduler,'karras');assert.equal(s.steps,31);assert.equal(fake.posts.length,0);
 }finally{await new Promise(r=>app.server.close(r));await rm(root,{recursive:true,force:true});}
});
