/* 0.17.1: „▶ Most fut” – generálás közben a sáv alatt az látszik, ami ténylegesen a ComfyUI-ba megy
   (a futó terv modellje és LoRA-i), nem csak a szerkesztő állapota. A futó modellhez tartozó LoRA-chipek „▶ Fut” jelet kapnak. */
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const base=n=>String(n||'').split(/[\\/]/).pop();
const short=n=>base(n).replace(/\.(safetensors|ckpt|gguf|pt|bin)$/i,'');
const fmt=v=>Number.isFinite(v)?String(Math.round(v*100)/100).replace('.',','):'';

/* tiszta függvény: status → a futó bejegyzés */
export function runningEntry(status){if(!status?.current)return null;return (status.entries||[]).find(e=>e.runId===status.current&&e.state==='running')||null;}

export function installNowRunning({anchor,strip,familyName=f=>f||'',modelFamily=()=>null,translate=t=>t,interval=2500}){
 const row=el('div',null,'nowRunning');row.hidden=true;row.setAttribute('role','status');anchor().after(row);
 let names=new Set(),timer=0,stopped=false;
 function mark(){for(const chip of strip()?.querySelectorAll('.activeLora')||[]){const on=names.has(base(chip.dataset.lora).toLowerCase());chip.classList.toggle('runningLora',on);let b=chip.querySelector('.runBadge');if(on&&!b){b=el('span','▶ Fut','runBadge');b.title=translate('Ez a LoRA most a futó képen dolgozik.');chip.querySelector('.loraToggle')?.after(b);}if(!on&&b)b.remove();}}
 async function tick(){if(stopped)return;try{{const s=await fetch('/api/generation/status',{cache:'no-store'}).then(r=>r.ok?r.json():null);const e=runningEntry(s);
   if(!e||!(e.models?.length||Array.isArray(e.loras))){row.hidden=true;names=new Set();}
   else{const model=e?.models?.[0]||e?.batch?.model||'',fam=model?modelFamily(model):null;row.replaceChildren(el('strong','▶ Most fut:'),document.createTextNode(' '+short(model)+(fam?' ('+familyName(fam)+')':'')+' · '));
    if(!e||!Array.isArray(e.loras)){/* régebbi szerver: nincs LoRA-adat – nem állítunk semmit */}else if(e.loras.length){row.append(el('span','LoRA:'),document.createTextNode(' '+e.loras.map(l=>short(l.name)+' '+fmt(l.strength)).join(' · ')));}else row.append(el('span','LoRA nélkül'));
    row.title=translate('A sáv a szerkesztett beállítást mutatja; ez a sor azt, ami a futó képen ténylegesen dolgozik.');row.hidden=false;names=new Set((e?.loras||[]).map(l=>base(l.name).toLowerCase()));}
   mark();}}catch{}timer=setTimeout(tick,document.visibilityState==='visible'?interval:interval*2);}
 const obs=new MutationObserver(()=>mark());const s=strip();if(s)obs.observe(s,{childList:true});
 void tick();
 return {stop(){stopped=true;clearTimeout(timer);obs.disconnect();},refresh:tick};
}

/* 0.17.1: ■ Mindig látható leállító sáv – generálás közben a képernyő alján, bármelyik panel van elöl.
   Ugyanazt hívja, mint a Sorozat-sáv: generation/stop {cancel:false} = a mostani kép után; {cancel:true} = azonnal (folytatható). */
export function busyState(status){const all=status?.entries||[];const running=all.find(e=>e.state==='running');const queued=all.filter(e=>e.state==='queued').length;return {active:!!running||queued>0,running:!!running,queued,title:running?.batch?.model||running?.title||''};}
export function installStopDock({translate=t=>t,notify=()=>{},interval=2500}={}){
 const T=t=>translate(t);
 const dock=el('div',null,'stopDock');dock.hidden=true;dock.setAttribute('role','region');dock.setAttribute('aria-label',T('Generálás vezérlése'));
 const label=el('span',null,'sdLabel'),after=el('button','⏸ A mostani kép után','sdAfter'),now=el('button','■ Leállítás most','sdNow');
 after.type='button';now.type='button';after.title=T('A futó kép vagy videó még elkészül és mentődik; utána a sor megáll. Folytatás: „Hiányzók folytatása”.');now.title=T('Azonnal megáll; a félkész kép folytatáskor elölről indul (ugyanazzal a seeddel).');
 dock.append(label,after,now);/* a fejlécbe illeszkedik (nem takar ki gombot); ha nincs fejléc, lebeg */const hdr=document.querySelector('body>header');if(hdr&&hdr.firstElementChild){dock.classList.add('inHeader');hdr.firstElementChild.after(dock);}else document.body.append(dock);
 let pendingAfter=false,timer=0;
 const post=body=>fetch('/api/generation/stop',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json().catch(()=>({}))).then(r=>{if(r?.error)throw Error(r.error);return r;});
 after.onclick=async()=>{after.disabled=true;try{await post({cancel:false});pendingAfter=true;notify(T('Megáll a mostani kép után. Folytatás: „Hiányzók folytatása”.'));}catch(e){notify(e.message,true);after.disabled=false;}void tick();};
 now.onclick=async()=>{now.disabled=true;try{await post({cancel:true});notify(T('Leállítva. A hiányzókat a „Hiányzók folytatása” gombbal pótolhatod.'));}catch(e){notify(e.message,true);}now.disabled=false;void tick();};
 async function tick(){clearTimeout(timer);try{const s=await fetch('/api/generation/status',{cache:'no-store'}).then(r=>r.ok?r.json():null);const b=busyState(s);
   dock.hidden=!b.active;if(!b.active){pendingAfter=false;after.disabled=false;}
   else{const name=String(b.title).replace(/^Creator Hub · /,'').split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf)$/i,'');label.replaceChildren(el('strong',b.running?'▶ Generálás fut':'⏳ Várakozik'),document.createTextNode(name?' · '+name:''),document.createTextNode(b.queued?' · +'+b.queued:''));
    after.disabled=pendingAfter;after.textContent=T(pendingAfter?'✓ Megáll a mostani kép után':'⏸ A mostani kép után');}}catch{}
  timer=setTimeout(tick,document.visibilityState==='visible'?interval:interval*2);}
 void tick();return {refresh:tick};
}
