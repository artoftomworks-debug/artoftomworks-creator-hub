// 0.16 DEV — „Következő jelenet” asszisztens (Jelenetsor + Storyboard).
// 1) folytonossági lap az előző képről (helyi, képet értő MI; átírható) → 2) egymondatos szándék → 3) prompt (MI vagy kézi)
// → 4) 3–4 jelölt a Kép fül modelljével, az előző képből indulva → 5) ellenőrzés (MI-jelzések + szín/fényesség-egyezés; tükrözés-javaslat)
// → 6) egy kattintás: a jelölt lesz a következő jelenet kezdőképe / kulcsképe. Az MI csak javasol; MI nélkül is végigvihető.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export const SHEET_LABELS=[['subject','Szereplő'],['clothing','Ruha'],['location','Helyszín'],['time','Napszak'],['light','Fény'],['facing','Nézésirány'],['moving','Mozgásirány'],['camera','Kamera'],['palette','Színvilág']];
export const advisorModel=()=>{try{return localStorage.getItem('creatorHub.assistantModel')||'';}catch{return '';}};
// Pure: MI nélküli prompt a szándékból és a (kézzel írt) lapból.
export function manualPrompt(intent,sheet){const keep=[sheet?.prompt_hint,sheet?.subject,sheet?.clothing,sheet?.light,sheet?.palette].map(v=>String(v||'').trim()).filter(Boolean);return [String(intent||'').trim(),...keep].filter(Boolean).join(', ');}
// Pure: színvilág- és fényesség-egyezés két átlagszín-statisztika között (0–100).
export function colorMatch(a,b){if(!a||!b)return null;const d=Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b)/441.7,l=Math.abs(a.l-b.l)/255;return Math.max(0,Math.round(100-(d*70+l*30)*100));}
async function stats(src){const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();const cv=document.createElement('canvas');cv.width=48;cv.height=48;const g=cv.getContext('2d');g.drawImage(img,0,0,48,48);const p=g.getImageData(0,0,48,48).data;let r=0,gg=0,b=0;for(let i=0;i<p.length;i+=4){r+=p[i];gg+=p[i+1];b+=p[i+2];}const n=p.length/4;r/=n;gg/=n;b/=n;return {r,g:gg,b,l:0.2126*r+0.7152*gg+0.0722*b};}
export async function toDataURL(src,max=1024,mirror=false){const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),cv=document.createElement('canvas');cv.width=Math.round(img.naturalWidth*k);cv.height=Math.round(img.naturalHeight*k);const g=cv.getContext('2d');if(mirror){g.translate(cv.width,0);g.scale(-1,1);}g.drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',0.93);}
const css=`.nextSceneDialog{width:min(1100px,96vw);max-height:94vh}.nextSceneDialog .nsTop{display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:start}.nextSceneDialog .nsSrc img{width:100%;border-radius:8px;background:#000}.nextSceneDialog .nsSheet{display:grid;grid-template-columns:110px 1fr;gap:4px 8px;font-size:13px}.nextSceneDialog .nsSheet input{width:100%;font-size:13px;min-height:26px;padding:2px 6px}.nextSceneDialog textarea{width:100%;min-height:54px}.nextSceneDialog .nsRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.nextSceneDialog .nsCands{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:8px}.nextSceneDialog .nsCand{background:#0b1a21;border:1px solid #2c4550;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:5px}.nextSceneDialog .nsCand img{width:100%;height:180px;object-fit:contain;background:#000;border-radius:6px}.nextSceneDialog .nsCand.mirrored img{transform:scaleX(-1)}.nextSceneDialog .nsBadges{display:flex;flex-wrap:wrap;gap:4px;font-size:12px}.nextSceneDialog .nsBadges span{padding:1px 6px;border-radius:9px;background:#17313c}.nextSceneDialog .nsBadges .ok{color:#8fd19e}.nextSceneDialog .nsBadges .warn{color:#f2c584}.nextSceneDialog .nsBest{outline:2px solid var(--gold,#f2c584)}.nextSceneDialog .nsStep{font-weight:650;margin:10px 0 4px}@media(max-width:800px){.nextSceneDialog .nsTop{grid-template-columns:1fr}}`;

