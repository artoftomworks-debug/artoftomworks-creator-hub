// 0.16 DEV — 🎨 Témák: néhány beépített színvilág, saját kiemelőszín, háttérkép a gépről vagy webcímről
// (elmosás, sötétítés), kontrasztellenőrzés, export/import. Az előnézet és a képnézegető semleges sötét marad,
// hogy a színek megítélését a háttér ne torzítsa. Csak a böngészőben tárolódik (localStorage).
const KEY='creatorHub.theme';
export const PRESETS=[
 {id:'default',name:'Éjkék (alap)',vars:{}},
 {id:'graphite',name:'Grafit',vars:{bg:'#111315',panel:'#1d2023',line:'#3d4248',text:'#e9ecef',muted:'#a9b0b7',gold:'#e8c27a'}},
 {id:'forest',name:'Mélyerdő',vars:{bg:'#0a140f',panel:'#14251c',line:'#335343',text:'#e6efe9',muted:'#a4bdb0',gold:'#d8c27c'}},
 {id:'plum',name:'Szilva éj',vars:{bg:'#130b16',panel:'#231628',line:'#4b3352',text:'#efe7f1',muted:'#bba8c2',gold:'#f0a9cb'}},
 {id:'ocean',name:'Óceán',vars:{bg:'#06121c',panel:'#0f2333',line:'#2d4e66',text:'#e5f0f7',muted:'#9fbdd0',gold:'#7fd3e6'}},
 {id:'ember',name:'Parázs',vars:{bg:'#140d0a',panel:'#251912',line:'#55392a',text:'#f3ebe6',muted:'#c4ad9f',gold:'#ff9e5e'}}];
