import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createAutomatic,headerProfile,seriesSeeds,validateGraph} from '../automatic.mjs';import {createLibrary} from '../library.mjs';import {createHubServer} from '../server.mjs';import {inspectRenderSource,compileRenderShot} from '../workflow.mjs';import {fakeBackend,image} from './fixtures.mjs';
const emptyLibrary={list:async()=>({items:[],pages:1}),detail:async()=>({})};
test('automatic architecture recognition uses explicit metadata or tensor signatures, rejects conflicts',()=>{
 assert.equal(headerProfile({'__metadata__':{'modelspec.architecture':'krea-2'}}).family,'krea2');
 assert.equal(headerProfile({'model.diffusion_model.double_blocks.0.img_attn.qkv.weight':{},'model.diffusion_model.single_blocks.0.linear1.weight':{},'text_encoders.t5xxl.x':{},'vae.decoder.conv_in.weight':{}}).family,'flux1');
 assert.equal(headerProfile({'__metadata__':{'modelspec.architecture':'sdxl'},'model.diffusion_model.double_blocks.0.img_attn.qkv.weight':{},'model.diffusion_model.single_blocks.0.linear1.weight':{}}).family,null);
 assert.equal(headerProfile({'filename':'flux1.safetensors'}).family,null);
});
test('series seeds distinguish random, fixed and increment; invalid resource requests are rejected',()=>{
 assert.deepEqual(seriesSeeds(3,'fixed',42),[42,42,42]);assert.deepEqual(seriesSeeds(3,'increment',42),[42,43,44]);const random=seriesSeeds(24,'random',42);assert(random.every(Number.isSafeInteger));assert(new Set(random).size>1);for(const n of [0,25,1.5])assert.throws(()=>seriesSeeds(n,'fixed',42));assert.throws(()=>seriesSeeds(2,'increment',Number.MAX_SAFE_INTEGER));
});
test('standalone SDXL and H3 graph construction needs no user workflow; missing dependencies and unsupported choices explain failure',async()=>{
 const fake=fakeBackend(),auto=createAutomatic({getObjects:async()=>fake.objects,fetchImpl:fake.fetchImpl,library:emptyLibrary});
 const list=await auto.list('http://127.0.0.1:7821');assert(list.models.find(m=>m.name==='fixture.safetensors').supported);assert(!list.models.find(m=>m.name==='unknown.safetensors').supported);
 const a=await auto.build('http://127.0.0.1:7821',{id:'checkpoints|fixture.safetensors',sampling:{steps:31,cfg:6.2,sampler:'dpmpp_2m',scheduler:'karras'}});assert(a.dependencies.some(d=>d.name.includes('beépített')));const info=inspectRenderSource(a.source);assert(!info.needsImage);assert.equal(info.sampling.steps,31);assert.equal(info.sampling.cfg,6.2);
 const b=await auto.build('http://127.0.0.1:7821',{id:'diffusion_models|fixture-dasiwa.safetensors',duration:4,useImage:false});assert.equal(b.dependencies.length,3);const bi=inspectRenderSource(b.source);assert.equal(bi.mode,'video');assert(!bi.needsImage);assert(bi.negativeAvailable);
 const out=compileRenderShot(b.source,{output:bi.output,prompt:'Gentle rain',negative:'music',duration:4,width:1088,height:608,controls:{seed:99,sampling:{steps:8,cfg:1.5,sampler:'euler',scheduler:'simple',denoise:1}}},null,'ArtofTomworks/CreatorHub/test');assert(!Object.values(out.prompt).some(n=>n.class_type==='LoadImage'));assert(Object.values(out.prompt).some(n=>n.inputs.text==='music'));assert.equal(inspectRenderSource({prompt:out.prompt}).sampling.cfg,1.5);
 fake.objects.VAELoader.input.required.vae_name[0]=['ae.safetensors'];await auto.list('http://127.0.0.1:7821',true);await assert.rejects(()=>auto.build('http://127.0.0.1:7821',{id:'diffusion_models|fixture-dasiwa.safetensors'}),/Hiányzó.*kiegészítő/);
 assert.equal(fake.posts.length,0);
});
test('local headers identify AIO FLUX and standalone Krea2; exactly chosen dependencies and dimensions are compiled',async()=>{
 const base=path.resolve('./tests/.runtime');await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'auto-local-')),fake=fakeBackend();
 const file=path.join(root,'checkpoints','a.safetensors');await mkdir(path.dirname(file),{recursive:true});const h=Buffer.from(JSON.stringify({'text_encoders.t5xxl.x':{},'vae.decoder.conv_in.weight':{},'model.diffusion_model.double_blocks.0.img_attn.qkv.weight':{},'model.diffusion_model.single_blocks.0.linear1.weight':{}})),len=Buffer.alloc(8);len.writeBigUInt64LE(BigInt(h.length));await writeFile(file,Buffer.concat([len,h]));fake.objects.CheckpointLoaderSimple.input.required.ckpt_name[0].push('a.safetensors');fake.objects.UNETLoader.input.required.unet_name[0].push('k2.safetensors');const original=fake.fetchImpl;const fetchImpl=(url,opt)=>new URL(url).searchParams.get('filename')==='k2.safetensors'?Promise.resolve(Response.json({'modelspec.architecture':'krea-2'})):original(url,opt);
 const library=createLibrary({root,discover:async()=>[{path:path.dirname(file),kind:'checkpoint'}]});
 try{await library.start();await library.wait();const auto=createAutomatic({getObjects:async()=>fake.objects,fetchImpl,library});const built=await auto.build('http://127.0.0.1:7821',{id:'checkpoints|a.safetensors'});assert.equal(built.model.family,'flux1');assert.equal(built.dependencies.length,1);assert(Object.values(built.source.prompt).some(n=>n.class_type==='FluxGuidance'));
  const k=await auto.build('http://127.0.0.1:7821',{id:'diffusion_models|k2.safetensors',width:1088,height:608});assert(k.dependencies.some(d=>d.name==='qwen3vl_4b.safetensors'));assert(k.dependencies.some(d=>d.name==='qwen_image_vae.safetensors'));assert(Object.values(k.source.prompt).some(n=>n.class_type==='ModelSamplingFlux'&&n.inputs.width===1088));assert.equal(inspectRenderSource(k.source).sampling.cfg,1);
 }finally{await library.stop();assert.equal(path.dirname(root),base);await rm(root,{recursive:true,force:true});}
});
test('backend schema differences are rejected before queuing',()=>{assert.throws(()=>validateGraph({'1':{class_type:'KSampler',inputs:{steps:4}}},{KSampler:{input:{required:{steps:['INT',{min:1}],new_required:['STRING']}}}}),/new_required/);assert.throws(()=>validateGraph({'1':{class_type:'CLIPLoader',inputs:{type:'krea2'}}},{CLIPLoader:{input:{required:{type:[['stable_diffusion']]}}}}),/nem támogatja/);});
test('HTTP automatic series preserves settings, queues sequentially, stops after current and retries only unfinished jobs',async()=>{
 const base=path.resolve('./tests/.runtime');await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'auto-http-')),fake=fakeBackend(),app=createHubServer({root,libraryOptions:{discover:async()=>[]},fetchImpl:fake.fetchImpl,pollMS:999999,liveSocket:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port,backend='http://127.0.0.1:7821';
 const post=async(route,data)=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();assert(r.ok,JSON.stringify(value));return value;};
 try{let r=await post('automatic/prepare',{backend,id:'checkpoints|fixture.safetensors',width:1088,height:608,prompt:'A lighthouse',negative:'blur',count:3,seedMode:'increment',seed:70,sampling:{steps:17,cfg:6,sampler:'euler',scheduler:'normal',denoise:1,guidance:3.5},controls:{}});assert.equal(r.jobs.length,3);assert.equal(fake.posts.length,0);const saved=await app.runner.load(r.id);assert.deepEqual(saved.jobs.map(j=>j.seed),[70,71,72]);assert.equal(inspectRenderSource({prompt:saved.jobs[0].prompt}).sampling.steps,17);
  await post('start',{id:r.id,contextKey:r.contextKey});await app.runner.tick();assert.equal(fake.posts.length,1);await post('stop',{id:r.id,cancel:false});fake.finish();await app.runner.tick();await app.runner.tick();assert.equal(fake.posts.length,1);
  await post('start',{id:r.id,contextKey:r.contextKey,retry:true});await app.runner.tick();assert.equal(fake.posts.length,2);assert.equal(saved.jobs[0].state,'complete');await post('stop',{id:r.id,cancel:true});await app.runner.tick();assert.equal(saved.jobs[1].state,'cancelled');
  await post('start',{id:r.id,contextKey:r.contextKey,retry:true});await app.runner.tick();assert.equal(fake.posts.length,3);assert.equal(saved.jobs[1].cancelRequested,undefined);fake.finish();await app.runner.tick();await app.runner.tick();assert.equal(fake.posts.length,4);fake.finish();await app.runner.tick();await app.runner.tick();assert(saved.jobs.every(j=>j.state==='complete'));assert.equal(fake.posts.length,4);
  const exportData=await post('export',{id:r.id});assert.equal(exportData.files.length,3);
 }finally{await new Promise(r=>app.server.close(r));assert.equal(path.dirname(root),base);await rm(root,{recursive:true,force:true});}
});


