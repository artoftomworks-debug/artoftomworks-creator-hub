import test from 'node:test';import assert from 'node:assert/strict';
import {promptTags,cleanVision,TAG_IDS,visionSystem,createAutoTagger} from '../auto-tags.mjs';
import {mkdtemp,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
test('prompt-címkék angolul és magyarul (ékezetes szóhatárral)',()=>{
 assert.deepEqual(promptTags('A woman in black lingerie by the fireplace, snowy mountains, golden hour').sort(),['glamour','goldenhour','interior','landscape','winter'].sort());
 assert.deepEqual(promptTags('egy fekete kígyó sötét háttér előtt').sort(),['animal','lowkey']);
 assert.deepEqual(promptTags('állat a tó partján, hó').sort(),['animal','water','winter']);
 assert.deepEqual(promptTags(''),[]);assert.deepEqual(promptTags('faceless'),[]);
});
test('a képfelismerő válaszából csak a szótár marad',()=>{
 assert.deepEqual(cleanVision({tags:['Glamour','sci-fi','bogus','low-key','golden-hour'],level:'Soft'}),{tags:['glamour','scifi','lowkey','goldenhour'],level:'soft'});
 assert.deepEqual(cleanVision({tags:'x',level:'wild'}),{tags:[],level:''});
 for(const id of TAG_IDS)assert.match(visionSystem(),new RegExp(id));
});
test('üresjáratban címkéz, generálás közben vár, a képfelismerést csak bekapcsolva hívja',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'at-'));await mkdir(path.join(root,'data'));
 const saved=[];let busy=true,calls=0;const queue=[{id:'a'.repeat(32),mode:'image'}];
 const history={nextUntagged:async()=>queue.shift()||null,details:async()=>({prompt:'portrait of a cat at night'}),setAiTags:async d=>saved.push(d),aiTagCounts:async()=>({total:1,tagged:saved.length}),location:async()=>({available:false})};
 const t=createAutoTagger({root,history,assistant:async()=>{calls++;return {tags:['portrait'],level:'none'};},isBusy:async()=>busy,idleMS:1e9,intervalMS:1e9});
 await t.tick();assert.equal(saved.length,0);assert.equal((await t.status()).paused,'generation');
 busy=false;await t.tick();assert.equal(saved.length,1);assert.deepEqual(saved[0].tags.sort(),['animal','night','portrait']);assert.equal(saved[0].source,'prompt');assert.equal(calls,0);t.stop();
});
test('bekapcsolt képfelismerés: a kép a helyi MI-hez megy, a válasz a szótárral egyesül',async()=>{
 const {writeFile}=await import('node:fs/promises');const root=await mkdtemp(path.join(tmpdir(),'at-'));await mkdir(path.join(root,'data'));const png=path.join(root,'x.png');await writeFile(png,Buffer.from('89504e470d0a1a0a','hex'));
 await writeFile(path.join(root,'data','autotag.json'),JSON.stringify({enabled:true,vision:true,model:'llava:7b',backfill:true}));
 const saved=[],seen=[];const queue=[{id:'b'.repeat(32),mode:'image'}];
 const history={nextUntagged:async()=>queue.shift()||null,details:async()=>({prompt:'a castle'}),setAiTags:async d=>saved.push(d),aiTagCounts:async()=>({total:1,tagged:saved.length}),location:async()=>({available:true,path:png})};
 const t=createAutoTagger({root,history,assistant:async d=>{seen.push(d);return {tags:['fantasy','nonsense'],level:'soft'};},isBusy:async()=>false,idleMS:1e9,intervalMS:1e9});
 await t.tick();t.stop();assert.equal(seen.length,1);assert.equal(seen[0].action,'tag');assert.equal(seen[0].model,'llava:7b');assert.match(seen[0].image,/^data:image\/png;base64,/);
 assert.deepEqual(saved[0].tags.sort(),['architecture','fantasy']);assert.equal(saved[0].level,'soft');assert.equal(saved[0].source,'vision');
});
