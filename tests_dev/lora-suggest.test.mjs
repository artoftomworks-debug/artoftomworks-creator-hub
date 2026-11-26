import test from 'node:test';import assert from 'node:assert/strict';import {shortlist,strengthFor,createLoraSuggest} from '../lora-suggest.mjs';
const C=[{name:'Rembrandt Lighting style v1.safetensors',title:'Rembrandt (Low-Key) Lighting Style',tags:['low-key','cinematic lighting','shadow'],triggers:['Rembrandt Lighting style'],summary:'shadow on face',weight:null},
 {name:'Glowing__Light_Particles_Flux.safetensors',title:'Glowing Light Particles',tags:['particles','glow'],triggers:['glowing particles'],summary:'',weight:.8},
 {name:'Anime_Lineart.safetensors',title:'Anime lineart',tags:['anime'],triggers:[],summary:'',weight:null}];
test('LoRA-ajánlás: előszűrés a prompt szavai és a saját sikerek alapján',()=>{
 const s=shortlist({prompt:'A quiet workshop at dawn, warm light, deep shadows on the craftsman face, glowing dust particles',candidates:C});
 assert.deepEqual(s.map(c=>c.name.split('.')[0]),['Glowing__Light_Particles_Flux','Rembrandt Lighting style v1']);
 assert.ok(!s.some(c=>/Anime/.test(c.name)),'nem illő LoRA nem kerül a jelöltek közé');
 const withTaste=shortlist({prompt:'portrait',candidates:C,stats:{'anime_lineart.safetensors':{good:3,crown:1}}});assert.equal(withTaste[0].name,'Anime_Lineart.safetensors','a saját sikerek is számítanak');
});
test('erősség: saját képek mediánja → Civitai → 0,6',()=>{
 assert.deepEqual(strengthFor(C[0],{'rembrandt lighting style v1.safetensors':{strengths:[.4,.5,.7]}}),{value:.5,source:'own',count:3});
 assert.deepEqual(strengthFor(C[1],{}),{value:.8,source:'civitai'});assert.deepEqual(strengthFor(C[2],{}),{value:.6,source:'default'});
});
test('MI nélkül az előszűrés legjobbjai; MI-vel csak a listából választhat',async()=>{
 const automatic={list:async()=>({loras:C.map((c,i)=>({name:c.name,family:'flux1',localId:'id'+i}))})};
 const library={detail:async id=>{const c=C[Number(id.slice(2))];return {triggers:c.triggers,source:{modelName:c.title,tags:c.tags,summary:c.summary,weight:c.weight}};}};
 const history={loraStats:async()=>({})};
 const prompt='deep shadows, rembrandt lighting';
 let r=await createLoraSuggest({automatic,library,history,assistant:async()=>{throw Error('nincs');}}).suggest({backend:'x',prompt,family:'flux1',model:'m'});
 assert.equal(r.usedAI,false);assert.equal(r.picks[0].name,C[0].name);assert.equal(r.picks[0].strength,.6);
 r=await createLoraSuggest({automatic,library,history,assistant:async()=>({picks:[{name:'Kitalalt.safetensors',reason:'x'},{name:'Rembrandt Lighting style v1.safetensors',reason:'Árnyékos arc.',strength:.45}]})}).suggest({backend:'x',prompt,family:'flux1',model:'m'});
 assert.equal(r.usedAI,true);assert.deepEqual(r.picks.map(p=>p.name),[C[0].name]);assert.equal(r.picks[0].reason,'Árnyékos arc.');assert.equal(r.picks[0].strength,.45);assert.equal(r.picks[0].strengthSource,'ai');
});
test('video group recommends only LoRAs from the requested model family',async()=>{
 const automatic={list:async()=>({loras:[
  {name:'tracking-h3.safetensors',family:'h3'},
  {name:'tracking-ltx.safetensors',family:'ltx'}
 ]})};
 const prompt='Slow cinematic tracking movement with a steady camera';
 const calls=[];
 const service=createLoraSuggest({automatic,library:{},history:{loraStats:async()=>({})},
  assistant:async input=>{
   calls.push(input);
   return {picks:[{name:input.candidates[0].name,strength:.5}]};
  }});
 for(const family of ['h3','ltx']){
  const name='tracking-'+family+'.safetensors';
  const result=await service.suggest({backend:'test',prompt,family,model:'advisor'});
  assert.deepEqual(calls.at(-1).candidates.map(item=>item.name),[name]);
  assert.equal(calls.at(-1).prompt,prompt);
  assert.equal(calls.at(-1).family,family);
  assert.deepEqual(result.picks.map(item=>[item.name,item.strength]),[[name,.5]]);
 }
});
test('LTX 2.3 candidates can be included and never masquerade as version 2.5',async()=>{
 const loras=[
  {name:'ZLTX tracking.safetensors',family:'ltx'},
  {name:'LTX-2.5 tracking.safetensors',family:'ltx'},
  {name:'tracking.safetensors',family:'ltx',localId:'legacy'},
  {name:'ZLTX unknown tracking.safetensors',family:null}
 ];
 const service=createLoraSuggest({automatic:{list:async()=>({loras})},
  library:{detail:async()=>({source:{baseModel:'LTX-2.3'}})},history:{loraStats:async()=>({})}});
 const input={backend:'test',prompt:'tracking camera',family:'ltx'};
 const included=await service.suggest(input);
 assert.deepEqual(included.picks.filter(p=>p.ltx23).map(p=>p.name).sort(),
  ['ZLTX tracking.safetensors','tracking.safetensors']);
 const filtered=await service.suggest({...input,includeLtx23:false});
 assert.deepEqual(filtered.picks.map(p=>p.name),['LTX-2.5 tracking.safetensors']);
});
test('LoRA trial keeps the seed, prompt and video duration, with a genuine no-LoRA baseline',async()=>{
 const {trialStrengths,loraGrid}=await import('../lora-grid.mjs');
 const strengths=trialStrengths(.5);
 assert.deepEqual(strengths,[0,.5,.65]);
 assert.deepEqual(trialStrengths(4),[0,4,3.85]);
 assert.throws(()=>trialStrengths(0));
 const plan={width:608,height:352,shots:[{id:'base',prompt:'Test motion',duration:3,controls:{seed:1,addedLoras:[{name:'camera',on:true,strength:.5,clip:null},{name:'style',on:true,strength:.3,clip:null}]}}]};
 const result=loraGrid(plan,{lora:'camera',strengths,seed:42});
 assert.deepEqual(result.shots.map(s=>[s.controls.seed,s.prompt,s.duration,s.controls.addedLoras[0].on,s.controls.addedLoras[0].strength]),
  [[42,'Test motion',3,false,0],[42,'Test motion',3,true,.5],[42,'Test motion',3,true,.65]]);
 assert.ok(result.shots.every(s=>s.controls.addedLoras[1].strength===.3));
 assert.equal(plan.shots[0].controls.seed,1);
});
test('online LoRA results prioritise matching local model families and exclude known mismatches',async()=>{
 const {rankOnlineLoras}=await import('../lora-suggest-ui.mjs');
 const result=rankOnlineLoras([
  {title:'Camera motion',description:'tracking',family:null},
  {title:'Camera motion',description:'tracking',family:'h3'},
  {title:'Camera motion',description:'tracking',family:'ltx',restricted:true},
  {title:'LTX Camera',description:'Smooth tracking',family:'ltx'}
 ],'camera tracking',['ltx']);
 assert.deepEqual(result.map(item=>item.title),['LTX Camera','Camera motion']);
 assert.deepEqual(result[0].matches,['camera','tracking']);
});
