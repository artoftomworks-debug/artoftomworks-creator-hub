import test from 'node:test';import assert from 'node:assert/strict';
import {mergeProfiles} from '../draft-store.mjs';
test('a stale page cannot delete or downgrade a per-model step count',()=>{
  const fresh={'b|image|checkpoints|sdxl.safetensors':{sampling:{steps:32},saved:200,version:3}};
  const stale={'b|video|ltx':{sampling:{steps:20},saved:100,version:3}};
  const m=mergeProfiles(fresh,stale);assert.equal(m['b|image|checkpoints|sdxl.safetensors'].sampling.steps,32);assert.equal(m['b|video|ltx'].sampling.steps,20);
  const older={'b|image|checkpoints|sdxl.safetensors':{sampling:{steps:20},saved:150,version:3}};assert.equal(mergeProfiles(m,older)['b|image|checkpoints|sdxl.safetensors'].sampling.steps,32);
  const newer={'b|image|checkpoints|sdxl.safetensors':{sampling:{steps:28},saved:300,version:3}};assert.equal(mergeProfiles(m,newer)['b|image|checkpoints|sdxl.safetensors'].sampling.steps,28);
  assert.deepEqual(mergeProfiles(null,undefined),{});assert.deepEqual(mergeProfiles({x:[1]},{y:'z'}),{});
});
