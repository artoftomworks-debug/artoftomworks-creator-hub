// 0.16 DEV — ▦ Próbasor: egy modell kipróbálása több lépésszámmal, ugyanazzal a prompttal és seeddel.
// Csak kérésre fut (a videókártyát a felhasználó engedélye nélkül nem foglaljuk le). A képek egymás mellett jelennek meg,
// „Ez legyen” választással – a választott lépésszám a modell mentett beállítása lesz (a jelzés onnantól eltűnik).
import {trialSteps,samplingProfileKey,saveSamplingProfile,automaticSamplingDefaults} from './sampling-policy.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const css=`.trialDialog{width:min(1100px,96vw);max-width:96vw}.trialDialog .trRow{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.trialDialog .trCell{width:240px;display:flex;flex-direction:column;gap:6px}.trialDialog .trCell .trImg{width:240px;height:240px;border-radius:8px;background:#0a161c;display:flex;align-items:center;justify-content:center;color:#7d96a2;font-size:13px;overflow:hidden}
.trialDialog .trCell img{width:100%;height:100%;object-fit:contain;cursor:zoom-in}.trialDialog .trCell b{color:var(--gold,#f2c584)}.trialDialog .trCell.chosen .trImg{outline:3px solid var(--gold,#f2c584)}
.trialZoom{position:fixed;inset:0;z-index:300;background:#050c11f2;display:flex;align-items:center;justify-content:center}.trialZoom img{max-width:94vw;max-height:92vh;object-fit:contain}`;
// Pure: which step value does a history item belong to? The project name ends with „· N lépés”.
export function trialStepOf(project,group){const s=String(project||'');if(!s.startsWith(group+' · '))return null;const m=s.slice(group.length+3).match(/^(\d+) lépés$/);return m?Number(m[1]):null;}
let styled=false;const last=new Map();// model id → last trial (to reopen the result)
export function createTrial({request,collectPlan,automatic,state,current,notify,isBusy,onQueued=()=>{},onChosen=()=>{}}){
  if(!styled){const st=document.createElement('style');st.textContent=css;document.head.append(st);styled=true;}
  async function start(modelId){
    if(isBusy())throw Error('Várd meg az aktuális művelet végét.');
    let base;try{base=collectPlan();}catch(e){throw e;}
    if(base.mode!=='automatic')throw Error('A Próbasor az automatikus modellválasztással működik.');
    const c=current(),m=automatic.models().find(x=>x.id===modelId)||automatic.selectedModel?.();if(!m)throw Error('A modell nincs a listában.');
    const p=await automatic.planFor(m.id,{width:c.width,height:c.height}),d=p.sampling?.steps??automaticSamplingDefaults(m).steps,steps=trialSteps(d);
    const seed=Number(c.seed)>=0?Number(c.seed):crypto.getRandomValues(new Uint32Array(1))[0]%2147483647,stamp=new Date().toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});
    const short=String(m.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|sft|pt)$/i,''),group='Próbasor · '+short+' · '+stamp,batchId=crypto.randomUUID();
    for(const [i,s] of steps.entries()){const plan=structuredClone(base),sampling={...p.sampling,steps:s};
      Object.assign(plan.payload,{id:m.id,sampling,controls:{...p.controls,sampling,seed},seed,seedMode:'fixed',seedStep:1,count:1,projectName:group+' · '+s+' lépés'});
      await request('generation/enqueue',{...plan,batch:{id:batchId,label:group,index:i,total:steps.length,images:1,model:short,format:s+' lépés'}});}
    onQueued();const t={modelId:m.id,name:short,group,steps,seed,width:c.width,height:c.height,mode:state().mode,backend:state().backend,base:p.sampling};last.set(m.id,t);return t;
  }
  function show(t){
    const d=el('dialog',null,'generationDialog trialDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();head.append(el('h2','▦ '+t.group),close);
    const info=el('p',null,'muted');info.append(el('span','Ugyanaz a prompt és seed, csak a lépésszám más. Kattints a képre a nagy nézethez, majd válaszd ki a legjobbat.'),' ',el('span','A Próbasor a háttérben fut – ez az ablak bezárható, és a terv soron a „▦ Próbasor” gombbal újra megnyitható.'));
    const row=el('div',null,'trRow'),cells=new Map();
    for(const s of t.steps){const cell=el('div',null,'trCell'),img=el('div',null,'trImg'),label=el('b',s+' lépés'),pick=el('button','Ez legyen');pick.type='button';pick.disabled=true;img.append(el('span','… készül'));cell.append(img,label,pick);row.append(cell);cells.set(s,{cell,img,pick,done:false});
      pick.onclick=()=>{const key=samplingProfileKey(t.backend,t.mode,t.modelId),st=state(),prev=st.modelSamplingProfiles?.[key],sampling={...(prev?.sampling||t.base||{}),steps:s};saveSamplingProfile(st,key,sampling,{samplingOverrides:prev?.overrides,samplingChoices:prev?.choices},{tested:true});
        for(const x of cells.values())x.cell.classList.toggle('chosen',x.pick===pick);onChosen({modelId:t.modelId,steps:s,name:t.name});notify([t.name+': ','A Próbasor nyertese mentve:',' ',s+' lépés','. ','Ez lett a modell beállítása.']);};}
    d.append(head,info,row);
    let timer=null,dead=false;
    async function poll(){if(dead)return;try{const r=await fetch('/api/history?'+new URLSearchParams({q:t.group})).then(x=>x.json());for(const e of r.items||[]){const s=trialStepOf(e.project,t.group),x=cells.get(s);if(!x||x.done)continue;x.done=true;const im=el('img');im.src=e.url;im.alt='';im.onclick=()=>{const z=el('div',null,'trialZoom'),big=el('img');big.src=e.url;z.append(big);z.onclick=()=>z.remove();d.append(z);};x.img.replaceChildren(im);x.pick.disabled=false;}}catch{}
      if([...cells.values()].some(x=>!x.done))timer=setTimeout(poll,3000);}
    d.addEventListener('close',()=>{dead=true;clearTimeout(timer);d.remove();});document.body.append(d);d.showModal();void poll();
  }
  return {async open(modelId){const prev=last.get(modelId);if(prev){show(prev);return;}const t=await start(modelId);show(t);},hasTrial:id=>last.has(id),restart:async id=>{last.delete(id);const t=await start(id);show(t);}};
}