export function openNextScene({request,notify,source,intent='',kind='storyboard',makeCandidates,onChoose,title}){
 if(!document.getElementById('nextSceneCss')){const st=document.createElement('style');st.id='nextSceneCss';st.textContent=css;document.head.append(st);}
 const model=advisorModel(),d=el('dialog',null,'generationDialog nextSceneDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';head.append(el('h2',title||'🪄 Következő jelenet'),close);
 const help=el('p',null,'muted');if(model)help.append(el('span','A helyi MI'),' ('+model+') ',el('span','leírja az előző képet, megírja a promptot és ellenőrzi a jelölteket. Csak javasol – a választás a tiéd.'));else help.append(el('span','Helyi MI nélkül: a folytonossági lapot és a promptot kézzel írod, a jelölteknél a Hub a színvilág és a fényesség egyezését méri. (MI-t a ✦ MI-segítőben választhatsz.)'));
 const top=el('div',null,'nsTop'),srcBox=el('div',null,'nsSrc'),srcImg=el('img');srcImg.src=source;srcImg.alt='';srcBox.append(el('div','Előző kép','muted'),srcImg);
 const right=el('div'),sheetBox=el('div',null,'nsSheet'),inputs={};for(const [k,label] of SHEET_LABELS){const i=el('input');i.placeholder='–';inputs[k]=i;sheetBox.append(el('label',label),i);}
 const hint=el('input');hint.placeholder='Megtartandó állandók angolul (a prompthoz)';inputs.prompt_hint=hint;sheetBox.append(el('label','Állandók'),hint);
 const describe=el('button','✦ Leírás az MI-vel');describe.type='button';describe.disabled=!model;
 right.append(el('p','1. Folytonossági lap','nsStep'),sheetBox,Object.assign(el('div',null,'nsRow'),{}).appendChild(describe).parentNode);top.append(srcBox,right);
 const intentT=el('textarea');intentT.value=intent;intentT.placeholder='Mi történjen a következő jelenetben? (pl. „kilép az ajtón az esős utcára”)';
 const promptT=el('textarea');promptT.placeholder='A következő jelenet promptja (angolul a legjobb)';promptT.rows=3;
 const write=el('button',model?'✦ Prompt megírása':'Prompt összeállítása');write.type='button';
 const count=el('select');for(const n of [2,3,4])count.add(new Option(n+' jelölt',String(n)));count.value='4';
 const strength=el('select');for(const [v,t] of [['0.45','Közel az előző képhez'],['0.6','Kiegyensúlyozott'],['0.75','Szabadabb új beállítás']])strength.add(new Option(t,v));strength.value='0.6';strength.title='Mennyire térhet el az új kép az előző képtől (img2img erősség)';
 const go=el('button','▶ Jelöltek készítése','primary');go.type='button';const status=el('p','','muted'),cands=el('div',null,'nsCands');
 d.append(head,help,top,el('p','2. Mi történjen ezután?','nsStep'),intentT,Object.assign(el('div',null,'nsRow')).appendChild(write).parentNode,el('p','3. Prompt','nsStep'),promptT,(()=>{const r=el('div',null,'nsRow');r.append(count,strength,go);return r;})(),status,el('p','4. Jelöltek','nsStep'),cands);
 document.body.append(d);close.onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();
 const sheet=()=>Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.value.trim()]));
 const say=(...t)=>status.replaceChildren(...t.map(x=>typeof x==='string'?el('span',x):x));
 describe.onclick=()=>void (async()=>{describe.disabled=true;say('Az MI nézi az előző képet…');try{const r=await request('studio/assistant',{action:'continuity',model,image:await toDataURL(source)});for(const [k,i] of Object.entries(inputs))i.value=r.sheet?.[k]||'';say('A folytonossági lap kész – átírhatod, mielőtt továbbmész.');}catch(e){say(e.message);}finally{describe.disabled=!model;}})();
 write.onclick=()=>void (async()=>{if(!intentT.value.trim()){say('Írd le egy mondatban, mi történjen.');intentT.focus();return;}
  if(!model){promptT.value=manualPrompt(intentT.value,sheet());return;}write.disabled=true;say('Az MI megírja a promptot…');try{const r=await request('studio/assistant',{action:'nextPrompt',model,sheet:sheet(),intent:intentT.value,mode:kind==='video'?'video':'image'});promptT.value=r.prompt;say('A prompt kész – átírhatod.');}catch(e){say(e.message);if(!promptT.value)promptT.value=manualPrompt(intentT.value,sheet());}finally{write.disabled=false;}})();
 let srcStats=null;void stats(source).then(s=>{srcStats=s;}).catch(()=>{});
 go.onclick=()=>void (async()=>{if(!promptT.value.trim()){if(intentT.value.trim())promptT.value=manualPrompt(intentT.value,sheet());else{say('Előbb írd meg, mi történjen.');return;}}
  go.disabled=true;cands.replaceChildren();try{if(model)try{await request('studio/assistant',{action:'release',model});}catch{}
   say('A jelöltek sorba állnak…');const job=await makeCandidates({prompt:promptT.value.trim(),count:Number(count.value),denoise:Number(strength.value),source});
   let items=[];for(let i=0;i<900&&d.open;i++){await wait(2000);const st=await job.status();say('Jelöltek készülnek…',' '+st.done+' / '+st.total);if(st.finished){items=st.items||[];break;}}
   if(!items.length){say('Nem készült jelölt. Az Előnézetben látod, mi történt.');return;}
   const rows=items.map(e=>({e,mirrored:false}));const render=()=>{cands.replaceChildren();for(const r of rows){const box=el('div',null,'nsCand'+(r.mirrored?' mirrored':'')),img=el('img'),badges=el('div',null,'nsBadges'),row=el('div',null,'nsRow'),pick=el('button','✓ Ezt választom','primary');img.src=r.e.url;img.alt='';pick.type='button';
     if(Number.isFinite(r.color)){const b=el('span',null,r.color>=75?'ok':'warn');b.append(el('span','Szín/fény:'),' '+r.color+'%');badges.append(b);}
     if(r.check){for(const [k,label] of [['subject','Szereplő'],['clothing','Ruha'],['light','Fény'],['facing','Irány']]){const c=r.check.checks[k];const b=el('span',(c.ok?'✓ ':'⚠ ')+label,c.ok?'ok':'warn');if(c.note)b.title=c.note;badges.append(b);}if(Number.isFinite(r.check.score))badges.append(el('span',r.check.score+' / 10'));}
     if(r.error)badges.append(el('span','MI: '+r.error,'warn'));
     const flip=el('button',r.mirrored?'↔ Eredeti irány':'↔ Tükrözve');flip.type='button';flip.title=r.check?.mirror?'Az MI szerint tükrözve stimmelne az irány':'Vízszintes tükrözés (bal ↔ jobb)';if(r.check?.mirror&&!r.mirrored)flip.classList.add('primary');flip.onclick=()=>{r.mirrored=!r.mirrored;render();};
     pick.onclick=()=>void (async()=>{pick.disabled=true;try{await onChoose({entry:r.e,mirrored:r.mirrored,prompt:promptT.value.trim(),image:await toDataURL(r.e.url,2048,r.mirrored)});d.close();}catch(e){say(e.message);pick.disabled=false;}})();
     row.append(pick,flip);box.append(img,badges,row);if(r.best)box.classList.add('nsBest');cands.append(box);}};
   for(const r of rows){try{if(srcStats)r.color=colorMatch(srcStats,await stats(r.e.url));}catch{}}render();
   if(model){const sh=sheet();if(Object.values(sh).some(Boolean)){for(const [i,r] of rows.entries()){say('Az MI ellenőrzi a jelölteket…',' '+(i+1)+' / '+rows.length);try{r.check=await request('studio/assistant',{action:'continuityCheck',model,sheet:sh,image:await toDataURL(r.e.url)});}catch(e){r.error=e.message;if(/fut|dolgozik/.test(e.message))break;}render();}try{await request('studio/assistant',{action:'release',model});}catch{}}
    else say('Folytonossági lap nélkül az MI nem tud ellenőrizni – a színvilág-egyezést látod.');}
   const scored=rows.filter(r=>r.check||Number.isFinite(r.color));if(scored.length){const v=r=>(r.check?Object.values(r.check.checks).filter(c=>c.ok).length*2+(r.check.score||0)/2:0)+(r.color||0)/25;scored.sort((a,b)=>v(b)-v(a))[0].best=true;render();}
   say('Kész. A kiemelt jelölt illik a legjobban – de te döntesz.');
  }catch(e){say(e.message);}finally{go.disabled=false;}})();
 return d;
}
