// 0.16 DEV — 🙈 Vészkapcsoló: egy kattintás vagy Ctrl+Alt+H, és minden kép/videó azonnal elmosódik a Hubban,
// a videók megállnak és elnémulnak; amíg be van kapcsolva, az új eredmények is rejtve érkeznek.
// Választható, hogy újratöltés után is rejtve maradjon-e (⚙ Beállítások). A stílus az index.html-ben van, hogy betöltéskor se villanjon.
const ON='creatorHub.privacyOn',REMEMBER='creatorHub.privacyRemember';
const get=k=>{try{return localStorage.getItem(k);}catch{return null;}},set=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch{}};
export const isHidden=()=>document.documentElement.classList.contains('hubPrivacy');
export function createPrivacy({translate=t=>t}={}){
  if(document.getElementById('privacyButton'))return null;
  if(!document.getElementById('privacyStyle')){const st=document.createElement('style');st.id='privacyStyle';st.textContent='html.hubPrivacy img,html.hubPrivacy video,html.hubPrivacy canvas,html.hubPrivacy picture,html.hubPrivacy [style*="background-image"]{filter:blur(32px) grayscale(1) brightness(.35)!important;clip-path:inset(0)!important}html.hubPrivacy body::before{filter:blur(40px) grayscale(1) brightness(.3)!important}';document.head.append(st);}
  const st2=document.createElement('style');st2.textContent='#privacyButton.on{background:var(--gold,#f2c584);color:#15232c;border-color:var(--gold,#f2c584)}.privacyBanner{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;padding:7px 14px;border-radius:20px;background:#10232dee;border:1px solid var(--gold,#f2c584);color:#e8f0f4;font-size:14px;cursor:pointer;box-shadow:0 6px 20px #000a}.privacyBanner[hidden]{display:none}';document.head.append(st2);
  const button=document.createElement('button');button.type='button';button.id='privacyButton';
  const banner=document.createElement('div');banner.className='privacyBanner';banner.hidden=true;banner.setAttribute('role','status');const bt=document.createElement('span');bt.textContent='🙈 A képek el vannak rejtve – kattints ide a megjelenítéshez (Ctrl+Alt+H)';banner.append(bt);document.body.append(banner);
  const muted=new WeakSet();
  function hush(){for(const m of document.querySelectorAll('video,audio')){if(!m.paused)m.pause();if(!m.muted){m.muted=true;muted.add(m);}}}
  function render(){const on=isHidden();button.classList.toggle('on',on);button.textContent=on?'🙈 Elrejtve':'🙈';button.title=on?'A képek el vannak rejtve. Kattints a megjelenítéshez (Ctrl+Alt+H)':'Minden kép és videó azonnali elrejtése (Ctrl+Alt+H)';button.setAttribute('aria-pressed',String(on));banner.hidden=!on;}
  function setHidden(on){document.documentElement.classList.toggle('hubPrivacy',on);if(on){hush();}else{for(const m of document.querySelectorAll('video,audio'))if(muted.has(m)){m.muted=false;muted.delete(m);}}
    set(ON,on&&get(REMEMBER)==='on'?'on':null);render();dispatchEvent(new CustomEvent('creatorhub:privacy',{detail:{hidden:on}}));}
  const toggle=()=>setHidden(!isHidden());
  button.onclick=toggle;banner.onclick=()=>setHidden(false);
  addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&!e.metaKey&&(e.code==='KeyH'||e.key==='h'||e.key==='H')){e.preventDefault();e.stopPropagation();toggle();}},true);
  /* amíg rejtve van: új (automatikusan induló) videók se szóljanak */
  document.addEventListener('play',e=>{if(isHidden()&&e.target instanceof HTMLMediaElement){e.target.pause();if(!e.target.muted){e.target.muted=true;muted.add(e.target);}}},true);
  const place=()=>{const nav=document.querySelector('body>header nav');if(!nav)return false;if(!nav.contains(button)){const first=nav.firstElementChild;first?nav.insertBefore(button,first):nav.append(button);}return true;};
  if(!place()){const t=setInterval(()=>{if(place())clearInterval(t);},500);setTimeout(()=>clearInterval(t),15000);}
  /* ⚙ Beállítások: megjegyzés újratöltés után */
  const settings=()=>{const panel=document.querySelector('.hubGearPanel');if(!panel||panel.querySelector('.privacyRemember'))return;const l=document.createElement('label');l.className='check privacyRemember';const c=document.createElement('input');c.type='checkbox';c.checked=get(REMEMBER)==='on';c.onchange=()=>{set(REMEMBER,c.checked?'on':null);set(ON,c.checked&&isHidden()?'on':null);};l.onclick=e=>e.stopPropagation();const t=document.createElement('span');t.textContent='🙈 Az elrejtett képek újratöltés után is maradjanak rejtve';l.append(c,t);panel.append(l);};
  settings();const st=setInterval(settings,1000);
  if(isHidden())hush();render();
  return {toggle,setHidden,isHidden,destroy(){clearInterval(st);button.remove();banner.remove();}};
}
