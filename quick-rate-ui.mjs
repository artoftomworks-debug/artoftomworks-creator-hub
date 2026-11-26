// 0.17.1 DEV — Gyors értékelés közvetlenül a kész kép fölött: ☆ kedvenc · 1–5 · – · 🗑 Lomtárba.
// Ugyanaz a gombsor, mint a rács nagy nézetében, és ugyanaz a közös adat, mint az Előzményekben (history/annotate).
// A 🗑 a meglévő, megerősítéssel védett Lomtár-utat használja (onTrash), nem töröl véglegesen.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};

export function createQuickRate({request,notify=()=>{},onTrash=null}){
  const bar=el('div',null,'quickRate');bar.hidden=true;bar.setAttribute('role','group');bar.setAttribute('aria-label','Gyors értékelés');
  let entry=null,version=0;
  const btn=(text,title,fn,cls)=>{const b=el('button',text,cls);b.type='button';if(title)b.title=title;b.onclick=()=>void run(fn);return b;};
  async function run(fn){try{await fn();}catch(err){notify(err.message,true);}paint();}
  async function annotate(values){if(!entry)return;const id=entry.id;const r=await request('history/annotate',{id,...values});if(entry?.id===id)Object.assign(entry,r&&typeof r==='object'?r:values);}
  function paint(){if(!entry){bar.hidden=true;bar.replaceChildren();return;}bar.hidden=false;
    bar.replaceChildren(
      btn(entry.favorite?'★':'☆','Kedvenc (F)',()=>annotate({favorite:!entry.favorite}),entry.favorite?'on':''),
      ...[1,2,3,4,5].map(n=>btn(String(n),n+' / 5',()=>annotate({rating:entry.rating===n?null:n}),entry.rating===n?'on':'')),
      btn('♛','Remekmű (M) – a korona mellé a ★ kedvenc és az 5-ös is jár',()=>annotate({masterpiece:!entry.masterpiece}),'crownBtn'+(entry.masterpiece?' on':'')),
      ...(onTrash?[btn('🗑','Lomtárba – az Előzmények Lomtár nézetében visszaállítható',async()=>{await onTrash(entry);},'trash')]:[]));}
  // e: {id, filename, favorite?, rating?} – ha az értékelés nem ismert, a háttértől kérdezi le.
  async function show(e){const mine=++version;entry=e?.id?{id:e.id,filename:e.filename,favorite:!!e.favorite,rating:e.rating??null,masterpiece:!!e.masterpiece}:null;paint();
    if(entry&&e.favorite===undefined&&e.rating===undefined){try{const r=await fetch('/api/history/item?id='+encodeURIComponent(entry.id),{cache:'no-store'});if(r.ok){const v=await r.json();if(mine===version&&entry){entry.favorite=!!v.favorite;entry.rating=v.rating??null;entry.masterpiece=!!v.masterpiece;paint();}}}catch{}}}
  function hide(){version++;entry=null;paint();}
  function key(ev){if(!entry||bar.hidden||ev.ctrlKey||ev.altKey||ev.metaKey)return false;const t=ev.target;if(t&&(t.closest?.('input,textarea,select,[contenteditable=true],dialog'))) return false;
    if(/^[1-5]$/.test(ev.key)){void run(()=>annotate({rating:Number(ev.key)}));return true;}if(ev.key==='0'){void run(()=>annotate({rating:null}));return true;}
    if(ev.key==='f'||ev.key==='F'){void run(()=>annotate({favorite:!entry.favorite}));return true;}if(ev.key==='m'||ev.key==='M'){void run(()=>annotate({masterpiece:!entry.masterpiece}));return true;}return false;}
  return {element:bar,show,hide,key,current:()=>entry};
}
