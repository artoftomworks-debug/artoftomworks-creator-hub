// 0.17 — Civitai-felismerhető metaadat a Hub képeibe.
// A ComfyUI csak a saját „prompt” blokkját írja a PNG-be; ebből a Civitai a külön betöltős modelleket (UNETLoader,
// Krea2, FLUX…) nem ismeri fel. Ezért a kész képbe beírunk egy szabványos „parameters” blokkot is (A1111 formátum,
// amit a Civitai biztosan olvas): prompt, beállítások, Model + Model hash, LoRA-k hash-sel, „Hashes” JSON, és a
// Creator Hub névjegye. A meglévő blokkok (prompt, workflow) érintetlenek maradnak; a fájlt atomikusan cseréljük.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,rename,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';

const SAMPLERS=new Set(['KSampler','KSamplerAdvanced']);
const MODEL_LOADERS={UNETLoader:'unet_name',CheckpointLoaderSimple:'ckpt_name',CheckpointLoader:'ckpt_name',UnetLoaderGGUF:'unet_name',DiffusionModelLoaderKJ:'model_name'};
const LORA_LOADERS={LoraLoader:['lora_name','strength_model'],LoraLoaderModelOnly:['lora_name','strength_model']};
const base=n=>String(n||'').split(/[\\/]/).pop();
const stem=n=>base(n).replace(/\.(safetensors|ckpt|pt|pth|gguf|sft|bin)$/i,'');
const ref=v=>Array.isArray(v)&&v.length===2?String(v[0]):null;

// Pure: follows a conditioning link back to the text it came from (CLIPTextEncode and common wrappers).
export function conditioningText(graph,link,depth=0){
  const id=ref(link);if(!id||depth>8)return '';const n=graph?.[id];if(!n)return '';const i=n.inputs||{};
  for(const k of ['text','prompt','text_g','t5xxl','clip_l'])if(typeof i[k]==='string'&&i[k].trim())return i[k];
  for(const k of ['conditioning','conditioning_to','conditioning_1','positive','cond'])if(i[k]){const t=conditioningText(graph,i[k],depth+1);if(t)return t;}
  return '';
}

// Pure: models and LoRAs referenced by an API graph.
export function modelRefs(graph){
  const models=[],loras=[];
  for(const n of Object.values(graph||{})){const i=n?.inputs||{},t=n?.class_type;
    if(MODEL_LOADERS[t]&&typeof i[MODEL_LOADERS[t]]==='string')models.push(i[MODEL_LOADERS[t]]);
    if(LORA_LOADERS[t]){const [nameKey,strKey]=LORA_LOADERS[t];if(typeof i[nameKey]==='string'&&Number(i[strKey]??1)!==0)loras.push({name:i[nameKey],strength:Number(i[strKey]??1)});}
    if(t==='Power Lora Loader (rgthree)')for(const [k,v] of Object.entries(i))if(/^lora_\d+$/i.test(k)&&v&&typeof v==='object'&&v.on!==false&&typeof v.lora==='string'&&v.lora&&v.lora!=='None')loras.push({name:v.lora,strength:Number(v.strength??1)});
  }
  return {models:[...new Set(models)],loras};
}

