// 0.16 DEV — ✦ MI-kiértékelés egy „Több modellel” sorozat végén (opcionális, gombnyomásra).
// A helyi, képet értő MI-modell képenként pontoz (0–10), hibákat és erősségeket ír; a végén kiemeli
// a legjobbat összesen és modellenként. Csak javaslat – a kiválasztás a felhasználóé. MI nélkül a Hub ugyanúgy működik.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export const advisorModel=()=>{try{return localStorage.getItem('creatorHub.assistantModel')||'';}catch{return '';}};
export function modelFromFilename(name){const m=/_\d{2}_(.+?)_\d{5}_?\.\w+$/.exec(String(name||''));return m?m[1].replace(/_/g,' '):'';}
export function summarize(rows){
  const ok=rows.filter(r=>Number.isFinite(r.score));if(!ok.length)return {best:null,perModel:[]};
  const best=ok.reduce((a,b)=>b.score>a.score?b:a),by=new Map();for(const r of ok){const k=r.model||'?';if(!by.has(k)||r.score>by.get(k).score)by.set(k,r);}
  const avg=new Map();for(const r of ok){const k=r.model||'?',v=avg.get(k)||{sum:0,n:0};v.sum+=r.score;v.n++;avg.set(k,v);}
  return {best,perModel:[...by].map(([model,r])=>({model,best:r,average:Math.round(avg.get(model).sum/avg.get(model).n*10)/10})).sort((a,b)=>b.average-a.average)};
}
async function toDataURL(url,max=1024){const blob=await (await fetch(url)).blob(),bmp=await createImageBitmap(blob),k=Math.min(1,max/Math.max(bmp.width,bmp.height)),cv=document.createElement('canvas');cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',0.9);}

function mediaEvent(video,name){
 return new Promise((resolve,reject)=>{
  const done=error=>{
   clearTimeout(timer);
   video.removeEventListener(name,ready);video.removeEventListener('error',failed);
   if(error)reject(error);else resolve();
  };
  const ready=()=>done();
  const failed=()=>done(Error('A videó előnézete nem érhető el.'));
  const timer=setTimeout(failed,12000);
  video.addEventListener(name,ready,{once:true});
  video.addEventListener('error',failed,{once:true});
 });
}
export async function videoReviewFrames(url){
 const video=document.createElement('video');
 video.preload='auto';video.muted=true;video.playsInline=true;
 try{
  const ready=mediaEvent(video,'loadeddata');
  video.src=url;
  await ready;
  if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth)throw Error('A videó előnézete nem érhető el.');
  const ratio=Math.min(1,500/video.videoWidth,500/video.videoHeight);
  const width=Math.round(video.videoWidth*ratio),height=Math.round(video.videoHeight*ratio);
  const canvas=document.createElement('canvas');canvas.width=width*3;canvas.height=height*2;
  const ctx=canvas.getContext('2d');
  for(const [index,fraction] of [.05,.23,.41,.59,.77,.95].entries()){
   const time=video.duration*fraction;
   if(Math.abs(time-video.currentTime)>.01){
    const seek=mediaEvent(video,'seeked');
    video.currentTime=time;
    await seek;
   }
   ctx.drawImage(video,(index%3)*width,Math.floor(index/3)*height,width,height);
  }
  return canvas.toDataURL('image/jpeg',.85);
 }finally{video.removeAttribute('src');video.load();}
}

