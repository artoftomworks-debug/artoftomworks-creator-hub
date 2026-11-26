import {markNew} from './new-feature-ui.mjs';
/* 0.17.1: ✦ LoRA-ajánlás – ablak a javaslatokkal. Csak kérésre fut; semmit nem tesz fel magától. */
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const short=n=>String(n||'').split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|pt|bin)$/i,'');
const fmt=v=>String(Math.round(v*100)/100).replace('.',',');
const SOURCE={own:'a jól sikerült képeid alapján',civitai:'a Civitai-adatlap ajánlása',ai:'a helyi MI javaslata',default:'óvatos alapérték'};

export async function openLoraSuggest({request,prompt,family,familyLabel,backend,model,targets=[],savedStrength=()=>undefined,saveStrength=()=>{},prepareTrial=null,onAdd,onTrigger,translate=t=>t,notify=()=>{}}){
 const T=t=>translate(t);
 const d=el('dialog',null,'generationDialog loraSuggestDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();
 const h=el('h2');h.append(document.createTextNode('✦ '),el('span','LoRA-ajánlás'),document.createTextNode(' · '+(familyLabel||family)));head.append(h,close);d.append(head);
 const options=el('div',null,'lsRow');
 const include23=el('input');include23.type='checkbox';include23.checked=true;
 const targetSelect=el('select');
 for(const target of targets)targetSelect.add(new Option(target.name,target.id));
 if(family==='ltx'||targets.length>1){
  const legacy=el('label',null,'check');legacy.append(include23,' ',el('span','LTX 2.3-as jelöltek mutatása'));if(family==='ltx')options.append(legacy);
  if(targets.length>1){const targetLabel=el('label','Modell');targetLabel.append(targetSelect);options.append(targetLabel);}
  d.append(options);
 }
 const status=el('p',T('A helyi MI átnézi a LoRA-idat…'),'muted');d.append(status);const list=el('div',null,'lsList');d.append(list);
 d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
 let revision=0;
 async function refresh(){
 const token=++revision;
 list.replaceChildren();
 status.textContent=T('A helyi MI átnézi a LoRA-idat…');
 let r;
 try{r=await request('lora/suggest',{prompt,family,backend,model:model||'',includeLtx23:include23.checked});}
 catch(e){if(token===revision)status.textContent=e.message;return;}
 if(token!==revision||!d.open)return;
 if(!r.picks?.length){
  status.textContent=T(r.note||'Nem találtam a prompthoz illő LoRA-t.');
 }else{
 status.replaceChildren(el('span',r.usedAI?'A helyi MI javaslata – csak javaslat, te döntesz.':'Helyi MI nélkül: a prompt szavaihoz legjobban illő LoRA-k (név, kulcsszó, Civitai-címke alapján).'));
 for(const p of r.picks){const card=el('div',null,'lsCard'),top=el('div',null,'lsTop');top.append(el('strong',short(p.name)));if(p.title&&p.title!==short(p.name))top.append(el('span',' · '+p.title,'muted'));const target=targetSelect.value;
  const saved=target?savedStrength(target,p.name):undefined;
  if(Number.isFinite(saved))top.append(' · ',el('span','Kipróbálva'));
  else if(p.ltx23)top.append(' · ',el('span','Próbálható LTX 2.3 LoRA'));
  card.append(top);
  if(p.reason)card.append(el('p','✦ '+p.reason,'lsReason'));
  const facts=el('p',null,'lsFacts');facts.append(el('span','Javasolt erősség:'),' '+fmt(p.strength)+' (',el('span',SOURCE[p.strengthSource]||''),(p.strengthSource==='own'&&p.strengthCount?' · '+p.strengthCount:'')+')');
  if(p.good)facts.append(' · ',el('span','jól sikerült képeid vele:'),' '+p.good);if(p.matched?.length)facts.append(' · ',el('span','egyezés:'),' '+p.matched.join(', '));card.append(facts);
  const row=el('div',null,'lsRow'),add=el('button','✓ Hozzáadás','primary');
  const strength=el('input');strength.type='number';strength.min=-4;strength.max=4;strength.step=.01;strength.value=Number.isFinite(saved)?saved:p.strength;
  if(target){
   const label=el('label','Erősség');label.append(strength);
   const remember=el('button','Bevált erősség mentése');remember.type='button';
   remember.onclick=()=>{
    if(!strength.checkValidity()||!Number.isFinite(strength.valueAsNumber)){strength.focus();return;}
    saveStrength(target,p.name,strength.valueAsNumber);remember.textContent=T('Mentve');
   };
   row.append(label,remember);
  }add.type='button';add.onclick=()=>{try{if(!strength.checkValidity()||!Number.isFinite(strength.valueAsNumber)){strength.focus();return;}onAdd({...p,strength:strength.valueAsNumber});add.disabled=true;add.textContent=T('✓ Hozzáadva');}catch(e){notify(e.message,true);}};row.append(add);
  for(const w of (p.triggers||[]).slice(0,3)){const b=el('button','+ '+w);b.type='button';b.title=T('Kulcsszó a promptba');b.onclick=()=>{onTrigger?.(w);b.disabled=true;};row.append(b);}
  card.append(row);
  if(target&&prepareTrial){
   const preview=el('section',null,'lsTrial');
   const review=el('button','LoRA-próba megtervezése');review.type='button';
   row.append(review);card.append(preview);
   review.onclick=async()=>{
    if(!strength.checkValidity()||!Number.isFinite(strength.valueAsNumber)){strength.focus();return;}
    review.disabled=true;
    preview.replaceChildren();
    try{
     const plan=await prepareTrial(target,{...p,strength:strength.valueAsNumber});
     if(!preview.isConnected)return;
     const detail=el('p');
     detail.append(plan.model+' · '+plan.width+' × '+plan.height,
      ...(plan.duration?[' · '+plan.duration+' ',el('span','mp')]:[]),' · seed '+plan.seed);
     const variants=el('p');
     variants.append(el('span','LoRA nélkül'),' · '+plan.strengths.slice(1).map(fmt).join(' / '));
     const launch=el('button','Próba indítása','primary');launch.type='button';
     launch.onclick=async()=>{
      launch.disabled=true;review.disabled=true;
      try{await plan.start();d.close();}
      catch(error){notify(error.message,true);launch.disabled=false;review.disabled=false;}
     };
     preview.append(detail,variants,launch);
    }catch(error){preview.textContent=error.message;}
    finally{review.disabled=false;}
   };
  }
  list.append(card);}
 }
 const web=el('button','LoRA keresése az interneten');web.type='button';
 web.onclick=()=>openOnlineLoras({request,notify,families:[family]});
 list.append(markNew(web,"online-loras"));
 }
 include23.onchange=targetSelect.onchange=()=>void refresh();
 await refresh();
}

export function rankOnlineLoras(items,query,families=[]){
 const words=String(query).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];
 const selected=new Set(families.filter(Boolean));
 return items.filter(item=>!item.restricted&&(!selected.size||!item.family||selected.has(item.family)))
  .map(item=>{
   const text=(item.title+' '+item.description).toLowerCase();
   const matches=[...new Set(words.filter(word=>text.includes(word)))];
   return {...item,matches,score:matches.length+(selected.has(item.family)?2:0)};
  }).sort((a,b)=>b.score-a.score);
}

