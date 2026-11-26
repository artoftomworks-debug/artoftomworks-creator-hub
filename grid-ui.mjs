import {createViewerNavigation,viewerArrow} from './media-viewer.mjs';
import {newBadge} from './new-feature-ui.mjs';
import {renderMediaDetails} from './media-details.mjs';// 0.16 DEV — ▦ Rácsnézet: egy sorozat vagy bármely Előzmények-szűrés képei táblázatban.
// Sorok: modellek · oszlopok: seedek · formátumonként külön lap. Kattintás: nagy nézet lapozással (← → ↑ ↓).
// ☆ csillag = kedvenc, mellette 1–5 értékelés – ugyanaz, mint az Előzményekben (közös adat). Nagy nézetben billentyűkkel:
// 1–5 értékelés, 0 törlés, F csillag. Szűrő: Mind / ★ / legalább 3 / legalább 4. „Mentés rácsképként”: egyetlen PNG feliratokkal
// (az értékelés ráírása választható, alapból ki).
// 0.17: törlésre jelölés (pipa a cellán, X/Del a nagy nézetben), alul sáv: 🗑 Lomtárba / ✕ Végleges törlés egyetlen megerősítéssel;
// a nagy nézetben látható gombsor (☆, 1–5, értékelés törlése, jelölés). A kedvenc/jól értékelt képekre külön figyelmeztet.
// Ha nincs modell/seed adat, egyszerű képrácsként jelenik meg.
import {modelFromFilename} from './ai-review-ui.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const orient=(w,h)=>!w||!h?'':w>h*1.05?'fekvő':h>w*1.05?'álló':'négyzetes';

// Pure: arrange items into format tabs → rows (models) × columns (seeds).
const isVideo=e=>/\.(mp4|webm|mov|mkv|m4v)$/i.test(e?.filename||'');
export function arrangeGrid(items,{compact=false}={}){
  /* 0.17.1: a videók is a rácsba kerülnek (a formátumuk szerinti fülön) */const imgs=items;
  const formats=new Map();
  for(const e of imgs){const f=e.width&&e.height?`${orient(e.width,e.height)} · ${e.width} × ${e.height}`:'képek';if(!formats.has(f))formats.set(f,[]);formats.get(f).push(e);}
  const tabs=[];
  for(const [label,list] of formats){
    const models=[...new Set(list.map(e=>modelFromFilename(e.filename)||'Ismeretlen modell'))].sort((a,b)=>a.localeCompare(b));
    const seeds=[...new Set(list.map(e=>e.seed).filter(v=>v!==null&&v!==undefined))].sort((a,b)=>a-b);
    const structured=!compact&&seeds.length>0&&seeds.length<=24&&list.every(e=>e.seed!==null&&e.seed!==undefined);
    const rows=models.map(model=>({model,cells:structured?seeds.map(seed=>list.filter(e=>(modelFromFilename(e.filename)||'Ismeretlen modell')===model&&e.seed===seed).sort((a,b)=>(b.created||0)-(a.created||0))[0]||null):list.filter(e=>(modelFromFilename(e.filename)||'Ismeretlen modell')===model)}));
    tabs.push({label,structured,seeds:structured?seeds:[],rows,count:list.length});
  }
  return tabs.sort((a,b)=>b.count-a.count);
}

export const FILTERS=[['all','Mind'],['fav','★ Kedvencek'],['r3','Legalább 3'],['r4','Legalább 4']];
export function passes(e,filter='all'){if(!e)return false;if(filter==='fav')return !!e.favorite;if(filter==='r3')return (e.rating||0)>=3;if(filter==='r4')return (e.rating||0)>=4;return true;}
// Pure: the tab as seen through a filter – hidden cells become null, rows with nothing left disappear (columns stay, so seeds line up).
export function filterTab(t,filter='all'){if(filter==='all')return t;const rows=t.rows.map(r=>({...r,cells:t.structured?r.cells.map(e=>passes(e,filter)?e:null):r.cells.filter(e=>passes(e,filter))})).filter(r=>r.cells.some(Boolean));return {...t,rows};}
export const ratingKey=key=>/^[0-5]$/.test(key)?Number(key):null;
export const markKey=ev=>!ev.ctrlKey&&!ev.altKey&&!ev.metaKey&&(ev.key==='x'||ev.key==='X'||ev.key==='Delete');
// Pure: a törlés megerősítő szövege – egyetlen kérdés, külön figyelmeztetés a kedvencekre / jól értékeltekre.
export function deleteQuestion(list,action){const n=list.length,keep=list.filter(e=>e.favorite||(e.rating||0)>=4).length;
 const q=action==='purge'?`${n} képet véglegesen törölsz? Ez nem vonható vissza.`:`${n} képet a Hub lomtárába helyezel? Az Előzmények Lomtár nézetében visszaállíthatók.`;
 return keep?q+'\n\n'+`Figyelem: ${keep} kedvenc vagy legalább 4-esre értékelt kép is van köztük.`:q;}

