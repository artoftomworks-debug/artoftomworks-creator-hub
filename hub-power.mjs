// 0.16 DEV — „⏻ Hub” gomb a jobb alsó sarokban: újraindítás, újraindítás a futó munka után, leállítás.
// A ComfyUI a Hub újraindításakor tovább fut; a „Minden leállítása” állítja le mindkettőt, a ComfyUI külön is indítható/leállítható.
// Kattintásra csak egy menü nyílik; minden művelet kétlépcsős (Biztos? → Igen), így véletlenül semmi nem áll le.
const sp0=t=>{const e=document.createElement('span');e.textContent=t;return e;};
const post=async(path,body={})=>{const r=await fetch('/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||('HTTP '+r.status));return j;};
const css=`.hubPower{position:fixed;right:10px;bottom:8px;z-index:70;font-size:13px}
.hubPower>button{min-height:30px;padding:4px 11px;border-radius:16px;border:1px solid #5d7884;background:#10232dee;color:#cfe0e8;font-size:13px;opacity:.78;box-shadow:0 3px 12px #0008}
.hubPower>button:hover,.hubPower.open>button{opacity:1;border-color:var(--gold,#f2c584);color:var(--gold,#f2c584)}
.hubPower .hpMenu{position:absolute;right:0;bottom:calc(100% + 6px);width:300px;padding:10px;background:#10232d;border:1px solid var(--gold,#f2c584);border-radius:11px;box-shadow:0 10px 30px #000c;display:flex;flex-direction:column;gap:6px}
.hubPower .hpMenu[hidden]{display:none!important}
.hubPower .hpMenu button{text-align:left;width:100%;min-height:32px;padding:6px 10px;font-size:13px;border-radius:7px;margin:0}
.hubPower .hpMenu .danger{background:#572c35;border-color:#bd6c7a}
.hubPower .hpStatus{font-size:12px;color:#a8beca;margin:0 0 2px;line-height:1.35}
.hubPower .hpStatus.busy{color:#ffcf9a}
.hubPower .hpConfirm{display:flex;gap:6px}.hubPower .hpConfirm button{text-align:center}
.hubPowerOverlay{position:fixed;inset:0;z-index:200;background:#050c11f2;display:flex;align-items:center;justify-content:center;color:#e7eef2;font:16px/1.6 system-ui,Segoe UI,sans-serif;text-align:center;padding:30px}
.hubPowerOverlay b{color:#f2c584;font-size:22px;display:block;margin-bottom:10px}.hubPowerOverlay code{background:#203742;padding:2px 7px;border-radius:5px}`;
function overlay(html){const o=document.createElement('div');o.className='hubPowerOverlay';o.innerHTML=html;document.body.append(o);return o;}
function waitBack(){
  // Restart: wait until the new Hub answers, then reload (the reload watcher would do it too; this is quicker and explicit).
  let tries=0;const t=setInterval(async()=>{tries++;try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(1500)});if(r.ok){const h=await r.json();if(h.boot&&h.boot!==window.__hubBoot){clearInterval(t);location.reload();}}}catch{}if(tries>90){clearInterval(t);document.querySelector('.hubPowerOverlay span').textContent='Nem jött vissza egy percen belül. Indítsd el: START_CREATOR_HUB.cmd';}},1000);
}
function init(){
  if(document.querySelector('.hubPower'))return;
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(h=>{window.__hubBoot=h.boot||'';}).catch(()=>{});
  const box=document.createElement('div');box.className='hubPower';
  const btn=document.createElement('button');btn.type='button';btn.textContent='⏻ Hub';btn.title='A Hub újraindítása vagy leállítása';btn.setAttribute('aria-haspopup','menu');
  const menu=document.createElement('div');menu.className='hpMenu';menu.hidden=true;menu.setAttribute('role','menu');
  box.append(btn,menu);document.body.append(box);
  const close=()=>{menu.hidden=true;box.classList.remove('open');};
  const item=(text,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(cls)b.className=cls;b.onclick=ev=>{ev.stopPropagation();fn();};return b;};
  const confirmRow=(question,yes,yesLabel,cls)=>{const s=document.createElement('p');s.className='hpStatus busy';s.textContent=question;const row=document.createElement('div');row.className='hpConfirm';row.append(item(yesLabel,yes,cls),item('Mégse',render));menu.replaceChildren(s,row);};
  const fail=e=>{const s=document.createElement('p');s.className='hpStatus busy';s.textContent=e.message||String(e);menu.replaceChildren(s,item('Vissza',render));};
  async function render(){
    const s=document.createElement('p');s.className='hpStatus';s.textContent='Állapot ellenőrzése…';menu.replaceChildren(s);
    let p={};try{p=await post('hub/power');}catch(e){s.replaceChildren(sp0('A Hub nem válaszol:'),' ',sp0(e.message));return;}
    if(p.scheduled){s.className='hpStatus busy';s.textContent='Újraindítás betervezve: amint a futó munka véget ér, a Hub újraindul.';menu.append(item('Betervezett újraindítás visszavonása',async()=>{try{await post('hub/cancel-restart');render();}catch(e){fail(e);}}));return;}
    const sp=t=>{const e=document.createElement('span');e.textContent=t;return e;};s.className='hpStatus'+(p.busy?' busy':'');if(p.busy)s.replaceChildren(sp('Most dolgozik:'),' ',sp(p.busy));else s.textContent='Semmi nem fut – biztonságosan újraindítható.';
    let eng=null;try{const r=await fetch('/api/engine/status',{cache:'no-store'});if(r.ok)eng=await r.json();}catch{}
    const names={ready:'fut',starting:'indul…',stopping:'leáll…',stopped:'áll',error:'hiba'};
    const es=document.createElement('p');es.className='hpStatus';
    if(eng&&eng.enabled&&eng.mode==='managed'){es.replaceChildren('ComfyUI: ',sp(names[eng.state]||eng.state),...(eng.state==='ready'?[' · ',sp(eng.owned?'a Hub újraindításakor is tovább fut':'nem a Hub indította, nem állítom le')]:[]),...(eng.state==='error'&&eng.error?[' – ',sp(eng.error)]:[]));s.after(es);}
    const restartNow=item('↻ Hub újraindítása',()=>confirmRow('Újraindítsam a Hubot? Az oldal utána magától frissül. A ComfyUI tovább fut, a modellek betöltve maradnak.',async()=>{try{await post('hub/restart');overlay('<b>A Hub újraindul…</b><span>Pár másodperc, az oldal magától frissül.</span>');waitBack();}catch(e){fail(e);}},'Igen, újraindítás'));
    const restartAfter=item('↻ Hub újraindítása a futó munka után',async()=>{try{const r=await post('hub/restart',{when:'after'});if(r.scheduled)render();else{overlay('<b>A Hub újraindul…</b><span>Pár másodperc, az oldal magától frissül.</span>');waitBack();}}catch(e){fail(e);}});
    const stop=item('⏻ Minden leállítása (Hub + ComfyUI)',()=>confirmRow(p.busy?'Most dolgozik a Hub. A leállítás a futó munkát megszakítja, az elvész. Biztos?':'Leállítsam a Hubot és az általa indított ComfyUI-t? Leállítás után csak a START_CREATOR_HUB.cmd-vel indítható újra.',async()=>{try{await post('hub/stop',{force:!!p.busy});overlay('<b>A Hub leállt.</b><span>Újraindítás: <code>START_CREATOR_HUB.cmd</code> (a Hub mappájában). Ez a lap bezárható.</span>');}catch(e){fail(e);}},p.busy?'Igen, leállítás most':'Igen, leállítás','danger'),'danger');
    const log=item('📄 Napló megnyitása',async()=>{try{const r=await post('hub/open-log');if(!r.opened)fail(Error('Napló: '+r.path));else close();}catch(e){fail(e);}});
    let comfy=null;
    if(eng&&eng.enabled&&eng.mode==='managed'){
      if(eng.state==='ready'&&eng.owned&&!p.busy)comfy=item('◼ Csak a ComfyUI leállítása',()=>confirmRow('Leállítsam a ComfyUI-t? A betöltött modellek kikerülnek a memóriából; a Hub tovább fut, a következő generálás újraindítja.',async()=>{try{await post('engine/stop');render();}catch(e){fail(e);}},'Igen, ComfyUI leállítása'));
      else if(['stopped','error'].includes(eng.state))comfy=item('▶ ComfyUI indítása',async()=>{try{await post('engine/start');render();}catch(e){fail(e);}});
    }
    const items=p.busy?(()=>{const dead=item('↻ Hub újraindítása most (nem lehet – fut valami)',()=>{});dead.disabled=true;return [restartAfter,dead];})():[restartNow];
    menu.append(...items,...(comfy?[comfy]:[]),stop,log);
  }
  btn.onclick=ev=>{ev.stopPropagation();if(menu.hidden){menu.hidden=false;box.classList.add('open');render();}else close();};
  menu.onclick=ev=>ev.stopPropagation();
  document.addEventListener('click',close);document.addEventListener('keydown',ev=>{if(ev.key==='Escape')close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
