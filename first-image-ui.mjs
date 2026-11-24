// 0.16 DEV — „Első kép 1 perc alatt”: az első indításkor a Hub megnézi a gépet és a meglévő modelleket,
// kiválaszt egy gyors, használatra kész képmodellt, és egy kattintással elkészíti az első képet a felhasználó saját gépén.
// Bármikor újraindítható a ⚙ Beállításokból; ha a felhasználó bezárja, többé nem jön elő magától.
const KEY='creatorHub.firstImage';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export const IDEAS=[
 {title:'Hegyi tó hajnalban',icon:'🏔',prompt:'a calm alpine lake at sunrise, mist over the water, pine forest, golden light on snowy peaks, ultra detailed landscape photography'},
 {title:'Neon eső a városban',icon:'🌃',prompt:'a rainy city street at night, neon signs reflecting on wet asphalt, a person with a red umbrella, cinematic, 35mm film look'},
 {title:'Róka portré',icon:'🦊',prompt:'portrait of a curious red fox in a snowy forest, soft winter light, shallow depth of field, wildlife photography, highly detailed fur'},
];
// Gyors és szép első kép: a kedvencek előre, utána a gyors családok.
const ORDER=['sdxl','illustrious','pony','krea2','flux1','moss','qwen','hidream','sd3','sd15'];
export function pickModel(models){const rank=m=>{const i=ORDER.indexOf(String(m.family||'').toLowerCase());return (m.favorite?-100:0)+(i<0?50:i);};return [...models].sort((a,b)=>rank(a)-rank(b)||String(a.name).localeCompare(String(b.name)))[0]||null;}
export function firstImageState(){try{return localStorage.getItem(KEY)||'';}catch{return '';}}
function remember(v){try{localStorage.setItem(KEY,v);}catch{}}

