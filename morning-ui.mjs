// 0.16 DEV — Reggeli válogatás: ha legalább egy órát távol voltál, és közben legalább 12 új kép készült,
// a Hub egy kártyán megmutatja a 6 legjobbat az ízlésprofilod alapján. Kikapcsolható a ⚙ Beállításokban.
const SEEN='creatorHub.lastSeen',OFF='creatorHub.morningPick';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export function morningEnabled(){try{return localStorage.getItem(OFF)!=='off';}catch{return true;}}
export function shouldOffer({now,lastSeen,newCount,minAwayMs=3600e3,minNew=12}){return !!lastSeen&&now-lastSeen>=minAwayMs&&newCount>=minNew;}
function readSeen(){try{return Number(localStorage.getItem(SEEN))||0;}catch{return 0;}}
function writeSeen(v=Date.now()){try{localStorage.setItem(SEEN,String(v));}catch{}}

export function createMorning({request,onOpen}){
 const css=document.createElement('style');css.textContent=`.morningDialog{width:min(900px,95vw)}.morningDialog .mGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}.morningDialog figure{margin:0;background:#071116;border-radius:10px;overflow:hidden;cursor:pointer;position:relative}.morningDialog figure img{width:100%;height:210px;object-fit:contain;display:block}.morningDialog figcaption{font-size:12px;color:#a8beca;padding:5px 8px}.morningDialog .mRow{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:700px){.morningDialog .mGrid{grid-template-columns:repeat(2,1fr)}}`;document.head.append(css);
 let busy=false;
 // „Távol” = nem volt egér-/billentyűmozdulat a Hubban (akkor is, ha a lap egész éjjel nyitva maradt).
 async function check(since){if(busy||!morningEnabled()||!since)return;busy=true;try{const r=await request('taste/pick?since='+since+'&limit=6');if(shouldOffer({now:Date.now(),lastSeen:since,newCount:r.total||0})&&r.picks?.length)show(r);}catch{}finally{busy=false;}}
 function show(r){/* egyszer mutatjuk: az „itt voltam” időpont most frissül */lastAct=Date.now();writeSeen(lastAct);const d=el('dialog',null,'studioDialog morningDialog'),head=el('div',null,'sectionTitle'),h=el('h2'),close=el('button','Bezárás');close.type='button';
  h.append(el('span','Amíg távol voltál:'),' '+r.total+' ',el('span','új kép készült.'));head.append(h,close);
  const p=el('p','','muted');p.append(el('span',r.personal?'Az ízlésed alapján ezek a legjobbak:':'Még kevés az értékelésed, ezért modellenként a legfrissebbeket mutatom. Értékelj néhány képet, és legközelebb már személyre szabott lesz a válogatás.'));
  const grid=el('div',null,'mGrid');for(const x of r.picks){const f=el('figure'),img=el('img'),cap=el('figcaption');img.src=x.url;img.alt=x.filename||'';img.loading='lazy';cap.append(document.createTextNode(x.model||''),...(x.why?.length?[' · ',el('span',x.why[0])]:[]));f.append(img,cap);f.title='Megnyitás nagy nézetben';f.onclick=()=>{d.close();onOpen?.(x);};grid.append(f);}
  const row=el('div',null,'mRow'),hist=el('button','Megnézem mindet az Előzményekben'),off=el('button','Ne mutasd többet');hist.type=off.type='button';hist.onclick=()=>{d.close();onOpen?.(null);};off.onclick=()=>{try{localStorage.setItem(OFF,'off');}catch{}d.close();};row.append(off,hist);
  d.append(head,p,grid,row);document.body.append(d);close.onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();}
 let lastAct=readSeen()||Date.now(),lastWrite=0;
 const activity=()=>{const now=Date.now();if(now-lastAct>=3600e3)void check(lastAct);lastAct=now;if(now-lastWrite>30e3){lastWrite=now;writeSeen(now);}};
 for(const ev of ['pointerdown','keydown','wheel'])addEventListener(ev,activity,{capture:true,passive:true});
 // Betöltéskor: ha a legutóbbi mozdulat óta legalább egy óra telt el (pl. reggel újranyitott lap).
 setTimeout(()=>{if(Date.now()-lastAct>=3600e3)void check(lastAct);},6000);
 return {check,show};
}