// Pure: A1111-style "parameters" text. hashes: Map/obj of file basename → full sha256 (hex) or AutoV2.
export function buildParameters(graph,{hashes={},version='',width,height}={}){
  const get=k=>hashes instanceof Map?hashes.get(k):hashes[k];const auto=h=>h?String(h).slice(0,10).toLowerCase():'';
  const sampler=Object.values(graph||{}).find(n=>SAMPLERS.has(n?.class_type));const s=sampler?.inputs||{};
  const positive=sampler?conditioningText(graph,s.positive):'',negative=sampler?conditioningText(graph,s.negative):'';
  let w=width,h=height;if(!w||!h)for(const n of Object.values(graph||{}))if(/^Empty.*Latent/.test(n?.class_type||'')&&n.inputs?.width){w=n.inputs.width;h=n.inputs.height;break;}
  const {models,loras}=modelRefs(graph);const fields=[];
  if(s.steps!=null&&!Array.isArray(s.steps))fields.push(['Steps',s.steps]);
  if(typeof s.sampler_name==='string')fields.push(['Sampler',s.sampler_name]);
  if(typeof s.scheduler==='string')fields.push(['Schedule type',s.scheduler]);
  if(s.cfg!=null&&!Array.isArray(s.cfg))fields.push(['CFG scale',s.cfg]);
  const seed=s.seed??s.noise_seed;if(seed!=null&&!Array.isArray(seed))fields.push(['Seed',seed]);
  if(w&&h)fields.push(['Size',w+'x'+h]);
  const model=models[0];const hashJSON={};
  if(model){const mh=auto(get(base(model)));if(mh){fields.push(['Model hash',mh]);hashJSON.model=mh;}fields.push(['Model',stem(model)]);}
  const lh=[];for(const l of loras){const hh=auto(get(base(l.name)));if(hh){lh.push(stem(l.name)+': '+hh);hashJSON['lora:'+stem(l.name)]=hh;}}
  if(lh.length)fields.push(['Lora hashes','"'+lh.join(', ')+'"']);
  if(version)fields.push(['Version',version]);
  if(Object.keys(hashJSON).length)fields.push(['Hashes',JSON.stringify(hashJSON)]);
  const loraTags=loras.map(l=>`<lora:${stem(l.name)}:${Number.isFinite(l.strength)?+l.strength.toFixed(2):1}>`).join(' ');
  const lines=[(positive||'')+(loraTags?(positive?' ':'')+loraTags:'')];if(negative)lines.push('Negative prompt: '+negative);
  lines.push(fields.map(([k,v])=>k+': '+v).join(', '));
  return lines.join('\n');
}

// Pure: PNG chunk helpers.
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=0xffffffff;for(const x of b)c=t[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};})();
function chunk(type,data){const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);out.write(type,4,'ascii');data.copy(out,8);out.writeUInt32BE(CRC(Buffer.concat([Buffer.from(type,'ascii'),data])),8+data.length);return out;}
export function pngTextKeys(buf){const keys=[];if(!isPng(buf))return keys;for(let p=8;p+12<=buf.length;){const n=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8);if(p+12+n>buf.length)break;if(type==='tEXt'||type==='iTXt'){const d=buf.subarray(p+8,p+8+n),z=d.indexOf(0);keys.push(d.toString('latin1',0,z<0?d.length:z));}if(type==='IEND')break;p+=12+n;}return keys;}
const isPng=b=>b?.length>16&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;
// Inserts (or replaces) text entries before IEND. Non-Latin-1 values go into iTXt (UTF-8).
export function setPngText(buf,entries){
  if(!isPng(buf))throw Error('Not a PNG file.');const keys=new Set(Object.keys(entries));const parts=[buf.subarray(0,8)];let iend=null;
  for(let p=8;p+12<=buf.length;){const n=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8);if(p+12+n>buf.length)throw Error('Damaged PNG.');const whole=buf.subarray(p,p+12+n);
    if(type==='IEND'){iend=whole;break;}
    if(type==='tEXt'||type==='iTXt'){const d=buf.subarray(p+8,p+8+n),z=d.indexOf(0),k=d.toString('latin1',0,z<0?d.length:z);if(keys.has(k)){p+=12+n;continue;}}
    parts.push(whole);p+=12+n;}
  if(!iend)throw Error('Damaged PNG (no IEND).');
  for(const [k,v] of Object.entries(entries)){const text=String(v);const latin=/^[\x00-\xff]*$/.test(text);parts.push(latin?chunk('tEXt',Buffer.concat([Buffer.from(k,'latin1'),Buffer.from([0]),Buffer.from(text,'latin1')])):chunk('iTXt',Buffer.concat([Buffer.from(k,'latin1'),Buffer.from([0,0,0,0,0]),Buffer.from(text,'utf8')])));}
  parts.push(iend);return Buffer.concat(parts);
}

