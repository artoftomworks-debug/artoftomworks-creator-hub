import {markNew} from './new-feature-ui.mjs';
export function recipeDifferences(recipes){
 const dimensions=r=>Number.isFinite(r?.width)&&Number.isFinite(r?.height)?r.width+' × '+r.height:'';
 const fields=[
  ['Modell',r=>r?.models?.join(' + ')],
  ['Méret',dimensions],
  ['Lépésszám',r=>r?.sampling?.steps],
  ['CFG',r=>r?.sampling?.cfg],
  ['Sampler',r=>r?.sampling?.sampler],
  ['Scheduler',r=>r?.sampling?.scheduler],
  ['LoRA-k',r=>Array.isArray(r?.loras)?r.loras.filter(l=>l.on!==false).map(l=>l.name+' × '+(l.strength??l.strength_model??'—')).sort().join(' · ')||'—':null]
 ];
 return fields.map(([label,read])=>({label,values:recipes.map(recipe=>String(read(recipe)??''))}))
  .filter(field=>field.values.some(Boolean)&&new Set(field.values).size>1);
}
export function createHistoryCompare({$,request,notify,onFinish,onRestore,ensureBackend}){
 let rows=[],picture='',sound='',dead=false;const dialog=$('compareDialog'),recipes=document.createElement('section'),controls=document.createElement('div'),votes=document.createElement('div');controls.className='finishCompareControls';votes.id='compareVotes';votes.className='compareVotes';controls.innerHTML='<label class="check"><input id="compareSplit" type="checkbox">A/B osztott nézet</label><input id="compareDivider" aria-label="A/B választóvonal" type="range" min="0" max="100" value="50"><button id="compareUseWinners" type="button">Kép- és hangnyertes használata</button><button id="compareAdvanced" type="button">Haladó Take Compare ↗</button><p id="compareNotice" role="status"></p>';
 $('compareItems').before(controls);$('compareItems').after(votes,recipes);const media=()=>[...$('compareItems').querySelectorAll('video')];
 function pause(){for(const v of media())v.pause();}
 function update(){const split=$('compareSplit').checked;$('compareItems').classList.toggle('splitComparison',split);$('compareDivider').hidden=!split;$('compareItems').style.setProperty('--divider',$('compareDivider').value+'%');for(const v of media())v.muted=v.dataset.id!==sound;$('compareUseWinners').disabled=!rows.find(e=>e.id===picture&&e.mode==='video')||!rows.find(e=>e.id===sound&&e.mode==='video');}
 $('compareSplit').onchange=update;$('compareDivider').oninput=update;
 $('comparePlay').onclick=async()=>{const list=media();if(list.some(v=>!v.paused)){pause();return;}const t=list[0]?.currentTime||0;for(const v of list){if(Math.abs(v.currentTime-t)>.08)v.currentTime=Math.min(t,Math.max(0,(v.duration||t)-.05));v.playbackRate=Number($('compareSpeed').value);v.loop=$('compareLoop').checked;}await Promise.allSettled(list.map(v=>v.play()));};
 $('compareClose').onclick=()=>dialog.close();dialog.addEventListener('close',pause);
 async function showRecipeDifferences(items){
  recipes.replaceChildren();
  const details=await Promise.all(items.map(e=>request('history/details?id='+encodeURIComponent(e.id)).catch(()=>null)));
  if(rows!==items||!dialog.open)return;
  const fields=recipeDifferences(details);
  if(fields.length){
   const table=document.createElement('table');
   const heading=document.createElement('tr');
   for(const title of ['Beállítás',...items.map((_,i)=>String.fromCharCode(65+i))]){
    const cell=document.createElement('th');cell.scope='col';cell.textContent=title;heading.append(cell);
   }
   const head=document.createElement('thead');head.append(heading);table.append(head);
   const body=document.createElement('tbody');
   for(const field of fields){
    const row=document.createElement('tr');
    const label=document.createElement('th');label.scope='row';label.textContent=field.label;row.append(label);
    for(const value of field.values){const cell=document.createElement('td');cell.textContent=value||'—';row.append(cell);}
    body.append(row);
   }
   table.append(body);recipes.append(table);
  }
  if(onRestore&&details.some(r=>r?.prompt!==undefined)){
   const restore=document.createElement('button');restore.type='button';restore.textContent='A nyertes beállításainak visszatöltése';
   restore.onclick=()=>{
    const index=items.findIndex(e=>e.id===picture);
    if(details[index]?.prompt===undefined){notify('Nincs kiolvasható recept.',true);return;}
    dialog.close();onRestore(items[index]);
   };
   recipes.append(markNew(restore,"recipe-compare"));
  }
 }
 async function open(ids){if(!Array.isArray(ids)||ids.length<2||ids.length>4)throw Error('2–4 külön eredményt válassz.');const items=await Promise.all([...new Set(ids)].map(id=>request('history/item?id='+id)));if(items.length<2||items.some(e=>e.trashed||e.incomplete))throw Error('Kész, nem törölt eredményeket válassz.');if(dead)return;rows=items;picture=items[0].id;sound=items.find(e=>e.mode==='video')?.id||'';$('compareItems').replaceChildren();votes.replaceChildren();for(const [i,e]of items.entries()){
  const box=document.createElement('article');box.className='compareCard';const title=document.createElement('h3');title.textContent=String.fromCharCode(65+i)+' · '+e.filename;const view=document.createElement(e.mode==='video'?'video':'img');view.src=e.url;view.dataset.id=e.id;view.className='compareMedia';if(e.mode==='video'){view.controls=true;view.playsInline=true;view.preload='metadata';view.loop=$('compareLoop').checked;}else view.alt=e.filename;box.append(title,view);$('compareItems').append(box);
  const choices=document.createElement('div');choices.className='compareVoteRow';const name=document.createElement('strong');name.textContent=String.fromCharCode(65+i);choices.append(name);for(const [key,text]of [['picture','Képnyertes'],['sound','Hangnyertes']]){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='radio';input.name='compareWinner'+key;input.value=e.id;input.disabled=key==='sound'&&e.mode!=='video';input.checked=(key==='picture'?picture:sound)===e.id;input.onchange=()=>{if(key==='picture')picture=e.id;else sound=e.id;update();};label.append(input,document.createTextNode(text));choices.append(label);}const favorite=document.createElement('button');favorite.textContent=e.favorite?'★':'☆';favorite.title='Kedvenc';favorite.onclick=async()=>{try{const result=await request('history/annotate',{id:e.id,favorite:!e.favorite});Object.assign(e,result);favorite.textContent=e.favorite?'★':'☆';}catch(err){notify(err.message,true);}};const rating=document.createElement('select');rating.setAttribute('aria-label','Értékelés · '+e.filename);rating.add(new Option('Értékeletlen',''));for(let n=1;n<=5;n++)rating.add(new Option(n+' / 5',String(n)));rating.value=e.rating??'';rating.onchange=async()=>{try{await request('history/annotate',{id:e.id,rating:rating.value?Number(rating.value):null});}catch(err){notify(err.message,true);}};choices.append(favorite,rating);votes.append(choices);
 }$('compareSplit').disabled=items.length!==2||items[0].mode!==items[1].mode;$('compareSplit').checked=!$('compareSplit').disabled;$('compareAdvanced').disabled=items.some(e=>e.mode!=='video');$('compareNotice').textContent='Az eredeti fájlokat nézed. A közös indítás időalapú; eltérő FPS-nél nem garantált képkockapontos szinkron.';update();dialog.showModal();void showRecipeDifferences(items);}
 $('compareUseWinners').onclick=()=>{dialog.close();onFinish([picture],'sound',{recipe:{audio:{mode:picture===sound?'edit':'replace'}},audioSourceId:sound});};
 $('compareAdvanced').onclick=async()=>{const tab=window.open('about:blank','_blank');if(!tab){notify('Engedélyezd a helyi új lap megnyitását.',true);return;}try{$('compareNotice').textContent='A haladó összehasonlítás előkészítése…';const backend=await ensureBackend(),r=await request('video-tools/compare',{ids:rows.map(e=>e.id),backend});tab.opener=null;tab.location.href=r.url;$('compareNotice').textContent='A videók átadva; újragenerálás nem indult.';}catch(e){tab.close();$('compareNotice').textContent=e.message;}};
 return {open,destroy(){dead=true;pause();controls.remove();votes.remove();recipes.remove();}};
}
