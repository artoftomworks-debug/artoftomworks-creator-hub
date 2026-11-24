import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {cleanIdea,createIdeas} from '../ideas.mjs';
test('cleanIdea validates text, tags and image',()=>{assert.throws(()=>cleanIdea({text:'  '}));const i=cleanIdea({text:' ködös kikötő ',tags:['kép','x','kép'],image:'javascript:alert(1)',ref:'zz'});assert.equal(i.text,'ködös kikötő');assert.deepEqual(i.tags,['kép']);assert.equal(i.image,'');assert.equal(i.ref,'');assert.match(i.id,/^[a-f0-9-]{36}$/);
 const j=cleanIdea({image:'data:image/jpeg;base64,AAAA',ref:'a'.repeat(32)});assert.equal(j.image,'data:image/jpeg;base64,AAAA');assert.equal(j.ref,'a'.repeat(32));});
test('ideas store saves, updates, sorts and removes',async()=>{const root=await mkdtemp(path.join(tmpdir(),'ideas-'));try{const s=createIdeas({root});const a=(await s.save({idea:{text:'egy'}})).idea;await new Promise(r=>setTimeout(r,5));const b=(await s.save({idea:{text:'kettő'}})).idea;
 let l=(await s.list()).ideas;assert.deepEqual(l.map(x=>x.text),['kettő','egy']);await s.save({idea:{...b,done:true}});l=(await s.list()).ideas;assert.deepEqual(l.map(x=>x.text),['egy','kettő']);assert.equal(l.length,2);
 await s.remove({id:a.id});assert.equal((await s.list()).ideas.length,1);}finally{await rm(root,{recursive:true,force:true});}});
