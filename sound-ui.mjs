// 0.16 DEV — 🔊 Hang a videókhoz: egyszerű hangszerkesztő párbeszéd (úsztatás, hangerő, kiegyenlítés, háttérzene ducking-gal).
const css=`.soundDialog{width:min(560px,94vw);padding:0;border:1px solid var(--gold,#f2c584);border-radius:12px;background:#0d1d26;color:#e8f0f4}
.soundDialog::backdrop{background:#000a}.soundDialog .sdBody{display:flex;flex-direction:column;gap:10px;padding:14px 16px}
.soundDialog h2{margin:0;font-size:18px}.soundDialog video{width:100%;max-height:220px;background:#000;border-radius:8px}
.soundDialog .sdRow{display:grid;grid-template-columns:150px 1fr 54px;gap:8px;align-items:center;font-size:13px}.soundDialog .sdRow output{text-align:right;color:#a8beca}
.soundDialog .sdChecks{display:flex;flex-wrap:wrap;gap:12px;font-size:13px}.soundDialog .sdChecks label{display:inline-flex;gap:5px;align-items:center}
.soundDialog .sdNote{font-size:12px;color:#a8beca}.soundDialog .sdActs{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.soundDialog button{width:auto;margin:0}
.soundDialog fieldset{border:1px solid #2a4452;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:8px}.soundDialog legend{font-size:13px;color:#f2c584}
.soundDialog [hidden]{display:none!important}`;
function el(tag,props={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...kids.filter(k=>k!=null));return e;}
export function createSoundUI({request,notify,onDone=()=>{}}){
  if(document.getElementById('soundDialog'))return null;document.head.append(el('style',{textContent:css}));
  let entry=null,music='',jobId=null,timer=null;
  const slider=(label,min,max,step,value,unit)=>{const i=el('input',{type:'range',min,max,step,value});const o=el('output');const upd=()=>{o.textContent=i.value+unit;};i.oninput=upd;upd();return {input:i,row:el('div',{class:'sdRow'},el('span',{textContent:label}),i,o),set:v=>{i.value=v;upd();}};};
  const fadeIn=slider('Beúsztatás',0,5,0.5,0,' mp'),fadeOut=slider('Kiúsztatás',0,5,0.5,1,' mp'),volume=slider('Saját hang hangereje',0,200,10,100,' %'),musicVol=slider('Zene hangereje',0,150,5,50,' %');
  const mute=el('input',{type:'checkbox'}),loud=el('input',{type:'checkbox',checked:true}),duck=el('input',{type:'checkbox',checked:true});
  const fileIn=el('input',{type:'file',accept:'audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,audio/flac,.mp3,.wav,.ogg,.m4a,.aac,.flac'});const musicName=el('span',{class:'sdNote',textContent:'Nincs zene kiválasztva.'});const dropMusic=el('button',{type:'button',textContent:'✕',title:'Zene nélkül',hidden:true});
  const video=el('video',{controls:true,playsInline:true,preload:'metadata'});const title=el('div',{class:'sdNote'});const status=el('div',{class:'sdNote',role:'status'});
  const run=el('button',{type:'button',class:'primary',textContent:'🔊 Új változat készítése'});const close=el('button',{type:'button',textContent:'Bezárás'});
  const dialog=el('dialog',{id:'soundDialog',class:'soundDialog'},el('div',{class:'sdBody'},el('h2',{textContent:'🔊 Hang a videóhoz'}),title,video,
    fadeIn.row,fadeOut.row,volume.row,
    el('div',{class:'sdChecks'},el('label',{},mute,el('span',{textContent:'Saját hang némítása'})),el('label',{title:'Egységes, kellemes hangerő (EBU R128, −16 LUFS) – több videó egymás után sem ugrál'},loud,el('span',{textContent:'Hangerő kiegyenlítése'}))),
    el('fieldset',{},el('legend',{textContent:'🎵 Háttérzene (nem kötelező)'}),el('div',{class:'sdChecks'},fileIn,dropMusic),musicName,musicVol.row,
      el('div',{class:'sdChecks'},el('label',{title:'A zene automatikusan halkabb, amikor a videó saját hangja szól (beszéd, effekt)'},duck,el('span',{textContent:'Zene halkítása, amikor a videó hangja szól'})))),
    el('div',{class:'sdNote',textContent:'A kép nem változik és nem kódolódik újra; az eredmény új videóként jelenik meg az Előzményekben. Az eredeti érintetlen marad.'}),
    status,el('div',{class:'sdActs'},close,run)));
  document.body.append(dialog);
  const setMusic=(url,name)=>{music=url||'';musicName.textContent=music?name:'Nincs zene kiválasztva.';dropMusic.hidden=!music;};
  fileIn.onchange=()=>{const f=fileIn.files[0];if(!f)return;if(f.size>16*1024**2){status.textContent='A zene legfeljebb kb. 16 MiB lehet.';fileIn.value='';return;}const r=new FileReader();r.onload=()=>{let u=String(r.result);if(/^data:(application\/octet-stream|);/.test(u)){const ext=f.name.split('.').pop().toLowerCase();const t={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac'}[ext];if(t)u=u.replace(/^data:[^;]*;/,'data:'+t+';');}setMusic(u,'🎵 '+f.name);};r.readAsDataURL(f);};
  dropMusic.onclick=()=>{setMusic('');fileIn.value='';};close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{video.pause();});
  const busy=v=>{run.disabled=v;};
  async function poll(){try{const s=await request('video-sound/status?id='+jobId);status.textContent=s.step||'';if(s.state==='running')return;clearInterval(timer);timer=null;busy(false);
    if(s.state==='complete'){status.textContent='✓ Kész: '+s.result.title+' ('+s.result.seconds+' mp)';notify(['🔊 A hangos változat elkészült:',' ',s.result.title,' ','– megtalálod az Előzményekben.']);onDone(s.result);}else status.textContent='Nem sikerült: '+s.error;}catch(e){clearInterval(timer);timer=null;busy(false);status.textContent=e.message;}}
  run.onclick=async()=>{if(!entry)return;busy(true);status.textContent='Indítás…';try{const r=await request('video-sound/start',{id:entry.id,fadeIn:Number(fadeIn.input.value),fadeOut:Number(fadeOut.input.value),volume:Number(volume.input.value),mute:mute.checked,loudnorm:loud.checked,musicVolume:Number(musicVol.input.value),duck:duck.checked,...(music?{music}:{})});jobId=r.id;timer=setInterval(()=>void poll(),800);}catch(e){busy(false);status.textContent=e.message;}};
  function open(e){if(!e?.id)return notify('Ehhez a videóhoz nincs Előzmény-bejegyzés.',true);entry=e;title.textContent=(e.project||e.filename||'')+(e.seconds?' · '+e.seconds+' mp':'');video.src=e.url||'';status.textContent='';if(!timer)busy(false);if(!dialog.open)dialog.showModal();}
  addEventListener('creatorhub:sound-open',ev=>open(ev.detail?.entry));
  return {open,destroy(){clearInterval(timer);dialog.remove();}};
}
