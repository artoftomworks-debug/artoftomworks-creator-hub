// 0.16 DEV — Egyszerű / Haladó nézet (felület-átnézés). Egy kattintás a fejlécben, bármikor visszaváltható.
// Egyszerű nézetben csak a lényeg látszik: modell, prompt, méret, darabszám, Generálás, Előnézet, Előzmények, Modellek, LoRA-k.
// A rejtett beállítások NEM vesznek el és ugyanúgy hatnak – ha valamelyik eltér az alapértéktől, egy jelzés mutatja
// („2 haladó beállítás aktív · megnézem”), így nem lesz belőle csendes hiba. Első indításkor egy kérdés dönti el a kezdő nézetet.
import {automaticSamplingDefaults} from './sampling-policy.mjs';
const KEY='creatorHub.viewMode';
const css=`body.simpleView #tab-control,body.simpleView #tab-reference,body.simpleView #tab-assets,body.simpleView #tab-pose,body.simpleView #tab-tools,body.simpleView #tab-advanced,body.simpleView #tab-engine,
body.simpleView #previewPause,body.simpleView #previewRefresh,body.simpleView [data-generation-action=tokens],body.simpleView [data-generation-action=export],
body.simpleView .dockTabs .dockGroup,body.simpleView #samplingControls,body.simpleView #seedControls,body.simpleView #openResources,body.simpleView #openGenerationQueue{display:none!important}
#viewModeToggle{white-space:nowrap}#viewModeToggle.simple{border-color:#7fb3c9}
#hiddenActive{margin:4px 0 0;font-size:13px;color:#ffe2b8}#hiddenActive[hidden]{display:none}#hiddenActive button{min-height:24px;padding:0 8px;font-size:12px;margin-left:6px}
dialog.viewModeDialog{max-width:560px;border:1px solid var(--gold,#f2c584);border-radius:12px;background:#10232d;color:#e7eef2;padding:20px}dialog.viewModeDialog::backdrop{background:#000b}
dialog.viewModeDialog h2{margin:0 0 8px;color:var(--gold,#f2c584);font-size:21px}dialog.viewModeDialog p{line-height:1.5;margin:0 0 12px}
dialog.viewModeDialog .vmChoices{display:grid;grid-template-columns:1fr 1fr;gap:10px}dialog.viewModeDialog .vmChoices button{text-align:left;padding:12px;min-height:90px;display:flex;flex-direction:column;gap:4px}
dialog.viewModeDialog .vmChoices b{font-size:16px}dialog.viewModeDialog .vmChoices span{font-size:13px;color:#bcd0da}`;

// Pure: which hidden settings are actually in effect (differ from the starting values)?
export function hiddenActive({sampling={},defaults={},overrides={},seedMode='increment',memoryProfile='auto'}={}){
  const out=[];
  if(typeof sampling.steps==='number'&&defaults.steps!==undefined&&sampling.steps!==defaults.steps)out.push({key:'steps',value:sampling.steps,base:defaults.steps});
  if(typeof sampling.cfg==='number'&&defaults.cfg!==undefined&&sampling.cfg!==defaults.cfg)out.push({key:'cfg',value:sampling.cfg,base:defaults.cfg});
  for(const k of ['sampler','scheduler'])if(overrides?.[k]!==false&&typeof sampling[k]==='string'&&defaults[k]&&sampling[k]!==defaults[k])out.push({key:k,value:sampling[k],base:defaults[k]});
  if(seedMode==='fixed')out.push({key:'seedMode',value:'fixed'});
  if(memoryProfile&&memoryProfile!=='auto')out.push({key:'memory',value:memoryProfile});
  return out;
}
const NAMES={steps:'Lépésszám',cfg:'CFG',sampler:'Sampler',scheduler:'Scheduler',seedMode:'Azonos seed minden változatnál',memory:'Memóriamód'};
export function readMode(){try{const v=localStorage.getItem(KEY);return v==='simple'||v==='advanced'?v:null;}catch{return null;}}

