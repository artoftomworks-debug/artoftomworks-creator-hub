/* 0.17.1: közös képadat-panel – az Előzmények nagy nézete és a Rács nagy nézete ugyanazt mutatja */
import {parseQuery,highlightParts} from './prompt-search.mjs';
let highlightTerms=[];let highlightNeg=false;
/* 0.17.1: „Szó a promptban” – a talált szavak kiemelése a nagy nézetben */
export function setHighlight(query,{negative=false}={}){highlightTerms=parseQuery(query||'');highlightNeg=!!negative;}
function fill(node,text,on){if(!on||!highlightTerms.length){node.textContent=text;return;}node.replaceChildren(...highlightParts(text,highlightTerms).map(p=>{if(!p.mark)return document.createTextNode(p.text);const m=document.createElement('mark');m.className='promptHit';m.textContent=p.text;return m;}));}
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export function renderMediaDetails(data,value,element=make){data.replaceChildren();if(!value)return;const chips=element('div',null,'quickChips');for(const [label,v]of [['Modell',value.models?.join(' · ')],['Seed',value.seed],['Méret',value.width&&value.height?value.width+' × '+value.height:null],['Steps',value.sampling?.steps],['CFG',value.sampling?.cfg],['Sampler',value.sampling?.sampler],['Scheduler',value.sampling?.scheduler],['Hossz',value.seconds?value.seconds.toFixed(3)+' mp':null]])if(v!==undefined&&v!==null&&v!=='')chips.append(element('span',label+': '+v));data.append(chips);
 for(const [label,text,isNeg]of [['Prompt',value.prompt,false],['Negatív prompt',value.negative,true]])if(text){const on=!isNeg||highlightNeg,row=element('details',null,'quickPrompt'),summary=element('summary'),line=element('span');line.append(document.createTextNode(label),document.createTextNode(': '));const lineText=element('span');fill(lineText,text,on);line.append(lineText);const full=element('p');fill(full,text,on);const copy=element('button','Másolás');copy.onclick=async e=>{e.preventDefault();try{await navigator.clipboard.writeText(text);copy.textContent='Másolva';}catch{copy.textContent='Másolás nem elérhető';}};summary.append(line,copy);row.append(summary,full);if(on&&highlightTerms.some(t=>!t.neg)&&full.querySelector('mark'))row.open=true;data.append(row);}
 if(value.loras?.length){const row=element('p',null,'quickLoras');row.textContent='LoRA: '+value.loras.map(l=>l.name+' × '+l.strength+(l.clip!=null?' / '+l.clip:'')).join(' · ');data.append(row);}
 else if(value.loras)data.append(element('p','LoRA: nincs','quickLoras'));
 if(value.metadataMessage)data.append(element('small',value.metadataMessage));
}
