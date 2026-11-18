// Core LTX video adapter. Custom multi-stage sources remain editable in ComfyUI.
export function ltxTiming(seconds,fps=24){if(!Number.isFinite(seconds)||seconds<1||seconds>15||!Number.isFinite(fps)||fps<1||fps>60)throw Error('LTX: 1–15 másodperc, 1–60 fps választható.');const frames=1+8*Math.max(1,Math.round((seconds*fps-1)/8));return {frames,fps,seconds:frames/fps};}
export function inspectLTX(p,output,{textNodes,scalar,hash}){
 const empty=Object.entries(p).filter(([,n])=>['EmptyLTXVLatentVideo','LTXVImgToVideo'].includes(n.class_type)),creates=Object.entries(p).filter(([,n])=>n.class_type==='CreateVideo'),samples=Object.entries(p).filter(([,n])=>['KSampler','SamplerCustomAdvanced'].includes(n.class_type)),images=Object.entries(p).filter(([,n])=>n.class_type==='LoadImage');
 if(empty.length!==1||creates.length!==1||samples.length!==1||images.length>1||Object.values(p).some(n=>['LTXVAddGuide','LTXVLatentUpsampler'].includes(n.class_type)))throw Error('Az automatikus LTX-ág egy mintavételi lépést, egy látens videót és legfeljebb egy kezdőképet támogat. Többlépcsős / referenciás workflow a ComfyUI-ban futtatható.');
 let condition=samples[0][1].inputs;if(samples[0][1].class_type==='SamplerCustomAdvanced'){const guider=p[condition.guider?.[0]];if(!guider||!['CFGGuider','LTXVDualCFGGuider'].includes(guider.class_type))throw Error('LTX: nem felismert guider.');condition=guider.inputs;}
 let positive=textNodes(p,condition.positive),negative=textNodes(p,condition.negative);const both=positive.filter(id=>negative.includes(id));if(both.length){const cond=Object.values(p).filter(n=>n.class_type==='LTXVConditioning');if(cond.length!==1)throw Error('LTX: a pozitív és negatív prompt nem különíthető el.');positive=textNodes(p,cond[0].inputs.positive);negative=textNodes(p,cond[0].inputs.negative);}
 if(!positive.length||positive.some(id=>negative.includes(id)))throw Error('LTX: külön pozitív és negatív szövegág szükséges.');
 const e=empty[0][1].inputs,fps=scalar(p,creates[0][1].inputs.fps);if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('LTX: a forrás fps-e nem egyszerűen kiolvasható.');
 return {family:'LTX',videoFamily:'ltx',ltxEmpty:empty[0][0],create:creates[0][0],positive,negativeNodes:negative,negativeAvailable:negative.length>0,imageLoader:images[0]?.[0],width:scalar(p,e.width),height:scalar(p,e.height),fps,sourceHash:hash(p)};
}
export function compileLTX(p,info,plan,imagePath,prefix,setScalar){
 const timing=ltxTiming(plan.duration,info.fps);if(!plan.prompt?.trim())throw Error('Írj LTX videópromptot.');
 for(const id of info.positive)setScalar(p,id,'text',plan.prompt);for(const id of info.negativeNodes)setScalar(p,id,'text',String(plan.negative||''));
 const empty=p[info.ltxEmpty].inputs;for(const [key,value]of Object.entries({width:plan.width,height:plan.height,length:timing.frames,batch_size:1}))if(key in empty)setScalar(p,info.ltxEmpty,key,value);
 for(const[id,n]of Object.entries(p)){if(n.class_type==='LTXVEmptyLatentAudio'){setScalar(p,id,'frames_number',timing.frames);setScalar(p,id,'frame_rate',timing.fps);}if(n.class_type==='LTXVConditioning')setScalar(p,id,'frame_rate',timing.fps);}
 if(info.imageLoader){if(!imagePath)throw Error('Ehhez az LTX tervhez kezdőkép szükséges.');p[info.imageLoader].inputs.image=imagePath;const id=String(Math.max(...Object.keys(p).map(Number))+1),from=info.imageLoader;for(const n of Object.values(p))for(const[k,v]of Object.entries(n.inputs))if(Array.isArray(v)&&v[0]===from&&v[1]===0)n.inputs[k]=[id,0];p[id]={class_type:'ImageScale',inputs:{image:[from,0],upscale_method:'lanczos',width:plan.width,height:plan.height,crop:'center'}};}
 setScalar(p,info.create,'fps',timing.fps);p[info.output].inputs.filename_prefix=prefix;return timing;
}
