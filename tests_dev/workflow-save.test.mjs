// 0.16 DEV — "Workflow mentése" (Előzmények) and loading the saved file back.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {realObjects} from './fixtures/real_object_info_subset.mjs';
import {uiToBundle,inspectRenderSource,compileRenderShot} from '../workflow.mjs';
import {createWorkflowSaver,slug,SAVED_DIR} from '../workflow-save.mjs';
import {createLibrary} from '../library.mjs';
const F=fileURLToPath(new URL('./fixtures/ltx_two_stage_global.ui.json',import.meta.url));
function compiled(){const src=uiToBundle(JSON.parse(readFileSync(F)),realObjects([F]));const info=inspectRenderSource(src);return {src,info,r:compileRenderShot(src,{prompt:'Árvíztűrő bálna úszik a ködben, lassú kameramozgás',negative:'blur',width:1088,height:608,duration:5,output:info.output,controls:{seed:77}},'creator-hub/start.png','video/test')};}
import {readFileSync} from 'node:fs';
function fakes(root,{withImage=true}={}){
 const {r,info}=compiled();
 const entry={id:'a'.repeat(32),runId:'b'.repeat(32),shotId:'s1',mode:'video',created:'2026-11-22T12:58:25Z',seed:77,filename:'x.mp4',width:1088,height:640};
 const run={id:entry.runId,backend:'http://127.0.0.1:8191',mode:'video',jobs:[{shotId:'s1',prompt:r.prompt,workflow:null,output:info.output,fps:24,frames:121,seconds:121/24,imagePath:withImage?'creator-hub/start.png':''}]};
 const history={item:async id=>{if(id!==entry.id)throw Error('unknown');return entry;},location:async()=>({available:false})};
 const runner={load:async id=>{assert.equal(id,run.id);return run;}};
 const png=Buffer.from('89504e470d0a1a0a0000','hex');
 const fetchImpl=async url=>{assert.match(String(url),/\/view\?filename=start\.png&subfolder=creator-hub&type=input/);return new Response(png,{status:200});};
 return {entry,run,history,runner,fetchImpl,png};
}
test('slug folds accents and strips unsafe characters',()=>{assert.equal(slug('Árvíztűrő tükörfúrógép: "teszt" / 2'),'Arvizturo_tukorfurogep_teszt_2');assert.equal(slug('<>|'),'');});
test('saves exact API graph, recipe and preview without overwriting; folder joins Készlettár',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-save-'));const f=fakes(root);
 const library=createLibrary({root,discover:async()=>[]});
 const saver=createWorkflowSaver({root,history:f.history,runner:f.runner,library,fetchImpl:f.fetchImpl});
 const a=await saver.save({id:f.entry.id}),b=await saver.save({id:f.entry.id});
 assert.notEqual(a.path,b.path);assert.match(a.name,/^\d{4}-\d{2}-\d{2}_\d{4}_video_.*Arviztur.*_seed77\.api\.json$/);assert.match(b.name,/_2\.api\.json$/);
 assert.deepEqual(JSON.parse(await readFile(a.path,'utf8')),f.run.jobs[0].prompt);
 const files=await readdir(path.join(root,SAVED_DIR));assert.equal(files.filter(n=>n.endsWith('.txt')).length,2);assert.equal(files.filter(n=>n.includes('.preview.png')).length,2);
 assert.deepEqual(await readFile(path.join(root,SAVED_DIR,a.preview)),f.png);
 const recipe=await readFile(path.join(root,SAVED_DIR,a.name.replace(/\.json$/,'.txt')),'utf8');assert.match(recipe,/Seed: 77/);assert.match(recipe,/Árvíztűrő bálna/);assert.match(recipe,/121 képkocka · 24 fps/);
 assert.equal(a.listed,true);const listed=await library.list({kind:'workflow'}).catch(()=>null);
 const st=await library.state();assert.ok(st.roots.some(r=>r.path.endsWith(SAVED_DIR)&&r.kind==='workflow'));assert.equal(st.counts.workflow,2);
});
test('no start image: still saves, just without preview; old results without recipe are refused',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-save-'));const f=fakes(root,{withImage:false});
 const saver=createWorkflowSaver({root,history:f.history,runner:f.runner,library:null,fetchImpl:async()=>{throw Error('no fetch expected');}});
 const a=await saver.save({id:f.entry.id});assert.equal(a.preview,null);
 f.run.jobs[0].prompt=undefined;await assert.rejects(saver.save({id:f.entry.id}),/nincs mentett generálási recept/);
});
test('a saved two-stage LTX graph loads back into the Hub and recompiles to the same size and timing',()=>{
 const {r}=compiled();const again=uiToBundle(structuredClone(r.prompt),{});const info=inspectRenderSource(again);
 assert.equal(info.twoStage,true);assert.equal(info.fps,24);
 const r2=compileRenderShot(again,{prompt:'új prompt',negative:'',width:1088,height:608,duration:5,output:info.output,controls:{seed:5}},'creator-hub/other.png','video/t2');
 assert.equal(r2.width,r.width);assert.equal(r2.height,r.height);assert.deepEqual(r2.timing,r.timing);
 const scales=p=>Object.values(p).filter(n=>n.class_type==='ImageScale').length;assert.equal(scales(r2.prompt),scales(r.prompt),'recompiling must not stack extra resizes');
});
test('saving the loaded source keeps it unchanged, versioned, and lists it in Készlettár',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-src-'));const library=createLibrary({root,discover:async()=>[]});
 const saver=createWorkflowSaver({root,history:null,runner:null,library});
 const raw=JSON.parse(readFileSync(F,'utf8')),bundle=uiToBundle(structuredClone(raw),realObjects([F]));
 const a=await saver.saveSource({source:bundle.workflow,name:'LTX_2.5_Simple_I2V_ArtofTomworks_GLOBAL_v1.1_SeamFix.json'});
 const b=await saver.saveSource({source:bundle.workflow,name:'LTX_2.5_Simple_I2V_ArtofTomworks_GLOBAL_v1.1_SeamFix.json'});
 assert.match(a.name,/^\d{4}-\d{2}-\d{2}_\d{4}_LTX_2_5_Simple_I2V_ArtofTomworks_GLOBAL_v1_1_SeamFix\.json$/);assert.notEqual(a.path,b.path);
 assert.deepEqual(JSON.parse(await readFile(a.path,'utf8')),raw,'the saved file must equal the originally loaded workflow');
 const api=await saver.saveSource({source:bundle.prompt,name:'valami.api.json'});assert.match(api.name,/_valami\.api\.json$/);
 assert.equal(a.listed,true);assert.equal((await library.state()).counts.workflow,3);
 await assert.rejects(saver.saveSource({source:null}),/Nincs betöltött workflow/);await assert.rejects(saver.saveSource({source:{a:1}}),/nem ComfyUI-workflow/);
});
test('history → load workflow: exact graph, seed and start image info',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-load-'));const f=fakes(root);
 const saver=createWorkflowSaver({root,history:f.history,runner:f.runner,library:null});
 const v=await saver.loadInfo({id:f.entry.id});
 assert.deepEqual(v.source,f.run.jobs[0].prompt);assert.equal(v.seed,77);assert.equal(v.hasStartImage,true);assert.equal(v.runId,f.entry.runId);assert.match(v.name,/^Előzmény · x\.api\.json$/);
 assert.equal(v.duration,5);/* no requested → actual 121/24 s rounded */f.run.jobs[0].requested=8;assert.equal((await saver.loadInfo({id:f.entry.id})).duration,8);delete f.run.jobs[0].requested;
 // the graph loads back into the Hub as a two-stage LTX source
 const info=inspectRenderSource(uiToBundle(structuredClone(v.source),{}));assert.equal(info.twoStage,true);
 f.run.jobs[0].prompt=undefined;await assert.rejects(saver.loadInfo({id:f.entry.id}),/nincs mentett generálási recept/);});
