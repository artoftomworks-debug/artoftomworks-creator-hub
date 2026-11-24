// 0.16 DEV — ✦ Kiegészítők: modellcsaládhoz illő minőségi és stílus-kifejezések egy kattintással.
// Címkealapú modelleknél (SDXL, Illustrious, Pony, SD1.5) címkék – a Ponynál a score_9… sor is –, a mondatokat értő
// modelleknél (Flux, Krea2, Qwen, MOSS, videómodellek) leíró kifejezések. Kattintás: be / ki; ugyanaz kétszer nem kerül be,
// a saját szöveghez nem nyúl. Saját csomagok menthetők. Negatív kiegészítő csak ahol a modell használja.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export function styleOf(model){const f=String(model?.family||'').toLowerCase(),n=String(model?.name||'').toLowerCase();if(/pony/.test(f)||/pony/.test(n))return 'pony';if(['sdxl','illustrious','sd15','sd1','sd2'].some(x=>f.includes(x))||/illustrious|noob/.test(n))return 'tags';return 'natural';}
const NATURAL={
 'Minőség':['highly detailed, sharp focus','professional photography','award-winning photo'],
 'Fotó / objektív':['shot on 85mm lens, shallow depth of field','35mm film photo, natural grain','editorial fashion photography','macro photography','wide-angle shot'],
 'Fény':['soft diffused studio light','golden hour sunlight','dramatic rim lighting','moody low-key lighting','neon light reflections'],
 'Stílus':['cinematic color grading','minimalist composition','watercolor illustration','3D render, octane render','anime key visual'],
 'Hangulat':['calm and serene atmosphere','mysterious atmosphere','joyful atmosphere','melancholic atmosphere']};
const TAGS={
 'Minőség':['masterpiece, best quality','ultra detailed, highres','absurdres','very aesthetic'],
 'Fotó / objektív':['photorealistic, realistic','depth of field','close-up','full body','cowboy shot'],
 'Fény':['soft lighting','backlighting','rim light','sunset','neon lights'],
 'Stílus':['cinematic','anime coloring','watercolor (medium)','3d','flat color'],
 'Hangulat':['serene','mysterious','happy','melancholy']};
const PONY={'Pony minőség':['score_9, score_8_up, score_7_up','score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up'],'Pony forrás':['source_photo','source_anime','source_cartoon','source_furry'],'Pony besorolás':['rating_safe','rating_questionable']};
const MOTION={'Mozgás':['smooth natural motion','slow motion','subtle movement','dynamic action'],'Tempó':['steady pacing','fast-paced','gentle, slow pacing']};
const NEG={tags:['lowres, bad anatomy, bad hands, extra fingers, missing fingers','blurry, jpeg artifacts','watermark, signature, text'],pony:['score_4, score_5, score_6','lowres, bad anatomy, bad hands, extra fingers','watermark, signature, text']};
export function groupsFor(style,mode){const base=style==='pony'?{...PONY,...TAGS}:style==='tags'?TAGS:NATURAL;const out={...base};if(style==='pony')delete out['Minőség'];if(mode==='video')Object.assign(out,MOTION);return out;}
export function negativesFor(style){return NEG[style]||[];}
// Pure: be/ki kapcsolás egy vesszős listában, a többi szöveg érintetlen.
export function hasTag(text,tag){return (', '+String(text||'')+',').toLowerCase().includes(', '+tag.toLowerCase()+',')||String(text||'').trim().toLowerCase()===tag.toLowerCase()||String(text||'').toLowerCase().startsWith(tag.toLowerCase()+',');}
export function toggleTag(text,tag,{front=false}={}){const t=String(text||'').trim();if(hasTag(t,tag)){const parts=t.split(/,\s*/);const tagParts=tag.split(/,\s*/).map(x=>x.toLowerCase());let out=[],i=0;while(i<parts.length){const slice=parts.slice(i,i+tagParts.length).map(x=>x.toLowerCase());if(slice.join('|')===tagParts.join('|')){i+=tagParts.length;continue;}out.push(parts[i]);i++;}return out.join(', ');}
 if(!t)return tag;return front?tag+', '+t:t+', '+tag;}
const PACKS='creatorHub.enhancerPacks';
function loadPacks(){try{const v=JSON.parse(localStorage.getItem(PACKS)||'[]');return Array.isArray(v)?v.slice(0,40):[];}catch{return [];}}
function savePacks(v){try{localStorage.setItem(PACKS,JSON.stringify(v.slice(0,40)));}catch{}}

