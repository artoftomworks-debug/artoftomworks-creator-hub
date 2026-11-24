// 0.16 DEV — Automatic memory hygiene between model families.
// ComfyUI keeps every model it has used in RAM/VRAM. After e.g. Krea2 → LTX → H3 on a 12 GB GPU / 32 GB RAM
// machine this leaves almost no free memory and the next heavy video model crawls (104 s/step measured).
// Before each submission we compare the main models of the next graph with the graph ComfyUI ran last
// (read from its own /history, so runs started outside the Hub count too). If they differ, we ask
// ComfyUI to unload models and free memory first. Never blocks a generation: any error is ignored.

const MAIN_KEYS=['unet_name','ckpt_name'];

export function modelSignature(prompt){
 const names=new Set();
 for(const node of Object.values(prompt||{})){
  const inputs=node?.inputs;if(!inputs||typeof inputs!=='object')continue;
  for(const key of MAIN_KEYS){const v=inputs[key];if(typeof v==='string'&&v.trim())names.add(v.trim().toLowerCase());}
 }
 return [...names].sort().join('|');
}

export function createMemoryGuard({fetchImpl=fetch,timeoutMS=6000,log=()=>{}}={}){
 async function call(url,options={}){const r=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(timeoutMS)});if(!r.ok)throw Error(url+' → HTTP '+r.status);return r;}
 async function lastSignature(backend){
  // ComfyUI lists history oldest → newest; pick the newest by its own execution timestamps (fallback: last).
  const history=await (await call(backend+'/history?max_items=3')).json();
  const entries=Object.values(history||{});const stamp=e=>Math.max(0,...(e?.status?.messages||[]).map(m=>Number(m?.[1]?.timestamp)||0));
  const entry=entries.reduce((best,e)=>!best||stamp(e)>=stamp(best)?e:best,null);const prompt=Array.isArray(entry?.prompt)?entry.prompt[2]:null;
  return prompt?modelSignature(prompt):'';
 }
 return async function guard(backend,prompt){
  try{
   if(!backend||!prompt)return {freed:false,reason:'no-input'};
   const next=modelSignature(prompt);if(!next)return {freed:false,reason:'no-main-model'};
   const previous=await lastSignature(backend);
   if(!previous)return {freed:false,reason:'nothing-loaded-before',to:next};
   if(previous===next)return {freed:false,reason:'same-models',to:next};
   await call(backend+'/free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})});
   log(`Modellváltás (${previous} → ${next}): a ComfyUI memóriája felszabadítva.`);
   return {freed:true,from:previous,to:next,at:Date.now()};
  }catch(e){return {freed:false,reason:'error',error:String(e.message||e).slice(0,300)};}
 };
}
