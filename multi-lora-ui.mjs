/* 0.17.1: ⧉ LoRA-k modellenként – több modelles generáláskor egy helyen látszik, melyik modell melyik LoRA-t kapja.
   A LoRA-beállítás családonként közös (ugyanaz a sáv), így egy Flux LoRA minden kijelölt Flux-modellre érvényes. */
import {familyName} from './library-ui.mjs';
import {sameName,removeLora} from './lora-state.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const short=n=>String(n||'').split(/[\\/]/).pop().replace(/\.safetensors$/i,'');

/* Tiszta függvény (tesztelhető): kijelölt modellek + LoRA-sorok → családonkénti csoportok */
export function groupByFamily({models,rows,familyOf}){
 const groups=new Map();
 for(const m of models){const f=m.family||'';if(!groups.has(f))groups.set(f,{family:f,models:[],loras:[]});groups.get(f).models.push(m);}
 const other=[];
 for(const r of rows){if(r.stripRemoved)continue;const f=familyOf(r);const g=f&&groups.get(f);if(g)g.loras.push(r);else other.push(r);}
 return {groups:[...groups.values()],other};
}
export const wanted=r=>!!r.on||!!r.parked;
/* Be/ki egy adott családra: az aktív modell családjánál „Be”, másnál „Vár” */
export function setWanted(row,value,{rowFamily,activeFamily}){if(rowFamily&&rowFamily===activeFamily){row.on=!!value;delete row.parked;}else{row.on=false;if(value)row.parked=true;else delete row.parked;}}

export function createMultiLoraUI({current,models,chosenIds,activeFamily,edited,render,isBusy,translate=t=>t}){
 const T=t=>translate(t);
 function familyOf(r){const c=current(),hit=(c.catalog?.loras||[]).find(l=>sameName(l.name,r.name));return hit?.family||r.family||null;}
 function open(){
  const c=current(),ids=chosenIds(),all=models(),chosen=ids.map(id=>all.find(m=>m.id===id)).filter(Boolean);
  const rows=[...(c.controls?.loras||[]),...(c.controls?.addedLoras||[])];
  const d=el('dialog',null,'generationDialog multiLoraDialog'),head=el('div',null,'sectionTitle');head.append(el('h2','⧉ LoRA-k modellenként'));const close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();head.append(close);d.append(head);
  d.append(el('p','A LoRA-beállítás modellcsaládonként közös: egy Flux LoRA minden kijelölt Flux-modellnél életbe lép. Más családú LoRA-t a LoRA-k fülön adhatsz hozzá – „◐ Vár” állapotba kerül.','mlNote'));
  if(!chosen.length){d.append(el('p','Még nincs kijelölt modell a több modelles generáláshoz. A ✎ gombbal választhatsz.'));}
  const {groups,other}=groupByFamily({models:chosen,rows,familyOf});
  const act=activeFamily();
  for(const g of groups){
   const box=el('section',null,'mlGroup'),h=el('h3',null);h.append(el('span',familyName(g.family)||T('Ismeretlen család')),document.createTextNode(' · '),el('span',T('${0} modell').replace('${0}',g.models.length)));box.append(h);
   box.append(el('p',g.models.map(m=>short(m.name)).join(' · '),'mlModels'));
   if(!g.loras.length)box.append(el('p','Ehhez a családhoz nincs LoRA a sávon – ezek a modellek LoRA nélkül futnak.','mlEmpty'));
   for(const r of g.loras){
    const line=el('label',null,'mlLora'),cb=el('input');cb.type='checkbox';cb.checked=wanted(r);cb.disabled=isBusy();
    const name=el('span',short(r.name));name.title=r.name;
    const st=el('input');st.type='number';st.min=-4;st.max=4;st.step=.05;st.value=r.strength??.8;st.disabled=isBusy();st.setAttribute('aria-label',r.name+' – erősség');
    cb.onchange=()=>{if(isBusy())return;setWanted(r,cb.checked,{rowFamily:g.family,activeFamily:act});edited();render();};
    st.onchange=()=>{if(isBusy())return;const v=Number(st.value);if(!Number.isFinite(v)||Math.abs(v)>4){st.value=r.strength;return;}r.strength=v;edited();render();};
    line.append(cb,name,st);box.append(line);
   }
   d.append(box);
  }
  if(other.length){const box=el('section',null,'mlGroup mlOther');box.append(el('h3','Nem illik egyik kijelölt modellhez sem'));for(const r of other)box.append(el('p',short(r.name)+(familyOf(r)?' · '+familyName(familyOf(r)):' · '+T('ismeretlen család')),'mlModels'));d.append(box);}
  document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();
 }
 return {open};
}

/* 0.17.1: „LoRA-k ebben a körben” – a csoportos generálás ablakába ágyazott blokk.
   Családonként: a kijelölt modellek, a LoRA-k (pipa · erősség · ✕) és „+ LoRA hozzáadása” kereső – az aktív modelltől függetlenül. */
