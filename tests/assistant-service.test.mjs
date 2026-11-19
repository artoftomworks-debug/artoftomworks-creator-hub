import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantService,DEEPSEEK_MODEL,assistantInstruction,cleanAssistantText,assistantContext,nextAssistantContext,assistantImageMessage,isAssistantEcho} from '../assistant-service.mjs';
const model='fixture-local:4b',tick=()=>new Promise(r=>setTimeout(r,2));
async function finished(service,id){for(let i=0;i<1500;i++){const s=service.status(id);if(['complete','failed','cancelled'].includes(s.state))return s;await tick();}throw Error('Fixture job timed out');}
function fixture({caps=['completion','thinking','vision'],chunks,blocked=false,unloadFails=false,modelInfo={},contextNeeded=0,streamOverflow=false}={}){
 const calls=[];let gpu=false;
 const fetchImpl=async(url,options={})=>{const route=new URL(url).pathname,b=options.body?JSON.parse(options.body):null;calls.push({route,body:b});
  if(route==='/api/tags')return Response.json({models:[{name:model,size:1024},{name:'fake-local',remote_model:'cloud-remote'},{name:'remote:cloud'}]});
  if(route==='/api/show')return Response.json({capabilities:caps,model_info:modelInfo});
  if(route==='/api/ps')return Response.json({models:gpu?[{name:model,size_vram:1024}]:[]});
  if(route==='/api/pull')return new Response('{"status":"pulling","total":100,"completed":50}\n{"status":"success"}\n');
  assert(['/api/generate','/api/chat'].includes(route));if(!b.options){assert.equal(route,'/api/generate');if(unloadFails)return Response.json({error:'unload refused'},{status:500});gpu=false;return Response.json({done:true});}
  gpu=b.options.num_gpu!==0;
  if(b.options.num_ctx<contextNeeded){const error=`request (${contextNeeded} tokens) exceeds the available context size (${b.options.num_ctx} tokens), try increasing it`;return streamOverflow?new Response(JSON.stringify({error})+'\n'):Response.json({error},{status:500});}
  if(blocked)return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"response":"partial"}\n'));options.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}}));
  let text=chunks||JSON.stringify({response:'Árvíztűrő jelenet',done:true,eval_count:20,eval_duration:1e9})+'\n';if(route==='/api/chat')text=text.trim().split('\n').map(line=>{const d=JSON.parse(line);if(d.response!==undefined){d.message={role:'assistant',content:d.response};delete d.response;}return JSON.stringify(d);}).join('\n')+'\n';const bytes=new TextEncoder().encode(text);
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

test('image context includes reply space, text stays small and model limits bound allocation',()=>{
 assert.deepEqual(assistantContext(),{size:4096,limit:16384});
 assert.equal(assistantContext({hasImage:true}).size,8192);
 assert.equal(assistantContext({text:'x'.repeat(18000)}).size,10240);
 assert.equal(assistantContext({hasImage:true,modelInfo:{'general.architecture':'qwen','qwen.context_length':4096}}).size,4096);
 assert.equal(nextAssistantContext('request (4141 tokens) exceeds the available context size (4096 tokens), try increasing it',4096,16384),6144);
 assert.equal(nextAssistantContext('request (17000 tokens) exceeds the available context size (8192 tokens)',8192,16384),null);
 assert.equal(nextAssistantContext('out of memory',8192,16384),null);
});

test('reported 4141-token picture succeeds for different vision models without overflowing the old 4k ceiling',async()=>{
 for(const caps of [['completion','vision'],['completion','vision','thinking']]){
  const f=fixture({caps,contextNeeded:4141});try{
   const j=await f.service.request({action:'start',model,task:'describe',image:'data:image/png;base64,YQ==',execution:'cpu'});
   const r=await finished(f.service,j.id);assert.equal(r.state,'complete');assert.equal(r.execution,'cpu');
   const requests=f.calls.filter(c=>c.body?.options);assert.equal(requests.length,1);assert.equal(requests[0].route,'/api/chat');assert.equal(requests[0].body.options.num_ctx,8192);assert.equal(requests[0].body.options.num_predict,800);assert.deepEqual(requests[0].body.messages[1].images,['YQ==']);assert.equal(requests[0].body.messages[0].role,'system');
  }finally{f.service.close();}
 }
});

test('precise context overflow retries both HTTP and streamed failures with reserved reply space',async()=>{
 for(const streamOverflow of [false,true]){const f=fixture({contextNeeded:9000,streamOverflow});try{
  const j=await f.service.request({action:'start',model,task:'describe',image:'data:image/png;base64,YQ=='});
  assert.equal((await finished(f.service,j.id)).state,'complete');
  assert.deepEqual(f.calls.filter(c=>c.body?.options).map(c=>c.body.options.num_ctx),[8192,10240]);
  assert(f.calls.some(c=>c.route==='/api/ps'));
 }finally{f.service.close();}}
});

test('model context ceiling and excessive image tokens fail clearly without retry loops; memory is released',async()=>{
 for(const config of [{contextNeeded:4141,modelInfo:{'general.architecture':'fixture','fixture.context_length':4096}},{contextNeeded:20000}]){
  const f=fixture(config);try{const j=await f.service.request({action:'start',model,task:'describe',image:'data:image/png;base64,YQ=='});
   const r=await finished(f.service,j.id);assert.equal(r.state,'failed');assert.match(r.error,/feldolgozási keretében/);
   assert.equal(f.calls.filter(c=>c.body?.options).length,1);assert(f.calls.some(c=>c.route==='/api/ps'));
  }finally{f.service.close();}
 }
});

test('a partial answer or unrelated backend error must never trigger a context retry',async()=>{
 for(const chunks of ['{"response":"partial"}\n{"error":"request (9000 tokens) exceeds the available context size (8192 tokens)"}\n','{"error":"out of memory"}\n']){
  const f=fixture({chunks});try{const j=await f.service.request({action:'start',model,text:'scene'});assert.equal((await finished(f.service,j.id)).state,'failed');assert.equal(f.calls.filter(c=>c.body?.options).length,1);}finally{f.service.close();}
 }
});

test('image description asks for visible content explicitly instead of treating old prompt as the caption',async()=>{
 const source='A quiet mountain lake at sunrise.';const content=assistantImageMessage({task:'describe',text:source});
 assert.match(content,/Inspect the attached image/);assert.match(content,/Optional user context/);assert(content.endsWith(source));assert.notEqual(content,source);
 assert(isAssistantEcho(' "A QUIET mountain lake at sunrise!" ',source));assert(!isAssistantEcho('A red circle on a blue background.',source));
 const f=fixture();try{const j=await f.service.request({action:'start',task:'describe',model,text:source,image:'data:image/png;base64,YQ=='});assert.equal((await finished(f.service,j.id)).state,'complete');const body=f.calls.find(c=>c.route==='/api/chat').body;assert.equal(body.messages[1].content,content);assert.equal(body.prompt,undefined);assert.equal(body.images,undefined);}finally{f.service.close();}
});

test('echoed source text is never available as a completed image description; refinement can intentionally preserve text',async()=>{
 const text='A quiet mountain lake at sunrise.',f=fixture({chunks:JSON.stringify({response:text,done:true})+'\n'});try{
  let j=await f.service.request({action:'start',task:'describe',model,text,image:'data:image/png;base64,YQ=='});let r=await finished(f.service,j.id);assert.equal(r.state,'failed');assert.equal(r.text,'');assert.match(r.error,/visszamásolta/);
  j=await f.service.request({action:'start',task:'refine',model,text});r=await finished(f.service,j.id);assert.equal(r.state,'complete');assert.equal(r.text,text);
 }finally{f.service.close();}
});

test('stop arriving before start prevents the delayed request from loading or running any model',async()=>{
 const f=fixture(),id='a'.repeat(32);try{
  const stopped=await f.service.request({action:'cancel',id});assert.equal(stopped.state,'cancelled');
  const j=await f.service.request({action:'start',id,model,text:'Wrong task'});assert.equal(j.state,'cancelled');assert.equal(f.calls.length,0);
  await assert.rejects(f.service.request({action:'start',id,model,text:'duplicate'}),/azonosító/);
  const next=await f.service.request({action:'start',id:'b'.repeat(32),model,task:'scene',text:'New scene'});assert.equal((await finished(f.service,next.id)).state,'complete');
 }finally{f.service.close();}
});

test('stop aborts capability lookup before inference and allows selecting a different task afterward',async()=>{
 const f=fixture();let checking=false;const service=createAssistantService({fetchImpl:async(url,options)=>{
  if(url.endsWith('/api/show')){checking=true;await new Promise((resolve,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});}
  return f.fetchImpl(url,options);
 }});try{
  const j=await service.request({action:'start',model,text:'Wrong task'});for(let i=0;i<100&&!checking;i++)await tick();assert(checking);
  await service.request({action:'cancel',id:j.id});assert.equal((await finished(service,j.id)).state,'cancelled');assert(!f.calls.some(c=>c.body?.options));
 }finally{service.close();f.service.close();}
});
