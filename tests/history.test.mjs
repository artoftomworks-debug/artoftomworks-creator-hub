import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
const tempBase=path.resolve('./tests/.runtime');await mkdir(tempBase,{recursive:true});
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHistory,resultID,outputFolder,localDateFolder} from '../history.mjs';
import {createRenderServices} from '../runner.mjs';
import {createHubServer} from '../server.mjs';
import {fakeBackend,plan,video,picture} from './fixtures.mjs';

test('freshly completed result can be opened even when history cached the previous list',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-fresh-history-'));try{const dir=path.join(root,'data','runs');await mkdir(dir,{recursive:true});const h=createHistory({root});assert.equal((await h.list()).total,0);const id='a'.repeat(32);await writeFile(path.join(dir,id+'.json'),JSON.stringify({schema:'artoftomworks.scene-dna.run',id,title:'Fresh',backend:'http://127.0.0.1:7821',created:Date.now(),jobs:[{shotId:'work',mode:'image',state:'complete',prompt:picture.prompt,results:[{filename:'fresh.png',type:'output'}]}]}));const entry=await h.item(resultID(id,'work',0));assert.equal(entry.filename,'fresh.png');assert.match((await h.details(entry.id)).prompt,/lighthouse/);await assert.rejects(h.item('b'.repeat(32)),/nem található/);}finally{await rm(root,{recursive:true,force:true});}
});

test('history restores old runs, persists independent ratings/favorites/categories and combines date/project filters',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-history-'));try{
  const dir=path.join(root,'data','runs');await mkdir(dir,{recursive:true});
  for(let n=1;n<=2;n++){const id=String(n).repeat(32);await writeFile(path.join(dir,id+'.json'),JSON.stringify({schema:'artoftomworks.scene-dna.run',id,title:'Project '+n,backend:'http://127.0.0.1:7821',created:new Date('2026-11-'+(10+n)+'T12:00:00Z').getTime(),jobs:[{shotId:'work',number:1,mode:'image',seed:n,results:[{filename:n+'.png',subfolder:'old/run',type:'output'}]}]}));}
  const h=createHistory({root}),first=(await h.list()).items;assert.equal(first.length,2);assert.equal(first[0].rating,null);
  await Promise.all([h.annotate({id:first[0].id,rating:2}),h.annotate({id:first[1].id,favorite:true,category:'Portrait',rating:5})]);
  const restored=createHistory({root});assert.equal((await restored.list({rating:'unrated'})).total,0);const filtered=await restored.list({favorite:'true',category:'Portrait',rating:'5',project:'Project 1',from:'2026-11-11',to:'2026-11-11'});assert.equal(filtered.total,1);assert.equal(filtered.items[0].seed,1);
  await restored.annotate({id:first[0].id,rating:null});assert.equal((await restored.list({rating:'unrated'})).total,1);assert.equal((await restored.list({sort:'rating'})).items[0].rating,5);
  await assert.rejects(restored.annotate({id:first[0].id,rating:0}),/1–5/);await assert.rejects(restored.annotate({id:'../file',rating:1}));assert.equal((await restored.list()).total,2);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('native opening resolves only indexed existing media inside the verified output root, reports missing files without dropping ratings',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-open-'));try{
  const fake=fakeBackend(),runner=createRenderServices({root:path.join(root,'data','runs'),fetchImpl:fake.fetchImpl}),opened=[];try{
   let r=await runner.prepare(plan());await runner.start({id:r.id,contextKey:r.contextKey});await runner.tick();fake.finish();await runner.tick();
   const out=path.join(root,'output'),folder=path.join(out,'ArtofTomworks','CreatorHub','test');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'result.png'),'test');
   const h=createHistory({root,runner,openFile:async(...args)=>opened.push(args)}),id=resultID(r.id,'work',0);await h.configure({backend:r.backend,outputRoot:out});
   assert.equal((await h.location(id)).path,path.join(folder,'result.png'));await h.open({id,action:'folder'});await h.open({id,action:'viewer'});assert.equal(opened.length,2);
   await assert.rejects(h.open({id,action:'shell'}));await assert.rejects(h.open({id:'f'.repeat(32),action:'folder'}));await h.annotate({id,rating:4});await rm(path.join(folder,'result.png'));assert.equal((await h.location(id)).available,false);await assert.rejects(h.open({id,action:'viewer'}));assert.equal((await h.item(id)).rating,4);
   const before=await h.settings();await assert.rejects(h.configure({outputFolder:'NewFolder',backend:r.backend,outputRoot:path.join(root,'missing')}));assert.equal((await h.settings()).outputFolder,before.outputFolder);
  }finally{runner.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('new jobs share a local-date folder with readable unique names; saved paths remain untouched',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-prefix-')),fake=fakeBackend(),runner=createRenderServices({root,fetchImpl:fake.fetchImpl});try{
  const p={...plan(),projectName:'Sunday portraits',outputFolder:'My Library',shots:[{...plan().shots[0],id:'one'},{...plan().shots[0],id:'two'}]},r=await runner.prepare(p);assert.equal(r.title,'Sunday portraits');
  assert.ok(r.jobs.every(j=>j.prefix.startsWith('My Library/Images/'+localDateFolder(r.created)+'/')));assert.ok(r.jobs.every(j=>j.prefix.split('/').length===4));assert.match(r.jobs[0].prefix,/Sunday_portraits/);assert.notEqual(r.jobs[0].prefix,r.jobs[1].prefix);const next=await runner.prepare(p);assert.notEqual(next.jobs[0].prefix,r.jobs[0].prefix);
  const old=JSON.parse(await readFile(path.join(root,r.id+'.json'),'utf8'));assert.equal(old.jobs[0].prefix,r.jobs[0].prefix);for(const unsafe of ['/root','../root','C:/root','ok/../bad','bad\\root'])assert.throws(()=>outputFolder(unsafe));
 }finally{runner.close();await rm(root,{recursive:true,force:true});}
});

