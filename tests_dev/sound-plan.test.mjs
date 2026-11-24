import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeSound,buildSoundText,soundText,soundSummary,audioCapableFamily,workflowHasAudio} from '../sound-plan.mjs';
import {composeVideoPrompt} from '../motion-model.mjs';
test('sound text from choices',()=>{assert.equal(buildSoundText({ambience:'sea',music:'piano',speech:'off'}),'Audio: gentle ocean waves and distant seagulls, soft piano music in the background. No dialogue, no voices.');
 assert.equal(buildSoundText({speech:'line',line:'Hello "there"'}),`The character says: "Hello 'there'"`);assert.equal(buildSoundText({music:'off'}),'No music.');assert.equal(buildSoundText({}),'');
 assert.equal(soundText({custom:true,text:' Audio: rain. ',ambience:'sea'}),'Audio: rain.');assert.equal(normalizeSound({ambience:'x'}).ambience,'none');assert.equal(soundSummary({ambience:'rain',speech:'line',line:'Hi'}),'Eső · „Hi”');});
test('audio capability',()=>{assert.ok(audioCapableFamily('ltx'));assert.ok(audioCapableFamily('h3'));assert.ok(!audioCapableFamily('wan'));assert.ok(workflowHasAudio({a:{class_type:'LTXVAudioVAEDecode'}}));assert.ok(!workflowHasAudio({a:{class_type:'VAEDecode'}}));});
test('composeVideoPrompt appends sound once, also without motion',()=>{const s='Audio: rain.';assert.equal(composeVideoPrompt('A cat.',{enabled:false},s),'A cat.\n\nAudio: rain.');assert.equal(composeVideoPrompt('A cat.\n\nAudio: rain.',{},s),'A cat.\n\nAudio: rain.');assert.equal(composeVideoPrompt('A cat.',{}),'A cat.');});