const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():null;
function lum(h){const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
export function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
export function cleanTheme(t={}){const p=PRESETS.find(x=>x.id===t.preset)?.id||'default';const bgImage=typeof t.bgImage==='string'&&(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(t.bgImage)||/^https:\/\/[^\s"'()\\]{4,2000}$/.test(t.bgImage))&&t.bgImage.length<=4*1024**2?t.bgImage:'';
 const n=(v,lo,hi,d)=>{const x=Number(v);return Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):d;};return {preset:p,accent:hex(t.accent)||'',bgImage,blur:n(t.blur,0,30,6),dim:n(t.dim,0,95,55)};}
export function themeVars(t){const base={bg:'#091219',panel:'#132630',line:'#385361',text:'#e7eef2',muted:'#a8beca',gold:'#f2c584'};const v={...base,...(PRESETS.find(x=>x.id===t.preset)?.vars||{})};if(t.accent)v.gold=t.accent;return v;}
export function themeWarnings(t){const v=themeVars(t),w=[];if(contrast(v.text,v.panel)<4.5)w.push('A szöveg túl halvány a paneleken.');if(contrast(v.gold,v.bg)<3)w.push('A kiemelőszín alig látszik a háttéren – válassz világosabbat vagy élénkebbet.');if(contrast(v.gold,'#15232c')<4.5)w.push('A kiemelt gombok felirata nehezen olvasható ezzel a kiemelőszínnel.');return w;}
const read=()=>{try{return cleanTheme(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{return cleanTheme();}};
function apply(t){const v=themeVars(t),r=document.documentElement.style;for(const [k,val] of Object.entries(v))r.setProperty('--'+k,val);
 let st=document.getElementById('themeStyle');if(!st){st=document.createElement('style');st.id='themeStyle';document.head.append(st);}
 const img=t.bgImage?`url("${t.bgImage.replace(/"/g,'%22')}")`:'';
 st.textContent=(t.preset!=='default'?`body{background:radial-gradient(ellipse at 75% 0,${v.panel},transparent 50%),var(--bg)!important}header{background:${v.bg}f2!important}`:'')+
  (img?`body::before{content:'';position:fixed;inset:-40px;z-index:-1;background:${img} center/cover no-repeat;filter:blur(${t.blur}px)}body::after{content:'';position:fixed;inset:0;z-index:-1;background:${v.bg};opacity:${t.dim/100};pointer-events:none}body{background:transparent!important}.panel,.connection{background:color-mix(in srgb,var(--panel) 80%,transparent)!important;backdrop-filter:blur(6px)}`:'')+
  /* az alkotás előnézete és a nézegető semleges marad */(img||t.preset!=='default'?'#stage{background-color:#0b0d0f}':'');}
const css=`.themeDialog{width:min(620px,94vw);padding:0;border:1px solid var(--gold);border-radius:12px;background:var(--panel);color:var(--text)}.themeDialog::backdrop{background:#000a}
.themeDialog .thBody{display:flex;flex-direction:column;gap:12px;padding:14px 16px}.themeDialog h2{margin:0;font-size:18px}.themeDialog button{width:auto;margin:0;min-height:32px;padding:4px 10px;font-size:13px}
.thGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.thCard{display:flex;flex-direction:column;gap:6px;align-items:stretch;text-align:left}.thCard.on{outline:2px solid var(--gold)}
.thSw{display:flex;height:26px;border-radius:6px;overflow:hidden}.thSw i{flex:1}.thRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px}.thRow input[type=range]{flex:1;min-width:140px}
.themeDialog input[type=color]{width:56px;height:32px;padding:2px;margin:0}.thWarn{color:#f2c584;font-size:13px}.thNote{font-size:12px;color:var(--muted)}.themeDialog [hidden]{display:none!important}`;
function el(tag,props={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...kids.filter(k=>k!=null));return e;}
async function shrink(src,max=1920){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('A kép nem olvasható.'));i.src=src;});const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8);}
export function createThemes({notify=()=>{},translate=t=>t}={}){
 let theme=read();apply(theme);if(document.getElementById('themeDialog'))return null;document.head.append(el('style',{textContent:css}));
 const save=t=>{theme=cleanTheme(t);apply(theme);try{localStorage.setItem(KEY,JSON.stringify(theme));}catch{notify('A téma nem menthető (túl nagy a háttérkép a böngésző tárhelyéhez). Válassz kisebb képet.',true);}draw();};
 const grid=el('div',{class:'thGrid'}),warn=el('div',{class:'thWarn',role:'status'});
 const accent=el('input',{type:'color'}),accentOn=el('input',{type:'checkbox'}),blur=el('input',{type:'range',min:0,max:30,step:1}),dim=el('input',{type:'range',min:0,max:95,step:5});
 const fileIn=el('input',{type:'file',accept:'image/png,image/jpeg,image/webp',hidden:true}),url=el('input',{type:'url',placeholder:'https://… (kép webcíme)',style:'flex:1;min-width:200px'});
 const pick=el('button',{type:'button',textContent:'🖼 Kép a gépemről…'}),fromUrl=el('button',{type:'button',textContent:'Webcím használata'}),noImg=el('button',{type:'button',textContent:'✕ Háttérkép nélkül'});
 const exp=el('button',{type:'button',textContent:'⤓ Exportálás'}),imp=el('button',{type:'button',textContent:'⤒ Importálás…'}),impIn=el('input',{type:'file',accept:'application/json,.json',hidden:true}),reset=el('button',{type:'button',textContent:'Alaphelyzet'}),close=el('button',{type:'button',class:'primary',textContent:'Kész'});
 const imgRows=el('div',{},el('div',{class:'thRow'},el('span',{textContent:'Elmosás'}),blur),el('div',{class:'thRow'},el('span',{textContent:'Sötétítés'}),dim));
 const dialog=el('dialog',{id:'themeDialog',class:'themeDialog'},el('div',{class:'thBody'},el('h2',{textContent:'🎨 Téma'}),grid,
  el('div',{class:'thRow'},el('label',{class:'thRow'},accentOn,el('span',{textContent:'Saját kiemelőszín'})),accent),
  el('div',{class:'thNote',textContent:'Háttérkép: a saját képed, egy kedvenc generálásod vagy bármilyen kép webcíme. Az alkotás előnézete és a képnézegető semleges sötét marad, hogy a színeket ne torzítsa.'}),
  el('div',{class:'thRow'},pick,fileIn,noImg),el('div',{class:'thRow'},url,fromUrl),imgRows,warn,
  el('div',{class:'thRow'},exp,imp,impIn,reset,el('span',{style:'flex:1'}),close)));
 document.body.append(dialog);
 function draw(){grid.replaceChildren();for(const p of PRESETS){const v=themeVars({preset:p.id});const b=el('button',{type:'button',class:'thCard'+(theme.preset===p.id?' on':'')},el('span',{class:'thSw'},...[v.bg,v.panel,v.line,v.gold].map(c=>el('i',{style:'background:'+c}))),el('span',{textContent:p.name}));b.onclick=()=>save({...theme,preset:p.id});grid.append(b);}
  accentOn.checked=!!theme.accent;accent.value=theme.accent||themeVars({preset:theme.preset}).gold;accent.disabled=!theme.accent;blur.value=theme.blur;dim.value=theme.dim;imgRows.hidden=!theme.bgImage;noImg.hidden=!theme.bgImage;
  const w=themeWarnings(theme);warn.textContent=w.map(x=>'⚠ '+translate(x)).join(' ');}
 accentOn.onchange=()=>save({...theme,accent:accentOn.checked?accent.value:''});accent.oninput=()=>{if(accentOn.checked)save({...theme,accent:accent.value});};
 blur.oninput=()=>save({...theme,blur:blur.value});dim.oninput=()=>save({...theme,dim:dim.value});
 pick.onclick=()=>fileIn.click();fileIn.onchange=()=>{const f=fileIn.files[0];fileIn.value='';if(!f)return;const r=new FileReader();r.onload=async()=>{try{save({...theme,bgImage:await shrink(String(r.result))});}catch(e){notify(e.message,true);}};r.readAsDataURL(f);};
 fromUrl.onclick=()=>{const u=url.value.trim();if(!/^https:\/\//.test(u))return notify('Adj meg egy https:// kezdetű képcímet.',true);const t=cleanTheme({...theme,bgImage:u});if(!t.bgImage)return notify('Ez a webcím nem használható háttérképként.',true);const i=new Image();i.onload=()=>save(t);i.onerror=()=>notify('A kép nem tölthető be erről a címről.',true);i.src=u;};
 noImg.onclick=()=>save({...theme,bgImage:''});reset.onclick=()=>save({});close.onclick=()=>dialog.close();
 exp.onclick=()=>{const a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify({schema:'artoftomworks.creator-hub.theme',...theme},null,1)],{type:'application/json'})),download:'CreatorHub_tema.json'});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);};
 imp.onclick=()=>impIn.click();impIn.onchange=async()=>{const f=impIn.files[0];impIn.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(j.schema!=='artoftomworks.creator-hub.theme')throw Error('Ez nem Creator Hub témafájl.');save(j);}catch(e){notify(e.message,true);}};
 const open=()=>{draw();if(!dialog.open)dialog.showModal();};
 addEventListener('creatorhub:theme-open',open);
 /* bejegyzés a ⚙ Beállítások menübe */const place=()=>{const panel=document.querySelector('.hubGearPanel');if(!panel||panel.querySelector('.themeEntry'))return;const b=el('button',{type:'button',class:'themeEntry',textContent:'🎨 Téma és háttér'});b.onclick=()=>{panel.hidden=true;open();};panel.append(b);};
 place();const t=setInterval(place,1000);
 return {open,apply:()=>apply(theme),destroy(){clearInterval(t);dialog.remove();}};
}
