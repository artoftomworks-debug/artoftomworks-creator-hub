// 0.16 DEV — storyboard
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {cleanBoard,shotProject,shotIndexOf,shotPrompt} from '../storyboard-model.mjs';
import {createStoryboards} from '../storyboard.mjs';
test('board cleaning: name required, limits, defaults',()=>{assert.throws(()=>cleanBoard({name:'  '}),/nevet/);const b=cleanBoard({name:'Eső',seed:42,shots:[{text:'a',duration:99},{text:'b',seedOffset:-3}]});assert.equal(b.seed,42);assert.equal(b.shots[0].duration,30);assert.equal(b.shots[1].seedOffset,0);assert.ok(b.shots[0].id);});
test('project name round-trip and prompt with shared style',()=>{const b=cleanBoard({name:'Eső',style:'cinematic, 35mm',shots:[{text:'a nő az ablaknál'}]});assert.equal(shotProject(b,0),'Storyboard · Eső · 1. jelenet');assert.equal(shotIndexOf('Storyboard · Eső · 12. jelenet',b),11);assert.equal(shotIndexOf('Storyboard · Más · 1. jelenet',b),-1);assert.equal(shotPrompt(b,b.shots[0]),'a nő az ablaknál, cinematic, 35mm');});
test('store: save, list newest first, delete',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'sb-'));const s=createStoryboards({root});const a=(await s.save({board:{name:'A',shots:[]}})).board;await new Promise(r=>setTimeout(r,5));await s.save({board:{name:'B',shots:[]}});assert.deepEqual((await s.list()).boards.map(b=>b.name),['B','A']);await s.remove({id:a.id});assert.deepEqual((await s.list()).boards.map(b=>b.name),['B']);});
