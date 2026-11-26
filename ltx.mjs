// Core LTX video adapter. Custom multi-stage sources remain editable in ComfyUI.
export function ltxTiming(seconds,fps=24){if(!Number.isFinite(seconds)||seconds<1||seconds>15||!Number.isFinite(fps)||fps<1||fps>60)throw Error('LTX: 1–15 másodperc, 1–60 fps választható.');const frames=1+8*Math.max(1,Math.round((seconds*fps-1)/8));return {frames,fps,seconds:frames/fps};}
// 0.16 DEV — two-stage (2x latent upscale) LTX sources, e.g. the ArtofTomworks GLOBAL I2V chain.
// Numeric settings may come from Primitive nodes or simple ComfyMathExpression helpers;
// the Hub resolves them read-only and, when compiling, replaces such helper links with
// the exact values it computed. The source workflow file itself is never changed.
const PRIMITIVE=/^Primitive(Int|Float|Boolean|String|StringMultiline)$/;
export function evalMath(expr,vars){
 const src=String(expr||'');if(src.length>200)throw Error('LTX: túl hosszú matematikai kifejezés.');
 const tokens=src.match(/\s*(\d+(?:\.\d+)?|[A-Za-z_]\w*|[-+*/%(),])\s*/gy);
 if(!tokens||tokens.join('').replace(/\s+/g,'')!==src.replace(/\s+/g,''))throw Error('LTX: nem támogatott kifejezés: '+src);
 const t=tokens.map(x=>x.trim());let i=0;
 const fns={floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs,min:Math.min,max:Math.max};
 const peek=()=>t[i],take=x=>{if(x!==undefined&&t[i]!==x)throw Error('LTX: hibás kifejezés: '+src);return t[i++];};
 function primary(){const x=take();if(x===undefined)throw Error('LTX: hibás kifejezés: '+src);
  if(/^\d/.test(x))return Number(x);if(x==='(') {const v=sum();take(')');return v;}if(x==='-')return -primary();if(x==='+')return primary();
  if(fns[x]){take('(');const args=[sum()];while(peek()===','){take(',');args.push(sum());}take(')');return fns[x](...args);}
  if(Object.hasOwn(vars,x)&&Number.isFinite(vars[x]))return vars[x];throw Error('LTX: ismeretlen érték a kifejezésben: '+x);}
 function product(){let v=primary();while(['*','/','%'].includes(peek())){const op=take(),r=primary();v=op==='*'?v*r:op==='/'?v/r:v%r;}return v;}
 function sum(){let v=product();while(['+','-'].includes(peek())){const op=take(),r=product();v=op==='+'?v+r:v-r;}return v;}
 const v=sum();if(i!==t.length||!Number.isFinite(v))throw Error('LTX: hibás kifejezés: '+src);return v;
}
export function resolveNumber(p,value,seen=new Set()){
 if(typeof value==='number')return value;if(!Array.isArray(value))return null;
 const[id,slot]=value;if(seen.has(id))return null;seen.add(id);const n=p[id];if(!n)return null;
 if(PRIMITIVE.test(n.class_type)){const v=n.inputs.value;return typeof v==='number'?v:resolveNumber(p,v,seen);}
 if(n.class_type==='ComfyMathExpression'){const vars={};for(const[k,v]of Object.entries(n.inputs))if(k.startsWith('values.')){const r=resolveNumber(p,v,new Set(seen));if(r===null)return null;vars[k.slice(7)]=r;}
  let r;try{r=evalMath(n.inputs.expression,vars);}catch{return null;}return slot===1?Math.trunc(r):r;}
 return null;
}
// Sets a numeric input. A Primitive source keeps its role as the editable constant;
// a helper (math) link is replaced by the computed literal in the compiled copy only.
export function forceNumber(p,id,key,value){
 const old=p[id].inputs[key];
 if(Array.isArray(old)){const src=p[old[0]];if(src&&PRIMITIVE.test(src.class_type)&&typeof src.inputs.value==='number'){const users=Object.values(p).filter(n=>Object.values(n.inputs).some(v=>Array.isArray(v)&&v[0]===old[0]));if(users.length===1){src.inputs.value=value;return;}}}
 p[id].inputs[key]=value;
}
const upstream=(p,start)=>{const out=new Set(),stack=[start];while(stack.length){const id=stack.pop();if(out.has(id)||!p[id])continue;out.add(id);for(const v of Object.values(p[id].inputs))if(Array.isArray(v)&&typeof v[0]==='string')stack.push(v[0]);}return out;};
export function ltxTwoStageDims(width,height){
 const base=v=>Math.max(128,Math.round(v/64)*32);const bw=base(width),bh=base(height);
 return {baseWidth:bw,baseHeight:bh,width:bw*2,height:bh*2};
}
export function inspectLTX(p,output,{textNodes,scalar,hash}){
 const empty=Object.entries(p).filter(([,n])=>['EmptyLTXVLatentVideo','LTXVImgToVideo'].includes(n.class_type)),creates=Object.entries(p).filter(([,n])=>n.class_type==='CreateVideo'),samples=Object.entries(p).filter(([,n])=>['KSampler','SamplerCustomAdvanced'].includes(n.class_type)),images=Object.entries(p).filter(([,n])=>n.class_type==='LoadImage'),ups=Object.entries(p).filter(([,n])=>n.class_type==='LTXVLatentUpsampler');
 if(Object.values(p).some(n=>n.class_type==='LTXVAddGuide'))throw Error('Referenciás (AddGuide) LTX workflow-t a Hub még nem kezel. A ComfyUI-ban futtatható.');
 let twoStage=false,stages=null;
 if(samples.length===2&&ups.length===1&&empty.length===1&&creates.length===1&&images.length<=1){
  // Order the two samplers: the refine sampler must sit downstream of the upsampler,
  // which must sit downstream of the base sampler, which must consume the single empty latent.
  const up=ups[0][0];const refine=samples.find(([id])=>upstream(p,id).has(up)),base=samples.find(([id])=>id!==refine?.[0]);
  if(!refine||!base||!upstream(p,up).has(base[0])||!upstream(p,base[0]).has(empty[0][0]))throw Error('LTX: a kétlépcsős lánc sorrendje nem ismerhető fel (alap → 2× felskálázás → finomítás).');
  twoStage=true;stages={base:base[0],refine:refine[0],upsampler:up};
 }else if(empty.length!==1||creates.length!==1||samples.length!==1||images.length>1||ups.length)throw Error('A Hub LTX-ága egylépcsős, illetve kétlépcsős (alap → 2× látens felskálázás → finomítás) láncot kezel, egy látens videóval és legfeljebb egy kezdőképpel. Más felépítésű workflow a ComfyUI-ban futtatható.');
 const first=twoStage?p[stages.base]:samples[0][1];
 let condition=first.inputs;if(first.class_type==='SamplerCustomAdvanced'){const guider=p[condition.guider?.[0]];if(!guider||!['CFGGuider','LTXVDualCFGGuider'].includes(guider.class_type))throw Error('LTX: nem felismert guider.');condition=guider.inputs;}
 let positive=textNodes(p,condition.positive),negative=textNodes(p,condition.negative);const both=positive.filter(id=>negative.includes(id));if(both.length){const cond=Object.values(p).filter(n=>n.class_type==='LTXVConditioning');if(cond.length!==1)throw Error('LTX: a pozitív és negatív prompt nem különíthető el.');positive=textNodes(p,cond[0].inputs.positive);negative=textNodes(p,cond[0].inputs.negative);}
 if(!positive.length||positive.some(id=>negative.includes(id)))throw Error('LTX: külön pozitív és negatív szövegág szükséges.');
 if(twoStage){
  // Both stages must share the same text conditioning, otherwise the Hub prompt would be half-applied.
  const second=p[stages.refine];const g=second.class_type==='SamplerCustomAdvanced'?p[second.inputs.guider?.[0]]?.inputs:second.inputs;
  const pos2=textNodes(p,g?.positive);if(!pos2.length||!positive.every(id=>pos2.includes(id)))throw Error('LTX: a két lépcső eltérő promptot használ; ezt a Hub nem írja át biztonságosan.');
 }
 const e=empty[0][1].inputs,cond=Object.values(p).find(n=>n.class_type==='LTXVConditioning');
 const fps=resolveNumber(p,creates[0][1].inputs.fps)??resolveNumber(p,cond?.inputs.frame_rate);if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('LTX: a forrás fps-e nem egyszerűen kiolvasható.');
 let width=resolveNumber(p,e.width),height=resolveNumber(p,e.height);if(twoStage&&Number.isFinite(width)&&Number.isFinite(height)){width=Math.trunc(width)*2;height=Math.trunc(height)*2;}
 return {family:'LTX',videoFamily:'ltx',twoStage,stages,ltxEmpty:empty[0][0],create:creates[0][0],positive,negativeNodes:negative,negativeAvailable:negative.length>0,imageLoader:images[0]?.[0],width:Number.isFinite(width)?width:null,height:Number.isFinite(height)?height:null,fps,sourceHash:hash(p)};
}
export function compileLTX(p,info,plan,imagePath,prefix,setScalar){
 const timing=ltxTiming(plan.duration,info.fps);if(!plan.prompt?.trim())throw Error('Írj LTX videópromptot.');
 for(const id of info.positive)setScalar(p,id,'text',plan.prompt);for(const id of info.negativeNodes)setScalar(p,id,'text',String(plan.negative||''));
 const dims=info.twoStage?ltxTwoStageDims(plan.width,plan.height):{baseWidth:plan.width,baseHeight:plan.height,width:plan.width,height:plan.height};
 const empty=p[info.ltxEmpty].inputs;for(const [key,value]of Object.entries({width:dims.baseWidth,height:dims.baseHeight,length:timing.frames,batch_size:1}))if(key in empty)forceNumber(p,info.ltxEmpty,key,value);
 for(const[id,n]of Object.entries(p)){if(n.class_type==='LTXVEmptyLatentAudio'){forceNumber(p,id,'frames_number',timing.frames);forceNumber(p,id,'frame_rate',timing.fps);}if(n.class_type==='LTXVConditioning')forceNumber(p,id,'frame_rate',timing.fps);}
 if(info.imageLoader){if(!imagePath)throw Error('Ehhez az LTX-videóhoz kezdőkép szükséges.');p[info.imageLoader].inputs.image=imagePath;const from=info.imageLoader,existing=Object.values(p).filter(n=>n.class_type==='ImageScale'&&n.inputs.image?.[0]===from&&n.inputs.image?.[1]===0&&n.inputs.upscale_method==='lanczos'&&n.inputs.crop==='center');if(existing.length===1){existing[0].inputs.width=dims.width;existing[0].inputs.height=dims.height;}else{const id=String(Math.max(...Object.keys(p).map(Number))+1);for(const n of Object.values(p))for(const[k,v]of Object.entries(n.inputs))if(Array.isArray(v)&&v[0]===from&&v[1]===0)n.inputs[k]=[id,0];p[id]={class_type:'ImageScale',inputs:{image:[from,0],upscale_method:'lanczos',width:dims.width,height:dims.height,crop:'center'}};}}
 forceNumber(p,info.create,'fps',timing.fps);p[info.output].inputs.filename_prefix=prefix;
 return info.twoStage?{...timing,width:dims.width,height:dims.height,twoStage:true}:timing;
}
