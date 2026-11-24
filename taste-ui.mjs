// 0.16 DEV — „✦ Mi vált be?” – az ízlésprofil ablaka. Csak kérésre nyílik; ha a Hub valami tényleg erőset talál
// (például egy témánál az egyik modell átlaga legalább 1 ponttal jobb), a gombon egy kis pötty jelzi – felugró ablak nincs.
import {topicOf} from './taste.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const css=`#tasteButton{position:relative}#tasteButton.strong::after{content:'';position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:var(--gold,#f2c584)}
.tasteDialog{width:min(860px,94vw)}.tasteDialog table{width:100%;border-collapse:collapse;font-size:14px}.tasteDialog th,.tasteDialog td{text-align:left;padding:5px 8px;border-bottom:1px solid #ffffff14}
.tasteDialog td.num{text-align:right;font-variant-numeric:tabular-nums}.tasteDialog h3{margin:16px 0 6px;color:var(--gold,#f2c584);font-size:16px}.tasteDialog .tasteTip{padding:10px 12px;border:1px solid #d9a35b;border-radius:10px;background:#2a2112;color:#ffe2b8}
.tasteDialog .tasteTip button{margin-left:8px;min-height:28px}`;
const TOPIC={portrait:'Portré',landscape:'Táj',other:'Egyéb téma'},FORMAT={portrait:'álló',landscape:'fekvő',square:'négyzetes'};
const num=v=>String(v).replace('.',',');
export function installTaste({request,current,selectModel,models=()=>[]}){
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  const btn=el('button','✦ Mi vált be?');btn.type='button';btn.id='tasteButton';btn.title='Ízlésprofil: a saját értékeléseidből (csillag, 1–5) megmutatja, melyik modell, lépésszám és formátum vált be nálad. Csak javaslat.';
  document.getElementById('historyRefresh')?.before(btn);
  async function load(){const r=await fetch('/api/taste',{cache:'no-store'});if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'Az ízlésprofil most nem érhető el.');return r.json();}
  async function mark(){try{const a=await load();btn.classList.toggle('strong',!!a.strong);btn.dataset.rated=a.rated;}catch{}}
  setTimeout(mark,4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)mark();});
  btn.onclick=async()=>{btn.disabled=true;let a;try{a=await load();}catch(e){btn.disabled=false;return;}finally{btn.disabled=false;}btn.classList.toggle('strong',!!a.strong);show(a);};
  function show(a){
    const d=el('dialog',null,'generationDialog tasteDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();head.append(el('h2','✦ Mi vált be?'),close);d.append(head);
    const sum=el('p',null,'muted');sum.append(el('span',`${a.rated} értékelt kép · ${a.favorites} kedvenc`),' · ',el('span','Pontszám: az 1–5 értékelés; a csak csillaggal jelölt kép 5-nek számít. Csak javaslat – semmit nem állít át magától.'));d.append(sum);
    if(!a.enough){d.append(el('p',`Még kevés az értékelt kép (${a.rated}). Értékelj legalább 5–10 képet az Előzményekben vagy a ▦ Rácsban (csillag vagy 1–5), és itt megjelenik, mi vált be nálad.`,'tasteTip'));d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();return;}
    // Javaslat ehhez a prompthoz
    const c=current(),curModel=c?.info?.models?.[0]||'',t=topicOf(c?.prompt||''),hit=a.topics.find(x=>x.topic===t);
    if(hit){const tip=el('div',null,'tasteTip');const same=String(curModel).includes(hit.best.model);
      tip.append(el('span','Ehhez a prompthoz'),' (',el('span',TOPIC[t]),'): ',el('span',`eddig ez vált be: ${hit.best.model} – átlag ${num(hit.best.avg)} (${hit.best.n} kép).`));
      const target=models().find(m=>String(m.name).includes(hit.best.model));
      if(same)tip.append(' ',el('span','Ez a modell van most kiválasztva.'));else if(target){const go=el('button','Váltás erre');go.type='button';go.onclick=()=>{d.close();selectModel(target.id);};tip.append(go);}
      d.append(tip);}
    d.append(el('h3','Modellek'));const tm=el('table');tm.append(row(['Modell','Átlag','Képek','Kedvencek','Legjobb lépésszám'],'th'));for(const m of a.models)tm.append(row([m.model,num(m.avg),m.n,m.fav,m.bestSteps??'—']));d.append(tm);
    if(a.topics.length){d.append(el('h3','Témánként'));const tt=el('table');tt.append(row(['Téma','Legjobb modell','Átlag','Második','Átlag'],'th'));for(const x of a.topics)tt.append(row([TOPIC[x.topic],x.best.model,num(x.best.avg)+' ('+x.best.n+')',x.second?.model||'—',x.second?num(x.second.avg)+' ('+x.second.n+')':'—']));d.append(tt);}
    if(a.steps.length){d.append(el('h3','Lépésszám modellenként'));const ts=el('table');ts.append(row(['Modell','Legjobb','Átlag','Leggyengébb','Átlag'],'th'));for(const x of a.steps)ts.append(row([x.model,x.best.steps,num(x.best.avg)+' ('+x.best.n+')',x.worst.steps,num(x.worst.avg)+' ('+x.worst.n+')']));d.append(ts);}
    if(a.formats.length){d.append(el('h3','Formátum'));const tf=el('table');tf.append(row(['Formátum','Átlag','Képek'],'th'));for(const x of a.formats)tf.append(row([FORMAT[x.format],num(x.avg),x.n]));d.append(tf);}
    if(a.loras.length){d.append(el('h3','LoRA-k hatása'));const tl=el('table');tl.append(row(['LoRA','Vele','Nélküle'],'th'));for(const x of a.loras)tl.append(row([x.lora,num(x.with.avg)+' ('+x.with.n+')',num(x.without.avg)+' ('+x.without.n+')']));d.append(tl);}
    d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  }
  function row(cells,tag='td'){const tr=el('tr');for(const [i,v] of cells.entries()){const c=el(tag,String(v));if(tag==='td'&&i>0&&/^[\d,—( )]+$/.test(String(v)))c.className='num';tr.append(c);}return tr;}
  return {refresh:mark};
}
