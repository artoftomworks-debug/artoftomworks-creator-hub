import {renderMediaDetails} from './media-details.mjs';
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function createViewerNavigation(move){
 const button=(symbol,side,label,direction)=>{
  const control=element('button',symbol,'viewerNav '+side);
  control.type='button';
  control.setAttribute('aria-label',label);
  control.title=label;
  control.onclick=()=>void move(direction);
  return control;
 };
 return {prev:button('‹','viewerPrev','Előző kép',-1),next:button('›','viewerNext','Következő kép',1)};
}

export function viewerArrow(event,move){
 if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
   event.target?.closest?.('input,textarea,select,[contenteditable=true],video'))return false;
 const direction=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
 if(!direction)return false;
 event.preventDefault();
 event.stopPropagation();
 void move(direction);
 return true;
}

export function createMediaViewer({$,request,actions,onImageDrop,onReuse,onInit,onEdit,onLoop,onVideo}){
 const dialog=$('historyDialog'),canvas=$('historyPreview'),title=$('historyPreviewTitle'),note=$('historyPreviewNote'),footer=$('historyPreviewActions');
 dialog.classList.add('quickViewer');dialog.setAttribute('aria-labelledby','historyPreviewTitle');dialog.tabIndex=-1;
 const bar=dialog.querySelector('.sectionTitle'),fit=element('button','Teljes kép'),actual=element('button','1:1'),zoom=element('span','','quickZoom');fit.id='viewerFit';actual.id='viewerActual';zoom.id='viewerZoom';bar.insertBefore(fit,$('historyClose'));bar.insertBefore(actual,$('historyClose'));bar.insertBefore(zoom,$('historyClose'));
 const zoomBadge=element('span','','viewerZoomOverlay');zoomBadge.id='viewerZoomOverlay';zoomBadge.setAttribute('aria-hidden','true');zoomBadge.hidden=true;zoom.title='Nagyítás · 100% = eredeti képméret (1:1)';zoomBadge.title=zoom.title;
 const {prev,next}=createViewerNavigation(move),counter=element('span','','viewerCounter');prev.id='viewerPrevious';next.id='viewerNext';counter.id='viewerCounter';counter.setAttribute('role','status');bar.insertBefore(counter,fit);dialog.append(prev,next);
 const data=element('section',null,'quickMetadata');data.id='viewerMetadata';note.after(data);const hint=element('p','← → lapozás · 1–5 értékelés · 0 értékelés törlése · F kedvenc · M remekmű · Del lomtárba · Görgő: nagyítás · Kép mellé kattintás vagy Escape: vissza','quickHint');footer.after(hint);
 let media,entry,version=0,scale=1,fitScale=1,x=0,y=0,drag=null,fitted=true,suppressClick=false,gallery=null,navigating=false;
 function navigation(){const s=gallery?.state||{current:1,total:1},focused=document.activeElement;counter.textContent=s.current+' / '+s.total;prev.hidden=next.hidden=s.total<2;prev.disabled=navigating||!s.hasPrev;next.disabled=navigating||!s.hasNext;if(focused===prev&&prev.disabled||focused===next&&next.disabled)dialog.focus({preventScroll:true});}
 async function move(direction){if(navigating||!gallery||direction<0&&!gallery.state.hasPrev||direction>0&&!gallery.state.hasNext)return;const token=version,source=gallery;navigating=true;navigation();try{const value=await source.move(direction);if(token!==version||source!==gallery||!dialog.open)return;if(value){display(value);source.onNavigate?.(value,source.state);}}catch(e){if(token===version&&dialog.open)note.textContent='A következő kép nem tölthető be: '+e.message;}finally{if(source===gallery){navigating=false;navigation();}}}
 dialog.addEventListener('keydown',event=>{if(dialog.open)viewerArrow(event,move);});
 /* 0.17.1: ugyanazok a billentyűk, mint a rácsban – 1–5 értékelés, 0 törli, F kedvenc, Del lomtárba (megerősítéssel) */
 dialog.addEventListener('keydown',ev=>{if(!dialog.open||ev.altKey||ev.ctrlKey||ev.metaKey||ev.target.closest?.('input,textarea,select,[contenteditable=true]'))return;let b=null;if(/^[0-5]$/.test(ev.key))b=footer.querySelector(`[data-rate="${ev.key}"]`);else if(ev.key==='f'||ev.key==='F')b=footer.querySelector('[data-fav]');else if(ev.key==='m'||ev.key==='M')b=footer.querySelector('[data-crown]');else if(ev.key==='Delete')b=footer.querySelector('.trashImage');if(b){ev.preventDefault();ev.stopPropagation();b.click();}});
 function clamp(){if(!media||media.tagName!=='IMG')return;const maxX=Math.max(0,(media.naturalWidth*scale-canvas.clientWidth)/2),maxY=Math.max(0,(media.naturalHeight*scale-canvas.clientHeight)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));}
 function paint(){clamp();canvas.style.setProperty('--viewer-scale',scale);canvas.style.setProperty('--viewer-x',x+'px');canvas.style.setProperty('--viewer-y',y+'px');zoom.textContent=zoomBadge.textContent=Math.round(scale*100)+'%';zoomBadge.hidden=media?.tagName!=='IMG'||!media.naturalWidth;canvas.classList.toggle('canPan',!!media&&media.tagName==='IMG'&&(media.naturalWidth*scale>canvas.clientWidth+1||media.naturalHeight*scale>canvas.clientHeight+1));}
 function fitImage(){if(!media?.naturalWidth)return;fitScale=Math.min(canvas.clientWidth/media.naturalWidth,canvas.clientHeight/media.naturalHeight);scale=fitScale;x=y=0;fitted=true;paint();}
 fit.onclick=fitImage;actual.onclick=()=>{if(!media?.naturalWidth)return;scale=1;x=y=0;fitted=false;paint();};
 function reset(){drag=null;suppressClick=false;x=y=0;scale=fitScale=1;fitted=true;zoom.textContent=zoomBadge.textContent='—';zoomBadge.hidden=true;canvas.classList.remove('dragging','canPan');}
 /* 0.16 DEV: tell the list where the viewer was closed (once per opening; not only via the 'close' event, which some hosts do not fire) */
 let announced=-1;function announce(){const g=gallery,e=entry;if(!g?.onClose||!e||announced===version)return;announced=version;const st=g.state;queueMicrotask(()=>{try{g.onClose(e,st);}catch(err){console.warn('viewer close',err);}});}
 function close(){announce();dialog.close();}
 dialog.addEventListener('cancel',()=>announce());
 const outside=e=>{if(suppressClick){suppressClick=false;return;}if(e.target===dialog||e.target===canvas)close();};dialog.addEventListener('click',outside);
 canvas.addEventListener('wheel',e=>{if(media?.tagName!=='IMG'||!media.naturalWidth)return;e.preventDefault();const rect=canvas.getBoundingClientRect(),cx=e.clientX-rect.left-rect.width/2,cy=e.clientY-rect.top-rect.height/2,delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?rect.height:1),next=Math.max(Math.min(fitScale,1)/4,Math.min(Math.max(8,fitScale*4),scale*Math.exp(-Math.max(-240,Math.min(240,delta))*.0025))),ratio=next/scale;x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;scale=next;fitted=false;paint();},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.target!==media||media.tagName!=='IMG'||e.button!==0)return;drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x,y,moved:false};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');e.preventDefault();});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;drag.moved||=Math.abs(dx)+Math.abs(dy)>5;x=drag.x+dx;y=drag.y+dy;paint();});
 function release(e){if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved||e.target===canvas;drag=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
 canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{release(e);suppressClick=false;});
 const resized=new ResizeObserver(()=>{if(!dialog.open)return;if(fitted)fitImage();else paint();});resized.observe(canvas);
 dialog.addEventListener('close',()=>{if(dialog.open)return;announce();version++;gallery=null;navigating=false;media?.pause?.();reset();data.replaceChildren();});
 function details(value){renderMediaDetails(data,value,element);}
 function display(e){version++;const token=version;entry=e;media?.pause?.();reset();canvas.replaceChildren();data.replaceChildren();media=element(e.mode==='video'?'video':'img');media.draggable=false;if(e.mode==='video'){media.controls=true;media.playsInline=true;}else{media.alt=e.filename;media.onload=()=>{if(token===version)fitImage();};}media.onerror=()=>{if(token===version)note.textContent='A média nem érhető el. Ellenőrizd a hátteret és a fájl helyét; az értékelés megmarad.';};if(!e.trashed)media.src=e.url;else media.hidden=true;canvas.append(media,zoomBadge);title.textContent=e.filename;note.textContent=new Date(e.created).toLocaleString('hu-HU')+' · '+e.project;const controls=e.id?actions(e,{quick:true}):element('div',null,'historyActions');if(e.mode!=='video'){if(onVideo&&e.id){const video=element('button','Videó készítése ebből');video.id='viewerMakeVideo';video.onclick=()=>{close();onVideo(entry);};controls.prepend(video);}if(onEdit){const edit=element('button','Szerkesztés');edit.id='viewerEditImage';edit.onclick=()=>{close();onEdit(entry);};controls.prepend(edit);}const reuse=element('button','Paraméterek újraalkalmazása…');reuse.id='viewerReuseParameters';reuse.onclick=()=>{close();if(e.onReuse)e.onReuse();else onReuse?.(e);};controls.prepend(reuse);if(e.id){const init=element('button','Kezdőképként');init.id='viewerUseAsInput';init.onclick=()=>{close();onInit?.(e);};controls.prepend(init);}}if(e.mode==='video'&&e.id){/* 0.16 DEV: 🔊 */const snd=element('button','🔊 Hang');snd.title='Úsztatás, hangerő-kiegyenlítés, háttérzene – új változatként';snd.onclick=()=>dispatchEvent(new CustomEvent('creatorhub:sound-open',{detail:{entry}}));controls.prepend(snd);}if(e.mode==='video'&&onLoop&&e.id){const loop=element('button','Loop készítése');loop.id='viewerMakeLoop';loop.onclick=()=>onLoop(entry);controls.prepend(loop);}footer.replaceChildren(controls);fit.hidden=actual.hidden=zoom.hidden=hint.hidden=e.mode==='video';details(e);navigation();if(!dialog.open)dialog.showModal();if(media.complete&&media.naturalWidth)fitImage();if(e.id)void request('history/details?id='+encodeURIComponent(e.id)).then(value=>{if(token!==version||!dialog.open)return;Object.assign(entry,value);details(value);}).catch(error=>{if(token===version&&dialog.open)data.append(element('small','A részletes beállítások nem tölthetők be: '+error.message));});}
 function show(e,source=null){gallery=source;navigating=false;display(e);}
 dialog.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});dialog.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const file=e.dataTransfer?.files[0];if(file){close();onImageDrop?.(file);}});
 async function removed(id){if(!dialog.open||entry?.id!==id)return;const source=gallery;try{const value=await source?.removeCurrent?.();if(!dialog.open)return;if(!value){close();return;}display(value);source?.onNavigate?.(value,source.state);}catch(e){entry.trashed=true;media?.removeAttribute('src');note.textContent='A kép törölve. A következő kép nem tölthető be: '+e.message;}}
 return {show,removed,destroy(){version++;resized.disconnect();dialog.removeEventListener('click',outside);dialog.removeEventListener('keydown',arrows);media?.pause?.();}};
}
