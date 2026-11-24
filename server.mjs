import {createModelRecommendations,usableRecommendation} from './model-recommendations.mjs';
import {effectiveSampling} from './sampling-policy.mjs';
import {combinedRunner} from './combined-runner.mjs';
import {createFinishService} from './finish-service.mjs';
import {createFinishRecipes} from './finish-recipes.mjs';
import {applyResourcePolicy} from './resource-policy.mjs';
import {createVideoTools} from './video-tools.mjs';
import {createTimeEstimator} from './time-estimate.mjs';
import {loraGrid} from './lora-grid.mjs';
import {createLoopService} from './loop-service.mjs';
import {createEditorFiles} from './image-editor-files.mjs';
import {inpaintPlan} from './image-editor-inpaint.mjs';
import {createAssetDeletion} from './asset-delete.mjs';
import {createStudio} from './studio.mjs';
import {createPromptInspector} from './prompt-inspector.mjs';
import {createGenerationManager} from './generation-manager.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createRenderServices} from './runner.mjs';
import {backendURL,uiToBundle,inspectRenderSource,applyControls,renderBundle,compileRenderShot} from './workflow.mjs';
import {createCatalog} from './catalog.mjs';
import {createLibrary,pickFolder} from './library.mjs';
import {createAutomatic,seriesSeeds,validateSampling} from './automatic.mjs';
import {createWorkflowSaver} from './workflow-save.mjs';import {createMemoryGuard} from './memory-guard.mjs';import {openInExplorer,chooseSavePath} from './native-open.mjs';
import {createModelBrowser} from './model-browser.mjs';
import {createEngine} from './engine.mjs';
import {createUpdates} from './updates.mjs';
import {createNodeUpdates} from './node-updates.mjs';
import {createSceneService} from './scene-service.mjs';
import {normalizeMotion} from './motion-model.mjs';
import {createHistory,resultID} from './history.mjs';
import {readImageRecipe,readMetadataRecipe} from './image-recipe.mjs';
import {createHubRestart,startTray} from './hub-restart.mjs';
import {mergeProfiles} from './draft-store.mjs';
import {atomicJSON} from './storage.mjs';
import {createSelfHeal} from './self-heal.mjs';
import {createCharacterPack,uploadCharacter} from './character-pack.mjs';
import * as hubProfiles from './profiles.mjs';import * as parental from './parental.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));const BOOT_ID=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
export const VERSION='0.17.0';
export function createHubServer({root=HERE,fetchImpl=fetch,pollMS=1400,liveSocket,libraryOptions={},historyOptions={},engineOptions={},updatesOptions={},nodeUpdateOptions={},modelBrowserOptions={},loopOptions={},videoWorkshopOptions={},finishOptions={},studioOptions={},uiLanguage='auto'}={}){
 const profilesReady=hubProfiles.initProfiles(root).catch(e=>console.warn('[Creator Hub] profilok: '+e.message));
 let finishing,studio,nodeUpdates,generationRequests=0;const releaseAssistant=async()=>{try{await studio?.releaseAssistant();}catch(e){e.definite=true;throw e;}};const memoryGuard=createMemoryGuard({fetchImpl,log:m=>console.log('[Creator Hub] '+m)});const selfHeal=createSelfHeal({root,fetchImpl,log:m=>console.log('[Creator Hub] '+m)});const renderer=createRenderServices({root:path.join(root,'data','runs'),fetchImpl,pollMS,liveSocket,beforeSubmit:async(run,job)=>{await releaseAssistant();return run&&job?memoryGuard(run.backend,job.prompt):undefined;},onFailure:(run,job)=>selfHeal.onFailure(run,job)}),runner=combinedRunner(renderer,()=>finishing);
 const library=createLibrary({root,...libraryOptions});
 const engine=createEngine({root,roots:async()=>(await library.state()).roots,fetchImpl,enabled:fetchImpl===fetch,...engineOptions});
 const updates=createUpdates({root,engine,roots:async()=>(await library.state()).roots,hubVersion:VERSION,fetchImpl,enabled:fetchImpl===fetch,paused:()=>nodeUpdates?.isApplying()||false,...updatesOptions});
 const history=createHistory({root,runner,candidates:async()=>{const found=new Set();const managed=(await engine.status(false)).config?.directory;if(managed)found.add(path.join(managed,'output'));for(const r of (await library.state()).roots){let folder=r.path;for(let i=0;i<7;i++){if(/^(ComfyUI|SwarmUI)$/i.test(path.basename(folder))){found.add(path.join(folder,'output'));found.add(path.join(folder,'dlbackend','ComfyUI','output'));}const parent=path.dirname(folder);if(parent===folder)break;folder=parent;}}return [...found];},...historyOptions});
 const workflowSaver=createWorkflowSaver({root,history,runner,library,fetchImpl,openFolder:dir=>openInExplorer(dir,{directory:true}),openFile:file=>openInExplorer(file),comfyDir:async()=>{try{return (await engine.status(false))?.config?.directory||'';}catch{return '';}},chooseSave:(name,options)=>chooseSavePath(name,options)});let hubRestart=null,storedProfiles=null,lastDraftFile=null,draftLock=Promise.resolve();
 const loopLab=createLoopService({root,sourceRoot:HERE,history,engine,...loopOptions});
 finishing=createFinishService({root,sourceRoot:HERE,history,engine,fetchImpl,pollMS,liveSocket:fetchImpl===fetch?globalThis.WebSocket:null,beforeSubmit:releaseAssistant,...finishOptions});const finishRecipes=createFinishRecipes(root);
 const timeEstimator=createTimeEstimator({root});
 const editorFiles=createEditorFiles({root,history,engine});
 const modelBrowser=createModelBrowser({root,library,engine,fetchImpl,...modelBrowserOptions});
 let catalogCache=null;
 const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));};
 /* 0.16 DEV: sok telepített node mellett az object_info 10+ mp is lehet – hosszabb várakozás, és az egyszerre érkező kérések egyetlen lekérdezést osztanak meg (induláskor több modul is kéri). */let objectsInFlight=null;
 const getObjects=async (backend,refresh=false)=>{if(!refresh&&catalogCache?.url===backend&&Date.now()-catalogCache.time<30000)return catalogCache.value;if(objectsInFlight?.url===backend)return objectsInFlight.promise;
  const promise=(async()=>{let response;try{response=await fetchImpl(backend+'/object_info',{redirect:'error',signal:AbortSignal.timeout(60000)});}catch(e){if(e?.name==='TimeoutError'||/aborted due to timeout/i.test(e?.message||''))throw Error('A ComfyUI egy percen belül sem adta át a node-listát (lassan válaszol vagy túlterhelt). Próbáld újra a ↻ gombbal.');throw e;}if(!response.ok)throw Error('A ComfyUI nem érhető el ezen a címen.');const text=await response.text();if(text.length>40*1024**2)throw Error('Túl nagy node-katalógus.');const value=JSON.parse(text);catalogCache={url:backend,value,time:Date.now()};return value;})();
  objectsInFlight={url:backend,promise};try{return await promise;}finally{if(objectsInFlight?.promise===promise)objectsInFlight=null;}};
 studio=createStudio({root,sourceRoot:HERE,engine,library,getObjects,fetchImpl,isGenerationBusy:async()=>{const q=await generation.status();if(q.armed||runner.isWorking()||runner.hasActive?.())return true;const state=await engine.status(false),health=await engine.health(state.backend);if(!health&&state.state==='ready')throw Error('A generálómotor állapota nem ellenőrizhető.');return !!(health?.running||health?.pending);},memoryAvailable:async()=>{try{const state=await engine.status(false),r=await fetchImpl(state.backend+'/system_stats',{redirect:'error',signal:AbortSignal.timeout(2000)});if(!r.ok)return 0;const d=await r.json();return Math.max(0,...(d.devices||[]).filter(v=>v.type==='cuda'||/cuda|nvidia/i.test(v.name)).map(v=>Number(v.vram_free)||0));}catch{return 0;}},...studioOptions});
 const videoTools=createVideoTools({root,sourceRoot:HERE,history,studio,fetchImpl,workshopOptions:videoWorkshopOptions});
 const scenes=createSceneService({root,history,runner,videoTools});
 const catalog=createCatalog({fetchImpl,getObjects,library});
 const automatic=createAutomatic({getObjects,fetchImpl,library});
 const characterPack=createCharacterPack({engine,getObjects,fetchImpl});
 const recommendations=createModelRecommendations({root,fetchImpl});
 async function normalize(data){const backend=backendURL(data.backend);const source=uiToBundle(data.source,Array.isArray(data.source?.nodes)?await getObjects(backend):{});return {backend,source,info:inspectRenderSource(source,data.output)};}
 async function generationPlan(input){if(assetDeletion.isChanging())throw Error('Modellfájl-kezelés folyamatban. Várd meg a művelet végét.');
  const data=structuredClone(input.payload||input),mode=input.mode|| (data.id?'automatic':'workflow'),backend=backendURL(data.backend);let source,info,controls,title;
  if(mode==='automatic'&&data.character?.image){/* 0.16 DEV: karakter-hűség */data.characterPath=await uploadCharacter(backend,data.character.image,fetchImpl);data.characterWeight=data.character.weight;}
  if(mode==='automatic'){const built=await automatic.build(backend,data);source=built.source;info=inspectRenderSource(source);controls={seed:data.seed,loras:[],addedLoras:data.controls?.addedLoras||[],allowUnknownLoras:!!data.controls?.allowUnknownLoras,sampling:built.sampling};await automatic.validateLoras(backend,built.model,controls);title=built.model.name;}
  else{const normalized=await normalize(data);source=normalized.source;info=normalized.info;controls=data.controls||{};await catalog.validate(backend,source,info,controls);if(Object.keys(controls.sampling||{}).length)validateSampling({steps:20,cfg:1,denoise:1,guidance:3.5,...effectiveSampling(controls.sampling,info.sampling,controls.samplingOverrides)},await automatic.list(backend),{partial:true});title=info.models.join(' · ')||'Saját workflow';}
  let resourcePolicy;if(data.memoryProfile!==undefined||data.h3Acceleration==='kitchen'){const objects=await getObjects(backend),bundle=renderBundle(source);resourcePolicy=applyResourcePolicy(bundle.prompt,objects,{memoryProfile:data.memoryProfile||'auto',h3Acceleration:data.h3Acceleration||'standard',stats:await resourceStats(backend),width:data.width,height:data.height,duration:data.duration});if(resourcePolicy.changed){source={prompt:bundle.prompt};info=inspectRenderSource(source,data.output);}}
  if(data.sceneOrigin&&info.mode!=='video')throw Error('A jelenetfolytatás videós tervhez használható.');
  const scene=data.sceneOrigin?await scenes.context(data.sceneOrigin):null;
  const sceneIntent=info.mode==='video'?{prompt:String(data.sceneIntent?.prompt??data.prompt??'').slice(0,24000),motion:normalizeMotion(data.sceneIntent?.motion)}:undefined;
  const seeds=seriesSeeds(data.count??1,data.seedMode||'increment',data.seed??controls.seed??42,data.seedStep??1),shots=seeds.map((seed,i)=>({id:mode==='workflow'&&seeds.length===1?'work':'work-'+(i+1),title:(info.mode==='video'?'Videó':'Kép')+' '+(i+1),prompt:data.prompt,negative:data.negative||'',duration:data.duration,sceneIntent,...(scene?{scene,parentIds:[scene.previousId||scene.rootId],operation:scene.part===0?'scene-variant':'continuation'}:{}),controls:{...controls,seed}}));
  if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>24000)throw Error('Írj érvényes pozitív promptot.');for(const shot of shots)compileRenderShot(source,{...shot,output:info.output,width:data.width,height:data.height},info.needsImage?'SceneDNA/'+ 'a'.repeat(32)+'/'+ 'b'.repeat(32)+'.png':null,'Validation/Test');if(info.needsImage&&(!data.image||typeof data.image!=='string'||data.image.length>12*1024**2||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image)||Buffer.from(data.image.slice(data.image.indexOf(',')+1),'base64').length>8*1024**2))throw Error('Ehhez a tervhez kezdőkép szükséges.');
  return {resourcePolicy,seedStep:data.seedStep??1,image:data.image,outputFolder:(await history.settings()).outputFolder,projectName:data.projectName,backend,source,previewProfile:data.previewProfile,output:info.output,width:data.width,height:data.height,projectId:'creator-hub',title:'Creator Hub · '+title,shots};
 }
 async function resourceStats(backend){try{const r=await fetchImpl(backendURL(backend)+'/system_stats',{redirect:'error',signal:AbortSignal.timeout(3500)});return r.ok?await r.json():null;}catch{return null;}}
 const promptInspector=createPromptInspector({root:HERE,engine});
 const generation=createGenerationManager({root,runner,pollMS:Math.max(50,pollMS),outputDirectory:async backend=>{const setting=await history.settings();if(setting.locations[backend])return setting.locations[backend];const dir=(await engine.status(false)).config?.directory;return dir?path.join(dir,'output'):null;}});
 const assetDeletion=createAssetDeletion({root,library,isBusy:async()=>{const [local,downloads,q,s]=await Promise.all([library.state(),modelBrowser.status(),generation.status(),engine.status()]);if(local.scan.state==='scanning'||downloads.jobs.some(j=>['queued','downloading','verifying'].includes(j.state))||q.entries.some(e=>['running','waiting-cancel'].includes(e.state)||q.armed&&e.state==='queued'))return true;const health=await engine.health(s.backend);return !!(runner.isWorking()||health?.running||health?.pending);}});
 nodeUpdates=createNodeUpdates({root,engine,enabled:fetchImpl===fetch,candidates:()=>updates.candidates(),changed:row=>updates.changedNode(row),isBusy:async()=>{const q=await generation.status();if(generationRequests||q.armed||runner.isWorking()||runner.hasActive?.())return true;const state=await engine.status(false),health=await engine.health(state.backend);if(!health&&['ready','starting','stopping'].includes(state.state))return true;return !!(health?.running||health?.pending);},...nodeUpdateOptions});
 const server=createServer(async(req,res)=>{
  const host=req.headers.host,origin='http://'+host;
  if(!['127.0.0.1:'+req.socket.localPort,'localhost:'+req.socket.localPort].includes(host)||(req.headers.origin&&req.headers.origin!==origin))return send(res,403,{error:'Local same-origin access only.'});
  const url=new URL(req.url,origin);let generationRequest=false;
  /* 0.16 DEV: 👤 profilok – bejelentkezés és a kérés profilja */await profilesReady;const reqProfile=hubProfiles.profileFor(req);const browser=!!req.headers['sec-fetch-site']||!!req.headers['sec-fetch-mode'],systemPath=['/api/generation/status','/api/engine/status','/api/updates/install/status','/api/hub/power'].includes(url.pathname)||(!browser&&['/api/engine/stop','/api/hub/restart','/api/hub/stop'].includes(url.pathname));
  /* bejelentkezés nélkül csak az állapotlekérdezések (a tálcaikon / újraindító szkript is ezeket használja) – ezek mindent látnak, de nem módosítanak */hubProfiles.profileContext.enterWith(reqProfile||{id:'',system:!!(systemPath&&hubProfiles.profilesEnabled())});
  if(hubProfiles.profilesEnabled()&&!reqProfile&&(url.pathname.startsWith('/api/')||url.pathname.startsWith('/video-tools/'))&&!systemPath&&!['/api/health','/api/profiles/state','/api/profiles/login'].includes(url.pathname))return send(res,401,{error:'Jelentkezz be a Hubba.',login:true});
  {/* 0.16 DEV: 🛡 szülői felügyelet – gyerekprofilnál tiltott funkciók */const deny=parental.deniedPath(url.pathname,req.method);if(deny)return send(res,403,{error:deny});}
  if(url.pathname.startsWith('/api/profiles/')){try{if(url.pathname==='/api/profiles/state')return send(res,200,hubProfiles.publicState(req));if(req.method!=='POST')return send(res,405,{error:'POST szükséges.'});let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>64*1024)return send(res,413,{error:'Túl nagy kérés.'});chunks.push(c);}const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};const act={'/api/profiles/login':hubProfiles.login,'/api/profiles/logout':hubProfiles.logout,'/api/profiles/create':hubProfiles.createProfile,'/api/profiles/update':hubProfiles.updateProfile,'/api/profiles/delete':hubProfiles.deleteProfile,'/api/profiles/disable':hubProfiles.disableProfiles}[url.pathname];if(!act)return send(res,404,{error:'Ismeretlen profilművelet.'});return send(res,200,await act(req,res,body));}catch(e){return send(res,400,{error:e.message});}}
  try{
   const guarded=req.method==='POST'&&(url.pathname.startsWith('/api/generation/')&&!['/api/generation/stop','/api/generation/remove','/api/generation/cancel','/api/generation/tokens','/api/generation/estimate'].includes(url.pathname)||url.pathname.startsWith('/api/video/')||url.pathname.startsWith('/api/sound/')||['/api/start','/api/automatic/prepare','/api/prepare','/api/editor/inpaint','/api/finish/enqueue','/api/loop/start','/api/engine/start','/api/engine/stop','/api/engine/configure'].includes(url.pathname));
   if(guarded){if(nodeUpdates.isApplying())throw Error('A node-csomagok frissítése folyamatban van. Várd meg a művelet végét.');generationRequests++;generationRequest=true;}

   if(url.pathname.startsWith('/video-tools/')){if(req.method==='POST'&&req.headers.origin!==origin)return send(res,403,{error:'Same-origin tool only.'});if(await videoTools.proxy(req,res,url))return;}
   if(url.pathname.startsWith('/api/sound/')){await videoTools.sound.handle(req,res,url,origin);return;}
   if(url.pathname.startsWith('/api/video/')){await videoTools.workshop.handle(req,res,url,origin);return;}
   if(req.method==='GET'){
    if(url.pathname==='/image-workshop'||url.pathname==='/sound-workshop')return send(res,200,await videoTools.companionPage(url.pathname==='/image-workshop'?'Image_Workshop.html':'Sound_Workshop.html'),'text/html; charset=utf-8');
    if(url.pathname==='/video-studio')return send(res,200,await videoTools.page(),'text/html; charset=utf-8');
    if(url.pathname==='/api/scenes/sequence')return send(res,200,await scenes.sequence(url.searchParams.get('id')));
    if(url.pathname==='/api/video-tools/source')return send(res,200,await videoTools.bridgeSource(url.searchParams.get('token')));
    if(url.pathname==='/api/library/trash')return send(res,200,await assetDeletion.list());
    if(url.pathname==='/api/studio/tools')return send(res,200,{items:studio.tools()});
    if(url.pathname==='/api/studio/inventory')return send(res,200,await studio.inventory(url.searchParams.get('backend')));
    if(url.pathname==='/api/studio/diagnostics')return send(res,200,await studio.diagnostics(url.searchParams.get('backend')));
    if(url.pathname==='/api/studio/updates')return send(res,200,await studio.updateStatus());
    if(url.pathname==='/api/generation/status')return send(res,200,await generation.status());
    if(url.pathname==='/api/models/status')return send(res,200,await modelBrowser.status());
    if(url.pathname==='/api/engine/status')return send(res,200,await engine.status());
    if(url.pathname==='/api/updates/status')return send(res,200,await updates.status());
    if(url.pathname==='/api/updates/install/status')return send(res,200,await nodeUpdates.status());
    if(url.pathname==='/api/loop/status')return send(res,200,await loopLab.status(url.searchParams.get('id')));
    if(url.pathname==='/api/loop/source')return send(res,200,await loopLab.source(url.searchParams.get('id')));
    if(url.pathname==='/api/loop/media')return await loopLab.media(url.searchParams.get('id'),res,req.headers.range);
    if(url.pathname==='/api/loop/input')return await loopLab.media(url.searchParams.get('id'),res,req.headers.range,true);
    if(url.pathname==='/api/studio/assistant/state')return send(res,200,studio.assistantState(url.searchParams.get('id')));
    if(url.pathname==='/api/studio/local-ai')return send(res,200,studio.localAIState());
    if(url.pathname==='/api/health')return send(res,200,{app:'artoftomworks.creator-hub',version:VERSION,root:HERE,boot:BOOT_ID});
    if(url.pathname==='/api/history')return send(res,200,await history.list(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/history/settings')return send(res,200,await history.settings());
    if(url.pathname==='/api/history/family')return send(res,200,await history.family(url.searchParams.get('id')));
    if(url.pathname==='/api/finish/recipes')return send(res,200,await finishRecipes.list());
    if(url.pathname==='/api/history/location')return send(res,200,await history.location(url.searchParams.get('id')));
    if(url.pathname==='/api/character/status')return send(res,200,await characterPack.status());
    if(url.pathname==='/api/ideas'){/* 0.16 DEV: ötlettár */const {createIdeas}=await import('./ideas.mjs');return send(res,200,await createIdeas({root}).list());}
    if(url.pathname==='/api/characters'||url.pathname==='/api/characters/get'){/* 0.16 DEV: karakterkönyv */const {createCharacters}=await import('./characters.mjs');const cb=createCharacters({root});return send(res,200,url.pathname.endsWith('get')?await cb.get(url.searchParams.get('id')):await cb.list());}
    if(url.pathname==='/api/video-sound/status'){/* 0.16 DEV: hang a videókhoz */const {createSound}=await import('./sound.mjs');return send(res,200,createSound({root,history,engine}).status(url.searchParams.get('id')));}
    if(url.pathname==='/api/storyboards/film/status'){/* 0.16 DEV: kisfilm */const [{createStoryboardFilm},{createStoryboards}]=await Promise.all([import('./storyboard-film.mjs'),import('./storyboard.mjs')]);return send(res,200,createStoryboardFilm({root,history,engine,storyboards:createStoryboards({root})}).status(url.searchParams.get('id')));}
    if(url.pathname==='/api/storyboards'){/* 0.16 DEV: storyboard */const {createStoryboards}=await import('./storyboard.mjs');return send(res,200,await createStoryboards({root}).list());}
    if(url.pathname==='/api/taste/pick'){/* 0.16 DEV: reggeli válogatás */const {createTaste}=await import('./taste.mjs');return send(res,200,await createTaste({history}).pick(url.searchParams.get('since'),Math.min(12,Math.max(1,Number(url.searchParams.get('limit'))||6))));}
    if(url.pathname==='/api/taste'){/* 0.16 DEV: ízlésprofil */const {createTaste}=await import('./taste.mjs');return send(res,200,await createTaste({history}).analyze());}
    if(url.pathname==='/api/history/details')return send(res,200,await history.details(url.searchParams.get('id')));
    if(url.pathname==='/api/history/item')return send(res,200,await history.item(url.searchParams.get('id')));
    if(url.pathname==='/api/library/state')return send(res,200,await library.state());
    if(url.pathname==='/api/library/items')return send(res,200,await library.list({query:url.searchParams.get('q')||'',kind:url.searchParams.get('kind')||'',favorites:url.searchParams.get('favorites')==='true',page:url.searchParams.get('page'),sort:url.searchParams.get('sort'),filterLoras:url.searchParams.get('filterLoras')==='true',loraFamily:url.searchParams.get('loraFamily')||'',showAllLoras:url.searchParams.get('showAllLoras')==='true',allowUnknownLoras:url.searchParams.get('allowUnknownLoras')==='true'}));
    if(url.pathname==='/api/library/detail')return send(res,200,await library.detail(url.searchParams.get('id')));
    if(url.pathname==='/api/library/thumbnail')return await library.thumbnail(url.searchParams.get('id'),res);
    if(url.pathname==='/api/run/status')return send(res,200,await history.decorate(await runner.status(url.searchParams.get('id'))));
    if(url.pathname==='/api/run/media'){
     const index=Number(url.searchParams.get('index')||0);if(!Number.isSafeInteger(index)||index<0)throw Error('Érvénytelen eredménysorszám.');
     const historyId=resultID(url.searchParams.get('id'),url.searchParams.get('shot'),index),entry=await history.item(historyId).catch(e=>{if(e.code==='UNKNOWN_RESULT')return null;throw e;});if(entry?.trashed)return send(res,404,{error:'A kép a Creator Hub lomtárában van.'});if(await history.media(historyId,res,req.headers.range))return;
     try{return await runner.media(url.searchParams,res,req.headers.range);}catch{throw Error('A mentett kép/videó most nem érhető el. A háttér nem válaszol, vagy a fájl hiányzik. Az Előzmények mentési beállításainál válaszd ki a tényleges ComfyUI kimeneti mappát; a helyi fájlhoz ezután nem kell futó háttér.');}
    }
    if(url.pathname==='/api/run/preview')return await runner.previewMedia(url.searchParams,res);
    if(url.pathname==='/api/run/start-image')return await runner.startImage(url.searchParams,res);
    if(url.pathname==='/api/run/workflow')return send(res,200,await runner.workflowView(url.searchParams));
    if(url.pathname==='/api/draft'){try{return send(res,200,JSON.parse(await readFile(hubProfiles.profileDataFile(root,'draft.json'),'utf8')));}catch(e){if(e.code==='ENOENT')return send(res,200,{});throw e;}}
    if(url.pathname==='/api/template')return send(res,200,JSON.parse(await readFile(path.join(HERE,'templates','dasiwa.json'),'utf8')));
    const poseFiles=new Set(['studio-poses-ui.mjs','studio-planner.mjs','studio-poses.mjs','studio-sphere-ui.mjs','studio-sphere.mjs','pose-estimator.mjs','pose-estimate-ui.mjs','pose-body.mjs','pose-body-ui.mjs','pose-help.mjs','pose-reference-ui.mjs','studio-planner.css']);if(url.pathname.startsWith('/vendor/pose/')){const name=url.pathname.slice('/vendor/pose/'.length);if(!poseFiles.has(name))return send(res,404,{error:'Not found.'});return send(res,200,await readFile(path.join(HERE,'vendor','pose',name)),name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');}
    if(/^\/locales\/(EN|DE|FR|ES|IT|PT|PL)\.json$/.test(url.pathname))return send(res,200,await readFile(path.join(HERE,url.pathname.slice(1))));
    const files={'/scene-ui.mjs':'scene-ui.mjs','/scene-model.mjs':'scene-model.mjs','/scene-i18n.mjs':'scene-i18n.mjs','/scene.css':'scene.css','/node-updates-ui.mjs':'node-updates-ui.mjs','/node-updates-i18n.mjs':'node-updates-i18n.mjs','/updates-ui.mjs':'updates-ui.mjs','/updates-i18n.mjs':'updates-i18n.mjs','/updates.css':'updates.css','/i18n.mjs':'i18n.mjs','/i18n-ui.mjs':'i18n-ui.mjs','/i18n.css':'i18n.css','/assistant-ui.mjs':'assistant-ui.mjs','/history-batch-ui.mjs':'history-batch-ui.mjs','/finish-ui.mjs':'finish-ui.mjs','/finish-model.mjs':'finish-model.mjs','/compare-ui.mjs':'compare-ui.mjs','/lineage.mjs':'lineage.mjs','/finish.css':'finish.css','/resource-policy.mjs':'resource-policy.mjs','/resource-ui.mjs':'resource-ui.mjs','/motion-model.mjs':'motion-model.mjs','/motion-ui.mjs':'motion-ui.mjs','/motion.css':'motion.css','/seed-reservation.mjs':'seed-reservation.mjs','/video-actions-ui.mjs':'video-actions-ui.mjs','/trial-ui.mjs':'trial-ui.mjs','/setup-ui.mjs':'setup-ui.mjs','/loop-lab':'loop-lab.html','/loop-lab.mjs':'loop-lab.mjs','/loop-lab.css':'loop-lab.css','/lora-state.mjs':'lora-state.mjs','/image-editor':'image-editor.html','/image-editor.mjs':'image-editor.mjs','/image-editor-core.mjs':'image-editor-core.mjs','/image-editor-store.mjs':'image-editor-store.mjs','/image-editor.css':'image-editor.css','/seed-ui.mjs':'seed-ui.mjs','/active-model-ui.mjs':'active-model-ui.mjs','/workspace-refinement.css':'workspace-refinement.css','/diagnostic-text.mjs':'diagnostic-text.mjs','/asset-delete-ui.mjs':'asset-delete-ui.mjs','/studio-ui.mjs':'studio-ui.mjs','/studio.css':'studio.css','/video-metadata.mjs':'video-metadata.mjs','/media-gallery.mjs':'media-gallery.mjs','/media-viewer.mjs':'media-viewer.mjs','/media-viewer.css':'media-viewer.css','/preview-import.mjs':'preview-import.mjs','/pose-studio':'pose-studio.html','/pose-studio.mjs':'pose-studio.mjs','/pose-studio.css':'pose-studio.css','/generation-actions-ui.mjs':'generation-actions-ui.mjs','/workspace-ui.mjs':'workspace-ui.mjs','/workspace.css':'workspace.css','/':'index.html','/index.html':'index.html','/app.mjs':'app.mjs','/comfort-view.mjs':'comfort-view.mjs','/hub-reload-watch.mjs':'hub-reload-watch.mjs','/hub-power.mjs':'hub-power.mjs','/chain-refresh.mjs':'chain-refresh.mjs','/preflight.mjs':'preflight.mjs','/preflight-ui.mjs':'preflight-ui.mjs','/multi-model-ui.mjs':'multi-model-ui.mjs','/series-ui.mjs':'series-ui.mjs','/ai-review-ui.mjs':'ai-review-ui.mjs','/grid-ui.mjs':'grid-ui.mjs','/guard-ui.mjs':'guard-ui.mjs','/header-menu.mjs':'header-menu.mjs','/view-mode-ui.mjs':'view-mode-ui.mjs','/layout-mode-ui.mjs':'layout-mode-ui.mjs','/model-trial-ui.mjs':'model-trial-ui.mjs','/taste-ui.mjs':'taste-ui.mjs','/storyboard-ui.mjs':'storyboard-ui.mjs','/character-ui.mjs':'character-ui.mjs','/first-image-ui.mjs':'first-image-ui.mjs','/notify-ui.mjs':'notify-ui.mjs','/morning-ui.mjs':'morning-ui.mjs','/next-scene-ui.mjs':'next-scene-ui.mjs','/resume-ui.mjs':'resume-ui.mjs','/enhancers-ui.mjs':'enhancers-ui.mjs','/ideas-ui.mjs':'ideas-ui.mjs','/sound-ui.mjs':'sound-ui.mjs','/theme-ui.mjs':'theme-ui.mjs','/sound-plan.mjs':'sound-plan.mjs','/sound-plan-ui.mjs':'sound-plan-ui.mjs','/start-image-guard.mjs':'start-image-guard.mjs','/privacy-ui.mjs':'privacy-ui.mjs','/profile-gate.mjs':'profile-gate.mjs','/camera-ui.mjs':'camera-ui.mjs','/storyboard-model.mjs':'storyboard-model.mjs','/taste.mjs':'taste.mjs','/settings.mjs':'settings.mjs','/automatic-ui.mjs':'automatic-ui.mjs','/recipe-ui.mjs':'recipe-ui.mjs','/history-ui.mjs':'history-ui.mjs','/engine-ui.mjs':'engine-ui.mjs','/model-browser-ui.mjs':'model-browser-ui.mjs','/recipe-values.mjs':'recipe-values.mjs','/workbench-ui.mjs':'workbench-ui.mjs','/library-ui.mjs':'library-ui.mjs','/style.css':'style.css'};
    files['/sampling-policy.mjs']='sampling-policy.mjs';
    if(url.pathname==='/render-model.mjs')return send(res,200,await readFile(path.join(HERE,'vendor/render-model.mjs')),'text/javascript; charset=utf-8');
    if(files[url.pathname]){let data=await readFile(path.join(HERE,files[url.pathname]));if(files[url.pathname].endsWith('.html')&&['HU','EN','DE','FR','ES','IT','PT','PL'].includes(uiLanguage))data=Buffer.from(data.toString('utf8').replace(/name="creatorhub-default-language" content="[A-Za-z]+"/,'name="creatorhub-default-language" content="'+uiLanguage+'"'));return send(res,200,data,url.pathname.endsWith('.mjs')?'text/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');}
   }
   if(url.pathname==='/api/loop/upload'){if(req.method!=='POST'||req.headers.origin!==origin)return send(res,403,{error:'Same-origin upload only.'});return send(res,200,await loopLab.upload(req,{name:decodeURIComponent(req.headers['x-loop-name']||''),backend:req.headers['x-loop-backend']}));}
   if(url.pathname==='/api/editor/save'){if(req.method!=='POST'||req.headers.origin!==origin)return send(res,403,{error:'Same-origin save only.'});let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>96*1024**2)return send(res,413,{error:'A fájl legfeljebb 96 MiB lehet.'});chunks.push(c);}return send(res,200,await editorFiles.save(Buffer.concat(chunks),{type:req.headers['content-type']?.split(';')[0],backend:req.headers['x-editor-backend'],sourceId:req.headers['x-editor-source'],name:decodeURIComponent(req.headers['x-editor-name']||'Kep'),width:req.headers['x-editor-width'],height:req.headers['x-editor-height']}));}
   if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return send(res,403,{error:'Same-origin JSON requests only.'});
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>24*1024**2)return send(res,413,{error:'A kérés legfeljebb 24 MiB lehet.'});chunks.push(chunk);}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(url.pathname==='/api/library/preview')return send(res,200,await library.setPreview(data));
   if(url.pathname==='/api/library/delete-plan')return send(res,200,await assetDeletion.plan(data));
   if(url.pathname==='/api/library/delete'){const result=await assetDeletion.execute(data);catalogCache=null;catalog.invalidate();automatic.invalidate();return send(res,200,result);}
   if(url.pathname==='/api/library/restore'){const result=await assetDeletion.restore(data);catalogCache=null;catalog.invalidate();automatic.invalidate();return send(res,200,result);}
   if(assetDeletion.isChanging()&&['/api/start','/api/generation/enqueue','/api/generation/resume','/api/library/scan'].includes(url.pathname))throw Error('Modellfájl-kezelés folyamatban. Várd meg a művelet végét.');
   if(url.pathname==='/api/resources/status'){const backend=backendURL(data.backend),stats=await resourceStats(backend),objects=await getObjects(backend).catch(()=>({})),rule=objects.ModelAttentionBackend?.input?.required?.attention;return send(res,200,{stats,h3Kitchen:(Array.isArray(rule?.[0])?rule[0]:rule?.[1]?.options||[]).includes('comfy kitchen attention')});}
   if(url.pathname==='/api/run/preview-control')return send(res,200,await runner.previewControl(data));
   if(url.pathname==='/api/video-tools/open')return send(res,200,await videoTools.open(data));
   if(url.pathname==='/api/scenes/prepare')return send(res,200,await scenes.prepare(data));
   if(url.pathname==='/api/scenes/select')return send(res,200,await scenes.choose(data));
   if(url.pathname==='/api/scenes/assembly')return send(res,200,await scenes.assembly(data));
   if(url.pathname==='/api/video-tools/frame')return send(res,200,await videoTools.lastFrame(data),'image/png');
   if(url.pathname==='/api/video-tools/import')return send(res,200,await videoTools.importVideo(data));
   if(url.pathname==='/api/studio/open')return send(res,200,await studio.openTool(data));
   if(url.pathname==='/api/studio/update')return send(res,200,await studio.checkUpdate(data));
   if(url.pathname==='/api/studio/assistant')return send(res,200,await studio.assistant(data));
   if(url.pathname==='/api/models/search')return send(res,200,await modelBrowser.search(data));
   if(url.pathname==='/api/models/detail')return send(res,200,await modelBrowser.detail(data.id));
   if(url.pathname==='/api/models/destinations')return send(res,200,{items:await modelBrowser.destinations(data.kind)});
   if(url.pathname==='/api/models/plan')return send(res,200,await modelBrowser.plan(data));
   if(url.pathname==='/api/models/check')return send(res,200,await modelBrowser.check(data));
   if(url.pathname==='/api/models/download')return send(res,200,await modelBrowser.enqueue(data));
   if(url.pathname==='/api/models/control')return send(res,200,await modelBrowser.control(data));
   if(url.pathname==='/api/models/credential')return send(res,200,await modelBrowser.setCredential(data));
   if(url.pathname==='/api/updates/check')return send(res,200,await updates.check({nodes:data.nodes===true,force:true}));
   if(url.pathname==='/api/updates/install/plan')return send(res,200,await nodeUpdates.plan(data));
   if(url.pathname==='/api/updates/install/start')return send(res,200,await nodeUpdates.start(data));
   if(url.pathname==='/api/updates/install/restore')return send(res,200,await nodeUpdates.restore(data));
   if(url.pathname==='/api/updates/install/stop')return send(res,200,await nodeUpdates.stop());
   if(url.pathname==='/api/updates/install/restart')return send(res,200,await nodeUpdates.restart());
   if(url.pathname==='/api/engine/start')return send(res,200,await engine.start());
   if(url.pathname==='/api/engine/stop')return send(res,200,await engine.stop());
   if(url.pathname==='/api/character/install')return send(res,200,await characterPack.install());
   if(url.pathname==='/api/character/cancel')return send(res,200,await characterPack.cancel());
   if(url.pathname==='/api/ideas/save'||url.pathname==='/api/ideas/delete'){const {createIdeas}=await import('./ideas.mjs');const ib=createIdeas({root});return send(res,200,url.pathname.endsWith('save')?await ib.save(data):await ib.remove(data));}
   if(url.pathname==='/api/characters/save'||url.pathname==='/api/characters/delete'){const {createCharacters}=await import('./characters.mjs');const cb=createCharacters({root});return send(res,200,url.pathname.endsWith('save')?await cb.save(data):await cb.remove(data));}
   if(url.pathname==='/api/video-sound/start'){const {createSound}=await import('./sound.mjs');return send(res,200,await createSound({root,history,engine}).start(data));}
   if(url.pathname==='/api/storyboards/film'){const [{createStoryboardFilm},{createStoryboards}]=await Promise.all([import('./storyboard-film.mjs'),import('./storyboard.mjs')]);return send(res,200,await createStoryboardFilm({root,history,engine,storyboards:createStoryboards({root})}).start(data));}
   if(url.pathname==='/api/storyboards/save'||url.pathname==='/api/storyboards/delete'){const {createStoryboards}=await import('./storyboard.mjs');const sb=createStoryboards({root});return send(res,200,url.pathname.endsWith('save')?await sb.save(data):await sb.remove(data));}
   if(url.pathname==='/api/ui-language'){/* 0.16 DEV: a tálcaikon a Hub felületének nyelvét követi */const lang=String(data?.lang||'').toUpperCase();if(!['HU','EN','DE','FR','ES','IT','PT','PL'].includes(lang))throw Error('Ismeretlen nyelv.');await mkdir(path.join(root,'data'),{recursive:true});await writeFile(path.join(root,'data','ui-language.json'),JSON.stringify({lang}));return send(res,200,{lang});}
   if(url.pathname==='/api/engine/free'){/* 0.16 DEV: „Memória felszabadítása” gomb a hibaablakban */const st=await engine.status(false);if(!st.backend||!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(st.backend))throw Error('A ComfyUI címe nem ismert.');const r=await fetchImpl(st.backend+'/free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(8000)}).catch(()=>null);if(!r?.ok)throw Error('A ComfyUI nem válaszolt a memória-felszabadításra. Lehet, hogy nem fut.');return send(res,200,{freed:true});}
   if(url.pathname==='/api/engine/configure')return send(res,200,await engine.configure(data));
   if(url.pathname==='/api/engine/discover'){await engine.discover();return send(res,200,await engine.status());}
   if(url.pathname==='/api/finish/recipes/save')return send(res,200,await finishRecipes.save(data));
   if(url.pathname==='/api/finish/recipes/remove')return send(res,200,await finishRecipes.remove(data));
   if(url.pathname==='/api/finish/capabilities')return send(res,200,await finishing.capabilities(backendURL(data.backend)));
   if(url.pathname==='/api/finish/enqueue'){const prepared=await finishing.prepare(data);const plan={...data,taskType:'finishing',preparedRunId:prepared.id,backend:prepared.backend,title:prepared.title,shots:prepared.jobs.map(j=>({id:j.shotId,controls:{}}))};const queued=await generation.enqueue(plan);return send(res,200,{...queued,run:prepared});}
   if(url.pathname==='/api/video-tools/compare')return send(res,200,await videoTools.compare(data));
   if(url.pathname==='/api/history/batch')return send(res,200,await history.batch(data));
   if(url.pathname==='/api/history/purge')return send(res,200,await history.purge(data));
   if(url.pathname==='/api/history/annotate')return send(res,200,await history.annotate(data));
   if(url.pathname==='/api/history/settings')return send(res,200,await history.configure(data));
   if(url.pathname==='/api/history/trash')return send(res,200,await history.trash(data));
   if(url.pathname==='/api/history/restore')return send(res,200,await history.restore(data));
   if(url.pathname==='/api/history/open')return send(res,200,await history.open(data));
   if(url.pathname==='/api/self-heal')return send(res,200,data&&data.mode?await selfHeal.configure(data):await selfHeal.status());if(url.pathname.startsWith('/api/hub/')){const hp=(hubRestart??=createHubRestart({generation,nodeUpdates,engine,fetchImpl,serverFile:fileURLToPath(import.meta.url),dir:HERE}));if(url.pathname==='/api/hub/restart')return send(res,200,await hp.restart({port:req.socket.localPort,when:data?.when==='after'?'after':'now'}));if(url.pathname==='/api/hub/stop')return send(res,200,await hp.stop({force:data?.force===true}));if(url.pathname==='/api/hub/cancel-restart')return send(res,200,hp.cancel());if(url.pathname==='/api/hub/power')return send(res,200,await hp.status());if(url.pathname==='/api/hub/open-log'){const f=path.join(HERE,'data','logs','hub.log');try{await stat(f);}catch{throw Error('Még nincs napló: a Hub nem a háttérindítóval indult (régi szerverablak).');}if(process.platform==='win32'){const p=spawn('notepad.exe',[f],{detached:true,stdio:'ignore'});p.on('error',()=>{});p.unref();}return send(res,200,{opened:process.platform==='win32',path:f});}}if(url.pathname==='/api/history/save-workflow')return send(res,200,await workflowSaver.save(data));
   if(url.pathname==='/api/history/workflow')return send(res,200,await workflowSaver.loadInfo(data));
   if(url.pathname==='/api/workflow/save-source')return send(res,200,await workflowSaver.saveSource(data));
   if(url.pathname==='/api/workflow/reveal')return send(res,200,await workflowSaver.reveal(data));
   if(url.pathname==='/api/history/saved-workflows/open')return send(res,200,await workflowSaver.open());
   if(url.pathname==='/api/library/scan')return send(res,200,await library.start({auto:data.auto!==false}));
   if(url.pathname==='/api/library/stop')return send(res,200,await library.stop());
   if(url.pathname==='/api/library/add')return send(res,200,await library.add(data.path,data.kind));
   if(url.pathname==='/api/library/folder')return send(res,200,{path:await pickFolder()});
   if(url.pathname==='/api/library/manage')return send(res,200,await library.manage(data.id,data.action));
   if(url.pathname==='/api/library/favorite'){const value=await library.favorite(data.id,!!data.on);automatic.invalidate();return send(res,200,value);}
   if(url.pathname==='/api/library/open')return send(res,200,await library.openLocation(data.id));
   if(url.pathname==='/api/library/workflow')return send(res,200,await library.workflow(data.id));
   if(url.pathname==='/api/connect'){const backend=backendURL(data.backend),objects=await getObjects(backend);const response=await fetchImpl(backend+'/queue',{redirect:'error',signal:AbortSignal.timeout(8000)});const q=await response.json();return send(res,200,{connected:true,nodes:Object.keys(objects).length,running:q.queue_running?.length||0,pending:q.queue_pending?.length||0});}
   if(url.pathname==='/api/inspect')return send(res,200,await normalize(data));
   if(url.pathname==='/api/catalog'){const {backend,source,info}=await normalize(data);return send(res,200,await catalog.list(backend,source,info,{refresh:!!data.refresh}));}
   if(url.pathname==='/api/image/recipe')return send(res,200,await readImageRecipe(data.image,{getObjects:()=>getObjects(backendURL(data.backend))}));
   if(url.pathname==='/api/video/recipe')return send(res,200,await readMetadataRecipe({...data.metadata,media:'video'},{getObjects:()=>getObjects(backendURL(data.backend))}));
   if(url.pathname==='/api/automatic/catalog')return send(res,200,parental.filterCatalog(await automatic.list(backendURL(data.backend),!!data.refresh)));
   if(url.pathname==='/api/automatic/recommendation'){const all=await automatic.list(backendURL(data.backend)),model=all.models.find(m=>m.id===data.id);if(!model?.localId)return send(res,200,{state:'unavailable',message:'A modell helyi adatlapja nem azonosítható. A saját beállításaid maradnak.'});const profile=await recommendations.forAsset(await library.detail(model.localId),{refresh:data.refresh===true});return send(res,200,{...profile,...(profile.state==='ready'?usableRecommendation(profile,all):{})});}
   if(url.pathname==='/api/automatic/build'){const built=await automatic.build(backendURL(data.backend),data);return send(res,200,{...built,info:inspectRenderSource(built.source)});}
   if(url.pathname==='/api/loop/source')return send(res,200,await loopLab.select(data));
   if(url.pathname==='/api/loop/start')return send(res,200,await loopLab.start(data));
   if(url.pathname==='/api/loop/cancel')return send(res,200,await loopLab.cancel(data.id));
   if(url.pathname==='/api/editor/open-file')return send(res,200,await editorFiles.open(data.id));
   if(url.pathname==='/api/editor/inpaint'){const plan=await generationPlan(data);return send(res,200,await runner.prepare(inpaintPlan(plan,await getObjects(plan.backend))));}
   if(url.pathname==='/api/automatic/prepare'||url.pathname==='/api/prepare')return send(res,200,await runner.prepare(await generationPlan({mode:url.pathname.includes('automatic')?'automatic':'workflow',payload:data})));
   if(['/api/generation/check','/api/generation/export'].includes(url.pathname)){const r=await runner.prepare({...await generationPlan(data),exportOnly:true});return send(res,200,url.pathname.endsWith('/export')?await runner.exportRun({id:r.id}):r);}
   if(url.pathname==='/api/generation/tokens'){const backend=backendURL(data.backend);let family;if(data.id)family=(await automatic.list(backend)).models.find(m=>m.id===data.id)?.family;else{const {source,info}=await normalize(data),list=await catalog.list(backend,source,info);family=list.fields.length===1?list.fields[0].family:null;}return send(res,200,await promptInspector.inspect({family,prompt:data.prompt,negative:data.negative||''}));}
   if(url.pathname==='/api/generation/estimate')return send(res,200,await timeEstimator.estimate(data));
   if(url.pathname==='/api/generation/lora-grid'){const input=structuredClone(data.plan);input.payload.count=1;input.payload.seed=data.seed;input.payload.seedMode='fixed';const plan=await generationPlan(input);if(inspectRenderSource(plan.source,plan.output).mode!=='image')throw Error('A próbarács képes modellhez készült.');return send(res,200,await generation.enqueue(loraGrid(plan,data)));}
   if(url.pathname==='/api/generation/enqueue'){const plan=await generationPlan(data);return send(res,200,await generation.enqueue(plan,{kind:data.kind||'normal',limits:data.limits,replace:!!data.replace,batch:data.batch}));}if(url.pathname==='/api/generation/cancel')return send(res,200,await generation.cancel({ids:Array.isArray(data.ids)?data.ids.map(String).slice(0,50):[],now:data.now===true}));
   if(url.pathname==='/api/generation/stop')return send(res,200,await generation.stop({all:data.all===true,cancel:data.cancel!==false}));
   if(url.pathname==='/api/generation/resume')return send(res,200,await generation.resume({ids:Array.isArray(data.ids)?data.ids.map(String).slice(0,50):undefined}));
   if(url.pathname==='/api/generation/remove')return send(res,200,await generation.remove(data.id));
   if(url.pathname==='/api/start')return send(res,200,await generation.start(data));
   if(url.pathname==='/api/stop'){const state=await generation.status();if(state.current===data.id){const result=await generation.stop({cancel:!!data.cancel});return send(res,200,result.run);}return send(res,200,await runner.stop(data));}
   if(url.pathname==='/api/export')return send(res,200,await runner.exportRun(data));
   if(url.pathname==='/api/draft'){
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid draft.');
    await mkdir(path.join(root,'data'),{recursive:true});const draftFile=hubProfiles.profileDataFile(root,'draft.json');const merged=await (draftLock=draftLock.catch(()=>{}).then(async()=>{/* serialized: read–merge–write of one save at a time */if(draftFile!==lastDraftFile){storedProfiles=null;lastDraftFile=draftFile;}if(storedProfiles===null){try{storedProfiles=JSON.parse(await readFile(draftFile,'utf8')).modelSamplingProfiles||{};}catch(e){if(e.code==='ENOENT')storedProfiles={};}}/* unreadable right now (e.g. antivirus lock): never treat that as "no profiles" */const merged=mergeProfiles(storedProfiles||{},data.modelSamplingProfiles);if(storedProfiles!==null)storedProfiles=merged;data.modelSamplingProfiles=merged;/* 0.16 DEV: atomic + serialized + retried write (Windows locks gave UNKNOWN/EBUSY on open) */await atomicJSON(draftFile,data);return data.modelSamplingProfiles;}));return send(res,200,{saved:true,modelSamplingProfiles:merged});
   }
   return send(res,404,{error:'Not found.'});
  }catch(e){if(!res.headersSent)send(res,400,{error:e.message.slice(0,3000)});else res.destroy();}finally{if(generationRequest)generationRequests--;}
 });
 server.on('close',()=>{nodeUpdates.close();updates.close();videoTools.close();loopLab.close();studio.close();generation.close();modelBrowser.close();engine.close();runner.close();void library.stop();});return {server,runner,library,history,engine,updates,nodeUpdates,modelBrowser,generation,studio,loopLab,videoTools,assetDeletion,finishing};
}
export async function listenHub({port=18901,options={}}={}){
 for(let i=0;i<10;i++){const url='http://127.0.0.1:'+(port+i),app=createHubServer(options);
  try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port+i,'127.0.0.1',resolve);});return {...app,url,reused:false};}
  catch(e){app.runner.close();if(e.code!=='EADDRINUSE')throw e;try{const h=await (await fetch(url+'/api/health',{signal:AbortSignal.timeout(900)})).json();if(h.app==='artoftomworks.creator-hub'&&h.root===HERE){if(h.version!==VERSION)throw Object.assign(Error('A korábbi Creator Hub még fut. A videó elkészülte után zárd be a régi Hub szerverablakát, majd indítsd újra ezt az indítót. Új példányt ugyanarra az adatmappára nem indítok.'),{code:'HUB_RESTART_REQUIRED'});return {url,reused:true};}}catch(error){if(error.code==='HUB_RESTART_REQUIRED')throw error;}}
 }throw Error('Nincs szabad helyi port.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const running=await listenHub(),{url,reused}=running;if(!reused){const close=()=>{running.videoTools.close();running.loopLab.close();running.engine.close();running.runner.close();running.server.closeAllConnections();running.server.close(()=>process.exit(0));};process.once('SIGINT',close);process.once('SIGTERM',close);process.once('exit',()=>running.engine.close());try{startTray({dir:HERE,port:Number(new URL(url).port)});}catch{}}console.log('ArtofTomworks Creator Hub '+VERSION+'\n'+url+'\n'+(reused?'Már fut.':'Ezt az ablakot hagyd nyitva. Ctrl+C: leállítás.'));
 if(process.argv.includes('--open')){const p=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});p.on('error',()=>{});}
}
