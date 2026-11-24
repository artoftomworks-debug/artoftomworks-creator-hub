// 0.16 DEV — 🔊 Hangterv sor a „Jelenet és mozgás” alatt. Csak Videó fülön és hangot is generáló modellnél látszik.
import {SOUND_CHOICES,normalizeSound,buildSoundText,soundSummary} from './sound-plan.mjs';
const css=`.soundPlan{border:1px solid #4a6b78;border-radius:8px;padding:6px 9px;margin:7px 0;background:#112b35}
.soundPlan>summary{cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;list-style:none}.soundPlan>summary::-webkit-details-marker{display:none}
.soundPlan>summary::before{content:'▸';color:var(--gold)}.soundPlan[open]>summary::before{content:'▾'}
.soundPlan .spTitle{font-weight:700}.soundPlan .spSum{color:#a8beca;font-size:.85em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.soundPlan .spGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:8px}.soundPlan label{font-size:.85em;display:flex;flex-direction:column;gap:3px}
.soundPlan textarea{width:100%;box-sizing:border-box;font-size:.85em}.soundPlan .spFoot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}.soundPlan .spFoot small{color:#a8beca;flex:1}
.soundPlan button{width:auto;min-height:28px;padding:2px 10px;font-size:.8em;margin:0}.soundPlan label.check{flex-direction:row;align-items:center;font-size:.85em}
.soundPlan[hidden]{display:none!important}`;
function el(tag,props={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...kids.filter(k=>k!=null));return e;}
export function createSoundPlan({$,getState,current,edited,save,capable,translate=t=>t}){
  if(document.getElementById('soundPlan'))return null;document.head.append(el('style',{textContent:css}));
  const sel=key=>el('select',{},...SOUND_CHOICES[key].map(([v,l])=>el('option',{value:v,textContent:l})));
  const amb=sel('ambience'),mus=sel('music'),spk=sel('speech'),line=el('input',{type:'text',maxLength:300,placeholder:'Pl. Good morning, world. (angolul a legbiztosabb)'});
  const lineBox=el('label',{},el('span',{textContent:'Amit mond'}),line);
  const on=el('input',{type:'checkbox',id:'soundPlanEnabled'}),text=el('textarea',{rows:2,maxLength:2000,spellcheck:false});
  const state=el('small'),back=el('button',{type:'button',textContent:'Választások szövegének használata',hidden:true}),reset=el('button',{type:'button',textContent:'Alaphelyzet'});
  const sum=el('span',{class:'spSum'});
  const box=el('details',{id:'soundPlan',class:'soundPlan',hidden:true},
    el('summary',{},el('span',{class:'spTitle',textContent:'🔊 Hang'}),sum,el('label',{class:'check',title:'Bekapcsolva a hangleírás a videó promptjába kerül'},on,el('span',{textContent:'Használat'}))),
    el('div',{class:'spGrid'},el('label',{},el('span',{textContent:'Környezeti hang'}),amb),el('label',{},el('span',{textContent:'Zene'}),mus),el('label',{},el('span',{textContent:'Beszéd'}),spk),lineBox),
    el('label',{style:'margin-top:8px'},el('span',{textContent:'Hozzáadott hangleírás · angol, szerkeszthető'}),text),
    el('div',{class:'spFoot'},state,back,reset));
  const anchor=()=>document.getElementById('motionPanel');
  const place=()=>{const a=anchor();if(a&&a.nextElementSibling!==box)a.after(box);return !!a;};
  const get=()=>normalizeSound(current().soundPlan);
  const put=s=>{current().soundPlan=normalizeSound(s);edited();save();render();};
  function render(){const s=get();amb.value=s.ambience;mus.value=s.music;spk.value=s.speech;line.value=s.line;lineBox.hidden=s.speech!=='line';on.checked=s.enabled;
    const built=buildSoundText(s);if(document.activeElement!==text)text.value=s.custom?s.text:built;back.hidden=!s.custom;
    state.textContent=translate(s.custom?'Saját szöveg – a választók nem írják át.':built?'A választásokból összeállított szöveg.':'Válassz legalább egy hangot, vagy írj saját leírást.');
    sum.textContent=sumText(s);}
  function sumText(s){const sm=soundSummary(s,(k,v)=>translate(SOUND_CHOICES[k].find(x=>x[0]===v)?.[1]||v)).replace('saját szöveg',translate('saját szöveg'));return s.enabled&&sm?sm:translate(s.enabled?'nincs megadva':'kikapcsolva');}
  const choose=()=>{const s=get();put({...s,enabled:true,ambience:amb.value,music:mus.value,speech:spk.value,line:line.value});};
  for(const x of [amb,mus,spk])x.onchange=choose;line.oninput=()=>{const s=get();current().soundPlan=normalizeSound({...s,enabled:true,line:line.value});edited();save();if(!s.custom)text.value=buildSoundText(current().soundPlan);sum.textContent=sumText(normalizeSound(current().soundPlan));};
  on.onchange=()=>put({...get(),enabled:on.checked});
  text.oninput=()=>{const s=get();current().soundPlan=normalizeSound({...s,enabled:true,custom:true,text:text.value});edited();save();back.hidden=false;};
  text.onblur=()=>render();back.onclick=()=>put({...get(),custom:false,text:''});reset.onclick=()=>put({});
  let key='';
  function tick(){if(!place())return;const st=getState(),c=st.mode==='video'?current():null,show=!!c&&capable(c);box.hidden=!show;if(!show)return;const k=st.mode+'|'+(c.automatic?.id||'')+'|'+JSON.stringify(c.soundPlan||{});if(k!==key&&!box.contains(document.activeElement)){key=k;render();}}
  tick();const timer=setInterval(tick,800);
  return {render,destroy(){clearInterval(timer);box.remove();}};
}
