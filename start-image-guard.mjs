// 0.16 DEV — Kezdőkép-figyelő: a Generálás gomb mellett mindig látszik, ha kezdőkép van bent (✕-szel kivehető),
// és indítás előtt csak akkor kérdez, ha valószínűleg ottfelejtett kép: azóta érdemben átírt prompt, vagy régóta (más munkamenetből) bent lévő kép.
export const STALE_MS=3*60*60*1000;
const words=t=>new Set(String(t||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2));
export function promptSimilarity(a,b){const A=words(a),B=words(b);if(!A.size&&!B.size)return 1;let n=0;for(const w of A)if(B.has(w))n++;return n/(A.size+B.size-n||1);}
export const imageSig=img=>img?String(img.length)+':'+String(img).slice(-48):'';
// Pure: miért kérdezzünk (vagy null).
export function staleReason(c,now=Date.now()){if(!c?.image||c.useImage===false)return null;const i=c.startImageInfo||{};
 if(i.sig!==imageSig(c.image))return null;
 if(typeof i.usedPrompt==='string'&&promptSimilarity(i.usedPrompt,c.prompt)<0.6)return 'prompt';
 if(now-Math.max(Number(i.loadedAt)||0,Number(i.ackAt)||0)>STALE_MS)return 'old';return null;}
const ASK='creatorHub.askStartImage';
export const askEnabled=()=>{try{return localStorage.getItem(ASK)!=='off';}catch{return true;}};
export function createStartImageGuard({$,current,getState=()=>null,translate=t=>t}){
  const st=document.createElement('style');st.textContent=`.startImageChip{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 4px;border:1px solid var(--gold,#f2c584);border-radius:9px;font-size:13px;color:#e8f0f4;background:#1b2f38;vertical-align:middle}
.startImageChip[hidden]{display:none!important}.startImageChip img{width:34px;height:34px;object-fit:cover;border-radius:6px}.startImageChip button{min-height:26px;width:26px;padding:0;margin:0;font-size:13px}
.startImageDialog img{max-width:min(320px,80vw);max-height:220px;border-radius:8px;display:block;margin:6px 0 10px}`;document.head.append(st);
  const chip=document.createElement('span');chip.className='startImageChip';chip.hidden=true;chip.title='Ez a kezdőkép bekerül a generálásba';
  const img=document.createElement('img');img.alt='';const lab=document.createElement('span');lab.textContent='kezdőképpel';const x=document.createElement('button');x.type='button';x.textContent='✕';x.title='Kezdőkép eltávolítása';
  x.onclick=()=>{$('removeImage')?.click();tick();};chip.append(img,lab,x);
  const place=()=>{const s=$('start');if(s&&s.nextElementSibling!==chip)s.after(chip);};
  const track=c=>{if(!c)return;const sig=imageSig(c.image);if(!c.startImageInfo)c.startImageInfo={sig,loadedAt:c.image?0:Date.now()};else if(c.startImageInfo.sig!==sig)c.startImageInfo={sig,loadedAt:Date.now()};};
  function tick(){place();const st=getState();if(st){track(st.image);track(st.video);}const c=current();if(!c)return;track(c);
    /* adatok nélküli (régi piszkozatból jött) kép: ismeretlen korú → régi; minden későbbi cserénél most töltődött be */const on=!!c.image&&c.useImage!==false;chip.hidden=!on;if(on&&img.src!==c.image)img.src=c.image;}
  const timer=setInterval(tick,700);setTimeout(tick,0);
  function markUsed(){const c=current();if(!c?.image||c.useImage===false)return;c.startImageInfo={...(c.startImageInfo||{}),sig:imageSig(c.image),usedPrompt:c.prompt||'',ackAt:Date.now()};}
  function confirm(){tick();const c=current(),why=staleReason(c);if(!why||!askEnabled())return Promise.resolve('with');
    return new Promise(resolve=>{const d=document.createElement('dialog');d.className='studioDialog startImageDialog';const h=document.createElement('h2');h.textContent='Kezdőkép van bent';
      const p=document.createElement('p');p.textContent=why==='prompt'?'A promptot azóta érdemben átírtad, de a korábbi kezdőkép maradt bent. Így akarod indítani?':'Ez a kezdőkép már régóta (egy korábbi munkamenetből) van bent. Így akarod indítani?';
      const pic=document.createElement('img');pic.src=c.image;pic.alt='';const row=document.createElement('div');row.className='inline';
      const w=document.createElement('button'),wo=document.createElement('button'),cancel=document.createElement('button');w.type=wo.type=cancel.type='button';w.className='primary';w.textContent='Indítás kezdőképpel';wo.textContent='Indítás nélküle';wo.title='Csak erre az egy indításra hagyja ki; a kép bent marad';cancel.textContent='Mégse';row.append(w,wo,cancel);
      const l=document.createElement('label');l.className='check';const chk=document.createElement('input');chk.type='checkbox';const t=document.createElement('span');t.textContent='Ne kérdezze többet';l.append(chk,t);
      d.append(h,p,pic,row,l);document.body.append(d);let done=false;const end=v=>{if(done)return;done=true;if(chk.checked){try{localStorage.setItem(ASK,'off');}catch{}}d.close();d.remove();resolve(v);};
      w.onclick=()=>end('with');wo.onclick=()=>end('without');cancel.onclick=()=>end('cancel');d.addEventListener('cancel',e=>{e.preventDefault();end('cancel');});d.showModal();w.focus();});}
  return {confirm,markUsed,tick,destroy(){clearInterval(timer);chip.remove();}};
}
