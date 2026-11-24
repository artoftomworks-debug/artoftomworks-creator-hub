// 0.16 DEV — Sorozatkijelző a generálás sávjában: „Több modellel” és sima sorozatokhoz is.
// N / M kész · most: modell, formátum · ⏸ Szünet (a futó kép elkészül) · ⏸ Szünet most · ▶ Folytatás ·
// ✕ Megszakítás (a kész képek megmaradnak) · Részletek. A döntés mindig a felhasználóé; minden gomb kérésre fut.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const LIVE=['queued','running','paused','waiting-cancel'];

// Pure: what the indicator shows for a queue snapshot (+ jobs of the running run).
const sp=t=>{const e=document.createElement('span');e.textContent=t;return e;};
export function seriesView(queue,run){
  const entries=queue?.entries||[],current=entries.find(e=>e.runId&&e.runId===queue.current)||entries.find(e=>e.state==='running')||null;
  const focus=current||entries.find(e=>['paused','queued','waiting-cancel'].includes(e.state))||null;if(!focus)return null;
  const doneRun=run&&run.id===focus.runId?(run.jobs||[]).filter(j=>j.state==='complete').length:0,runTotal=run&&run.id===focus.runId?(run.jobs||[]).length:0;
  const live=focus.batch?entries.filter(e=>e.batch?.id===focus.batch.id):[focus];
  const imagesOf=e=>Number(e.batch?.images)||(e===focus&&runTotal)||1;
  let total=0,done=0;for(const e of live){const n=imagesOf(e);total+=n;done+=e.state==='complete'?n:e===focus?doneRun:Math.min(n,Number(e.done)||0);}
  const paused=!queue.armed&&live.some(e=>e.state==='paused'),running=live.some(e=>e.state==='running')&&queue.armed;
  /* 0.16 DEV: hol tart – hányadik terv a hányból, hányadik modell, a futó terv hányadik képe */
  const ordered=[...live].sort((a,b)=>(a.batch?.index??0)-(b.batch?.index??0)),planIndex=ordered.indexOf(focus)+1,planTotal=Math.max(ordered.length,Number(focus.batch?.total)||0);
  const models=[...new Set(ordered.map(e=>e.batch?.model).filter(Boolean))],modelIndex=focus.batch?.model?models.indexOf(focus.batch.model)+1:0;
  const imageNow=runTotal?Math.min(runTotal,doneRun+(focus.state==='running'?1:0)):0;
  return {planIndex,planTotal,modelIndex,modelTotal:models.length,model:focus.batch?.model||'',format:focus.batch?.format||'',imageNow,imageTotal:runTotal||imagesOf(focus),label:focus.batch?.label||focus.title||'Sorozat',batch:!!focus.batch,ids:live.filter(e=>LIVE.includes(e.state)).map(e=>e.id),done,total,paused,running,
    now:focus.batch?[focus.batch.model,focus.batch.format].filter(Boolean).join(' · '):'',items:live.map(e=>({label:e.batch?[e.batch.model,e.batch.format].filter(Boolean).join(' · '):(e.title||''),state:e.state,error:e.error||''}))};
}

