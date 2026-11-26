import {markNew} from './new-feature-ui.mjs';
// 0.16 DEV — „✦ Ellenőrzés” gomb a generálás sávjában: indítás előtt jelzi, ami biztosan nem stimmel, javítás gombbal.
import {checkablePlan,preflight} from './preflight.mjs';

const sizes=new Map();
export async function imageSize(src){
  if(!src)return null;const key=src.length>200?src.slice(0,80)+src.length+src.slice(-80):src;
  if(sizes.has(key))return sizes.get(key);
  const img=new Image();img.src=src;try{await img.decode();}catch{return null;}
  const v={width:img.naturalWidth,height:img.naturalHeight};sizes.set(key,v);if(sizes.size>20)sizes.delete(sizes.keys().next().value);return v;
}
const sp=t=>{const e=document.createElement('span');e.textContent=t;return e;};
export function createPreflightUI({$,current,mode,model,isBusy=()=>false,stepSource,onStepAdvice,onPlanAdvice}){
  const anchor=$('message');if(!anchor)return {refresh(){}};
  const box=document.createElement('span');box.className='preflight';
  const btn=document.createElement('button');btn.type='button';btn.className='preflightButton';btn.title='Indítás előtti ellenőrzés: méret, tájolás, lépésszám, hossz';
  const panel=document.createElement('div');panel.className='preflightPanel';panel.hidden=true;
  box.append(btn,panel);anchor.before(box);
  const st=document.createElement('style');st.textContent=`.preflight{position:relative;flex:none}.preflightButton{white-space:nowrap}.preflightButton.warn{border-color:#e9a25c;color:#ffcf9a}.preflightButton.ok{opacity:.75}
.preflightPanel{position:fixed;z-index:65;width:min(460px,90vw);max-height:60vh;overflow:auto;padding:10px;background:#10232d;border:1px solid var(--gold,#f2c584);border-radius:11px;box-shadow:0 10px 30px #000c;display:flex;flex-direction:column;gap:8px;font-size:13px}
.preflightPanel[hidden]{display:none!important}.preflightItem{border-left:3px solid #6f8b96;padding:4px 8px;line-height:1.4}.preflightItem.warn{border-color:#e9a25c}.preflightItem button{margin-top:5px;min-height:28px;font-size:12px}`;
  document.head.append(st);
  let items=[],sig='';
  // Self-heal switch (server setting) – on: memory errors are retried automatically; off: exactly the user's settings.
  const healBox=document.createElement('div');healBox.className='preflightItem';healBox.style.borderColor='#5c9ee9';
  const post=async(body={})=>{const r=await fetch('/api/self-heal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j;};
  async function healRender(){
    let st;try{st=await post();}catch{healBox.textContent='Önjavítás: a beállítás most nem olvasható.';return;}
    const label=document.createElement('label');label.className='check';label.style.cssText='margin:0;font-size:13px;font-weight:600';const cb=document.createElement('input');cb.type='checkbox';cb.checked=st.mode!=='off';
    label.append(cb,document.createTextNode(' Önjavítás memóriahiánynál'));
    const help=document.createElement('div');help.className='muted';help.style.fontSize='12px';
    help.textContent=cb.checked?'Ha elfogy a memória, a Hub magától felszabadítja, és újrapróbálja; ha kell, kisebb csempékkel dekódol. A promptot, a méretet, a hosszt, a seedet és a lépésszámot sosem változtatja.':'Kikapcsolva: a Hub pontosan a beállított értékekkel dolgozik, és hiba esetén megáll.';
    cb.onchange=async()=>{cb.disabled=true;try{await post({mode:cb.checked?'auto':'off'});}catch{}await healRender();};
    healBox.replaceChildren(label,help);
    for(const h of (st.recent||[]).slice(-3).reverse()){const p=document.createElement('div');p.style.fontSize='12px';p.append('↻ '+new Date(h.at).toLocaleTimeString()+' · ',sp(h.note));healBox.append(p);}
  }
  function place(){const z=parseFloat(getComputedStyle(document.documentElement).zoom)||1,/* 0.16 DEV: kompakt elrendezésben a gomb rejtett – a „Továbbiak” gombhoz igazodunk */r0=btn.getBoundingClientRect(),r=r0.width?r0:(document.getElementById('generationMenuTrigger')?.getBoundingClientRect()||r0),h=panel.offsetHeight*z,w=panel.offsetWidth*z;
    panel.style.left=Math.max(6,Math.min(r.left,innerWidth-w-6))/z+'px';panel.style.top=((r.top>h+10?r.top-h-6:r.bottom+6))/z+'px';}
  function set(key,value){const el=$(key);if(!el)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  function drawPanel(){
    panel.replaceChildren();
    const head=document.createElement('strong');head.textContent=items.length?'✦ Ellenőrzés':'✦ Ellenőrzés ✓';panel.append(head);
    if(!items.length){const p=document.createElement('p');p.className='muted';p.style.margin='0';p.textContent='A méret, a tájolás, a lépésszám és a hossz illik a modellhez és a kezdőképhez.';panel.append(p);}
    for(const it of items){const d=document.createElement('div');d.className='preflightItem '+it.level;d.append(it.level==='warn'?'⚠ ':'ℹ ',sp(it.text));
      if(it.fix){const b=document.createElement('button');b.type='button';b.append(sp('Javítás:'),' ',sp(it.fix.label));b.onclick=()=>{if(isBusy())return;for(const [k,v] of Object.entries(it.fix.patch))set(k,v);setTimeout(()=>{void refresh(true);},250);};d.append(document.createElement('br'),b);}
      panel.append(d);}
    const c=current();
    if(mode()==='video'&&onStepAdvice&&c.automatic&&c.info?.samplingFields?.some(field=>field.control==='steps')){
      const row=document.createElement('div');
      const steps=c.controls?.sampling?.steps;
      const source=stepSource?.();
      row.append(sp('Lépésszám'),' · '+steps,' · ',sp(source||''));
      const ai=document.createElement('button');ai.type='button';ai.textContent='✦ Videós lépésszám ajánlása';
      ai.onclick=()=>{if(isBusy())return;panel.hidden=true;onStepAdvice();};
      row.append(document.createElement('br'),markNew(ai,"video-steps"));panel.append(row);
    }
    if(onPlanAdvice){
      const advisory=document.createElement('button');advisory.type='button';advisory.textContent='✦ Terv átnézése MI-vel';
      advisory.onclick=()=>{if(!isBusy()){panel.hidden=true;onPlanAdvice();}};
      panel.append(markNew(advisory,"single-plan"));
    }
    panel.append(healBox);void healRender();
    if(!panel.hidden)place();
  }
  async function refresh(force=false){
    const c=current(),m=model?.()||null;
    const useImage=c.useImage!==false&&!!c.image,img=useImage?await imageSize(c.image):null;
    const sampling={...c.controls?.sampling,steps:c.controls?.sampling?.steps??$('steps')?.value};
    const plan=checkablePlan({mode:mode(),width:c.width,height:c.height,duration:c.duration,prompt:c.prompt||'',sampling,image:img,model:m});
    const s=JSON.stringify(plan);if(!force&&s===sig)return;sig=s;items=preflight(plan);
    const warn=items.filter(i=>i.level==='warn').length;
    btn.textContent=items.length?`✦ Ellenőrzés · ${warn?'⚠ '+warn:''}${warn&&items.length>warn?' · ':''}${items.length>warn?'ℹ '+(items.length-warn):''}`:'✦ Ellenőrzés ✓';
    btn.className='preflightButton '+(warn?'warn':items.length?'':'ok');drawPanel();
  }
  btn.onclick=ev=>{ev.stopPropagation();panel.hidden=!panel.hidden;if(!panel.hidden){drawPanel();place();}};
  panel.onclick=ev=>ev.stopPropagation();
  document.addEventListener('click',()=>{panel.hidden=true;});document.addEventListener('keydown',ev=>{if(ev.key==='Escape')panel.hidden=true;});
  setInterval(()=>void refresh(),1200);void refresh(true);
  return {refresh};
}
