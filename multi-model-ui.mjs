import {markNew,newBadge} from './new-feature-ui.mjs';
// 0.16 DEV — „⧉ Több modellel”: ugyanaz a prompt több képmodellel, egy indítással.
// Minden modell a saját megjegyzett beállításaival fut (lépésszám, sampler, scheduler, CFG), alapból
// ugyanazokkal a seedekkel (igazságos összehasonlítás). Modellenként egy sorba állított terv, így a gépen
// modellváltás csak modellenként egyszer van, a memóriát közben a Hub felszabadítja.
import {activeModelSummary} from './active-model-ui.mjs';
import {advisorModel} from './ai-review-ui.mjs';
import {getStartPlan} from './workbench-ui.mjs';
import {availableSizePresets,savedSizeLabel,saveSizePreset,sizeProblem} from './settings.mjs';
import {SAMPLING_SOURCE_TEXT} from './sampling-policy.mjs';
import {checkablePlan,preflight} from './preflight.mjs';
import {describeError} from './diagnostic-text.mjs';
import {imageSize} from './preflight-ui.mjs';

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
  const l=width!==height?long:r(Math.sqrt(area*ratio)),s=width!==height?short:r(Math.sqrt(area/ratio)),q=r(Math.sqrt(area));
  return {portrait:{width:s,height:l},landscape:{width:l,height:s},square:width===height?{width,height}:{width:q,height:q}};
}
export function seedFor(base,index,count,same){return same?base:base+index*count;}

/* 0.17: az utolsó „Több modellel” kijelölés megjegyzése (módonként), és hogy a legutóbbi indítás ilyen volt-e */
const LAST_KEY='creatorHub.multiModel.last',STICKY_KEY='creatorHub.multiModel.sticky';
export function loadLast(mode,storage=globalThis.localStorage){try{const all=JSON.parse(storage?.getItem(LAST_KEY)||'{}');const v=all?.[mode];return v&&Array.isArray(v.models)&&v.models.length?v:null;}catch{return null;}}
export function saveLast(mode,v,storage=globalThis.localStorage){try{const all=JSON.parse(storage?.getItem(LAST_KEY)||'{}')||{};all[mode]={models:[...v.models],formats:[...(v.formats||[])],count:Number(v.count)||1,same:v.same!==false,probe:!!v.probe,size:v.size,at:Date.now()};storage?.setItem(LAST_KEY,JSON.stringify(all));storage?.setItem(STICKY_KEY,mode);}catch{}}
export function stickyMode(storage=globalThis.localStorage){try{return storage?.getItem(STICKY_KEY)||'';}catch{return '';}}
export function clearSticky(storage=globalThis.localStorage){try{storage?.removeItem(STICKY_KEY);}catch{}}
/* 0.17.1: „⧉ Több modellel” kapcsoló – módonként (kép / videó) BE vagy KI; újraindítás után is megmarad. A kijelölés (loadLast) KI állásban is megmarad. */
const ON_KEY='creatorHub.multiModel.on';
export function isOn(mode,storage=globalThis.localStorage){try{return !!JSON.parse(storage?.getItem(ON_KEY)||'{}')?.[mode];}catch{return false;}}
export function setOn(mode,value,storage=globalThis.localStorage){try{const all=JSON.parse(storage?.getItem(ON_KEY)||'{}')||{};all[mode]=!!value;storage?.setItem(ON_KEY,JSON.stringify(all));}catch{}}
// Pure: a Generálás gomb felirata
function trialDuration(duration){return Math.min(Number(duration)||3,3);}
function groupSize(model,size,trial){
  const scale=value=>Math.max(256,Math.round(value*0.6/32)*32);
  return sizeForFamily(model.family,trial?scale(size.width):size.width,trial?scale(size.height):size.height);
}
export async function buildGroupVariant({planFor,model,size,trial,steps,duration,useImage}){
  const dimensions=groupSize(model,size,trial);
  const effectiveDuration=trial?trialDuration(duration):duration;
  const plan=await planFor(model.id,{...dimensions,steps,duration:effectiveDuration,useImage});
  const baseSteps=plan.sampling?.steps;
  const sampling=trial&&baseSteps?
    {...plan.sampling,steps:Math.max(4,Math.round(baseSteps/2))}:plan.sampling;
  return {...plan,...dimensions,duration:effectiveDuration,baseSteps,sampling,
    controls:{...plan.controls,sampling}};
}

