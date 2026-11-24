// 0.16 DEV — ▦ Rácsnézet: egy sorozat vagy bármely Előzmények-szűrés képei táblázatban.
// Sorok: modellek · oszlopok: seedek · formátumonként külön lap. Kattintás: nagy nézet lapozással (← → ↑ ↓).
// ☆ csillag = kedvenc, mellette 1–5 értékelés – ugyanaz, mint az Előzményekben (közös adat). Nagy nézetben billentyűkkel:
// 1–5 értékelés, 0 törlés, F csillag. Szűrő: Mind / ★ / legalább 3 / legalább 4. „Mentés rácsképként”: egyetlen PNG feliratokkal
// (az értékelés ráírása választható, alapból ki).
// Ha nincs modell/seed adat, egyszerű képrácsként jelenik meg.
import {modelFromFilename} from './ai-review-ui.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const orient=(w,h)=>!w||!h?'':w>h*1.05?'fekvő':h>w*1.05?'álló':'négyzetes';

// Pure: arrange items into format tabs → rows (models) × columns (seeds).
export function arrangeGrid(items){
  const imgs=items.filter(e=>!/\.(mp4|webm|mov|mkv|m4v)$/i.test(e.filename||''));
  const formats=new Map();
  for(const e of imgs){const f=e.width&&e.height?`${orient(e.width,e.height)} · ${e.width} × ${e.height}`:'képek';if(!formats.has(f))formats.set(f,[]);formats.get(f).push(e);}
  const tabs=[];
  for(const [label,list] of formats){
    const models=[...new Set(list.map(e=>modelFromFilename(e.filename)||'Ismeretlen modell'))].sort((a,b)=>a.localeCompare(b));
    const seeds=[...new Set(list.map(e=>e.seed).filter(v=>v!==null&&v!==undefined))].sort((a,b)=>a-b);
    const structured=seeds.length>0&&seeds.length<=24&&list.every(e=>e.seed!==null&&e.seed!==undefined);
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

export async function openGrid({query='',title='Rács',request,notify=()=>{}}){
  // 0.16 DEV: a teljes Előzmények-szűrést (dátum, projekt, keresés…) követi. Egyszerre 240 elemet tölt be (a legújabbakat);
  // ha a szűrésben több van, ezt kiírja, és a „További … betöltése” gombbal folytatható (legfeljebb 1200).
  const q=new URLSearchParams(query);q.delete('page');const items=[];let nextPage=1,pages=1,total=0;const MAX=1200,STEP=240;
  async function load(){const goal=Math.min(MAX,items.length+STEP);while(nextPage<=pages&&items.length<goal){q.set('page',String(nextPage));const r=await fetch('/api/history?'+q).then(x=>x.json());items.push(...(r.items||[]));pages=r.pages||1;total=r.total||items.length;nextPage++;}}
  await load();let tabs=arrangeGrid(items);if(!tabs.length&&nextPage>pages){notify('Ebben a szűrésben nincs kép a rácshoz.',true);return;}
  const d=el('dialog',null,'generationDialog gridDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();
  const save=el('button','⤓ Mentés rácsképként');save.type='button';head.append(el('h2','▦ '+title),save,close);d.append(head);
  const st=document.createElement('style');st.textContent=`.gridDialog{width:96vw;max-width:96vw;height:92vh;max-height:92vh;display:flex;flex-direction:column}
.gridDialog .gTabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.gridDialog .gTabs button.sel{border-color:var(--gold,#f2c584);color:var(--gold,#f2c584)}
.gridDialog .gWrap{overflow:auto;flex:1}.gridDialog table{border-collapse:separate;border-spacing:6px}.gridDialog th{font-size:12px;color:#a8beca;font-weight:600;text-align:left;vertical-align:middle;max-width:180px}
.gridDialog td{vertical-align:top}.gridDialog .gCell{position:relative;width:190px}.gridDialog .gCell img{width:190px;height:190px;object-fit:contain;background:#0a161c;border-radius:7px;cursor:zoom-in;display:block}
.gridDialog .gCell small{display:block;font-size:11px;color:#9fb6c1;margin-top:2px}.gridDialog .gStar{position:absolute;top:4px;right:4px;min-height:26px;padding:0 7px;background:#000a}
.gridDialog .gEmpty{width:190px;height:190px;border:1px dashed #2c4550;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#5f7884;font-size:12px}
.gridDialog .gTools{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:2px 0 6px}.gridDialog .gTools label{display:inline-flex!important;flex-direction:row!important;align-items:center;gap:6px;margin:0;font-size:13px}.gridDialog .gTools input[type=checkbox]{width:auto;margin:0}.gridDialog .gTools select{min-height:30px;width:auto}.gridDialog .gRate{position:absolute;top:4px;left:4px;min-height:26px;max-width:92px;padding:0 4px;font-size:12px;background:#000c;color:#f2c584;border-radius:6px}
.gridDialog .gLoaded{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gridDialog .gLoaded p{margin:0}.gridDialog .gLoaded button{min-height:28px;font-size:13px}
.gridDialog .gEmpty.hiddenByFilter{border-style:dotted;opacity:.45}
.gridZoom{position:fixed;inset:0;z-index:300;background:#050c11f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.gridZoom img{max-width:94vw;max-height:84vh;object-fit:contain}.gridZoom p{color:#cfe0e8;margin:0}`;
  d.append(st);
  const tools=el('div',null,'gTools'),fsel=el('select'),fl=el('label',null,'gFilter'),optL=el('label',null,'check'),opt=el('input');for(const [v,t] of FILTERS)fsel.add(new Option(t,v));fsel.title='Szűrés értékelés szerint – a gyengébbek eltűnnek, a jók egymás mellett maradnak';fl.append(el('span','Mutasd:'),' ',fsel);
  opt.type='checkbox';opt.checked=false;optL.title='A rácsképre a csillag és az értékelés is rákerül';optL.append(opt,' ',el('span','Értékelés a rácsképen'));tools.append(fl,optL);let filter='all';fsel.onchange=()=>{filter=fsel.value;draw();};
  const tabBar=el('div',null,'gTabs'),wrap=el('div',null,'gWrap');const info=el('p',null,'muted'),more=el('button');more.type='button';const loadedRow=el('div',null,'gLoaded');loadedRow.append(info,more);
  function drawInfo(){info.replaceChildren();if(total>items.length){info.append(el('span',`${items.length} / ${total} elem látszik – a legújabbak.`),' ',el('span','Szűkítsd az Előzményekben (dátum, projekt), vagy tölts be többet.'));more.hidden=items.length>=MAX;more.textContent=`További ${Math.min(STEP,total-items.length,MAX-items.length)} betöltése`;}else{info.append(el('span',`${items.length} elem`));more.hidden=true;}}
  more.onclick=async()=>{more.disabled=true;try{await load();tabs=arrangeGrid(items);if(current>=tabs.length)current=0;drawInfo();draw();}catch(err){notify(err.message,true);}finally{more.disabled=false;}};
  d.append(loadedRow,el('p','Sorok: modellek · oszlopok: seedek · kattints a képre a nagy nézethez (nyilakkal lapozhatsz) · ☆ = kedvenc','muted'),el('p','Nagy nézetben: 1–5 = értékelés · 0 = törlés · F = csillag','muted'),tools,tabBar,wrap);
  let current=0;
  const controls=new Map();// id → {star, rate}: a nagy nézetben adott értékelés a cellán is látszik
  async function setFavorite(e,value){await request('history/annotate',{id:e.id,favorite:value});e.favorite=value;const c=controls.get(e.id);if(c)c.star.textContent=value?'★':'☆';}
  async function setRating(e,value){await request('history/annotate',{id:e.id,rating:value||null});e.rating=value||null;const c=controls.get(e.id);if(c)c.rate.value=value?String(value):'';}
  function cell(e,hidden){if(!e)return el('div',hidden?'':'—','gEmpty'+(hidden?' hiddenByFilter':''));const c=el('div',null,'gCell'),img=el('img');img.loading='lazy';img.src=e.url;img.alt='';img.onclick=()=>zoom(e);
    const star=el('button',e.favorite?'★':'☆','gStar');star.type='button';star.title='Kedvenc';star.onclick=async ev=>{ev.stopPropagation();try{await setFavorite(e,!e.favorite);if(filter!=='all')draw();}catch(err){notify(err.message,true);}};
    const rate=el('select',null,'gRate');rate.title='Értékelés';rate.setAttribute('aria-label','Értékelés · '+(e.filename||''));rate.add(new Option('Még nincs',''));for(let i=1;i<=5;i++)rate.add(new Option(i+' / 5',String(i)));rate.value=e.rating?String(e.rating):'';rate.onclick=ev=>ev.stopPropagation();
    rate.onchange=async()=>{try{await setRating(e,rate.value?Number(rate.value):null);if(filter!=='all')draw();}catch(err){notify(err.message,true);rate.value=e.rating?String(e.rating):'';}};
    controls.set(e.id,{star,rate});c.append(img,rate,star,el('small',[e.seed!=null?'seed '+e.seed:'',e.width&&e.height?e.width+' × '+e.height:''].filter(Boolean).join(' · ')));return c;}
  function draw(){
    tabBar.replaceChildren();tabs.forEach((t,i)=>{const b=el('button',`${t.label} (${t.count})`);b.type='button';if(i===current)b.className='sel';b.onclick=()=>{current=i;draw();};tabBar.append(b);});tabBar.hidden=tabs.length<2;
    if(!tabs.length){wrap.replaceChildren(el('p','A betöltött elemek között még nincs kép (csak videó). Tölts be többet, vagy szűkítsd az Előzményekben.','muted'));return;}
    const full=tabs[current],t=filterTab(full,filter),table=el('table');controls.clear();
    if(!t.rows.length){wrap.replaceChildren(el('p','Ezzel a szűréssel nincs látható kép. Válaszd a „Mind” lehetőséget.','muted'));return;}
    if(t.structured){const hr=el('tr');hr.append(el('th','Modell / seed'));for(const s of t.seeds)hr.append(el('th',String(s)));table.append(hr);}
    for(const r of t.rows){const tr=el('tr');tr.append(el('th',r.model));const orig=full.rows.find(x=>x.model===r.model);for(const [i,e] of r.cells.entries()){const td=el('td');td.append(cell(e,!e&&!!orig?.cells[i]));tr.append(td);}table.append(tr);}
    wrap.replaceChildren(table);
  }
  function zoom(e){const t=filterTab(tabs[current],filter),grid=t.rows.map(r=>r.cells);let ri=t.rows.findIndex(r=>r.cells.includes(e)),ci=grid[ri].indexOf(e);
    const z=el('div',null,'gridZoom'),img=el('img'),cap=el('p'),hint=el('p','← → seedek · ↑ ↓ modellek · Esc bezárás','muted');z.append(img,cap,hint);
    const show=()=>{const x=grid[ri]?.[ci];if(!x)return;img.src=x.url;cap.textContent=`${x.favorite?'★ ':''}${x.rating?x.rating+'/5 · ':''}${t.rows[ri].model}${x.seed!=null?' · seed '+x.seed:''}${x.width?' · '+x.width+' × '+x.height:''}`;};
    const move=(dr,dc)=>{let r=ri,c=ci;for(let k=0;k<50;k++){r+=dr;c+=dc;if(r<0||r>=grid.length||c<0||c>=(grid[r]?.length||0))return;if(grid[r][c]){ri=r;ci=c;show();return;}if(!dr&&!dc)return;}};
    const key=ev=>{const x=grid[ri]?.[ci],n=ratingKey(ev.key);if(x&&n!==null&&!ev.ctrlKey&&!ev.altKey&&!ev.metaKey){ev.preventDefault();setRating(x,n).then(show).catch(err=>notify(err.message,true));return;}if(x&&(ev.key==='f'||ev.key==='F')&&!ev.ctrlKey&&!ev.metaKey){ev.preventDefault();setFavorite(x,!x.favorite).then(show).catch(err=>notify(err.message,true));return;}if(ev.key==='Escape'){ev.preventDefault();done();}else if(ev.key==='ArrowRight')move(0,1);else if(ev.key==='ArrowLeft')move(0,-1);else if(ev.key==='ArrowDown')move(1,0);else if(ev.key==='ArrowUp')move(-1,0);};
    const done=()=>{z.remove();document.removeEventListener('keydown',key,true);if(filter!=='all')draw();};z.onclick=done;document.addEventListener('keydown',key,true);d.append(z);show();}
  save.onclick=async()=>{save.disabled=true;try{const t=filterTab(tabs[current],filter);if(!t.rows.length)throw Error('Ezzel a szűréssel nincs látható kép.');await saveSheet(t,title,{marks:opt.checked});}catch(err){notify(err.message,true);}finally{save.disabled=false;}};
  d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();drawInfo();draw();
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
