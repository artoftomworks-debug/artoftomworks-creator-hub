// 0.16 DEV — 🎞 Storyboard: jelenetek megtervezése kulcsképekkel, mielőtt videó készül.
// Jelenetkártyák (szöveg, hossz) · közös stílus és seed (egységes kinézet) · kulcskép minden jelenethez az aktív képmodellel ·
// változatok közül választás · „Videó ebből” → a kulcskép videó-kezdőkép lesz a jelenet szövegével; onnan a Jelenetsor viszi tovább.
// Semmi nem generálódik magától: a „Kulcsképek generálása” vagy a kártya „Kép” gombja indítja.
import {cleanBoard,shotProject,shotIndexOf,shotPrompt,shotVideoProject,videoIndexOf} from './storyboard-model.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const css=`.storyDialog{width:min(1280px,97vw);max-width:97vw;min-width:0;box-sizing:border-box;height:min(92vh,1000px)}.storyDialog .sectionTitle{display:flex;justify-content:space-between;align-items:center;gap:8px}@media (max-width:900px){.storyDialog .sbTop{grid-template-columns:1fr 1fr}.storyDialog .sbTop label:first-child{grid-column:1/-1}.storyDialog .sbGrid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}.storyDialog .sbTop{display:grid;grid-template-columns:minmax(160px,1fr) minmax(200px,2fr) auto minmax(150px,1fr);gap:10px;align-items:end;margin:8px 0}
.storyDialog .sbTop label{display:flex;flex-direction:column;gap:3px;font-size:13px}.storyDialog textarea{width:100%;min-height:58px;resize:vertical}.storyDialog .sbBar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px}.storyDialog .sbFilm{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.storyDialog .sbVideo video{width:100%;max-height:160px;background:#000;border-radius:8px;margin-top:6px}.storyDialog .sbVideoRow{display:flex;gap:6px;align-items:center;font-size:13px;margin-top:4px}.storyDialog .sbVideoRow select{font-size:12px;max-width:100%}
.storyDialog .sbGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;overflow:auto;max-height:calc(100% - 210px);padding:2px}
.storyDialog .sbCard{border:1px solid #ffffff22;border-radius:11px;padding:8px;display:flex;flex-direction:column;gap:6px;background:#0d1e26}.storyDialog .sbCard header{display:flex;gap:6px;align-items:center}.storyDialog .sbCard header b{color:var(--gold,#f2c584);margin-right:auto}
.storyDialog .sbKey{aspect-ratio:16/10;border-radius:8px;background:#071116;display:flex;align-items:center;justify-content:center;color:#7d96a2;font-size:13px;overflow:hidden}.storyDialog .sbKey img{width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.storyDialog .sbVariants{display:flex;gap:4px;flex-wrap:wrap}.storyDialog .sbVariants img{width:44px;height:44px;object-fit:cover;border-radius:5px;cursor:pointer;opacity:.7;border:2px solid transparent}.storyDialog .sbVariants img.on{opacity:1;border-color:var(--gold,#f2c584)}
.storyDialog .sbCard .sbRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.storyDialog .sbCard button{min-height:28px;padding:2px 9px;font-size:13px}.storyDialog .sbCard input[type=number]{width:64px}
.storyZoom{position:fixed;inset:0;z-index:300;background:#050c11f2;display:flex;align-items:center;justify-content:center}.storyZoom img{max-width:94vw;max-height:92vh;object-fit:contain}`;
let styled=false,opening=false;
export function createStoryboardUI({request,collectPlan,automatic,state,current,notify,isBusy,onQueued=()=>{},onVideo}){
  if(!styled){const st=document.createElement('style');st.textContent=css;document.head.append(st);styled=true;}
  async function open(){
    const already=document.querySelector('dialog.storyDialog[open]');if(already){already.focus();return;}
    if(opening)return;opening=true;
    let list=[];try{list=(await fetch('/api/storyboards').then(r=>r.json())).boards||[];}catch{}finally{opening=false;}
    const c=current();let board=list[0]?cleanBoard(list[0]):cleanBoard({name:'Első storyboard',style:'',negative:c.negative||'',width:c.width,height:c.height,shots:[{text:''},{text:''},{text:''}]});
    const d=el('dialog',null,'generationDialog storyDialog'),head=el('div',null,'sectionTitle'),close=el('button','Bezárás');close.type='button';close.onclick=()=>d.close();head.append(el('h2','🎞 Storyboard'),close);
    const help=el('p','Írd le jelenetenként, mi történjen. A közös stílus és a közös seed miatt a kulcsképek egységesek lesznek. Válaszd ki a legjobb kulcsképet, majd „Videó ebből” – onnan a Jelenetsor viszi tovább.','muted');
    const top=el('div',null,'sbTop'),pickL=el('label'),pick=el('select'),nameL=el('label'),name=el('input'),seedL=el('label'),seed=el('input');pickL.append(el('span','Storyboard'),pick);nameL.append(el('span','Név'),name);seed.type='number';seed.min=0;seedL.append(el('span','Közös seed'),seed);
    const styleL=el('label'),style=el('textarea');styleL.append(el('span','Közös stílus – minden jelenet promptjához hozzáfűzve (pl. „cinematic, 35mm, warm light, same woman with red hair”)'),style);
    const bar=el('div',null,'sbBar'),add=el('button','+ Jelenet'),gen=el('button','▶ Kulcsképek generálása','primary'),saveB=el('button','💾 Mentés'),newB=el('button','Új storyboard'),del=el('button','🗑');for(const b of [add,gen,saveB,newB,del])b.type='button';del.title='Ennek a storyboardnak a törlése (a képek megmaradnak az Előzményekben)';
    const status=el('span','','muted'),grid=el('div',null,'sbGrid');bar.append(add,gen,saveB,newB,del,status);
    /* 0.16 DEV: szereplő a karakterkönyvből – a kulcsképeken ugyanaz az arc */
    const charL=el('label'),charSel=el('select');charL.append(el('span','Szereplő (karakterkönyv)'),charSel);charL.title='Ha választasz szereplőt, a kulcsképek az ő arcával készülnek (karakter-hűség, Flux 1 modellel).';
    async function fillChars(){let cs=[];try{cs=(await fetch('/api/characters').then(r=>r.json())).characters||[];}catch{}charSel.replaceChildren(new Option('— nincs —',''),...cs.map(c=>new Option(c.name,c.id)));charSel.value=cs.some(c=>c.id===board.characterId)?board.characterId:'';}
    charSel.onchange=()=>{board.characterId=charSel.value||null;dirty=true;dispatchEvent(new CustomEvent('creatorhub:character-pick',{detail:{id:charSel.value||null}}));draw();};
    /* 0.16 DEV: kisfilm – a jelenetek videói egy MP4-ben, áttűnéssel, ha kéred zenével */
    const film=el('div',null,'sbFilm'),filmB=el('button','🎞 Kisfilm készítése'),musicL=el('label',null,'sbMusic'),music=el('input'),musicName=el('span','','muted'),filmStatus=el('span','','muted');filmB.type='button';music.type='file';music.accept='audio/*';music.hidden=true;
    const musicB=el('button','♪ Zene hozzáadása');musicB.type='button';musicB.title='Nem kötelező: egy zenefájl a film alá (halkabban, a végén elhalkul). A jelenetek saját hangja megmarad.';musicB.onclick=()=>music.click();let musicData='';
    music.onchange=()=>{const f=music.files[0];music.value='';if(!f)return;if(f.size>16*1024**2){notify('A zene legfeljebb 16 MiB lehet.',true);return;}const r=new FileReader();r.onload=()=>{musicData=String(r.result);musicName.replaceChildren(document.createTextNode(f.name+' '),Object.assign(el('button','✕'),{type:'button',title:'Zene eltávolítása',onclick:()=>{musicData='';musicName.replaceChildren();}}));};r.readAsDataURL(f);};
    filmB.title='A jelenetek kész videói sorrendben, finom áttűnéssel egy MP4-be. Az eredmény az Előzményekbe kerül; a jelenetvideók érintetlenek maradnak.';
    filmB.onclick=()=>void (async()=>{filmB.disabled=true;try{if(dirty)await persist(true);const r=await request('storyboards/film',{id:board.id,music:musicData||undefined});if(r.missing?.length)notify(['Kisfilm:',' ',r.missing.join(', ')+'. ','jelenetnek még nincs videója – ezek kimaradnak.']);
      for(;;){await new Promise(x=>setTimeout(x,2000));const st=await fetch('/api/storyboards/film/status?id='+r.id).then(x=>x.json());if(st.error&&!st.state)throw Error(st.error);filmStatus.replaceChildren(el('span',st.step||''),' '+(st.total?Math.min(st.done,st.total)+' / '+st.total:''));if(st.state==='failed')throw Error(st.error||'A kisfilm nem készült el.');if(st.state==='complete'){filmStatus.replaceChildren(el('span','Kész:'),' '+st.result.filename+' · '+st.result.seconds+' ',el('span','mp – az Előzményekben megtalálod.'));notify(['🎞',' ','A kisfilm elkészült.']);break;}if(dead)break;}
    }catch(e){filmStatus.replaceChildren(el('span',e.message));notify(e.message,true);}finally{filmB.disabled=false;}})();
    film.append(filmB,musicB,music,musicName,filmStatus);
    top.append(pickL,nameL,seedL,charL);d.append(head,help,top,styleL,bar,film,grid);
    let images=new Map(),videos=new Map(),timer=null,dead=false,dirty=false;
    function fillPick(){pick.replaceChildren(...list.map(b=>new Option(b.name,b.id)));if(!list.some(b=>b.id===board.id))pick.prepend(new Option(board.name+' *',board.id));pick.value=board.id;}
    function load(b){board=cleanBoard(b);name.value=board.name;seed.value=board.seed;style.value=board.style;images=new Map();fillPick();draw();void poll();void fillChars();if(board.characterId)dispatchEvent(new CustomEvent('creatorhub:character-pick',{detail:{id:board.characterId}}));}
    function readTop(){board.name=name.value.trim()||board.name;board.seed=Math.max(0,Number.parseInt(seed.value)||0);board.style=style.value;}
    async function persist(quiet){readTop();const r=await request('storyboards/save',{board});board=r.board;list=[board,...list.filter(x=>x.id!==board.id)];fillPick();dirty=false;if(!quiet)notify(['Storyboard mentve:',' '+board.name]);}
    const touch=()=>{dirty=true;status.textContent='nincs mentve';};
    name.oninput=style.oninput=seed.oninput=touch;
    pick.onchange=()=>{const b=list.find(x=>x.id===pick.value);if(b)load(b);};
    newB.onclick=()=>{const c=current();load({name:'Storyboard '+new Date().toLocaleDateString(),negative:c.negative||'',width:c.width,height:c.height,shots:[{text:''},{text:''},{text:''}]});touch();};
    del.onclick=async()=>{if(!list.some(b=>b.id===board.id)){newB.onclick();return;}await request('storyboards/delete',{id:board.id});list=list.filter(b=>b.id!==board.id);notify(['Storyboard törölve:',' '+board.name]);if(list[0])load(list[0]);else newB.onclick();};
    saveB.onclick=()=>void persist(false).catch(e=>notify(e.message,true));
    add.onclick=()=>{board.shots.push({id:'s'+Date.now().toString(36),text:'',duration:5,keyframe:null,seedOffset:0});touch();draw();grid.lastElementChild?.querySelector('textarea')?.focus();};
    async function generate(indexes){
      if(isBusy())throw Error('Várd meg az aktuális művelet végét.');readTop();
      const base=collectPlan();if(base.mode!=='automatic')throw Error('A storyboard kulcsképei az automatikus modellválasztással készülnek – válassz képmodellt az Alkotás panelen.');
      const c=current(),m=automatic.selectedModel?.();if(!m)throw Error('Válassz képmodellt az Alkotás panelen.');
      await persist(true);const p=await automatic.planFor(m.id,{width:c.width,height:c.height}),batchId=crypto.randomUUID(),todo=indexes.filter(i=>board.shots[i]?.text.trim());
      if(!todo.length)throw Error('Írj legalább egy jelenetet.');
      for(const [k,i] of todo.entries()){const shot=board.shots[i],plan=structuredClone(base),s=board.seed+shot.seedOffset;
        Object.assign(plan.payload,{id:m.id,sampling:p.sampling,controls:{...p.controls,seed:s},seed:s,seedMode:'fixed',seedStep:1,count:1,prompt:shotPrompt(board,shot),negative:board.negative||c.negative||'',width:c.width,height:c.height,projectName:shotProject(board,i)});
        await request('generation/enqueue',{...plan,batch:{id:batchId,label:'Storyboard · '+board.name,index:k,total:todo.length,images:1,model:String(m.name).split(/[\\/]/).pop(),format:(i+1)+'. jelenet'}});}
      onQueued();notify(['Storyboard:',' ',String(todo.length),' ','kulcskép sorba állítva.']);status.textContent='';void poll();
    }
    gen.onclick=()=>void generate(board.shots.map((_,i)=>i)).catch(e=>notify(e.message,true));
    async function poll(){clearTimeout(timer);if(dead)return;try{const items=[];for(let page=1;page<=5;page++){const r=await fetch('/api/history?'+new URLSearchParams({q:'Storyboard · '+board.name,page:String(page)})).then(x=>x.json());items.push(...(r.items||[]));if(page>=(r.pages||1))break;}const next=new Map(),vids=new Map();
        for(const e of items){const v=videoIndexOf(e.project,board);if(v>=0&&e.mode==='video'){if(!vids.has(v))vids.set(v,[]);vids.get(v).push(e);continue;}const i=shotIndexOf(e.project,board);if(i<0)continue;if(!next.has(i))next.set(i,[]);next.get(i).push(e);}
        const changed=[...next].some(([i,a])=>(images.get(i)||[]).length!==a.length)||[...vids].some(([i,a])=>(videos.get(i)||[]).length!==a.length)||vids.size!==videos.size;images=next;videos=vids;if(changed)draw();}catch{}
      const q=await fetch('/api/generation/status').then(r=>r.json()).catch(()=>({entries:[]}));const busy=(q.entries||[]).some(e=>['queued','running'].includes(e.state)&&String(e.batch?.label||'')==='Storyboard · '+board.name);if(busy)timer=setTimeout(poll,3000);}
    function zoom(url){const z=el('div',null,'storyZoom'),i=el('img');i.src=url;z.append(i);z.onclick=()=>z.remove();d.append(z);}
    function draw(){grid.replaceChildren();board.shots.forEach((shot,i)=>{const card=el('article',null,'sbCard'),h=el('header'),up=el('button','↑'),down=el('button','↓'),rm=el('button','✕');for(const b of [up,down,rm])b.type='button';up.title='Előrébb';down.title='Hátrébb';rm.title='Jelenet törlése';
        h.append(el('b',(i+1)+'. jelenet'),up,down,rm);up.disabled=i===0;down.disabled=i===board.shots.length-1;
        up.onclick=()=>{[board.shots[i-1],board.shots[i]]=[board.shots[i],board.shots[i-1]];touch();images=new Map();draw();};down.onclick=()=>{[board.shots[i+1],board.shots[i]]=[board.shots[i],board.shots[i+1]];touch();images=new Map();draw();};rm.onclick=()=>{board.shots.splice(i,1);touch();images=new Map();draw();};
        const key=el('div',null,'sbKey'),vars=images.get(i)||[],chosen=vars.find(e=>e.id===shot.keyframe)||vars[0];
        if(chosen){const im=el('img');im.src=chosen.url;im.alt='';im.onclick=()=>zoom(chosen.url);if(shot.mirror){im.style.transform='scaleX(-1)';im.title='Tükrözve';}key.append(im);}else key.append(el('span','Még nincs kulcskép'));
        const vr=el('div',null,'sbVariants');if(vars.length>1)for(const e of vars){const t=el('img');t.src=e.url;t.alt='';t.title='Ez legyen a kulcskép';t.className=e.id===chosen?.id?'on':'';t.onclick=()=>{shot.keyframe=e.id;shot.mirror=false;touch();draw();};vr.append(t);}
        const text=el('textarea');text.value=shot.text;text.placeholder='Mi történik ebben a jelenetben? (pl. „a nő kinéz az ablakon, eső, este”)';text.oninput=()=>{shot.text=text.value;touch();};
        const row=el('div',null,'sbRow'),durL=el('label'),dur=el('input');dur.type='number';dur.min=1;dur.max=30;dur.value=shot.duration;dur.oninput=()=>{shot.duration=Math.max(1,Math.min(30,Number(dur.value)||5));touch();};durL.append(el('span','Hossz (mp)'),' ',dur);
        const img=el('button',vars.length?'↻ Új változat':'▶ Kép'),vid=el('button','🎬 Videó ebből');img.type=vid.type='button';img.title='Kulcskép ehhez a jelenethez (új változatnál másik seeddel)';vid.disabled=!chosen;vid.title='A kulcskép videó-kezdőkép lesz, a jelenet szövegével és hosszával';
        img.onclick=()=>{if(vars.length)shot.seedOffset=(shot.seedOffset||0)+1;void generate([i]).catch(e=>notify(e.message,true));};
        vid.onclick=()=>{d.close();void onVideo(chosen,{prompt:shotPrompt(board,shot),duration:shot.duration,project:shotVideoProject(board,i),mirror:!!shot.mirror});};
        /* 0.16 DEV: 🪄 következő jelenet az előző kulcsképből */const prevVars=i>0?images.get(i-1)||[]:[],prev=i>0?prevVars.find(e=>e.id===board.shots[i-1].keyframe)||prevVars[0]:null;const assist=el('button','🪄');assist.type='button';assist.title=prev?'Következő jelenet asszisztens: az előző jelenet kulcsképéből, folytonosság-ellenőrzéssel':'Az asszisztenshez az előző jelenetnek kulcskép kell';assist.disabled=!prev||i===0;
        assist.onclick=()=>void window.creatorHubNextScene?.open({source:prev.url,intent:shot.text,kind:'storyboard',title:'🪄 '+(i+1)+'. jelenet – folytatás',project:shotProject(board,i),onChoose:async c=>{shot.keyframe=c.entry.id;shot.mirror=!!c.mirrored;if(!shot.text.trim())shot.text=c.prompt;touch();await poll();draw();}}).catch(e=>notify(e.message,true));
        if(i>0)row.append(assist);row.append(durL,img,vid);card.append(h,key,vr,text,row);
        /* 0.16 DEV: a jelenet kész videói – melyik kerüljön a kisfilmbe */
        const takes=(videos.get(i)||[]).sort((a,b)=>(b.created||0)-(a.created||0));if(takes.length){const vbox=el('div',null,'sbVideo'),pick=takes.find(t=>t.id===shot.video)||takes[0],v=el('video');v.src=pick.url;v.controls=true;v.muted=true;v.preload='metadata';v.playsInline=true;
          const lab=el('div',null,'sbVideoRow');lab.append(el('span','🎬 A filmbe:'));if(takes.length>1){const sel=el('select');takes.forEach((t,k)=>sel.add(new Option((takes.length-k)+'. változat · '+new Date(t.created).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),t.id)));sel.value=pick.id;sel.onchange=()=>{shot.video=sel.value;touch();draw();};lab.append(sel);}else lab.append(' ',el('span','1 videó kész'));
          vbox.append(v,lab);card.append(vbox);}
        grid.append(card);});
      status.textContent=dirty?'nincs mentve':'';}
    d.addEventListener('close',()=>{dead=true;clearTimeout(timer);if(dirty)void persist(true).catch(()=>{});d.remove();});
    const z=Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1;if(z!==1){d.style.width=`min(1280px,${(97/z).toFixed(2)}vw)`;d.style.maxWidth=`${(97/z).toFixed(2)}vw`;d.style.height=`min(1000px,${(92/z).toFixed(2)}vh)`;}
    document.body.append(d);d.showModal();load(board);if(!list.length)touch();
  }
  return {open};
}
