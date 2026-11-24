// 0.16 DEV — a model file deleted outside the Hub disappears from the list without a rescan/restart.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createLibrary} from '../library.mjs';
test('deleted file is dropped from the index on the next listing',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hub-lib-'));const models=path.join(root,'StableDiffusion');await mkdir(models);
 await writeFile(path.join(models,'keep.safetensors'),'x');await writeFile(path.join(models,'gone.safetensors'),'x');
 const lib=createLibrary({root,discover:async()=>[]});await lib.add(models,'checkpoint','test');await lib.start({auto:false});
 for(let i=0;i<100&&(await lib.state()).scan.state==='scanning';i++)await new Promise(r=>setTimeout(r,50));
 let l=await lib.list({kind:'model'});assert.deepEqual(l.items.map(i=>i.name).sort(),['gone.safetensors','keep.safetensors']);
 await rm(path.join(models,'gone.safetensors'));
 l=await lib.list({kind:'model'});assert.deepEqual(l.items.map(i=>i.name),['keep.safetensors']);assert.equal(l.total,1);
 const again=createLibrary({root,discover:async()=>[]});assert.deepEqual((await again.list({kind:'model'})).items.map(i=>i.name),['keep.safetensors'],'the cleaned index is saved');});
