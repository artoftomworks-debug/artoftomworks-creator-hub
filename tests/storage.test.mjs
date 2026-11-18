import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rename,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {atomicJSON} from '../storage.mjs';
const base=path.resolve('./tests/.runtime');await mkdir(base,{recursive:true});
test('atomic persistence retries temporary Windows locks, orders concurrent writes and preserves the previous record on permanent failure',async()=>{
 const root=await mkdtemp(path.join(base,'storage-')),file=path.join(root,'record.json');try{
  await writeFile(file,JSON.stringify({value:'old'}));let attempts=0;
  const locked=async(...args)=>{if(attempts++<2)throw Object.assign(Error('Locked'),{code:'EPERM'});return rename(...args);};
  await Promise.all([atomicJSON(file,{value:1},{renameFile:locked,delays:[0,0,0]}),atomicJSON(file,{value:2})]);assert.equal(attempts,3);assert.equal(JSON.parse(await readFile(file,'utf8')).value,2);
  await assert.rejects(atomicJSON(file,{value:3},{renameFile:async()=>{throw Object.assign(Error('Locked'),{code:'EPERM'});},delays:[0]}),/Locked/);assert.equal(JSON.parse(await readFile(file,'utf8')).value,2);assert.deepEqual(await readdir(root),['record.json']);
  await atomicJSON(file,{value:4});assert.equal(JSON.parse(await readFile(file,'utf8')).value,4);
 }finally{await rm(root,{recursive:true,force:true});}
});
