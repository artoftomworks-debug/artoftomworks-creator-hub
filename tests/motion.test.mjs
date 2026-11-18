import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMotion,buildMotionText,motionText,composeVideoPrompt,motionConflicts,MOTION_PRESETS} from '../motion-model.mjs';
import {parameterSnapshot,mergeParameters} from '../setup-ui.mjs';
import {compileRenderShot} from '../workflow.mjs';
import {video} from './fixtures.mjs';

test('camera and subject directions remain separate; untouched or disabled scene controls preserve the base prompt',()=>{
 const base='A person walks beside a calm lake.',m={enabled:true,camera:'static',subject:'walk',intensity:'natural',composition:'full'};
 assert.equal(composeVideoPrompt(base,{}),base);assert.equal(composeVideoPrompt(base,{...m,enabled:false}),base);
 const full=composeVideoPrompt(base,m);assert(full.startsWith(base+'\n\n'));assert.match(full,/locked off/);assert.match(full,/subject walks/);assert.equal(motionConflicts(base,m).length,0);
 assert.equal(composeVideoPrompt(full,m),full,'a restored complete prompt must not receive an identical addition twice');
 assert.equal(buildMotionText({}), '');
});

test('all three one-click presets generate explicit instructions and custom edits take priority until explicitly rebuilt',()=>{
 for(const p of MOTION_PRESETS){assert(p.motion.enabled);assert(buildMotionText(p.motion).length>40);assert.equal(motionConflicts('A natural scene.',p.motion).length,0);}
 const m={...MOTION_PRESETS[0].motion,custom:true,text:'Camera slowly tracks the bird across the water.',customBase:buildMotionText(MOTION_PRESETS[0].motion)};
 assert.equal(motionText({...m,camera:'static'}),m.text,'selectors never overwrite a custom instruction');assert.match(motionText({...m,camera:'static',custom:false}),/locked off/);
 const normalized=normalizeMotion({enabled:true,camera:'arbitrary',text:'x'.repeat(5000),speed:'bad',face:'true'});assert.equal(normalized.camera,'none');assert.equal(normalized.speed,'slow');assert.equal(normalized.face,false);assert.equal(normalized.text.length,4000);
});

test('conflicts detect clear English/Hungarian camera and framing contradictions without confusing subject movement with camera movement',()=>{
 const push={enabled:true,camera:'push'};
 assert(motionConflicts('Static camera on a tripod.',push).some(x=>x.field==='camera'));
 assert(motionConflicts('Rögzített kamera. Egy ember sétál.',push).some(x=>x.field==='camera'));
 assert.equal(motionConflicts('The camera is fixed while the subject moves.',{enabled:true,camera:'static',subject:'walk'}).length,0);
 assert.equal(motionConflicts('A static sculpture beside a still lake.',push).length,0);
 assert(motionConflicts('The camera slowly pans left.',{enabled:true,camera:'static'}).some(x=>x.field==='camera'));
 assert(motionConflicts('A wide establishing shot.',{enabled:true,composition:'close'}).some(x=>x.field==='composition'));
 assert(motionConflicts('The subject remains still.',{enabled:true,subject:'dynamic'}).some(x=>x.field==='subject'));
 assert.equal(motionConflicts('Static camera.',{...push,enabled:false}).length,0);assert.equal(motionConflicts('Tilted horizon. Rack focus.',{enabled:true,custom:true,text:'The subject walks naturally.',horizon:true,focus:'subject'}).length,0,'unused selector values do not add warnings to a custom text');
});

test('undo and named setup snapshots retain or remove scene settings exactly',()=>{
 const current={source:video,motion:MOTION_PRESETS[1].motion,prompt:'Keep this subject',seed:42,controls:{loras:[]}},snapshot=parameterSnapshot(current);
 assert.deepEqual(snapshot.motion,current.motion);const target=mergeParameters({...current,motion:MOTION_PRESETS[2].motion},snapshot);assert.deepEqual(target.motion,current.motion);assert.equal(target.prompt,current.prompt);
 const old={...snapshot};delete old.motion;assert(!('motion' in mergeParameters(current,old)),'undo restores the earlier absence of a scene panel setting');
});

test('the actual H3 workflow receives the composed scene prompt while the working base prompt and source graph stay unchanged',()=>{
 const base='A person beside a lighthouse.',scene=MOTION_PRESETS[2].motion,sourceBefore=JSON.stringify(video),full=composeVideoPrompt(base,scene);
 const compiled=compileRenderShot(video,{prompt:full,negative:'flicker',width:640,height:352,duration:2,controls:{}},'fixture.png','Test/Scene');
 assert.equal(compiled.prompt['4'].inputs.prompt,full);assert.equal(JSON.stringify(video),sourceBefore);assert.equal(base,'A person beside a lighthouse.');
});