export function openOnlineLoras({request,notify,families=[],query=''}){
 const dialog=el('dialog',null,'generationDialog loraSuggestDialog');
 const header=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>dialog.close();
 header.append(el('h2','LoRA keresése az interneten'),close);
 const filter=el('label','Keresőkifejezés'),input=el('input');input.type='search';input.maxLength=160;input.value=query.slice(0,160);
 filter.append(input);
 const provider=el('select');
 provider.add(new Option('Civitai','civitai'));provider.add(new Option('Hugging Face','hf'));
 const source=el('label','Forrás');source.append(provider);
 const submit=el('button','Keresés');submit.type='button';
 const status=el('p');status.setAttribute('role','status');
 const items=el('div',null,'lsList');
 const ai=el('button','Találatok átnézése MI-vel');ai.type='button';ai.hidden=true;
 const evaluation=el('p');evaluation.setAttribute('role','status');
 dialog.append(header,filter,source,el('p','A kiválasztott forráshoz csak a keresőkifejezést küldjük el.','muted'),submit,status,items,ai,evaluation);
 dialog.addEventListener('close',()=>dialog.remove());
 async function run(){
  const term=input.value.trim();
  if(!term||submit.disabled){input.focus();return;}
  submit.disabled=true;items.replaceChildren();ai.hidden=true;evaluation.textContent='';status.textContent='Modellek keresése a kiválasztott forráson…';
  try{
   const result=await request('models/search',{provider:provider.value,kind:'lora',query:term,includeNsfw:false});
   if(!dialog.open)return;
   const found=rankOnlineLoras(result.items||[],term,families).slice(0,8);
   status.textContent=found.length?'':'Nincs találat. Módosítsd a keresést vagy válassz másik forrást.';
   ai.hidden=!found.length;
   ai.onclick=async()=>{
    const model=(()=>{try{return localStorage.getItem('creatorHub.assistantModel');}catch{return null;}})();
    if(!model){evaluation.textContent='Válassz helyi modellt a MI-segítőben.';return;}
    ai.disabled=submit.disabled=true;
    try{
     const context=found.map((item,index)=>({number:index+1,title:item.title,baseModel:item.baseModel,family:item.family,description:item.description}));
     const result=await request('studio/assistant',{action:'creativeAdvice',kind:'webLora',model,context,question:term});
     if(dialog.open)evaluation.textContent=result.text;
    }catch(error){if(dialog.open)evaluation.textContent=error.message;}
    finally{ai.disabled=submit.disabled=false;}
   };
   for(const [index,item] of found.entries()){
    const link=new URL(item.url);
    if(link.protocol!=='https:'||!['civitai.com','huggingface.co'].includes(link.hostname))continue;
    const card=el('article',null,'lsCard');
    card.append(el('strong',(index+1)+'. '+item.title));
    if(item.baseModel)card.append(el('p',item.baseModel));
    if(families.includes('ltx')&&item.family==='ltx'&&/2[.\s-]3/.test(item.baseModel||''))card.append(el('p','Próbálható LTX 2.3 LoRA','muted'));
    if(!item.family)card.append(el('p','család még nem igazolt','muted'));
    if(item.matches.length)card.append(el('p','Egyezés: '+item.matches.join(', '),'muted'));
    if(item.description)card.append(el('p',item.description));
    const open=el('a','Forrásoldal ↗');open.href=link.href;open.target='_blank';open.rel='noopener noreferrer';
    card.append(open);items.append(card);
   }
  }catch(error){if(dialog.open){status.textContent=error.message;notify?.(error.message,true);}}
  finally{submit.disabled=false;}
 }
 submit.onclick=()=>void run();
 input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();void run();}};
 document.body.append(dialog);dialog.showModal();input.focus();
}
