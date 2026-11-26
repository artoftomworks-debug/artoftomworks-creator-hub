// 0.16 DEV — „Ne legyen csendes hiba”: az Indítás előtti összefoglalóben látszik, honnan jön a lépésszám és a CFG,
// és ha eltér attól, amit a modellhez elmentettél, a Hub szól – a tervben és indításkor is. Mindkét választ elfogadja.
import {samplingCheck,samplingSourceLabel,mismatchText,samplingProfileKey,saveSamplingProfile,isSettled,automaticSamplingDefaults} from './sampling-policy.mjs';
const css=`#samplingGuard{margin:10px 0 0;padding:10px 12px;border:1px solid #d9a35b;border-radius:10px;background:#2a2112;color:#ffe2b8;font-size:14px;line-height:1.45}
#samplingGuard[hidden]{display:none}#samplingGuard p{margin:0 0 8px}#samplingGuard .sgRow{display:flex;gap:8px;flex-wrap:wrap}#samplingGuard button{font-size:13px;min-height:30px;padding:4px 10px;margin:0}
#planLine{margin:6px 0 0;font-size:14px;color:#cfe0e8;line-height:1.4}#planLine b{color:var(--gold,#f2c584);font-weight:600}#planLine.warn{color:#ffe2b8;cursor:pointer;text-decoration:underline dotted}#planLine[hidden]{display:none}#planLine .trialHint{color:#a9d4e6;font-size:13px}#planLine .trialHint button{min-height:24px;padding:0 8px;font-size:12px;margin-left:6px}
dialog.sgDialog{max-width:520px;border:1px solid var(--gold,#f2c584);border-radius:12px;background:#10232d;color:#e7eef2;padding:18px}dialog.sgDialog::backdrop{background:#000a}
dialog.sgDialog h2{margin:0 0 8px;font-size:19px;color:var(--gold,#f2c584)}dialog.sgDialog p{margin:0 0 10px;line-height:1.5}dialog.sgDialog .sgRow{display:flex;flex-direction:column;gap:8px;margin-top:12px}dialog.sgDialog button{text-align:left;min-height:34px}`;
// Minden szövegdarab külön szövegcsomópont, így a nyelvi katalógus darabonként fordítja (a számok, fájlnevek változatlanok maradnak).
const frag=(...parts)=>{const f=document.createDocumentFragment();for(const p of parts.flat())if(p!==''&&p!=null)f.append(typeof p==='string'?document.createTextNode(p):p);return f;};
const span=t=>{const e=document.createElement('span');e.textContent=t;return e;};
const valueNodes=(ms,f)=>ms.flatMap((x,i)=>[i?', ':'',x.field==='steps'?span(x[f]+' lépés'):'CFG '+x[f]]);
const sentences=ms=>ms.flatMap((m,i)=>[i?' ':'',span(mismatchText(m))]);
const sourceNodes=label=>String(label||'').split(' · ').flatMap((part,i)=>{const m=part.match(/^(lépés|CFG): (.*)$/);return [i?' · ':'',...(m?[span(m[1]),': ',span(m[2])]:[span(part)])];});
export function createSamplingGuard({$,current,getState,model,edited,draw,onTrial=null}){
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  const check=()=>{const c=current(),m=model?.();if(!c?.automatic||!m||!c.controls?.sampling)return null;const key=samplingProfileKey(getState().backend,getState().mode,c.automatic.id);
    return {c,m,key,result:samplingCheck({sampling:c.controls.sampling,model:m,profile:getState().modelSamplingProfiles?.[key],policy:c.modelSamplingPolicy==='manual'?'manual':'remember'})};};
  function apply(info,choice){const {c,key}=info;if(choice==='expected')for(const x of info.result.mismatches)c.controls.sampling[x.field]=x.expected;
    if(c.modelSamplingPolicy!=='manual')saveSamplingProfile(getState(),key,c.controls.sampling,c.controls);delete c.samplingPolicyNotice;edited();draw();}
  const labels=info=>{const ms=info.result.mismatches;return {expected:[span(ms.every(x=>x.from==='profile')?'Mentett érték:':'Kiinduló érték:'),' ',...valueNodes(ms,'expected')],current:[span('Maradjon a mostani:'),' ',...valueNodes(ms,'current'),' ',span('(megjegyzem)')]};};
  // 0.16 DEV (felület-átnézés 2.): egysoros terv a „Generálás indítása” gomb alatt – mindig látszik, nem kell a Részletek fülre menni.
  let line=null;
  function planLine(info,label){
    if(!line){const actions=document.getElementById('start')?.closest('.actions');if(!actions)return;line=document.createElement('p');line.id='planLine';line.setAttribute('role','status');actions.after(line);line.onclick=()=>{if(line.classList.contains('warn'))void choose(false);};}
    const c=current();if(!c?.info){line.hidden=true;return;}line.hidden=false;
    const s=c.controls?.sampling||c.info?.sampling||{},name=String(info?.m?.name||c.blockedModel?.name||(c.info.modelFields||[]).map(f=>f.name).join(' · ')||'').split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|gguf|pt|sft)$/i,'');
    const n=Math.max(1,Number(c.count)||1),dot=()=>' · ',parts=[];const add=(...x)=>{if(parts.length)parts.push(dot());parts.push(...x);};
    if(name)add(name);if(c.width&&c.height)add(c.width+'×'+c.height);const video=getState().mode==='video';add(span(n>1?n+(video?' videó':' változat'):(video?'1 videó':'1 kép')));
    if(s.steps!==undefined)add(span(s.steps+' lépés'),...(label?[' (',...sourceNodes(label),')']:[]));if(s.cfg!==undefined)add('CFG '+s.cfg);
    const ms=info?.result?.mismatches||[];line.classList.toggle('warn',!!ms.length);line.title=ms.length?'Kattints: melyik értékkel fusson?':'Az indítás előtti beállítások röviden.';
    const b=document.createElement('b');b.append(frag(parts));line.replaceChildren(ms.length?'⚠ ':span('Terv:'),' ',b);if(ms.length)line.append(' – ',span('eltér a mentettől, kattints a választáshoz.'));
    /* 0.16 DEV: új (még ki nem próbált) modell – csendes jelzés, Próbasor csak kérésre */
    if(onTrial&&info?.m&&c.automatic&&c.modelSamplingPolicy!=='manual'){const key=info.key,prof=getState().modelSamplingProfiles?.[key];if(!isSettled(prof,automaticSamplingDefaults(info.m))){const h=document.createElement('span');h.className='trialHint';const go=document.createElement('button');go.type='button';go.textContent='▦ Próbasor';go.title='Néhány kép ugyanazzal a prompttal és seeddel, különböző lépésszámmal – te választod ki a legjobbat, és az lesz a modell beállítása';go.onclick=ev=>{ev.stopPropagation();onTrial(c.automatic.id);};const no=document.createElement('button');no.type='button';no.textContent='×';no.title='Elrejtés ennél a modellnél (a beállítás marad)';no.onclick=ev=>{ev.stopPropagation();saveSamplingProfile(getState(),key,c.controls.sampling,c.controls,{dismissed:true});edited();};h.append(' · ',span('Új modell – a beállítás csak javaslat'),go,no);line.append(h);}}
  }
  let box=null;
  function summary(){
    const info=check();if(!box){box=document.createElement('div');box.id='samplingGuard';box.setAttribute('role','status');const host=$('summaryContent');if(!host)return '';host.after(box);}
    if(!info?.result){box.hidden=true;planLine(info,'');return '';}
    const ms=info.result.mismatches;box.hidden=!ms.length;
    if(ms.length){const l=labels(info),p=document.createElement('p');p.append('⚠ ',frag(sentences(ms)),' ',span('Melyik legyen?'));
      const row=document.createElement('div');row.className='sgRow';const a=document.createElement('button');a.type='button';a.append(frag(l.expected));a.onclick=()=>apply(check(),'expected');
      const b=document.createElement('button');b.type='button';b.append(frag(l.current));b.onclick=()=>apply(check(),'current');row.append(a,b);box.replaceChildren(p,row);}
    const label=samplingSourceLabel(info.result);planLine(info,label);return label;
  }
  // Indításkor: ha eltérés van, megkérdezi. true = mehet (a választás már érvényben), false = mégse.
  function confirmStart(){return choose(true);}
  function choose(starting){
    const info=check();if(!info?.result?.mismatches.length)return Promise.resolve(true);
    return new Promise(resolve=>{const d=document.createElement('dialog');d.className='sgDialog';const l=labels(info);
      const h=document.createElement('h2');h.textContent='Eltérő beállítás – melyik legyen?';const p=document.createElement('p');p.append(info.m.name+': ',frag(sentences(info.result.mismatches)));
      const row=document.createElement('div');row.className='sgRow';const done=v=>{d.close();d.remove();resolve(v);};
      const btn=(t,fn,cls)=>{const b=document.createElement('button');b.type='button';b.append(frag(t));if(cls)b.className=cls;b.onclick=fn;row.append(b);return b;};
      const tail=starting?[' – ',span('és indítás')]:[];btn([...l.expected,...tail],()=>{apply(info,'expected');done(true);},'primary');btn([...l.current,...tail],()=>{apply(info,'current');done(true);});btn('Mégse',()=>done(false));
      d.append(h,p,row);d.addEventListener('cancel',e=>{e.preventDefault();done(false);});document.body.append(d);d.showModal();});
  }
  return {summary,confirmStart,check};
}
