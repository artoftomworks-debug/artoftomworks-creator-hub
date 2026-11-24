// 0.16 DEV — a busy ComfyUI must not be reported as a failed start ("A ComfyUI indítása túl sokáig tart").
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {EventEmitter} from 'node:events';
import {createEngine} from '../engine.mjs';
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'hub-engine-'));const dir=path.join(root,'ComfyUI');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'main.py'),'');const py=path.join(root,'python.exe');await writeFile(py,'');
 await mkdir(path.join(root,'data'),{recursive:true});await writeFile(path.join(root,'data','engine.json'),JSON.stringify({schema:'artoftomworks.creator-hub.engine',version:1,mode:'managed',directory:dir,python:py,port:8191}));return root;}
function harness(root,{startupMS=1000}={}){let alive=false,clock=0;const spawned=[];
 const fetchImpl=async url=>{if(!alive)throw Error('down');if(url.endsWith('/system_stats'))return new Response(JSON.stringify({system:{},devices:[]}));return new Response(JSON.stringify({queue_running:[],queue_pending:[]}));};
 const spawnProcess=()=>{const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.pid=4242;p.kill=()=>p.emit('exit',0,null);spawned.push(p);return p;};
 const engine=createEngine({root,fetchImpl,spawnProcess,portAvailable:async()=>true,startupMS,now:()=>clock});
 return {engine,spawned,set alive(v){alive=v},tick(ms){clock+=ms}};}
test('own engine: once ready, a missed health check while busy keeps it ready (no false start-up error)',async()=>{
 const h=harness(await setup());h.alive=false;await h.engine.start();assert.equal(h.spawned.length,1);
 h.alive=true;h.tick(2000);let s=await h.engine.status();assert.equal(s.state,'ready');
 h.alive=false;for(let i=0;i<5;i++){h.tick(10_000);s=await h.engine.status();}
 assert.equal(s.state,'ready');assert.equal(s.error,'');
 h.alive=true;h.tick(1000);s=await h.engine.status();assert.equal(s.state,'ready');});
test('own engine that never came up still reports the start-up timeout',async()=>{
 const h=harness(await setup(),{startupMS:5000});h.alive=false;await h.engine.start();h.tick(6000);const s=await h.engine.status();
 assert.equal(s.state,'error');assert.match(s.error,/túl sokáig tart/);});
test('a real crash is still reported (exit handler)',async()=>{
 const h=harness(await setup());await h.engine.start();h.alive=true;h.tick(1000);await h.engine.status();
 h.alive=false;h.spawned[0].emit('exit',1,null);h.tick(1000);const s=await h.engine.status();assert.equal(s.state,'error');assert.match(s.error,/leállt/);});
test('external engine: one miss is tolerated, three in a row mean stopped',async()=>{
 const h=harness(await setup());h.alive=true;await h.engine.start();assert.equal(h.spawned.length,0);
 h.alive=false;h.tick(1000);let s=await h.engine.status();assert.equal(s.state,'ready');h.tick(1000);s=await h.engine.status();assert.equal(s.state,'ready');
 h.tick(1000);s=await h.engine.status();assert.equal(s.state,'stopped');});
