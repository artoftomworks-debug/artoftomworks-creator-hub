import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createModelRecommendations,exampleRecommendations,recommendationValues,usableRecommendation,versionRecommendations} from '../model-recommendations.mjs';
const hash='a'.repeat(64),source={provider:'civitai',modelId:11,versionId:22,sha256:hash,url:'https://civitai.com/models/11?modelVersionId=22'};
const card=()=>({id:22,modelId:11,files:[{hashes:{SHA256:hash}}],images:Array.from({length:10},()=>({meta:{steps:6,cfgScale:1,sampler:'ER SDE','Schedule type':'Simple','Model hash':hash.slice(0,10),prompt:'Never store this image prompt'}}))});
const base=path.resolve('./tests/.runtime');
test('recommendations parse explicit numeric fields, normalize known sampler names and refuse invalid numeric values',()=>{
 assert.deepEqual(recommendationValues({steps:6,cfgScale:0,sampler:'ER SDE','Schedule type':'Simple'}),{steps:6,cfg:0,sampler:'er_sde',scheduler:'simple'});
 assert.deepEqual(recommendationValues({steps:Infinity,cfg:-1,denoise:4,guidance:200}),{});assert.deepEqual(recommendationValues({steps:true,cfg:[1],sampler:'   '}),{});
 const p={values:{steps:6,cfg:1,sampler:'er_sde',scheduler:'simple'}};const allowed=usableRecommendation(p,{samplers:['euler'],schedulers:['simple']});assert.deepEqual(allowed.values,{steps:6,cfg:1,scheduler:'simple'});assert.equal(allowed.skipped.length,1);assert.equal(p.values.sampler,'er_sde');
});
test('example settings need consensus and reject a different model hash instead of borrowing generic family settings',()=>{
 const d=card();assert.deepEqual(exampleRecommendations(d,hash).values,{steps:6,cfg:1,sampler:'er_sde',scheduler:'simple'});for(const image of d.images)image.meta['Model hash']='b'.repeat(10);assert.deepEqual(exampleRecommendations(d,hash).values,{});
 const mixed=card();mixed.images.forEach((v,i)=>v.meta.steps=i<5?6:50);assert.equal(exampleRecommendations(mixed,hash).values.steps,undefined);assert.equal(exampleRecommendations(mixed,hash).values.cfg,1);
});
test('exact version/file recommendations are cached, survive offline refresh and exclude image prompts',async()=>{
 const root=await mkdtemp(path.join(base,'recommendations-'));try{let calls=0,offline=false;const asset={id:'moss',path:path.join(root,'moss.safetensors'),source};const fetchImpl=async url=>{calls++;assert.equal(url,'https://civitai.com/api/v1/model-versions/22');if(offline)throw Error('Offline');return Response.json(card());};const service=createModelRecommendations({root,fetchImpl});const first=await service.forAsset(asset);assert.equal(first.state,'ready');assert.equal(first.kind,'examples');assert.equal(first.examples,10);assert.equal(first.values.steps,6);assert.equal((await service.forAsset(asset)).cached,true);assert.equal(calls,1);
 offline=true;const restored=createModelRecommendations({root,fetchImpl});assert.equal((await restored.forAsset(asset,{refresh:true})).stale,true);assert(!String(await readFile(path.join(root,'data','model-recommendations.json'))).includes('Never store'));
 const mismatch=createModelRecommendations({root,fetchImpl:async()=>Response.json({...card(),id:23})});assert.equal((await mismatch.forAsset(asset,{refresh:true})).state,'unavailable');
 }finally{assert.equal(path.dirname(root),base);await rm(root,{recursive:true,force:true});}
});
test('local per-model defaults work offline; missing provenance never triggers an internet lookup',async()=>{
 const root=await mkdtemp(path.join(base,'recommendation-local-'));try{const file=path.join(root,'moss.safetensors'),service=createModelRecommendations({root,fetchImpl:()=>{throw Error('Must not fetch');}});await writeFile(file+'.civitai.info',JSON.stringify({InferenceDefaults:{Steps:8,CFG:1,Sampler:'euler',Scheduler:'simple'}}));const p=await service.forAsset({id:'moss',path:file});assert.equal(p.state,'ready');assert.equal(p.kind,'defaults');assert.equal(p.values.steps,8);assert.equal((await service.forAsset({id:'unknown',path:path.join(root,'unknown.safetensors')})).state,'unavailable');}finally{await rm(root,{recursive:true,force:true});}
});

const fluxNotes='<p>Use SDXL refinement at 0.20-0.30 denoise.</p><p>Steps: 6-10</p><p>Flux Guidance: 3.5</p><p>Sampler/Scheduler: euler/beta or dpmpp_2m/simple</p><p>CFG: 1.0</p>';
test('exact version notes take primary settings without borrowing the refiner denoise',()=>{
 const p=versionRecommendations(fluxNotes);assert.deepEqual(p.values,{steps:6,cfg:1,sampler:'euler',scheduler:'beta',guidance:3.5});assert.deepEqual(p.alternatives,[{sampler:'euler',scheduler:'beta'},{sampler:'dpmpp_2m',scheduler:'simple'}]);
 const usable=usableRecommendation(p,{samplers:['dpmpp_2m'],schedulers:['simple','beta']});assert.equal(usable.values.sampler,'dpmpp_2m');assert.equal(usable.values.scheduler,'simple');assert.equal(p.values.sampler,'euler');
});
test('low denoise examples are a separate pass and must not supply base generation defaults',()=>{
 const d=card();d.images.forEach(v=>Object.assign(v.meta,{denoise:.25,sampler:'LCM','Schedule type':'Karras'}));assert.deepEqual(exampleRecommendations(d,hash).values,{});
 d.images.forEach(v=>{delete v.meta.denoise;v.meta['Denoising strength']=.3;});assert.deepEqual(exampleRecommendations(d,hash).values,{});
});
test('local exact-version notes override stale image-derived cache while generic model notes are ignored',async()=>{
 const root=await mkdtemp(path.join(base,'flux-author-'));try{const file=path.join(root,'flux.safetensors');await writeFile(file.replace('.safetensors','.cm-info.json'),JSON.stringify({VersionId:22,VersionDescription:fluxNotes,ModelDescription:'Steps: 99'}));const service=createModelRecommendations({root,fetchImpl:()=>{throw Error('Must not fetch');}});const p=await service.forAsset({id:'flux',path:file,source});assert.equal(p.kind,'description');assert.equal(p.values.steps,6);assert.equal(p.values.sampler,'euler');assert.equal(p.values.denoise,undefined);
 await writeFile(file.replace('.safetensors','.cm-info.json'),JSON.stringify({VersionId:22,ModelDescription:fluxNotes}));const unavailable=await service.forAsset({id:'flux2',path:file});assert.equal(unavailable.state,'unavailable');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('old unversioned example caches cannot resurrect bad defaults during an offline refresh',async()=>{
 const root=await mkdtemp(path.join(base,'old-card-'));try{await mkdir(path.join(root,'data'));await writeFile(path.join(root,'data/model-recommendations.json'),JSON.stringify({schema:'artoftomworks.model-recommendations',items:{['22:'+hash]:{state:'ready',kind:'examples',checked:Date.now(),values:{steps:6,sampler:'lcm',denoise:.25}}}}));const service=createModelRecommendations({root,fetchImpl:()=>{throw Error('Offline');}});const p=await service.forAsset({id:'flux',path:path.join(root,'flux.safetensors'),source});assert.equal(p.state,'unavailable');assert(!p.values);
 }finally{await rm(root,{recursive:true,force:true});}
});
