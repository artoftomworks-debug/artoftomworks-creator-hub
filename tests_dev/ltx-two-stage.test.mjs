// Creator Hub 0.16.0 DEV — automated checks for the two-stage LTX branch.
// Run from the Hub folder:  node --test tests_dev/
// No ComfyUI, GPU or network is needed; graphs are compiled, not executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectRenderSource,compileRenderShot,applyControls,uiToBundle,renderBranch} from '../workflow.mjs';
import {evalMath,resolveNumber,ltxTiming,ltxTwoStageDims} from '../ltx.mjs';
import {continuationSource} from '../scene-service.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const fixture=()=>JSON.parse(readFileSync(path.join(here,'fixtures','ltx_two_stage_global.api.json'),'utf8'));
const plan=(info,extra={})=>({prompt:'A woman walks through warm rain',negative:'blurry',width:768,height:1344,duration:8,output:info.output,...extra});
const dangling=p=>Object.entries(p).flatMap(([id,n])=>Object.entries(n.inputs).filter(([,v])=>Array.isArray(v)&&typeof v[0]==='string'&&!p[v[0]]).map(([k])=>id+'.'+k));
const ofType=(p,t)=>Object.entries(p).filter(([,n])=>n.class_type===t);

test('math helper: arithmetic, functions and rejection of anything else',()=>{
 assert.equal(evalMath('a/2',{a:1088}),544);
 assert.equal(evalMath('a * b + 1',{a:8,b:24}),193);
 assert.equal(evalMath('max(5, floor((a*b-5)/17+0.5)*17+5)',{a:8,b:24}),192);
 for(const bad of ['process.exit()','a;b','constructor','a**2','`x`','c'])assert.throws(()=>evalMath(bad,{a:1,b:2}));
});

test('two-stage source is recognised with its real size and fps',()=>{
 const info=inspectRenderSource(fixture());
 assert.equal(info.videoFamily,'ltx');assert.equal(info.twoStage,true);
 assert.equal(info.width,608);assert.equal(info.height,1088);assert.equal(info.fps,24);
 assert.equal(info.prompt,'Cinematic image-to-video animation of the loaded first frame. Preserve the subject, composition and background. Natural coherent motion, steady camera, subtle ambient sound, no speech.');
 assert.equal(info.needsImage,true);
});

test('compile: half-size base latent, 2x final, 8k+1 frames, helpers removed, no dangling links',()=>{
 const src=fixture(),info=inspectRenderSource(src),r=compileRenderShot(src,plan(info),'hub/start.png','ArtofTomworks/CreatorHub/Videos/t');
 const p=r.prompt,[[,empty]]=ofType(p,'EmptyLTXVLatentVideo');
 assert.deepEqual([empty.inputs.width,empty.inputs.height,empty.inputs.length],[384,672,193]);
 assert.deepEqual([r.width,r.height],[768,1344]);assert.equal(r.timing.frames,193);
 assert.equal(ofType(p,'ComfyMathExpression').length,0);
 assert.deepEqual(dangling(p),[]);
 const [[,scale]]=ofType(p,'ImageScale');assert.deepEqual([scale.inputs.width,scale.inputs.height],[768,1344]);
 const [[,audio]]=ofType(p,'LTXVEmptyLatentAudio');assert.deepEqual([audio.inputs.frames_number,audio.inputs.frame_rate],[193,24]);
 assert.equal(ofType(p,'CreateVideo')[0][1].inputs.fps,24);
 assert.equal(ofType(p,'LTXVLatentUpsampler').length,1);assert.equal(ofType(p,'SamplerCustomAdvanced').length,2);
 assert.equal(p['406'].inputs.value,'A woman walks through warm rain');
 assert.equal(p['414'].inputs.text,'blurry');
 assert.equal(p['75'].inputs.filename_prefix,'ArtofTomworks/CreatorHub/Videos/t');
});

test('seed: Hub seed drives the base pass, refine pass keeps the source seed',()=>{
 const src=fixture(),info=inspectRenderSource(src),bundle=applyControls(src,info,{seed:777});
 assert.equal(bundle.prompt['418'].inputs.noise_seed,777);assert.equal(bundle.prompt['437'].inputs.noise_seed,42);
});

test('sizes that are not multiples of 64 are rounded to the nearest valid two-stage size',()=>{
 assert.deepEqual(ltxTwoStageDims(1088,608),{baseWidth:544,baseHeight:320,width:1088,height:640});
 assert.deepEqual(ltxTwoStageDims(768,1344),{baseWidth:384,baseHeight:672,width:768,height:1344});
 const src=fixture(),info=inspectRenderSource(src),r=compileRenderShot(src,plan(info,{width:1088,height:608}),'x.png','t');
 assert.deepEqual([r.width,r.height],[1088,640]);
});

test('frame counts stay on the LTX 8k+1 grid for 24, 25 and 30 fps',()=>{
 for(const fps of [24,25,30])for(const s of [3,5,8,10]){const {frames}=ltxTiming(s,fps);assert.equal((frames-1)%8,0,fps+'fps '+s+'s');}
});

test('scene continuation re-uses a compiled two-stage job',()=>{
 const src=fixture(),info=inspectRenderSource(src),first=compileRenderShot(src,plan(info),'a.png','t');
 const {source,info:again}=continuationSource({prompt:first.prompt},info.output);
 assert.equal(again.twoStage,true);assert.equal(again.width,768);assert.equal(again.height,1344);
 const second=compileRenderShot(source,plan(again,{prompt:'She opens an umbrella'}),'last-frame.png','t2');
 assert.deepEqual(dangling(second.prompt),[]);assert.equal(ofType(second.prompt,'ImageScale').length,1,'no duplicated scalers');
});

