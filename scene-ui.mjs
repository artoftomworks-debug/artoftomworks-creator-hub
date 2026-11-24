import {getLanguage,translateText} from './i18n-ui.mjs';
import {sceneText} from './scene-i18n.mjs';
import {MOTION_CHOICES} from './motion-model.mjs';
import {sceneDraft} from './scene-model.mjs';
import {refreshFrame,chainText} from './chain-refresh.mjs';

export function createSceneUI({request,getEntry,onApply,onShow,isBusy,notify,ensureBackend=async()=>{}}) {
 const t=key=>sceneText(getLanguage(),key),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 let sequence=null,anchor='',lastEntry='',loading=false,revision=0,dialog=null,dead=false;
 const button=el('button',undefined,'primary');button.id='sceneContinue';button.type='button';button.dataset.i18nIgnore='';document.querySelector('.videoActionButtons')?.prepend(button);
 const board=el('section',undefined,'sceneBoard');board.id='sceneBoard';board.dataset.i18nIgnore='';board.hidden=true;
 const head=el('div',undefined,'sceneHeading'),title=el('strong'),assemble=el('button'),strip=el('div',undefined,'sceneStrip'),notice=el('p',undefined,'muted');assemble.type='button';assemble.id='sceneAssemble';/* 0.16 DEV: collapsible scene sequence; the choice is remembered in this browser */const fold=el('button',undefined,'sceneFold');fold.type='button';fold.id='sceneFold';let folded=false;try{folded=localStorage.getItem('creatorHub.sceneFolded')==='1';}catch{}fold.onclick=()=>{folded=!folded;try{localStorage.setItem('creatorHub.sceneFolded',folded?'1':'0');}catch{}render();};const tools=el('span',undefined,'sceneHeadTools');tools.append(assemble,fold);head.append(title,tools);board.append(head,notice,strip);document.querySelector('#videoActions')?.after(board);
 button.onclick=()=>void open(getEntry());
 function render(){button.textContent='🎬 '+t('continue');button.disabled=!!isBusy()||loading;board.hidden=!sequence?.parts.length;const hu=getLanguage()==='HU',count=sequence?.parts.length||0;title.textContent=t('sequence')+(folded&&count?' · '+count+(hu?' rész':count===1?' segment':' segments'):'');fold.textContent=folded?(hu?'▸ Kinyitás':'▸ Expand'):(hu?'▾ Összecsukás':'▾ Collapse');fold.setAttribute('aria-expanded',String(!folded));notice.style.display=strip.style.display=folded?'none':'';board.classList.toggle('sceneFolded',folded);assemble.textContent=t('assemble');assemble.disabled=loading||sequence?.parts.length<2;notice.textContent=t('sequenceHelp');strip.replaceChildren();
  for(const part of sequence?.parts||[]){const selected=part.variants.find(e=>e.id===part.selected),card=el('article',undefined,'sceneCard'),preview=el('button',undefined,'scenePreview');preview.type='button';preview.setAttribute('aria-label',t('view')+' · '+part.number);const video=el('video');video.src=selected.url;video.muted=true;video.preload='metadata';video.playsInline=true;preview.append(video);preview.onclick=()=>onShow(selected,sequence.parts.map(p=>p.variants.find(e=>e.id===p.selected)));
   const label=el('strong',t('part')+' '+part.number),variants=el('select');variants.setAttribute('aria-label',t('variant')+' · '+part.number);for(const [i,e]of part.variants.entries())variants.add(new Option(t('variant')+' '+(i+1)+' · '+(e.seed??'—'),e.id));variants.value=part.selected;variants.disabled=loading;variants.onchange=()=>void choose(variants.value);
   const next=el('button',t('continue')),retry=el('button',t('regenerate'));next.type=retry.type='button';next.disabled=retry.disabled=loading||!!isBusy();next.onclick=()=>void open(selected);retry.onclick=()=>void open(selected,true);card.append(preview,label,variants,next,retry);strip.append(card);
  }
 }
 async function choose(id){if(loading)return;loading=true;render();try{sequence=await request('scenes/select',{id});anchor=id;}catch(e){notify(e.message,true);}finally{loading=false;render();}}
 async function refresh(id){const version=++revision;try{const value=await request('scenes/sequence?id='+encodeURIComponent(id));if(!dead&&version===revision){sequence=value;anchor=id;render();}}catch(e){if(!dead&&version===revision){notice.textContent=e.message;board.hidden=false;}}}
 async function dataURI(url){const response=await fetch(url);if(!response.ok){const data=await response.json();throw Error(data.error||t('sourceMissing'));}const blob=await response.blob();if(blob.size>8*1024**2)throw Error(t('sourceMissing'));return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}
 async function open(entry,regenerate=false){
  if(!entry||isBusy()||loading)return;dialog?.close();const d=el('dialog',undefined,'sceneDialog');d.id='sceneDialog';d.dataset.i18nIgnore='';dialog=d;
  const heading=el('div',undefined,'sceneHeading'),h=el('h2',t(regenerate?'regenerate':'continue')),close=el('button',t('close'));close.type='button';heading.append(h,close);const status=el('p',t('preparing'));status.setAttribute('role','status');d.append(heading,status);document.body.append(d);const opener=document.activeElement;
  close.onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;opener?.focus();});d.showModal();
  try{
   const recipe=await request('scenes/prepare',{id:entry.id,regenerate});if(!d.open)return;let image=recipe.image;if(recipe.startImage){await ensureBackend();image=await dataURI(recipe.startImage);}if(recipe.info.needsImage&&!image)throw Error(t('sourceMissing'));if(!d.open)return;
   status.textContent=t('prepareHelp');const readout=el('p',(recipe.info.models||[]).join(' · ')+' · '+recipe.width+' × '+recipe.height, 'muted');d.append(readout);if(image){const img=el('img',undefined,'sceneFrame');img.src=image;img.alt=t(regenerate?'startFrame':'lastFrame');d.append(img);
   /* 0.16 DEV: chain refresh — colour-match the last frame to part 1's start image (default on, remembered) */
   if(image&&!recipe.startImage&&recipe.chainReference){const L=getLanguage(),raw=image,img=d.querySelector('img.sceneFrame');let fixed=null;
    const box=el('label',undefined,'check sceneChainRefresh'),cb=el('input');cb.type='checkbox';let on=true;try{on=localStorage.getItem('creatorHub.chainRefresh')!=='0';}catch{}cb.checked=on;box.append(cb,document.createTextNode(' '+chainText(L,0)));box.title=chainText(L,1);const info=el('p','', 'muted');info.style.margin='2px 0 8px';
    img?.after(box,info);
    const apply=()=>{image=cb.checked&&fixed?fixed.image:raw;if(img)img.src=image;if(fixed)info.textContent=chainText(L,2)+(fixed.before>=0?'+':'')+fixed.before.toFixed(1)+' '+chainText(L,5)+' ('+chainText(L,3)+') → '+(cb.checked?(fixed.after>=0?'+':'')+fixed.after.toFixed(1):(fixed.before>=0?'+':'')+fixed.before.toFixed(1))+' ('+chainText(L,4)+').';};
    cb.onchange=()=>{try{localStorage.setItem('creatorHub.chainRefresh',cb.checked?'1':'0');}catch{}apply();};
    try{await ensureBackend();const ref=await dataURI(recipe.chainReference);fixed=await refreshFrame(raw,ref);if(!d.open)return;apply();}catch{box.remove();info.remove();}}}
   const field=(name,element)=>{const label=el('label',t(name));label.append(element);d.append(label);return element;};
   const prompt=field('nextAction',el('textarea'));prompt.id='sceneNextPrompt';prompt.rows=5;prompt.value=regenerate?recipe.intent.prompt||recipe.info.prompt||'':'';
   /* 0.16 DEV: 🪄 új kezdőkép a „Következő jelenet” asszisztenssel – a jelenetsor kapcsolata megmarad, csak a kezdőkép cserélődik */
   if(window.creatorHubNextScene&&image){const row=el('div',undefined,'sceneAssist'),thumb=el('img'),info=el('span',translateText('Kezdőkép: az előző rész utolsó képkockája.'),'muted'),btn=el('button',translateText('🪄 Új kezdőkép az asszisztenssel'));row.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0';thumb.src=image;thumb.alt='';thumb.style.cssText='width:110px;max-height:80px;object-fit:contain;border-radius:6px;background:#000';btn.type='button';btn.title=translateText('Új nézőpontú vagy vágás utáni kezdőkép az előző képből: folytonossági lap, prompt, jelöltek ellenőrzéssel');
    btn.onclick=()=>void window.creatorHubNextScene.open({source:image,intent:prompt.value,kind:'video',title:translateText('🪄 Következő jelenet – új kezdőkép'),onChoose:async c=>{image=c.image;thumb.src=image;info.textContent=translateText('Kezdőkép: az asszisztenssel választott új kép.')+(c.mirrored?' ↔':'');}}).catch(e=>{status.textContent=translateText(e.message);});
    row.append(thumb,info,btn);d.append(row);}
   const camera=el('select');camera.id='sceneCamera';for(const [id,label]of MOTION_CHOICES.camera)camera.add(new Option(translateText(label),id));camera.value=regenerate&&recipe.intent.motion?.enabled?recipe.intent.motion.camera||'none':'none';field('camera',camera);
   const audio=field('audio',el('textarea'));audio.id='sceneAudio';audio.rows=2;audio.placeholder=t('audioHelp');
   const duration=el('input');duration.type='number';duration.min=1;duration.max=30;duration.step=.1;duration.value=recipe.duration;duration.id='sceneDuration';field('duration',duration);
   const seed=el('input');seed.type='number';seed.min=0;seed.step=1;seed.value=recipe.seed;seed.id='sceneSeed';field('seed',seed);
   const details=el('details'),summary=el('summary',t('sourcePrompt')),source=el('p',recipe.info.prompt||'', 'sceneSourcePrompt');details.append(summary,source);d.append(details);
   const apply=el('button',t('loadPlan'),'primary');apply.type='button';apply.id='sceneApply';d.append(apply);
   apply.onclick=async()=>{if(isBusy()||apply.disabled)return;apply.disabled=true;try{const next=sceneDraft(recipe,image,{prompt:prompt.value,camera:camera.value,speed:recipe.intent.motion?.speed||'slow',audio:audio.value,duration:Number(duration.value),seed:Number(seed.value)});await onApply(next,recipe);d.close();notify(t('loaded'));}catch(e){status.textContent=translateText(e.message);status.setAttribute('role','alert');}finally{apply.disabled=false;}};
   prompt.focus();
  }catch(e){status.textContent=translateText(e.message);status.setAttribute('role','alert');}
 }
 assemble.onclick=()=>{if(!sequence?.parts.length||assemble.disabled)return;const id=sequence.parts.at(-1).selected;window.open('/video-studio?lang='+getLanguage()+'&sequence='+encodeURIComponent(id),'_blank','noopener');};
 const language=()=>render();window.addEventListener('creator-hub-language',language);render();
 return {update(){const e=getEntry();if(e?.id&&e.id!==lastEntry){lastEntry=e.id;void refresh(e.id);}button.disabled=loading||!!isBusy();for(const b of strip.querySelectorAll('article>button'))b.disabled=loading||!!isBusy();},open,refresh(){if(anchor)void refresh(anchor);},destroy(){dead=true;revision++;dialog?.close();button.remove();board.remove();window.removeEventListener('creator-hub-language',language);}};
}