test('image/video exports use separate daily folders while completed legacy paths stay unchanged',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-media-folders-')),fake=fakeBackend(),runner=createRenderServices({root,fetchImpl:fake.fetchImpl});try{
  const imageRun=await runner.prepare(plan()),videoPlan={...plan(video),outputFolder:'My Library'},before=JSON.stringify(videoPlan.source),videoRun=await runner.prepare(videoPlan),previewRun=await runner.prepare({...videoPlan,kind:'preview'});
  assert.ok(imageRun.jobs[0].prefix.startsWith('ArtofTomworks/CreatorHub/Images/'+localDateFolder(imageRun.created)+'/'));
  for(const r of [videoRun,previewRun]){assert.ok(r.jobs[0].prefix.startsWith('My Library/Videos/'+localDateFolder(r.created)+'/'));const saved=await runner.load(r.id),output=saved.jobs[0].prompt[saved.jobs[0].output];assert.equal(output.inputs.filename_prefix,r.jobs[0].prefix);const exported=JSON.parse((await runner.exportRun({id:r.id})).files[0].content);assert.equal(exported[saved.jobs[0].output].inputs.filename_prefix,r.jobs[0].prefix);}
  assert.match(previewRun.jobs[0].prefix,/\/Preview_/);assert.equal(JSON.stringify(videoPlan.source),before);
  const legacy=structuredClone(await runner.load(videoRun.id));legacy.id='e'.repeat(32);legacy.jobs[0].state='complete';legacy.jobs[0].prefix='My Library/2026-11-10/old-video';legacy.jobs[0].prompt[legacy.jobs[0].output].inputs.filename_prefix=legacy.jobs[0].prefix;await writeFile(path.join(root,legacy.id+'.json'),JSON.stringify(legacy));
  const resumed=await runner.prepare({...videoPlan,runId:legacy.id});assert.equal(resumed.jobs[0].prefix,legacy.jobs[0].prefix);assert.equal(JSON.parse(await readFile(path.join(root,legacy.id+'.json'),'utf8')).jobs[0].prefix,legacy.jobs[0].prefix);assert.equal(fake.posts.length,0);
 }finally{runner.close();assert.equal(path.dirname(path.resolve(root)),tempBase);await rm(root,{recursive:true,force:true});}
});

