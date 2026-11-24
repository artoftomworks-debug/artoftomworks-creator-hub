// 0.16 DEV — 💡 Ötlettár: gyors felírás bárhonnan (fejléc gomb, Alt+I, „💡 Ötletnek” az eredménynél),
// továbbküldés a MI-segítőnek (kép/videó prompt), közvetlenül a promptba vagy egy storyboard új jelenetének.
const TAGS=[['kép','🖼 Kép'],['videó','🎬 Videó'],['storyboard','🎞 Storyboard']];
const css=`.ideaDialog{width:min(860px,94vw);max-height:88vh;padding:0;border:1px solid var(--gold,#f2c584);border-radius:12px;background:#0d1d26;color:#e8f0f4}
.ideaDialog::backdrop{background:#000a}.ideaDialog .idBody{display:flex;flex-direction:column;gap:10px;padding:14px 16px;max-height:calc(88vh - 10px);overflow:auto}
.ideaDialog h2{margin:0;font-size:18px}.ideaDialog .idHead{display:flex;justify-content:space-between;align-items:center;gap:10px}
.ideaDialog textarea{width:100%;min-height:70px;box-sizing:border-box}.ideaDialog .idRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ideaDialog .idRow label{display:inline-flex;gap:4px;align-items:center;font-size:13px}.ideaDialog button{width:auto;margin:0;min-height:30px;padding:3px 10px;font-size:13px}
.ideaDialog .idPreview{max-height:90px;max-width:160px;border-radius:6px}.ideaDialog .idPreview[hidden],.ideaDialog [hidden]{display:none!important}
.ideaDialog .idRow select,.ideaDialog .idRow input[type=search]{width:auto;flex:1 1 160px;margin:0}
.ideaList{display:flex;flex-direction:column;gap:8px}.ideaItem{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:9px;border:1px solid #2a4452;border-radius:9px;background:#10232d}
.ideaItem.done{opacity:.55}.ideaItem img{width:96px;height:96px;object-fit:cover;border-radius:6px}.ideaItem .idText{white-space:pre-wrap;word-break:break-word;font-size:14px}
.ideaItem .idMeta{font-size:12px;color:#a8beca}.ideaItem .idActs{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.ideaItem .idActs button{min-height:26px;padding:2px 8px;font-size:12px}
.ideaEmpty{color:#a8beca;font-size:14px;padding:10px 0}`;
function el(tag,props={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...kids.filter(k=>k!=null));return e;}
export async function shrinkImage(src,max=512){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('A kép nem olvasható.'));i.src=src;});const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82);}
const fileToURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('A fájl nem olvasható.'));r.readAsDataURL(f);});
export function createIdeas({request,notify,setPrompt,translate=t=>t}){
  const tr=t=>{try{return translate(t);}catch{return t;}};
  if(document.getElementById('ideaDialog'))return null;
  document.head.append(el('style',{textContent:css}));
  let ideas=[],draft={image:'',ref:''},editing=null,filter='open',tagFilter='';
  const text=el('textarea',{id:'ideaText',placeholder:'Pl. „Ködös kikötő hajnalban, egy macska a mólón ül” – bármi, ami eszedbe jut.'});
  const tagBoxes=TAGS.map(([v,l])=>{const c=el('input',{type:'checkbox',value:v});return [c,el('label',{},c,el('span',{textContent:l}))];});
  const preview=el('img',{class:'idPreview',hidden:true,alt:''});const dropImg=el('button',{type:'button',textContent:'✕ Kép nélkül',hidden:true});
  const fileIn=el('input',{type:'file',accept:'image/png,image/jpeg,image/webp',hidden:true});const pick=el('button',{type:'button',textContent:'🖼 Kép hozzáadása…',title:'Képet is csatolhatsz (vagy Ctrl+V-vel beillesztheted a szövegmezőbe).'});
  const saveBtn=el('button',{type:'button',textContent:'💾 Ötlet mentése',class:'primary'});const cancelEdit=el('button',{type:'button',textContent:'Szerkesztés elvetése',hidden:true});
  const status=el('span',{class:'idMeta',id:'ideaStatus'});
  const fSel=el('select',{title:'Szűrés'},el('option',{value:'open',textContent:'Nyitott ötletek'}),el('option',{value:'all',textContent:'Mind'}),el('option',{value:'done',textContent:'Megvalósult'}));
  const tSel=el('select',{title:'Címke'},el('option',{value:'',textContent:'Minden címke'}),...TAGS.map(([v,l])=>el('option',{value:v,textContent:l})));
  const search=el('input',{type:'search',placeholder:'Keresés az ötletekben…'});
  const list=el('div',{class:'ideaList'});const close=el('button',{type:'button',textContent:'Bezárás'});
  const dialog=el('dialog',{id:'ideaDialog',class:'ideaDialog'},el('div',{class:'idBody'},
    el('div',{class:'idHead'},el('h2',{textContent:'💡 Ötlettár'}),close),
    el('div',{class:'idMeta',textContent:'Írd fel gyorsan, ami eszedbe jut – később egy kattintással promptot, videót vagy storyboard-jelenetet csinálhatsz belőle. Gyorsbillentyű: Alt+I.'}),
    text,el('div',{class:'idRow'},...tagBoxes.map(x=>x[1]),pick,preview,dropImg,fileIn),
    el('div',{class:'idRow'},saveBtn,cancelEdit,status),
    el('div',{class:'idRow'},fSel,tSel,search),list));
  document.body.append(dialog);
  const setImage=url=>{draft.image=url||'';preview.src=draft.image;preview.hidden=!draft.image;dropImg.hidden=!draft.image;};
  async function addFile(f){if(!f||!/^image\//.test(f.type))return;try{setImage(await shrinkImage(await fileToURL(f)));}catch(e){status.textContent=e.message;}}
  pick.onclick=()=>fileIn.click();fileIn.onchange=()=>{void addFile(fileIn.files[0]);fileIn.value='';};dropImg.onclick=()=>setImage('');
  text.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();void addFile(f);}});
  const reset=()=>{editing=null;text.value='';draft={image:'',ref:''};setImage('');for(const [c] of tagBoxes)c.checked=false;cancelEdit.hidden=true;saveBtn.textContent=tr('💾 Ötlet mentése');};
  cancelEdit.onclick=reset;close.onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  async function load(){try{ideas=(await request('ideas')).ideas||[];}catch(e){ideas=[];status.textContent=e.message;}draw();}
  async function persist(idea){const r=await request('ideas/save',{idea});const i=ideas.findIndex(x=>x.id===r.idea.id);if(i>=0)ideas[i]=r.idea;else ideas.unshift(r.idea);draw();return r.idea;}
  saveBtn.onclick=async()=>{try{const idea={...(editing||{}),text:text.value,image:draft.image,ref:draft.ref,tags:tagBoxes.filter(([c])=>c.checked).map(([c])=>c.value)};await persist(idea);reset();status.textContent=tr('Ötlet elmentve ✓');}catch(e){status.textContent=e.message;}};
  text.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveBtn.click();}});
  for(const s of [fSel,tSel])s.onchange=()=>{filter=fSel.value;tagFilter=tSel.value;draw();};search.oninput=()=>draw();
  async function toStoryboard(idea){const boards=(await request('storyboards')).boards||[];if(!boards.length)throw Error('Még nincs storyboardod. Hozz létre egyet a 🎞 Storyboard gombbal, utána ide is tudsz jelenetet küldeni.');
    let board=boards[0];if(boards.length>1){const names=boards.slice(0,9).map((b,i)=>(i+1)+'. '+b.name).join('\n');const n=Number.parseInt(prompt(tr('Melyik storyboardhoz adjam új jelenetként?')+'\n'+names,'1'));if(!Number.isFinite(n))return;board=boards[n-1];if(!board)throw Error('Nincs ilyen sorszámú storyboard.');}
    const shots=[...(board.shots||[]),{text:idea.text||'',duration:5}];await request('storyboards/save',{board:{...board,shots}});notify([tr('Az ötlet új jelenetként bekerült ide:'),' ',board.name,' (',String(shots.length),'. jelenet).']);}
  function draw(){list.replaceChildren();const q=search.value.trim().toLowerCase();
    const shown=ideas.filter(i=>(filter==='all'||(filter==='done')===!!i.done)&&(!tagFilter||i.tags?.includes(tagFilter))&&(!q||String(i.text).toLowerCase().includes(q)));
    if(!shown.length){list.append(el('div',{class:'ideaEmpty',textContent:ideas.length?tr('Ebben a szűrésben nincs ötlet.'):tr('Még nincs felírt ötleted. Az első pár szó is elég!')}));return;}
    for(const i of shown){const done=el('input',{type:'checkbox',checked:!!i.done,title:'Megvalósult'});done.onchange=()=>void persist({...i,done:done.checked}).catch(e=>notify(e.message,true));
      const b=(label,title,fn)=>{const x=el('button',{type:'button',textContent:label,title});x.onclick=()=>void Promise.resolve().then(fn).catch(e=>notify(e.message,true));return x;};
      const meta=el('div',{class:'idMeta'},el('span',{textContent:new Date(i.created).toLocaleString()}),...(i.tags||[]).map(t=>el('span',{textContent:' · '+(TAGS.find(x=>x[0]===t)?.[1]||t)})),el('span',{textContent:' · '}),el('label',{},done,el('span',{textContent:'Megvalósult'})));
      const acts=el('div',{class:'idActs'},
        b('✨ Képprompt','A MI-segítő képprompttá alakítja (Ötletből kép / videó, cél: Kép)',()=>{dialog.close();dispatchEvent(new CustomEvent('creatorhub:assistant-open',{detail:{text:i.text,task:'scene',target:'image'}}));}),
        b('🎬 Videóprompt','A MI-segítő videópromptot ír belőle (cél: Videó)',()=>{dialog.close();dispatchEvent(new CustomEvent('creatorhub:assistant-open',{detail:{text:i.text,task:'scene',target:'video'}}));}),
        b('⤵ Promptba','A szöveget változtatás nélkül a nyitott fül promptjába írja',()=>{if(!i.text)throw Error('Ennek az ötletnek nincs szövege.');setPrompt(i.text);dialog.close();}),
        b('🎞 Storyboardba','Új jelenetként hozzáadja egy storyboardhoz',()=>toStoryboard(i)),
        b('✎','Szerkesztés',()=>{editing=i;text.value=i.text||'';draft={image:i.image||'',ref:i.ref||''};setImage(draft.image);for(const [c] of tagBoxes)c.checked=!!i.tags?.includes(c.value);cancelEdit.hidden=false;saveBtn.textContent=tr('💾 Módosítás mentése');text.focus();text.scrollIntoView({block:'nearest'});}),
        b('🗑','Törlés',async()=>{if(!confirm(tr('Biztosan törlöd ezt az ötletet?')))return;await request('ideas/delete',{id:i.id});ideas=ideas.filter(x=>x.id!==i.id);draw();}));
      const body=el('div',{},el('div',{class:'idText',textContent:i.text||'—'}),meta,acts);
      const item=el('div',{class:'ideaItem'+(i.done?' done':'')},i.image?el('img',{src:i.image,alt:'',loading:'lazy'}):el('span'),body);list.append(item);}}
  async function open(x={}){if(!dialog.open)dialog.showModal();await load();if(x.text!=null||x.image){reset();text.value=x.text||'';draft.ref=x.ref||'';if(x.image){try{setImage(await shrinkImage(x.image));}catch{}}for(const [c] of tagBoxes)c.checked=(x.tags||[]).includes(c.value);}text.focus();}
  const button=el('button',{type:'button',id:'ideasButton',textContent:'💡 Ötletek',title:'Ötlettár – gyorsan felírt ötletek (Alt+I)'});button.onclick=()=>void open();
  const place=()=>{const nav=document.querySelector('body>header nav');if(!nav||nav.contains(button))return !!nav;const gear=nav.querySelector('.hubGear');gear?nav.insertBefore(button,gear):nav.append(button);return true;};
  if(!place()){const t=setInterval(()=>{if(place())clearInterval(t);},500);setTimeout(()=>clearInterval(t),15000);}else setTimeout(place,1500);
  addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='i'||e.key==='I'||e.code==='KeyI')){e.preventDefault();void open();}});
  addEventListener('creatorhub:idea-capture',e=>void open(e.detail||{}));
  return {open,destroy(){dialog.remove();button.remove();}};
}
