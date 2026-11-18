import {directorReview} from './director-model.mjs';
import {optionLabels} from './labels.mjs';
import {TIMES,CAMERAS,VERSION} from './engine.mjs';
export function mountDirector({node,button,$,t,getState,persist,copy,download,fieldName}){
 let stamp='';const host=$('directorBody');
 function go(id){const card=$('shot-'+id);if(!card)return;card.scrollIntoView({behavior:'smooth',block:'start'});card.querySelector('.shot-head input')?.focus({preventScroll:true});}
 function name(code,values,index){return optionLabels(getState().language,index)[values.indexOf(code)]||code;}
 function summary(row){return [row.index+'. '+row.title,`${row.start}–${row.end} s`,row.time==='custom'?row.timeText:name(row.time,TIMES,1),row.camera==='planned'?t('directorPlanned'):name(row.camera,CAMERAS,3),t(row.source)].join(' · ');}
 function findingText(f){return [t(f.code)+(f.field?' · '+fieldName(f.field):''),f.code==='directorChange'?t('directorBefore')+': '+f.previous+'\n'+t('directorAfter')+': '+f.evidence:f.evidence].filter(Boolean).join('\n');}
 function report(){const p=getState(),review=directorReview(p);return ['ARTOFTOMWORKS SCENE DNA '+VERSION,p.title,t('directorTitle'),t('directorLimit'),'',...review.rows.map(summary),'',t('directorFindings'),...review.findings.map(f=>[t(f.reviewed?'directorIntentional':'directorReview'),t('shot')+' '+review.rows.find(r=>r.id===f.shot)?.index,findingText(f)].join(' · '))].join('\n\n');}
 function refresh(){const p=getState(),review=directorReview(p),next=JSON.stringify([p.language,p.title,review]);if(stamp===next)return;stamp=next;host.replaceChildren();
  $('directorCopy').disabled=$('directorExport').disabled=!p.shots.length;
  $('directorCount').textContent=t('directorPending')+': '+review.pending+' · '+t('directorIntentional')+': '+review.reviewed+' · '+t('total')+': '+review.total+' s';
  if(!p.shots.length){host.append(node('p',t('empty')));return;}
  const wrap=node('div');wrap.className='director-table-wrap';const table=node('table');table.className='director-table';const caption=node('caption',t('directorOverview'));table.append(caption);const head=node('thead'),tr=node('tr');
  for(const label of ['shot','directorTimeline','time','camera','directorPromptSource']){const th=node('th',label==='time'?fieldName('time'):t(label));th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=node('tbody');
  for(const row of review.rows){const line=node('tr'),title=node('td');title.append(button(row.index+'. '+row.title,()=>go(row.id)));line.append(title,node('td',`${row.start}–${row.end} s`),node('td',row.time==='custom'?row.timeText:name(row.time,TIMES,1)),node('td',row.camera==='planned'?t('directorPlanned'):name(row.camera,CAMERAS,3)),node('td',t(row.source)));body.append(line);}
  table.append(body);wrap.append(table);host.append(wrap,node('h3',t('directorFindings')));
  if(!review.findings.length)host.append(node('p',t('directorClear')));
  for(const f of review.findings){const box=node('article');box.className='director-finding '+(f.reviewed?'is-reviewed':f.level);box.dataset.directorCode=f.code;
   const row=review.rows.find(r=>r.id===f.shot);box.append(node('h4',t('shot')+' '+row.index+' · '+t(f.code)+(f.field?' · '+fieldName(f.field):'')));
   const evidence=node('p',f.code==='directorChange'?t('directorBefore')+': '+f.previous+'\n'+t('directorAfter')+': '+f.evidence:f.evidence);evidence.className='director-evidence';if(evidence.textContent)box.append(evidence);
   const tools=node('div');tools.className='toolbar';tools.append(button(t('directorOpen'),()=>go(f.shot)));const label=node('label');label.className='lock';const check=node('input');check.type='checkbox';check.checked=f.reviewed;check.dataset.directorReview=f.fingerprint;check.onchange=()=>{const values=new Set(getState().reviewedDirectorFindings||[]);if(check.checked){if(values.size>=120)values.delete(values.values().next().value);values.add(f.fingerprint);}else values.delete(f.fingerprint);getState().reviewedDirectorFindings=[...values];persist();refresh();};label.append(check,node('span',t('directorIntentional')));tools.append(label);box.append(tools);host.append(box);
  }
 }
 $('directorJump').onclick=()=>{$('directorPanel').open=true;refresh();$('directorPanel').scrollIntoView({behavior:'smooth',block:'start'});};
 $('directorPanel').ontoggle=()=>{if($('directorPanel').open)refresh();};
 $('directorCopy').onclick=()=>void copy(report());$('directorExport').onclick=()=>download(report(),'SceneDNA_Director_Review.txt');
 $('directorBadge').onclick=()=>{$('directorBadge').hidden=true;try{localStorage.setItem('artoftomworks.scene-dna.new.director06','seen');}catch{}};
 try{$('directorBadge').hidden=localStorage.getItem('artoftomworks.scene-dna.new.director06')==='seen';}catch{}
 return {refresh};
}
