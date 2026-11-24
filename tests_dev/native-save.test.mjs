// 0.16 DEV — "Máshova…" uses the Windows Save-as dialog through PowerShell (no shell, arguments base64-encoded).
import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {chooseSavePath} from '../native-open.mjs';
function fakeSpawn(output,calls){return (cmd,args,opts)=>{calls.push({cmd,args,opts});const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>{};setTimeout(()=>{p.stdout.emit('data',Buffer.from(output));p.emit('close',0);},5);return p;};}
test('returns the chosen path; arguments are base64, no shell',async()=>{const calls=[];const r=await chooseSavePath('a "b".json',{folder:'C:\\x',platform:'win32',spawnImpl:fakeSpawn('{"chosen":true,"path":"D:\\\\Mentes\\\\a.json"}',calls)});
 assert.equal(r,'D:\\Mentes\\a.json');assert.equal(calls[0].opts.shell,false);assert.ok(calls[0].args.includes(Buffer.from('a "b".json').toString('base64')));});
test('cancel → null; other platforms → clear error',async()=>{assert.equal(await chooseSavePath('a.json',{platform:'win32',spawnImpl:fakeSpawn('{"chosen":false}',[])}),null);
 await assert.rejects(chooseSavePath('a.json',{platform:'linux'}),/Windows-on/);});
