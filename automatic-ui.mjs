import {retainLoras} from './lora-state.mjs';
import {SAMPLING_POLICY_VERSION,automaticSamplingDefaults,selectionSampling,samplingProfileKey,saveSamplingProfile,migrateSampling,syncSamplingOverrides,toggleSamplingOverride} from './sampling-policy.mjs';
const modelName=value=>String(value||'').replaceAll('\\','/').toLowerCase();
export function visibleAutomaticModels(models,selectedId=''){
 return models.filter(m=>m.id===selectedId||m.supported||!m.family||!models.some(other=>other.supported&&other.family===m.family&&modelName(other.name)===modelName(m.name)));
}
export function automaticAssetMatches(models,item){
 const type=item.kind==='diffusion'?'UNETLoader':item.kind==='checkpoint'?'CheckpointLoaderSimple':null;
 return models.filter(m=>(!type||m.type===type)&&modelName(item.path).endsWith('/'+modelName(m.name)));
}
export function restoreAutomaticCatalog(c,inventory){const model=inventory.models?.find(m=>m.id===c.automatic?.id);if(!model||!c.info||!c.source)return false;c.catalog={fields:(c.info.modelFields||[]).map(f=>({...f,type:c.source.prompt?.[f.node]?.class_type,family:model.family,items:[{name:f.name,family:model.family}]})),loras:inventory.loras||[],loraLoader:!!inventory.supports?.lora,loraModelOnly:!!inventory.supports?.loraModelOnly};return true;}
export function samplingForModelChange(c,displayed={}){
 const saved={...(c.info?.sampling||{}),...(c.controls?.sampling||{})};
 // With no model or saved settings yet, use the first model's own defaults.
 if(!c.source&&!c.info&&!Object.keys(saved).length)return {};
 const values={...saved,...Object.fromEntries(Object.entries(displayed).filter(([,v])=>v!==undefined))},sampling={};
 for(const key of ['steps','cfg','denoise','guidance'])if(values[key]!==undefined)sampling[key]=values[key];
 for(const key of ['sampler','scheduler'])if(c.keepSampling?.[key]!==false&&values[key]!==undefined)sampling[key]=values[key];
 return sampling;
}
export function modelCardSampling(sampling,recommendation,{mode,useImage,apply=false}={}){
 if(!apply)return {...sampling};
 const values=recommendation?.state==='ready'?{...sampling,...recommendation.values}:{...sampling};
 if(mode==='image'&&!useImage)values.denoise=1;
 return values;
}
export function createAutomaticUI({$,current,state,request,act,capture,edited,draw,save,notify,renderLoras}){
 let inventory=null,loading=false;const removedAssets=new Map();
 const normalize=s=>s.replaceAll('\\','/').toLowerCase();
 const selected=()=>inventory?.models.find(m=>m.id===(current().blockedModel?.id||current().automatic?.id));
 const profileKey=(id,mode=state().mode)=>samplingProfileKey(state().backend,mode,id);
 function remember(c=current()){if(c.automatic)saveSamplingProfile(state(),profileKey(c.automatic.id),c.controls.sampling,c.controls);}
 function samplingBase(){const c=current();return c.automatic?(selected()?automaticSamplingDefaults(selected()):c.automaticDefaults||c.info?.sampling||{}):c.info?.sampling||{};}
 function renderOverrides(disabled=false){const c=current(),available=new Set((c.info?.samplingFields||[]).map(f=>f.control));syncSamplingOverrides(c.controls,samplingBase());for(const key of ['sampler','scheduler']){const enabled=c.controls.samplingOverrides[key]!==false,button=$(key+'Override');button.textContent=(key==='sampler'?'Saját sampler: ':'Saját scheduler: ')+(enabled?'BE':'KI');button.setAttribute('aria-checked',String(enabled));button.classList.toggle('selected',enabled);button.disabled=disabled||!available.has(key);$(key).disabled=disabled||!available.has(key)||!enabled;const original=[...new Set((c.info?.samplingFields||[]).filter(f=>f.control===key).map(f=>f.value).filter(v=>typeof v==='string'))];$(key+'Effective').textContent='Használt: '+(!enabled&&!c.automatic&&original.length>1?original.join(' / '):c.controls.sampling[key]||'—')+' · '+(enabled?'Saját':'Alapérték');}}
 async function refresh(force=false){loading=true;render();try{
  inventory=await request('automatic/catalog',{backend:state().backend,refresh:force});
  for(const mode of ['image','video']){const c=state()[mode],model=inventory.models.find(m=>m.id===c.automatic?.id);
   if(model?.supported&&model.status==='ready'&&c.modelSamplingVersion!==SAMPLING_POLICY_VERSION){
    const candidate={...c,controls:{...c.controls,sampling:{...c.controls?.sampling}}},changed=migrateSampling(candidate,model);
    try{if(changed){const built=await request('automatic/build',{backend:state().backend,id:model.id,width:c.width,height:c.height,duration:c.duration,useImage:c.useImage!==false&&!!c.image,sampling:candidate.controls.sampling});candidate.source=built.source;candidate.info=built.info;candidate.dependencies=built.dependencies;candidate.controls.sampling=built.sampling;}Object.assign(c,candidate);save();}
    catch(e){c.samplingPolicyNotice='A régi automatikus beállítások ellenőrzése még nem sikerült: '+e.message;}
   }restoreAutomaticCatalog(c,inventory);
  }
 }finally{loading=false;draw();}}
 function renderRecommendation(){const c=current(),r=c.modelRecommendation;$('modelSamplingPolicy').value=c.modelSamplingPolicy==='manual'?'manual':'remember';$('modelSamplingRefresh').disabled=loading||!c.automatic;$('modelSamplingApply').disabled=loading||!c.automatic||r?.state!=='ready'||!Object.keys(r.values||{}).length;$('modelSamplingReset').disabled=loading||!c.automatic;$('modelSamplingSource').hidden=!r?.url;if(r?.url)$('modelSamplingSource').href=r.url;
  const names={steps:'lépés',cfg:'CFG',sampler:'sampler',scheduler:'scheduler',denoise:'denoise',guidance:'guidance'},values=Object.entries(r?.values||{}).map(([key,value])=>value+' '+(names[key]||key)).join(' · ');
  $('modelSamplingNotice').hidden=!c.samplingPolicyNotice;$('modelSamplingNotice').textContent=c.samplingPolicyNotice||'';
  $('modelRecommendationWarning').hidden=r?.state!=='ready';$('modelRecommendationWarning').textContent='Az ajánlás nem alkalmazódik automatikusan. A teljes workflow és kiegészítők nélkül eltérő eredményt adhat.';
  $('modelSamplingStatus').textContent=!c.automatic?'Az adatlap-ajánlások csak külön kérésre alkalmazhatók.':!r?'A modell saját mentett értékeit használja, vagy kiinduló értékekkel indul. Az adatlapot külön ellenőrizheted.':r.state==='ready'?(r.label+' · '+values+(r.examples?' · '+r.examples+' példa':'')+(r.cached?' · mentett adat':'')+(r.skipped?.length?' · '+r.skipped.join('; '):'')):r.message||'Nincs egyértelmű adatlap-beállítás; a saját értékek maradnak.';
 }
 function render(){renderRecommendation();
  for(const [key,id]of [['sampler','keepSampler'],['scheduler','keepScheduler']])$(id).checked=current().keepSampling?.[key]!==false;
  const c=current(),filter=$('automaticSearch').value.toLowerCase(),model=selected();$('automaticModel').replaceChildren(new Option('Válassz modellt…',''));
  for(const m of visibleAutomaticModels(inventory?.models||[],c.blockedModel?.id||c.automatic?.id).sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||a.name.localeCompare(b.name,'hu',{numeric:true}))){if(m.supported&&m.mode!==state().mode)continue;if(!m.name.toLowerCase().includes(filter)&&m.id!==c.automatic?.id)continue;const o=new Option((m.favorite?'★ ':'')+m.name+' · '+(m.family||'család még nem igazolt')+' · '+({ready:'használatra kész','missing-components':'kiegészítő szükséges','backend-update':'motorfrissítés szükséges',unsupported:'támogatás szükséges'}[m.status]||'ellenőrzés szükséges'),m.id);$('automaticModel').add(o);}
  $('automaticModel').value=c.blockedModel?.id||c.automatic?.id||'';
  $('automaticStatus').textContent=loading?'A helyi modellek és automatikus összetevők ellenőrzése…':c.blockedModel?'Kiválasztva: '+c.blockedModel.name+' · Az indításhoz az alábbi teendő szükséges.':c.automatic?'Aktív modell: '+(model?.name||c.info?.models?.[0]||'')+' · A háttér összeállítása automatikus.':inventory?'Válassz modellt; workflow betöltése nélkül indulhatsz. A modell mellett látszik, használatra kész-e, vagy mi hiányzik hozzá.':'A modelllista a ComfyUI-motor üzemkész állapota után frissíthető.';
  $('automaticAvailability').hidden=!c.blockedModel&&(!model||model.status==='ready');$('automaticReason').textContent=c.blockedModel?.reason||model?.reason||'';$('automaticReason').classList.toggle('error',!!c.blockedModel||!!model&&model.status!=='ready');$('automaticMissing').replaceChildren();for(const dep of model?.missing||[]){const b=document.createElement('button');b.textContent='Keresés: '+dep.names[0];b.onclick=()=>openBrowser(dep.query);$('automaticMissing').append(b);}
  $('catalogControls').hidden=!!c.automatic||!c.source;
  $('autoDependencies').textContent=(c.dependencies||[]).map(d=>d.role+': '+d.name).join('\n');
  c.controls.sampling||={...c.info?.sampling};const s=syncSamplingOverrides(c.controls,samplingBase());for(const id of ['steps','cfg','denoise','guidance'])$(id).value=s[id]??({steps:20,cfg:7,denoise:1,guidance:3.5}[id]);
  for(const[id,key]of [['sampler','samplers'],['scheduler','schedulers']]){const values=inventory?.[key]||[];$(id).replaceChildren(...[...new Set([s[id],...values].filter(Boolean))].map(v=>new Option(v,v)));$(id).value=s[id]||values[0]||'';}
  const available=new Set((c.info?.samplingFields||[]).map(f=>f.control));
  for(const id of ['steps','cfg','sampler','scheduler','denoise','guidance']){$(id).disabled=!available.has(id);$(id+'Label').hidden=!available.has(id)&&!!c.info;}
  renderOverrides();
  $('count').value=c.count??1;$('seedMode').value=c.seedMode||'increment';$('fpsLabel').hidden=state().mode!=='video';$('fps').value=c.info?.videoFamily==='ltx'?(c.info.fps||24)+' · LTX':'24 · H3 natív';
  $('samplingNote').textContent=c.info&&!available.has('cfg')?'A forrás nem használ CFG vezérlést. Az automatikus mód CFG-vel is összeállítható.':c.automatic&&model?.family==='flux1'?'A CFG és a FLUX guidance külön érték. A CFG=1 mellett a negatív prompt hatása általában elmarad.':c.automatic&&model?.family==='ltx'?'LTX 2.5 egyszerű ág · 24 fps, 8k+1 képkocka. Az automatikus összeállítás próbaállapotú; a valós GPU-eredményt saját rövid futással ellenőrizd.':c.automatic&&model?.family==='h3'?'A H3 natív sebessége 24 fps; a tényleges hossz a képkockarácshoz igazodik. A darabszám egymás utáni generálást jelent.':'A beállítások minden sorozatelemre érvényesek. A képek/videók egymás után készülnek.';
 }
 function openBrowser(query){const moss=selected()?.family==='moss'&&query;const href='/?models=1&provider=hf&q='+encodeURIComponent(moss?'Comfy-Org/MOSS-Image':query||selected()?.name||'')+(moss?'&file='+encodeURIComponent(query):'');window.open(href,'_blank','noopener');}
 async function select(id,{strict=false,samplingOverride}={}){
  capture();await refresh();const model=inventory?.models.find(m=>m.id===id);if(!model)throw Error('Ez a modell nincs a csatlakoztatott háttér listájában.');
  const c=current();if(!model.supported||model.status&&model.status!=='ready'){if(strict)throw Error(model.reason);c.blockedModel={id:model.id,name:model.name,reason:model.reason};edited();draw();notify(model.reason,true);return false;}delete c.blockedModel;
  const same=c.automatic?.id===id,recommendation=same?c.modelRecommendation:null,profile=state().modelSamplingProfiles?.[profileKey(id)],sampling=samplingOverride||selectionSampling({sampling:samplingForModelChange(c),model,previousFamily:selected()?.family,profile:same?null:profile,policy:c.modelSamplingPolicy==='manual'?'manual':'remember',mode:state().mode,useImage:c.useImage!==false&&!!c.image});
  const restoreProfile=!same&&c.modelSamplingPolicy!=='manual'&&profile,overrides={...(restoreProfile?profile.overrides:c.controls.samplingOverrides)},choices={...(restoreProfile?profile.choices:c.controls.samplingChoices)};
  const built=await request('automatic/build',{backend:state().backend,id,width:c.width,height:c.height,duration:c.duration,useImage:c.useImage!==false&&!!c.image,sampling,samplingOverrides:overrides});
  if(built.model.mode!==state().mode)throw Error('Válts a modellhez illő Kép/Videó módra.');
  const oldRows=[...(c.controls.loras||[]),...(c.controls.addedLoras||[])],sameFamily=selected()?.family===model.family,allowUnknown=!!c.controls.allowUnknownLoras,previous=retainLoras(c,model.family,inventory);
  c.modelRecommendation=recommendation;c.modelSamplingVersion=SAMPLING_POLICY_VERSION;c.modelSamplingPolicy=c.modelSamplingPolicy==='manual'?'manual':'remember';c.source=built.source;c.info=built.info;c.automaticDefaults=built.defaults;c.sourceName='Automatikus · '+model.name;c.automatic={id};c.dependencies=built.dependencies;c.controls={loras:[],models:[],addedLoras:previous,allowUnknownLoras:sameFamily&&allowUnknown,sampling:built.sampling,samplingOverrides:overrides,samplingChoices:choices,seed:c.seed};syncSamplingOverrides(c.controls,built.defaults);remember(c);
  // Keep existing prompt, image, dimensions and series settings when changing a model.
  c.catalog={fields:built.info.modelFields.map(f=>({...f,type:built.source.prompt[f.node].class_type,family:model.family,items:[{name:f.name,family:model.family}]})),loras:inventory.loras,loraLoader:inventory.supports.lora,loraModelOnly:inventory.supports.loraModelOnly};
  edited();draw();notify('Aktív modell: '+model.name+'. A kiegészítőket automatikusan kiválasztottam; generálás még nem indult.'+(previous.some(r=>!r.on)?' A nem aktív LoRA-k a sávon maradtak, beállításaikkal együtt.':''));
 }
 async function useAsset(item){if(!inventory)await refresh();const hits=automaticAssetMatches(inventory.models,item);if(hits.length!==1)throw Error('A modellt a ComfyUI-nak is ismernie kell, és támogatott automatikus család szükséges. Frissítsd a listát; saját workflow is használható.');if(hits[0].mode&&hits[0].mode!==state().mode){capture();state().mode=hits[0].mode;draw();}await select(hits[0].id);}
 function setDisabled(disabled){for(const el of document.querySelectorAll('#automaticControls input,#automaticControls select,#automaticControls button,#samplingControls input,#samplingControls select,#samplingControls button,#seriesControls input,#seriesControls select'))el.disabled=disabled;const controls=new Set((current().info?.samplingFields||[]).map(f=>f.control));for(const id of ['steps','cfg','sampler','scheduler','denoise','guidance'])$(id).disabled=disabled||!controls.has(id);renderOverrides(disabled);if(!disabled)renderRecommendation();}
 for(const key of ['sampler','scheduler'])$(key+'Override').onclick=()=>{capture();toggleSamplingOverride(current().controls,key,current().controls.samplingOverrides?.[key]===false,samplingBase());remember();edited();draw();};
 for(const [key,id]of [['sampler','keepSampler'],['scheduler','keepScheduler']])$(id).onchange=()=>{capture();(current().keepSampling||={})[key]=$(id).checked;edited();};
 $('modelSamplingPolicy').onchange=()=>{current().modelSamplingPolicy=$('modelSamplingPolicy').value;edited();render();};
 $('modelSamplingRefresh').onclick=()=>void act(async()=>{const c=current();if(!c.automatic)return;c.modelRecommendation=await request('automatic/recommendation',{backend:state().backend,id:c.automatic.id,refresh:true});edited();renderRecommendation();notify('Az ajánlás ellenőrizve. A generálási értékek nem változtak.');});
 $('modelSamplingApply').onclick=()=>void act(async()=>{const c=current();if(!c.automatic||c.modelRecommendation?.state!=='ready')return;const sampling=modelCardSampling(c.controls.sampling,c.modelRecommendation,{mode:state().mode,useImage:c.useImage!==false&&!!c.image,apply:true});for(const key of ['sampler','scheduler'])if(c.modelRecommendation.values[key]!==undefined){(c.controls.samplingOverrides||={})[key]=true;(c.controls.samplingChoices||={})[key]=sampling[key];}delete c.samplingPolicyNotice;await select(c.automatic.id,{samplingOverride:sampling});});
 $('modelSamplingReset').onclick=()=>void act(async()=>{const c=current(),model=selected();if(!c.automatic||!model)return;delete c.samplingPolicyNotice;const defaults=automaticSamplingDefaults(model);c.controls.samplingChoices={sampler:defaults.sampler,scheduler:defaults.scheduler};await select(c.automatic.id,{samplingOverride:defaults});notify('A modellcsalád kiinduló értékei visszaállítva. Ezek nem helyettesítik a modell teljes workflow-ját.');});
 $('automaticResolve').onclick=()=>openBrowser();$('automaticRetry').onclick=()=>void act(()=>select(selected()?.id||''));
 $('automaticSearch').oninput=render;$('automaticRefresh').onclick=()=>void act(()=>refresh(true));$('automaticModel').onchange=()=>void act(()=>select($('automaticModel').value));
 for(const id of ['steps','cfg','sampler','scheduler','denoise','guidance'])$(id).onchange=()=>{capture();const s=current().controls.sampling||={};s[id]=['sampler','scheduler'].includes(id)?$(id).value:Number($(id).value);delete current().samplingPolicyNotice;remember();edited();};
 for(const id of ['count','seedMode'])$(id).onchange=()=>{capture();current().count=Number($('count').value);current().seedMode=$('seedMode').value;if(id==='seedMode')current().seedModeExplicit=true;edited();};
 return {refresh,render,select,useAsset,setDisabled,assetsChanged(result){if(!inventory)return;for(const item of result.done){const file=normalize(item.original||item.path);if(result.mode==='restore'){const old=removedAssets.get(file);if(old){inventory.models.push(...old.models);inventory.loras.push(...old.loras);removedAssets.delete(file);}}else{const models=inventory.models.filter(m=>file.endsWith('/'+normalize(m.name))),loras=inventory.loras.filter(m=>file.endsWith('/'+normalize(m.name)));removedAssets.set(file,{models,loras});inventory.models=inventory.models.filter(m=>!models.includes(m));inventory.loras=inventory.loras.filter(m=>!loras.includes(m));}}for(const mode of ['image','video'])restoreAutomaticCatalog(state()[mode],inventory);render();},favoriteChanged(item){for(const m of [...(inventory?.models||[]),...(inventory?.loras||[])])if(m.localId===item.id||item.path&&normalize(item.path).endsWith('/'+normalize(m.name)))m.favorite=item.favorite;render();},inventory:()=>inventory};
}
