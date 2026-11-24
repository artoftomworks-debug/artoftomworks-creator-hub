// 0.16 DEV — Egyszerű nézet: a rejtett, de ható beállítások jelzése
import test from 'node:test';import assert from 'node:assert/strict';
import {hiddenActive} from '../view-mode-ui.mjs';
test('nothing hidden is active when everything is at its starting value',()=>{assert.deepEqual(hiddenActive({sampling:{steps:6,cfg:1,sampler:'euler',scheduler:'simple'},defaults:{steps:6,cfg:1,sampler:'euler',scheduler:'simple'}}),[]);});
test('changed steps, CFG, sampler, fixed seed and memory mode are reported',()=>{const r=hiddenActive({sampling:{steps:10,cfg:3,sampler:'dpmpp_2m',scheduler:'simple'},defaults:{steps:20,cfg:1,sampler:'euler',scheduler:'simple'},seedMode:'fixed',memoryProfile:'low'});assert.deepEqual(r.map(x=>x.key),['steps','cfg','sampler','seedMode','memory']);assert.equal(r[0].base,20);});
test('a sampler choice that is switched off (model default used) is not reported',()=>{assert.deepEqual(hiddenActive({sampling:{sampler:'dpmpp_2m'},defaults:{sampler:'euler'},overrides:{sampler:false}}),[]);});
import {effectiveLayout} from '../layout-mode-ui.mjs';
test('layout: automatic picks compact on a laptop, wide on a big monitor; a manual choice always wins',()=>{
 assert.equal(effectiveLayout('auto',1366,768),'compact');assert.equal(effectiveLayout('auto',1920,1080),'wide');assert.equal(effectiveLayout('auto',1600,1000),'wide');assert.equal(effectiveLayout('auto',2560,800),'compact');
 assert.equal(effectiveLayout('wide',1366,768),'wide');assert.equal(effectiveLayout('compact',2560,1440),'compact');});
