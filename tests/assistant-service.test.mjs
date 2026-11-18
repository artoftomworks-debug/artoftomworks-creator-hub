import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantService,DEEPSEEK_MODEL,assistantInstruction,cleanAssistantText} from '../assistant-service.mjs';
const model='fixture-local:4b',tick=()=>new Promise(r=>setTimeout(r,2));
async function finished(service,id){for(let i=0;i<1500;i++){const s=service.status(id);if(['complete','failed','cancelled'].includes(s.state))return s;await tick();}throw Error('Fixture job timed out');}
function fixture({caps=['completion','thinking','vision'],chunks,blocked=false,unloadFails=false}={}){
 const calls=[];let gpu=false;
 const fetchImpl=async(url,options={})=>{const route=new URL(url).pathname,b=options.body?JSON.parse(options.body):null;calls.push({route,body:b});
  if(route==='/api/tags')return Response.json({models:[{name:model,size:1024},{name:'fake-local',remote_model:'cloud-remote'},{name:'remote:cloud'}]});
  if(route==='/api/show')return Response.json({capabilities:caps});
  if(route==='/api/ps')return Response.json({models:gpu?[{name:model,size_vram:1024}]:[]});
  if(route==='/api/pull')return new Response('{"status":"pulling","total":100,"completed":50}\n{"status":"success"}\n');
  assert.equal(route,'/api/generate');if(!b.options){if(unloadFails)return Response.json({error:'unload refused'},{status:500});gpu=false;return Response.json({done:true});}
  gpu=b.options.num_gpu!==0;
  if(blocked)return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"response":"partial"}\n'));options.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}}));
  const text=chunks||JSON.stringify({response:'Árvíztűrő jelenet',done:true,eval_count:20,eval_duration:1e9})+'\n',bytes=new TextEncoder().encode(text);
  return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i++)controller.enqueue(bytes.slice(i,i+1));controller.close();}}));
 };
 const service=createAssistantService({fetchImpl,memoryAvailable:async()=>12*1024**3,releaseMS:50,timeoutMS:1000});return {service,calls,fetchImpl};
}
test('local-only listing never starts inference or download; confirmed install is restricted to the known candidate',async()=>{
 const f=fixture();try{const list=await f.service.request({action:'models'});assert.deepEqual(list.models,[model]);assert.equal(f.calls.length,1);await assert.rejects(f.service.request({action:'install'}),/erősítsd/);
 const j=await f.service.request({action:'install',confirmed:true});assert.equal((await finished(f.service,j.id)).state,'complete');assert.equal(f.calls.find(c=>c.route==='/api/pull').body.model,DEEPSEEK_MODEL);
 }finally{f.service.close();}
});
test('streaming Unicode stays intact, thinking stays out of prompt, GPU unload is verified and legacy CPU still works',async()=>{
 const f=fixture();try{const j=await f.service.request({action:'start',model,task:'refine',text:'My scene'}),r=await finished(f.service,j.id);assert.equal(r.state,'complete');assert.equal(r.text,'Árvíztűrő jelenet');assert.equal(r.execution,'gpu');const generate=f.calls.find(c=>c.body?.options);assert.equal(generate.body.keep_alive,0);assert.equal(generate.body.think,false);assert.equal(generate.body.options.num_ctx,4096);assert(f.calls.some(c=>c.route==='/api/ps'));
 const old=await f.service.request({action:'translate',model,text:'A scene'});assert.equal(old.text,r.text);assert.equal(f.calls.filter(c=>c.body?.options).at(-1).body.options.num_gpu,0);
 assert.equal(cleanAssistantText('<think>private</think>Visible'),'Visible');assert.equal(cleanAssistantText('<think>unfinished'),'');assert.match(assistantInstruction({task:'translate',language:'Hungarian'}),/Hungarian/);
 }finally{f.service.close();}
});
test('unknown, cloud and non-vision model requests never execute or implicitly download',async()=>{
 const f=fixture({caps:['completion']});try{const j=await f.service.request({action:'start',model:'missing',text:'scene'});assert.equal((await finished(f.service,j.id)).state,'failed');await assert.rejects(f.service.request({action:'start',model:'remote:cloud',text:'scene'}),/helyi/);
 const picture=await f.service.request({action:'start',model,text:'Describe',image:'data:image/png;base64,YQ=='});assert.match((await finished(f.service,picture.id)).error,/nem fogad képet/);assert(!f.calls.some(c=>c.body?.options||c.route==='/api/pull'));
 }finally{f.service.close();}
});
test('busy generation blocks new inference and low free VRAM chooses CPU without changing the requested task',async()=>{
 const f=fixture();let busy=true;const service=createAssistantService({fetchImpl:f.fetchImpl,isGenerationBusy:async()=>busy,memoryAvailable:async()=>0});try{let j=await service.request({action:'start',model,text:'scene'});assert.match((await finished(service,j.id)).error,/motor dolgozik/);assert(!f.calls.some(c=>c.body?.options));busy=false;j=await service.request({action:'start',model,text:'scene'});assert.equal((await finished(service,j.id)).execution,'cpu');}finally{service.close();f.service.close();}
});
test('generation handoff cancels the active helper, waits for unload and prevents concurrent helper requests',async()=>{
 const f=fixture({blocked:true});try{const j=await f.service.request({action:'start',model,text:'scene'});for(let i=0;i<100&&!f.calls.some(c=>c.body?.options);i++)await tick();await assert.rejects(f.service.request({action:'start',model,text:'second'}),/még dolgozik/);await f.service.releaseForGeneration();assert.equal(f.service.status(j.id).state,'cancelled');assert(f.calls.some(c=>c.route==='/api/ps'));}finally{f.service.close();}
});
test('generation handoff during capability checking prevents a late inference from starting',async()=>{
 const f=fixture();let continueCheck,checking=false;const service=createAssistantService({fetchImpl:async(url,options)=>{if(url.endsWith('/api/show')){checking=true;await new Promise(r=>continueCheck=r);}return f.fetchImpl(url,options);}});
 try{const j=await service.request({action:'start',model,text:'scene'});for(let i=0;i<100&&!checking;i++)await tick();assert(checking);await service.releaseForGeneration();continueCheck();assert.equal((await finished(service,j.id)).state,'cancelled');assert(!f.calls.some(c=>c.body?.options));}finally{continueCheck?.();service.close();f.service.close();}
});
test('truncated and disconnected responses are failed, never ready to apply; release failure stays visible and blocks handoff',async()=>{
 for(const chunks of ['{"response":"partial"}\n','{"response":"cut off","done":true,"done_reason":"length"}\n']){const f=fixture({chunks});try{const j=await f.service.request({action:'start',model,text:'scene'});assert.equal((await finished(f.service,j.id)).state,'failed');}finally{f.service.close();}}
 const f=fixture({unloadFails:true});try{const j=await f.service.request({action:'start',model,text:'scene'});assert.match((await finished(f.service,j.id)).error,/memória átadása/);await assert.rejects(f.service.releaseForGeneration(),/unload refused/);}finally{f.service.close();}
});
