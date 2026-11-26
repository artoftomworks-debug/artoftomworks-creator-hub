// 0.17.1 DEV — ✦ Automatikus MI-címkék az Előzményekhez.
// Két forrás: (1) a prompt szavai – azonnal, MI nélkül; (2) ha be van kapcsolva, a helyi képfelismerő (vision) modell.
// Rögzített, rövid szótár (a címkék azonosítói nyelvfüggetlenek, a felirat fordítható). Csak üresjáratban dolgozik:
// generálás közben vár, és a képfelismerő modellt rövid ideig tartja a memóriában. A felhasználó saját kategóriájához nem nyúl;
// a levett MI-címkét megjegyzi, és nem teszi vissza.
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {profileContext} from './profiles.mjs';

// id · magyar felirat · angol felirat · kulcsszavak (angol + magyar, a prompt felismeréséhez)
import {readFileSync} from 'node:fs';
import {TAGS,TAG_IDS,LEVELS,tagLabel,cleanVision,visionSystem} from './auto-tags-vocab.mjs';
export {TAGS,TAG_IDS,LEVELS,tagLabel,cleanVision,visionSystem};
// A prompt felismerő kulcsszavai (angol + magyar) külön JSON-ban; Unicode-szóhatár, hogy az ékezetes szavak elején/végén is működjön.
const WORDS=JSON.parse(readFileSync(new URL('./auto-tags-words.json',import.meta.url),'utf8'));
const MATCHERS=TAG_IDS.filter(id=>WORDS[id]).map(id=>[id,new RegExp('(?<![\\p{L}\\p{N}])(?:'+WORDS[id]+')(?![\\p{L}\\p{N}])','iu')]);
export function promptTags(text){const s=String(text||'');if(!s.trim())return [];return MATCHERS.filter(([,re])=>re.test(s)).map(([id])=>id);}

const IMAGE_EXT={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
export function createAutoTagger({root,history,assistant,isBusy=async()=>false,log=()=>{},clock=Date.now,intervalMS=4000,idleMS=30000}={}){
 const file=path.join(root,'data','autotag.json');let settings=null,timer=null,running=false,stopped=false,lastError='',paused='',done=0,lastVisionAt=0;
 async function load(){if(settings)return settings;try{settings=JSON.parse(await readFile(file,'utf8'));}catch{settings={};}settings={enabled:settings.enabled!==false,vision:!!settings.vision,model:typeof settings.model==='string'?settings.model:'',backfill:settings.backfill!==false};return settings;}
 async function save(){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(settings,null,1));await rename(tmp,file);}
 async function configure(data={}){await load();if('enabled'in data)settings.enabled=!!data.enabled;if('vision'in data)settings.vision=!!data.vision;if('model'in data&&typeof data.model==='string')settings.model=data.model.slice(0,200);if('backfill'in data)settings.backfill=!!data.backfill;lastError='';await save();schedule(500);return status();}
 async function status(){await load();const c=await history.aiTagCounts();return {...settings,tagged:c.tagged,total:c.total,running,paused,error:lastError};}
 async function imageData(id){const loc=await history.location(id);if(!loc.available||!loc.path)return null;const type=IMAGE_EXT[path.extname(loc.path).toLowerCase()];if(!type)return null;const s=await stat(loc.path);if(s.size>6*1024**2)return null;return 'data:'+type+';base64,'+(await readFile(loc.path)).toString('base64');}
 async function one(){
  const next=await history.nextUntagged({backfill:settings.backfill});if(!next)return false;
  let prompt='';try{prompt=String((await history.details(next.id))?.prompt||'');}catch{}
  let tags=promptTags(prompt),level='',source='prompt';
  if(settings.vision&&settings.model&&next.mode==='image'){
   if(await isBusy()){paused='generation';return false;}
   const image=await imageData(next.id).catch(()=>null);
   if(image){try{const r=cleanVision(await assistant({action:'tag',model:settings.model,image,prompt:prompt.slice(0,1500),system:visionSystem()}));tags=[...new Set([...r.tags,...tags])].slice(0,8);level=r.level;source='vision';lastVisionAt=clock();lastError='';}
    catch(e){const m=String(e.message||e);if(/generálás fut|mással dolgozik/i.test(m)){paused='generation';return false;}if(/nem lát képet|nincs telepítve/i.test(m)){settings.vision=false;await save().catch(()=>{});}lastError=m;log('autotag: '+m);}}
  }
  await history.setAiTags({id:next.id,tags,level,source});done++;return true;
 }
 async function tick(){if(running||stopped)return;running=true;let more=false;try{await load();if(!settings.enabled){paused='off';return;}if(await isBusy()){paused='generation';return;}paused='';more=await one();}catch(e){lastError=String(e.message||e);log('autotag: '+lastError);}finally{running=false;schedule(more?intervalMS:idleMS);}}
 /* a háttérmunka minden profil képeit címkézi (rendszerkörnyezetben), a megjelenítés továbbra is profilonként szűr */
 function schedule(ms){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>void profileContext.run({system:true},()=>tick()),ms);timer.unref?.();}
 async function removeTag(data){return history.removeAiTag(data);}
 schedule(8000);
 return {status,configure,removeTag,tick,stop(){stopped=true;clearTimeout(timer);},get done(){return done;}};
}
