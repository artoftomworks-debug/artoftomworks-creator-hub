export function getStartPlan($,group=false){
 const id=group?'groupStartPlan':'startPlan';
 const existing=$(id);
 if(existing)return existing;
 const plan=document.createElement(group?'details':'p');
 plan.id=id;
 plan.className='startPlan';
 plan.hidden=true;
 if(group)plan.append(document.createElement('summary'),document.createElement('ul'));
 $('start').closest('.actions').before(plan);
 return plan;
}

import {markNew} from './new-feature-ui.mjs';
import {availableSizePresets,sizeProblem,nearestSize,savedSizeLabel,saveSizePreset} from './settings.mjs';
export function createWorkbench({$,current,getState,request,act,edited,capture,save,renderLoras,draw,notify,onFavorite=()=>{},samplingInfo=()=>''}){
 let loading=false;
 const mode=()=>getState().mode;
 const selectValues=()=>{const c=current();return (c.info?.modelFields||[]).map(field=>(c.controls.models||[]).find(row=>row.node===field.node&&row.key===field.key)||field);};
 const selectedFamily=()=>{const c=current(),field=c.catalog?.fields?.[0],selected=selectValues().find(r=>r.node===field?.node&&r.key===field?.key);return selected&&selected.name!==field?.name?field?.items.find(i=>i.name===selected.name)?.family:field?.family;};
 const status=family=>!selectedFamily()||!family?'unknown':family===selectedFamily()?'family-match':'incompatible';
 function modelChoices(){
  const c=current(),filter=$('modelSearch').value.toLocaleLowerCase();$('modelFields').replaceChildren();
  for(const field of c.info?.modelFields||[]){
   const catalog=c.catalog?.fields.find(f=>f.node===field.node&&f.key===field.key),selected=selectValues().find(r=>r.node===field.node&&r.key===field.key)?.name||field.name;
   const label=document.createElement('label');label.textContent=(catalog?.type==='CheckpointLoaderSimple'?'Checkpoint':'Generálómodell')+' · #'+field.node;
   const select=document.createElement('select');select.setAttribute('aria-label',label.textContent);select.dataset.model=field.node;
   const items=catalog?.items||[{name:field.name,family:null}];let excluded=0;
   for(const item of items){const s=item.name===field.name?'source':!catalog?.family||!item.family?'unknown':catalog.family===item.family?'family-match':'incompatible';
    if(s==='incompatible'){excluded++;continue;}if(s==='unknown'&&!c.controls.allowUnknownModels&&item.name!==selected)continue;if(!item.name.toLocaleLowerCase().includes(filter)&&item.name!==selected)continue;
    select.add(new Option(item.name+(s==='source'?' · forrás':s==='unknown'?' · család ismeretlen':' · '+item.family),item.name));
   }
   select.value=selected;select.onchange=()=>{c.controls.models=(c.info.modelFields||[]).map(f=>({...f,name:f.node===field.node&&f.key===field.key?select.value:selectValues().find(r=>r.node===f.node&&r.key===f.key)?.name||f.name}));edited();loraChoices();summary();};
   label.append(select);$('modelFields').append(label);
   if(excluded){const p=document.createElement('p');p.className='muted';p.textContent=excluded+' eltérő családú modell elrejtve.';$('modelFields').append(p);}
  }
  $('catalogState').textContent=loading?'Helyi fájllista és metaadatok beolvasása…':c.catalog?'Katalógus betöltve. A családegyezés előszűrés, nem futtathatósági garancia. A szövegkódoló és a VAE továbbra is a workflow-ból érkezik.':'Tölts be workflow-t, majd frissítsd a helyi katalógust.';
  $('unknownModels').checked=!!c.controls.allowUnknownModels;
 }
 function loraChoices(){
  const c=current(),filter=$('addLoraSearch').value.toLocaleLowerCase(),selected=$('addLoraSelect').value;$('addLoraSelect').replaceChildren(new Option('Válassz LoRA-t…',''));
  let matches=0,unknown=0,excluded=0;const items=[...(c.catalog?.loras||[])].sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||a.name.localeCompare(b.name,'hu',{numeric:true}));
  for(const item of items){const s=status(item.family),allowed=s==='family-match'||s==='unknown'&&c.controls.allowUnknownLoras;if(s==='incompatible')excluded++;else if(s==='unknown')unknown++;else matches++;if(!allowed&&!$('showAllLoras').checked)continue;if(!item.name.toLocaleLowerCase().includes(filter))continue;const isOn=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])].some(r=>r.name===item.name&&r.on);const option=new Option((isOn?'✓ Bekapcsolva · ':'')+(item.favorite?'★ ':'')+item.name+' · '+(s==='incompatible'?item.family+' · eltérő család':s==='unknown'?'család nem igazolt':item.family),item.name);option.disabled=!allowed;$('addLoraSelect').add(option);}
  const previous=[...$('addLoraSelect').options].find(o=>o.value===selected&&!o.disabled);if(previous)$('addLoraSelect').value=selected;
  $('loraCatalogState').textContent=c.catalog?`${matches} családegyezés · ${unknown} ismeretlen · ${excluded} eltérő család. A kedvencek elöl szerepelnek.`:'A hozzáadáshoz előbb válassz modellt.';loraButtons();
 }
 function loraButtons(){const c=current(),item=c.catalog?.loras.find(i=>i.name===$('addLoraSelect').value),allowed=item&&(status(item.family)==='family-match'||status(item.family)==='unknown'&&c.controls.allowUnknownLoras);$('addLora').disabled=!allowed||c.info?.modelFields.length!==1;$('favoriteLora').disabled=!item?.localId;$('favoriteLora').textContent=item?.favorite?'★ Kedvenc':'☆ Kedvenc';}
 function announceLora(row){notify('✓ Bekapcsolva · '+row.name+' · erősség '+row.strength);}
 function activateLora(name){const c=current(),item=c.catalog?.loras.find(i=>i.name===name);if(!item||status(item.family)==='incompatible'||status(item.family)==='unknown'&&!c.controls.allowUnknownLoras)throw Error('Ez a LoRA nem adható hozzá a kiválasztott modellhez.');if(c.info?.modelFields.length!==1)throw Error('Új LoRA-hoz egyértelműen egy modellbetöltő szükséges.');const existing=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])].find(r=>r.name===name);if(existing){existing.on=true;delete existing.stripRemoved;announceLora(existing);return;}const field=c.info.modelFields[0];(c.controls.addedLoras||=[]).push({name,on:true,strength:.8,clip:c.source.prompt[field.node].class_type==='CheckpointLoaderSimple'&&!field.modelOnly?.8:null});announceLora(c.controls.addedLoras.at(-1));}
 function sizes(){
  const c=current(),presets=availableSizePresets(mode(),getState().presets?.[mode()]);$('sizePreset').replaceChildren(new Option('Egyéni méret','custom'));
  for(const [index,p]of presets.entries())$('sizePreset').add(new Option(savedSizeLabel(p),String(index)));
  const match=presets.findIndex(p=>p.width===c.width&&p.height===c.height);$('sizePreset').value=match<0?'custom':String(match);
  const problem=sizeProblem(c.width,c.height);$('sizeWarning').textContent=problem||presetLabel(c.width,c.height)+(c.width*c.height>1400000?' · Nagy méret: jelentős memóriaigény lehet.':'')+' A támogatott workflow méretkorlátai érvényesek; ez nem VRAM-becslés.';$('fixSize').hidden=!problem;
  const custom=getState().presets?.[mode()]||[];$('savedSizes').replaceChildren(new Option('Saját mentett méretek…',''));for(const[index,p]of custom.entries())$('savedSizes').add(new Option(savedSizeLabel(p),String(index)));
 }
 function summary(){
  const c=current(),rows=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])].filter(r=>r.on),values=selectValues();$('summaryContent').replaceChildren();
  if(c.info)$('modelInfo').textContent='Célmodell: '+values.map(f=>f.name).join(' · ')+' · Workflow: '+c.info.family;
  const s=c.controls.sampling||c.info?.sampling||{};
  const lines=[['Modell',c.blockedModel?.name||values.map(f=>f.name).join(' · ')||'Válassz modellt.'],['Méret',presetLabel(c.width,c.height)],['Sorozat',(c.count||1)+' változat · '+(c.seed===-1?'véletlen seedek':({random:'véletlen seedek',increment:'léptetett seedek',fixed:'azonos seed'}[c.seedMode]||'azonos seed'))],['Seedek',c.seed===-1||c.seedMode==='random'?'Indításkor új véletlen seedek':c.seedMode==='fixed'?String(c.seed)+' · minden változat ugyanazt kapja':Array.from({length:Math.min(24,Math.max(1,Number(c.count)||1))},(_,i)=>String(Number(c.seed)+i*(c.seedStep??1))).join(', ')],['Mintavételezés',(s.steps??'—')+' lépés · CFG '+(s.cfg??'—')+' · '+(s.sampler||'—')+' / '+(s.scheduler||'—')],['LoRA-k',rows.length?rows.map(r=>r.name+' × '+r.strength+(r.clip===null?'':' / CLIP '+r.clip)).join('\n'):'Nincs bekapcsolt LoRA']];
  if(mode()==='video')lines.push(['Videóhossz',c.prepared&&c.preparedTiming?c.duration+' mp kérve → '+c.preparedTiming.seconds.toFixed(3)+' mp · '+c.preparedTiming.frames+' képkocka · '+c.preparedTiming.fps+' fps':c.duration+' mp kérve · tényleges hossz az előkészítés után']);
  const startPlan=getStartPlan($),video=mode()==='video';
  startPlan.hidden=!c.info||!!c.blockedModel||!!globalThis.creatorHubMultiModel?.isOn();
  const model=values.map(({name})=>String(name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft)$/i,'')).join(' + ')||c.sourceName||'';
  const label=text=>Object.assign(document.createElement('span'),{textContent:text});
  startPlan.replaceChildren(model,model?' · ':'',String(c.count||1)+' ',label(video?'videó':'kép'),' · '+c.width+' × '+c.height);
  if(video)startPlan.append(' · '+c.duration+' ',label('mp'));
  if(c.image&&c.useImage!==false)startPlan.append(' · ',label('Kezdőképpel'));
  let source='';try{source=samplingInfo()||'';}catch{}
  for(const[label,value]of lines){const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;/* 0.16 DEV: honnan jön az érték – külön elemben, hogy lefordítható legyen */if(label==='Mintavételezés'&&source){dd.append('\n(');for(const [i,part] of source.split(' · ').entries()){if(i)dd.append(' · ');const m=part.match(/^(lépés|CFG): (.*)$/);for(const t of m?[m[1],': ',m[2]]:[part]){if(t===': '){dd.append(t);continue;}const e=document.createElement('span');e.textContent=t;dd.append(e);}}dd.append(')');}$('summaryContent').append(dt,dd);}
  $('summaryState').textContent=c.blockedModel?c.blockedModel.reason:c.prepared?'Ellenőrizve. Indítható.':'Indításkor automatikusan ellenőrzi és előkészíti a tervet.';
  const uncertain=rows.some(r=>{const entry=c.catalog?.loras.find(i=>i.name===r.name);return !entry||status(entry.family)!=='family-match';});$('compatWarning').textContent=uncertain?'Van nem igazolt családú LoRA a tervben. A forrás meglévő LoRA-i megmaradnak; új, ismeretlen fájlhoz külön engedély szükséges.':'';
 }
 function render(){modelChoices();$('unknownLoras').checked=!!current().controls.allowUnknownLoras;loraChoices();sizes();summary();}
 async function catalog(refresh=false){const c=current();if(!c.source)return;loading=true;modelChoices();try{const value=await request('catalog',{backend:getState().backend,source:c.source,output:c.info.output,refresh});if(current()===c)c.catalog=value;}finally{loading=false;render();}}
 const editAndRender=()=>{capture();edited();render();};
 $('refreshCatalog').onclick=()=>void act(()=>catalog(true));$('modelSearch').oninput=modelChoices;
 $('unknownModels').onchange=()=>{current().controls.allowUnknownModels=$('unknownModels').checked;edited();modelChoices();};
 $('unknownLoras').onchange=()=>{current().controls.allowUnknownLoras=$('unknownLoras').checked;edited();loraChoices();};$('addLoraSearch').oninput=loraChoices;
 $('addLoraSelect').onchange=()=>{loraButtons();if(!$('addLoraSelect').value||$('addLora').disabled)return;try{activateLora($('addLoraSelect').value);edited();renderLoras();loraChoices();summary();}catch(e){notify(e.message,true);}};$('showAllLoras').onchange=loraChoices;
 $('favoriteLora').onclick=()=>void act(async()=>{const item=current().catalog?.loras.find(i=>i.name===$('addLoraSelect').value);if(!item?.localId)return;await request('library/favorite',{id:item.localId,on:!item.favorite});item.favorite=!item.favorite;await onFavorite({id:item.localId,name:item.name,kind:'lora',favorite:item.favorite});loraChoices();});
 $('addLora').onclick=()=>{try{activateLora($('addLoraSelect').value);edited();renderLoras();summary();}catch(e){notify(e.message,true);}};
 $('sizePreset').onchange=()=>{if($('sizePreset').value==='custom')return;const presets=availableSizePresets(mode(),getState().presets?.[mode()]),p=presets[Number($('sizePreset').value)];if(!p)return;$('width').value=p.width;$('height').value=p.height;editAndRender();};
 $('flipSize').onclick=()=>{[$('width').value,$('height').value]=[$('height').value,$('width').value];editAndRender();};
 $('fixSize').onclick=()=>{const p=nearestSize(Number($('width').value),Number($('height').value));$('width').value=p.width;$('height').value=p.height;editAndRender();};
 const sizeAdvice=$('sizeAdvice');
 const adviceHost=document.createElement('span');sizeAdvice.before(adviceHost);
 adviceHost.replaceWith(markNew(sizeAdvice,'size-advice'));
 sizeAdvice.onclick=()=>void act(async()=>{
  capture();
  const c=current(),activeMode=mode();
  const {openSizeAdvice}=await import('./creative-advice-ui.mjs');
  openSizeAdvice({request,notify,prompt:c.prompt||'',mode:activeMode,current:c,
   families:[c.catalog?.models?.find(model=>model.id===c.automatic?.id)?.family||c.info?.family],
   image:c.useImage===false?'':c.image,
   apply({width,height}){
    if(mode()!==activeMode)throw Error('Az alkotási mód megváltozott. Kérj új javaslatot.');
    $('width').value=width;$('height').value=height;editAndRender();
   }
  });
 });
 const saveCurrentSize=name=>void act(async()=>{
  capture();
  const {width,height}=current();
  const preset=saveSizePreset(getState(),mode(),{width,height,name});
  save();sizes();
  notify('Saját képméret mentve: '+preset.name);
 });
 $('quickSaveSize').onclick=()=>saveCurrentSize('');
 $('saveSize').onclick=()=>saveCurrentSize($('sizeName').value);
 $('savedSizes').onchange=()=>{const p=getState().presets?.[mode()]?.[Number($('savedSizes').value)];if(!$('savedSizes').value||!p)return;$('width').value=p.width;$('height').value=p.height;const selected=$('savedSizes').value;editAndRender();$('savedSizes').value=selected;};
 $('deleteSize').onclick=()=>{const value=$('savedSizes').value;if(value==='')return;getState().presets[mode()].splice(Number(value),1);save();sizes();};
 for(const [id,field]of [['copyPositive','prompt'],['copyNegative','negative']])$(id).onclick=()=>void act(async()=>{await navigator.clipboard.writeText($(field).value);notify('Prompt másolva.');});
 function setDisabled(disabled){for(const el of document.querySelectorAll('#catalogControls input,#catalogControls select,#catalogControls button,.sizeControls input,.sizeControls select,.sizeControls button,#loraAdder input,#loraAdder select,#loraAdder button'))el.disabled=disabled;$('refreshCatalog').disabled=disabled||!current().source;if(!disabled)loraButtons();else $('addLora').disabled=$('favoriteLora').disabled=true;}
 async function useAsset(item){
  const c=current(),normalize=name=>name.replaceAll('\\','/').toLocaleLowerCase(),file=normalize(item.path),matches=names=>names.filter(n=>file.endsWith('/'+normalize(n))||normalize(n)===file);
  if(item.kind==='lora'){
   const names=matches((c.catalog?.loras||[]).map(i=>i.name));if(names.length!==1)throw Error('A LoRA nem azonosítható egyértelműen a háttér listájában. Ellenőrizd a ComfyUI modellmappáit, majd frissítsd a helyi listát.');
   const name=names[0],info=c.catalog.loras.find(i=>i.name===name),s=status(info.family);if(s==='incompatible'){/* 0.17.1: több modelles módban „◐ Vár” állapotban felvehető */if(!window.creatorHubMultiModel?.isOn?.()||!info.family)throw Error('Ez a LoRA más modellcsaládhoz tartozik.');const existing=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])].find(r=>r.name===name);if(existing){existing.on=false;existing.parked=true;delete existing.stripRemoved;}else (c.controls.addedLoras||=[]).push({name,on:false,parked:true,strength:.8,clip:null,family:info.family});return 'parked';}if(s==='unknown'&&!c.controls.allowUnknownLoras)throw Error('A család nem igazolható. Az Alkotás → LoRA-k → Új LoRA hozzáadása résznél külön engedheted az ismeretlen családú fájlokat.');
   if(c.info.modelFields.length!==1)throw Error('Új LoRA-hoz egyértelműen egy modellbetöltő szükséges.');
   activateLora(name);
  }else{
   const candidates=(c.catalog?.fields||[]).filter(f=>item.kind==='checkpoint'?f.type==='CheckpointLoaderSimple':f.type!=='CheckpointLoaderSimple').flatMap(f=>matches(f.items.map(i=>i.name)).map(name=>({field:f,name})));
   if(candidates.length!==1)throw Error('Ez a modell nem rendelhető egyértelműen a jelenlegi workflow-hoz. Válassz hozzá megfelelő workflow-t; a háttér könyvtáraiban is szerepelnie kell.');
   const {field,name}=candidates[0],family=field.items.find(i=>i.name===name)?.family,s=name===field.name?'source':!field.family||!family?'unknown':field.family===family?'family-match':'incompatible';if(s==='incompatible')throw Error('A modell családja eltér; megfelelő másik workflow szükséges.');if(s==='unknown'&&!c.controls.allowUnknownModels)throw Error('A modell családja nem igazolható. Az Alkotás → Modellválasztás résznél külön engedheted az ismeretlen családú modelleket.');
   c.controls.models=selectValues().map(f=>({...f,name:f.node===field.node&&f.key===field.key?name:f.name}));
  }
  edited();renderLoras();render();
 }
 return {render,catalog,summary,sizes,setDisabled,useAsset,selectedFamily};
}