test('save targets: ComfyUI list, Save as…, no overwrite, cancel, reveal only own files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-tgt-'));const comfy=path.join(root,'ComfyUI');const other=path.join(root,'Pendrive');await mkdir(other,{recursive:true});
 let next=path.join(other,'sajat_nev.json');const opened=[];
 const saver=createWorkflowSaver({root,history:null,runner:null,library:null,comfyDir:async()=>comfy,chooseSave:async()=>next,openFolder:async()=>{},openFile:async f=>opened.push(f)});
 const raw=JSON.parse(readFileSync(F,'utf8')),api={1:{class_type:'X',inputs:{}}};
 const c=await saver.saveSource({source:raw,name:'LTX.json',target:'comfy'});assert.equal(path.dirname(c.path),path.join(comfy,'user','default','workflows','ArtofTomworks_Hub'));
 await assert.rejects(saver.saveSource({source:api,name:'x',target:'comfy'}),/UI\) workflow/);
 const a=await saver.saveSource({source:raw,name:'x',target:'custom'});assert.equal(a.path,path.join(other,'sajat_nev.json'));
 const b=await saver.saveSource({source:raw,name:'x',target:'custom'});assert.equal(b.path,path.join(other,'sajat_nev_2.json'),'never overwrites');
 assert.deepEqual(JSON.parse(await readFile(b.path,'utf8')),raw);
 next=null;assert.deepEqual(await saver.saveSource({source:raw,name:'x',target:'custom'}),{saved:false,cancelled:true});
 await saver.reveal({path:a.path});assert.deepEqual(opened,[a.path]);await assert.rejects(saver.reveal({path:'C:\\\\Windows\\\\system.ini'}),/munkamenetben mentett/);});
