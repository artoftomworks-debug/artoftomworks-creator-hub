import test from 'node:test';import assert from 'node:assert/strict';
import {deleteQuestion,markKey} from '../grid-ui.mjs';
test('egyetlen megerősítés, kedvenc-figyelmeztetéssel',()=>{
 const plain=[{id:'a'},{id:'b',rating:2}],fav=[{id:'a',favorite:true},{id:'b',rating:5},{id:'c'}];
 assert.match(deleteQuestion(plain,'purge'),/^2 képet véglegesen törölsz\? Ez nem vonható vissza\.$/);
 assert.match(deleteQuestion(plain,'trash'),/^2 képet a Hub lomtárába helyezel\?/);
 assert.doesNotMatch(deleteQuestion(plain,'purge'),/Figyelem/);
 assert.match(deleteQuestion(fav,'purge'),/Figyelem: 2 kedvenc vagy legalább 4-esre értékelt kép is van köztük\./);
});
test('X és Del jelöl, módosítóval nem',()=>{
 assert.equal(markKey({key:'x'}),true);assert.equal(markKey({key:'Delete'}),true);assert.equal(markKey({key:'x',ctrlKey:true}),false);assert.equal(markKey({key:'f'}),false);
});
