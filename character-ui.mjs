// 0.16 DEV — Karakter-hűség (PuLID-Flux): one reference face keeps the same person across images and storyboard keyframes.
// State lives in current().character = {enabled, image (data URL), weight}; the plan sends it only in image mode with automatic model choice.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const GB=b=>(b/1024**3).toLocaleString(undefined,{maximumFractionDigits:1})+' GB';
const css=`#characterPanel [hidden]{display:none!important}#characterPanel .charBody{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:start}#characterPanel .charFace{width:96px;height:96px;border-radius:10px;background:#071116;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#7d96a2;font-size:12px;text-align:center}#characterPanel .charFace img{width:100%;height:100%;object-fit:cover}#characterPanel .charRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}#characterPanel .charRow button{min-height:28px;padding:2px 9px;font-size:13px}#characterPanel progress{width:100%;height:8px}#characterPanel .charState{font-size:13px}#characterPanel .charState.ok{color:#8fd19e}#characterPanel .charState.warn{color:#f2c584}#characterPanel .charBook select{max-width:180px}#characterPanel .charBook input{max-width:140px}#characterPanel.dragover{outline:2px dashed var(--gold,#f2c584)}`;

export function shrinkImage(dataURL,max=1024){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*k),h=Math.round(img.naturalHeight*k);const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);resolve(cv.toDataURL('image/jpeg',0.92));};img.onerror=()=>reject(Error('A kép nem olvasható.'));img.src=dataURL;});}

