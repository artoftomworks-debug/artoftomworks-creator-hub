import {inflateSync} from 'node:zlib';
import {inspectRenderSource,renderBranch,uiToBundle} from './workflow.mjs';
const LIMIT=4*1024**2;
const clean=v=>typeof v==='string'?v.trim().slice(0,50000):undefined;
const number=(v,min,max,int=false)=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max&&(!int||Number.isSafeInteger(Number(v)))?Number(v):undefined;
const json=s=>{try{return JSON.parse(s);}catch{return null;}};
function unicodeComment(b){if(b.subarray(0,8).toString('ascii').startsWith('ASCII'))return b.subarray(8).toString('utf8').replace(/\0+$/,'');if(b.subarray(0,8).toString('ascii').startsWith('UNICODE')){b=b.subarray(8);if(b[0]===0xfe&&b[1]===0xff||b[0]===0&&b[1])return new TextDecoder('utf-16be').decode(b).replace(/\0+$/,'');return b.toString('utf16le').replace(/^\uFEFF/,'').replace(/\0+$/,'');}return b.toString('utf8').replace(/\0+$/,'');}
function exif(b,fields){
 if(b.subarray(0,6).toString('ascii')==='Exif\0\0')b=b.subarray(6);const le=b.subarray(0,2).toString()==='II';if(!le&&b.subarray(0,2).toString()!=='MM')return;
 const u16=p=>le?b.readUInt16LE(p):b.readUInt16BE(p),u32=p=>le?b.readUInt32LE(p):b.readUInt32BE(p),seen=new Set();
 function ifd(pos){if(seen.has(pos)||seen.size>=8||pos<0||pos+2>b.length)return;seen.add(pos);const count=Math.min(u16(pos),512);for(let i=0;i<count;i++){const p=pos+2+i*12;if(p+12>b.length)break;const tag=u16(p),type=u16(p+2),n=u32(p+4);if(tag===0x8769){ifd(u32(p+8));continue;}if(![0x9286,0x010e,0x9c9c].includes(tag))continue;const length=n*({1:1,2:1,3:2,4:4,7:1}[type]||0),offset=length<=4?p+8:u32(p+8);if(!length||length>LIMIT||offset+length>b.length)continue;const data=b.subarray(offset,offset+length),value=tag===0x9c9c?data.toString('utf16le').replace(/\0+$/,''):unicodeComment(data);if(value.trim())fields.parameters??=value;}}
 try{if(b.length>=8&&u16(2)===42)ifd(u32(4));}catch{}
}
export function imageFields(bytes){
 const b=Buffer.from(bytes),fields={},warnings=[];let format='OTHER',width,height,total=0;
 const put=(key,value)=>{if(value&&total+value.length<=2*LIMIT){fields[key.toLowerCase()]=value;total+=value.length;}};
 if(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
  format='PNG';if(b.length>=24){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
  for(let p=8;p+12<=b.length;){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(p+n+12>b.length){warnings.push('A PNG metaadatblokk csonka.');break;}if(n<=LIMIT&&['tEXt','zTXt','iTXt'].includes(type))try{const d=b.subarray(p+8,p+8+n),z=d.indexOf(0);if(z>0){const key=d.subarray(0,z).toString('latin1');if(type==='tEXt')put(key,d.subarray(z+1).toString('utf8'));else if(type==='zTXt'&&d[z+1]===0)put(key,inflateSync(d.subarray(z+2),{maxOutputLength:LIMIT}).toString('utf8'));else if(type==='iTXt'){const a=d.indexOf(0,z+3),c=a<0?-1:d.indexOf(0,a+1);if(c>=0)put(key,(d[z+1]===1?inflateSync(d.subarray(c+1),{maxOutputLength:LIMIT}):d.subarray(c+1)).toString('utf8'));}}}catch{warnings.push('Egy tömörített metaadat nem olvasható.');}p+=n+12;if(type==='IEND')break;}
 }else if(b[0]===255&&b[1]===216){
  format='JPEG';for(let p=2;p+4<=b.length;){if(b[p]!==255)break;const marker=b[p+1];if(marker===0xda||marker===0xd9)break;if(marker===255){p++;continue;}const n=b.readUInt16BE(p+2);if(n<2||p+n+2>b.length)break;const d=b.subarray(p+4,p+n+2);if(marker===0xe1&&d.length<=LIMIT)exif(d,fields);if(marker===0xfe&&d.length<=LIMIT)put('parameters',d.toString('utf8'));if([0xc0,0xc1,0xc2].includes(marker)&&d.length>=5){height=d.readUInt16BE(1);width=d.readUInt16BE(3);}p+=n+2;}
 }else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  format='WebP';for(let p=12;p+8<=b.length;){const tag=b.toString('ascii',p,p+4),n=b.readUInt32LE(p+4);if(p+8+n>b.length)break;const d=b.subarray(p+8,p+8+n);if(tag==='EXIF'&&n<=LIMIT)exif(d,fields);if(tag==='VP8X'&&n>=10){width=1+d.readUIntLE(4,3);height=1+d.readUIntLE(7,3);}p+=8+n+(n%2);}
 }
 return {format,width,height,fields,warnings};
}
function compact(p){const r={},aliases={width:['width'],height:['height'],steps:['steps'],cfg:['cfgscale','cfg_scale','cfg'],seed:['seed','noise_seed'],denoise:['denoise','initimagecreativity','denoising_strength'],guidance:['guidance','fluxguidancescale'],sampler:['sampler','sampler_name'],scheduler:['scheduler'],duration:['duration','videolength'],fps:['fps','framerate'],frames:['frames']};
 for(const [key,names]of Object.entries(aliases)){const v=names.map(n=>p[n]).find(v=>v!==undefined&&v!==null&&v!=='');if(v===undefined)continue;r[key]=['sampler','scheduler'].includes(key)?clean(v):number(v,...({width:[1,32768,true],height:[1,32768,true],steps:[1,1000,true],seed:[0,Number.MAX_SAFE_INTEGER,true],denoise:[0,1],cfg:[0,100],guidance:[0,100],duration:[0.001,36000],fps:[0.001,240],frames:[1,10000000,true]}[key]));if(r[key]===undefined)delete r[key];}return r;}
