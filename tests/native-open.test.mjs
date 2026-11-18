import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {openInExplorer} from '../native-open.mjs';
function child(result,code=0){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.kill=()=>{};queueMicrotask(()=>{c.stdout.end(JSON.stringify(result));c.emit('close',code);});return c;}
test('Explorer requires a confirmed visible shell window and safely passes Unicode paths as data',async()=>{
 const file='C:\\Képek és videók\\kép, teszt & kész.png',calls=[];
 const spawnImpl=(...args)=>{calls.push(args);return child({opened:true,visible:true,selected:true});};
 assert.equal((await openInExplorer(file,{platform:'win32',spawnImpl})).visible,true);
 assert.equal(calls[0][0],'powershell.exe');assert(calls[0][1].includes('-STA'));assert.equal(Buffer.from(calls[0][1].at(-1),'base64').toString('utf8'),file);assert.equal(calls[0][2].shell,false);assert.equal(calls[0][2].windowsHide,true,'only the helper console is hidden; the shell verifies the Explorer window');
 await openInExplorer('C:\\Képek',{directory:true,platform:'win32',spawnImpl});assert.equal(calls[1][1].at(-1),'-Directory');
});
test('Explorer rejects unverified launches, reports Windows errors and refuses invalid paths',async()=>{
 let launched=false;const spawnImpl=()=>{launched=true;return child({error:'No visible Explorer window'},1);};
 for(const target of ['relative.png','C:\\bad"file.png','C:\\bad\nfile.png'])await assert.rejects(openInExplorer(target,{platform:'win32',spawnImpl}),/útvonal/);
 assert.equal(launched,false);await assert.rejects(openInExplorer('C:\\image.png',{platform:'win32',spawnImpl}),/No visible/);
 await assert.rejects(openInExplorer('C:\\image.png',{platform:'win32',spawnImpl:()=>child({opened:true})}),/nem igazolta/);
 await assert.rejects(openInExplorer('/image.png',{platform:'linux',spawnImpl}),/másolását/);
});
