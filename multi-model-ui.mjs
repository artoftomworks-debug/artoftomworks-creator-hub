// 0.16 DEV — „⧉ Több modellel”: ugyanaz a prompt több képmodellel, egy indítással.
// Minden modell a saját megjegyzett beállításaival fut (lépésszám, sampler, scheduler, CFG), alapból
// ugyanazokkal a seedekkel (igazságos összehasonlítás). Modellenként egy sorba állított terv, így a gépen
// modellváltás csak modellenként egyszer van, a memóriát közben a Hub felszabadítja.
import {activeModelSummary} from './active-model-ui.mjs';
import {advisorModel} from './ai-review-ui.mjs';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
// SD 1.x / 2.x were trained around 512–768 px: keep the aspect, cap the long side at 768.
const sp=t=>{const e=document.createElement('span');e.textContent=t;return e;};
const TPL_KEY='creatorHub.multiTemplates';
export function loadTemplates(storage=globalThis.localStorage){try{const v=JSON.parse(storage?.getItem(TPL_KEY)||'[]');return Array.isArray(v)?v.filter(t=>t&&typeof t.name==='string'&&Array.isArray(t.models)):[];}catch{return [];}}
export function saveTemplate(t,storage=globalThis.localStorage){const list=loadTemplates(storage).filter(x=>x.name!==t.name);list.unshift({name:String(t.name).slice(0,60),models:[...t.models],formats:(t.formats||[]).filter(f=>['portrait','landscape','square'].includes(f)),count:Math.max(1,Math.min(8,Number(t.count)||1)),same:t.same!==false,...(Number.isInteger(t.seed)?{seed:t.seed}:{}),saved:Date.now()});try{storage?.setItem(TPL_KEY,JSON.stringify(list.slice(0,30)));}catch{}return list;}
export function deleteTemplate(name,storage=globalThis.localStorage){const list=loadTemplates(storage).filter(x=>x.name!==name);try{storage?.setItem(TPL_KEY,JSON.stringify(list));}catch{}return list;}
// Pure: which of the template's models are still available?
export function applyTemplate(t,available){const have=new Set(available);return {found:t.models.filter(id=>have.has(id)),missing:t.models.filter(id=>!have.has(id))};}
export function sizeForFamily(family,width,height){
  if(!['sd1','sd2'].includes(family))return {width,height};
  const long=Math.max(width,height);if(long<=768)return {width,height};
  const k=768/long,r=v=>Math.max(256,Math.round(v*k/64)*64);return {width:r(width),height:r(height)};
}
// Seeds per model: same series for every model (fair comparison) or a fresh block per model.
// Orientation variants with the same pixel budget as the chosen size (multiples of 64).
export function formatSizes(width,height){
  const area=width*height,r=v=>Math.max(256,Math.round(v/64)*64),long=Math.max(width,height),short=Math.min(width,height);
  let ratio=long/short;if(ratio<1.1)ratio=1.5; // square input: use 2:3 / 3:2 for the oriented variants
  const l=Math.sqrt(area*ratio),s=Math.sqrt(area/ratio),q=r(Math.sqrt(area));
  return {portrait:{width:r(s),height:r(l)},landscape:{width:r(l),height:r(s)},square:{width:q,height:q}};
}
export function seedFor(base,index,count,same){return same?base:base+index*count;}