test('HTTP defaults to incrementing seeds and persists history preferences without queuing or allowing cross-origin writes',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-default-')),fake=fakeBackend(),app=createHubServer({root,fetchImpl:fake.fetchImpl});try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
  const post=async(route,data,from=origin)=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,value:await r.json()};};
  assert.equal((await post('history/settings',{outputFolder:'Shared'})).status,200);assert.equal((await post('history/settings',{outputFolder:'Bad'},'https://example.com')).status,403);
  const prepared=await post('prepare',{...plan(),prompt:'A lighthouse',count:3,controls:{seed:88}});assert.equal(prepared.status,200,JSON.stringify(prepared.value));assert.deepEqual(prepared.value.jobs.map(j=>j.seed),[88,89,90]);assert.ok(prepared.value.jobs.every(j=>j.prefix.startsWith('Shared/')));assert.equal(fake.posts.length,0);
  assert.equal((await (await fetch(origin+'/api/history')).json()).total,0);
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('saved images and range video playback work with the generation backend offline; missing local media falls back and unknown IDs cannot read files',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-offline-')),out=path.join(root,'output'),id='e'.repeat(32),runDir=path.join(root,'data','runs');let calls=0;
 const app=createHubServer({root,historyOptions:{candidates:[out]},fetchImpl:async()=>{calls++;throw Error('Backend offline');}});try{
  await mkdir(runDir,{recursive:true});await mkdir(path.join(out,'old','project'),{recursive:true});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR6kAAAAASUVORK5CYII=','base64'),video=Buffer.from('0123456789');
  await writeFile(path.join(out,'old','project','result.png'),png);await writeFile(path.join(out,'old','project','result.mp4'),video);
  await writeFile(path.join(runDir,id+'.json'),JSON.stringify({schema:'artoftomworks.scene-dna.run',id,backend:'http://127.0.0.1:7821',created:Date.now(),jobs:[{shotId:'work',state:'complete',results:[{filename:'result.png',subfolder:'old\\project',type:'output'},{filename:'result.mp4',subfolder:'old/project',type:'output'}]}]}));
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,query='/api/run/media?'+new URLSearchParams({id,shot:'work'});
  const image=await fetch(base+query);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
  const partial=await fetch(base+query+'&index=1',{headers:{Range:'bytes=2-5'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 2-5/10');assert.equal(await partial.text(),'2345');
  const suffix=await fetch(base+query+'&index=1',{headers:{Range:'bytes=-3'}});assert.equal(await suffix.text(),'789');const invalid=await fetch(base+query+'&index=1',{headers:{Range:'bytes=20-30'}});assert.equal(invalid.status,416);assert.equal(calls,0,'offline local viewing never contacts or starts the generation backend');
  assert.equal((await fetch(base+query.replace(id,'f'.repeat(32)))).status,400);
  await rm(path.join(out,'old','project','result.png'));const missing=await fetch(base+query);assert.equal(missing.status,400);assert.match((await missing.json()).error,/kimeneti mappát/);assert.equal(calls,1);
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(root,{recursive:true,force:true});}
});


test('preview deletion moves only verified generated images into one recoverable output trash, preserves ratings and refuses overwrite on restore',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-trash-'));try{const out=path.join(root,'output'),runs=path.join(root,'data','runs'),id='a'.repeat(32),backend='http://127.0.0.1:8190';await mkdir(out);await mkdir(runs,{recursive:true});await writeFile(path.join(out,'result.png'),'original image');await writeFile(path.join(root,'source.png'),'input stays');await writeFile(path.join(runs,id+'.json'),JSON.stringify({schema:'artoftomworks.scene-dna.run',id,backend,jobs:[{shotId:'first',mode:'image',results:[{filename:'result.png',subfolder:'',type:'output'}]},{shotId:'second',mode:'image',results:[{filename:'result.png',subfolder:'',type:'output'}]}]}));const h=createHistory({root}),image=resultID(id,'first',0);await h.configure({backend,outputRoot:out});await h.annotate({id:image,rating:5});await assert.rejects(h.trash({id:image}),/megerősítés/);await assert.rejects(h.trash({id:'forged',confirmed:true}));const deleted=await h.trash({id:image,confirmed:true});assert.equal(deleted.ids.length,2);await assert.rejects(readFile(path.join(out,'result.png')),/ENOENT/);assert.equal((await h.list()).total,0);assert.equal((await h.list({trash:'true'})).total,2);assert.equal((await h.item(image)).rating,5);assert.equal(await readFile(path.join(root,'source.png'),'utf8'),'input stays');
 const restored=createHistory({root});await writeFile(path.join(out,'result.png'),'new occupied file');await assert.rejects(restored.restore({id:image}),/felül/);assert.equal(await readFile(path.join(out,'result.png'),'utf8'),'new occupied file');await rm(path.join(out,'result.png'));await restored.restore({id:image});assert.equal(await readFile(path.join(out,'result.png'),'utf8'),'original image');assert.equal((await restored.list()).total,2);assert.equal((await restored.list({trash:'true'})).total,0);assert.equal((await restored.item(image)).rating,5);
 }finally{await rm(root,{recursive:true,force:true});}
});


test('daily output folders follow local calendar dates across UTC midnight and daylight saving',()=>{
 const source=new URL('../history.mjs',import.meta.url).href,script=`import {localDateFolder} from ${JSON.stringify(source)};console.log(JSON.stringify(['2026-11-16T23:30:00Z','2026-07-01T22:30:00Z'].map(localDateFolder)))`;
 const dates=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,TZ:'Europe/Budapest'},windowsHide:true}));assert.deepEqual(dates,['2026-11-17','2026-07-02']);assert.throws(()=>localDateFolder('invalid'),/dátum/);
});

test('quick preview metadata comes from the actual compiled graph and never returns its full graph',async()=>{
 const root=await mkdtemp(path.join(tempBase,'hub-metadata-')),f=fakeBackend(),runner=createRenderServices({root:path.join(root,'data','runs'),fetchImpl:f.fetchImpl,pollMS:999999,liveSocket:null});try{
  const p=plan();p.shots[0].controls={seed:990,sampling:{steps:31,cfg:6.25,sampler:'euler',scheduler:'karras'}};const r=await runner.prepare(p);await runner.start({id:r.id,contextKey:r.contextKey});await runner.tick();f.finish();await runner.tick();const h=createHistory({root}),e=(await h.list()).items[0],d=await h.details(e.id);assert.equal(d.prompt,p.shots[0].prompt);assert.equal(d.negative,'text');assert.equal(d.sampling.steps,31);assert.equal(d.sampling.cfg,6.25);assert.equal(d.seed,990);assert.equal(d.loras[0].name,'portrait.safetensors');assert.equal(d.loras[0].clip,.6);assert(!('workflow'in d));assert.equal(typeof d.prompt,'string');await assert.rejects(h.details('../private'));
 }finally{runner.close();assert.equal(path.dirname(path.resolve(root)),tempBase);await rm(root,{recursive:true,force:true});}
});
