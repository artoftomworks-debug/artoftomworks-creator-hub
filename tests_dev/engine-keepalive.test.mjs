// 0.16 DEV — a ComfyUI túléli a Hub újraindítását: leválasztva indul, a PID-et elmentjük, az új Hub visszaveszi.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat} from 'node:fs/promises';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {EventEmitter} from 'node:events';
import {createEngine,readTail} from '../engine.mjs';
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'hub-keep-'));const dir=path.join(root,'ComfyUI');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'main.py'),'');const py=path.join(root,'python.exe');await writeFile(py,'');
 await mkdir(path.join(root,'data'),{recursive:true});await writeFile(path.join(root,'data','engine.json'),JSON.stringify({schema:'artoftomworks.creator-hub.engine',version:1,mode:'managed',directory:dir,python:py,port:8191}));return root;}
function world(){const w={alive:false,pids:new Set(),killed:[],spawnOpts:null};
 w.fetchImpl=async url=>{if(!w.alive)throw Error('down');if(url.endsWith('/system_stats'))return new Response(JSON.stringify({system:{},devices:[]}));return new Response(JSON.stringify({queue_running:[],queue_pending:[]}));};
 w.spawnProcess=(cmd,args,o)=>{w.spawnOpts=o;if(typeof o.stdio[1]==='number')fs.writeSync(o.stdio[1],'ComfyUI starting\n');const p=new EventEmitter();p.pid=5151;p.unref=()=>{w.unrefd=true;};p.kill=()=>{};w.pids.add(5151);return p;};
 w.opts=root=>({root,fetchImpl:w.fetchImpl,spawnProcess:w.spawnProcess,portAvailable:async()=>true,processAlive:pid=>w.pids.has(pid),processName:async()=>'python.exe',killProcess:async pid=>{w.killed.push(pid);w.pids.delete(pid);w.alive=false;},platform:'win32'});
 return w;}
test('spawned detached, logs to file, PID saved; close() leaves it running',async()=>{
 const root=await setup(),w=world(),e=createEngine(w.opts(root));await e.start();
 assert.equal(w.spawnOpts.detached,true);assert.ok(w.unrefd);
 const saved=JSON.parse(await readFile(path.join(root,'data','engine-process.json'),'utf8'));assert.equal(saved.pid,5151);assert.equal(saved.port,8191);
 w.alive=true;const s=await e.status();assert.equal(s.state,'ready');assert.equal(s.owned,true);assert.match(s.logs,/ComfyUI starting/);
 e.close();assert.deepEqual(w.killed,[]);});
test('a new Hub adopts the running ComfyUI (no second start) and can stop it',async()=>{
 const root=await setup(),w=world();await createEngine(w.opts(root)).start();w.alive=true;
 let spawns=0;const e2=createEngine({...w.opts(root),spawnProcess:(...a)=>{spawns++;return w.spawnProcess(...a);}});
 const s=await e2.start();assert.equal(spawns,0);assert.equal(s.state,'ready');assert.equal(s.owned,true);assert.equal(s.adopted,true);assert.equal(s.pid,5151);assert.match(s.logs,/ComfyUI starting/);
 const after=await e2.stop();assert.deepEqual(w.killed,[5151]);assert.equal(after.state,'stopped');
 await assert.rejects(stat(path.join(root,'data','engine-process.json')));});
test('stale PID file (process gone) is ignored: external ComfyUI on the port is not owned',async()=>{
 const root=await setup(),w=world();await writeFile(path.join(root,'data','engine-process.json'),JSON.stringify({pid:999,port:8191}));w.alive=true;
 const s=await createEngine(w.opts(root)).start();assert.equal(s.owned,false);await assert.rejects(stat(path.join(root,'data','engine-process.json')));});
test('PID reused by another program: nothing is killed',async()=>{
 const root=await setup(),w=world();await createEngine(w.opts(root)).start();w.alive=true;
 const e2=createEngine({...w.opts(root),processName:async()=>'chrome.exe'});await e2.start();const s=await e2.stop();
 assert.deepEqual(w.killed,[]);assert.equal(s.state,'error');assert.match(s.error,/chrome\.exe/);});
test('adopted ComfyUI that dies is reported',async()=>{
 const root=await setup(),w=world();await createEngine(w.opts(root)).start();w.alive=true;let t=0;
 const e2=createEngine({...w.opts(root),now:()=>t});await e2.start();w.alive=false;w.pids.clear();t+=5000;const s=await e2.status();
 assert.equal(s.state,'error');assert.match(s.error,/leállt/);assert.equal(s.owned,false);});
test('readTail reads only the end after an offset, without colour codes',async()=>{const f=path.join(await mkdtemp(path.join(os.tmpdir(),'tail-')),'x.log');await writeFile(f,'old\nnew\x1b[32m!\x1b[0m');assert.equal(readTail(f,4),'new!');await writeFile(f,'abcdef');assert.equal(readTail(f,0,2),'ef');});
