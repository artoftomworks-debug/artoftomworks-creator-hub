// 0.16 DEV — Rendezett fejléc (felület-átnézés, 3. pont).
// A fejlécben csak a mindennapi dolgok maradnak: Keresés, Modellek online, Munkamenet mentése/betöltése, Támogatás és egy ⚙ menü.
// A ⚙ alá kerül: ComfyUI megnyitása, Szerver, Frissítések, Betűméret, Nyelv. A fülsoron is meglévő hivatkozások (Készlettár, Előzmények, Műhely)
// a fejlécből eltűnnek (az elemek megmaradnak, csak rejtve – más modulok továbbra is elérik őket).
// Az elemeket más modulok különböző időpontokban teszik a fejlécbe, ezért figyeljük a fejlécet, és ami megjelenik, a helyére tesszük.
const css=`.hubGear{position:relative;display:inline-flex}
.hubGear>button{white-space:nowrap}.hubGear>button.hasUpdates::after{content:'';display:inline-block;width:8px;height:8px;margin-left:6px;border-radius:50%;background:#f2c584;vertical-align:middle}
.hubGearPanel{position:absolute;right:0;top:calc(100% + 6px);z-index:80;min-width:290px;padding:12px;display:flex;flex-direction:column;gap:9px;background:#10232d;border:1px solid var(--gold,#f2c584);border-radius:11px;box-shadow:0 10px 30px #000c}
.hubGearPanel[hidden]{display:none!important}.hubGearPanel>button,.hubGearPanel>a{text-align:left;width:100%;margin:0}.hubGearPanel .hgLabel{font-size:12px;color:#a8beca;margin:4px 0 -4px}
.hubGearPanel .uiScale{align-self:flex-start;margin:0!important}.hubGearPanel .hubLanguage{display:flex;align-items:center;gap:6px}`;
const MOVE=[['studioComfyButton','A ComfyUI saját felülete (új lapon)'],['studioServerButton','Szerver és ComfyUI állapota, napló'],['softwareUpdates','Hub- és node-frissítések'],['uiScale','Betűméret'],['hubLanguage','Nyelv']];
export function installHeaderMenu(){
  const nav=document.querySelector('body>header nav');if(!nav||nav.querySelector('.hubGear'))return null;
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  const box=document.createElement('span');box.className='hubGear';const btn=document.createElement('button');btn.type='button';btn.id='hubGearButton';btn.textContent='⚙ Beállítások';btn.title='ComfyUI, szerver, frissítések, betűméret, nyelv';btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='hubGearPanel';panel.hidden=true;box.append(btn,panel);
  const open=v=>{panel.hidden=!v;btn.setAttribute('aria-expanded',String(v));};
  btn.onclick=e=>{e.stopPropagation();open(panel.hidden);};panel.onclick=e=>{e.stopPropagation();if(e.target.closest('button:not(#uiScaleDown):not(#uiScaleUp):not(#uiScaleValue),a'))open(false);};
  document.addEventListener('click',()=>open(false));document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false);});
  const label=t=>{const p=document.createElement('p');p.className='hgLabel';p.textContent=t;return p;};
  function tidy(){
    for(const [id,text] of MOVE){let e=document.getElementById(id);if(id==='hubLanguage')e=e?.closest('.hubLanguage');if(!e||panel.contains(e))continue;
      if(id==='uiScale'||id==='hubLanguage')panel.append(label(text));e.title||=text;panel.append(e);}
    /* 0.16 DEV: értesítés, ha kész – kapcsoló */
    if(!panel.querySelector('.notifyDone')){const l=document.createElement('label');l.className='check notifyDone';const c=document.createElement('input');c.type='checkbox';const read=()=>{try{return localStorage.getItem('creatorHub.notifyDone')!=='off';}catch{return true;}};c.checked=read();c.onchange=()=>{try{if(c.checked){localStorage.removeItem('creatorHub.notifyDone');if('Notification' in window&&Notification.permission==='default')void Notification.requestPermission().catch(()=>{});}else localStorage.setItem('creatorHub.notifyDone','off');}catch{}};l.onclick=e=>e.stopPropagation();btn.addEventListener('click',()=>{c.checked=read();});const t=document.createElement('span');t.textContent='Értesítés, ha egy generálás elkészül';l.title='Windows-értesítés és ✓ a lap címében, ha a Hub nincs előtérben. A böngésző egyszer engedélyt kér.';l.append(c,t);panel.append(l);}
    /* 0.16 DEV: reggeli válogatás – kapcsoló */
    if(!panel.querySelector('.morningPick')){const l=document.createElement('label');l.className='check morningPick';const c=document.createElement('input');c.type='checkbox';const read=()=>{try{return localStorage.getItem('creatorHub.morningPick')!=='off';}catch{return true;}};c.checked=read();c.onchange=()=>{try{if(c.checked)localStorage.removeItem('creatorHub.morningPick');else localStorage.setItem('creatorHub.morningPick','off');}catch{}};l.onclick=e=>e.stopPropagation();btn.addEventListener('click',()=>{c.checked=read();});const t=document.createElement('span');t.textContent='Reggeli válogatás (ha sok új kép készült, amíg távol voltál)';l.append(c,t);panel.append(l);}
    /* 0.16 DEV: ✨ Első kép varázsló – bármikor újra elindítható */
    if(!panel.querySelector('.firstImageEntry')){const b=document.createElement('button');b.type='button';b.className='firstImageEntry';b.textContent='✨ Első kép varázsló';b.title='Egy kattintásos első kép a saját gépeden – kezdőknek, vagy egy gyors próbához';b.onclick=()=>dispatchEvent(new Event('creatorhub:first-image'));panel.append(b);}
    /* 0.16 DEV: „Több videó indítása előtt kérdezzen” – a felugró kérdés „Ne kérdezze többet” pipája itt kapcsolható vissza. */
    if(!panel.querySelector('.askVideoCount')){const l=document.createElement('label');l.className='check askVideoCount';const c=document.createElement('input');c.type='checkbox';try{c.checked=localStorage.getItem('creatorHub.askVideoCount')!=='off';}catch{c.checked=true;}c.onchange=()=>{try{if(c.checked)localStorage.removeItem('creatorHub.askVideoCount');else localStorage.setItem('creatorHub.askVideoCount','off');}catch{}};l.onclick=e=>e.stopPropagation();btn.addEventListener('click',()=>{try{c.checked=localStorage.getItem('creatorHub.askVideoCount')!=='off';}catch{}});const t=document.createElement('span');t.textContent='Több videó indítása előtt kérdezzen';l.append(c,t);panel.append(l);}
    if(!panel.querySelector('.askStartImage')){const l=document.createElement('label');l.className='check askStartImage';const c=document.createElement('input');c.type='checkbox';try{c.checked=localStorage.getItem('creatorHub.askStartImage')!=='off';}catch{c.checked=true;}c.onchange=()=>{try{if(c.checked)localStorage.removeItem('creatorHub.askStartImage');else localStorage.setItem('creatorHub.askStartImage','off');}catch{}};l.onclick=e=>e.stopPropagation();btn.addEventListener('click',()=>{try{c.checked=localStorage.getItem('creatorHub.askStartImage')!=='off';}catch{}});const t=document.createElement('span');t.textContent='Kérdezzen, ha régi kezdőkép maradt bent';l.append(c,t);panel.append(l);}
    // Ami a fülsoron is megvan, a fejlécből rejtve marad.
    for(const sel of ['#openLibrary','header a[href="#history"]','header a[href="#tools"]','header a[href="#workspace"]','header a[href="#monitor"]']){const a=nav.querySelector(sel);if(a&&!a.hidden)a.hidden=true;}
    const save=document.getElementById('saveProject'),load=document.getElementById('loadProject');
    if(save&&save.dataset.renamed!=='1'){save.textContent='Munkamenet mentése';save.title='A teljes munkamenet (promptok, beállítások, kiválasztások) mentése fájlba. A ComfyUI-ba betölthető workflow-t az Előzmények képeinél, a „💾 Mentés” menüben találod.';save.dataset.renamed='1';}
    if(load&&load.dataset.renamed!=='1'){load.textContent='Munkamenet betöltése';load.title='Korábban mentett munkamenet betöltése.';load.dataset.renamed='1';}
    const sup=nav.querySelector('a.support');if(sup&&sup.dataset.renamed!=='1'){sup.textContent='☕ Támogatás';sup.title='Támogasd a fejlesztést (Ko-fi, új lapon)';sup.dataset.renamed='1';}
    btn.classList.toggle('hasUpdates',!!document.getElementById('softwareUpdates')?.classList.contains('hasUpdates'));
    if(!nav.contains(box)){const anchor=save||null;anchor?nav.insertBefore(box,anchor):nav.append(box);}
  }
  tidy();const mo=new MutationObserver(()=>{mo.disconnect();try{tidy();}finally{mo.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}});
  mo.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  return {tidy,open};
}