export async function openGrid({query='',title='Rács',compact=false,request,notify=()=>{}}){
  // 0.16 DEV: a teljes Előzmények-szűrést (dátum, projekt, keresés…) követi. Egyszerre 240 elemet tölt be (a legújabbakat);
  // ha a szűrésben több van, ezt kiírja, és a „További … betöltése” gombbal folytatható (legfeljebb 1200).
  const q=new URLSearchParams(query);q.delete('page');const items=[];let nextPage=1,pages=1,total=0;const MAX=1200,STEP=240;
  async function load(){const goal=Math.min(MAX,items.length+STEP);while(nextPage<=pages&&items.length<goal){q.set('page',String(nextPage));const r=await fetch('/api/history?'+q).then(x=>x.json());items.push(...(r.items||[]));pages=r.pages||1;total=r.total||items.length;nextPage++;}}
  const unavailable=new Set();
  const buildTabs=()=>arrangeGrid(items.filter(e=>!unavailable.has(e.id)),{compact});
  await load();let tabs=buildTabs();if(!tabs.length&&nextPage>pages){notify('Ebben a szűrésben nincs kép vagy videó a rácshoz.');return;}
  const d=el('dialog',null,'generationDialog gridDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();
  const save=el('button','⤓ Mentés rácsképként');save.type='button';head.append(el('h2','▦ '+title),save,close);d.append(head);
  const st=document.createElement('style');st.textContent=`.gridDialog{width:96vw;max-width:96vw;height:92vh;max-height:92vh;display:flex;flex-direction:column}
.gridDialog .gTabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.gridDialog .gTabs button.sel{border-color:var(--gold,#f2c584);color:var(--gold,#f2c584)}
.gridDialog .gWrap{overflow:auto;flex:1}.gridDialog table{border-collapse:separate;border-spacing:6px}.gridDialog th{font-size:12px;color:#a8beca;font-weight:600;text-align:left;vertical-align:middle;max-width:180px}
.gridDialog td{vertical-align:top}.gridDialog .gCell{position:relative;width:190px}.gridDialog .gCell img,.gCell video{width:190px;height:190px;object-fit:contain;background:#0a161c;border-radius:7px;cursor:zoom-in;display:block}.gCell.gVideo{position:relative}.gCell.gVideo::after{content:'▶';position:absolute;left:10px;top:8px;font-size:13px;color:#fff;background:#0009;border-radius:5px;padding:1px 6px;pointer-events:none}
.gridDialog .gCell small{display:block;font-size:11px;color:#9fb6c1;margin-top:2px}.gridDialog .gStar{position:absolute;top:4px;right:4px;min-height:26px;padding:0 7px;background:#000a}
.gridDialog .gTools{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:2px 0 6px}.gridDialog .gTools label{display:inline-flex!important;flex-direction:row!important;align-items:center;gap:6px;margin:0;font-size:13px}.gridDialog .gTools input[type=checkbox]{width:auto;margin:0}.gridDialog .gTools select{min-height:30px;width:auto}.gridDialog .gRate{position:absolute;top:4px;left:4px;min-height:26px;max-width:92px;padding:0 4px;font-size:12px;background:#000c;color:#f2c584;border-radius:6px}
.gridDialog .gLoaded{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gridDialog .gLoaded p{margin:0}.gridDialog .gLoaded button{min-height:28px;font-size:13px}
.gridZoom{position:fixed;inset:0;z-index:300;background:#050c11f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.gridZoom .zStage{position:relative;width:100%;display:flex;justify-content:center;align-items:center;min-height:62px}
.gridZoom img,.gridZoom video{max-width:calc(100vw - 112px);max-height:66vh;object-fit:contain}
@media(max-width:650px){.gridZoom img,.gridZoom video{max-width:calc(100vw - 82px)}}
.gridZoom .zInfo{width:min(1100px,90vw);box-sizing:border-box;max-height:20vh;overflow:auto;font-size:13px;color:#d0dfe8;text-align:center;padding:0 6px}.gridZoom .zInfo .quickPrompt{margin:2px 0;padding:0;border:0;max-width:none;width:100%;box-sizing:border-box}.gridZoom .zInfo .quickPrompt>summary{font-weight:400;font-size:13px;padding:0}.gridZoom .zInfo .quickPrompt button{min-height:24px;padding:0 8px;font-size:12px;flex:none}.gridZoom .zInfo .quickPrompt>p{font-size:13px}.gridZoom .zInfo .quickLoras{color:#ffd99a}.gridZoom p{color:#cfe0e8;margin:0}
.gridDialog .gMark{position:absolute;left:4px;bottom:24px;display:inline-flex!important;flex-direction:row!important;align-items:center;gap:4px;background:#000c;color:#e7eef2;border-radius:6px;padding:2px 6px;font-size:12px;cursor:pointer;margin:0}.gridDialog .gMark input{width:auto;margin:0}
.gridDialog .gCell.marked img{outline:3px solid #e0645a;outline-offset:-3px;opacity:.7}
.gridDialog .gActions{position:sticky;bottom:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;background:#13262ff2;border-top:1px solid #2c4550;border-radius:8px;margin-top:6px}.gridDialog .gActions b{color:#f2c584}.gridDialog .gActions .danger,.gridZoom .danger{border-color:#e0645a;color:#ffb3ac}
.gridZoom .zBar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center}.gridZoom .zBar button{min-height:32px;padding:0 10px}.gridZoom .zBar button.on{border-color:#f2c584;color:#f2c584}.gridZoom .zBar button.markOn{border-color:#e0645a;color:#ffb3ac}
.gridZoom .gridNew{position:absolute;top:10px;right:12px;min-height:30px;padding:0 10px;border-color:var(--gold,#f2c584);color:var(--gold,#f2c584)}
.gridZoom img.marked{outline:4px solid #e0645a;outline-offset:-4px}.gridZoom .zBar .sep{width:12px}`;
  d.append(st);
  const tools=el('div',null,'gTools'),fsel=el('select'),fl=el('label',null,'gFilter'),optL=el('label',null,'check'),opt=el('input');for(const [v,t] of FILTERS)fsel.add(new Option(t,v));fsel.title='Szűrés értékelés szerint – a gyengébbek eltűnnek, a jók egymás mellett maradnak';fl.append(el('span','Mutasd:'),' ',fsel);
  opt.type='checkbox';opt.checked=false;optL.title='A rácsképre a csillag és az értékelés is rákerül';optL.append(opt,' ',el('span','Értékelés a rácsképen'));tools.append(fl,optL);let filter='all';fsel.onchange=()=>{filter=fsel.value;draw();};
  const tabBar=el('div',null,'gTabs'),wrap=el('div',null,'gWrap'),actions=el('div',null,'gActions');actions.hidden=true;const info=el('p',null,'muted'),more=el('button');more.type='button';const loadedRow=el('div',null,'gLoaded');loadedRow.append(info,more);
  function drawInfo(){info.replaceChildren();if(total>items.length){info.append(el('span',`${items.length} / ${total} elem látszik – a legújabbak.`),' ',el('span','Szűkítsd az Előzményekben (dátum, projekt), vagy tölts be többet.'));more.hidden=items.length>=MAX;more.textContent=`További ${Math.min(STEP,total-items.length,MAX-items.length)} betöltése`;}else{info.append(el('span',`${items.length-unavailable.size} elem`));more.hidden=true;}}
  more.onclick=async()=>{more.disabled=true;try{await load();tabs=buildTabs();if(current>=tabs.length)current=0;drawInfo();draw();}catch(err){notify(err.message,true);}finally{more.disabled=false;}};
  d.append(loadedRow,el('p',(compact?'Sorok: modellek · ':'Sorok: modellek · oszlopok: seedek · ')+'kattints a képre a nagy nézethez (nyilakkal lapozhatsz) · ☆ = kedvenc · ☐ = jelölés törlésre','muted'),el('p','Nagy nézetben: 1–5 = értékelés · 0 = értékelés törlése · F = csillag · X vagy Del = jelölés törlésre','muted'),tools,tabBar,wrap,actions);
  let current=0, refreshFrame=0;
  function hideUnavailable(e){
    if(unavailable.has(e.id))return;
    unavailable.add(e.id);
    marked.delete(e.id);
    if(refreshFrame)return;
    refreshFrame=requestAnimationFrame(()=>{
      refreshFrame=0;
      if(!d.open)return;
      const format=tabs[current]?.label;
      tabs=buildTabs();
      current=Math.max(0,tabs.findIndex(t=>t.label===format));
      drawInfo();
      paintActions();
      draw();
    });
  }
  const detailCache=new Map();const controls=new Map();// id → {star, rate}: a nagy nézetben adott értékelés a cellán is látszik
  async function setFavorite(e,value){await request('history/annotate',{id:e.id,favorite:value});e.favorite=value;const c=controls.get(e.id);if(c)c.star.textContent=value?'★':'☆';}
  /* 0.17.1: ♛ Remekmű – korona + ★ + 5 */async function setCrown(e,value){const r=await request('history/annotate',{id:e.id,masterpiece:value});e.masterpiece=!!r?.masterpiece;e.favorite=!!r?.favorite;e.rating=r?.rating??e.rating;const c=controls.get(e.id);if(c){c.star.textContent=e.favorite?'★':'☆';c.rate.value=e.rating?String(e.rating):'';}}
  async function setRating(e,value){await request('history/annotate',{id:e.id,rating:value||null});e.rating=value||null;if(value!==5)e.masterpiece=false;const c=controls.get(e.id);if(c)c.rate.value=value?String(value):'';}
  /* 0.17: törlésre jelölés – lapozás közben gyűjtöd, a végén egyszer döntesz (lomtár vagy végleges) */
  const marked=new Set();
  function toggleMark(e,on=!marked.has(e.id)){if(on)marked.add(e.id);else marked.delete(e.id);const c=controls.get(e.id);if(c){c.mark.checked=on;c.box.classList.toggle('marked',on);}paintActions();}
  function actionButtons(after){const n=marked.size,bin=el('button','🗑 Lomtárba'),purge=el('button','✕ Végleges törlés','danger'),clear=el('button','Jelölés megszüntetése');for(const b of [bin,purge,clear])b.type='button';
   bin.title='A kijelölt képek a Hub lomtárába kerülnek – az Előzmények Lomtár nézetében visszaállíthatók';purge.title='A kijelölt képek fájljai véglegesen törlődnek – nem vonható vissza';
   bin.onclick=ev=>{ev.stopPropagation();void removeMarked('trash',after);};purge.onclick=ev=>{ev.stopPropagation();void removeMarked('purge',after);};clear.onclick=ev=>{ev.stopPropagation();for(const id of [...marked])marked.delete(id);paintActions();draw();after?.(false);};
   return [el('b',`${n} kép jelölve törlésre`),bin,purge,clear];}
  function paintActions(){actions.hidden=!marked.size;actions.replaceChildren(...(marked.size?actionButtons():[]));}
  let deleting=false;
  async function removeMarked(action,after){if(deleting||!marked.size)return;const list=items.filter(e=>marked.has(e.id));if(!list.length){marked.clear();paintActions();return;}
   if(!confirm(deleteQuestion(list,action)))return;deleting=true;
   try{const r=await request('history/batch',{ids:list.map(e=>e.id),action,confirmed:true});const ok=(r.results||[]).filter(v=>v.ok),gone=new Set(ok.flatMap(v=>v.ids||[v.id])),failed=(r.results||[]).filter(v=>!v.ok);
    for(let i=items.length-1;i>=0;i--)if(gone.has(items[i].id))items.splice(i,1);for(const id of gone)marked.delete(id);total=Math.max(items.length,total-gone.size);tabs=buildTabs();if(current>=tabs.length)current=0;
    notify(action==='purge'?`${gone.size} kép véglegesen törölve.`:`${gone.size} kép a lomtárba került. Az Előzmények Lomtár nézetében visszaállítható.`,false);
    if(failed.length)notify(`${failed.length} képet nem sikerült törölni: ${failed[0].error||''}`,true);
    after?.(true);}
   catch(err){notify(err.message,true);}finally{deleting=false;drawInfo();paintActions();draw();}}
  function cell(e){const c=el('div',null,'gCell'),img=isVideo(e)?el('video'):el('img');if(isVideo(e)){img.muted=true;img.loop=true;img.preload='metadata';img.playsInline=true;img.src=e.url+'#t=0.1';img.onmouseenter=()=>{void img.play().catch(()=>{});};img.onmouseleave=()=>{img.pause();};c.classList.add('gVideo');}else{img.loading='lazy';img.src=e.url;img.alt='';}img.onerror=()=>{c.hidden=true;hideUnavailable(e);};img.onclick=()=>zoom(e);
    const star=el('button',e.favorite?'★':'☆','gStar');star.type='button';star.title='Kedvenc';star.onclick=async ev=>{ev.stopPropagation();try{await setFavorite(e,!e.favorite);if(filter!=='all')draw();}catch(err){notify(err.message,true);}};
    const rate=el('select',null,'gRate');rate.title='Értékelés';rate.setAttribute('aria-label','Értékelés · '+(e.filename||''));rate.add(new Option('Még nincs',''));for(let i=1;i<=5;i++)rate.add(new Option(i+' / 5',String(i)));rate.value=e.rating?String(e.rating):'';rate.onclick=ev=>ev.stopPropagation();
    rate.onchange=async()=>{try{await setRating(e,rate.value?Number(rate.value):null);if(filter!=='all')draw();}catch(err){notify(err.message,true);rate.value=e.rating?String(e.rating):'';}};
    const markL=el('label',null,'gMark'),mark=el('input');mark.type='checkbox';mark.checked=marked.has(e.id);markL.title='Jelölés törlésre';markL.onclick=ev=>ev.stopPropagation();mark.onchange=()=>toggleMark(e,mark.checked);markL.append(mark,' ',el('span','törlés'));c.classList.toggle('marked',marked.has(e.id));
    controls.set(e.id,{star,rate,mark,box:c});c.append(img,rate,star,markL,el('small',[e.seed!=null?'seed '+e.seed:'',e.width&&e.height?e.width+' × '+e.height:''].filter(Boolean).join(' · ')));return c;}
  function draw(){
    tabBar.replaceChildren();tabs.forEach((t,i)=>{const b=el('button',`${t.label} (${t.count})`);b.type='button';if(i===current)b.className='sel';b.onclick=()=>{current=i;draw();};tabBar.append(b);});tabBar.hidden=tabs.length<2;
    if(!tabs.length){wrap.replaceChildren(el('p','A betöltött elemek között nincs megjeleníthető kép vagy videó.','muted'));return;}
    const full=tabs[current],t=filterTab(full,filter),table=el('table');controls.clear();
    if(!t.rows.length){wrap.replaceChildren(el('p','Ezzel a szűréssel nincs látható kép. Válaszd a „Mind” lehetőséget.','muted'));return;}
    if(t.structured){const hr=el('tr');hr.append(el('th','Modell / seed'));for(const s of t.seeds)hr.append(el('th',String(s)));table.append(hr);}
    for(const r of t.rows){const tr=el('tr');tr.append(el('th',r.model));for(const e of r.cells){const td=el('td');if(e)td.append(cell(e));tr.append(td);}table.append(tr);}
    wrap.replaceChildren(table);
  }
  function zoom(e){const t=filterTab(tabs[current],filter),grid=t.rows.map(r=>r.cells);let ri=t.rows.findIndex(r=>r.cells.includes(e)),ci=grid[ri].indexOf(e);
    const z=el('div',null,'gridZoom'),img=el('img'),vid=el('video'),cap=el('p'),bar=el('div',null,'zBar'),del=el('div',null,'zBar'),hint=el('p','← → előző / következő · ↑ ↓ modellek · 1–5 értékelés · 0 értékelés törlése · F csillag · M remekmű · X / Del jelölés törlésre · Esc bezárás','muted');const info=el('div',null,'zInfo'),stage=el('div',null,'zStage');vid.controls=true;vid.loop=true;vid.playsInline=true;vid.hidden=true;stage.append(img,vid);z.append(stage,cap,info,bar,del,hint);
    const btn=(text,title,fn,cls)=>{const b=el('button',text,cls);b.type='button';if(title)b.title=title;b.onclick=ev=>{ev.stopPropagation();fn();};return b;};
    const positions=grid.flatMap((row,r)=>row.flatMap((x,c)=>x?[{x,r,c}]:[]));
    const neighbor=dir=>{
      const index=positions.findIndex(p=>p.r===ri&&p.c===ci);
      for(let i=index+dir;i>=0&&i<positions.length;i+=dir){
        if(!unavailable.has(positions[i].x.id))return positions[i];
      }
    };
    const step=dir=>{const p=neighbor(dir);if(p){ri=p.r;ci=p.c;show();}};
    const {prev,next}=createViewerNavigation(step);
    const badge=newBadge('grid-navigation');badge.classList.add('gridNew');
    stage.append(prev,next);z.append(badge);
    const skipUnavailable=()=>{
      const x=grid[ri]?.[ci];
      if(!x)return;
      hideUnavailable(x);
      if(neighbor(1))step(1);
      else if(neighbor(-1))step(-1);
      else done();
    };
    img.onerror=vid.onerror=ev=>{if(!closed&&!ev.currentTarget.hidden)skipUnavailable();};
    const act=p=>p.then(show).catch(err=>notify(err.message,true));
    const show=()=>{const x=grid[ri]?.[ci];if(!x)return;prev.disabled=!neighbor(-1);next.disabled=!neighbor(1);if(isVideo(x)){img.hidden=true;img.removeAttribute('src');vid.hidden=false;if(vid.dataset.src!==x.url){vid.dataset.src=x.url;vid.src=x.url;void vid.play().catch(()=>{});}}else{vid.pause();vid.hidden=true;img.hidden=false;img.src=x.url;}img.classList.toggle('marked',marked.has(x.id));cap.textContent=`${x.masterpiece?'♛ ':''}${x.favorite?'★ ':''}${x.rating?x.rating+'/5 · ':''}${t.rows[ri].model}${x.seed!=null?' · seed '+x.seed:''}${x.width?' · '+x.width+' × '+x.height:''}`;
      bar.replaceChildren(btn(x.favorite?'★ Kedvenc':'☆ Kedvenc','Kedvenc (F)',()=>act(setFavorite(x,!x.favorite)),x.favorite?'on':''),el('span',null,'sep'),...[1,2,3,4,5].map(n=>btn(String(n),n+' / 5',()=>act(setRating(x,n)),x.rating===n?'on':'')),btn('–','Értékelés törlése (0)',()=>act(setRating(x,null))),btn('♛','Remekmű (M) – a korona mellé a ★ kedvenc és az 5-ös is jár',()=>act(setCrown(x,!x.masterpiece)),x.masterpiece?'on crownBtn':'crownBtn'),el('span',null,'sep'),
        btn(marked.has(x.id)?'🗑 Törlésre jelölve':'🗑 Jelölés törlésre','Jelölés törlésre (X vagy Del) – a végén egyszerre döntesz',()=>{toggleMark(x);show();},marked.has(x.id)?'markOn':''),btn('Bezárás','Esc',()=>done()));
      del.hidden=!marked.size;del.replaceChildren(...(marked.size?actionButtons(changed=>{if(changed)done();else show();}):[]));void paintInfo(x);};
    /* 0.17.1: ugyanaz az adatpanel, mint az Előzmények nagy nézetében (modell, LoRA-k, seed, lépés, CFG, prompt) */
    const paintInfo=async x=>{const id=x.id;if(!id){info.replaceChildren();return;}let v=detailCache.get(id);if(!v){info.dataset.for=id;try{v=await fetch('/api/history/details?id='+encodeURIComponent(id)).then(r=>r.ok?r.json():null);}catch{v=null;}if(v)detailCache.set(id,v);}if(grid[ri]?.[ci]?.id!==id)return;renderMediaDetails(info,v||{...x,loras:undefined},el);};
    const move=(dr,dc)=>{let r=ri,c=ci;for(let k=0;k<50;k++){r+=dr;c+=dc;if(r<0||r>=grid.length||c<0||c>=(grid[r]?.length||0))return;if(grid[r][c]&&!unavailable.has(grid[r][c].id)){ri=r;ci=c;show();return;}if(!dr&&!dc)return;}};
    const key=ev=>{if(ev.target?.closest?.('input,select,textarea'))return;const x=grid[ri]?.[ci],n=ratingKey(ev.key);if(x&&n!==null&&!ev.ctrlKey&&!ev.altKey&&!ev.metaKey){ev.preventDefault();act(setRating(x,n));return;}if(x&&(ev.key==='f'||ev.key==='F')&&!ev.ctrlKey&&!ev.metaKey){ev.preventDefault();act(setFavorite(x,!x.favorite));return;}if(x&&(ev.key==='m'||ev.key==='M')&&!ev.ctrlKey&&!ev.metaKey){ev.preventDefault();act(setCrown(x,!x.masterpiece));return;}if(x&&markKey(ev)){ev.preventDefault();toggleMark(x);show();return;}if(ev.key==='Escape'){ev.preventDefault();done();}else if(viewerArrow(ev,step))return;else if(ev.key==='ArrowDown')move(1,0);else if(ev.key==='ArrowUp')move(-1,0);};
    let closed=false;const done=()=>{if(closed)return;closed=true;vid.pause();z.remove();document.removeEventListener('keydown',key,true);draw();};z.onclick=ev=>{if(ev.target===z||ev.target===img)done();};document.addEventListener('keydown',key,true);d.append(z);show();}
  save.onclick=async()=>{save.disabled=true;try{const t=filterTab(tabs[current],filter);if(!t.rows.length)throw Error('Ezzel a szűréssel nincs látható kép.');await saveSheet(t,title,{marks:opt.checked});}catch(err){notify(err.message,true);}finally{save.disabled=false;}};
  d.addEventListener('close',()=>{cancelAnimationFrame(refreshFrame);d.remove();});document.body.append(d);d.showModal();drawInfo();draw();
}

// One PNG: title, column/row headers, thumbnails (max 512 px per cell).
async function saveSheet(t,title,{marks=false}={}){
  const cellPx=Math.min(512,Math.max(256,Math.floor(4096/Math.max(1,(t.structured?t.seeds.length:Math.max(...t.rows.map(r=>r.cells.length)))))));
  const cols=t.structured?t.seeds.length:Math.max(...t.rows.map(r=>r.cells.length)),left=240,top=t.structured?110:70,pad=8;
  const cv=document.createElement('canvas');cv.width=left+cols*(cellPx+pad)+pad;cv.height=top+t.rows.length*(cellPx+pad)+pad;const g=cv.getContext('2d');
  g.fillStyle='#0b1a21';g.fillRect(0,0,cv.width,cv.height);g.fillStyle='#f2c584';g.font='bold 28px Segoe UI, sans-serif';let tr=x=>x;try{tr=(await import('./i18n-ui.mjs')).translateText;}catch{}g.fillText(title+' · '+tr(t.label),pad*2,40);
  g.fillStyle='#cfe0e8';g.font='18px Segoe UI, sans-serif';if(t.structured)t.seeds.forEach((s,i)=>g.fillText('seed '+s,left+i*(cellPx+pad)+pad,top-14));
  const load=src=>new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src;});
  for(const [ri,r] of t.rows.entries()){const y=top+ri*(cellPx+pad);g.fillStyle='#cfe0e8';g.font='18px Segoe UI, sans-serif';const words=r.model.split(' ');let line='',ly=y+28;for(const w of words){if(g.measureText(line+w).width>left-20){g.fillText(line,pad*2,ly);ly+=22;line='';}line+=w+' ';}g.fillText(line,pad*2,ly);
    for(const [ci,e] of r.cells.entries()){if(!e)continue;const im=await load(e.url);if(!im)continue;const k=Math.min(cellPx/im.naturalWidth,cellPx/im.naturalHeight),w=im.naturalWidth*k,h=im.naturalHeight*k,x=left+ci*(cellPx+pad)+pad+(cellPx-w)/2;g.drawImage(im,x,y+(cellPx-h)/2,w,h);if(marks&&(e.favorite||e.rating)){const label=(e.favorite?'★ ':'')+(e.rating?e.rating+'/5':'');g.font='bold 28px Segoe UI, sans-serif';const tw=g.measureText(label).width,bx=left+ci*(cellPx+pad)+pad+cellPx-tw-18;g.fillStyle='#000b';g.fillRect(bx,y+6,tw+12,38);g.fillStyle='#f2c584';g.fillText(label,bx+6,y+35);}}}
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=('Racs_'+title+'_'+t.label).replace(/[^\p{L}\p{N}_ -]+/gu,'_').slice(0,90)+'.png';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
}