export function createEnhancers({$,state,current,edited,selectedModel}){
 const css=document.createElement('style');css.textContent=`#enhancers{margin:4px 0 8px}#enhancers summary{font-size:13px;color:var(--gold,#f2c584);cursor:pointer}#enhancers .enhGroup{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:4px 0}#enhancers .enhGroup b{font-size:11px;color:#a8beca;min-width:92px}#enhancers button{min-height:24px;padding:1px 8px;font-size:12px;margin:0;width:auto;border-radius:12px}#enhancers button.on{background:#3a2f17;border-color:var(--gold,#f2c584);color:#ffe2b8}#enhancers .enhNote{font-size:11px;color:#7d96a2;margin:2px 0}`;document.head.append(css);
 const box=el('details');box.id='enhancers';const sum=el('summary');sum.append(el('span','✦ Kiegészítők'),' ',el('span','','enhStyle'));const body=el('div');box.append(sum,body);
 const anchor=$('prompt')?.closest('label');anchor?.after(box);
 function apply(field,tag,front){const f=$(field);if(!f)return;f.value=toggleTag(f.value,tag,{front});f.dispatchEvent(new Event('input',{bubbles:true}));current()[field]=f.value;edited();render();}
 function chip(field,tag,front){const b=el('button',tag);b.type='button';b.classList.toggle('on',hasTag($(field)?.value,tag));b.title=b.classList.contains('on')?'Kivétel a promptból':'Hozzáadás a prompthoz';b.onclick=()=>apply(field,tag,front);return b;}
 function render(){if(!box.open){const m=selectedModel?.();sum.querySelector('.enhStyle').textContent=m?'· '+({pony:'Pony címkék',tags:'címkék',natural:'leíró kifejezések'}[styleOf(m)]):'';return;}
  const m=selectedModel?.(),style=styleOf(m),mode=state().mode;sum.querySelector('.enhStyle').textContent='· '+({pony:'Pony címkék',tags:'címkék',natural:'leíró kifejezések'}[style]);body.replaceChildren();
  body.append(el('p',style==='natural'?'Ez a modell mondatokat ért: a „masterpiece” jellegű címkék itt alig hatnak, ezért leíró kifejezéseket ajánlok.':style==='pony'?'Pony modell: a score_… sor az elejére kerül, ahogy a modell várja.':'Címkealapú modell: a minőségi címkék itt valóban számítanak.','enhNote'));
  for(const [g,tags] of Object.entries(groupsFor(style,mode))){const row=el('div',null,'enhGroup');row.append(el('b',g));for(const t of tags)row.append(chip('prompt',t,/^score_|^source_|^rating_|masterpiece/.test(t)));body.append(row);}
  const neg=negativesFor(style);if(neg.length&&$('negative')){const row=el('div',null,'enhGroup');row.append(el('b','Negatív'));for(const t of neg)row.append(chip('negative',t,false));body.append(row);}
  const packs=loadPacks().filter(p=>!p.style||p.style===style),prow=el('div',null,'enhGroup');prow.append(el('b','Saját csomagok'));
  for(const p of packs){const b=el('button','📦 '+p.name);b.type='button';b.title=p.tags.join(', ');b.onclick=()=>{const f=$('prompt');let v=f.value;for(const t of p.tags)if(!hasTag(v,t))v=toggleTag(v,t,{front:/^score_|^source_|^rating_|masterpiece/.test(t)});f.value=v;f.dispatchEvent(new Event('input',{bubbles:true}));current().prompt=v;edited();render();};b.oncontextmenu=async e=>{e.preventDefault();const tt=(await import('./i18n-ui.mjs').catch(()=>null))?.translateText||(x=>x);if(confirm(tt(`Törlöd a „${p.name}” csomagot?`))){savePacks(loadPacks().filter(x=>x!==p&&!(x.name===p.name&&x.style===p.style)));render();}};prow.append(b);}
  const save=el('button','💾 A bekapcsoltak mentése csomagként');save.type='button';save.title='A most bekapcsolt kiegészítők elmentése egy névvel (jobb kattintás egy csomagon: törlés)';save.onclick=async()=>{const tt=(await import('./i18n-ui.mjs').catch(()=>null))?.translateText||(x=>x);const on=Object.values(groupsFor(style,mode)).flat().filter(t=>hasTag($('prompt').value,t));if(!on.length)return;const name=(prompt(tt('A csomag neve (pl. Portré csomag)'))||'').trim().slice(0,40);if(!name)return;savePacks([...loadPacks().filter(x=>!(x.name===name&&x.style===style)),{name,style,tags:on}]);render();};prow.append(save);body.append(prow);}
 box.addEventListener('toggle',render);$('prompt')?.addEventListener('input',()=>{if(box.open)for(const b of body.querySelectorAll('button')){const t=b.textContent;if(!/^📦|^💾/.test(t))b.classList.toggle('on',hasTag(b.closest('.enhGroup')?.firstChild?.textContent==='Negatív'?$('negative').value:$('prompt').value,t));}});
 setInterval(()=>{if(!box.open)render();},3000);render();
 return {render};
}