export function createCharacterUI({$,state,current,request,edited,notify,selectedModel}){
 const st=document.createElement('style');st.textContent=css;document.head.append(st);
 const panel=el('details',null,'recipePanel');panel.id='characterPanel';
 const sum=el('summary');sum.append(el('span','Karakter-hűség'),' ',el('span','NEW','newTag'));
 const help=el('p','Egy arcképből ugyanazt az arcot viszi tovább a képeken és a storyboard kulcsképein. Jelenleg Flux 1 modellel működik (PuLID).','muted');
 const on=el('input');on.type='checkbox';const onL=el('label',null,'check');onL.append(on,el('span','Karakter használata a generálásnál'));
 const face=el('div','Nincs arckép','charFace'),side=el('div');
 const pick=el('button','Arckép kiválasztása'),fromResult=el('button','Az előnézeti képből'),clear=el('button','Eltávolítás'),file=el('input');for(const b of [pick,fromResult,clear])b.type='button';file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;
 fromResult.title='Az Előnézet és eredmény panelen most látható kép lesz a karakter arca';
 const row=el('div',null,'charRow');row.append(pick,fromResult,clear,file);
 const weight=el('input');weight.type='range';weight.min='0.5';weight.max='1.3';weight.step='0.05';const wv=el('b');const wL=el('label',null,'charRow');wL.append(el('span','Erősség'),weight,wv);
 wL.title='Nagyobb érték: jobban ragaszkodik az archoz, de kevésbé követi a promptot. 0,8–1,0 a jó kiindulás.';
 const status=el('p','','charState'),bar=el('progress');bar.hidden=true;bar.max=1;const install=el('button'),cancel=el('button','Megszakítás');install.type=cancel.type='button';install.hidden=cancel.hidden=true;
 const instRow=el('div',null,'charRow');instRow.append(install,cancel);
 /* 0.16 DEV: karakterkönyv – mentett szereplők */
 const book=el('select'),bookName=el('input'),bookSave=el('button','💾 Mentés'),bookDel=el('button','🗑');book.title='Karakterkönyv: mentett szereplők arcképpel és erősséggel';bookName.placeholder='Név, pl. Lili';bookName.maxLength=60;bookSave.type=bookDel.type='button';bookSave.title='Az arckép és az erősség mentése a karakterkönyvbe ezzel a névvel';bookDel.title='A kiválasztott karakter törlése a karakterkönyvből (a képek megmaradnak)';
 const bookRow=el('div',null,'charRow charBook');bookRow.append(el('span','Karakterkönyv:'),book,bookName,bookSave,bookDel);
 side.append(row,wL,bookRow);const body=el('div',null,'charBody');body.append(face,side);
 panel.append(sum,help,onL,body,status,bar,instRow);
 const anchor=$('recipePanel')||$('prompt')?.closest('label');anchor?.parentNode.insertBefore(panel,anchor);
 let pack=null,timer=null;
 const ch=()=>{const c=current();c.character??={enabled:false,image:'',weight:0.9};return c.character;};
 function render(){
  panel.hidden=state().mode!=='image';if(panel.hidden)return;const c=ch();on.checked=!!c.enabled;weight.value=String(c.weight??0.9);wv.textContent=Number(weight.value).toFixed(2);
  face.replaceChildren(c.image?Object.assign(el('img'),{src:c.image,alt:'Karakter arca'}):document.createTextNode('Nincs arckép'));clear.disabled=!c.image;
  const r=$('resultImage');fromResult.disabled=!(r&&r.src&&!r.hidden&&/^https?:|^data:image/.test(r.src));
  const m=selectedModel?.(),job=pack?.job||{};let text=[],cls='';install.hidden=cancel.hidden=bar.hidden=true;
  if(!pack)text=['Karakterkészlet ellenőrzése…'];
  else if(pack.error){text=[pack.error];cls='warn';}
  else if(pack.nodes===false){text=['A ComfyUI-ban nincs PuLID-Flux node, így a karakter-hűség nem érhető el.'];cls='warn';}
  else if(job.state==='downloading'){text=['Karakterkészlet letöltése…',' '+(job.file||'')+' · '+GB(job.bytes||0)+' / '+GB(job.total||0)];bar.hidden=false;bar.value=job.total?job.bytes/job.total:0;cancel.hidden=false;}
  else if(!pack.ready){text=[...(job.state==='failed'?['A letöltés megszakadt:',' '+job.error+' ']:[]),'A karakterhez szükséges modellek még hiányoznak:',' '+GB(pack.missingBytes)+'. ','A ComfyUI models mappájába kerülnek.'];cls='warn';install.hidden=false;install.replaceChildren(el('span','⬇ Karakterkészlet letöltése'),' ('+GB(pack.missingBytes)+')');}
  else if(m&&m.family!=='flux1'){text=['Kész, de a karakter-hűség csak Flux 1 modellel működik. A mostani modell nem az.'];cls='warn';}
  else{text=['Kész. Az első futáskor a ComfyUI még letölti az EVA-CLIP arcmodellt (kb. 0,9 GB), ezért az lassabb lesz.'];cls='ok';}
  status.replaceChildren(...text.map(t=>/^\s|^$/.test(t)||/^[\d ·./GB]+$/.test(t)?document.createTextNode(t):el('span',t)));status.className='charState '+cls;
  sum.querySelector('.charOn')?.remove();if(c.enabled&&c.image)sum.append(el('span',' ✓','charOn'));
 }
 let bookList=[];
 async function loadBook(){try{bookList=(await fetch('/api/characters').then(r=>r.json())).characters||[];}catch{bookList=[];}const cur=ch().bookId||'';book.replaceChildren(new Option('— válassz szereplőt —',''),...bookList.map(c=>new Option(c.name,c.id)));book.value=bookList.some(c=>c.id===cur)?cur:'';bookDel.disabled=!book.value;}
 async function pickCharacter(id){if(!id)return;const r=await fetch('/api/characters/get?id='+encodeURIComponent(id)).then(x=>x.json());if(r.error)throw Error(r.error);const c=ch();c.image=r.character.image;c.weight=r.character.weight;c.enabled=true;c.bookId=r.character.id;c.name=r.character.name;bookName.value=r.character.name;changed();book.value=id;bookDel.disabled=false;}
 book.onchange=()=>void pickCharacter(book.value).catch(e=>notify(e.message,true));
 bookSave.onclick=()=>void (async()=>{const c=ch();if(!c.image)throw Error('Előbb válassz arcképet.');const name=bookName.value.trim()||c.name||'';if(!name)throw Error('Adj nevet a karakternek.');const r=await request('characters/save',{character:{id:c.bookId&&c.name===name?c.bookId:undefined,name,image:c.image,weight:c.weight??0.9}});c.bookId=r.character.id;c.name=name;edited();await loadBook();notify(['💾',' ',name,' ','bekerült a karakterkönyvbe.']);})().catch(e=>notify(e.message,true));
 bookDel.onclick=()=>void (async()=>{const id=book.value;if(!id)return;const name=bookList.find(c=>c.id===id)?.name||'';const tr=(await import('./i18n-ui.mjs').catch(()=>null))?.translateText||(t=>t);if(!confirm(name+' – '+tr('Törlöd a karakterkönyvből? Az elkészült képek megmaradnak.')))return;await request('characters/delete',{id});if(ch().bookId===id)delete ch().bookId;edited();await loadBook();})().catch(e=>notify(e.message,true));
 addEventListener('creatorhub:character-pick',e=>{const id=e.detail?.id;if(id)void pickCharacter(id).catch(err=>notify(err.message,true));else{ch().enabled=false;changed();}});
 addEventListener('creatorhub:characters-changed',()=>void loadBook());
 void loadBook();
 async function refresh(){try{pack=await fetch('/api/character/status').then(r=>r.json());}catch{pack={error:'A karakterkészlet állapota nem olvasható.'};}render();clearTimeout(timer);if(pack?.job?.state==='downloading')timer=setTimeout(refresh,1200);}
 function changed(){render();edited();}
 async function setImage(data){ch().image=await shrinkImage(data);ch().enabled=true;delete ch().bookId;book.value='';changed();}
 const readFile=f=>new Promise((res,rej)=>{if(!f||!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>16*1024**2)return rej(Error('PNG, JPEG vagy WebP kép szükséges.'));const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
 pick.onclick=()=>file.click();file.onchange=()=>{const f=file.files[0];file.value='';readFile(f).then(setImage).catch(e=>notify(e.message,true));};
 fromResult.onclick=()=>void (async()=>{const r=$('resultImage');const blob=await fetch(r.src).then(x=>{if(!x.ok)throw Error('A kép nem érhető el.');return x.blob();});await setImage(await readFile(new File([blob],'result',{type:blob.type})));notify('Az előnézeti kép lett a karakter arca.');})().catch(e=>notify(e.message,true));
 clear.onclick=()=>{ch().image='';ch().enabled=false;delete ch().bookId;book.value='';changed();};
 on.onchange=()=>{if(on.checked&&!ch().image){on.checked=false;notify('Előbb válassz arcképet.',true);return;}ch().enabled=on.checked;changed();};
 weight.oninput=()=>{ch().weight=Number(weight.value);wv.textContent=Number(weight.value).toFixed(2);};weight.onchange=()=>changed();
 install.onclick=()=>void request('character/install',{}).then(r=>{pack=r;render();clearTimeout(timer);timer=setTimeout(refresh,800);}).catch(e=>notify(e.message,true));
 cancel.onclick=()=>void request('character/cancel',{}).then(r=>{pack=r;render();}).catch(e=>notify(e.message,true));
 panel.addEventListener('dragover',e=>{e.preventDefault();panel.classList.add('dragover');});panel.addEventListener('dragleave',()=>panel.classList.remove('dragover'));
 panel.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();panel.classList.remove('dragover');readFile(e.dataTransfer.files[0]).then(setImage).catch(err=>notify(err.message,true));});
 panel.addEventListener('toggle',()=>{if(panel.open)void refresh();});
 void refresh();
 return {render,refresh};
}

// Plan helper (pure): what the generation request carries.
export function characterPayload(mode,c){const x=c?.character;if(mode!=='image'||!c?.automatic||!x?.enabled||!x.image)return null;return {image:x.image,weight:Math.min(1.3,Math.max(0.5,Number(x.weight)||0.9))};}