export function createFirstImage({$,state,current,models,request,notify}){
 const css=document.createElement('style');css.textContent=`.firstImageDialog{width:min(640px,94vw)}.firstImageDialog h2{margin:0 0 6px}.firstImageDialog .fiMachine{font-size:14px;color:#cfe0e8;margin:6px 0 12px}.firstImageDialog .fiIdeas{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:10px 0}.firstImageDialog .fiIdeas button{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:14px;min-height:96px;text-align:left;font-size:15px}.firstImageDialog .fiIdeas b{font-size:28px;line-height:1}.firstImageDialog .fiStatus{font-size:15px;min-height:22px;margin:10px 0}.firstImageDialog .fiStatus.ok{color:#8fd19e;font-weight:600}.firstImageDialog progress{width:100%}`;document.head.append(css);
 let dialog=null;
 async function machine(){try{const r=await request('resources/status',{backend:state().backend});const devs=r?.stats?.devices||[],g=devs.find(d=>d.type==='cuda')||devs.find(d=>d.type!=='cpu');if(!g)return '';const gpu=String(g.name||'').replace(/^cuda:\d+\s*/,'').replace(/\s*:\s*\w+$/,'');const vram=Number(g.vram_total)/1024**3;return gpu+(vram?' · '+Math.round(vram)+' GB VRAM':'');}catch{return '';}}
 async function open({auto=false}={}){
  if(dialog?.open)return;const list=models?.()||[];
  const d=el('dialog',null,'studioDialog firstImageDialog');dialog=d;const head=el('div','','sectionTitle'),h=el('h2','Készítsük el az első képedet'),close=el('button','Később');close.type='button';head.append(h,close);
  const intro=el('p','Egy kattintás, és a saját gépeden készül el – nem kell semmit beállítanod. Utána mindent átírhatsz.');
  const mach=el('p','','fiMachine'),status=el('p','','fiStatus'),bar=el('progress');bar.hidden=true;
  const ideas=el('div',null,'fiIdeas');
  d.append(head,intro,mach,ideas,status,bar);document.body.append(d);d.showModal();
  close.onclick=()=>{if(auto&&!firstImageState())remember('later');d.close();};d.addEventListener('close',()=>d.remove());
  if(state().mode!=='image'){$('imageMode')?.click();await wait(600);}
  /* a modellista betöltése eltarthat egy kicsit az induláskor */if(!(models?.()||[]).length){status.replaceChildren(el('span','A modellek keresése…'));for(let i=0;i<60&&!(models?.()||[]).length&&d.open;i++)await wait(500);status.replaceChildren();}
  const pool=(models?.()||list).filter(m=>m.mode==='image'||!m.mode);const model=pickModel(pool);
  void machine().then(gpu=>{mach.replaceChildren();if(gpu){mach.append(el('span','A géped:'),' '+gpu);}if(model){if(gpu)mach.append(document.createElement('br'));mach.append(el('span','Ezzel a modellel készül:'),' '+String(model.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf)$/i,''));}});
  if(!model){status.replaceChildren(el('span','Még nincs használatra kész képmodell. A Modellek fülön vagy a modellböngészőben tudsz letölteni egyet – utána itt folytathatjuk.'));return;}
  for(const idea of IDEAS){const b=el('button');b.type='button';b.append(el('b',idea.icon),el('span',idea.title));b.onclick=()=>void run(idea,model,{d,ideas,status,bar});ideas.append(b);}
 }
 async function run(idea,model,{d,ideas,status,bar}){
  for(const b of ideas.querySelectorAll('button'))b.disabled=true;bar.hidden=false;bar.removeAttribute('value');
  const say=t=>{status.className='fiStatus';status.replaceChildren(el('span',t));};
  try{
   say('A modell előkészítése…');const sel=$('automaticModel');if(sel&&sel.value!==model.id){sel.value=model.id;sel.dispatchEvent(new Event('change',{bubbles:true}));}
   for(let i=0;i<60&&!(current().automatic?.id===model.id&&current().info);i++)await wait(500);
   if(!(current().automatic?.id===model.id&&current().info))throw Error('A modell nem töltődött be időben. Próbáld újra, vagy válassz modellt a listából.');
   const set=(id,v)=>{const e=$(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};
   set('prompt',idea.prompt);set('count','1');await wait(600);
   for(let i=0;i<40&&$('start')?.disabled;i++)await wait(500);if($('start')?.disabled)throw Error('A generálás most nem indítható (fut valami, vagy hiányzik egy összetevő).');
   const t0=Date.now();let before=new Set();try{before=new Set(((await request('generation/status')).entries||[]).map(e=>e.id));}catch{}
   say('Készül a képed a saját gépeden…');$('start').click();
   let entry=null;for(let i=0;i<600;i++){await wait(1000);let s=null;try{s=await request('generation/status');}catch{continue;}entry=(s.entries||[]).filter(e=>!before.has(e.id)).pop()||entry;const sec=Math.round((Date.now()-t0)/1000);if(entry&&['failed','cancelled'].includes(entry.state))throw Error(entry.error||'A generálás nem sikerült.');if(entry?.state==='complete')break;status.replaceChildren(el('span','Készül a képed a saját gépeden…'),' '+sec+' mp');}
   if(entry?.state!=='complete')throw Error('A kép még nem készült el. Az Előnézetben követheted.');
   const sec=Math.max(1,Math.round((Date.now()-t0)/1000));remember('done');bar.hidden=true;
   status.className='fiStatus ok';status.replaceChildren(el('span','Kész! Ez a kép a te gépeden készült,'),' '+sec+' ',el('span','másodperc alatt.'));
   const next=el('p');next.append(el('span','Most te jössz: írd át a promptot az Alkotás panelen, és nyomd meg a Generálás indítása gombot.'));const ok=el('button','Kezdjük!','primary');ok.type='button';ok.onclick=()=>d.close();d.append(next,ok);ok.focus();
   notify(['✨',' ','Az első képed elkészült.']);
  }catch(e){bar.hidden=true;status.className='fiStatus';status.replaceChildren(el('span',e.message));for(const b of ideas.querySelectorAll('button'))b.disabled=false;}
 }
 // Automatikusan csak egyszer, csak ha még nincs egyetlen előzmény sem, és a nézetválasztás (Egyszerű/Haladó) már megtörtént.
 async function maybeAuto(){if(firstImageState())return;let total=1;try{total=(await request('history?page=1')).total;}catch{return;}if(total>0){remember('has-history');return;}
  for(let i=0;i<240;i++){let mode=null;try{mode=localStorage.getItem('creatorHub.viewMode');}catch{}if(mode&&!document.querySelector('dialog[open]')&&(models?.()||[]).length)break;await wait(1000);}
  if(!firstImageState())void open({auto:true});}
 setTimeout(()=>void maybeAuto(),2500);addEventListener('creatorhub:first-image',()=>void open());
 return {open};
}