test('still rejected: reference (AddGuide) chains and three-sampler chains',()=>{
 const a=fixture();a.prompt['900']={class_type:'LTXVAddGuide',inputs:{latent:['432',0]}};a.prompt['426'].inputs.av_latent=['423',0];
 a.prompt['423'].inputs.latent_image=['427',0];a.prompt['427'].inputs.video_latent=['900',0];
 assert.throws(()=>inspectRenderSource(a),/AddGuide/);
 const b=fixture();b.prompt['901']={class_type:'SamplerCustomAdvanced',inputs:{noise:['437',0],guider:['440',0],sampler:['441',0],sigmas:['439',0],latent_image:['442',0]}};b.prompt['443'].inputs.av_latent=['901',0];
 assert.throws(()=>inspectRenderSource(b));
});

test('single-widget nodes saved as a bare value are imported',()=>{
 const raw={nodes:[{id:1,type:'PrimitiveStringMultiline',mode:0,inputs:[],outputs:[],widgets_values:'hello'},{id:2,type:'SaveText',mode:0,inputs:[{name:'text',link:1}],widgets_values:[]}],links:[[1,1,0,2,0,'STRING']]};
 const objects={PrimitiveStringMultiline:{input:{required:{value:['STRING',{multiline:true}]}}},SaveText:{input:{required:{text:['STRING',{}]}}}};
 // No Save node here, so a later step may still refuse the graph; what matters is that the
 // bare-string widget no longer triggers the "custom widget layout" refusal.
 try{uiToBundle(raw,objects);}catch(e){assert.doesNotMatch(e.message,/widgetelrendezés/);}});

test('dynamic (autogrow) math sockets survive UI import, so fps/size stay resolvable',()=>{
 // Mirrors the real ComfyUI declaration: ComfyMathExpression exposes one "values" autogrow group.
 const objects={PrimitiveInt:{input:{required:{value:['INT',{control_after_generate:true}]}},input_order:{required:['value']}},
  ComfyMathExpression:{input:{required:{values:['COMFY_AUTOGROW_V3',{}],expression:['STRING',{}]}},input_order:{required:['values','expression']}},
  LoadImage:{input:{required:{image:[['x.png'],{}]}},input_order:{required:['image']}},
  CreateVideo:{input:{required:{images:['IMAGE',{}],fps:['FLOAT',{}]}},input_order:{required:['images','fps']}},
  SaveVideo:{input:{required:{video:['VIDEO',{}],filename_prefix:['STRING',{}]}},input_order:{required:['video','filename_prefix']}}};
 const raw={nodes:[
  {id:1,type:'PrimitiveInt',mode:0,inputs:[{name:'value',type:'INT',widget:{name:'value'},link:null}],widgets_values:[24,'fixed']},
  {id:2,type:'ComfyMathExpression',mode:0,inputs:[{name:'values.a',type:'FLOAT,INT,BOOLEAN',link:1},{name:'values.b',type:'FLOAT,INT,BOOLEAN',link:null},{name:'expression',type:'STRING',widget:{name:'expression'},link:null}],widgets_values:['a']},
  {id:3,type:'LoadImage',mode:0,inputs:[{name:'image',type:'COMBO',widget:{name:'image'},link:null}],widgets_values:['x.png','image']},
  {id:4,type:'CreateVideo',mode:0,inputs:[{name:'images',type:'IMAGE',link:3},{name:'fps',type:'FLOAT',widget:{name:'fps'},link:2}],widgets_values:[24]},
  {id:5,type:'SaveVideo',mode:0,inputs:[{name:'video',type:'VIDEO',link:4},{name:'filename_prefix',type:'STRING',widget:{name:'filename_prefix'},link:null}],widgets_values:['v']}],
  links:[[1,1,0,2,0,'INT'],[2,2,0,4,1,'FLOAT'],[3,3,0,4,0,'IMAGE'],[4,4,0,5,0,'VIDEO']]};
 const p=uiToBundle(raw,objects).prompt;
 assert.deepEqual(p['2'].inputs['values.a'],['1',0]);
 assert.equal(p['2'].inputs['values.b'],undefined,'unlinked dynamic socket stays absent');
 assert.equal(resolveNumber(p,p['4'].inputs.fps),24);
});

test('low-memory mode: LTX decodes in long temporal pieces (no 24-frame seam); H3 unchanged',async()=>{
 const {applyResourcePolicy}=await import('../resource-policy.mjs');
 const objects={VAEDecodeTiled:{input:{required:{samples:['LATENT'],vae:['VAE'],tile_size:['INT',{min:64,max:4096}],overlap:['INT',{min:0,max:4096}],temporal_size:['INT',{min:8,max:4096}],temporal_overlap:['INT',{min:4,max:4096}]}}}};
 const stats={system:{ram_total:34070192128},devices:[{type:'cuda',vram_total:12878086144}]};
 const run=t=>{const p={'1':{class_type:t,inputs:{}},'2':{class_type:'VAEDecode',inputs:{samples:['9',0],vae:['3',0]}}};applyResourcePolicy(p,objects,{memoryProfile:'auto',stats});return p['2'].inputs;};
 const l=run('EmptyLTXVLatentVideo');assert.deepEqual([l.temporal_size,l.temporal_overlap],[128,32]);
 const h=run('MiniMaxH3ImageToVideo');assert.deepEqual([h.temporal_size,h.temporal_overlap],[32,4]);
});