export function startLabel(on,n,trial=false){if(on&&n>0&&trial)return 'Próba indítása';return on&&n>0?`Generálás · ${n} modellel`:'Generálás indítása';}
export function createMultiModelUI({$,current,state,request,automatic,collectPlan,saveDraft,onTransfer,onStepTrial,notify,isBusy,onQueued=()=>{},loraBlock=null,startImageGuard=()=>null}){
  const start=$('start');if(!start)return {};
  /* 0.16 DEV: részletekben indítás – ami nem fér a 20-as várólistára, itt vár, és magától sorba áll, amint hely szabadul fel. */
  const backlog=[];let pumpTimer=null;
  const leaveGuard=e=>{if(backlog.length){e.preventDefault();e.returnValue='';}};addEventListener('beforeunload',leaveGuard);
  function pump(){clearTimeout(pumpTimer);if(!backlog.length)return;pumpTimer=setTimeout(async()=>{while(backlog.length){try{await backlog[0]();backlog.shift();onQueued();}catch(e){if(/Legfeljebb 20 terv/.test(e.message))break;backlog.shift();notify(['⧉ Több modellel:',' ',e.message],true);}}if(backlog.length)pump();else notify(['⧉ Több modellel:',' ','A részletekben indított összehasonlítás minden terve sorba állt.']);},6000);}
  const btn=el('button','⧉ Több modellel','multiModelButton');btn.type='button';btn.title='Ugyanaz a prompt több képmodellel, egy indítással – modellenként a saját beállításaival';
  const edit=el('button','✎','multiModelEdit');edit.type='button';edit.title='A több modelles kijelölés módosítása';edit.hidden=true;
  let lastLabel='Generálás indítása';const modeNow=()=>state().mode==='video'?'video':'image';
  const chosenCount=()=>{const last=loadLast(modeNow());if(!last)return 0;const ids=new Set((automatic.models?.()||[]).map(m=>m.id));return last.models.filter(id=>!ids.size||ids.has(id)).length;};
  function paint(){const on=isOn(modeNow()),n=chosenCount();btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',String(on));btn.replaceChildren(el('span','⧉ Több modellel'),document.createTextNode(': '),el('span',on?'BE':'KI'));btn.title=on?'Bekapcsolva – a Generálás a kijelölt modellekkel fut. Kattints a kikapcsoláshoz (a kijelölés megmarad).':'Kikapcsolva – egy modellel generálsz. Kattints a bekapcsoláshoz.';edit.hidden=!on;/* csak valódi váltáskor (a paint másodpercenként fut) */if(paint.last!==on){paint.last=on;try{window.dispatchEvent(new Event('creatorhub:multimodel'));}catch{}}
    const mode=modeNow(),last=on?loadLast(mode):null,c=current();
    const models=(automatic.models?.()||[]).filter(model=>last?.models.includes(model.id));
    const trial=mode==='video'&&!!last?.probe;
    const group=getStartPlan($,true),formats=(last?.formats||[]).filter(format=>['portrait','landscape','square'].includes(format));
    const count=Math.max(1,Math.min(mode==='video'?3:8,Number(last?.count)||1)),sizes=formatSizes(last?.size?.width??c.width,last?.size?.height??c.height);
    const key=JSON.stringify([mode,on,trial,formats,count,sizes,c.duration,models.map(m=>[m.id,m.name,m.family])]);
    if(group.dataset.plan!==key){
      group.dataset.plan=key;
      const active=on&&models.length>0&&formats.length>0;
      group.hidden=!active;
      if(active){
        const sizeLabels=model=>[...new Set(formats.map(format=>{const {width,height}=groupSize(model,sizes[format],trial);return width+' × '+height;}))].join(' / ');
        group.querySelector('summary').replaceChildren(
          ...(trial?[el('strong','Próba mód'),' · ']:[]),
          models.length+' ',sp('modell'),' · '+(models.length*formats.length*count)+' ',sp(mode==='video'?'videó':'kép'),
          ...(mode==='video'?[' · '+(trial?trialDuration(c.duration):c.duration)+' ',sp('mp')]:[]));
        group.querySelector('ul').replaceChildren(...models.map(model=>
          el('li',String(model.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft)$/i,'')+' · '+sizeLabels(model))));
      }
    }
    getStartPlan($).hidden=on||!c.info||!!c.blockedModel;
    const want=startLabel(on,n,trial);if(lastLabel!==want){lastLabel=want;start.textContent=want;}}
  /* 0.16 DEV: közvetlenül a Generálás indítása mellett (a Továbbiak ▾ elé) */const place=()=>{if(start.nextElementSibling!==btn)start.after(btn);if(btn.nextElementSibling!==edit)btn.after(edit);};place();setTimeout(place,1500);setTimeout(place,5000);
  const st=document.createElement('style');st.textContent=`.multiModelButton{white-space:nowrap;flex:none}.multiModelButton.on{border-color:var(--gold,#f2c584);color:var(--gold,#f2c584)}.multiModelEdit{flex:none;min-width:34px;padding:0 8px}.multiModelEdit[hidden]{display:none!important}
.multiModelDialog{width:min(980px,95vw);max-height:92vh}.multiModelDialog .mmList{max-height:48vh;overflow:auto;border:1px solid #2c4550;border-radius:9px;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.multiModelDialog .mmCard{display:grid!important;grid-template-columns:auto 64px 1fr;gap:8px;align-items:center;padding:6px!important;border:1px solid #2c4550;border-radius:9px;cursor:pointer}.multiModelDialog .mmCard.on{border-color:var(--gold,#f2c584);background:#17313c}.multiModelDialog .mmCard[hidden]{display:none!important}.multiModelDialog .mmPic{width:64px;height:64px;border-radius:7px;background:#071116;display:flex;align-items:center;justify-content:center;font-size:11px;color:#7d96a2;overflow:hidden}.multiModelDialog .mmPic img{width:100%;height:100%;object-fit:cover}.multiModelDialog .mmInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.multiModelDialog .mmName{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.multiModelDialog .mmScore{font-size:11px;color:#f2c584}.multiModelDialog .mmCard .mmWhy{grid-column:1/-1}
.multiModelDialog .mmList label{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px}.multiModelDialog .mmList label:hover{background:#17313c}
.multiModelDialog .mmFamily{font-size:11px;color:#9fb6c1;white-space:nowrap}.multiModelDialog .mmRow{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:8px 0}
.multiModelDialog .mmTemplates input[type=text],.multiModelDialog .mmTemplates input:not([type]){min-width:200px}.multiModelDialog .mmTemplates select{min-width:180px}
.multiModelDialog .mmSummary{margin:8px 0;font-weight:600}.multiModelDialog .mmSummary.soft{font-weight:400;color:#f2d3a0}.multiModelDialog .mmRow label.check{display:inline-flex!important;flex-direction:row!important;align-items:center;gap:6px;margin:0}.multiModelDialog .mmRow label.check input{width:18px!important;height:18px!important;margin:0}.multiModelDialog .mmLog{font-size:12px;max-height:20vh;overflow:auto}`;
  document.head.append(st);
  const show=()=>{const ok=['image','video'].includes(state().mode);btn.hidden=!ok;if(!ok)edit.hidden=true;else paint();};/* 0.16 DEV: videóra is */setInterval(show,1000);show();


  let groupPage=null,opening=false;
  function closeGroup(){
    if(!groupPage||groupPage.inert)return false;
    groupPage.remove();
    groupPage=null;
    document.body.classList.remove('groupCreationOpen');
    return true;
  }
  const tab=el('button','Csoport');
  tab.type='button';
  tab.onclick=()=>void open();
  $('imageMode').parentElement.append(tab);

  async function open(){
    if(groupPage||opening||isBusy())return;
    opening=true;
    try{await showGroup();}finally{opening=false;}
  }

  async function showGroup(){
    if(isBusy())return;
    if(!current().automatic){notify('A „Több modellel” mód az automatikus modellválasztással működik (saját workflow-hoz nem).',true);return;}
    try{await automatic.refresh?.();}catch{}const c=current(),models=automatic.models();
    /* random seed mode (-1): pick one base seed now, so every model can get the same series */let baseSeed=Number(c.seed)>=0&&c.seedMode!=='random'?Number(c.seed):crypto.getRandomValues(new Uint32Array(1))[0]%2147483647;if(!models.length){notify('Nem találok használható képmodellt. Ha a ComfyUI éppen indul, várj pár másodpercet, és próbáld újra.',true);return;}
    const d=el('section',null,'panel multiModelDialog groupCreationPage'),head=el('div',null,'sectionTitle'),close=el('button','Vissza az alkotáshoz');
    close.type='button';
    close.onclick=()=>$('backToCreation').click();
    const heading=el('div',null,'groupCreationHeading');
    const groupBadge=el('span',null,'groupCreationBadge');
    heading.append(el('h2','Csoport'),groupBadge);
    head.append(heading,close);d.append(head);
    const mode=modeNow(),drafts=state().groupPrompts||={};
    const draft=drafts[mode]??={prompt:c.prompt||'',negative:c.negative||''};
    saveDraft();
    const prompt=el('textarea');prompt.rows=3;prompt.value=draft.prompt;
    const negative=el('textarea');negative.rows=2;negative.value=draft.negative;
    const promptLabel=el('label','Pozitív prompt · mit alkossunk?');
    const negativeLabel=el('label','Negatív prompt');
    promptLabel.append(prompt);negativeLabel.append(negative);
    const promptFields=el('div',null,'groupPromptFields');
    const transfer=el('button','Prompt átvitele az Alkotásba');transfer.type='button';
    const prompts=()=>({prompt:prompt.value,negative:negative.value});
    const updatePrompt=()=>{Object.assign(draft,prompts());saveDraft();};
    prompt.oninput=negative.oninput=updatePrompt;
    transfer.onclick=()=>{
      if(isBusy()||!closeGroup())return;
      setOn(mode,false);
      onTransfer(mode,prompts());
      $('backToCreation').click();
    };
    const onTrigger=word=>{
      const text=prompt.value.trim();
      if(text.toLowerCase().includes(String(word).toLowerCase()))return;
      prompt.value=text?text.replace(/[,\s]+$/,'')+', '+word:word;
      updatePrompt();
    };
    promptFields.append(promptLabel,negativeLabel,transfer);
    d.append(promptFields);
    const search=el('input');search.type='search';search.placeholder='Modell keresése…';search.style.width='100%';
    const tools=el('div',null,'mmRow mmModelTools'),all=el('button','Mind'),none=el('button','Egyik sem'),ai=el('button','✦ MI-ajánlás'),aiTake=el('button','Ajánlottak bejelölése');all.type=none.type=ai.type=aiTake.type='button';aiTake.hidden=true;
    const aiModel=advisorModel();ai.disabled=!aiModel;ai.title=aiModel?'A helyi MI ('+aiModel+') a prompt alapján javasol 2–4 modellt a te modelljeid közül – a választás a tiéd':'Ehhez válassz helyi modellt a ✦ MI-segítőben. Nélküle is mindent ki tudsz választani kézzel.';
    tools.append(search,all,none,ai,aiTake);d.append(tools);const aiNote=el('p','','muted');d.append(aiNote);let aiPicks=[];
        const list=el('div',null,'mmList');
    const columns=el('div',null,'groupCreationColumns');
    const lbHost=el('div',null,'groupCreationLoras');
    columns.append(list);
    if(loraBlock){
      const jump=el('button','LoRA-k','groupLoraJump');jump.type='button';
      lbHost.tabIndex=-1;
      jump.onclick=()=>{lbHost.scrollIntoView({block:'start'});lbHost.focus({preventScroll:true});};
      tools.append(jump);
      columns.append(lbHost);
    }
    d.append(columns);
    /* 0.17.1: LoRA-k ebben a körben – családonként, az aktív modelltől függetlenül */let lb=null;if(loraBlock)void Promise.resolve(loraBlock({prompt:()=>prompt.value,prompts,requestedSize:()=>requestedSize(),onTrigger})).then(b=>{lb=b;lbHost.replaceChildren(b.element);b.element.addEventListener('lorachange',()=>summary());b.update(picked());summary();}).catch(e=>console.warn('lora-block',e));
    const current_id=c.automatic?.id,checks=new Map(),stepOverrides=new Map();

    for(const m of models.sort((a,b)=>String(a.family).localeCompare(b.family)||String(a.name).localeCompare(b.name))){
      /* 0.16 DEV: kártya bélyegképpel, családdal és (ha van) az ízlésprofil szerinti átlagoddal */
      const l=el('label',null,'mmCard'),cb=el('input'),pic=el('div',null,'mmPic'),info=el('div',null,'mmInfo'),short=String(m.name).split(/[\\/]/).pop();cb.type='checkbox';cb.checked=m.id===current_id;checks.set(m.id,{cb,m,l});
      if(m.localId){const im=el('img');im.loading='lazy';im.alt='';im.src='/api/library/thumbnail?id='+encodeURIComponent(m.localId);im.onerror=()=>{im.remove();pic.textContent=(m.family||'?').slice(0,6);};pic.append(im);}else pic.textContent=(m.family||'?').slice(0,6);
      const nm=el('span',short.replace(/\.(safetensors|ckpt|gguf|sft)$/i,''),'mmName');nm.title=short;const meta=el('span',null,'mmFamily');meta.append((m.favorite?'★ ':'')+(m.family||'')+(['ltx','h3'].includes(m.family)?' · 🔊':''));if(['ltx','h3'].includes(m.family))meta.title='Hangot is generál';const score=el('span','','mmScore');info.append(nm,meta,el('span',null,'mmPlanSize mmFamily'),score,el('span',null,'mmPlanError'));
      l.append(cb,pic,info);list.append(l);cb.onchange=()=>{l.classList.toggle('on',cb.checked);summary();};l.classList.toggle('on',cb.checked);
    }
    /* ízlésprofil: modellenkénti átlag a kártyákon */void fetch('/api/taste').then(r=>r.json()).then(t=>{for(const {m,l} of checks.values()){const name=String(m.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft|pt)$/i,'');const hit=(t.models||[]).find(x=>x.model===name);if(hit){const sc=l.querySelector('.mmScore');sc.textContent='★ '+hit.avg.toLocaleString(undefined,{maximumFractionDigits:1})+' ('+hit.n+')';sc.title='Az értékeléseid átlaga ennél a modellnél';}}}).catch(()=>{});
    /* gyorsválasztók: kedvencek, egy család */const favB=el('button','★ Kedvencek'),fam=el('select');favB.type='button';favB.title='A kedvencnek jelölt modellek bejelölése';fam.add(new Option('+ Egy család összes modellje',''));for(const f of [...new Set(models.map(m=>m.family).filter(Boolean))].sort())fam.add(new Option(f,f));
    favB.onclick=()=>{for(const {cb,m,l} of checks.values())if(m.favorite){cb.checked=true;l.classList.add('on');}summary();};fam.onchange=()=>{for(const {cb,m,l} of checks.values())if(m.family===fam.value){cb.checked=true;l.classList.add('on');}fam.value='';summary();};tools.insertBefore(fam,ai);tools.insertBefore(favB,fam);
    ai.onclick=async()=>{ai.disabled=true;aiNote.textContent='✦ A helyi MI gondolkodik…';for(const {l} of checks.values())l.querySelector('.mmWhy')?.remove();
      try{const r=await request('studio/assistant',{action:'recommend',model:aiModel,prompt:prompt.value,candidates:models.map(m=>({id:m.id,name:String(m.name).split(/[\\/]/).pop(),family:m.family}))});aiPicks=r.picks||[];
        for(const p of aiPicks){const v=checks.get(p.id);if(!v)continue;const why=el('div','✦ '+p.reason,'mmWhy');why.style.cssText='font-size:11px;color:#f2c584;flex-basis:100%;margin-left:26px';v.l.style.flexWrap='wrap';v.l.append(why);}
        aiNote.textContent=aiPicks.length?`✦ ${aiPicks.length} javasolt modell (sárga megjegyzés). Csak javaslat – a pipákat te teszed be, vagy jelöld be őket egyben.`:'A MI nem adott javaslatot.';aiTake.hidden=!aiPicks.length;}
      catch(e){aiNote.textContent='✦ '+e.message;}finally{ai.disabled=false;}};
    aiTake.onclick=()=>{for(const p of aiPicks){const v=checks.get(p.id);if(v){v.cb.checked=true;v.l.classList.add('on');}}summary();};
    search.oninput=()=>{const q=search.value.trim().toLowerCase();for(const {m,l} of checks.values())l.hidden=!!q&&!(String(m.name).toLowerCase().includes(q)||String(m.family).toLowerCase().includes(q));};
    all.onclick=()=>{for(const {cb,l} of checks.values())if(!l.hidden){cb.checked=true;l.classList.add('on');}summary();};none.onclick=()=>{for(const {cb,l} of checks.values()){cb.checked=false;l.classList.remove('on');}summary();};
    const isVideo=state().mode==='video';const row=el('div',null,'mmRow'),countL=el('label',isVideo?'Videó modellenként':'Kép modellenként'),count=el('input');count.type='number';count.min=1;count.max=isVideo?3:8;count.value=isVideo?1:Math.max(1,Math.min(8,Number(c.count)||2));countL.append(count);
    /* 0.16 DEV: videónál „Próba” – rövidebb, kisebb, kevesebb lépés: gyors döntés, utána a győztes teljes minőségben */const probeL=el('label',null,'check'),probe=el('input');probe.type='checkbox';probe.checked=isVideo;probeL.append(probe,el('span','Próba: rövid (3 mp), kisebb felbontás, fele annyi lépés'));probeL.title='Modellenként 1–2 perc a 7–8 helyett. A győztest utána teljes minőségben futtathatod.';probeL.hidden=!isVideo;probe.onchange=()=>summary();
    const sameL=el('label',null,'check'),same=el('input');same.type='checkbox';same.checked=true;sameL.append(same,document.createTextNode(' Azonos seedek minden modellnél (összehasonlításhoz)'));
    const savedSize=loadLast(modeNow())?.size, sizeFields=el('div',null,'mmRow');
    function dimension(label,value){
      const field=el('input');field.type='number';field.min=256;field.max=2048;field.step=32;field.value=value;
      const caption=el('label',label);caption.append(field);sizeFields.append(caption);
      return field;
    }
    const widthField=dimension('Szélesség',savedSize?.width??c.width);
    const heightField=dimension('Magasság',savedSize?.height??c.height);
    const requestedSize=()=>({width:widthField.valueAsNumber,height:heightField.valueAsNumber});
    const orientation=(width,height)=>width>height?'landscape':height>width?'portrait':'square';
    const orient=orientation(widthField.valueAsNumber,heightField.valueAsNumber),fmts=new Map();
    const sizeControls=el('div',null,'sizeControls');
    const preset=el('select'),presetCaption=el('label','Gyors képméret');
    let presets;
    function refreshPresets(){
      presets=availableSizePresets(mode,state().presets?.[mode]);
      preset.replaceChildren(new Option('Egyéni méret','custom'),...presets.map((p,i)=>new Option(savedSizeLabel(p),String(i))));
    }
    refreshPresets();
    presetCaption.append(preset);
    const flip=el('button','↔ Szélesség és magasság felcserélése');flip.type='button';
    const saveSize=el('button','Méret mentése');saveSize.type='button';
    saveSize.onclick=()=>{
      if(isBusy())return;
      try{
        const saved=saveSizePreset(state(),mode,requestedSize());
        saveDraft();refreshPresets();summary();
        notify('Saját képméret mentve: '+saved.name);
      }catch(error){notify(error.message,true);}
    };
    const sizeAdvice=el('button','✦ Méretajánlás');sizeAdvice.type='button';
    sizeAdvice.onclick=()=>{
      if(isBusy())return;
      void import('./creative-advice-ui.mjs').then(({openSizeAdvice})=>openSizeAdvice({
        request,notify,prompt:prompt.value,mode,current:requestedSize(),families:picked().map(model=>model.family),
        image:c.useImage===false?'':c.image,apply:({width,height})=>setSize(width,height)
      })).catch(error=>notify(error.message,true));
    };
    sizeControls.append(presetCaption,saveSize,flip,markNew(sizeAdvice,'size-advice'));
    function setSize(width,height){
      const selected=formats();
      widthField.value=width;heightField.value=height;
      if(selected.length===1){
        const next=orientation(width,height);
        for(const [format,box] of fmts)box.checked=format===next;
      }
      summary();
    }
    preset.onchange=()=>{
      const p=presets[Number(preset.value)];
      if(p)setSize(p.width,p.height);
    };
    flip.onclick=()=>{
      const {width,height}=requestedSize();
      if(Number.isFinite(width)&&Number.isFinite(height))setSize(height,width);
    };
    const formatLabels=new Map();const fmtRow=el('div',null,'mmRow');fmtRow.append(el('strong','Formátum:'));
    for(const [key,label] of [['portrait','▯ Álló'],['landscape','▭ Fekvő'],['square','□ Négyzetes']]){const l=el('label',null,'check'),cb=el('input');cb.type='checkbox';cb.checked=key===orient;cb.onchange=summary;l.append(cb,el('span',label),formatLabels.set(key,document.createTextNode('')).get(key));fmtRow.append(l);fmts.set(key,cb);}
    {
      const stepPanel=el('details',null,'groupStepPanel');
      const stepHeading=el('summary','Ellenőrzés modellenként');stepHeading.append(newBadge('group-check'));stepPanel.append(stepHeading);
      const stepRows=el('div');
      const reload=el('button','Tényleges beállítások lekérése');reload.type='button';
      stepPanel.append(reload,stepRows);
      list.before(stepPanel);
      reload.onclick=async()=>{
        if(isBusy())return;
        reload.disabled=true;stepRows.replaceChildren();
        try{
          const dims=requestedSize(),selectedFormats=formats();
          if(sizeProblem(dims.width,dims.height)||!picked().length||!selectedFormats.length)throw Error('Ellenőrizd a terv beállításait.');
          const {payload}=collectPlan(prompts());
          const image=payload.image?await imageSize(payload.image):null;
          const trial=isVideo&&probe.checked,sizes=formatSizes(dims.width,dims.height);
          for(const model of picked()){
            const line=el('div',null,'mmRow');line.append(el('strong',model.name));stepRows.append(line);
            const getVariant=format=>buildGroupVariant({planFor:automatic.planFor,model,size:sizes[format],
              steps:stepOverrides.get(model.id),trial,duration:payload.duration,useImage:!!payload.image});
            const getPlan=async()=>{
              const variant=await getVariant(selectedFormats[0]);
              return {...checkablePlan({...variant,prompt:payload.prompt}),steps:variant.baseSteps,source:variant.stepSource};
            };
            try{
              let base;
              for(const [index,format] of selectedFormats.entries()){
                const variant=await getVariant(format);
                if(index===0){
                  base=variant.baseSteps;
                  line.append(String(base||'—'),' · ',sp(SAMPLING_SOURCE_TEXT[variant.stepSource]||''));
                  if(trial&&Number.isInteger(base))line.append(' → '+variant.sampling.steps+' ',sp('Próba mód'));
                }
                const plan=checkablePlan({...variant,prompt:payload.prompt,image,mode:isVideo?'video':'image'});
                const details=el('span',plan.width+' × '+plan.height+(plan.cfg!==undefined?' · CFG '+plan.cfg:'')+(plan.sampler?' · '+plan.sampler:''));
                line.append(details);
                for(const warning of preflight(plan))line.append(el('p',warning.text,'muted'));
              }
              if(isVideo&&Number.isInteger(base)){
                const ai=el('button','✦ Videós lépésszám ajánlása');ai.type='button';
                ai.onclick=()=>void import('./creative-advice-ui.mjs').then(ui=>ui.openStepAdvice({request,notify,getPlan,
                  trial:onStepTrial?(value,trialPlan)=>onStepTrial(model.id,{
                    steps:[trialPlan.steps,value],
                    size:groupSize(model,formatSizes(dims.width,dims.height)[selectedFormats[0]],false),
                    plan:collectPlan(prompts())
                  }):undefined,
                  apply(value){stepOverrides.set(model.id,value);void reload.onclick();}
                })).catch(error=>notify(error.message,true));
                line.append(markNew(ai,"group-video-steps"));
              }
            }catch(error){line.append(' · '+error.message);}
          }
        }catch(error){stepRows.textContent=error.message;}
        finally{reload.disabled=false;}
      };
    }
    row.append(countL,sameL);if(isVideo)row.append(probeL);columns.after(sizeControls,sizeFields,row,fmtRow);count.oninput=widthField.oninput=heightField.oninput=summary;
    /* 0.16 DEV: mentett összehasonlító sablonok – modellek, formátumok, képszám, azonos seed (és ha kéred, maga a seed is, hogy később ugyanaz a teszt fusson) */
    const tplRow=el('div',null,'mmRow mmTemplates'),tplSel=el('select'),tplName=el('input'),tplSeedL=el('label',null,'check'),tplSeed=el('input'),tplSave=el('button','💾 Mentés sablonként'),tplDel=el('button','🗑');tplSave.type=tplDel.type='button';tplDel.title='A kiválasztott sablon törlése';tplName.placeholder='Sablon neve, pl. Portré-teszt';tplName.maxLength=60;tplSeed.type='checkbox';tplSeedL.title='A sablon a mostani seedet is megjegyzi – így két hét múlva is pontosan ugyanaz a teszt fut';tplSeedL.append(tplSeed,' ',el('span','seed is'));
    const tplNote=el('p','','muted');
    function fillTemplates(sel=''){const list=loadTemplates();tplSel.replaceChildren(new Option('Sablon: —',''),...list.map(t=>new Option(t.name,t.name)));tplSel.value=sel;tplDel.disabled=!tplSel.value;}
    tplSel.onchange=()=>{tplDel.disabled=!tplSel.value;const t=loadTemplates().find(x=>x.name===tplSel.value);if(!t){tplNote.textContent='';return;}
      const r=applyTemplate(t,[...checks.keys()]);for(const [id,{cb}] of checks)cb.checked=r.found.includes(id);for(const [k,cb] of fmts)cb.checked=t.formats.includes(k);count.value=t.count;same.checked=t.same;if(Number.isInteger(t.seed))baseSeed=t.seed;tplName.value=t.name;tplSeed.checked=Number.isInteger(t.seed);
      tplNote.replaceChildren(...(r.missing.length?[el('span','⚠ '),el('span',r.missing.length+' modell a sablonból már nincs meg:'),' '+r.missing.map(x=>String(x).split(/[\\/|]/).pop()).join(', ')]:[]));summary();};
    tplSave.onclick=()=>{const name=tplName.value.trim();if(!name){tplName.focus();notify('Adj nevet a sablonnak.',true);return;}const t={name,models:picked().map(m=>m.id),formats:formats(),count:Math.max(1,Math.min(Number(count.max),Number(count.value)||1)),same:same.checked,...(tplSeed.checked?{seed:baseSeed}:{})};if(!t.models.length){notify('Jelölj ki legalább egy modellt.',true);return;}saveTemplate(t);fillTemplates(name);notify(['Sablon mentve:',' '+name]);};
    tplDel.onclick=()=>{const name=tplSel.value;if(!name)return;deleteTemplate(name);fillTemplates();tplNote.textContent='';notify(['Sablon törölve:',' '+name]);};
    tplRow.append(tplSel,tplName,tplSeedL,tplSave,tplDel);const templates=el('details');
    templates.append(el('summary','Sablon'),tplRow,tplNote);
    fmtRow.after(templates);fillTemplates();
    const sum=el('p','','mmSummary'),log=el('div','','mmLog muted'),foot=el('div',null,'mmRow'),go=el('button','▶ Indítás – sorba állítás','primary');go.type='button';
    const save=el('button','✓ Kijelölés mentése');save.type='button';
    const footer=el('div',null,'groupCreationFooter');foot.append(go,save);const advise=el('button','✦ Terv átnézése MI-vel');advise.type='button';foot.append(markNew(advise,"group-plan"));
    const webLoras=el('button','LoRA keresése az interneten');webLoras.type='button';foot.append(markNew(webLoras,"online-loras"));
    webLoras.onclick=()=>void import('./lora-suggest-ui.mjs').then(ui=>ui.openOnlineLoras({
      request,notify,families:picked().map(model=>model.family)
    })).catch(error=>notify(error.message,true));
    footer.append(sum,foot);d.append(footer,log);
    advise.onclick=()=>void import('./creative-advice-ui.mjs').then(({openCreativeAdvice,advice})=>{
      openCreativeAdvice({title:'Terv átnézése MI-vel',request,notify,onlineLoras:query=>({query,families:picked().map(m=>m.family)}),promptLabel:'Mit szeretnél összehasonlítani?',
       async task(model,question){
        const {width,height}=requestedSize();
        if(sizeProblem(width,height)||!picked().length||!formats().length)throw Error('Ellenőrizd a terv beállításait.');
        const dims=formatSizes(width,height),trial=isVideo&&probe.checked;
        const result=await advice(request,model,'plan',{
         prompt:prompt.value.slice(0,1800),video:isVideo,count:Number(count.value),
         startImage:!!c.image&&c.useImage!==false,sameSeed:same.checked,trial,
         models:picked().slice(0,20).map(m=>({name:m.name,sizes:formats().map(f=>groupSize(m,dims[f],trial))})),
         loras:lb?.counts(picked())
        },question);
        return {...result,maxCount:Number(count.max),count:result.count?Math.min(Number(count.max),result.count):null};
       },
       apply(value){count.value=value;summary();}
      });
    }).catch(error=>notify(error.message,true));
    function picked(){return [...checks.values()].filter(v=>v.cb.checked).map(v=>v.m);}
    function formats(){return [...fmts].filter(([,cb])=>cb.checked).map(([k])=>k);}
    function summary(){
      const {width,height}=requestedSize(),problem=sizeProblem(width,height);
      const match=presets.findIndex(p=>p.width===width&&p.height===height);
      preset.value=match<0?'custom':String(match);
      const modelCount=picked().length;
      groupBadge.replaceChildren(sp('Több modell'),' · '+modelCount+' ',sp('kijelölve'));
      save.disabled=go.disabled=true;
      if(problem){sum.textContent=problem;return;}
      const sizes=formatSizes(width,height);
      for(const [format,label] of formatLabels)label.textContent=' ('+sizes[format].width+' × '+sizes[format].height+')';
      const trial=isVideo&&probe.checked;
      const selectedFormats=formats();
      const commonSizes=selectedFormats.map(format=>sizes[format]);
      for(const {m,l,cb} of checks.values()){
        const meta=l.querySelector('.mmPlanSize');
        meta.textContent=cb.checked?commonSizes.flatMap(requested=>{
          const actual=groupSize(m,requested,trial);
          return actual.width===requested.width&&actual.height===requested.height?[]:[actual.width+' × '+actual.height];
        }).join(' / '):'';
      }
      try{lb?.update(picked());}catch{}sum.classList.remove('soft');const n=picked().length,f=formats().length,k=Math.max(1,Math.min(Number(count.max),Number(count.value)||1));if(n&&!f){sum.textContent='Jelölj ki legalább egy formátumot.';go.disabled=true;return;}go.replaceChildren(...(trial?[sp('Próba indítása')]:[String(n*f*k)+' ',sp(isVideo?'videó indítása':'kép indítása')]));if(n*f>60){sum.classList.add('soft');sum.replaceChildren(document.createTextNode(n*f+' '),el('span','terv lenne.'),' ',el('span','Egy indítással legfeljebb 60 terv kérhető – vegyél ki néhány modellt vagy formátumot.'));go.disabled=true;return;}if(n){
        const dimensions=commonSizes.map(({width,height})=>width+' × '+height).join(' / ');
        sum.replaceChildren(n+' ',sp('modell'),' · '+n*f*k+' ',sp(isVideo?'videó':'kép'),' · '+dimensions,
          ...(trial?[' · ',sp('Próba mód'),' · '+trialDuration(c.duration)+' ',sp('mp')]:isVideo?[' · '+c.duration+' ',sp('mp')]:[]),
          ...(c.image&&c.useImage!==false?[' · ',sp('Kezdőképpel')]:[]));
      }else sum.textContent='Jelölj ki legalább egy modellt.';save.disabled=go.disabled=!n;if(n&&lb){const parts=lb.counts(picked());if(parts.length){const lr=el('span',null,'mmLoraSum');lr.append(' · LoRA: ');parts.forEach((p,i)=>{if(i)lr.append(' · ');lr.append(p.name+' '+(p.n||'–'));});sum.append(lr);}}if(n*f>20){const note=el('div',null,'mmParts');note.append(document.createTextNode(n*f+' '),el('span','terv – a várólistára egyszerre 20 fér, ezért részletekben indul: ami most nem fér be, automatikusan utána áll sorba, amint hely szabadul fel. Addig ne zárd be a Hubot.'));sum.append(note);}}
    same.onchange=summary;
    /* 0.17: az előző kör kijelölésének visszatöltése */{const mode=isVideo?'video':'image',last=loadLast(mode);if(last){const found=last.models.filter(id=>checks.has(id));if(found.length){for(const [id,{cb,l}] of checks){cb.checked=found.includes(id);l.classList.toggle('on',cb.checked);}for(const [k,cb] of fmts)if(last.formats?.length)cb.checked=last.formats.includes(k);count.value=Math.max(1,Math.min(Number(count.max)||8,Number(last.count)||1));same.checked=last.same!==false;if(isVideo)probe.checked=!!last.probe;const note=el('p',null,'muted mmLastNote'),reset=el('button','Csak az aktív modell');reset.type='button';reset.onclick=()=>{for(const [id,{cb,l}] of checks){cb.checked=id===current_id;l.classList.toggle('on',cb.checked);}note.remove();summary();};note.append(el('span','↺ Az előző kör kijelölése betöltve:'),' '+found.length+' ',el('span','modell'),' ',reset);tplNote.after(note);}}}
    summary();
    function rememberSelection(models,formats,count,same,probe,size){
      const mode=isVideo?'video':'image';
      saveLast(mode,{models:models.map(m=>m.id),formats,count,same,probe,
        size});
      setOn(mode,true);
      paint();
    }
    save.onclick=()=>{
      rememberSelection(picked(),formats(),Math.max(1,Math.min(Number(count.max),Number(count.value)||1)),same.checked,isVideo&&probe.checked,requestedSize());
      close.click();
    };
    go.onclick=async()=>{
      const chosen=picked(),k=Math.max(1,Math.min(Number(count.max),Number(count.value)||1)),selectedFormats=formats(),size=requestedSize();
      if(!chosen.length||!selectedFormats.length||sizeProblem(size.width,size.height)||isBusy())return;
      const sizes=formatSizes(size.width,size.height),trial=isVideo&&probe.checked,sharedSeed=same.checked,roundSteps=new Map(stepOverrides);
      let latest;
      try{latest=collectPlan(prompts());}catch(e){notify(e.message,true);if(e.field==='prompt')prompt.focus();return;}
      d.inert=true;go.disabled=true;log.replaceChildren();
      for(const {l} of checks.values())l.querySelector('.mmPlanError').replaceChildren();
      function showModelError(model,error){
        const card=checks.get(model.id).l.querySelector('.mmPlanError');
        const diagnostic=describeError(error.message);
        card.append(el('div',diagnostic.line));
        return diagnostic.line;
      }
      const batchBase=structuredClone(latest);
      const guard=startImageGuard?.();
      const hasImage=!!batchBase.payload.image&&batchBase.payload.useImage!==false;
      let imgChoice='with';
      if(guard&&hasImage){
        try{imgChoice=await guard.confirm(prompt.value);}catch{imgChoice='with';}
        if(imgChoice==='cancel'){d.inert=false;go.disabled=false;return;}
        if(imgChoice==='without'){
          batchBase.payload.image='';
          batchBase.payload.useImage=false;
        }
      }
      const say=(...t)=>{const d=el('div');d.append(...t);log.append(d);log.scrollTop=log.scrollHeight;};
      const stamp=new Date().toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}),group=(state().projectName?state().projectName+' · ':'')+'Modell-összehasonlítás '+(isVideo?(probe.checked?'(videó, próba) ':'(videó) '):'')+stamp;
      let ok=0,total=0,failed=0,firstError='';const batchId=crypto.randomUUID();
      const work=[];for(const [i,m] of chosen.entries())for(const fmt of selectedFormats)work.push([i,m,fmt]);const totalPlans=work.length;let deferred=0;
      const enqueueOne=async(i,m,fmt)=>{
          const p=await buildGroupVariant({planFor:automatic.planFor,model:m,size:sizes[fmt],trial,steps:roundSteps.get(m.id),
            duration:batchBase.payload.duration,useImage:!!batchBase.payload.image}),{width,height}=p,size={width,height};
          const plan=structuredClone(batchBase);
          plan.payload.duration=p.duration;
          Object.assign(plan.payload,{id:m.id,sampling:p.sampling,controls:{...p.controls,seed:seedFor(baseSeed,i,k,sharedSeed)},seed:seedFor(baseSeed,i,k,sharedSeed),seedMode:'increment',seedStep:1,count:k,width:size.width,height:size.height,projectName:group});
          await request('generation/enqueue',{...plan,batch:{id:batchId,label:group,index:work.findIndex(w=>w[1]===m&&w[2]===fmt),total:totalPlans,images:k,model:String(m.name).split(/[\\/]/).pop(),format:{portrait:'álló',landscape:'fekvő',square:'négyzetes'}[fmt]}});return {p,size};};
      for(const [n,[i,m,fmt]] of work.entries()){
        if(deferred){backlog.push(async()=>{
          try{return await enqueueOne(i,m,fmt);}
          catch(error){if(!/Legfeljebb 20 terv/.test(error.message))showModelError(m,error);throw error;}
        });continue;}
        try{
          const {p,size}=await enqueueOne(i,m,fmt);ok++;total+=k;
          let est=[];try{const s=p.sampling||{},r=await request('generation/estimate',{mode:isVideo?'video':'image',duration:isVideo?p.duration:undefined,models:activeModelSummary({info:p.info,controls:{models:[]}},{}).names,width:size.width,height:size.height,steps:s.steps,sampler:s.sampler,scheduler:s.scheduler,cfg:s.cfg,count:k});if(r?.available)est=[' · ',sp('kb. '+(r.seconds>=60?Math.round(r.seconds/60)+' perc':Math.round(r.seconds)+' mp'))];}catch{}
          say(`✓ ${String(m.name).split(/[\\/]/).pop()} · `,sp({portrait:'álló',landscape:'fekvő',square:'négyzetes'}[fmt]),` ${size.width} × ${size.height} · `,sp(`${k} kép`),' · ',sp(`${p.sampling?.steps??'?'} lépés`),p.sampling?.sampler?' · '+p.sampling.sampler:'',...(p.droppedLoras?[' · ',sp('LoRA nélkül (nem illik a modellhez)')]:[]),...est);
        }catch(e){if(/Legfeljebb 20 terv/.test(e.message)){deferred++;backlog.push(async()=>{
          try{return await enqueueOne(i,m,fmt);}
          catch(error){if(!/Legfeljebb 20 terv/.test(error.message))showModelError(m,error);throw error;}
        });continue;}failed++;const reason=showModelError(m,e);firstError||=reason;say(`✗ ${String(m.name).split(/[\\/]/).pop()}: `,sp(reason));}
      }
      sum.textContent=ok?`Sorba állítva: ${ok} terv, ${total} kép. Az Előzményekben a „${group}” projektnévvel találod őket.`:'Egyik modellt sem sikerült sorba állítani.';
      if(ok&&failed)sum.append(' ',String(failed),' terv nem állt sorba.');
      if(!ok&&deferred)sum.textContent='A várólista megtelt. A tervek automatikusan sorba állnak, amint hely szabadul fel.';
      if(!ok&&firstError)sum.append(' ',firstError);
      if(deferred){const w=backlog.length;sum.append(' ',document.createTextNode(w+' '),el('span','terv még vár, és magától sorba áll, amint hely szabadul fel. Addig ne zárd be a Hubot.'));pump();}
      if(ok){notify(`⧉ Több modellel: ${ok} terv, ${total} kép sorba állítva („${group}”). A haladást és a szünet/megszakítás gombokat a generálás sávjában látod.`);onQueued();}
      d.inert=false;if(ok&&hasImage&&imgChoice==='with')guard?.markUsed?.(prompt.value);if(ok)rememberSelection(chosen,selectedFormats,k,sharedSeed,trial,size);/* all queued without error: the window closes itself – control moves to the series bar */if(ok&&!failed){setTimeout(()=>{if(groupPage===d)close.click();},deferred?4000:1200);return;}
      if(!deferred){go.disabled=false;go.textContent='▶ Újra sorba állítás';}
    };
    groupPage=d;
    document.querySelector('main').prepend(d);
    document.body.classList.add('groupCreationOpen');
    window.scrollTo(0,0);
    close.focus();
  }
  btn.onclick=()=>{const mode=modeNow();if(isOn(mode)){setOn(mode,false);paint();notify(['⧉ Több modellel:',' ','kikapcsolva','. ','A kijelölés megmarad, bármikor visszakapcsolhatod.']);return;}void open();};
  edit.onclick=()=>void open();
  /* 0.17: ha az előző indítás „Több modellel” volt, a Generálás előtt rákérdez */
  function pending(){const mode=state().mode==='video'?'video':'image';if(stickyMode()!==mode)return null;const last=loadLast(mode);if(!last)return null;const ids=new Set((automatic.models?.()||[]).map(m=>m.id));const n=last.models.filter(id=>!ids.size||ids.has(id)).length;return n?{n,formats:(last.formats||[]).length||1}:null;}
  function ask(){const p=pending();if(!p)return Promise.resolve('single');return new Promise(resolve=>{const d=el('dialog',null,'generationDialog mmAskDialog'),head=el('div',null,'sectionTitle');head.append(el('h2','⧉ Újra több modellel?'));const text=el('p');text.append(el('span','A legutóbbi indítás „Több modellel” volt:'),' '+p.n+' ',el('span','modell'),' × '+p.formats+' ',el('span','formátum'),'.');const row=el('div',null,'mmRow'),again=el('button','⧉ Igen, több modellel…','primary'),single=el('button','Csak az aktív modellel'),cancel=el('button','Mégse');for(const b of [again,single,cancel])b.type='button';let done=false;const finish=v=>{if(done)return;done=true;if(d.open)d.close();d.remove();resolve(v);};again.onclick=()=>finish('multi');single.onclick=()=>{clearSticky();finish('single');};cancel.onclick=()=>finish('cancel');d.addEventListener('close',()=>finish('cancel'));row.append(again,single,cancel);d.append(head,text,el('p','A „Több modellel” ablak az előző kijelöléssel nyílik meg – ott még módosíthatsz.','muted'),row);document.body.append(d);d.showModal();again.focus();});}
  const api={open,ask,pending,clearSticky,run:open,closeGroup,isOn:()=>isOn(modeNow()),paint};try{window.creatorHubMultiModel=api;window.dispatchEvent(new Event('creatorhub:multimodel'));}catch{}
  return api;
}
