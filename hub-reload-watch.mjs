// 0.16 DEV — Ha a Hub szervere újraindult (frissítés után), az oldal magától újratölt,
// hogy az új változat fusson. Gépelés közben nem tölt újra: ilyenkor egy sávot mutat.
let boot='',banner=null,timer=0;
const typing=()=>{const a=document.activeElement;return !!a&&(a.tagName==='TEXTAREA'||(a.tagName==='INPUT'&&!['button','checkbox','radio','range','file'].includes(a.type))||a.isContentEditable);};
function show(){
  if(banner)return;banner=document.createElement('div');banner.setAttribute('role','status');
  banner.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99;background:#f2c584;color:#132630;padding:10px 16px;border-radius:10px;font-weight:700;box-shadow:0 8px 24px #000a;display:flex;gap:12px;align-items:center';
  banner.textContent='A Hub frissült és újraindult. ';const b=document.createElement('button');b.textContent='Oldal frissítése';b.onclick=()=>location.reload();banner.append(b);document.body.append(banner);
}
async function tick(){
  try{
    const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(2500)});const h=await r.json();
    if(h.boot){if(!boot)boot=h.boot;else if(h.boot!==boot){if(typing()||document.querySelector('dialog[open]'))show();else{location.reload();return;}}}
  }catch{}
  timer=setTimeout(tick,boot?4000:6000);
}
timer=setTimeout(tick,1500);
