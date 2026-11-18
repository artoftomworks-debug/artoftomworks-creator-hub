export function createVideoActions({$,getEntry,request,ensureBackend,onContinue,onRecipe,onDetails,onFinish,onFamily,notify}){
 const bar=document.createElement('section');bar.id='videoActions';bar.className='videoActions';bar.hidden=true;bar.setAttribute('aria-label','A megjelenített kész videó műveletei');
 const label=document.createElement('small');label.id='videoActionSource';
 const row=document.createElement('div');row.className='videoActionButtons';
 const status=document.createElement('p');status.id='videoActionStatus';status.setAttribute('role','status');
 const button=(id,text,fn,host=row)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.onclick=()=>void perform(b,fn);host.append(b);return b;};
 let entryId='',working=false;
 async function perform(button,fn){if(working)return;const entry=getEntry();if(!entry?.id||entry.mode!=='video')return;const original=entry.id;working=true;for(const b of bar.querySelectorAll('button'))b.disabled=true;status.textContent='Előkészítés · '+entry.filename;try{await fn(entry);if(entryId===original)status.textContent='';}catch(e){status.textContent=e.message;notify(e.message,true);}finally{working=false;for(const b of bar.querySelectorAll('button'))b.disabled=false;}}
 async function openTool(tool,e){const tab=window.open('about:blank','_blank');if(!tab)throw Error('A böngésző letiltotta az új lapot. Engedélyezd a felugró ablakot a helyi Hubnak.');try{const backend=['audio-fix','final-check'].includes(tool)?await ensureBackend():undefined;const r=await request('video-tools/open',{id:e.id,tool,backend});tab.opener=null;tab.location.href=r.url;}catch(error){tab.close();throw error;}}
 for(const [id,text,tab]of [['videoImprove','Feljavítás','improve'],['videoSound','Hang','sound'],['videoCompare','Összehasonlítás','compare'],['videoFinalize','Véglegesítés','final']])button(id,text,e=>onFinish([e.id],tab));
 const more=document.createElement('details');more.id='videoMore';const summary=document.createElement('summary');summary.textContent='Továbbiak ▾';more.append(summary);const menu=document.createElement('div');menu.className='videoMoreMenu';more.append(menu);row.append(more);
 const action=(id,text,fn)=>button(id,text,async e=>{more.open=false;await fn(e);},menu);
 action('videoStudio','Vágóasztal · Videóstúdió',e=>openTool('video-studio',e));
 action('videoLoop','Loop Lab',e=>openTool('loop-lab',e));
 action('videoFolder','Mappa megnyitása',async e=>{await request('history/open',{id:e.id,action:'folder'});notify('Megnyitva az Explorerben.');});
 action('videoFamily','Kapcsolódó változatok',e=>onFamily(e.id));
 action('videoContinue','Folytatás ebből · utolsó képkocka',async e=>{const file=await lastVideoFrame(e);await onContinue(file,e);});
 action('videoAudio','Hangjavítás · Audio Fix',e=>openTool('audio-fix',e));
 action('videoFinal','Végső ellenőrzés · Final Check',e=>openTool('final-check',e));
 action('videoRecipe','Paraméterek újrahasználata…',onRecipe);
 action('videoMetadata','Metaadatok és nagy nézet',onDetails);
 const download=document.createElement('a');download.id='videoDownload';download.textContent='Videó letöltése';menu.append(download);
 bar.append(label,row,status);$('stage').after(bar);
 function update(){if($('editCurrentImage'))$('editCurrentImage').hidden=!$('resultVideo').hidden;const e=getEntry(),show=!!e?.id&&e.mode==='video'&&!$('resultVideo').hidden;bar.hidden=!show;if(!show){more.open=false;entryId='';return;}if(entryId!==e.id){entryId=e.id;status.textContent='';more.open=false;}bar.dataset.historyId=e.id;label.textContent=e.filename;label.title='Minden művelet ezt a videót használja: '+e.filename;download.href=e.url;download.download=e.filename;}
 return {update,destroy(){bar.remove();}};
}

export async function lastVideoFrame(entry){
 const response=await fetch('/api/video-tools/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:entry.id})});
 if(!response.ok){const data=await response.json();throw Error(data.error||'Nem sikerült kiolvasni az utolsó képkockát.');}
 const blob=await response.blob();return new File([blob],entry.filename.replace(/\.[^.]+$/,'')+'_utolso_kepkocka.png',{type:'image/png'});
}
