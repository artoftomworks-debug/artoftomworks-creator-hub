// 0.17.1 DEV — 🔍 Könyvtár-ellenőrzés: minden LoRA modellcsaládját a fájl tartalma (szerkezete), a Civitai-adat és a fájl
// saját adatlapja alapján összeveti. A Hub mindig a tartalomnak hisz; ez a lista megmutatja, hol tévedne a címke.
import {familyName} from './library-ui.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export async function openLoraAudit({notify=()=>{}}={}){
  const d=el('dialog',null,'generationDialog loraAuditDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();
  head.append(el('h2','🔍 LoRA-k ellenőrzése'),close);const body=el('div');body.append(el('p','Ellenőrzés folyamatban… (csak a fájlok fejlécét olvasom, semmit nem módosítok)','muted'));d.append(head,body);
  const st=document.createElement('style');st.textContent=`.loraAuditDialog{width:min(1000px,95vw);max-height:90vh}.loraAuditDialog table{width:100%;border-collapse:collapse;font-size:13px}.loraAuditDialog th,.loraAuditDialog td{padding:5px 8px;border-bottom:1px solid #22404c;text-align:left;vertical-align:top}.loraAuditDialog td.ok{color:#9fe0a8}.loraAuditDialog td.bad{color:#ffb3ac}.loraAuditDialog .counts{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.loraAuditDialog .counts span{border:1px solid #3d6170;border-radius:999px;padding:2px 9px;font-size:12px}.loraAuditDialog .scroll{max-height:56vh;overflow:auto}`;d.append(st);
  d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  try{const r=await fetch('/api/library/audit',{cache:'no-store'}).then(async x=>{if(!x.ok)throw Error((await x.json().catch(()=>({}))).error||'Az ellenőrzés nem sikerült.');return x.json();});
    body.replaceChildren();const counts=el('div',null,'counts');for(const [f,n] of Object.entries(r.counts).sort((a,b)=>b[1]-a[1]))counts.append(el('span',(f==='unknown'?'Ismeretlen':familyName(f))+' · '+n));
    body.append(el('p',`${r.total} LoRA ellenőrizve.`),counts);
    if(!r.mismatches.length&&!r.unknown.length){body.append(el('p','✓ Minden LoRA címkéje egyezik a tartalmával.'));return;}
    if(r.mismatches.length){body.append(el('h3',`⚠ ${r.mismatches.length} LoRA mást állít magáról, mint ami valójában`),el('p','A Hub ezeknél a tartalom szerinti családot használja – ezért jelennek meg a megfelelő modell mellett.','muted'));
      const wrap=el('div',null,'scroll'),t=el('table'),hr=el('tr');for(const h of ['LoRA','A Hub ezt használja','A fájl szerkezete','Civitai','A fájl adatlapja'])hr.append(el('th',h));t.append(hr);
      for(const m of r.mismatches){const tr=el('tr'),s=m.sources||{};tr.append(el('td',m.name),el('td',familyName(m.family),'ok'),el('td',s.structure?familyName(s.structure):'—'),el('td',s.civitai?familyName(s.civitai):'—',s.civitai&&s.civitai!==m.family?'bad':''),el('td',s.file?familyName(s.file):'—',s.file&&s.file!==m.family?'bad':''));t.append(tr);}
      wrap.append(t);body.append(wrap);}
    if(r.unknown.length){body.append(el('h3',`? ${r.unknown.length} LoRA családja nem állapítható meg`),el('p','Ezek a „Minden LoRA mutatása” beállítással érhetők el. Ha tudod, melyik modellhez valók, a Civitai-adat (Stability Matrix) letöltése segít.','muted'));const ul=el('ul');for(const u of r.unknown.slice(0,200))ul.append(el('li',u.name));body.append(ul);}
  }catch(e){body.replaceChildren(el('p',e.message));notify(e.message,true);}
}
