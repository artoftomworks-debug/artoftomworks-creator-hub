// 0.16 DEV — Értesítés, ha kész: Windows-értesítés (böngésző Notification) és ✓ a lap címében,
// ha egy generálás elkészül vagy hibára fut, miközben a Hub nincs előtérben. Kikapcsolható a ⚙ Beállításokban.
// Egy több modelles összehasonlítás egyetlen értesítést ad, amikor az egész csoport végzett.
const KEY='creatorHub.notifyDone';
export function notifyEnabled(){try{return localStorage.getItem(KEY)!=='off';}catch{return true;}}
export function setNotifyEnabled(on){try{if(on)localStorage.removeItem(KEY);else localStorage.setItem(KEY,'off');}catch{}}
const FINAL=['complete','failed','cancelled'];
// Pure: which finished things deserve a notification (entries that just reached a final state; batches only when all members are final).
export function finishedEvents(prev,entries){const out=[],byBatch=new Map();for(const e of entries)if(e.batch?.id){const list=byBatch.get(e.batch.id)||[];list.push(e);byBatch.set(e.batch.id,list);}
 const seenBatch=new Set();for(const e of entries){const was=prev.get(e.id);if(!was||FINAL.includes(was)||!FINAL.includes(e.state)||e.state==='cancelled')continue;
  if(e.batch?.id){if(seenBatch.has(e.batch.id))continue;const all=byBatch.get(e.batch.id);if(!all.every(x=>FINAL.includes(x.state)))continue;seenBatch.add(e.batch.id);out.push({kind:all.some(x=>x.state==='failed')?'partial':'batch',title:e.batch.label||e.title,count:all.filter(x=>x.state==='complete').length,total:all.length});continue;}
  out.push({kind:e.state==='complete'?'done':'failed',title:e.title,error:e.error||''});}
 return out;}

export function createNotify({request,translate=t=>t}){
 const prev=new Map();let primed=false,baseTitle=document.title,badge='';
 const away=()=>document.hidden||!document.hasFocus();
 function setBadge(b){badge=b;document.title=(b?b+' ':'')+baseTitle.replace(/^[✓⚠] /,'');}
 addEventListener('focus',()=>setBadge(''));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setBadge('');});
 // Engedélykérés felhasználói mozdulathoz kötve: az első Generálás indításakor.
 document.addEventListener('click',e=>{if(!notifyEnabled()||!('Notification' in window)||Notification.permission!=='default')return;if(e.target?.closest?.('#start,.multiModelButton,#generationMenu [role=menuitem]'))void Notification.requestPermission().catch(()=>{});},true);
 function show(ev){if(!notifyEnabled())return;const model=String(ev.title||'').replace(/^Creator Hub · /,'').replace(/\.(safetensors|ckpt|gguf)$/i,'');
  const head=translate(ev.kind==='failed'?'Hiba a generálásban':ev.kind==='partial'?'Az összehasonlítás véget ért – néhány hibával':'Elkészült');
  const body=ev.kind==='failed'?model+(ev.error?' — '+String(ev.error).slice(0,140):''):ev.total?model+' · '+ev.count+' / '+ev.total:model;
  setBadge(ev.kind==='done'||ev.kind==='batch'?'✓':'⚠');
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{const n=new Notification('Creator Hub · '+head,{body,tag:'creator-hub-'+(ev.kind==='failed'?'error':'done'),silent:false});n.onclick=()=>{focus();n.close();};}catch{}}
 async function tick(){let s;try{s=await request('generation/status');}catch{return;}const entries=s?.entries||[];
  if(primed&&away())for(const ev of finishedEvents(prev,entries))show(ev);
  prev.clear();for(const e of entries)prev.set(e.id,e.state);primed=true;}
 setInterval(()=>void tick(),4000);void tick();
 return {tick};
}
