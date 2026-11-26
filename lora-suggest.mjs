/* 0.17.1: ✦ LoRA-ajánlás – csak kérésre.
   1) gépies előszűrés: az adott modellcsalád LoRA-i közül ~30 jelölt (prompt-szavak ↔ név, kulcsszó, Civitai-címke;
      kedvencek; a felhasználó jól sikerült képei ezzel a LoRA-val),
   2) a helyi MI ebből választ 1–3-at, egy mondatos indoklással (ha nincs helyi MI, az előszűrés legjobbjai jönnek),
   3) az erősség tényekből: saját jól sikerült képek → Civitai-ajánlás → óvatos 0,6. */
import {tokens} from './prompt-search.mjs';

const STOP=new Set('a an the of and or with in on at to for by from is are be this that very high quality best detailed photo image style lora v1 v2 v3 xl sdxl flux krea safetensors'.split(' '));
const base=n=>String(n||'').split(/[\\/]/).pop();
const words=s=>tokens(s).filter(w=>w.length>2&&!STOP.has(w));

/* Tiszta függvény: jelöltek pontozása. c: {name,title,tags[],triggers[],summary,favorite}, stats: {név(kisbetű) → {n,good,crown}} */
export function shortlist({prompt,candidates,stats={},max=30}){
 const want=new Set(words(prompt));
 const scored=candidates.map(c=>{const nameW=new Set(words(base(c.name).replace(/[_\-.]+/g,' ')+' '+(c.title||''))),tagW=new Set((c.tags||[]).flatMap(words)),trigW=new Set((c.triggers||[]).flatMap(words)),sumW=new Set(words(c.summary||''));
  let hit=0;const why=[];for(const w of want){if(nameW.has(w)){hit+=3;why.push(w);}else if(trigW.has(w)){hit+=3;why.push(w);}else if(tagW.has(w)){hit+=2;why.push(w);}else if(sumW.has(w))hit+=.5;}
  const s=stats[base(c.name).toLowerCase()]||{};const taste=(s.good||0)*.6+(s.crown||0)*1.2;
  return {...c,score:hit+taste+(c.favorite?1:0),matched:[...new Set(why)].slice(0,4),uses:s.n||0,good:s.good||0};});
 return scored.filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,max);
}

/* Erősség: saját jól sikerült képek mediánja → Civitai → 0,6 */
export function strengthFor(c,stats={},suggested){const s=stats[base(c.name).toLowerCase()];const list=(s?.strengths||[]).filter(Number.isFinite).sort((a,b)=>a-b);
 if(list.length){const m=list[Math.floor(list.length/2)];return {value:Math.round(m*100)/100,source:'own',count:list.length};}
 if(Number.isFinite(c.weight)&&c.weight>0)return {value:Math.round(c.weight*100)/100,source:'civitai'};if(Number.isFinite(suggested)&&suggested>=.05&&suggested<=1)return {value:Math.round(suggested*100)/100,source:'ai'};return {value:.6,source:'default'};}

export function isLtx23Candidate(name,source={}){
 const version=String(source?.baseModel||'');
 const identifies=(text,minor)=>new RegExp('(?:z?ltx[\\s_.-]*)?2[\\s_.-]*'+minor+'(?!\\d)','i').test(text);
 if(identifies(version,5))return false;
 if(identifies(version,3))return true;
 const label=base(name)+' '+(source?.modelName||'');
 if(/ltx[\s_.-]*2[\s_.-]*5(?!\d)/i.test(label))return false;
 return /ltx[\s_.-]*2[\s_.-]*3(?!\d)|\bzltx/i.test(label);
}
export function createLoraSuggest({automatic,library,history,assistant}){
 async function candidatesFor(backend,family){const inv=await automatic.list(backend);const rows=(inv.loras||[]).filter(l=>l.family===family);const out=[];let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<rows.length){const l=rows[next++];let d=null;if(l.localId){try{d=await library.detail(l.localId);}catch{}}
   out.push({name:l.name,family,favorite:!!l.favorite,title:d?.source?.modelName||'',tags:d?.source?.tags||[],triggers:d?.triggers||[],summary:d?.source?.summary||'',weight:d?.source?.weight??null,ltx23:family==='ltx'&&isLtx23Candidate(l.name,d?.source)});}}));
  return out;}
 async function suggest({backend,prompt,family,model,includeLtx23=true}={}){
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>24000)throw Error('Írj promptot az ajánláshoz.');if(!family)throw Error('Ehhez a modellhez nem ismert a modellcsalád.');
  const all=(await candidatesFor(backend,family)).filter(c=>includeLtx23||!c.ltx23);if(!all.length)return {picks:[],note:'Ehhez a modellcsaládhoz nincs LoRA a gépeden.'};
  let stats={};try{stats=await history.loraStats();}catch{}
  const short=shortlist({prompt,candidates:all,stats});if(!short.length)return {picks:[],note:'Egyik LoRA neve, kulcsszava vagy címkéje sem kapcsolódik a prompthoz.'};
  let picked=null,usedAI=false;
  if(model){try{const r=await assistant({action:'loraSuggest',model,prompt,family,candidates:short.map(c=>({name:base(c.name),title:c.title,tags:c.tags.slice(0,12),triggers:c.triggers.slice(0,4),summary:c.summary.slice(0,200),good:c.good}))});
   const byName=new Map(short.map(c=>[base(c.name).toLowerCase(),c]));picked=(r?.picks||[]).map(p=>{const c=byName.get(String(p.name||'').toLowerCase());return c?{...c,suggestedStrength:p.strength,reason:String(p.reason||'').slice(0,240)}:null;}).filter(Boolean).slice(0,3);usedAI=picked.length>0;}catch(e){picked=null;}}
  if(!picked?.length)picked=short.slice(0,3).map(c=>({...c,reason:''}));
  return {usedAI,picks:picked.map(c=>{const st=strengthFor(c,stats,c.suggestedStrength);return {name:c.name,family,ltx23:c.ltx23,title:c.title,reason:c.reason,matched:c.matched,triggers:c.triggers.slice(0,6),strength:st.value,strengthSource:st.source,strengthCount:st.count||0,uses:c.uses,good:c.good};})};
 }
 return {suggest};
}
