import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {seriesView} from '../series-ui.mjs';
import {summarize,modelFromFilename} from '../ai-review-ui.mjs';
import {createAssistantService} from '../assistant-service.mjs';
import {createGenerationManager} from '../generation-manager.mjs';
test('series view: batch progress, paused state, current model/format',()=>{
  const b=i=>({id:'abcdef12',label:'Modell-összehasonlítás 13:30',images:3,model:'M'+i,format:'álló'});
  const q={armed:true,current:'r2',entries:[{id:'e1',state:'complete',batch:b(1),done:3},{id:'e2',state:'running',runId:'r2',batch:b(2)},{id:'e3',state:'queued',batch:b(3)},{id:'x',state:'queued',title:'más'}]};
  const v=seriesView(q,{id:'r2',jobs:[{state:'complete'},{state:'running'},{state:'planned'}]});
  assert.equal(v.total,9);assert.equal(v.done,4);assert.equal(v.now,'M2 · álló');assert.deepEqual(v.ids,['e2','e3']);assert.equal(v.paused,false);
  const p=seriesView({...q,armed:false,entries:q.entries.map(e=>e.id==='e2'?{...e,state:'paused'}:e)},null);assert.equal(p.paused,true);
  const single=seriesView({armed:true,current:'r9',entries:[{id:'s',state:'running',runId:'r9',title:'Sorozat'}]},{id:'r9',jobs:[{state:'complete'},{state:'running'}]});assert.equal(single.total,2);assert.equal(single.done,1);assert.equal(single.batch,false);
  assert.equal(seriesView({armed:false,entries:[{id:'a',state:'complete'}]},null),null);
});
test('review summary: best overall and per model; model name from file name',()=>{
  assert.equal(modelFromFilename('20261123_115105Z_Modell-összehasonlítás_1250_afaf892c_01_Realism_By_Stable_Yogi_Moss_00001_.png'),'Realism By Stable Yogi Moss');
  const s=summarize([{model:'A',score:6},{model:'A',score:8},{model:'B',score:7},{model:'B',error:'x'}]);
  assert.equal(s.best.score,8);assert.deepEqual(s.perModel.map(m=>[m.model,m.average,m.best.score]),[['A',7,8],['B',7,7]]);
});
test('advisor: recommend keeps only listed ids; review clamps score; vision required for images',async()=>{
  let chat=null;const fetchImpl=async(url,o)=>{const u=String(url),body=o?.body?JSON.parse(o.body):null;const ok=d=>({ok:true,status:200,text:async()=>JSON.stringify(d)});
    if(u.endsWith('/api/tags'))return ok({models:[{name:'vis:9b',size:1},{name:'txt:1b',size:1}]});
    if(u.endsWith('/api/show'))return ok({capabilities:body.model==='vis:9b'?['completion','vision']:['completion']});
    if(u.endsWith('/api/chat')){chat=body;return ok({message:{content:body.messages[1].images?'{"score":14,"issues":["kéz"],"strengths":["fény"]}':'<think>x</think>{"picks":[{"id":"a","reason":"fotó"},{"id":"zzz","reason":"kitalált"}]}'}});}
    return ok({});};
  const s=createAssistantService({fetchImpl});
  const r=await s.request({action:'recommend',model:'txt:1b',prompt:'portrait',candidates:[{id:'a',name:'A'},{id:'b',name:'B'}]});assert.deepEqual(r.picks,[{id:'a',reason:'fotó'}]);assert.equal(chat.format,'json');
  const img='data:image/png;base64,iVBORw0KGgo=';
  const v=await s.request({action:'review',model:'vis:9b',prompt:'p',image:img});assert.equal(v.score,10);assert.deepEqual(v.issues,['kéz']);
  await assert.rejects(s.request({action:'review',model:'txt:1b',prompt:'p',image:img}),/nem lát képet/);
  const busy=createAssistantService({fetchImpl,isGenerationBusy:async()=>true});await assert.rejects(busy.request({action:'recommend',model:'txt:1b',prompt:'p',candidates:[{id:'a'},{id:'b'}]}),/generálás fut/);
});
test('queue: cancel removes waiting plans of a series, keeps others; remove() removes only one entry',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gm-'));const stops=[];
  const runner={stop:async a=>{stops.push(a);return {};},status:async()=>({jobs:[]}),prepare:async()=>({id:'r',contextKey:'k',jobs:[]}),start:async()=>({})};
  const g=createGenerationManager({root,runner,pollMS:100000});
  const plan={shots:[{id:'s1',controls:{}}],title:'t',backend:'b'};
  await g.stop({});// init
  for(const i of [1,2,3])await g.enqueue(plan,{batch:{id:'batch-123',label:'L',images:2,model:'M'+i}});await g.enqueue({...plan,title:'other'});
  await g.stop({cancel:false});const st=await g.status();const ids=st.entries.filter(e=>e.batch).map(e=>e.id);assert.equal(ids.length,3);assert.equal(st.entries[0].batch.images,2);
  const r=await g.cancel({ids:ids.slice(1)});assert.equal(r.removed,2);assert.equal(r.entries.length,2);
  const left=(await g.status()).entries;await g.remove(left[0].id);assert.equal((await g.status()).entries.length,1);g.close();
});
test('cancel "let the running image finish": entry closes after the run ends, the queue goes on',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gm2-'));let running=true;const started=[];
  const runner={stop:async()=>({}),status:async id=>id==='r1'?{id:'r1',autoRun:false,jobs:[{state:running?'running':'complete'}]}:{id,autoRun:false,jobs:[{state:'planned'}]},prepare:async p=>({id:'r'+(started.length+1),contextKey:'k',jobs:[]}),start:async a=>{started.push(a.id);return {};}};
  const g=createGenerationManager({root,runner,pollMS:100000});const plan={shots:[{id:'s1',controls:{}}],title:'t',backend:'b'};
  await g.enqueue(plan,{batch:{id:'batch-xyz1',label:'L',images:1}});await g.enqueue({...plan,title:'next'});
  await g.tick();const st=await g.status();assert.equal(st.current,'r1');
  await g.cancel({ids:[st.entries[0].id],now:false});assert.equal((await g.status()).entries[0].cancelAfter,true);
  await g.tick();assert.equal((await g.status()).entries[0].state,'running');// still running
  running=false;await g.tick();const after=(await g.status()).entries;assert.equal(after[0].state,'interrupted');
  await g.tick();assert.deepEqual(started,['r1','r2']);g.close();
});
test('series view: plan i/N, model i/N, image k/K',()=>{const b=(i,m,f)=>({id:'batchabc1',label:'L',images:2,model:m,format:f,index:i,total:4});
 const q={armed:true,current:'r3',entries:[{id:'a',state:'complete',batch:b(0,'A','álló')},{id:'b',state:'complete',batch:b(1,'A','fekvő')},{id:'c',state:'running',runId:'r3',batch:b(2,'B','álló')},{id:'d',state:'queued',batch:b(3,'B','fekvő')}]};
 const v=seriesView(q,{id:'r3',jobs:[{state:'complete'},{state:'running'}]});assert.equal(v.planIndex,3);assert.equal(v.planTotal,4);assert.equal(v.modelIndex,2);assert.equal(v.modelTotal,2);assert.equal(v.imageNow,2);assert.equal(v.imageTotal,2);assert.equal(v.format,'álló');});