function swarm(p){p=p.sui_video_params||p.sui_image_params||p;if(!p||typeof p!=='object'||![p.prompt,p.negativeprompt,p.model].some(v=>typeof v==='string')&&number(p.seed,0,Number.MAX_SAFE_INTEGER,true)===undefined)return null;const f=compact(p);if(typeof p.prompt==='string')f.prompt=p.prompt.slice(0,50000);if(typeof p.negativeprompt==='string')f.negative=p.negativeprompt.slice(0,50000);if(clean(p.model))f.model=clean(p.model);if(Array.isArray(p.loras)){f.loras=p.loras.slice(0,64).flatMap((v,i)=>{const name=clean(typeof v==='string'?v:v?.name||v?.lora||v?.lora_name);if(!name)return [];const weight=number(p.loraweights?.[i]??v?.strength??v?.weight,-4,4),clip=number(p.loraweightsclip?.[i]??v?.strength_clip??v?.clip,-4,4);return [{name,on:v?.on!==false&&v?.enabled!==false,strength:weight,clip}];});}return {source:'SwarmUI',...f};}
function parameters(text){
 const parsed=json(text);if(parsed)return swarm(parsed);
 const line=text.match(/(?:^|\r?\n)Steps:\s*(\d+)[^\r\n]*$/i);if(!line)return null;const end=line.index,body=text.slice(0,end),neg=body.match(/(?:^|\r?\n)Negative prompt:\s*/i),r={source:'A1111 / Forge',prompt:(neg?body.slice(0,neg.index):body).trimEnd()};if(neg)r.negative=body.slice(neg.index+neg[0].length).trimEnd();
 const values={};for(const m of line[0].matchAll(/(?:^|,|\n)\s*([\w ]+):\s*("(?:[^"\\]|\\.)*"|[^,\r\n]*)/g))values[m[1].trim().toLowerCase()]=m[2].replace(/^"|"$/g,'').trim();Object.assign(r,compact({...values,cfg:values['cfg scale'],denoise:values['denoising strength']}));if(values.model)r.model=values.model;const size=values.size?.match(/^(\d+)x(\d+)$/i);if(size){r.width=+size[1];r.height=+size[2];}if(values['schedule type'])r.scheduler=values['schedule type'];
 const loras=[...r.prompt.matchAll(/<lora:([^:<>]+):(-?\d+(?:\.\d+)?)>/gi)].map(m=>({name:m[1],strength:number(m[2],-4,4),clip:number(m[2],-4,4),on:true,tag:m[0]}));if(loras.length)r.loras=loras.slice(0,64);return r;
}
function comfy(raw){
 const p=raw.prompt||raw,outs=Object.entries(p).filter(([,n])=>n&&['SaveImage','SaveVideo'].includes(n.class_type));const found=[];
 for(const [id]of outs.slice(0,12))try{const info=inspectRenderSource({prompt:p},id),branch=renderBranch(p,id),warnings=[];
  const r={source:'ComfyUI · '+info.mode+' · #'+id,mode:info.mode,prompt:info.prompt,...(info.negativeAvailable?{negative:info.negative}:{}),...info.sampling,loras:info.loras.map(l=>({name:l.name,on:l.on,strength:l.strength,clip:l.clip})),warnings};
  if(info.modelFields.length===1&&typeof info.modelFields[0].name==='string')r.model=info.modelFields[0].name;else warnings.push('Több vagy nem egyértelmű modellbetöltő; a modell nem vehető át automatikusan.');
  const seeds=[...new Set(info.seeds.map(s=>s.value))];if(seeds.length===1&&number(seeds[0],0,Number.MAX_SAFE_INTEGER,true)!==undefined)r.seed=seeds[0];else if(seeds.length)warnings.push('A seedek eltérnek vagy nem ábrázolhatók pontosan; nincs automatikus seedátvétel.');
  if(info.empty||info.h3||info.ltxEmpty){r.width=info.width;r.height=info.height;}else {const scales=Object.values(branch).filter(n=>n.class_type==='ImageScale');if(scales.length===1){r.width=scales[0].inputs.width;r.height=scales[0].inputs.height;}}
  if(info.mode==='video'){
   const value=(v,seen=new Set())=>{if(!Array.isArray(v))return v;if(seen.has(v[0]))return;seen.add(v[0]);const n=branch[v[0]];return n&&/^Primitive(Int|Float)$/.test(n.class_type)?value(n.inputs.value,seen):undefined;};
   r.frames=number(value(branch[info.h3||info.ltxEmpty]?.inputs.length),1,10000000,true);r.fps=number(value(branch[info.create]?.inputs.fps),.001,240);if(r.frames&&r.fps)r.duration=r.frames/r.fps;
  }
  found.push(r);
 }catch{}return found;
}
export async function readImageRecipe(dataUrl,{getObjects}={}){
 if(typeof dataUrl!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)||dataUrl.length>12*1024**2)throw Error('Legfeljebb 8 MiB-os PNG, JPEG vagy WebP kép szükséges.');const bytes=Buffer.from(dataUrl.split(',')[1],'base64');if(bytes.length>8*1024**2)throw Error('A kép túl nagy.');
 return readMetadataRecipe(imageFields(bytes),{getObjects});
}
export async function readMetadataRecipe(input,{getObjects}={}){
 if(!input||typeof input!=='object'||!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields)||Object.keys(input.fields).length>64)throw Error('Hibás média-metaadat.');
 let total=0;const fields=Object.create(null);for(const [key,value]of Object.entries(input.fields)){if(typeof value!=='string'||value.length>LIMIT||(total+=value.length)>2*LIMIT)throw Error('Túl nagy média-metaadat.');if(['creatorhubeditor','prompt','workflow','parameters','comment','description','sui_image_params','sui_video_params','positive_prompt','negative_prompt','prompt_text'].includes(key.toLowerCase()))fields[key.toLowerCase()]=value;}
 const meta={format:String(input.format||'Média').slice(0,40),media:input.media==='video'?'video':'image',width:number(input.width,1,32768,true),height:number(input.height,1,32768,true),fields,warnings:Array.isArray(input.warnings)?input.warnings.filter(v=>typeof v==='string').slice(0,8).map(v=>v.slice(0,300)):[]};
 // Containers commonly wrap Comfy prompt/workflow or Swarm parameters in a JSON comment.
 for(const key of ['comment','description','parameters']){const value=json(fields[key]||'null');if(value&&typeof value==='object'&&!Array.isArray(value)){if(value.prompt&&typeof value.prompt==='object')fields.prompt??=JSON.stringify(value.prompt);else if(Object.values(value).some(n=>n?.class_type))fields.prompt??=JSON.stringify(value);if(value.workflow&&typeof value.workflow==='object')fields.workflow??=JSON.stringify(value.workflow);if(value.sui_image_params||value.sui_video_params||typeof value.prompt==='string')fields.parameters??=JSON.stringify(value);}}
 for(const key of ['sui_image_params','sui_video_params'])if(fields[key])fields.parameters??=JSON.stringify({[key]:json(fields[key])});
 const recipes=[];const edit=json(fields.creatorhubeditor||'');if(edit?.schema==='artoftomworks.image-editor.export'&&edit.sourceRecipe){const v=edit.sourceRecipe,r=swarm({...v,...v.sampling,model:v.models?.[0]||v.model,negativeprompt:v.negative});if(r)recipes.push({...r,source:'Creator Hub Képműhely · forrásrecept'});meta.warnings.push('Szerkesztett kép: a forrásrecept az eredeti generálás adata, a szerkesztések külön metaadatban szerepelnek.');}let r=parameters(fields.parameters||'');if(r)recipes.push(r);
 const api=json(fields.prompt||'null');if(api&&typeof api==='object')recipes.push(...comfy(api));
 if(api&&typeof api==='object'&&!recipes.length)meta.warnings.push('A fájl workflow-t tartalmaz, de annak generálási ága még nem támogatott.');
 if(!recipes.length&&fields.workflow&&getObjects)try{const graph=uiToBundle(json(fields.workflow),await getObjects());recipes.push(...comfy(graph));}catch{meta.warnings.push('A mentett UI-workflow nem értelmezhető biztonságosan.');}
 if(!recipes.length){const prompt=fields.positive_prompt||fields.prompt_text||(typeof api==='string'?api:!api?fields.prompt:undefined);if(prompt)recipes.push({source:meta.format+' szöveges metaadat',prompt:prompt.slice(0,50000),...(fields.negative_prompt!==undefined?{negative:fields.negative_prompt}:{})});}
 for(const r of recipes){r.warnings=[...meta.warnings,...(r.warnings||[])];r.missing=['prompt','negative','model','seed','width','height','steps','cfg','sampler','scheduler','loras',...(meta.media==='video'?['duration']:[])].filter(k=>r[k]===undefined);}
 return {format:meta.format,media:meta.media,width:meta.width,height:meta.height,recipes,warnings:meta.warnings,message:recipes.length?'Csak a fájlban ténylegesen szereplő adatok. Az újraalkotás pontossága nem garantált.':meta.media==='video'?'A videóban nincs kiolvasható generálási recept; a készítési paraméterek nem állíthatók vissza belőle.':'Nincs kiolvasható generálási recept. A kép ettől még használható kezdőképként.'};
}