export function createMultiModelUI({$,current,state,request,automatic,collectPlan,notify,isBusy,onQueued=()=>{},startImageGuard=()=>null}){
  const start=$('start');if(!start)return {};
  /* 0.16 DEV: részletekben indítás – ami nem fér a 20-as várólistára, itt vár, és magától sorba áll, amint hely szabadul fel. */
  const backlog=[];let pumpTimer=null;
  const leaveGuard=e=>{if(backlog.length){e.preventDefault();e.returnValue='';}};addEventListener('beforeunload',leaveGuard);
  function pump(){clearTimeout(pumpTimer);if(!backlog.length)return;pumpTimer=setTimeout(async()=>{while(backlog.length){try{await backlog[0]();backlog.shift();onQueued();}catch(e){if(/Legfeljebb 20 terv/.test(e.message))break;backlog.shift();notify(['⧉ Több modellel:',' ',e.message],true);}}if(backlog.length)pump();else notify(['⧉ Több modellel:',' ','A részletekben indított összehasonlítás minden terve sorba állt.']);},6000);}
  const btn=el('button','⧉ Több modellel','multiModelButton');btn.type='button';btn.title='Ugyanaz a prompt több képmodellel, egy indítással – modellenként a saját beállításaival';
  /* 0.16 DEV: közvetlenül a Generálás indítása mellett (a Továbbiak ▾ elé) */const place=()=>{if(start.nextElementSibling!==btn)start.after(btn);};place();setTimeout(place,1500);setTimeout(place,5000);
  const st=document.createElement('style');st.textContent=`.multiModelButton{white-space:nowrap;flex:none}
.multiModelDialog{width:min(980px,95vw);max-height:92vh}.multiModelDialog .mmList{max-height:48vh;overflow:auto;border:1px solid #2c4550;border-radius:9px;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.multiModelDialog .mmCard{display:grid!important;grid-template-columns:auto 64px 1fr;gap:8px;align-items:center;padding:6px!important;border:1px solid #2c4550;border-radius:9px;cursor:pointer}.multiModelDialog .mmCard.on{border-color:var(--gold,#f2c584);background:#17313c}.multiModelDialog .mmCard[hidden]{display:none!important}.multiModelDialog .mmPic{width:64px;height:64px;border-radius:7px;background:#071116;display:flex;align-items:center;justify-content:center;font-size:11px;color:#7d96a2;overflow:hidden}.multiModelDialog .mmPic img{width:100%;height:100%;object-fit:cover}.multiModelDialog .mmInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.multiModelDialog .mmName{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.multiModelDialog .mmScore{font-size:11px;color:#f2c584}.multiModelDialog .mmCard .mmWhy{grid-column:1/-1}
.multiModelDialog .mmList label{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px}.multiModelDialog .mmList label:hover{background:#17313c}
.multiModelDialog .mmFamily{font-size:11px;color:#9fb6c1;white-space:nowrap}.multiModelDialog .mmRow{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:8px 0}
.multiModelDialog .mmTemplates input[type=text],.multiModelDialog .mmTemplates input:not([type]){min-width:200px}.multiModelDialog .mmTemplates select{min-width:180px}
.multiModelDialog .mmSummary{margin:8px 0;font-weight:600}.multiModelDialog .mmSummary.soft{font-weight:400;color:#f2d3a0}.multiModelDialog .mmRow label.check{display:inline-flex!important;flex-direction:row!important;align-items:center;gap:6px;margin:0}.multiModelDialog .mmRow label.check input{width:18px!important;height:18px!important;margin:0}.multiModelDialog .mmLog{font-size:12px;max-height:20vh;overflow:auto}`;
  document.head.append(st);
  const show=()=>{btn.hidden=!['image','video'].includes(state().mode);};/* 0.16 DEV: videóra is */setInterval(show,1000);show();

  async function open(){
    if(isBusy())return;
    let base;try{base=collectPlan();}catch(e){notify(e.message,true);return;}
    if(base.mode!=='automatic'){notify('A „Több modellel” mód az automatikus modellválasztással működik (saját workflow-hoz nem).',true);return;}
    try{await automatic.refresh?.();}catch{}const c=current(),models=automatic.models();
    /* random seed mode (-1): pick one base seed now, so every model can get the same series */let baseSeed=Number(c.seed)>=0&&c.seedMode!=='random'?Number(c.seed):crypto.getRandomValues(new Uint32Array(1))[0]%2147483647;if(!models.length){notify('Nem találok használható képmodellt. Ha a ComfyUI éppen indul, várj pár másodpercet, és próbáld újra.',true);return;}
    const d=el('dialog',null,'generationDialog multiModelDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();
    head.append(el('h2','⧉ Több modellel · ugyanaz a prompt'),close);d.append(head);
    d.append(el('p',`Prompt: „${String(c.prompt).slice(0,160)}${String(c.prompt).length>160?'…':''}” · ${c.width} × ${c.height}`,'muted'));
    const search=el('input');search.type='search';search.placeholder='Modell keresése…';search.style.width='100%';
    const tools=el('div',null,'mmRow'),all=el('button','Mind'),none=el('button','Egyik sem'),ai=el('button','✦ MI-ajánlás'),aiTake=el('button','Ajánlottak bejelölése');all.type=none.type=ai.type=aiTake.type='button';aiTake.hidden=true;
    const aiModel=advisorModel();ai.disabled=!aiModel;ai.title=aiModel?'A helyi MI ('+aiModel+') a prompt alapján javasol 2–4 modellt a te modelljeid közül – a választás a tiéd':'Ehhez válassz helyi modellt a ✦ MI-segítőben. Nélküle is mindent ki tudsz választani kézzel.';
    tools.append(search,all,none,ai,aiTake);d.append(tools);const aiNote=el('p','','muted');d.append(aiNote);let aiPicks=[];
    const list=el('div',null,'mmList');d.append(list);
    const current_id=c.automatic?.id,checks=new Map();
    for(const m of models.sort((a,b)=>String(a.family).localeCompare(b.family)||String(a.name).localeCompare(b.name))){
      /* 0.16 DEV: kártya bélyegképpel, családdal és (ha van) az ízlésprofil szerinti átlagoddal */
      const l=el('label',null,'mmCard'),cb=el('input'),pic=el('div',null,'mmPic'),info=el('div',null,'mmInfo'),short=String(m.name).split(/[\\/]/).pop();cb.type='checkbox';cb.checked=m.id===current_id;checks.set(m.id,{cb,m,l});
      if(m.localId){const im=el('img');im.loading='lazy';im.alt='';im.src='/api/library/thumbnail?id='+encodeURIComponent(m.localId);im.onerror=()=>{im.remove();pic.textContent=(m.family||'?').slice(0,6);};pic.append(im);}else pic.textContent=(m.family||'?').slice(0,6);
      const nm=el('span',short.replace(/\.(safetensors|ckpt|gguf|sft)$/i,''),'mmName');nm.title=short;const meta=el('span',null,'mmFamily');meta.append((m.favorite?'★ ':'')+(m.family||'')+(['ltx','h3'].includes(m.family)?' · 🔊':''));if(['ltx','h3'].includes(m.family))meta.title='Hangot is generál';const score=el('span','','mmScore');info.append(nm,meta,score);
      l.append(cb,pic,info);list.append(l);cb.onchange=()=>{l.classList.toggle('on',cb.checked);summary();};l.classList.toggle('on',cb.checked);
    }
    /* ízlésprofil: modellenkénti átlag a kártyákon */void fetch('/api/taste').then(r=>r.json()).then(t=>{for(const {m,l} of checks.values()){const name=String(m.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft|pt)$/i,'');const hit=(t.models||[]).find(x=>x.model===name);if(hit){const sc=l.querySelector('.mmScore');sc.textContent='★ '+hit.avg.toLocaleString(undefined,{maximumFractionDigits:1})+' ('+hit.n+')';sc.title='Az értékeléseid átlaga ennél a modellnél';}}}).catch(()=>{});
    /* gyorsválasztók: kedvencek, egy család */const favB=el('button','★ Kedvencek'),fam=el('select');favB.type='button';favB.title='A kedvencnek jelölt modellek bejelölése';fam.add(new Option('+ Egy család összes modellje',''));for(const f of [...new Set(models.map(m=>m.family).filter(Boolean))].sort())fam.add(new Option(f,f));
    favB.onclick=()=>{for(const {cb,m,l} of checks.values())if(m.favorite){cb.checked=true;l.classList.add('on');}summary();};fam.onchange=()=>{for(const {cb,m,l} of checks.values())if(m.family===fam.value){cb.checked=true;l.classList.add('on');}fam.value='';summary();};tools.insertBefore(fam,ai);tools.insertBefore(favB,fam);
    ai.onclick=async()=>{ai.disabled=true;aiNote.textContent='✦ A helyi MI gondolkodik…';for(const {l} of checks.values())l.querySelector('.mmWhy')?.remove();
      try{const r=await request('studio/assistant',{action:'recommend',model:aiModel,prompt:c.prompt,candidates:models.map(m=>({id:m.id,name:String(m.name).split(/[\\/]/).pop(),family:m.family}))});aiPicks=r.picks||[];
        for(const p of aiPicks){const v=checks.get(p.id);if(!v)continue;const why=el('div','✦ '+p.reason,'mmWhy');why.style.cssText='font-size:11px;color:#f2c584;flex-basis:100%;margin-left:26px';v.l.style.flexWrap='wrap';v.l.append(why);}
        aiNote.textContent=aiPicks.length?`✦ ${aiPicks.length} javasolt modell (sárga megjegyzés). Csak javaslat – a pipákat te teszed be, vagy jelöld be őket egyben.`:'A MI nem adott javaslatot.';aiTake.hidden=!aiPicks.length;}
      catch(e){aiNote.textContent='✦ '+e.message;}finally{ai.disabled=false;}};
    aiTake.onclick=()=>{for(const p of aiPicks){const v=checks.get(p.id);if(v){v.cb.checked=true;v.l.classList.add('on');}}summary();};
    search.oninput=()=>{const q=search.value.trim().toLowerCase();for(const {m,l} of checks.values())l.hidden=!!q&&!(String(m.name).toLowerCase().includes(q)||String(m.family).toLowerCase().includes(q));};
    all.onclick=()=>{for(const {cb,l} of checks.values())if(!l.hidden){cb.checked=true;l.classList.add('on');}summary();};none.onclick=()=>{for(const {cb,l} of checks.values()){cb.checked=false;l.classList.remove('on');}summary();};
    const isVideo=state().mode==='video';const row=el('div',null,'mmRow'),countL=el('label',isVideo?'Videó modellenként':'Kép modellenként'),count=el('input');count.type='number';count.min=1;count.max=isVideo?3:8;count.value=isVideo?1:Math.max(1,Math.min(8,Number(c.count)||2));countL.append(count);
    /* 0.16 DEV: videónál „Próba” – rövidebb, kisebb, kevesebb lépés: gyors döntés, utána a győztes teljes minőségben */const probeL=el('label',null,'check'),probe=el('input');probe.type='checkbox';probe.checked=isVideo;probeL.append(probe,el('span','Próba: rövid (3 mp), kisebb felbontás, fele annyi lépés'));probeL.title='Modellenként 1–2 perc a 7–8 helyett. A győztest utána teljes minőségben futtathatod.';probeL.hidden=!isVideo;probe.onchange=()=>summary();
    const sameL=el('label',null,'check'),same=el('input');same.type='checkbox';same.checked=true;sameL.append(same,document.createTextNode(' Azonos seedek minden modellnél (összehasonlításhoz)'));
    const sizes=formatSizes(c.width,c.height),orient=c.width>c.height*1.05?'landscape':c.height>c.width*1.05?'portrait':'square',fmts=new Map();
    const fmtRow=el('div',null,'mmRow');fmtRow.append(el('strong','Formátum:'));
    for(const [key,label] of [['portrait','▯ Álló'],['landscape','▭ Fekvő'],['square','□ Négyzetes']]){const l=el('label',null,'check'),cb=el('input');cb.type='checkbox';cb.checked=key===orient;cb.onchange=summary;l.append(cb,el('span',label),document.createTextNode(` (${sizes[key].width} × ${sizes[key].height})`));fmtRow.append(l);fmts.set(key,cb);}
    row.append(countL,sameL,probeL);d.append(row,fmtRow);count.oninput=summary;
    /* 0.16 DEV: mentett összehasonlító sablonok – modellek, formátumok, képszám, azonos seed (és ha kéred, maga a seed is, hogy később ugyanaz a teszt fusson) */
    const tplRow=el('div',null,'mmRow mmTemplates'),tplSel=el('select'),tplName=el('input'),tplSeedL=el('label',null,'check'),tplSeed=el('input'),tplSave=el('button','💾 Mentés sablonként'),tplDel=el('button','🗑');tplSave.type=tplDel.type='button';tplDel.title='A kiválasztott sablon törlése';tplName.placeholder='Sablon neve, pl. Portré-teszt';tplName.maxLength=60;tplSeed.type='checkbox';tplSeedL.title='A sablon a mostani seedet is megjegyzi – így két hét múlva is pontosan ugyanaz a teszt fut';tplSeedL.append(tplSeed,' ',el('span','seed is'));
    const tplNote=el('p','','muted');
    function fillTemplates(sel=''){const list=loadTemplates();tplSel.replaceChildren(new Option('Sablon: —',''),...list.map(t=>new Option(t.name,t.name)));tplSel.value=sel;tplDel.disabled=!tplSel.value;}
    tplSel.onchange=()=>{tplDel.disabled=!tplSel.value;const t=loadTemplates().find(x=>x.name===tplSel.value);if(!t){tplNote.textContent='';return;}
      const r=applyTemplate(t,[...checks.keys()]);for(const [id,{cb}] of checks)cb.checked=r.found.includes(id);for(const [k,cb] of fmts)cb.checked=t.formats.includes(k);count.value=t.count;same.checked=t.same;if(Number.isInteger(t.seed))baseSeed=t.seed;tplName.value=t.name;tplSeed.checked=Number.isInteger(t.seed);
      tplNote.replaceChildren(...(r.missing.length?[el('span','⚠ '),el('span',r.missing.length+' modell a sablonból már nincs meg:'),' '+r.missing.map(x=>String(x).split(/[\\/|]/).pop()).join(', ')]:[]));summary();};
    tplSave.onclick=()=>{const name=tplName.value.trim();if(!name){tplName.focus();notify('Adj nevet a sablonnak.',true);return;}const t={name,models:picked().map(m=>m.id),formats:formats(),count:Math.max(1,Math.min(8,Number(count.value)||1)),same:same.checked,...(tplSeed.checked?{seed:baseSeed}:{})};if(!t.models.length){notify('Jelölj ki legalább egy modellt.',true);return;}saveTemplate(t);fillTemplates(name);notify(['Sablon mentve:',' '+name]);};
    tplDel.onclick=()=>{const name=tplSel.value;if(!name)return;deleteTemplate(name);fillTemplates();tplNote.textContent='';notify(['Sablon törölve:',' '+name]);};
    tplRow.append(tplSel,tplName,tplSeedL,tplSave,tplDel);head.after(tplRow,tplNote);fillTemplates();
    const sum=el('p','','mmSummary'),log=el('div','','mmLog muted'),foot=el('div',null,'mmRow'),go=el('button','▶ Indítás – sorba állítás','primary');go.type='button';foot.append(go);d.append(sum,foot,log);
    function picked(){return [...checks.values()].filter(v=>v.cb.checked).map(v=>v.m);}
    function formats(){return [...fmts].filter(([,cb])=>cb.checked).map(([k])=>k);}
    function summary(){sum.classList.remove('soft');const n=picked().length,f=formats().length,k=Math.max(1,Math.min(8,Number(count.value)||1));if(n&&!f){sum.textContent='Jelölj ki legalább egy formátumot.';go.disabled=true;return;}go.replaceChildren(el('span',n*f>20?'▶ Indítás részletekben':'▶ Indítás – sorba állítás'));if(n*f>60){sum.classList.add('soft');sum.replaceChildren(document.createTextNode(n*f+' '),el('span','terv lenne.'),' ',el('span','Egy indítással legfeljebb 60 terv kérhető – vegyél ki néhány modellt vagy formátumot.'));go.disabled=true;return;}if(n)sum.replaceChildren(sp(isVideo?`${n} modell × ${f} formátum × ${k} videó = ${n*f*k} videó`:`${n} modell × ${f} formátum × ${k} kép = ${n*f*k} kép`),...(isVideo?[' · ',sp(probe.checked?'próba: kb. 1–2 perc / videó':'teljes minőség: videónként akár több perc')]:[]),' · seed: ',...(same.checked?[sp('modellenként'),' '+Array.from({length:Math.min(k,4)},(_,j)=>baseSeed+j).join(', ')+(k>4?', …':'')+' – ',sp('minden modellnél ugyanezek')]:[sp('minden modell új sorozatot kap'),' (',sp('kezdő seed:'),' '+baseSeed+')']));else sum.textContent='Jelölj ki legalább egy modellt.';go.disabled=!n;if(n*f>20){const note=el('div',null,'mmParts');note.append(document.createTextNode(n*f+' '),el('span','terv – a várólistára egyszerre 20 fér, ezért részletekben indul: ami most nem fér be, automatikusan utána áll sorba, amint hely szabadul fel. Addig ne zárd be a Hubot.'));sum.append(note);}}
    same.onchange=summary;summary();
    go.onclick=async()=>{
      const chosen=picked(),k=Math.max(1,Math.min(8,Number(count.value)||1));if(!chosen.length)return;go.disabled=true;log.replaceChildren();
      /* 0.17: kezdőkép-figyelő itt is */const guard=startImageGuard?.(),hasImage=!!base.payload?.image&&base.payload.useImage!==false;let imgChoice='with';if(guard&&hasImage){try{imgChoice=await guard.confirm();}catch{imgChoice='with';}if(imgChoice==='cancel'){go.disabled=false;return;}if(imgChoice==='without'){base.payload.image='';base.payload.useImage=false;}}
      const say=(...t)=>{const d=el('div');d.append(...t);log.append(d);log.scrollTop=log.scrollHeight;};
      const stamp=new Date().toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}),group=(state().projectName?state().projectName+' · ':'')+'Modell-összehasonlítás '+(isVideo?(probe.checked?'(videó, próba) ':'(videó) '):'')+stamp;
      let ok=0,total=0,failed=0;const batchId=crypto.randomUUID();
      const work=[];for(const [i,m] of chosen.entries())for(const fmt of formats())work.push([i,m,fmt]);const totalPlans=work.length;let deferred=0;
      const enqueueOne=async(i,m,fmt)=>{
          const want=sizes[fmt]||{width:c.width,height:c.height},trial=isVideo&&probe.checked,scaled=trial?{width:Math.max(256,Math.round(want.width*0.6/32)*32),height:Math.max(256,Math.round(want.height*0.6/32)*32)}:want,size=sizeForFamily(m.family,scaled.width,scaled.height),p=await automatic.planFor(m.id,size),plan=structuredClone(base);
          if(trial&&p.sampling?.steps){p.sampling={...p.sampling,steps:Math.max(4,Math.round(p.sampling.steps/2))};if(p.controls?.sampling)p.controls={...p.controls,sampling:{...p.controls.sampling,steps:p.sampling.steps}};}if(trial)plan.payload.duration=Math.min(Number(c.duration)||3,3);
          Object.assign(plan.payload,{id:m.id,sampling:p.sampling,controls:{...p.controls,seed:seedFor(baseSeed,i,k,same.checked)},seed:seedFor(baseSeed,i,k,same.checked),seedMode:'increment',seedStep:1,count:k,width:size.width,height:size.height,projectName:group});
          await request('generation/enqueue',{...plan,batch:{id:batchId,label:group,index:work.findIndex(w=>w[1]===m&&w[2]===fmt),total:totalPlans,images:k,model:String(m.name).split(/[\\/]/).pop(),format:{portrait:'álló',landscape:'fekvő',square:'négyzetes'}[fmt]}});return {p,size};};
      for(const [n,[i,m,fmt]] of work.entries()){
        if(deferred){backlog.push(async()=>enqueueOne(i,m,fmt));continue;}
        try{
          const {p,size}=await enqueueOne(i,m,fmt);ok++;total+=k;
          let est=[];try{const s=p.sampling||{},r=await request('generation/estimate',{mode:isVideo?'video':'image',duration:isVideo?(probe.checked?Math.min(Number(c.duration)||3,3):c.duration):undefined,models:activeModelSummary({info:p.info,controls:{models:[]}},{}).names,width:size.width,height:size.height,steps:s.steps,sampler:s.sampler,scheduler:s.scheduler,cfg:s.cfg,count:k});if(r?.available)est=[' · ',sp('kb. '+(r.seconds>=60?Math.round(r.seconds/60)+' perc':Math.round(r.seconds)+' mp'))];}catch{}
          say(`✓ ${String(m.name).split(/[\\/]/).pop()} · `,sp({portrait:'álló',landscape:'fekvő',square:'négyzetes'}[fmt]),` ${size.width} × ${size.height} · `,sp(`${k} kép`),' · ',sp(`${p.sampling?.steps??'?'} lépés`),p.sampling?.sampler?' · '+p.sampling.sampler:'',...(p.droppedLoras?[' · ',sp('LoRA nélkül (nem illik a modellhez)')]:[]),...est);
        }catch(e){if(/Legfeljebb 20 terv/.test(e.message)){deferred++;backlog.push(async()=>enqueueOne(i,m,fmt));continue;}failed++;say(`✗ ${String(m.name).split(/[\\/]/).pop()}: `,sp(e.message));}
      }
      sum.textContent=ok?`Sorba állítva: ${ok} terv, ${total} kép. Az Előzményekben a „${group}” projektnévvel találod őket.`:'Egyik modellt sem sikerült sorba állítani.';
      if(deferred){const w=backlog.length;sum.append(' ',document.createTextNode(w+' '),el('span','terv még vár, és magától sorba áll, amint hely szabadul fel. Addig ne zárd be a Hubot.'));pump();}
      if(ok){notify(`⧉ Több modellel: ${ok} terv, ${total} kép sorba állítva („${group}”). A haladást és a szünet/megszakítás gombokat a generálás sávjában látod.`);onQueued();}
      if(ok&&hasImage&&imgChoice==='with')guard?.markUsed?.();/* all queued without error: the window closes itself – control moves to the series bar */if(ok&&!failed){setTimeout(()=>{if(d.open)d.close();},deferred?4000:1200);return;}
      if(!deferred){go.disabled=false;go.textContent='▶ Újra sorba állítás';}
    };
    d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  }
  btn.onclick=()=>void open();
  return {open};
}
