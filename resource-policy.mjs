const GiB=1024**3;
export const MEMORY_NAMES={auto:'Automatikus',low:'Kímélő · Low RAM / VRAM',high:'Nagy memória · High RAM / VRAM'};
export function hardwareSummary(stats){const devices=stats?.devices||[],gpu=devices.find(d=>d.type==='cuda')||devices.find(d=>d.type!=='cpu'),ram=Number(stats?.system?.ram_total)||0,vram=Number(gpu?.vram_total)||0;return {available:!!ram||!!vram,ramGiB:ram/GiB,vramGiB:vram/GiB,gpu:gpu?.name||'',type:gpu?.type||'',comfyVersion:stats?.system?.comfyui_version||''};}
export function memoryPolicy(mode='auto',hardware={}){if(!Object.hasOwn(MEMORY_NAMES,mode))throw Error('Ismeretlen memóriamód.');const known=hardware.vramGiB>0,small=known&&hardware.vramGiB<=12.5||hardware.ramGiB>0&&hardware.ramGiB<=33;return {requested:mode,effective:mode==='auto'?(small?'low':'high'):mode,detected:!!hardware.available,warning:mode==='high'&&small?'A gép memóriája szűkös lehet ehhez a módhoz. A Kímélő mód ajánlott; a Nagy memória mód nem garantál gyorsulást.':''};}
const options=rule=>Array.isArray(rule?.[0])?rule[0]:rule?.[1]?.options||[];
function nodeInputs(objects,type,values){const required=objects[type]?.input?.required;if(!required)return null;const inputs={};for(const [key,rule]of Object.entries(required)){let value=values[key];if(value===undefined)value=rule[1]?.default;if(value===undefined)return null;const choices=options(rule);if(choices.length&&!choices.includes(value))return null;if(['INT','FLOAT'].includes(rule[0])&&(typeof value!=='number'||rule[1]?.min!==undefined&&value<rule[1].min||rule[1]?.max!==undefined&&value>rule[1].max))return null;inputs[key]=value;}for(const key of Object.keys(objects[type].input.optional||{}))if(values[key]!==undefined)inputs[key]=values[key];return inputs;}
export function applyResourcePolicy(prompt,objects,{memoryProfile='auto',h3Acceleration='standard',stats,width,height,duration}={}){
 const hardware=hardwareSummary(stats),policy=memoryPolicy(memoryProfile,hardware),notes=[],applied=[];let changed=false;
 if(!['standard','kitchen'].includes(h3Acceleration))throw Error('Ismeretlen H3 számítási mód.');
 const original=Object.entries(prompt),h3=original.some(([,n])=>n.class_type==='MiniMaxH3ImageToVideo'),ltx=original.some(([,n])=>n.class_type==='EmptyLTXVLatentVideo');
 const add=(type,values)=>{const inputs=nodeInputs(objects,type,values);if(!inputs)return null;let i=Math.max(0,...Object.keys(prompt).map(Number).filter(Number.isFinite))+1;while(prompt[String(i)])i++;const id=String(i);prompt[id]={class_type:type,inputs,_meta:{title:'Creator Hub · Memória / számítás'}};changed=true;return [id,0];};
 // Patch only the model branch actually used by a sampler, preserving existing LoRAs.
 const guiders=original.filter(([,n])=>['CFGGuider','LTXVDualCFGGuider','BasicGuider','KSampler','KSamplerAdvanced'].includes(n.class_type)&&Array.isArray(n.inputs?.model));
 const hasCustom=type=>original.some(([,n])=>n.class_type===type);
 const chain=(type,values,label)=>{if(hasCustom(type)){notes.push(label+': a workflow saját beállítása marad.');return;}let used=false;const replacements=new Map();for(const [,n]of guiders){const key=JSON.stringify(n.inputs.model);let output=replacements.get(key);if(!output){output=add(type,{model:n.inputs.model,...values});if(output)replacements.set(key,output);}if(output){n.inputs.model=output;used=true;}}if(used)applied.push(label);else notes.push(label+': a motorban vagy ebben az ágban nem érhető el; az eredeti számítás marad.');};
 if(policy.effective==='low'){
  if(h3){chain('MiniMaxLowVRAMAttention',{head_chunks:2},'H3 figyelem két részletben');chain('MiniMaxChunkFeedForward',{chunks:2,seq_threshold:4096},'H3 köztes számítás két részletben');}
  else if(ltx)chain('LTXVChunkFeedForward',{chunks:2,dim_threshold:4096},'LTX köztes számítás két részletben');
  let tiled=false;for(const [,n]of original)if(n.class_type==='VAEDecode'){const inputs=nodeInputs(objects,'VAEDecodeTiled',{...n.inputs,tile_size:512,overlap:64,temporal_size:32,temporal_overlap:4});if(inputs){n.class_type='VAEDecodeTiled';n.inputs=inputs;changed=tiled=true;}}
  if(tiled)applied.push('Csempés képi/videó-dekódolás');else notes.push('Csempés dekódolás nem alkalmazható; a workflow eredeti dekódolója marad.');
 }
 if(h3Acceleration==='kitchen'&&h3){
  // Conservative guard: normal first-frame H3 only. Large/ref workflows keep their original backend.
  const source=original.find(([,n])=>n.class_type==='MiniMaxH3ImageToVideo')?.[1].inputs||{},w=Number(width||source.width),h=Number(height||source.height),seconds=Number(duration)||Number(source.length)/24;let frames=Math.ceil(seconds*24);while(frames%17!==5)frames++;const latent=frames<=5?2:(frames-5)/17*5+2,tokens=latent*Math.ceil(w/32)*Math.ceil(h/32)+8192;
  const refs=original.some(([,n])=>/MiniMaxH3(?:AddGuide|Ref|Reference)/.test(n.class_type));
  if(!Number.isFinite(tokens)||tokens>100000||refs||hardware.type!=='cuda')notes.push('H3 gyors mód: a hossz, referenciák vagy a hardver miatt az eredeti számítás marad.');
  else chain('ModelAttentionBackend',{attention:'comfy kitchen attention'},'H3 Comfy Kitchen INT8 figyelem · próba');
 }
 if(policy.warning)notes.push(policy.warning);
 return {changed,requested:policy.requested,effective:policy.effective,hardware,applied,notes,acceleration:h3Acceleration};
}
