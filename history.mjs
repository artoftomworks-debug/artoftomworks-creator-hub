import {visibleTo} from './profiles.mjs';import {assignFamilies,validateParentIds} from './lineage.mjs';
import {openInExplorer} from './native-open.mjs';
import {readFile,readdir,stat,open as openHandle,mkdir,link,copyFile,unlink} from 'node:fs/promises';
import {realpath as resolveLinks,constants} from 'node:fs';
import {promisify} from 'node:util';
import {atomicJSON} from './storage.mjs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
// Resolve every junction component, including redirected installation parents.
const realpath=promisify(resolveLinks);

export const resultID=(run,shot,index)=>createHash('sha256').update([run,shot,index].join(':')).digest('hex').slice(0,32);
export function localDateFolder(timestamp=Date.now()){
 const date=new Date(timestamp);if(Number.isNaN(date.getTime()))throw Error('Érvénytelen mentési dátum.');
 return [String(date.getFullYear()).padStart(4,'0'),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function outputFolder(value='ArtofTomworks/CreatorHub'){
 if(typeof value!=='string'||value.length>160||!value.trim()||value.split('/').some(p=>!p||p==='.'||p==='..'||! /^[\p{L}\p{N}_ -]+$/u.test(p)))throw Error('A közös mappa neve egyszerű, relatív útvonal legyen, például ArtofTomworks/CreatorHub.');
 return value;
}
const inside=(root,file)=>{const r=path.relative(root,file);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
export function createHistory({root,runner,openFile,platform=process.platform,candidates=[]}={}){
 const dir=path.join(root,'data'),runDir=path.join(dir,'runs'),file=path.join(dir,'history.json'),cache=new Map();let db,initializing,entryCache,cacheTime=0,scanning,fileOperation=Promise.resolve();
 async function init(){if(!initializing)initializing=(async()=>{try{db=JSON.parse(await readFile(file,'utf8'));if(db.schema!=='artoftomworks.creator-hub.history')throw Error('Érvénytelen előzményjegyzék.');}catch(e){if(e.code!=='ENOENT')throw e;db={schema:'artoftomworks.creator-hub.history',version:1,annotations:{},locations:{},outputFolder:outputFolder()};}return db;})();return initializing;}
 const deleted=id=>Object.values(db?.trash||{}).find(t=>t.ids.includes(id));
 async function persist(){await atomicJSON(file,db);}
 /* 0.16 DEV: 👤 profilonként csak a saját futások látszanak */async function entries(){return (await allEntries()).filter(e=>visibleTo(e.profile));}
 async function allEntries(){if(scanning)return scanning;if(entryCache&&Date.now()-cacheTime<250)return entryCache;scanning=readEntries();try{entryCache=await scanning;cacheTime=Date.now();return entryCache;}finally{scanning=null;}}
 async function readEntries(){await init();let names;try{names=await readdir(runDir);}catch(e){if(e.code==='ENOENT')return [];throw e;}const out=[];
  for(const name of names.filter(n=>/^[a-f0-9]{32}\.json$/.test(n))){const target=path.join(runDir,name),s=await stat(target);if(s.size>32*1024**2)continue;let cached=cache.get(name);if(!cached||cached.mtime!==s.mtimeMs||cached.size!==s.size){try{const r=JSON.parse(await readFile(target,'utf8'));cached={mtime:s.mtimeMs,size:s.size,run:r};cache.set(name,cached);}catch{continue;}}const r=cached.run;if(r.schema!=='artoftomworks.scene-dna.run'||r.id+'.json'!==name)continue;
   for(const j of r.jobs||[])for(const [index,m]of (j.results||[]).entries()){
    if(typeof m.filename!=='string'||/[\\/]/.test(m.filename)||! /\.(png|jpe?g|webp|mp4|webm|mov|mkv|m4v)$/i.test(m.filename)||typeof(m.subfolder??'')!=='string'||path.isAbsolute(m.subfolder||'')||String(m.subfolder||'').split(/[\\/]/).some(p=>p==='..')||m.type!=='output')continue;
    const id=resultID(r.id,j.shotId,index),a=db.annotations[id]||{},parents=a.parentIds||j.parentIds||(j.loopMetadata?.id?[j.loopMetadata.id]:j.editorMetadata?.id?[j.editorMetadata.id]:[]);out.push({id,profile:r.profile||'',scene:j.scene,seconds:j.seconds,fps:j.fps,parentIds:Array.isArray(parents)?parents.filter(v=>/^[a-f0-9]{32}$/.test(v)).slice(0,24):[],operation:a.operation||j.operation||(j.loopEdited?'loop':j.editorEdited?'edit':'original'),final:!!a.final,preview:!!j.preview,incomplete:!!j.state&&j.state!=='complete',purged:!!db.purged?.[id],runId:r.id,shotId:j.shotId,index,backend:r.backend,filename:m.filename,subfolder:m.subfolder||'',mode:j.mode||(/\.(png|jpe?g|webp)$/i.test(m.filename)?'image':'video'),project:r.title||r.projectId||'Creator Hub',created:j.finished||j.started||r.created,seed:j.seed??null,width:j.width,height:j.height,number:j.number,rating:a.rating??null,favorite:!!a.favorite,category:a.category||'',trashed:!!deleted(id),url:'/api/run/media?'+new URLSearchParams({id:r.id,shot:j.shotId,index:String(index)})});
   }
  }return assignFamilies(out).filter(e=>!e.purged);
 }
 async function item(id){if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Érvénytelen eredményazonosító.');let found=(await entries()).find(e=>e.id===id);if(!found){entryCache=null;cacheTime=0;found=(await entries()).find(e=>e.id===id);}if(!found)throw Object.assign(Error('Ez az eredmény már nem található az előzményjegyzékben.'),{code:'UNKNOWN_RESULT'});return found;}
 async function details(id){const e=await item(id),run=cache.get(e.runId+'.json')?.run,job=run?.jobs?.find(j=>j.shotId===e.shotId);if(job?.processingEdited)return {...(job.processingMetadata?.source||{}),...e,width:e.width,height:e.height,seconds:job.seconds,fps:job.fps,frames:job.frames,processingRecipe:job.processingMetadata?.recipe,processingCheck:job.processingCheck,checkWarning:job.checkWarning,metadataMessage:'Utómunka-változat · az eredeti generálási recept külön megmaradt.'};if(job?.loopEdited)return {...job.loopMetadata,...e,width:e.width,height:e.height,seconds:job.seconds,fps:job.fps,metadataMessage:'Loop Lab által feldolgozott videó · az eredeti generálás adatai és a .loop.json feldolgozási leírás külön megmaradnak.'};if(job?.editorEdited)return {...job.editorMetadata,...e,width:e.width,height:e.height,metadataMessage:Object.keys(job.editorMetadata||{}).length?'Szerkesztett kép · a forrás generálási adatai megmaradtak, a PNG külön szerkesztési adatokat is tartalmaz.':'Szerkesztett kép · nincs beágyazott forrásrecept. A projektfájl és a külön metaadat-JSON további adatokat is őrizhet.'};if(!job?.prompt)return {...e,metadataMessage:'Ehhez a régi eredményhez nincs mentett generálási recept.'};try{const {inspectRenderSource}=await import('./workflow.mjs'),info=inspectRenderSource({prompt:job.prompt},job.output);return {...e,prompt:info.prompt,negative:info.negative,models:info.models,sampling:info.sampling,loras:info.loras.filter(l=>l.on),seconds:job.seconds,fps:job.fps,frames:job.frames};}catch{return {...e,metadataMessage:'A mentett generálási recept nem olvasható ki egyértelműen.'};}}
 async function list(q={}){let rows=(await entries()).filter(e=>(q.trash==='true'?e.trashed:!e.trashed)&&!e.preview&&(q.incomplete==='true'?e.incomplete:!e.incomplete));const categories=[...new Set(rows.map(r=>r.category).filter(Boolean))].sort(),projects=[...new Set(rows.map(r=>r.project))].sort();const search=String(q.q||'').toLocaleLowerCase();
  rows=rows.filter(r=>(!search||[r.filename,r.project,r.seed,r.category].join(' ').toLocaleLowerCase().includes(search))&&(!q.mode||r.mode===q.mode)&&(!q.project||r.project===q.project)&&(!q.category||r.category===q.category)&&(q.favorite!=='true'||r.favorite)&&(q.rating!=='unrated'||r.rating===null)&&(!/^[1-5]$/.test(q.rating||'')||r.rating===Number(q.rating))&&(!q.from||new Date(r.created).toLocaleDateString('sv-SE')>=q.from)&&(!q.to||new Date(r.created).toLocaleDateString('sv-SE')<=q.to));
  if(q.family)rows=rows.filter(e=>e.familyId===q.family);if(q.grouped==='true'){const groups=new Map();for(const e of rows){const old=groups.get(e.familyId);if(!old||Number(e.final)>Number(old.final)||e.final===old.final&&e.created>old.created)groups.set(e.familyId,e);}rows=[...groups.values()];}
  rows.sort(q.sort==='rating'?(a,b)=>(b.rating??0)-(a.rating??0)||b.created-a.created:(a,b)=>b.created-a.created);const total=rows.length,pages=Math.max(1,Math.ceil(total/24)),page=Math.min(pages,Math.max(1,Number.parseInt(q.page)||1));return {items:rows.slice((page-1)*24,page*24),total,page,pages,categories,projects};
 }
 async function annotate(data){await item(data.id);await init();const old=db.annotations[data.id]||{},next={...old};if('rating'in data){if(data.rating!==null&&(!Number.isInteger(data.rating)||data.rating<1||data.rating>5))throw Error('Az értékelés 1–5 vagy értékeletlen lehet.');next.rating=data.rating;}if('favorite'in data){if(typeof data.favorite!=='boolean')throw Error('Érvénytelen kedvencjelölés.');next.favorite=data.favorite;}if('final'in data){if(typeof data.final!=='boolean')throw Error('Érvénytelen véglegesjelölés.');next.final=data.final;if(data.final){const current=await item(data.id);for(const v of await entries())if(v.id!==data.id&&v.familyId===current.familyId)(db.annotations[v.id]||={}).final=false;}}if('category'in data){if(typeof data.category!=='string'||data.category.length>60)throw Error('A kategória legfeljebb 60 karakter.');next.category=data.category.trim();}db.annotations[data.id]=next;entryCache=null;await persist();return item(data.id);}
 async function settings(){await init();return {outputFolder:db.outputFolder,locations:db.locations};}
 async function configure(data){await init();const folder='outputFolder'in data?outputFolder(data.outputFolder):db.outputFolder;let backend,resolved;if('outputRoot'in data){const {backendURL}=await import('./workflow.mjs');backend=backendURL(data.backend);if(typeof data.outputRoot!=='string'||!path.isAbsolute(data.outputRoot))throw Error('A ComfyUI kimeneti mappájának teljes útvonala szükséges.');resolved=await realpath(data.outputRoot);if(!(await stat(resolved)).isDirectory())throw Error('A megadott útvonal nem mappa.');}db.outputFolder=folder;if(backend)db.locations[backend]=resolved;await persist();return settings();}
 async function location(id){
  const e=await item(id);await init();if(e.trashed)return {...e,path:null,available:false,message:'A fájl a Creator Hub lomtárában van. Az Előzmények Lomtár nézetében visszaállítható.'};
  const options=db.locations[e.backend]?[db.locations[e.backend]]:await (typeof candidates==='function'?candidates():candidates);let missing=false,uncertain=false;
  for(const option of options.filter(Boolean)){
   let base,target;try{base=await realpath(option);if(!(await stat(base)).isDirectory())continue;target=path.resolve(base,...String(e.subfolder||'').split(/[\\/]/).filter(Boolean),e.filename);/* 0.17: a ComfyUI Windowson \\-sel írja az almappát – így Linuxon is feloldódik */if(!inside(base,target)){uncertain=true;continue;}}catch{continue;}
   try{const actual=await realpath(target);if(!inside(base,actual)||!(await stat(actual)).isFile()){uncertain=true;continue;}return {...e,path:actual,outputRoot:base,available:true};}
   catch(error){if(error.code!=='ENOENT'){uncertain=true;continue;}
    // Missing media can be removed from history only after verifying its output root
    // and nearest existing ancestor. A redirected parent must never escape the root.
    let ancestor=path.dirname(target),verified=false;while(ancestor===base||inside(base,ancestor)){try{const actual=await realpath(ancestor);verified=actual===base||inside(base,actual);break;}catch(err){if(err.code!=='ENOENT')break;}if(ancestor===base)break;ancestor=path.dirname(ancestor);}
    if(verified)missing=true;else uncertain=true;
   }
  }
  return {...e,path:null,available:false,missing:missing&&!uncertain,message:missing&&!uncertain?'A fájl már nincs az ellenőrzött kimeneti helyén. A végleges törlés a hiányzó bejegyzést is eltávolíthatja.':'A fájl helye nem ellenőrizhető. Az Előzmények mentési beállításainál add meg a használt ComfyUI tényleges kimeneti mappáját. Ha már megadtad, lehet, hogy a fájlt áthelyezted vagy törölted.'};
 }

 async function open(data){if(!['folder','viewer'].includes(data.action))throw Error('Ismeretlen megnyitási művelet.');const e=await location(data.id);if(!e.available)throw Error(e.message);if(openFile){await openFile(e.path,data.action);return {opened:true};}if(platform!=='win32')throw Error('Ezen a rendszeren az útvonal másolását használd.');if(data.action==='folder')return openInExplorer(e.path,{platform});const p=spawn('rundll32.exe',['url.dll,FileProtocolHandler',pathToFileURL(e.path).href],{windowsHide:false,stdio:'ignore'});await new Promise((resolve,reject)=>{p.once('spawn',resolve);p.once('error',reject);});return {opened:true};}
 async function moveExclusive(from,to){try{await link(from,to);}catch(e){if(!['EPERM','EXDEV','ENOTSUP','EOPNOTSUPP'].includes(e.code))throw e;await copyFile(from,to,constants.COPYFILE_EXCL);}try{await unlink(from);}catch(e){await unlink(to).catch(()=>{});throw e;}}
 async function protectInputs(e){
  if(!runner)return;const aliases=(await entries()).filter(v=>v.backend===e.backend&&v.subfolder===e.subfolder&&v.filename===e.filename);
  if(runner.isMediaInUse&&aliases.some(v=>runner.isMediaInUse(v.id)))throw Error('Ezt a fájlt egy futó utómunka forrásként használja. A munka befejezése után törölhető.');
  if(!runner.load&&!runner.status)return;
  for(const id of new Set(aliases.map(v=>v.runId))){const r=await (runner.load?runner.load(id):runner.status(id)),shots=new Set(aliases.filter(v=>v.runId===id).map(v=>v.shotId));if(r.jobs.some(j=>shots.has(j.shotId)&&['submitting','queued','running','cancelling'].includes(j.state)))throw Error('A futó feladat eredménye még nem törölhető.');}
 }

 async function trash(data){await init();if(data.confirmed!==true)throw Error('A törléshez külön megerősítés szükséges.');if(deleted(data.id))throw Error('A kép már a lomtárban van.');const e=await location(data.id);if(!e.available)throw Error(e.message);await protectInputs(e);
  const folder=path.join(e.outputRoot,'.CreatorHub-Recycle');await mkdir(folder,{recursive:true});const actual=await realpath(folder);if(!inside(e.outputRoot,actual))throw Error('A lomtár útvonala nem a kimeneti mappában van.');const stored=path.join(actual,randomUUID()+path.extname(e.filename)),ids=(await entries()).filter(v=>v.backend===e.backend&&v.subfolder===e.subfolder&&v.filename===e.filename).map(v=>v.id),record={ids,original:e.path,stored,outputRoot:e.outputRoot,created:Date.now()};db.trash||={};db.trash[e.id]=record;entryCache=null;await persist();try{await moveExclusive(e.path,stored);}catch(error){delete db.trash[e.id];entryCache=null;await persist();throw error;}return {trashed:true,ids,id:e.id,message:'A fájl a Creator Hub lomtárába került. Visszaállítható.'};
 }
 async function restore(data){await init();const record=deleted(data.id);if(!record)throw Error('Ez a kép nincs a lomtárban.');const base=await realpath(record.outputRoot),parent=await realpath(path.dirname(record.original)),trashFolder=await realpath(path.join(base,'.CreatorHub-Recycle'));if(parent!==base&&!inside(base,parent)||!inside(trashFolder,record.stored)||!inside(base,record.original))throw Error('A visszaállítás útvonala megváltozott.');const stored=await realpath(record.stored).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(stored){if(!inside(trashFolder,stored))throw Error('A lomtárban tárolt fájl útvonala megváltozott.');try{await moveExclusive(stored,record.original);}catch(e){if(e.code==='EEXIST')throw Error('Az eredeti helyen már van ilyen nevű fájl. Nem írom felül; előbb rendezd az ütközést.');throw e;}}else if(!(await stat(record.original).catch(()=>null))?.isFile())throw Error('A lomtárban tárolt kép nem található.');for(const [key,value]of Object.entries(db.trash))if(value===record)delete db.trash[key];entryCache=null;await persist();return {restored:true,ids:record.ids,message:'A kép visszaállítva az eredeti helyére.'};
 }
 async function family(id){const e=await item(id),rows=(await entries()).filter(v=>v.familyId===e.familyId&&!v.preview).sort((a,b)=>a.created-b.created);return {familyId:e.familyId,selected:id,items:rows};}
 async function linkVersions(data){const e=await item(data.id),ids=validateParentIds(data.parentIds);if(ids.includes(e.id))throw Error('Egy eredmény nem lehet a saját forrása.');const rows=new Map((await entries()).map(v=>[v.id,v]));for(const id of ids){await item(id);const pending=[id],seen=new Set();while(pending.length){const next=pending.pop();if(next===e.id)throw Error('Körkörös forráskapcsolat nem hozható létre.');if(seen.has(next))continue;seen.add(next);pending.push(...(rows.get(next)?.parentIds||[]));}}if(typeof data.operation!=='string'||!/^[a-z-]{1,30}$/.test(data.operation))throw Error('Érvénytelen műveletnév.');db.annotations[e.id]={...db.annotations[e.id],parentIds:ids,operation:data.operation};entryCache=null;await persist();return item(e.id);}
 async function purge(data){
  await init();if(data.confirmed!==true)throw Error('A végleges törléshez külön megerősítés szükséges.');if(db.purged?.[data.id])return {deleted:true,ids:[data.id],fileDeleted:false,alreadyMissing:true};const e=await item(data.id),record=deleted(e.id);await protectInputs(e);
  let ids=[e.id],fileDeleted=false,alreadyMissing=false;
  if(record){
   const base=await realpath(record.outputRoot),logicalTrash=path.join(base,'.CreatorHub-Recycle');if(!inside(logicalTrash,record.stored))throw Error('A lomtár útvonala megváltozott.');
   const trashRoot=await realpath(logicalTrash).catch(err=>{if(err.code==='ENOENT')return null;throw err;});
   if(trashRoot&&!inside(base,trashRoot))throw Error('A lomtár a kimeneten kívülre mutat.');
   const stored=trashRoot?await realpath(record.stored).catch(err=>{if(err.code==='ENOENT')return null;throw err;}):null;
   if(stored){if(!inside(trashRoot,stored)||!(await stat(stored)).isFile())throw Error('A fájl a lomtáron kívülre mutat.');await unlink(stored);fileDeleted=true;}else alreadyMissing=true;
   ids=record.ids;for(const [k,v]of Object.entries(db.trash))if(v===record)delete db.trash[k];
  }else{
   const located=await location(e.id);
   if(located.available){await unlink(located.path);fileDeleted=true;}else if(located.missing)alreadyMissing=true;else throw Error(located.message);
   ids=(await entries()).filter(v=>v.backend===e.backend&&v.subfolder===e.subfolder&&v.filename===e.filename).map(v=>v.id);
  }
  db.purged||={};for(const id of ids)db.purged[id]={at:Date.now()};entryCache=null;await persist();return {deleted:true,ids,fileDeleted,alreadyMissing};
 }

 async function batch(data){const ids=validateParentIdsForBatch(data.ids),allowed=['annotate','trash','restore','purge'];if(!allowed.includes(data.action))throw Error('Ismeretlen csoportos művelet.');if(['trash','purge'].includes(data.action)&&data.confirmed!==true)throw Error('A törléshez külön megerősítés szükséges.');const results=[],covered=new Set();for(const id of ids){if(covered.has(id))continue;try{const result=await ({annotate:()=>annotate({...data.values,id}),trash:()=>trash({id,confirmed:true}),restore:()=>restore({id}),purge:()=>purge({id,confirmed:true})})[data.action]();for(const alias of result.ids||[id])covered.add(alias);results.push({id,ok:true,ids:result.ids||[id],...(data.action==='purge'?{fileDeleted:result.fileDeleted,alreadyMissing:result.alreadyMissing}:{})});}catch(e){results.push({id,ok:false,error:e.message});}}return {results,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length};}
 function validateParentIdsForBatch(ids){if(!Array.isArray(ids)||!ids.length||ids.length>200||ids.some(id=>!/^[a-f0-9]{32}$/.test(id)))throw Error('1–200 eredményt jelölj ki.');return [...new Set(ids)];}
 async function decorate(run){await init();for(const job of run.jobs||[])for(const [index,m]of (job.results||[]).entries()){m.historyId=resultID(run.id,job.shotId,index);m.purged=!!db.purged?.[m.historyId];m.trashed=!!deleted(m.historyId)||m.purged;}return run;}
 async function media(id,res,range){
  await init();if(db.purged?.[id]){res.writeHead(410,{'Cache-Control':'no-store'});res.end();return true;}
  const e=await location(id).catch(error=>{if(error.code==='UNKNOWN_RESULT')return null;throw error;});if(!e?.available)return false;
  let handle;try{handle=await openHandle(e.path,'r');}catch(err){if(['ENOENT','EACCES','EPERM'].includes(err.code))return false;throw err;}
  let streamed=false;try{
   const s=await handle.stat();if(!s.isFile())return false;let start=0,end=s.size-1,partial=false;
   const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mkv':'video/x-matroska'}[path.extname(e.filename).toLowerCase()];
   if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);let valid=!!m&&!!(m[1]||m[2]);if(valid){if(!m[1]){const suffix=Number(m[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,s.size-suffix);}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),s.size-1):s.size-1;}valid=valid&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<s.size&&end>=start;}
    if(!valid){res.writeHead(416,{'Content-Range':'bytes */'+s.size,'Cache-Control':'no-store'});res.end();return true;}partial=true;
   }
   const headers={'Content-Type':mime,'Content-Length':s.size?end-start+1:0,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(partial)headers['Content-Range']='bytes '+start+'-'+end+'/'+s.size;res.writeHead(partial?206:200,headers);
   if(!s.size){res.end();return true;}const stream=handle.createReadStream({start,end,autoClose:true});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());streamed=true;stream.pipe(res);return true;
  }finally{if(!streamed)await handle.close();}
 }
 const serialize=fn=>{const next=fileOperation.catch(()=>{}).then(fn);fileOperation=next;return next;};return {list,item,details,annotate,settings,configure,location,open,media,family,linkVersions:data=>serialize(()=>linkVersions(data)),batch:data=>serialize(()=>batch(data)),purge:data=>serialize(()=>purge(data)),invalidate(){entryCache=null;},trash:data=>serialize(()=>trash(data)),restore:data=>serialize(()=>restore(data)),decorate};
}
