// 0.16 DEV — csendes hibák: forrásjelzés, eltérés a mentett értéktől; emberi hibaüzenetek.
import test from 'node:test';import assert from 'node:assert/strict';
import {samplingCheck,samplingSourceLabel,mismatchText,SAMPLING_POLICY_VERSION} from '../sampling-policy.mjs';
import {friendlyError,friendlyLine} from '../diagnostic-text.mjs';
const moss={family:'moss',name:'Realism By Stable Yogi Moss V2.0',id:'x'};
const prof=sampling=>({sampling,version:SAMPLING_POLICY_VERSION});
test('own saved values are labelled as own',()=>{const r=samplingCheck({sampling:{steps:6,cfg:1},model:moss,profile:prof({steps:6,cfg:1})});assert.equal(r.mismatches.length,0);assert.equal(samplingSourceLabel(r),'saját beállításod');});
test('no profile, model defaults → modell-alapérték',()=>{const r=samplingCheck({sampling:{steps:6,cfg:1},model:moss});assert.equal(samplingSourceLabel(r),'modell-alapérték');});
test('yesterday: Moss saved 6 but 20 set → warns',()=>{const r=samplingCheck({sampling:{steps:20,cfg:1},model:moss,profile:prof({steps:6,cfg:1})});assert.deepEqual(r.mismatches,[{field:'steps',current:20,expected:6,from:'profile'}]);assert.match(mismatchText(r.mismatches[0]),/6 lépést mentettél, most 20/);assert.match(samplingSourceLabel(r),/lépés: eltér · CFG: saját/);});
test('lost profile: differs from the model default → warns too',()=>{const r=samplingCheck({sampling:{steps:20,cfg:1},model:moss});assert.equal(r.mismatches[0].from,'default');assert.match(mismatchText(r.mismatches[0]),/kiinduló értéke 6 lépés, most 20/);});
test('manual policy never warns',()=>{const r=samplingCheck({sampling:{steps:20},model:moss,profile:prof({steps:6}),policy:'manual'});assert.equal(r.mismatches.length,0);assert.equal(samplingSourceLabel(r),'kézi, nem jegyzi meg');});
test('old (v<3) profile steps are not trusted',()=>{const r=samplingCheck({sampling:{steps:6,cfg:1},model:moss,profile:{sampling:{steps:20,cfg:1},version:2}});assert.equal(r.mismatches.length,0);});
test('friendly errors',()=>{
 assert.equal(friendlyError('torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB').kind,'memory');
 const m=friendlyError("Prompt outputs failed validation: CheckpointLoaderSimple: - Value not in list: ckpt_name: 'SDXL\\\\old.safetensors' not in ['a.safetensors']");assert.equal(m.kind,'missing-model');assert.equal(m.file,'SDXL\\\\old.safetensors');assert.match(m.title,/old\.safetensors/);
 assert.equal(friendlyError('TypeError: fetch failed').kind,'engine');
 assert.equal(friendlyError("Cannot execute because a node is missing the class_type property.").kind,'missing-node');
 assert.equal(friendlyError('safetensors_rust.SafetensorError: Error while deserializing header: HeaderTooLarge').kind,'corrupt');
 assert.equal(friendlyError('RuntimeError: mat1 and mat2 shapes cannot be multiplied (77x2048 and 768x320)').kind,'mismatch');
 assert.equal(friendlyError('Valami teljesen ismeretlen'),null);assert.equal(friendlyLine('Valami teljesen ismeretlen'),'Valami teljesen ismeretlen');});