export async function openReview({request,label,notify,video=false,entries=null}){
  const model=advisorModel();if(!model){notify('A MI-kiértékeléshez válassz helyi modellt a ✦ MI-segítőben (képet értő modell kell). MI nélkül az eredményeket a Projekt szűrővel nézheted.',true);return;}
  const items=entries?entries.filter(e=>e.mode===(video?'video':'image')):[];if(!entries)for(let page=1;page<=5;page++){const r=await fetch('/api/history?'+new URLSearchParams({project:label,page:String(page)})).then(x=>x.json());for(const e of r.items||[])if((e.mode==='video'||/\.(mp4|webm|mov|mkv|m4v)$/i.test(e.filename||''))===video)items.push(e);if(page>=(r.pages||1))break;}
  if(!items.length){notify((video?'Ebben a sorozatban nincs kész videó.':'Ebben a sorozatban nem találok kész képet:')+' '+label,true);return;}
  if(video)items.splice(4);
  let prompt='';try{prompt=(await request('history/details?id='+encodeURIComponent(items[0].id)))?.prompt||'';}catch{}
  const d=el('dialog',null,'generationDialog aiReviewDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';head.append(el('h2','✦ MI-kiértékelés · '+label),close);d.append(head);
  d.append(el('p',`A helyi MI (${model}) képenként pontoz a prompthoz és a minőséghez. Csak javaslat – a választás a tiéd. Közben generálás nem fut; a MI a végén kiürül a memóriából.`,'muted'));
  if(video)d.append(el('p','Klipenként hat képkockát vizsgál, legfeljebb négy videóból.', 'muted'));
  const st=document.createElement('style');st.textContent='.aiReviewDialog{width:min(860px,95vw);max-height:92vh}.aiReviewDialog .arRow{display:grid;grid-template-columns:96px 1fr;gap:10px;padding:6px;border-bottom:1px solid #22404b}.aiReviewDialog img{width:96px;height:96px;object-fit:cover;border-radius:6px}.aiReviewDialog .arScore{font-weight:700;color:var(--gold,#f2c584)}.aiReviewDialog .arBest{outline:2px solid var(--gold,#f2c584);border-radius:8px}.aiReviewDialog .arList{max-height:52vh;overflow:auto}';d.append(st);
  const progress=el('p','','muted'),list=el('div',null,'arList'),summary=el('div'),stop=el('button','■ Leállítás');stop.type='button';d.append(progress,stop,list,summary);
  let halted=false;stop.onclick=()=>{halted=true;stop.disabled=true;};close.onclick=()=>{halted=true;d.close();};d.addEventListener('close',()=>{halted=true;d.remove();});
  document.body.append(d);d.showModal();
  const rows=[];
  for(const [i,e] of items.entries()){
    if(halted)break;progress.textContent=`Kiértékelés: ${i+1} / ${items.length}…`;
    const row=el('div',null,'arRow'),img=el('img');if(!video)img.src=e.url;img.alt='';const info=el('div');info.append(el('div',modelFromFilename(e.filename)||e.filename));row.append(img,info);list.append(row);
    const rec={id:e.id,model:modelFromFilename(e.filename),filename:e.filename,row};
    try{
      const image=video?await videoReviewFrames(e.url):await toDataURL(e.url);
      if(halted)break;
      if(video)img.src=image;
      const details=await request('history/details?id='+encodeURIComponent(e.id)).catch(()=>null);
      if(halted)break;
      const r=await request('studio/assistant',{action:'review',model,prompt:details?.prompt||prompt,label:rec.model,image,video});Object.assign(rec,r);
      info.append(el('div','Pontszám: '+r.score+' / 10','arScore'));if(r.strengths?.length)info.append(el('div','✓ '+r.strengths.join(' · ')));if(r.issues?.length)info.append(el('div','⚠ '+r.issues.join(' · ')));}
    catch(err){info.append(el('div','✗ '+err.message));if(/fut|dolgozik|nincs telepítve|nem lát/i.test(err.message)){halted=true;}}
    rows.push(rec);
  }
  try{await request('studio/assistant',{action:'release',model});}catch{}
  stop.hidden=true;const s=summarize(rows);
  progress.textContent=halted&&rows.length<items.length?`Leállítva: ${rows.filter(r=>Number.isFinite(r.score)).length} kép értékelve.`:`Kész: ${rows.filter(r=>Number.isFinite(r.score)).length} / ${items.length} kép értékelve · a MI memóriája felszabadítva.`;
  if(s.best){s.best.row.classList.add('arBest');summary.append(el('h3','Javaslat'),el('p',`★ Legjobb összesen: ${s.best.model||s.best.filename} · ${s.best.score} / 10`));
    for(const m of s.perModel)summary.append(el('p',`${m.model}: átlag ${m.average} · legjobb ${m.best.score}`));summary.append(el('p','A pontszám a helyi MI véleménye: tájékoztató, nem ítélet.','muted'));}
}
