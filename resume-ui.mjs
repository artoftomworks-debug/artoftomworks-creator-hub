// 0.16 DEV — Folytatás csak szándékosan: ha több szüneteltetett terv vár, a Hub megkérdezi, melyiket indítsa.
// A régi (egy óránál régebbi) tervek „régi” jelölést kapnak, és alapból nincsenek kijelölve – így semmi nem indul el véletlenül.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export const OLD_MS=3600e3;
// Pure: a szüneteltetett tervek listája (legújabb elöl), alapértelmezett kijelöléssel.
export function pausedChoices(entries,now=Date.now()){const list=(entries||[]).filter(e=>e.state==='paused').sort((a,b)=>(b.created||0)-(a.created||0));
 return list.map((e,i)=>({id:e.id,title:String(e.batch?.label||e.title||'').replace(/^Creator Hub · /,'').replace(/\.(safetensors|ckpt|gguf)$/i,''),created:e.created||0,old:now-(e.created||0)>OLD_MS,checked:i===0||now-(e.created||0)<=OLD_MS,detail:e.batch?[e.batch.model,e.batch.format].filter(Boolean).join(' · '):''}));}
export async function resumeWithChoice(request){
 const st=await request('generation/status'),choices=pausedChoices(st?.entries);
 if(choices.length<=1)return request('generation/resume',choices.length?{ids:[choices[0].id]}:{});
 return new Promise((resolve,reject)=>{const d=el('dialog',null,'studioDialog resumeDialog'),h=el('h2'),list=el('div',null,'rsList'),row=el('div',null,'inline');
  h.append(document.createTextNode(choices.length+' '),el('span','szüneteltetett terv vár. Melyiket folytassuk?'));
  const st2=document.createElement('style');st2.textContent='.resumeDialog{width:min(620px,94vw)}.resumeDialog .rsList{display:grid;gap:4px;max-height:50vh;overflow:auto;margin:8px 0}.resumeDialog label{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px}.resumeDialog label:hover{background:#17313c}.resumeDialog .rsOld{font-size:11px;color:#f2c584;border:1px solid #6b5530;border-radius:8px;padding:0 6px}.resumeDialog .rsTime{color:#a8beca;font-size:12px;margin-left:auto;white-space:nowrap}';d.append(st2);
  const boxes=[];for(const c of choices){const l=el('label'),cb=el('input');cb.type='checkbox';cb.checked=c.checked;boxes.push([c,cb]);const when=new Date(c.created),today=when.toDateString()===new Date().toDateString();
   l.append(cb,el('span',c.title+(c.detail?' · '+c.detail:'')),...(c.old?[el('span','régi','rsOld')]:[]),el('span',(today?'':when.toLocaleDateString()+' ')+when.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),'rsTime'));list.append(l);}
  const latest=el('button','Csak a legutóbbi'),picked=el('button','▶ Kijelöltek folytatása','primary'),all=el('button','Mindet'),cancel=el('button','Mégse');for(const b of [latest,picked,all,cancel])b.type='button';
  const note=el('p','A régi tervek nincsenek kijelölve, hogy véletlenül se induljanak el. A nem kijelöltek szüneteltetve maradnak.','muted');
  row.append(latest,picked,all,cancel);d.append(h,list,note,row);document.body.append(d);
  let done=false;const finish=async ids=>{if(done)return;done=true;d.close();d.remove();if(!ids){resolve(null);return;}try{resolve(await request('generation/resume',{ids}));}catch(e){reject(e);}};
  latest.onclick=()=>void finish([choices[0].id]);all.onclick=()=>void finish(choices.map(c=>c.id));cancel.onclick=()=>void finish(null);
  picked.onclick=()=>{const ids=boxes.filter(([,cb])=>cb.checked).map(([c])=>c.id);if(!ids.length){note.textContent='';note.append(el('span','Jelölj ki legalább egy tervet, vagy válaszd a Mégse gombot.'));return;}void finish(ids);};
  d.addEventListener('cancel',e=>{e.preventDefault();void finish(null);});d.showModal();picked.focus();});
}
