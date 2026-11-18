import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createEngine,findInstallations} from '../engine.mjs';
const base=path.resolve('./tests/.runtime');await mkdir(base,{recursive:true});
async function setup(){const root=await mkdtemp(path.join(base,'engine-')),directory=path.join(root,'ComfyUI'),python=path.join(directory,'venv','Scripts','python.exe');await mkdir(path.dirname(python),{recursive:true});await writeFile(path.join(directory,'main.py'),'# fixture');await writeFile(python,'fixture');return {root,directory,python};}
function fixture(){let ready=false,running=0;const spawned=[];return {spawned,ready(v){ready=v;},running(v){running=v;},fetchImpl:async url=>{if(!ready)throw Error('offline');if(url.endsWith('/system_stats'))return Response.json({system:{os:'test'},devices:[]});if(url.endsWith('/queue'))return Response.json({queue_running:Array(running).fill([]),queue_pending:[]});throw Error('No generation endpoint allowed in this test');},spawnProcess:(exe,args,options)=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=12345;child.killed=false;child.kill=()=>{child.killed=true;ready=false;child.emit('exit',0,null);};spawned.push({exe,args,options,child});return child;}};}

test('managed engine launches only the selected existing Python and ComfyUI, waits for readiness, scopes stop and preserves settings',async()=>{
 const install=await setup(),f=fixture(),engine=createEngine({...install,...f,roots:async()=>[{path:install.directory}],portAvailable:async()=>true});try{
  assert.equal((await engine.status()).state,'stopped');await engine.configure({directory:install.directory,mode:'managed',port:8190});
  await Promise.all([engine.start(),engine.start()]);assert.equal(f.spawned.length,1);const p=f.spawned[0];assert.equal(p.exe,install.python);assert.equal(p.options.windowsHide,true);assert.equal(p.options.cwd,install.directory);assert.ok(p.args.includes('--disable-auto-launch'));assert.ok(p.args.includes('127.0.0.1'));assert.ok(!p.args.join(' ').includes('SwarmUI'));assert.equal((await engine.status(false)).state,'starting');
  p.child.stderr.write('Loading nodes\n');assert.match((await engine.status(false)).logs,/Loading nodes/);f.ready(true);await new Promise(r=>setTimeout(r,810));const s=await engine.status();assert.equal(s.state,'ready');assert.equal(s.owned,true);f.running(1);await assert.rejects(engine.stop(),/dolgozik/);assert.equal(p.child.killed,false);f.running(0);await engine.stop();assert.equal(p.child.killed,true);
  const saved=JSON.parse(await readFile(path.join(install.root,'data','engine.json'),'utf8'));assert.equal(saved.python,install.python);assert.equal(saved.mode,'managed');
 }finally{engine.close();await rm(install.root,{recursive:true,force:true});}
});

test('an already running ComfyUI is reused without spawning or killing someone else’s engine; external mode never spawns',async()=>{
 const install=await setup(),f=fixture(),engine=createEngine({...install,...f});try{f.ready(true);assert.equal((await engine.start()).owned,false);assert.equal(f.spawned.length,0);await assert.rejects(engine.stop(),/Csak az/);await engine.configure({mode:'external'});f.ready(false);await engine.start();assert.equal(f.spawned.length,0);engine.close();}finally{await rm(install.root,{recursive:true,force:true});}
});

test('startup failure, timeout, occupied ports and invalid executable are explicit; engine start never submits a generation',async()=>{
 const install=await setup(),f=fixture();let now=10000;const engine=createEngine({...install,...f,now:()=>now,startupMS:100,portAvailable:async p=>p===8192});try{
  await assert.rejects(engine.configure({mode:'managed',directory:install.directory,python:path.join(install.directory,'cmd.exe')}),/Python/);await engine.configure({...install,mode:'managed',port:8190});const s=await engine.start();assert.equal(s.config.port,8192);now+=2000;assert.equal((await engine.status()).state,'error');await engine.start();assert.equal(f.spawned.length,1,'timeout must not spawn another process over the still-running one');
  f.spawned[0].child.emit('exit',1,null);assert.equal((await engine.status(false)).state,'error');assert.match((await engine.status(false)).error,/leállt/);
 }finally{engine.close();await rm(install.root,{recursive:true,force:true});}
});

test('installation discovery derives the virtual environment from library roots, including portable layouts',async()=>{
 const install=await setup();try{const list=await findInstallations([{path:path.join(install.directory,'models')}]);assert.ok(list.some(v=>v.directory===install.directory&&v.python===install.python));}finally{await rm(install.root,{recursive:true,force:true});}
});
