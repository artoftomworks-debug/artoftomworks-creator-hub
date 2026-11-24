// 0.16 DEV — Ízlésprofil („✦ Mi vált be?”). MI nélkül, egyszerű statisztika a saját értékeléseidből:
// melyik modell, lépésszám, formátum és LoRA kap nálad jó pontot – összesen és témánként (portré, táj, egyéb).
// Pontszám: az 1–5 értékelés; a csak csillaggal jelölt kép 5-nek számít. Csak javaslat – semmit nem állít át magától.
const TOPICS=[['portrait',/\b(portrait|face|woman|man|girl|boy|lady|person|people|headshot|selfie|model|portré|arc|nő|férfi|lány|fiú)\b/i],
  ['landscape',/\b(landscape|mountain|forest|beach|sea|ocean|lake|river|city|street|sky|sunset|valley|desert|táj|hegy|erdő|tenger|város|utca|naplemente)\b/i]];
export function topicOf(prompt=''){for(const [k,re] of TOPICS)if(re.test(String(prompt)))return k;return 'other';}
export const scoreOf=e=>Number.isFinite(e?.rating)&&e.rating>=1?Number(e.rating):e?.favorite?5:null;
const modelName=m=>String(m||'').split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft|pt)$/i,'');
const fmt=(w,h)=>w>h*1.05?'landscape':h>w*1.05?'portrait':'square';
function group(rows,key){const m=new Map();for(const r of rows){const k=key(r);if(k==null||k==='')continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}
const avg=a=>a.reduce((s,r)=>s+r.score,0)/a.length;const round=v=>Math.round(v*10)/10;
function stats(rows,key,min=1){return [...group(rows,key)].map(([k,a])=>({key:k,n:a.length,avg:round(avg(a)),fav:a.filter(r=>r.favorite).length})).filter(x=>x.n>=min).sort((a,b)=>b.avg-a.avg||b.n-a.n);}
// Pure. rows: [{rating,favorite,model,steps,width,height,prompt,loras:[name]}]
export function analyzeTaste(items,{minGroup=2}={}){
  const rows=items.map(e=>({...e,score:scoreOf(e),model:modelName(e.model),topic:topicOf(e.prompt),format:fmt(Number(e.width)||1,Number(e.height)||1)})).filter(r=>r.score!=null&&r.model);
  const out={rated:rows.length,favorites:rows.filter(r=>r.favorite).length,enough:rows.length>=5,models:[],topics:[],steps:[],formats:[],loras:[],strong:false};
  if(!rows.length)return out;
  out.models=stats(rows,r=>r.model).map(x=>{const own=rows.filter(r=>r.model===x.key&&Number.isFinite(r.steps));const st=stats(own,r=>r.steps);return {model:x.key,n:x.n,avg:x.avg,fav:x.fav,bestSteps:st[0]&&st[0].n>=minGroup?st[0].key:null};});
  for(const [t,a] of group(rows,r=>r.topic)){const s=stats(a,r=>r.model,minGroup);if(s.length)out.topics.push({topic:t,best:{model:s[0].key,avg:s[0].avg,n:s[0].n},second:s[1]?{model:s[1].key,avg:s[1].avg,n:s[1].n}:null});}
  for(const [m,a] of group(rows,r=>r.model)){const s=stats(a.filter(r=>Number.isFinite(r.steps)),r=>r.steps,minGroup);if(s.length>1)out.steps.push({model:m,best:{steps:s[0].key,avg:s[0].avg,n:s[0].n},worst:{steps:s.at(-1).key,avg:s.at(-1).avg,n:s.at(-1).n}});}
  out.formats=stats(rows,r=>r.format,minGroup).map(x=>({format:x.key,avg:x.avg,n:x.n}));
  const loraNames=[...new Set(rows.flatMap(r=>r.loras||[]))];
  for(const l of loraNames){const w=rows.filter(r=>(r.loras||[]).includes(l)),wo=rows.filter(r=>!(r.loras||[]).includes(l));if(w.length>=minGroup&&wo.length>=minGroup)out.loras.push({lora:modelName(l),with:{avg:round(avg(w)),n:w.length},without:{avg:round(avg(wo)),n:wo.length}});}
  // Erős eltérés: a legjobb legalább 1 ponttal jobb a következőnél, mindkettőből legalább 3 kép → a gombon pötty jelzi.
  const strongPair=(a,b)=>a&&b&&a.n>=3&&b.n>=3&&a.avg-b.avg>=1;
  out.strong=out.enough&&(out.topics.some(t=>strongPair(t.best,t.second))||strongPair(out.models.filter(m=>m.n>=3)[0],out.models.filter(m=>m.n>=3)[1]));
  return out;
}
export function suggestFor(analysis,prompt,currentModel){const t=topicOf(prompt),hit=analysis.topics.find(x=>x.topic===t);if(!hit||!analysis.enough)return null;const cur=modelName(currentModel);if(hit.best.model===cur)return {topic:t,best:hit.best,same:true};return {topic:t,best:hit.best,same:false};}
// 0.16 DEV — Reggeli válogatás. Pure: az új (még értékeletlen) képek közül a profil alapján a legjobbak.
// Becsült pont: a modell átlaga (vagy az összes átlaga) + bónusz, ha a téma legjobb modellje / kedvelt formátum / bevált lépésszám.
// Ha még kevés az értékelés, modellenként a legfrissebbet adja (változatos válogatás).
export function pickBest(analysis,rows,limit=6){
  const all=(analysis?.models||[]);const base=all.length?all.reduce((s,m)=>s+m.avg*m.n,0)/Math.max(1,all.reduce((s,m)=>s+m.n,0)):3;
  const scored=rows.filter(r=>r&&r.mode!=='video').map(r=>{const model=modelName(r.model),m=all.find(x=>x.model===model),topic=topicOf(r.prompt),why=[];let score=m?m.avg:base;if(m&&m.avg>=base+0.3)why.push('kedvelt modell');
    const t=analysis?.topics?.find(x=>x.topic===topic);if(t&&t.best.model===model){score+=0.5;why.push('a téma legjobb modellje');}
    const f=analysis?.formats?.find(x=>x.format===fmt(Number(r.width)||1,Number(r.height)||1));if(f&&f.avg>base){score+=Math.min(0.4,(f.avg-base)/2);why.push('kedvelt formátum');}
    if(m?.bestSteps&&Number(r.steps)===Number(m.bestSteps)){score+=0.3;why.push('bevált lépésszám');}
    return {...r,model,score:Math.round(score*10)/10,why};});
  if(!analysis?.enough){const seen=new Set(),out=[];for(const r of [...scored].sort((a,b)=>(b.created||0)-(a.created||0))){if(seen.has(r.model))continue;seen.add(r.model);out.push({...r,why:['friss']});if(out.length>=limit)break;}
    for(const r of scored){if(out.length>=limit)break;if(!out.includes(r)&&!out.some(x=>x.id===r.id))out.push({...r,why:['friss']});}return {personal:false,picks:out.slice(0,limit)};}
  /* változatos válogatás: modellenként legfeljebb 2, ha van más is */const sorted=scored.sort((a,b)=>b.score-a.score||(b.created||0)-(a.created||0)),out=[],per=new Map();for(const r of sorted){if(out.length>=limit)break;if((per.get(r.model)||0)>=2)continue;per.set(r.model,(per.get(r.model)||0)+1);out.push(r);}for(const r of sorted){if(out.length>=limit)break;if(!out.includes(r))out.push(r);}
  return {personal:true,picks:out.map(r=>({...r,score:Math.min(5,r.score)}))};
}
export function createTaste({history}){
  async function collect(){const out=[];let page=1,pages=1;do{const r=await history.list({page:String(page)});pages=r.pages||1;for(const e of r.items||[]){if(e.mode!=='image'||!(e.favorite||e.rating))continue;let d={};try{d=await history.details(e.id);}catch{}out.push({rating:e.rating,favorite:e.favorite,model:(d.models||[])[0],steps:d.sampling?.steps,width:e.width,height:e.height,prompt:d.prompt||'',loras:(d.loras||[]).map(l=>l.name||l.lora||'').filter(Boolean)});}page++;}while(page<=pages&&page<=60);return out;}
  async function since(ts,max=200){const out=[];let page=1,pages=1;do{const r=await history.list({page:String(page)});pages=r.pages||1;for(const e of r.items||[]){if((e.created||0)<=ts){page=pages+1;break;}if(e.mode!=='image'||e.trashed||e.rating||e.favorite)continue;let d={};try{d=await history.details(e.id);}catch{}out.push({id:e.id,url:e.url,filename:e.filename,created:e.created,mode:e.mode,width:e.width,height:e.height,model:(d.models||[])[0],steps:d.sampling?.steps,prompt:d.prompt||''});if(out.length>=max)break;}page++;}while(page<=pages&&out.length<max&&page<=20);return out;}
  return {async analyze(){return analyzeTaste(await collect());},async pick(ts,limit=6){const rows=await since(Number(ts)||0);const a=analyzeTaste(await collect());const r=pickBest(a,rows,limit);return {total:rows.length,...r};}};
}