test('minus-one seed selects a distinct random seed for every requested variant',()=>{const seeds=seriesSeeds(3,'increment',-1);assert.equal(seeds.length,3);assert.equal(new Set(seeds).size,3);assert.ok(seeds.every(s=>Number.isSafeInteger(s)&&s>=0));});

test('model card values are advisory until explicitly applied, including old automatic-card policy',async()=>{
 const {modelCardSampling}=await import('../automatic-ui.mjs');const saved={steps:20,sampler:'lcm',denoise:.25},p={state:'ready',values:{steps:6,sampler:'euler',scheduler:'beta'}};
 assert.deepEqual(modelCardSampling(saved,p,{mode:'image',useImage:false}),saved);
 assert.deepEqual(modelCardSampling(saved,p,{mode:'image',useImage:false,policy:'card'}),saved);
 assert.deepEqual(modelCardSampling(saved,p,{mode:'image',useImage:false,apply:true}),{steps:6,sampler:'euler',scheduler:'beta',denoise:1});
 assert.equal(modelCardSampling(saved,p,{mode:'image',useImage:true,apply:true}).denoise,.25);
 assert.deepEqual(modelCardSampling(saved,p,{mode:'image',useImage:false,policy:'manual'}),saved);assert.equal(saved.denoise,.25);
});

test('checking FLUX recommendations never mutates sampling, with or without an available card',async()=>{
 const {modelCardSampling}=await import('../automatic-ui.mjs');const old={steps:12,cfg:1,sampler:'lcm',scheduler:'karras',denoise:1},none={state:'unavailable'};
 assert.deepEqual(modelCardSampling(old,none,{family:'flux1',mode:'image',useImage:false}),old);
 assert.deepEqual(modelCardSampling(old,none,{family:'flux1',mode:'image',policy:'manual'}),old);
 assert.equal(modelCardSampling(old,{state:'ready',values:{sampler:'dpmpp_2m',scheduler:'simple'}},{family:'flux1',mode:'image'}).sampler,'lcm');
});
