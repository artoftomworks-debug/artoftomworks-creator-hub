export const sizePresets={
 image:[[1024,1024],[1344,768],[768,1344],[1152,896],[896,1152],[1536,1024],[1024,1536]],
 video:[[768,448],[1024,576],[1088,608],[1280,704],[1344,768],[1920,1088],[608,1088],[768,1344],[768,768]]
};
export function availableSizePresets(mode,custom=[]){
 return [...custom,...sizePresets[mode].map(([width,height])=>({width,height}))];
}
export function aspect(width,height){const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(width,height);return width/g+':'+height/g;}
export function sizeProblem(width,height){return ![width,height].every(v=>Number.isInteger(v)&&v>=256&&v<=2048&&v%32===0)||width*height>2097152?'256–2048 közötti, 32-vel osztható értékek szükségesek, legfeljebb 2 megapixel.':'';}
export function nearestSize(width,height){let w=Math.min(2048,Math.max(256,Math.round(width/32)*32||1024)),h=Math.min(2048,Math.max(256,Math.round(height/32)*32||1024));while(w*h>2097152){if(w>=h)w-=32;else h-=32;}return {width:w,height:h};}
export function presetLabel(width,height){return width+' × '+height+' · '+aspect(width,height);}
export function savedSizeLabel(p){
 const dimensions=p.width+' × '+p.height;
 return (p.name&&p.name!==dimensions?p.name+' · ':'')+presetLabel(p.width,p.height);
}

export function saveSizePreset(state,mode,{width,height,name=''}){
 const problem=sizeProblem(width,height);
 if(problem)throw Error(problem);
 const label=name.trim().slice(0,60);
 const rows=(state.presets??={})[mode]??=[];
 if(!label){
  const existing=rows.find(row=>row.width===width&&row.height===height);
  if(existing)return existing;
 }
 const item={name:label||width+' × '+height,width,height};
 const index=rows.findIndex(row=>row.name===item.name);
 if(index>=0)rows[index]=item;
 else{
  if(rows.length>=40)throw Error('Legfeljebb 40 saját méret menthető. Törölj egyet a saját méretek közül.');
  rows.push(item);
 }
 return item;
}

export function sizeAdviceChoices(mode,current,families=[]){
 const multiple=families.includes('ltx')?64:32;
 const max=families.some(f=>f==='sd1'||f==='sd2')?768:2048;
 const area=Math.min(max*max,sizeProblem(current.width,current.height)?1024**2:current.width*current.height);
 const snap=value=>Math.max(256,Math.min(max,Math.round(value/multiple)*multiple));
 const choices={};
 for(const [orientation,ratio] of [['landscape',16/9],['portrait',9/16],['square',1]]){
  const width=snap(Math.sqrt(area*ratio)),height=snap(Math.sqrt(area/ratio));
  const candidates=[{width,height},...availableSizePresets(mode)].filter(p=>
   !sizeProblem(p.width,p.height)&&p.width<=max&&p.height<=max&&
   p.width%multiple===0&&p.height%multiple===0&&
   (orientation==='square'?p.width===p.height:orientation==='portrait'?p.height>p.width:p.width>p.height));
  const score=p=>Math.abs(Math.log((p.width/p.height)/ratio))+
   .35*Math.abs(Math.log(p.width*p.height/area));
  candidates.sort((a,b)=>score(a)-score(b));
  if(candidates.length)choices[orientation]=candidates[0];
 }
 return choices;
}
