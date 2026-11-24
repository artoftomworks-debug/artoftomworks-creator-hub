// 0.16 DEV — 📷 Kamera / selfie: tükrözött élő kép, 3 mp visszaszámlálás, 3 kép egymás után, választás;
// a kép mehet kezdőképnek, videóhoz, a Karakterkönyvbe, vagy egy „varázstükör” stílussal azonnal beállítva.
// A kamera csak kérésre és csak a nyitott ablakban él; semmi nem mentődik, amíg nem választasz.
const STYLES=[
 ['🖼 Olajfestmény','classical oil painting portrait of the same person, visible brush strokes, warm museum lighting, rich colors'],
 ['📼 Retró fotó','1970s film photograph of the same person, faded warm colors, soft film grain, vintage look'],
 ['👗 Divatfotó','high-end fashion editorial portrait of the same person, clean studio lighting, magazine cover style'],
 ['💥 Képregény','comic book illustration of the same person, bold ink lines, vibrant flat colors, halftone shading'],
 ['🧝 Fantasy','fantasy character portrait of the same person, ornate elven armor, magical forest light, cinematic'],
 ['❄ Téli','portrait of the same person in a snowy winter landscape, cozy knitted scarf, soft falling snow, golden hour']];
const TIPS=['Fordulj a fény (ablak) felé – a szemből jövő puha fény a legszebb.','A fejed legyen középen, a válladdal együtt.','Nézz a kamerába, és lazítsd el az arcod.','Kerüld az erős ellenfényt a hátad mögött.'];
const CONSENT='creatorHub.cameraConsent';
const css=`.cameraDialog{width:min(760px,95vw);padding:0;border:1px solid var(--gold,#f2c584);border-radius:12px;background:#0d1d26;color:#e8f0f4}.cameraDialog::backdrop{background:#000b}
.cameraDialog .cmBody{display:flex;flex-direction:column;gap:10px;padding:14px 16px}.cameraDialog h2{margin:0;font-size:18px;display:flex;gap:10px;align-items:center}
.cameraDialog .cmLive{font-size:12px;color:#ffb4b4;border:1px solid #c55;border-radius:10px;padding:1px 8px}.cameraDialog .cmStage{position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:4/3;max-height:52vh;margin:0 auto;width:100%}
.cameraDialog video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.cameraDialog .cmCount{position:absolute;inset:0;display:grid;place-items:center;font-size:120px;font-weight:800;color:#fff;text-shadow:0 4px 20px #000}
.cameraDialog .cmFlash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}.cameraDialog .cmShots{display:flex;gap:8px;flex-wrap:wrap}.cameraDialog .cmShots img{width:120px;aspect-ratio:4/3;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer}
.cameraDialog .cmShots img.on{border-color:var(--gold,#f2c584)}.cameraDialog .cmRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.cameraDialog button{width:auto;margin:0;min-height:32px;padding:4px 12px;font-size:14px}
.cameraDialog .cmTip{font-size:13px;color:#a8beca}.cameraDialog .cmErr{color:#f0a0a0;font-size:14px}.cameraDialog [hidden]{display:none!important}`;
function el(tag,props={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...kids.filter(k=>k!=null));return e;}
export function createCamera({$,request,notify,loadStart,switchMode,applyStyle,translate=t=>t}){
  if(document.getElementById('cameraDialog'))return null;document.head.append(el('style',{textContent:css}));
  let stream=null,shots=[],chosen=-1,tipTimer=null;
  const video=el('video',{autoplay:true,muted:true,playsInline:true}),count=el('div',{class:'cmCount',hidden:true}),flash=el('div',{class:'cmFlash'}),stage=el('div',{class:'cmStage'},video,count,flash);
  const live=el('span',{class:'cmLive',textContent:'● Kamera bekapcsolva',hidden:true}),tip=el('div',{class:'cmTip'}),err=el('div',{class:'cmErr',role:'alert'});
  const snap=el('button',{type:'button',class:'primary',textContent:'📸 Fotók (3 mp múlva, 3 kép)'}),strip=el('div',{class:'cmShots'}),mirror=el('input',{type:'checkbox',checked:true});
  const acts=el('div',{class:'cmRow',hidden:true}),styles=el('div',{class:'cmRow',hidden:true});const close=el('button',{type:'button',textContent:'Bezárás'});
  const dialog=el('dialog',{id:'cameraDialog',class:'cameraDialog'},el('div',{class:'cmBody'},el('h2',{},el('span',{textContent:'📷 Kamera'}),live),stage,tip,err,
    el('div',{class:'cmRow'},snap,el('label',{class:'check',style:'display:inline-flex;gap:5px;align-items:center;font-size:13px'},mirror,el('span',{textContent:'Úgy mentse, ahogy a tükörben látod'}))),strip,acts,
    el('div',{class:'cmTip',hidden:true,id:'cameraStyleTitle',textContent:'✨ Varázstükör – a kiválasztott képet kezdőképnek tölti be, és beállítja a stílust (utána: Generálás indítása):'}),styles,el('div',{class:'cmRow'},close)));
  document.body.append(dialog);
  async function start(){err.textContent='';try{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:960},facingMode:'user'},audio:false});video.srcObject=stream;live.hidden=false;}catch(e){err.textContent=translate(e?.name==='NotAllowedError'?'A böngésző nem engedte a kamerát. A címsor melletti kamera ikonnál engedélyezheted.':e?.name==='NotFoundError'?'Nem található kamera ezen a gépen.':'A kamera nem indítható: ')+(['NotAllowedError','NotFoundError'].includes(e?.name)?'':e?.message||'');}}
  function stop(){for(const t of stream?.getTracks?.()||[])t.stop();stream=null;video.srcObject=null;live.hidden=true;clearInterval(tipTimer);}
  const grab=()=>{const w=video.videoWidth,h=video.videoHeight;if(!w)return null;const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');if(mirror.checked){g.translate(w,0);g.scale(-1,1);}g.drawImage(video,0,0,w,h);return c.toDataURL('image/jpeg',.92);};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  snap.onclick=async()=>{if(!stream)return;snap.disabled=true;try{count.hidden=false;for(const n of [3,2,1]){count.textContent=String(n);await wait(800);}count.hidden=true;shots=[];
    for(let i=0;i<3;i++){flash.style.opacity='.8';const d=grab();setTimeout(()=>{flash.style.opacity='0';},120);if(d)shots.push(d);await wait(650);}chosen=shots.length?0:-1;drawShots();}finally{snap.disabled=false;count.hidden=true;}};
  function drawShots(){strip.replaceChildren(...shots.map((d,i)=>{const im=el('img',{src:d,alt:'',class:i===chosen?'on':''});im.onclick=()=>{chosen=i;drawShots();};return im;}));const any=chosen>=0;acts.hidden=!any;styles.hidden=!any;document.getElementById('cameraStyleTitle').hidden=!any;}
  const file=()=>{const d=shots[chosen];const bin=atob(d.split(',')[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],'kamera_'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.jpg',{type:'image/jpeg'});};
  const action=(label,title,fn)=>{const b=el('button',{type:'button',textContent:label,title});b.onclick=async()=>{try{await fn();}catch(e){err.textContent=e.message;}};return b;};
  acts.append(
    action('🖼 Kezdőképnek','A kiválasztott kép a nyitott fül kezdőképe lesz',async()=>{await loadStart(file());dialog.close();notify('A kamerakép kezdőképként betöltve.');}),
    action('🎬 Videóhoz','Átvált a Videó fülre, és a kép lesz a kezdőkép („megmozdul a portré”)',async()=>{switchMode('video');await loadStart(file());dialog.close();notify(['A kamerakép videó-kezdőképként betöltve.',' ','Válassz videómodellt és írd le a mozgást (pl. pislog, mosolyog, a fejét fordítja).']);}),
    action('👤 Karakterkönyvbe','Arcként elmenti a Karakterkönyvbe, hogy bármilyen jelenetben felismerhető legyél',async()=>{const name=(prompt(translate('Milyen néven mentsem a Karakterkönyvbe?'))||'').trim();if(!name)return;await request('characters/save',{character:{name:name.slice(0,60),image:shots[chosen],weight:0.9}});dispatchEvent(new Event('creatorhub:characters-changed'));notify(['👤',' ',name,' ','bekerült a Karakterkönyvbe.']);}));
  for(const [label,text] of STYLES)styles.append(action(label,text,async()=>{switchMode('image');await loadStart(file());applyStyle({prompt:text,denoise:0.55});dialog.close();notify(['✨',' ',label.replace(/^\S+\s/,''),' ','stílus beállítva a kamerakép alapján.',' ','Indítsd a Generálás gombbal.']);}));
  close.onclick=()=>dialog.close();dialog.addEventListener('close',stop);addEventListener('creatorhub:privacy',e=>{if(e.detail?.hidden&&dialog.open)dialog.close();});
  async function open(){try{if(localStorage.getItem(CONSENT)!=='ok'){if(!confirm(translate('A kamerával a saját képeddel – vagy olyan ember képével, aki ebbe beleegyezett – dolgozz. A kép csak ezen a gépen marad. Folytatod?')))return;localStorage.setItem(CONSENT,'ok');}}catch{}
    shots=[];chosen=-1;drawShots();if(!dialog.open)dialog.showModal();let k=0;tip.textContent=translate(TIPS[0]);tipTimer=setInterval(()=>{k=(k+1)%TIPS.length;tip.textContent=translate(TIPS[k]);},5000);await start();}
  const btn=el('button',{type:'button',id:'cameraButton',textContent:'📷 Kamera',title:'Selfie a gép kamerájával – kezdőképnek, videóhoz vagy a Karakterkönyvbe'});btn.onclick=()=>void open();
  const place=()=>{const ch=$('chooseImage');if(ch&&ch.nextElementSibling!==btn)ch.after(btn);};place();setInterval(place,1500);
  return {open,destroy(){stop();dialog.remove();btn.remove();}};
}
