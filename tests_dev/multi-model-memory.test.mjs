import test from 'node:test';import assert from 'node:assert/strict';
import {loadLast,saveLast,stickyMode,clearSticky} from '../multi-model-ui.mjs';
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('last multi-model selection is remembered per mode and marks sticky',()=>{const s=mem();assert.equal(loadLast('image',s),null);saveLast('image',{models:['a','b'],formats:['square'],count:3,same:true},s);const v=loadLast('image',s);assert.deepEqual(v.models,['a','b']);assert.deepEqual(v.formats,['square']);assert.equal(v.count,3);assert.equal(loadLast('video',s),null);assert.equal(stickyMode(s),'image');clearSticky(s);assert.equal(stickyMode(s),'');assert.ok(loadLast('image',s),'selection survives clearing the question');});
test('empty or broken storage is ignored',()=>{const s=mem();s.setItem('creatorHub.multiModel.last','{bad');assert.equal(loadLast('image',s),null);saveLast('video',{models:[],formats:[]},s);assert.equal(loadLast('video',s),null);});
import {isOn,setOn,startLabel} from '../multi-model-ui.mjs';
test('0.17.1: a Több modellel kapcsoló módonként megmarad, a felirat követi',()=>{const m=new Map(),s={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
 assert.equal(isOn('image',s),false);setOn('image',true,s);assert.equal(isOn('image',s),true);assert.equal(isOn('video',s),false);setOn('image',false,s);assert.equal(isOn('image',s),false);
 assert.equal(startLabel(true,3),'Generálás · 3 modellel');assert.equal(startLabel(false,3),'Generálás indítása');assert.equal(startLabel(true,0),'Generálás indítása');});
