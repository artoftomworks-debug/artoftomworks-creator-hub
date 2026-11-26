// 0.17 — a sorfájl kicsi marad: a nagy kezdőkép külön fájlba kerül, induláskor visszakerül a tervbe
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createGenerationManager} from '../generation-manager.mjs';
test('large start image is stored outside the queue file and restored for the run',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'qi-'));let prepared=null;
 const runner={stop:async()=>({}),status:async id=>({id,autoRun:false,jobs:[{state:'planned'}]}),prepare:async p=>{prepared=p;return {id:'r1',contextKey:'k',jobs:[]};},start:async()=>({})};
 const big='data:image/png;base64,'+'A'.repeat(300000);const g=createGenerationManager({root,runner,pollMS:100000});
 await g.enqueue({shots:[{id:'s1',controls:{}}],title:'t',backend:'b',image:big});await g.enqueue({shots:[{id:'s2',controls:{}}],title:'u',backend:'b',image:big});
 const q=fs.readFileSync(path.join(root,'data','generation-queue.json'),'utf8');assert.ok(q.length<20000,'queue file stays small: '+q.length);assert.ok(q.includes('queue-image:'));
 assert.equal(fs.readdirSync(path.join(root,'data','queue-images')).length,1,'same image stored once');
 await g.tick();assert.equal(prepared?.image,big);g.close();});
test('paused plans older than 12 hours are discarded on start; newer ones stay paused',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'qs-'));const now=Date.now();fs.mkdirSync(path.join(root,'data'),{recursive:true});
 fs.writeFileSync(path.join(root,'data','generation-queue.json'),JSON.stringify({schema:'creator-hub.generation-queue',version:1,armed:false,current:'r-old',entries:[{id:'old',state:'paused',created:now-13*3600e3,runId:'r-old',plan:{title:'a'}},{id:'new',state:'running',created:now-3600e3,plan:{title:'b'}},{id:'done',state:'complete',created:now-20*3600e3}]}));
 const runner={stop:async()=>({}),status:async()=>null,prepare:async()=>({}),start:async()=>({})};const g=createGenerationManager({root,runner,pollMS:100000});const st=await g.status();g.close();
 assert.deepEqual(st.entries.map(e=>[e.id,e.state]),[['old','interrupted'],['new','paused'],['done','complete']]);assert.equal(st.current,null);});