export function addLoraRow(c,name,family,activeFamily){const rows=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])];let row=rows.find(r=>sameName(r.name,name));if(row){delete row.stripRemoved;}else{row={name,on:false,strength:.8,clip:null,family};(c.controls.addedLoras||=[]).push(row);}row.family=row.family||family;setWanted(row,true,{rowFamily:family,activeFamily});return row;}
export function loraSummary(groups,wantedOf=wanted){return groups.map(g=>[g.family,g.loras.filter(wantedOf).length]);}
export function createLoraBlock({current,activeFamily,edited,render,isBusy=()=>false,translate=t=>t,inventory=()=>[],suggest=null}){
 const T=t=>translate(t);
 const box=el('section',null,'mlBlock');const title=el('h3','LoRA-k ebben a körben');const body=el('div');box.append(title,body);
 let lastModels=[];
 const catalog=()=>{const fresh=inventory();return fresh?.length?fresh:(current().catalog?.loras||[]);};
 function familyOf(r){const hit=catalog().find(l=>sameName(l.name,r.name));return hit?.family||r.family||null;}
 function rows(){const c=current();return [...(c.controls?.loras||[]),...(c.controls?.addedLoras||[])];}
 function changed(){edited();render();update(lastModels);box.dispatchEvent(new Event('lorachange'));}
 function picker(g,host){
  const wrap=el('div',null,'mlPicker'),inp=el('input'),res=el('div',null,'mlResults');inp.type='search';inp.placeholder=T('LoRA keresése ehhez a családhoz…');wrap.append(inp,res);
  const fill=()=>{const q=inp.value.trim().toLowerCase(),have=new Set(rows().filter(r=>!r.stripRemoved).map(r=>String(r.name).toLowerCase()));const list=catalog().filter(l=>l.family===g.family&&!have.has(String(l.name).toLowerCase())&&(!q||String(l.name).toLowerCase().includes(q))).sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||String(a.name).localeCompare(String(b.name))).slice(0,14);
   res.replaceChildren(...(list.length?list.map(l=>{const b=el('button',(l.favorite?'★ ':'')+short(l.name),'mlHit');b.type='button';b.title=l.name;b.onclick=()=>{if(isBusy())return;addLoraRow(current(),l.name,g.family,activeFamily());changed();};return b;}):[el('span',q?T('Nincs ilyen LoRA ebben a családban.'):T('Nincs több LoRA ebben a családban.'),'mlEmpty')]));};
  inp.oninput=fill;fill();host.replaceWith(wrap);inp.focus();}
 function update(models){lastModels=models||[];const {groups,other}=groupByFamily({models:lastModels,rows:rows(),familyOf});const act=activeFamily();
  body.replaceChildren();if(!groups.length){body.append(el('p','Jelölj ki legalább egy modellt.','mlEmpty'));return;}
  for(const g of groups){const sec=el('div',null,'mlGroup'),h=el('div',null,'mlHead');h.append(el('strong',familyName(g.family)||T('Ismeretlen család')),document.createTextNode(' · '),el('span',T('${0} modell').replace('${0}',g.models.length)));const names=el('span',' ('+g.models.map(m=>short(m.name)).join(', ')+')','mlModels');h.append(names);sec.append(h);
   const line=el('div',null,'mlLine');
   if(!g.loras.length)line.append(el('span','Nincs LoRA – ezek a modellek LoRA nélkül futnak.','mlEmpty'));
   for(const r of g.loras){const chip=el('label',null,'mlChip'+(wanted(r)?' on':'')),cb=el('input');cb.type='checkbox';cb.checked=wanted(r);cb.disabled=isBusy();const nm=el('span',short(r.name));nm.title=r.name;const st=el('input');st.type='number';st.min=-4;st.max=4;st.step=.05;st.value=r.strength??.8;st.disabled=isBusy();st.setAttribute('aria-label',r.name);const rm=el('button','✕','mlRemove');rm.type='button';rm.title=T('Levétel');rm.disabled=isBusy();
    cb.onchange=()=>{if(isBusy())return;setWanted(r,cb.checked,{rowFamily:g.family,activeFamily:act});changed();};
    st.onchange=()=>{if(isBusy())return;const v=Number(st.value);if(!Number.isFinite(v)||Math.abs(v)>4){st.value=r.strength;return;}r.strength=v;edited();render();box.dispatchEvent(new Event('lorachange'));};
    rm.onclick=ev=>{ev.preventDefault();if(isBusy())return;removeLora(current(),r);changed();};
    chip.append(cb,nm,st,rm);line.append(chip);}
   const add=el('button','+ LoRA hozzáadása','mlAdd');add.type='button';add.disabled=isBusy()||!g.family;add.onclick=()=>picker(g,add);line.append(add);if(suggest&&g.family){const sg=el('button','✦ Ajánlás','mlAdd');sg.type='button';sg.title=T('A helyi MI a prompt alapján LoRA-t és erősséget javasol ehhez a családhoz – csak javaslat');sg.disabled=isBusy();sg.onclick=()=>void suggest(g.family,()=>changed(),g.models);line.append(sg);}sec.append(line);body.append(sec);}
  if(other.filter(wanted).length){const n=el('p',null,'mlEmpty');n.append(el('span','Bekapcsolt, de egyik kijelölt modellhez sem illő LoRA:'),' '+other.filter(wanted).map(r=>short(r.name)).join(', '));body.append(n);}
 }
 function counts(models){const {groups}=groupByFamily({models:models||lastModels,rows:rows(),familyOf});return groups.map(g=>({family:g.family,name:familyName(g.family)||T('Ismeretlen család'),n:g.loras.filter(wanted).length}));}
 return {element:box,update,counts};
}
