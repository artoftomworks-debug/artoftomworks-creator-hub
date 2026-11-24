import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import * as P from '../profiles.mjs';import {atomicJSON} from '../storage.mjs';
const res=()=>{const r={headers:{},setHeader(k,v){r.headers[k]=v;}};return r;};
const reqWith=r=>({headers:{cookie:String(r.headers['Set-Cookie']||'').split(';')[0]}});
test('profiles: first admin, users, sessions, visibility, data paths, run tagging',async()=>{const root=await mkdtemp(path.join(tmpdir(),'prof-'));try{
 await P.initProfiles(root);assert.equal(P.profilesEnabled(),false);assert.equal(P.visibleTo(''),true);
 const r1=res();const a=(await P.createProfile({headers:{}},r1,{name:'Tamás',password:'titok123'})).profile;assert.equal(a.role,'admin');assert.ok(a.primary);
 const adminReq=reqWith(r1);assert.equal(P.profileFor(adminReq).id,a.id);
 await assert.rejects(P.createProfile({headers:{}},res(),{name:'X',password:'1234'}),/rendszergazda/);
 const k=(await P.createProfile(adminReq,res(),{name:'Kati',password:'abcd',role:'child'})).profile;assert.equal(k.role,'child');
 await assert.rejects(P.login({headers:{}},res(),{id:k.id,password:'rossz'}),/Hibás/);
 const r2=res();await P.login({headers:{}},r2,{id:k.id,password:'abcd'});const kidReq=reqWith(r2);assert.equal(P.profileFor(kidReq).name,'Kati');
 // adat- és kimeneti útvonalak
 P.profileContext.run(P.profileFor(adminReq),()=>{assert.equal(P.profileDataFile(root,'draft.json'),path.join(root,'data','draft.json'));assert.equal(P.profileOutputSegment(),'');assert.ok(P.visibleTo(''));assert.ok(!P.visibleTo(k.id));});
 P.profileContext.run(P.profileFor(kidReq),()=>{assert.equal(P.profileDataFile(root,'draft.json'),path.join(root,'data','profiles',k.id,'draft.json'));assert.equal(P.profileOutputSegment(),'/Profil_Kati');assert.ok(!P.visibleTo(''));assert.ok(P.visibleTo(k.id));});
 // új futásfájl jelölése a gyerek profiljával
 const run={schema:'artoftomworks.scene-dna.run',id:'a'.repeat(32)};await P.runAs(k.id,()=>atomicJSON(path.join(root,'data','runs','a'.repeat(32)+'.json'),run));assert.equal(JSON.parse(await readFile(path.join(root,'data','runs','a'.repeat(32)+'.json'),'utf8')).profile,k.id);
 const run2={schema:'artoftomworks.scene-dna.run',id:'b'.repeat(32)};await P.runAs(a.id,()=>atomicJSON(path.join(root,'data','runs','b'.repeat(32)+'.json'),run2));assert.equal(run2.profile,undefined);
 // a gyerek nem kezelhet profilokat, nem törölhet
 await assert.rejects(P.deleteProfile(kidReq,res(),{id:a.id,password:'abcd'}),/rendszergazda/);
 await assert.rejects(P.disableProfiles(adminReq,res(),{password:'titok123'}),/többi profilt/);
 await P.deleteProfile(adminReq,res(),{id:k.id,password:'titok123'});assert.equal(P.profileFor(kidReq),null);
 await P.logout(adminReq,res());assert.equal(P.profileFor(adminReq),null);
 const r3=res();await P.login({headers:{}},r3,{id:a.id,password:'titok123'});await P.disableProfiles(reqWith(r3),res(),{password:'titok123'});assert.equal(P.profilesEnabled(),false);
}finally{await rm(root,{recursive:true,force:true});}});
