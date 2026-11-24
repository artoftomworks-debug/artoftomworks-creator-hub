// 0.16 DEV — Folytatás csak szándékosan
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createGenerationManager} from '../generation-manager.mjs';
import {pausedChoices} from '../resume-ui.mjs';
test('choices: newest first, old ones flagged and unchecked (except the newest)',()=>{const now=10*3600e3;const c=pausedChoices([{id:'a',state:'paused',created:now-5*3600e3,title:'Creator Hub · old.safetensors'},{id:'b',state:'paused',created:now-60e3,title:'x'},{id:'c',state:'complete',created:now}],now);
 assert.deepEqual(c.map(x=>[x.id,x.old,x.checked]),[['b',false,true],['a',true,false]]);assert.equal(c[1].title,'old');
 assert.equal(pausedChoices([{id:'z',state:'paused',created:0}],now)[0].checked,true);});
test('resume(ids) starts only the chosen plans; finished runs are closed, not restarted',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'rs-'));const started=[];
 const runner={stop:async()=>({}),status:async id=>id==='done'?{id,autoRun:false,jobs:[{state:'complete'}]}:{id,autoRun:false,jobs:[{state:'planned'}]},prepare:async()=>({id:'new',contextKey:'k',jobs:[]}),start:async a=>{started.push(a.id);return {};}};
 const g=createGenerationManager({root,runner,pollMS:100000});const plan={shots:[{id:'s1',controls:{}}],title:'t',backend:'b'};
 await g.enqueue(plan);await g.enqueue({...plan,title:'second'});await g.enqueue({...plan,title:'third'});await g.stop({});
 let st=await g.status();assert.deepEqual(st.entries.map(e=>e.state),['paused','paused','paused']);
 const r=await g.resume({ids:[st.entries[1].id]});assert.deepEqual(r.entries.map(e=>e.state),['paused','queued','paused']);g.close();});
test('a paused entry whose run already completed becomes complete on resume',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'rs2-'));
 const runner={stop:async()=>({}),status:async id=>({id,autoRun:false,jobs:[{state:'complete'}]}),prepare:async()=>({id:'done',contextKey:'k',jobs:[]}),start:async()=>({})};
 const g=createGenerationManager({root,runner,pollMS:100000});await g.enqueue({shots:[{id:'s1',controls:{}}],title:'t',backend:'b'});await g.tick();await g.stop({});
 let st=await g.status();assert.equal(st.entries[0].state,'paused');const r=await g.resume({ids:[]});assert.equal(r.entries[0].state,'complete');g.close();});
