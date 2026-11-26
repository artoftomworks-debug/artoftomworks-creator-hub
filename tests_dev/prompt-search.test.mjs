import test from 'node:test';import assert from 'node:assert/strict';import {parseQuery,matchesPrompt,highlightParts} from '../prompt-search.mjs';
const P='A lighthouse at sunset, (golden hour:1.2), close-up of a smiling woman, tükör, catalog page';
test('Szó a promptban: egész szó, több szó, szókapcsolat, előtag, kizárás, ékezet',()=>{
 const m=q=>matchesPrompt(P,parseQuery(q));
 assert.equal(m('lighthouse'),true);assert.equal(m('cat'),false,'egész szó – a catalog nem cat');assert.equal(m('cat*'),true);
 assert.equal(m('sunset lighthouse'),true);assert.equal(m('sunset forest'),false);
 assert.equal(m('"golden hour"'),true);assert.equal(m('"hour golden"'),false);assert.equal(m('close-up'),true);
 assert.equal(m('woman -smiling'),false);assert.equal(m('woman -sad'),true);assert.equal(m('-"golden hour"'),false);
 assert.equal(m('TUKOR'),true,'ékezet és kisbetű nem számít');assert.equal(m(''),true);
});
test('kiemelés: a talált szavak és szókapcsolatok megjelölve',()=>{
 const parts=highlightParts(P,parseQuery('"golden hour" tukor -smiling'));
 assert.deepEqual(parts.filter(p=>p.mark).map(p=>p.text),['golden hour','tükör']);
 assert.equal(parts.map(p=>p.text).join(''),P);
});
