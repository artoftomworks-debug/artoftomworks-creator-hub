import test from 'node:test';import assert from 'node:assert/strict';
import {createHubRestart,hubBusyReason} from '../hub-restart.mjs';
const idle={generation:{status:async()=>({armed:false,entries:[]})},nodeUpdates:{status:async()=>({active:false})},engine:{status:async()=>({backend:'',owned:false})}};
test('busy: running generation blocks restart',async()=>{
  const r=await hubBusyReason({...idle,generation:{status:async()=>({armed:true,entries:[]})}});assert.match(r,/generál/);
  const q=await hubBusyReason({...idle,engine:{status:async()=>({backend:'http://127.0.0.1:8191'})},fetchImpl:async()=>({ok:true,json:async()=>({queue_running:[[1]],queue_pending:[]})})});assert.match(q,/ComfyUI/);
  const u=await hubBusyReason({...idle,nodeUpdates:{status:async()=>({active:true})}});assert.match(u,/node-csomag/);
  assert.equal(await hubBusyReason(idle),'');
});
test('restart: refuses when busy, otherwise spawns waiter, KEEPS the engine running, exits',async()=>{
  let spawned=null,exited=false,stopped=false;
  const busy=createHubRestart({...idle,generation:{status:async()=>({armed:false,entries:[{state:'running'}]})},spawnImpl:()=>{throw Error('no');},exit:()=>{exited=true;},log:null});
  await assert.rejects(busy.restart({port:18901}),/Most nem indítom újra/);assert.equal(exited,false);
  const h=createHubRestart({...idle,engine:{status:async()=>({owned:true}),stop:async()=>{stopped=true;}},spawnImpl:(cmd,args,o)=>{spawned={cmd,args,o};return {on(){},unref(){}};},serverFile:'/x/server.mjs',dir:'/x',exit:()=>{exited=true;},log:null});
  assert.deepEqual(await h.restart({port:18905}),{restarting:true});
  await new Promise(r=>setTimeout(r,450));
  assert.equal(spawned.args[0],'-e');assert.equal(spawned.o.env.HUB_PORT,'18905');assert.equal(spawned.o.env.HUB_SERVER,'/x/server.mjs');assert.equal(spawned.o.detached,true);
  assert.equal(stopped,false);assert.ok(exited);
  let stopArg=null;const st=createHubRestart({...idle,engine:{status:async()=>({owned:true}),stop:async o=>{stopArg=o;}},spawnImpl:()=>({on(){},unref(){}}),dir:'/x',exit:()=>{},log:null});
  await st.stop();await new Promise(r=>setTimeout(r,450));assert.deepEqual(stopArg,{force:false});
});
test('restart after current work: waits while busy, then restarts; cancel works',async()=>{
  let busy=true,exited=0,spawned=0;
  const gen={status:async()=>({armed:busy,entries:[]})};
  const h=createHubRestart({...idle,generation:gen,spawnImpl:()=>{spawned++;return {on(){},unref(){}};},exit:()=>{exited++;},log:null,pollMS:30});
  const r=await h.restart({port:18901,when:'after'});assert.equal(r.scheduled,true);
  assert.ok((await h.status()).scheduled);
  await new Promise(r=>setTimeout(r,100));assert.equal(exited,0);
  busy=false;await new Promise(r=>setTimeout(r,450));assert.equal(spawned,1);assert.equal(exited,1);
  const h2=createHubRestart({...idle,generation:{status:async()=>({armed:true,entries:[]})},spawnImpl:()=>{throw Error('x');},exit:()=>{throw Error('no');},log:null,pollMS:30});
  await h2.restart({port:1,when:'after'});assert.deepEqual(h2.cancel(),{cancelled:true});assert.equal((await h2.status()).scheduled,null);
});
test('stop: refuses when busy unless forced; forced interrupts ComfyUI; no relaunch',async()=>{
  let exited=0,spawned=0,stopped=0;const calls=[];
  const base={...idle,generation:{status:async()=>({armed:true,entries:[],current:'x'}),stop:async()=>{stopped++;}},engine:{status:async()=>({backend:'http://127.0.0.1:8191',owned:false})},fetchImpl:async(u,o)=>{calls.push((o?.method||'GET')+' '+u);return {ok:true,json:async()=>({queue_running:[],queue_pending:[]})};},spawnImpl:()=>{spawned++;return {on(){},unref(){}};},exit:()=>{exited++;},log:null};
  const h=createHubRestart(base);
  await assert.rejects(h.stop(),/Most nem állítom le/);
  const r=await h.stop({force:true});assert.equal(r.forced,true);await new Promise(r=>setTimeout(r,450));
  assert.equal(stopped,1);assert.ok(calls.includes('POST http://127.0.0.1:8191/interrupt'));assert.equal(spawned,0);assert.equal(exited,1);
});
test('startTray: only on Windows, hidden detached powershell with port and root, output to tray.log',async()=>{
  const {startTray}=await import('../hub-restart.mjs');const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tray-'));let call=null;const spawnImpl=(c,a,o)=>{call={c,a,o};return {on(){},unref(){}};};
  assert.equal(startTray({dir,port:18901,platform:'linux',spawnImpl}),false);
  assert.equal(startTray({dir,port:18901,platform:'win32',spawnImpl}),false);
  fs.writeFileSync(path.join(dir,'Hub-Tray.ps1'),'#');
  assert.equal(startTray({dir,port:18905,platform:'win32',spawnImpl}),true);
  assert.equal(call.c,'powershell.exe');assert.ok(call.a.includes('Hidden'));assert.equal(call.a[call.a.indexOf('-Port')+1],'18905');assert.equal(call.a[call.a.indexOf('-Root')+1],dir);assert.equal(call.o.windowsHide,true);
  assert.ok(fs.existsSync(path.join(dir,'data','logs','tray.log')));
});