export function createSeriesUI({$,request,notify,onResults=()=>{},onReview=null,onGrid=null,onCompareVideos=null}){
  const anchor=$('message');if(!anchor)return {};
  const box=el('span',null,'seriesBar');box.hidden=true;anchor.before(box);
  const st=document.createElement('style');st.textContent=`.seriesBar{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;flex:none;padding:3px 8px;border:1px solid #3d5b68;border-radius:9px;background:#10232d}
.seriesBar button{min-height:28px;padding:2px 9px;font-size:12px}.seriesBar .sbText{font-size:12px;white-space:nowrap}.seriesBar .sbText b{color:var(--gold,#f2c584)}
.seriesPanel{position:fixed;z-index:66;width:min(440px,92vw);max-height:55vh;overflow:auto;padding:10px;background:#10232d;border:1px solid var(--gold,#f2c584);border-radius:11px;box-shadow:0 10px 30px #000c;font-size:12px;display:flex;flex-direction:column;gap:4px}
.seriesPanel[hidden]{display:none!important}.seriesNow{display:block;font-size:12px;color:#a8beca;margin-top:2px}.seriesNow b{color:var(--gold,#f2c584)}.seriesNow[hidden]{display:none}`;document.head.append(st);
  const panel=el('div',null,'seriesPanel');panel.hidden=true;document.body.append(panel);
  let view=null,finished=null,lastIds=[],ask=false;const pace=new Map();/* címke → {t0,d0}: a hátralévő idő becsléséhez */
  const nowLine=el('span',null,'seriesNow');nowLine.hidden=true;$('previewContext')?.after(nowLine);
  const post=(p,b={})=>request(p,b);
  function place(anchorEl){const z=parseFloat(getComputedStyle(document.documentElement).zoom)||1,r=anchorEl.getBoundingClientRect(),h=panel.offsetHeight*z;panel.style.left=Math.max(6,Math.min(r.left,innerWidth-panel.offsetWidth*z-6))/z+'px';panel.style.top=(r.top>h+10?r.top-h-6:r.bottom+6)/z+'px';}
  const btn=(text,title,fn)=>{const b=el('button',text);b.type='button';b.title=title;b.onclick=ev=>{ev.stopPropagation();void Promise.resolve(fn(b)).catch(e=>notify(e.message,true));};return b;};
  function render(){
    box.replaceChildren();
    if(!view)nowLine.hidden=true;if(!view&&!finished){box.hidden=true;return;}box.hidden=false;
    if(!view&&finished){box.append((()=>{const x=el('span',null,'sbText');x.append('✓ '+finished.label+' · '+finished.total+' / '+finished.total+' ',sp('kész'));return x;})(),btn('Eredmények','Megmutatja az Előzményekben',()=>onResults(finished.label)),...(onGrid?[btn('▦ Rács','Modellek × seedek táblázatban',()=>onGrid(finished.label))]:[]),...(onCompareVideos&&/videó/.test(finished.label)?[btn('▶ Szinkron összehasonlítás','A sorozat videói egymás mellett, együtt lejátszva (legfeljebb 4)',()=>onCompareVideos(finished.label))]:[]),...(onReview?[btn('✦ MI-kiértékelés','A helyi MI pontozza a képeket (csak javaslat, opcionális)',()=>onReview(finished.label))]:[]),btn('×','Kijelző bezárása',()=>{finished=null;render();}));return;}
    const t=el('span',null,'sbText'),eta=etaText(view);const where=view.batch&&view.planTotal>1?[' · ',el('b',String(view.planIndex)),' ',sp('/'),' '+view.planTotal+' ',sp('terv')]:[];
    const modelPart=view.model?[' · ',sp('most:'),' '+view.model+(view.modelTotal>1?' ('+view.modelIndex+'/'+view.modelTotal+')':'')+(view.format?' · ':''),...(view.format?[sp(view.format)]:[])]:(view.now?[' · ',sp('most:'),' '+view.now]:[]);
    const imgPart=view.imageTotal>1&&view.imageNow?[' · ',sp('kép'),' '+view.imageNow+'/'+view.imageTotal]:[];
    t.append((view.batch?'⧉ ':'')+view.label+' · ',el('b',view.done+' / '+view.total),' ',sp('kész'),...where,...modelPart,...imgPart,...(eta?[' · ',sp('kb.'),' '+eta+' ',sp('van hátra')]:[]),...(view.paused?[' · ',sp('szünetel')]:[]));box.append(t);
    nowLine.hidden=!(view.batch&&view.model);if(!nowLine.hidden){nowLine.replaceChildren(el('b',view.model),...(view.format?[' · ',sp(view.format)]:[]),...(view.planTotal>1?[' · ',sp('terv'),' '+view.planIndex+'/'+view.planTotal]:[]),...(view.modelTotal>1?[' · ',sp('modell'),' '+view.modelIndex+'/'+view.modelTotal]:[]),...(view.imageTotal>1&&view.imageNow?[' · ',sp('kép'),' '+view.imageNow+'/'+view.imageTotal]:[]));}
    if(ask){box.append(el('span','A futó kép is szakadjon meg?','sbText'),btn('Igen, azonnal','A futó kép is megszakad; a kész képek megmaradnak.',async()=>{ask=false;await post('generation/cancel',{ids:view.ids,now:true});notify('Sorozat megszakítva; a kész képek megmaradtak.');await tick();}),btn('Nem, készüljön el','A futó kép elkészül, a többi nem indul el.',async()=>{ask=false;await post('generation/cancel',{ids:view.ids,now:false});notify('Sorozat megszakítva; a futó kép még elkészül.');await tick();}),btn('Mégse','',()=>{ask=false;render();}));return;}
    if(view.paused)box.append(btn('▶ Folytatás','Ott folytatja, ahol abbamaradt',async()=>{/* 0.16 DEV: több szüneteltetett tervnél rákérdez */await (await import('./resume-ui.mjs')).resumeWithChoice(request);await tick();}));
    else box.append(btn('⏸ Szünet','A futó kép elkészül, utána megáll a sorozat',async()=>{await post('generation/stop',{cancel:false});notify('Szünet: a futó kép még elkészül, utána megáll.');await tick();}),btn('⏸ Szünet most','Azonnal megáll; a félkész kép folytatáskor elölről indul (ugyanazzal a seeddel)',async()=>{await post('generation/stop',{cancel:true});notify('Szüneteltetve.');await tick();}));
    box.append(btn('✕ Megszakítás','A még el nem készült részek kikerülnek a sorból; a kész képek megmaradnak',()=>{ask=true;render();}),btn('Részletek','Mi kész, mi vár, hol volt hiba',b=>{panel.hidden=!panel.hidden;if(!panel.hidden){drawPanel();place(b);}}));
  }
  function etaText(v){if(!v||v.paused||!v.total)return '';const k=v.label,p=pace.get(k);const now=Date.now();if(!p||v.done<p.d0){pace.set(k,{t0:now,d0:v.done});return '';}const did=v.done-p.d0;if(did<1)return '';const per=(now-p.t0)/did,left=(v.total-v.done)*per/1000;if(!(left>0))return '';return left>=3600?Math.round(left/360)/10+' óra':left>=60?Math.round(left/60)+' perc':Math.max(1,Math.round(left))+' mp';}
  function drawPanel(){panel.replaceChildren(el('strong',(view||finished)?.label||''));const states={complete:'✓ kész',running:'▶ fut',queued:'… vár',paused:'⏸ szünetel',interrupted:'✕ megszakítva',failed:'⚠ hiba','waiting-cancel':'… vár'};for(const i of (view||finished)?.items||[]){const d=el('div');d.append(sp(states[i.state]||i.state),' · '+i.label,...(i.error?[' – ',sp(i.error)]:[]));panel.append(d);}}
  async function tick(){
    try{
      const q=await fetch('/api/generation/status',{cache:'no-store'}).then(r=>r.json());let run=null;
      if(q.current){try{run=await fetch('/api/run/status?id='+encodeURIComponent(q.current),{cache:'no-store'}).then(r=>r.ok?r.json():null);}catch{}}
      const v=seriesView(q,run);
      if(!v&&view&&view.batch){const ended=(q.entries||[]).filter(e=>lastIds.includes(e.id)||e.batch?.label===view.label);const all=(q.entries||[]).filter(e=>e.batch?.label===view.label);finished={label:view.label,total:view.total,items:all.map(e=>({label:[e.batch?.model,e.batch?.format].filter(Boolean).join(' · '),state:e.state,error:e.error||''}))};void ended;}
      view=v;if(v)lastIds=v.ids;if(!panel.hidden)drawPanel();render();
    }catch{}
  }
  document.addEventListener('click',()=>{panel.hidden=true;});
  setInterval(()=>void tick(),2000);void tick();
  return {tick};
}
