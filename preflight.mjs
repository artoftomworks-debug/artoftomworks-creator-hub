// 0.16 DEV — MI-ellenőrzés indítás előtt. Determinisztikus szabályok (gyors, nem kell hozzá MI-modell):
// csak olyat jelez, amit a Hub biztosan tud, és ahol lehet, egy kattintásos javítást ad.
import {knownModelProfile} from './sampling-policy.mjs';

const round=(v,m)=>Math.max(m,Math.round(v/m)*m);
// Same rule as the DraftFinal workflow: keep the pixel budget, take the aspect from the start image.
export function fitToImage(width,height,iw,ih,multiple=32){
  const area=width*height,w=Math.sqrt(area*iw/ih),h=Math.sqrt(area*ih/iw);
  return {width:round(w,multiple),height:round(h,multiple)};
}
const orientation=(w,h)=>w>h*1.05?'landscape':h>w*1.05?'portrait':'square';
const HU={landscape:'fekvő',portrait:'álló',square:'négyzetes'};

// plan: {mode,width,height,duration,steps,prompt,image:{width,height}|null,model:{family,name,id,title}|null}
export function preflight(plan={}){
  const out=[],{mode='image',width=0,height=0,duration=0,steps,denoise,prompt='',image=null,model=null}=plan,family=model?.family||'';
  const multiple=family==='ltx'?64:32;
  if(!String(prompt).trim())out.push({id:'prompt',level:'warn',text:'Üres a prompt. A modell így csak a kezdőképből és a véletlenből dolgozik.'});
  if(image?.width&&image?.height&&width&&height){
    const io=orientation(image.width,image.height),po=orientation(width,height),diff=Math.abs(Math.log((image.width/image.height)/(width/height)));
    const fix=fitToImage(width,height,image.width,image.height,multiple),changes=fix.width!==width||fix.height!==height;
    if(io!==po&&io!=='square'&&changes)out.push({id:'orientation',level:'warn',text:`A kezdőkép és a beállított méret tájolása eltér (kezdőkép: ${image.width} × ${image.height}, beállítás: ${width} × ${height}). Így a kép torzul vagy levágódik.`,fix:{label:`Igazítás: ${fix.width} × ${fix.height}`,patch:fix}});
    else if(diff>0.12&&changes)out.push({id:'aspect',level:'info',text:`A kezdőkép aránya (${(image.width/image.height).toFixed(2)}) eltér a beállítottól (${(width/height).toFixed(2)}); a széleken levágás vagy torzulás lehet.`,fix:{label:`Arány a kezdőképből: ${fix.width} × ${fix.height}`,patch:fix}});
  }
  if(width&&height&&(width%multiple||height%multiple)){const w=round(width,multiple),h=round(height,multiple);out.push({id:'multiple',level:'info',text:`A méret nem osztható ${multiple}-vel (${width} × ${height}); a modell kerekít, ami apró levágást okozhat.`,fix:{label:`Kerekítés: ${w} × ${h}`,patch:{width:w,height:h}}});}
  if(mode==='image'&&image&&Number.isFinite(denoise)&&denoise>=.9){
    out.push({id:'denoise',level:'warn',text:'A magas denoise miatt kevés maradhat meg a kezdőképből.'});
  }
  const known=model?knownModelProfile(model):null;
  if(known&&Number.isFinite(steps)){
    const k=known.values.steps;
    if(steps>=k*2)out.push({id:'steps',level:'warn',text:`${known.label}: ${k} lépésre készült. ${steps} lépés nem lesz jobb, csak kb. ${(steps/k).toFixed(1)}× lassabb, és túlégetett lehet.`,fix:{label:`${k} lépés`,patch:{steps:k}}});
    else if(steps<k)out.push({id:'steps',level:'info',text:`${known.label}: ${k} lépésre készült, most ${steps} van beállítva – gyorsabb, de részletszegényebb lehet.`,fix:{label:`${k} lépés`,patch:{steps:k}}});
  }else if(Number.isFinite(steps)&&mode==='image'&&steps>60)out.push({id:'steps',level:'info',text:`${steps} lépés sok: a legtöbb képmodellnél 25–40 fölött már alig javul a kép, csak lassul.`});
  if(mode==='video'&&family==='ltx'&&duration>10)out.push({id:'duration',level:'info',text:`Az LTX egy darabban kb. 10 másodpercig stabil; ${duration} mp-nél a vége szétcsúszhat. Hosszabb jelenethez a „Következő jelenetrész” biztonságosabb.`,fix:{label:'10 másodperc',patch:{duration:10}}});
  if(mode==='video'&&width&&height&&duration){const load=width*height*duration/(1088*640*10);if(load>1.25)out.push({id:'load',level:'info',text:`Nagy terhelés (${width} × ${height}, ${duration} mp): a 12 GB-os kártyán lassú lehet, vagy elfogyhat a memória.`});}
  return out;
}

export function checkablePlan({mode,width,height,duration,prompt,sampling,image,model}){
  const {steps,denoise,cfg,sampler}=sampling||{};
  return {
    mode,width:Number(width),height:Number(height),duration:Number(duration),prompt,
    steps:steps==null||!Number.isFinite(Number(steps))?undefined:Number(steps),
    denoise,cfg,sampler,image,model
  };
}
