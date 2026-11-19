import {motionText} from './motion-model.mjs';
import {activeModelSummary} from './active-model-ui.mjs';
const keys=['source','sourceName','info','automatic','automaticDefaults','dependencies','width','height','duration','count','seed','seedMode','seedStep','keepSampling','controls','blockedModel','useImage','studioText','studioApplied','motion','h3Acceleration','previewProfile','modelSamplingPolicy','modelSamplingVersion'];
export function parameterSnapshot(c){return structuredClone(Object.fromEntries(keys.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));}
export function mergeParameters(current,snapshot,{prompt=false,seed=false,reference}={}){const next={...current,...structuredClone(snapshot),prepared:false,preparedRunId:'',catalog:null};for(const k of ['automatic','dependencies','blockedModel','motion','h3Acceleration','previewProfile','modelSamplingPolicy'])if(!(k in snapshot))delete next[k];if(!prompt){next.prompt=current.prompt;next.negative=current.negative;next.studioText=current.studioText;next.studioApplied=current.studioApplied;}else{next.prompt=snapshot.prompt??current.prompt;next.negative=snapshot.negative??current.negative;}if(!seed)for(const k of ['seed','seedMode','seedStep'])next[k]=current[k];if(reference!==undefined)next.image=reference;if(next.controls)next.controls.seed=next.seed;delete next.modelRecommendation;return next;}
export function saveSetupEntry(rows,value){
 if(!value.name?.trim()||!['image','video'].includes(value.mode)||!value.parameters?.source)throw Error('Érvénytelen alkotói recept.');
 if(JSON.stringify(value).length>4*1024**2)throw Error('Ez a recept túl nagy. A teljes projekt mentését használd.');
 const next=[...rows.filter(r=>r.id!==value.id),structuredClone(value)];
 if(next.length>30)throw Error('Legfeljebb 30 recept menthető.');
 if(JSON.stringify(next).length>12*1024**2)throw Error('A mentett receptek elérték a 12 MiB-ot. Ments teljes projektet, vagy törölj nem használt receptet.');
 return next;
}
export function setupReadout(recipe){
 const p=recipe.parameters,s=p.controls?.sampling||p.info?.sampling||{},rows=[],add=(name,value)=>{if(value!==undefined&&value!==null&&value!=='')rows.push([name,String(value)]);};
 add('Modell',activeModelSummary(p).names.join(' · ')||p.sourceName||p.automatic?.id||'Saját workflow');
 add('Méret',p.width+' × '+p.height);if(recipe.mode==='video')add('Kért videóhossz',p.duration+' mp');
 add('Lépés / CFG',[s.steps??'—',s.cfg??'—'].join(' / '));add('Sampler / scheduler',[s.sampler??'—',s.scheduler??'—'].join(' / '));
 add('Denoise',s.denoise);add('Guidance',s.guidance);add('Darabszám',p.count??1);
 add('Seed',p.seed===-1?'Véletlen':p.seed);add('Seed mód',({random:'Véletlen minden változatnál',fixed:'Azonos seed',increment:'Léptetés · '+(p.seedStep??1)})[p.seedMode||'increment']);
 const loras=[...(p.controls?.loras||[]),...(p.controls?.addedLoras||[])].filter(r=>!r.stripRemoved);
 add('LoRA-k',loras.length?loras.map(r=>(r.on?'✓ ':'○ ')+r.name+' · modell '+r.strength+(r.clip!=null?' / CLIP '+r.clip:'')+(r.on?'':' · inaktív')).join('\n'):'Nincs');
 if(recipe.mode==='video'){const text=motionText(p.motion);add('Mozgás / kamera',p.motion?.enabled&&text?text:'Nincs külön bekapcsolva');}
 add('Kezdőkép',recipe.reference?'A recept tartalmazza · átvétele választható':'Nincs a receptben · az aktuális megmarad');
 return rows;
}
export function createSetupUI({$,getState,current,capture,save,persist=save,apply,notify,isBusy}){let restoring=false,previous='',past=[],future=[],lastKey='',lastAt=0,saving=false;const bar=document.createElement('div');bar.className='setupToolbar';const undo=document.createElement('button'),redo=document.createElement('button'),open=document.createElement('button');undo.textContent='↶';redo.textContent='↷';undo.id='undoParameters';redo.id='redoParameters';undo.title='Generálási beállítások visszavonása';redo.title='Beállítások újra alkalmazása';open.id='openSetups';open.textContent='Alkotói receptek';bar.append(open,undo,redo);$('automaticControls').before(bar);
 const dialog=document.createElement('dialog');dialog.className='setupDialog';dialog.id='setupsDialog';dialog.innerHTML='<div class="sectionTitle"><h2>Alkotói receptek</h2><button id="closeSetups">Vissza az alkotáshoz</button></div><p>Modell, LoRA-k, erősségek, méret és mintavételezés együtt. A mentett beállítások lent áttekinthetők. A prompt, seed és kezdőkép átvétele külön választható. Generálást nem indít.</p><label>Név<input id="setupName" maxlength="60" placeholder="Például: Krea 2 portré"></label><label class="check"><input id="setupSaveImage" type="checkbox">A kezdőképet is tartalmazza a mentés</label><button id="saveSetup" class="primary">Aktuális recept mentése</button><hr><label>Mentett összeállítás<select id="setupList"></select></label><p id="setupSummary"></p><dl id="setupDetails" class="setupDetails"></dl><details id="setupTextPreview"><summary>Mentett promptok</summary><label>Pozitív prompt<textarea id="setupSavedPrompt" readonly rows="3"></textarea></label><label>Negatív prompt<textarea id="setupSavedNegative" readonly rows="2"></textarea></label></details><div class="inline"><label class="check"><input id="setupPrompt" type="checkbox">Promptok átvétele</label><label class="check"><input id="setupSeed" type="checkbox">Seed átvétele</label><label class="check"><input id="setupImage" type="checkbox">Mentett kezdőkép átvétele</label></div><div class="inline"><button id="applySetup" class="primary">Recept alkalmazása</button><button id="deleteSetup">Törlés a listából</button></div><p id="setupStatus" role="status"></p>';document.body.append(dialog);
 function snapshot(){return {mode:getState().mode,parameters:{...parameterSnapshot(current()),prompt:current().prompt,negative:current().negative}};}
 function signature(){return JSON.stringify(snapshot());}
 function render(){undo.disabled=restoring||saving||!!isBusy()||!past.length;redo.disabled=restoring||saving||!!isBusy()||!future.length;open.disabled=restoring||saving||!!isBusy();}
 function baseline(){previous=signature();past=[];future=[];lastAt=0;render();}
 function changed(){if(restoring)return;const next=signature();if(!previous){previous=next;render();return;}if(next===previous){render();return;}const key=document.activeElement?.id||'action',now=Date.now();if(key!==lastKey||now-lastAt>700){past.push(previous);while(past.length>20||past.reduce((n,s)=>n+s.length,0)>32*1024**2)past.shift();}future=[];previous=next;lastAt=now;lastKey=key;render();}
 async function restore(text){const value=JSON.parse(text);restoring=true;render();try{await apply(value.parameters,{mode:value.mode,prompt:true,seed:true});previous=signature();}finally{restoring=false;render();}}
 undo.onclick=async()=>{if(restoring||isBusy()||!past.length)return;const value=past.at(-1),old=previous;try{await restore(value);past.pop();future.push(old);notify('Az előző generálási beállításokat visszaállítottam. Generálás nem indult.');}catch(e){notify(e.message,true);}render();};redo.onclick=async()=>{if(restoring||isBusy()||!future.length)return;const value=future.at(-1),old=previous;try{await restore(value);future.pop();past.push(old);notify('A generálási beállításokat újra alkalmaztam.');}catch(e){notify(e.message,true);}render();};
 const entries=()=>Array.isArray(getState().studioSetups)?getState().studioSetups:[];
 function selection(){return entries().find(p=>p.id===$('setupList').value);}
 function summary(){
  const p=selection(),locked=restoring||saving||!!isBusy();
  $('applySetup').disabled=$('deleteSetup').disabled=!p||locked;
  for(const id of ['closeSetups','setupName','setupSaveImage','saveSetup','setupList','setupPrompt','setupSeed'])$(id).disabled=locked;
  $('setupImage').disabled=locked||!p?.reference;if(!p?.reference)$('setupImage').checked=false;
  $('setupTextPreview').hidden=!p;$('setupSavedPrompt').value=p?.parameters?.prompt||'';$('setupSavedNegative').value=p?.parameters?.negative||'';
  $('setupSummary').textContent=p?(p.mode==='video'?'Videó':'Kép')+' · '+p.name+(p.updated?' · '+new Date(p.updated).toLocaleString('hu-HU'):''): 'Még nincs mentett recept. Állítsd össze a modellt és a kiegészítőket, majd adj nevet a receptnek.';
  $('setupDetails').replaceChildren();if(!p)return;
  for(const [label,value]of setupReadout(p)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('setupDetails').append(dt,dd);}
 }
 function list(id){$('setupList').replaceChildren(...entries().slice().sort((a,b)=>a.name.localeCompare(b.name,'hu')).map(p=>new Option(p.name,p.id)));if(id)$('setupList').value=id;summary();}
 open.onclick=()=>{capture();list();$('setupPrompt').checked=$('setupSeed').checked=$('setupImage').checked=false;$('setupStatus').textContent='';dialog.showModal();};$('closeSetups').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog&&!saving&&!restoring)dialog.close();});dialog.addEventListener('cancel',e=>{if(saving||restoring)e.preventDefault();});$('setupList').onchange=summary;
 $('saveSetup').onclick=async()=>{
  if(saving||restoring||isBusy())return;const old=getState().studioSetups;saving=true;summary();render();
  try{capture();if(!current().source||current().blockedModel)throw Error('Előbb válassz használható modellt.');const name=$('setupName').value.trim();if(!name)throw Error('Adj nevet a receptnek.');
   const rows=entries(),existing=rows.find(p=>p.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu'));
   if(existing&&!confirm('Felülírod a korábbi receptet? '+existing.name))return;
   const value={id:existing?.id||crypto.randomUUID(),name,...snapshot(),updated:Date.now(),reference:$('setupSaveImage').checked?current().image:undefined};
   const next=saveSetupEntry(rows,value);getState().studioSetups=next;await persist();list(value.id);$('setupStatus').textContent='Recept mentve a Hubban. A projekt mentése ezt a listát is tartalmazza.';
  }catch(e){getState().studioSetups=old;$('setupStatus').textContent='A recept nem lett elmentve: '+e.message;}
  finally{saving=false;summary();render();}
 };
 $('applySetup').onclick=async()=>{const p=selection();if(!p||saving||restoring||isBusy())return;const old=previous;restoring=true;summary();render();$('setupStatus').textContent='A recept és a szükséges összetevők ellenőrzése…';try{await apply(p.parameters,{mode:p.mode,prompt:$('setupPrompt').checked,seed:$('setupSeed').checked,reference:$('setupImage').checked?p.reference:undefined});past.push(old);future=[];previous=signature();dialog.close();notify('Recept alkalmazva. A külön ki nem választott prompt, seed és kezdőkép megmaradt.');}catch(e){$('setupStatus').textContent=e.message;}finally{restoring=false;summary();render();}};
 $('deleteSetup').onclick=async()=>{const p=selection();if(!p||saving||restoring||isBusy())return;if(!confirm('Eltávolítod ezt a mentett receptet? '+p.name))return;const old=entries();saving=true;summary();render();try{getState().studioSetups=old.filter(r=>r.id!==p.id);await persist();list();$('setupStatus').textContent='Recept eltávolítva. Kép, videó vagy modellfájl nem törlődött.';}catch(e){getState().studioSetups=old;list(p.id);$('setupStatus').textContent='Nem sikerült eltávolítani: '+e.message;}finally{saving=false;summary();render();}};

 return {changed,baseline,render,destroy(){dialog.remove();}};}