// Service: hashes model files once (cached by path+size+mtime) and stamps finished PNGs.
export function createCivitaiStamper({root,library,version='',log=()=>{}}){
  const cacheFile=path.join(root,'data','model-hashes.json');let cache=null;const pending=new Map();let chain=Promise.resolve();
  async function load(){if(cache)return cache;try{cache=JSON.parse(await readFile(cacheFile,'utf8'))||{};}catch{cache={};}return cache;}
  async function persist(){try{await mkdir(path.dirname(cacheFile),{recursive:true});const tmp=cacheFile+'.tmp';await writeFile(tmp,JSON.stringify(cache));await rename(tmp,cacheFile);}catch{}}
  async function findItem(name){const b=base(name);try{const r=await library.list({query:stem(b)});return (r.items||[]).find(i=>!i.directory&&base(i.path||i.name)===b)||null;}catch{return null;}}
  async function findFile(name){return (await findItem(name))?.path||null;}
  /* 0.17.1: ha a fájlhoz Civitai-adatlap tartozik (Stability Matrix .cm-info.json), annak SHA256-ja és verzióazonosítója kerül a képbe –
     így az átalakított (pl. ComfyUI-hoz átírt Krea 2) LoRA-kat is felismeri a Civitai. Adatlap nélkül marad a fájl saját hash-e. */
  async function sourceOf(item){try{const d=await library.detail(item.id);const s=d?.source;return s?.provider==='civitai'?s:null;}catch{return null;}}
  async function sha(file){const c=await load();const st=await stat(file);const k=file;if(c[k]&&c[k].size===st.size&&c[k].mtime===st.mtimeMs)return c[k].sha256;
    if(pending.has(k))return pending.get(k);
    const job=new Promise((resolve,reject)=>{const h=createHash('sha256');createReadStream(file,{highWaterMark:8*1024*1024}).on('data',d=>h.update(d)).on('error',reject).on('end',()=>resolve(h.digest('hex')));})
      .then(async v=>{c[k]={size:st.size,mtime:st.mtimeMs,sha256:v};await persist();return v;}).finally(()=>pending.delete(k));
    pending.set(k,job);return job;}
  async function hashesFor(graph){const {models,loras}=modelRefs(graph);const out={};for(const n of [...models,...loras.map(l=>l.name)]){const it=await findItem(n);if(!it?.path)continue;const src=await sourceOf(it);if(src?.sha256){out[base(n)]=src.sha256;continue;}try{out[base(n)]=await sha(it.path);}catch(e){log('hash: '+e.message);}}return out;}
  async function resourcesFor(graph){const {models,loras}=modelRefs(graph);const res=[];for(const [i,n] of models.entries()){if(i)break;const it=await findItem(n);const src=it&&await sourceOf(it);if(src?.versionId)res.push({type:'checkpoint',modelVersionId:src.versionId});}for(const l of loras){const it=await findItem(l.name);const src=it&&await sourceOf(it);if(src?.versionId)res.push({type:'lora',weight:Number.isFinite(l.strength)?+l.strength.toFixed(2):1,modelVersionId:src.versionId});}return res;}
  async function stamp(file,graph,{width,height}={}){
    if(!/\.png$/i.test(file))return false;const hashes=await hashesFor(graph);let text=buildParameters(graph,{hashes,version,width,height});try{const res=await resourcesFor(graph);if(res.length)text+=', Civitai resources: '+JSON.stringify(res);}catch{}
    const buf=await readFile(file);const next=setPngText(buf,{parameters:text,Software:version||'ArtofTomworks Creator Hub'});const tmp=file+'.chub-tmp';await writeFile(tmp,next);await rename(tmp,file);return true;}
  // queue: one at a time so hashing never runs in parallel with itself
  function enqueue(file,graph,size){chain=chain.then(()=>stamp(file,graph,size)).catch(e=>log('metaadat: '+e.message));return chain;}
  return {stamp,enqueue,hashesFor};
}
