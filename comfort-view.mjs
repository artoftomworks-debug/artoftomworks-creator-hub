// 0.16 DEV — Kényelmes nézet: one-click UI text size (A− / % / A+) in the header.
// Scales the whole Hub page (text, buttons, spacing together) with CSS zoom, so the layout stays
// proportional. The choice is remembered in this browser; "100%" restores the original look.
const KEY='creatorHub.uiScale',LEVELS=[1,1.1,1.2,1.3,1.45],DEFAULT=1.1;
const read=()=>{try{const v=Number(localStorage.getItem(KEY));return LEVELS.includes(v)?v:DEFAULT;}catch{return DEFAULT;}};
const write=v=>{try{localStorage.setItem(KEY,String(v));}catch{}};
let scale=read();
// CSS zoom also enlarges viewport units (100vh, 100dvh…), so full-screen panes would overflow the window
// and hide their bottom bar (e.g. the image viewer's action row). These rules divide them back by the zoom.
const FIT=`:root{--uiz:1}
.studioLayout{height:calc(100dvh / var(--uiz))!important}
.studioLayout main{height:calc((100dvh - var(--hub-header-height,66px)) / var(--uiz))!important}
.studioLayout .toolDock{max-height:calc((100dvh - var(--hub-header-height,66px)) / var(--uiz) - 280px)!important}
#historyDialog.quickViewer{width:calc(100vw / var(--uiz))!important;height:calc(100dvh / var(--uiz))!important}
#viewerMetadata{max-height:min(calc(27dvh / var(--uiz)),220px)!important}
.previewImportPanel{max-height:calc(34dvh / var(--uiz))!important}
.assetCardMenu{max-width:calc(100vw / var(--uiz) - 16px)!important;max-height:calc(100dvh / var(--uiz) - 16px)!important}
.generationMenu{width:min(390px,calc(100vw / var(--uiz) - 16px))!important;max-height:calc(100dvh / var(--uiz) - 24px)!important}`;
function fit(){let st=document.getElementById('uiScaleFit');if(scale===1){st?.remove();return;}if(!st){st=document.createElement('style');st.id='uiScaleFit';st.textContent=FIT;(document.head||document.documentElement).append(st);}document.documentElement.style.setProperty('--uiz',String(scale));}
function apply(){document.documentElement.style.zoom=scale===1?'':String(scale);fit();if(scale===1)document.documentElement.style.removeProperty('--uiz');const label=document.getElementById('uiScaleValue');if(label)label.textContent=Math.round(scale*100)+'%';
 const minus=document.getElementById('uiScaleDown'),plus=document.getElementById('uiScaleUp');if(minus)minus.disabled=scale===LEVELS[0];if(plus)plus.disabled=scale===LEVELS.at(-1);}
function step(d){const i=Math.max(0,Math.min(LEVELS.length-1,LEVELS.indexOf(scale)+d));scale=LEVELS[i];write(scale);apply();}
function mount(){
 if(document.getElementById('uiScale'))return;const nav=document.querySelector('header nav');if(!nav)return;
 const box=document.createElement('span');box.id='uiScale';box.className='uiScale';box.setAttribute('role','group');box.setAttribute('aria-label','Betűméret');
 box.style.cssText='display:inline-flex;align-items:center;gap:2px;margin:0 4px;padding:2px;border:1px solid rgba(255,255,255,.18);border-radius:8px;white-space:nowrap';
 const b=(id,text,title,fn)=>{const x=document.createElement('button');x.id=id;x.type='button';x.textContent=text;x.title=title;x.setAttribute('aria-label',title);x.style.cssText='min-width:30px;padding:3px 7px;font-weight:700';x.onclick=fn;return x;};
 const value=document.createElement('button');value.id='uiScaleValue';value.type='button';value.title='Betűméret · kattintásra vissza 100%-ra';value.style.cssText='min-width:52px;padding:3px 6px;background:transparent;border:0;font-variant-numeric:tabular-nums;cursor:pointer';value.onclick=()=>{scale=1;write(scale);apply();};
 box.append(b('uiScaleDown','A−','Kisebb betűk',()=>step(-1)),value,b('uiScaleUp','A+','Nagyobb betűk',()=>step(1)));
 const anchor=nav.querySelector('#saveProject');anchor?nav.insertBefore(box,anchor):nav.append(box);apply();
}
apply();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
// Other modules may rebuild the header later; put the control back if it disappears.
setInterval(mount,2000);
