import {createSoundWorkshopService} from './vendor/tools/prompt-studio/sound-workshop-server.mjs';
import {videoWorkshopCore} from './vendor/tools/prompt-studio/video-workshop-core.mjs';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {backendURL} from './workflow.mjs';
import {createVideoWorkshopService} from './vendor/tools/prompt-studio/video-workshop-server.mjs';

function checkRange(start,end,duration){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration||end-start<1||end-start>15){
  throw Error('Válassz a videón belül egy 1–15 másodperces szakaszt.');
 }
}
export function buildReplacementProject(original,replacement,start,end){
 checkRange(start,end,original.duration);
 const C=videoWorkshopCore();
 let project=C.add(C.add(C.fresh(),original),replacement);
 const [base,insert]=project.clips;
 const length=end-start;
 if(replacement.duration<length-.08)throw Error('A csereklip rövidebb a kijelölt szakasznál.');
 insert.out=Math.min(replacement.duration,length);
 project.clips=[];
 if(start>=.08)project.clips.push({...base,out:start});
 project.clips.push(insert);
 if(original.duration-end>=.08)project.clips.push({...base,id:C.id(),in:end});
 return C.normalize(project);
}
export function createVideoTools({root,sourceRoot,history,studio,fetchImpl=fetch,workshopOptions={}}){
 const workshop=createVideoWorkshopService({root:path.join(root,'data','VideoStudio'),...workshopOptions}),sessions=new Map(),replacementProjects=new Map();
 const sound=createSoundWorkshopService({root:path.join(root,'data','VideoStudio','SoundWorkshop'),samplesRoot:path.join(sourceRoot,'vendor','tools','prompt-studio','sound-samples'),video:workshop});
 async function source(id){const e=await history.location(id);if(e.mode!=='video'||!e.available)throw Error(e.message||'Válassz helyben elérhető, kész videót.');return e;}
 async function importVideo({id}){const e=await source(id),asset=await workshop.ingest(createReadStream(e.path),e.filename);return {asset,filename:e.filename};}
 async function replacementFrame({id,start,end}){
  const {asset}=await importVideo({id});
  checkRange(start,end,asset.duration);
  const C=videoWorkshopCore(),project=C.add(C.fresh(),asset,'clip');
  return workshop.extractFrame({project,clipId:project.clips[0].id,time:start});
 }
 async function prepareReplacement({id,replacementId,start,end}){
  if(id===replacementId)throw Error('Válassz külön csereklipet.');
  const {asset:original}=await importVideo({id});
  checkRange(start,end,original.duration);
  const {asset:replacement}=await importVideo({id:replacementId});
  const project=buildReplacementProject(original,replacement,start,end);
  const token=randomUUID().replaceAll('-','');
  if(replacementProjects.size>=12)replacementProjects.delete(replacementProjects.keys().next().value);
  replacementProjects.set(token,project);
  return {url:'/video-studio?replacement='+token};
 }
 function replacementProject(token){
  const project=replacementProjects.get(token);
  if(!project)throw Error('Ez az átadás lejárt.');
  return {project};
 }
 async function lastFrame({id}){const {asset}=await importVideo({id}),C=videoWorkshopCore(),project=C.add(C.fresh(),asset,'clip'),clip=project.clips[0];return workshop.extractFrame({project,clipId:clip.id,lastFrame:true,time:Math.max(0,asset.duration-1/(asset.fps||24))});}
 async function companionPage(name){if(!['Image_Workshop.html','Sound_Workshop.html'].includes(name))throw Error('Ismeretlen műhelylap.');return readFile(path.join(sourceRoot,'vendor','tools','prompt-studio','dist',name));}
 async function page(){const file=path.join(sourceRoot,'vendor','tools','prompt-studio','dist','Video_Workshop.html');let html=await readFile(file,'utf8');const needle='void loadLibrary();refresh();return';if(!html.includes(needle))throw Error('A Videóstúdió felülete nem támogatja ezt az átadást.');html=html.replace("KEY='artoftomworks.v2.videoWorkshop.project'","KEY='artoftomworks.creatorHub.videoStudio.'+(new URLSearchParams(location.search).get('sequence')||new URLSearchParams(location.search).get('replacement')||new URLSearchParams(location.search).get('history')||'manual')");html=html.replace(needle,`void loadLibrary().then(async()=>{const replacement=new URLSearchParams(location.search).get('replacement');if(replacement){try{if(!p.clips.length){const r=await fetch('/api/video-tools/replacement?token='+encodeURIComponent(replacement));const value=await r.json();if(!r.ok)throw Error(value.error);library=[...library,...value.project.assets.filter(a=>!library.some(b=>b.id===a.id))];commit(value.project);}say('A szakaszcsere előkészítve.');}catch(e){fail(e);}finally{document.body.dataset.ready='true';}return;}const sequence=new URLSearchParams(location.search).get('sequence');if(sequence){try{const {sceneText}=await import('/scene-i18n.mjs');if(!p.clips.length){const response=await fetch('/api/scenes/assembly',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sequence})});const value=await response.json();if(!response.ok)throw Error(value.error);library=[...library,...value.project.assets.filter(a=>!library.some(b=>b.id===a.id))];commit(value.project);}say(sceneText(new URLSearchParams(location.search).get('lang')||'EN','assemblyReady'));}catch(e){fail(e);}finally{document.body.dataset.ready='true';}return;}const id=new URLSearchParams(location.search).get('history');if(!id){document.body.dataset.ready='true';return;}try{say('A Hub videójának betöltése…');const response=await fetch('/api/video-tools/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const value=await response.json();if(!response.ok)throw Error(value.error);const a=C.asset(value.asset);library=[...library.filter(x=>x.id!==a.id),a];addAsset(a,'clip');say('Betöltve a Hubból: '+value.filename+'. Feldolgozás még nem indult.');}catch(e){fail(e);}finally{document.body.dataset.ready='true';}});refresh();return`);return html;}
 async function open({id,tool,backend,language='HU'}){const lang=['HU','EN','DE','FR','ES','IT','PT','PL'].includes(language)?language:'EN';const e=await source(id);if(tool==='video-studio')return {url:'/video-studio?lang='+lang+'&history='+e.id};if(tool==='loop-lab')return {url:'/loop-lab?history='+e.id};if(!['audio-fix','final-check'].includes(tool))throw Error('Ismeretlen videóművelet.');const b=backendURL(backend),opened=await studio.openTool({id:tool,backend:b,language:lang});if(tool==='audio-fix')return {url:opened.url+'#'+encodeURIComponent(JSON.stringify({language:lang,video_path:e.path}))};
  // Final Check's existing module has no incoming-file URL. Serve its own UI
  // through a bounded local bridge, adding only registration of this verified file.
  const response=await fetchImpl(b+'/prophetero_final_check/assets/studio.mjs',{redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('A Final Check átadási felülete nem érhető el.');const js=await response.text();if(js.length>2e6||!js.includes('void init();')||!js.includes('async function addRecord('))throw Error('A telepített Final Check változata nem támogatja a közvetlen videóátadást. Frissítsd a Final Check bővítményt.');const token=randomUUID().replaceAll('-','');if(sessions.size>=40)sessions.delete(sessions.keys().next().value);sessions.set(token,{id:e.id,backend:b,created:Date.now()});return {url:'/video-tools/'+token+'/prophetero_final_check/studio?language='+lang};
 }
 async function compare({ids,backend,language='HU'}){const lang=['HU','EN','DE','FR','ES','IT','PT','PL'].includes(language)?language:'EN';if(!Array.isArray(ids)||ids.length<2||ids.length>4)throw Error('2–4 videót jelölj összehasonlításra.');const sources=[];for(const id of [...new Set(ids)]){const e=await source(id);sources.push({path:e.path,name:e.filename,offset:0});}if(sources.length<2)throw Error('Két külön videót válassz.');const b=backendURL(backend),response=await fetchImpl(b+'/prophetero_take_compare/receive_final_check',{method:'POST',headers:{Origin:b,'Content-Type':'application/json'},body:JSON.stringify({sources,language:lang,note:'ArtofTomworks Creator Hub összehasonlítás'}),redirect:'error',signal:AbortSignal.timeout(120000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Az összehasonlítás előkészítése nem sikerült.');if(typeof data.url!=='string'||!data.url.startsWith('/prophetero_take_compare/studio?transfer='))throw Error('Érvénytelen összehasonlítási válasz.');return {url:b+data.url};}
 function session(token){const s=sessions.get(token);if(!s||Date.now()-s.created>24*3600e3)throw Error('Ez az eszközátadás lejárt. A videó alatti gombbal nyisd meg újra.');return s;}
 async function bridgeSource(token){const e=await source(session(token).id);return {path:e.path,filename:e.filename};}
 async function proxy(req,res,url){const match=/^\/video-tools\/([a-f0-9]{32})(\/prophetero_final_check\/.*)$/.exec(url.pathname);if(!match)return false;const s=session(match[1]),route=match[2];if(!['GET','POST'].includes(req.method)||!/^\/prophetero_final_check\/(studio|assets\/(studio\.mjs|model\.mjs|guide-model\.mjs|labels\.mjs|studio\.css)|register|resolve|upload|scan|cancel|handoff|repair_compare|guidance|guided_handoff|compare_sources|job\/[a-f0-9-]+|report\/[a-f0-9-]+|preview\/[A-Za-z0-9_.-]+|frame\/[a-f0-9-]+\/[0-9.]+|repair(?:\/[^/?]+)?)$/.test(route))throw Error('Ez a Final Check művelet nem érhető el az átadási felületen.');
  const headers={Origin:new URL(s.backend).origin};for(const key of ['content-type','range'])if(req.headers[key])headers[key]=req.headers[key];const response=await fetchImpl(s.backend+route+url.search,{method:req.method,headers,redirect:'error',signal:AbortSignal.timeout(600000),...(req.method==='POST'?{body:req,duplex:'half'}:{})});const type=response.headers.get('content-type')||'application/octet-stream';if(route==='/prophetero_final_check/studio'||route==='/prophetero_final_check/assets/studio.mjs'){let text=await response.text();if(text.length>2e6)throw Error('Túl nagy Final Check felület.');const base='/video-tools/'+match[1]+'/prophetero_final_check';if(route.endsWith('/studio'))text=text.replaceAll('/prophetero_final_check/',base+'/');else text=text.replace('void init();',`void init().then(async()=>{try{const r=await fetch('/api/video-tools/source?token=${match[1]}');const incoming=await r.json();if(!r.ok)throw Error(incoming.error);setBusy(true);status('A Hub videójának előkészítése…');await addRecord(await request('register',{path:incoming.path}));status('Betöltve a Hubból: '+incoming.filename+'. Ellenőrzés még nem indult.');}catch(e){status(e.message,true);}finally{setBusy(false);}});`);res.writeHead(response.status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(text);return true;}
  const output={'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};for(const key of ['content-length','content-range','accept-ranges'])if(response.headers.has(key))output[key]=response.headers.get(key);res.writeHead(response.status,output);if(response.body){const stream=Readable.fromWeb(response.body);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}else res.end();return true;
 }
 return {compare,workshop,sound,page,companionPage,open,importVideo,lastFrame,replacementFrame,prepareReplacement,replacementProject,bridgeSource,proxy,close(){workshop.close?.();sessions.clear();replacementProjects.clear();}};
}
