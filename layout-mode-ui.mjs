// 0.16 DEV — Elrendezés: Automatikus / Kompakt (laptop) / Tágas (nagy monitor). A ⚙ Beállításokban választható, bármikor átváltható.
// Kompakt: vékony fejléc · egysoros gombsor (Memória, Sor, Ellenőrzés, Több modellel a „Továbbiak ▾” alatt) · az aktív modell sáv
// a gombsorba kerül · a lenti eszközpanel fiókként csúszik az Előnézetre, így az Alkotás panel teljes magasságot kap.
// Automatikus: kis képernyőn (legfeljebb 1440 px széles vagy 860 px magas ablak) kompakt, különben tágas.
const KEY='creatorHub.layout';
export const LAYOUTS=[['auto','Automatikus'],['compact','Kompakt (laptop)'],['wide','Tágas (nagy monitor)']];
export function effectiveLayout(choice,width,height){if(choice==='compact'||choice==='wide')return choice;return width<=1440||height<=860?'compact':'wide';}
const css=`body.layoutCompact>header{padding:3px 10px!important;min-height:0}body.layoutCompact>header .brand span{display:none}
body.layoutCompact>header nav{gap:6px}body.layoutCompact>header nav button,body.layoutCompact>header nav a{min-height:28px;padding:3px 9px;font-size:13px}
body.layoutCompact.studioLayout main{padding-bottom:52px}
body.layoutCompact #openResources,body.layoutCompact #openGenerationQueue,body.layoutCompact .preflightButton{display:none!important}
body.layoutCompact .generationFooter{flex-wrap:wrap;row-gap:4px}body.layoutCompact .generationFooter .dockActiveAccessories{min-height:30px;max-height:40px;margin-left:auto;padding:2px 6px}
body.layoutCompact .generationFooter .dockActiveAccessories .activeModel img,body.layoutCompact .generationFooter .dockActiveAccessories .activeModelPlaceholder{width:26px;height:26px}
body.layoutCompact .toolDock{position:fixed!important;z-index:60;left:16px;right:96px;bottom:8px;height:44px;flex:none!important;max-height:none!important;box-shadow:0 -6px 24px #000a;transition:height .18s ease}
body.layoutCompact .toolDock.roomy:not(.collapsed){left:calc(48% + 10px);right:16px;bottom:44px;height:calc((100dvh - var(--hub-header-height,48px)) / var(--uiz,1) - 60px)}
body.layoutCompact .toolDock:not(.roomy) .dockPanels{display:none!important}body.layoutCompact .toolDock .dockResize{display:none!important}
body.layoutCompact .toolDock.roomy .dockTabs{flex-wrap:wrap;row-gap:4px;overflow:visible}body.layoutCompact .toolDock .dockTabs [role=tab]{padding-left:9px;padding-right:9px}
#generationMenu .compactProxy{display:none}body.layoutCompact #generationMenu .compactProxy{display:block}
.hubGearPanel .layoutSelect{width:100%}`;
function readChoice(){try{const v=localStorage.getItem(KEY);return ['auto','compact','wide'].includes(v)?v:'auto';}catch{return 'auto';}}
export function createLayoutMode(){
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  let choice=readChoice(),current='';
  const strip=()=>document.getElementById('activeAccessories'),dock=()=>document.getElementById('toolDock'),footer=()=>document.querySelector('.generationFooter');
  function apply(){const next=effectiveLayout(choice,innerWidth,innerHeight);if(next===current)return;current=next;document.body.classList.toggle('layoutCompact',next==='compact');
    const s=strip(),d=dock(),f=footer();if(s&&d&&f){if(next==='compact'&&s.parentElement!==f)f.append(s);else if(next!=='compact'&&s.parentElement===f)d.before(s);}
    window.dispatchEvent(new Event('resize'));}
  // Proxy entries in the „Továbbiak ▾” menu for the buttons hidden in the compact footer.
  const proxies=[['openResources','#openResources'],['openGenerationQueue','#openGenerationQueue'],['preflight','.preflightButton']];/* 0.16 DEV: a „⧉ Több modellel” kompakt nézetben is látható marad (nehéz volt megtalálni a menüben) */
  function proxyMenu(){const menu=document.getElementById('generationMenu');if(!menu)return false;for(const [id,sel] of proxies){if(menu.querySelector('[data-proxy="'+id+'"]'))continue;const b=document.createElement('button');b.type='button';b.className='compactProxy';b.dataset.proxy=id;b.setAttribute('role','menuitem');b.onclick=ev=>{ev.stopPropagation();menu.hidden=true;const trig=document.getElementById('generationMenuTrigger');trig?.setAttribute('aria-expanded','false');setTimeout(()=>{document.querySelector(sel)?.click();},0);};menu.append(b);}
    document.getElementById('generationMenuTrigger')?.addEventListener('click',()=>{for(const [id,sel] of proxies){const b=menu.querySelector('[data-proxy="'+id+'"]'),src=document.querySelector(sel);if(b){b.textContent=src?.textContent?.trim()||'';b.hidden=!src;}}},true);return true;}
  function gearSelect(){const panel=document.querySelector('.hubGearPanel');if(!panel)return false;if(panel.querySelector('.layoutSelect'))return true;const p=document.createElement('p');p.className='hgLabel';p.textContent='Elrendezés';const sel=document.createElement('select');sel.className='layoutSelect';sel.id='layoutSelect';sel.title='Automatikus: kis képernyőn kompakt, nagyon tágas. Bármikor átváltható.';for(const [v,t] of LAYOUTS)sel.add(new Option(t,v));sel.value=choice;sel.onchange=()=>{choice=sel.value;try{localStorage.setItem(KEY,choice);}catch{}current='';apply();};sel.onclick=e=>e.stopPropagation();panel.prepend(p,sel);return true;}
  let tries=0;const t=setInterval(()=>{const a=proxyMenu(),b=gearSelect();if((a&&b)||++tries>40)clearInterval(t);},500);
  window.addEventListener('resize',()=>{if(choice==='auto'){const was=current;const next=effectiveLayout(choice,innerWidth,innerHeight);if(next!==was)apply();}});
  apply();return {apply,choice:()=>choice,current:()=>current};
}