export function createViewMode({$,current,getState,model,onSimple=()=>{}}){
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  let mode=readMode()||'advanced';
  const nav=document.querySelector('body>header nav'),btn=document.createElement('button');btn.type='button';btn.id='viewModeToggle';
  const gear=()=>document.getElementById('hubGearButton')?.closest('.hubGear');
  const place=()=>{if(!nav)return;const g=gear();if(g&&btn.nextSibling!==g)nav.insertBefore(btn,g);else if(!g&&!nav.contains(btn))nav.append(btn);};place();setTimeout(place,1500);setTimeout(place,5000);
  const note=document.createElement('p');note.id='hiddenActive';note.setAttribute('role','status');note.hidden=true;
  function apply(next,{remember=true}={}){mode=next;document.body.classList.toggle('simpleView',mode==='simple');btn.classList.toggle('simple',mode==='simple');
    btn.replaceChildren(document.createTextNode(mode==='simple'?'◐ ':'◑ '),Object.assign(document.createElement('span'),{textContent:mode==='simple'?'Egyszerű nézet':'Haladó nézet'}));
    btn.title=mode==='simple'?'Most: Egyszerű nézet – csak a lényeg látszik. Kattints a Haladó nézethez (minden beállítás).':'Most: Haladó nézet – minden beállítás látszik. Kattints az Egyszerű nézethez.';
    if(remember)try{localStorage.setItem(KEY,mode);}catch{}
    if(mode==='simple')onSimple();refresh();}
  btn.onclick=()=>apply(mode==='simple'?'advanced':'simple');
  function refresh(){
    const host=document.getElementById('planLine')||document.getElementById('start')?.closest('.actions');if(host&&note.previousElementSibling!==host)host.after(note);
    if(mode!=='simple'){note.hidden=true;return;}
    const c=current(),m=model?.();let items=[];
    try{items=hiddenActive({sampling:c?.controls?.sampling||{},defaults:m?automaticSamplingDefaults(m):{},overrides:c?.controls?.samplingOverrides,seedMode:c?.seedMode,memoryProfile:getState()?.memoryProfile});}catch{}
    note.hidden=!items.length;if(!items.length)return;
    const span=t=>Object.assign(document.createElement('span'),{textContent:t});
    const look=document.createElement('button');look.type='button';look.textContent='megnézem';look.title='Átvált a Haladó nézetre, és odagörget';
    look.onclick=()=>{apply('advanced');const q=document.getElementById('quickSettings');if(q)q.open=true;(document.getElementById('samplingControls')||q)?.scrollIntoView({behavior:'smooth',block:'center'});};
    note.title=items.map(i=>(NAMES[i.key]||i.key)+': '+i.value+(i.base!==undefined?' (alap: '+i.base+')':'')).join('\n');
    note.replaceChildren('⚙ ',span(items.length===1?'1 haladó beállítás aktív':items.length+' haladó beállítás aktív'),' ',look);
  }
  // First run: ask once. The answer only sets the starting view; the toggle stays in the header.
  function ask(){if(readMode())return;const d=document.createElement('dialog');d.className='viewModeDialog';
    const h=document.createElement('h2');h.textContent='Üdv a Creator Hubban!';const p=document.createElement('p');p.textContent='Most ismerkedsz a képgenerálással, vagy már használtál ComfyUI-t? A válasz csak a kezdő nézetet állítja be – a fejlécben egy kattintással bármikor átválthatsz.';
    const row=document.createElement('div');row.className='vmChoices';
    const choice=(title,text,value)=>{const b=document.createElement('button');b.type='button';b.append(Object.assign(document.createElement('b'),{textContent:title}),Object.assign(document.createElement('span'),{textContent:text}));b.onclick=()=>{d.close();d.remove();apply(value);};row.append(b);return b;};
    choice('◐ Most ismerkedem','Egyszerű nézet: modell, prompt, méret, darabszám – a többit a Hub intézi.','simple');
    choice('◑ Már használtam','Haladó nézet: minden beállítás látszik (lépésszám, sampler, seed, memória…).','advanced');
    d.append(h,p,row);d.addEventListener('cancel',e=>{e.preventDefault();});document.body.append(d);d.showModal();}
  apply(mode,{remember:!!readMode()});setTimeout(ask,600);
  return {apply,refresh,mode:()=>mode};
}
