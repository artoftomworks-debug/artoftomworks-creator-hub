import test from 'node:test';import assert from 'node:assert/strict';import {runningEntry} from '../now-running-ui.mjs';
test('Most fut: a futó bejegyzés a current runId alapján',()=>{
 const s={current:'r2',entries:[{id:'a',state:'complete',runId:'r1'},{id:'b',runId:'r2',state:'running'}]};
 assert.equal(runningEntry(s).id,'b');assert.equal(runningEntry({current:null,entries:[]}),null);
});
