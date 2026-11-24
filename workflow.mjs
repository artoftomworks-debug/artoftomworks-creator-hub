import {renderBundle,renderBranch,renderHash,backendURL,h3RenderTiming,renderEditableCopy,inspectRenderSource as inspectVideo,compileRenderShot as compileVideo} from './vendor/render-workflow.mjs';
export {renderBundle,renderBranch,renderHash,backendURL,h3RenderTiming};
import {inspectLTX,compileLTX,ltxTiming} from './ltx.mjs';
export const videoTiming=(info,seconds)=>info.videoFamily==='ltx'?ltxTiming(seconds,info.fps):h3RenderTiming(seconds);
const VIDEO='MiniMaxH3ImageToVideo';
const encoders=['CLIPTextEncode','CLIPTextEncodeSDXL','CLIPTextEncodeFlux'];
const seedTypes=['KSampler','KSamplerAdvanced','RandomNoise'];
const loaderTypes=['LoraLoader','LoraLoaderModelOnly'];
export function renderDimensions(width,height){
 if(![width,height].every(v=>Number.isInteger(v)&&v>=256&&v<=2048&&v%32===0)||width*height>2097152)throw Error('256–2048 közötti, 32-vel osztható méretet válassz; legfeljebb 2 megapixel.');
 return {width,height};
}
export function modelFilenameLabel(models=[]){
 const names=[...new Set(models.filter(v=>typeof v==='string').map(v=>v.replaceAll('\\','/').split('/').pop().replace(/\.(safetensors|ckpt|gguf|sft|pt|pth|bin)$/i,'').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu,'_').replace(/^[._-]+|[._-]+$/g,'')).filter(Boolean))];
 return Array.from(names.join('_and_')).slice(0,64).join('').replace(/[._-]+$/g,'');
}
function scalar(prompt,value,seen=new Set()){
 if(!Array.isArray(value))return value;const id=value[0];if(seen.has(id))return null;seen.add(id);const n=prompt[id];return n&&/^Primitive(Int|Float|String|StringMultiline)$/.test(n.class_type)?scalar(prompt,n.inputs.value,seen):null;
}
const IDENTITY={ApplyPulidFlux:['image','prior_image'],ApplyPulid:['image'],ApplyPulidAdvanced:['image'],'easy pulIDApply':['image'],'easy pulIDApplyADV':['image'],ApplyInstantID:['image'],ApplyInstantIDAdvanced:['image'],'easy instantIDApply':['image'],'easy instantIDApplyADV':['image']};
export function identityImageNodes(prompt){const used=new Map();for(const[id,n]of Object.entries(prompt))for(const[k,v]of Object.entries(n.inputs||{}))if(Array.isArray(v)){const ref=IDENTITY[n.class_type]?.includes(k);const row=used.get(String(v[0]))||{ref:false,other:false};if(ref)row.ref=true;else row.other=true;used.set(String(v[0]),row);}return new Set([...used].filter(([,r])=>r.ref&&!r.other).map(([id])=>id));}
function textNodes(prompt,connection){if(!Array.isArray(connection))return [];return Object.entries(renderBranch(prompt,connection[0])).filter(([,n])=>encoders.includes(n.class_type)).map(([id])=>id);}
export function loraRows(prompt){
 const rows=[];for(const[id,n]of Object.entries(prompt)){
  if(loaderTypes.includes(n.class_type))rows.push({node:id,key:'lora_name',name:n.inputs.lora_name,on:Number(n.inputs.strength_model)!==0||Number(n.inputs.strength_clip||0)!==0,strength:Number(n.inputs.strength_model),clip:n.inputs.strength_clip===undefined?null:Number(n.inputs.strength_clip)});
  if(n.class_type==='Power Lora Loader (rgthree)')for(const[key,row]of Object.entries(n.inputs))if(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.lora==='string')rows.push({node:id,key,name:row.lora,on:n.inputs['toggle_all']===false?false:row.on===true,strength:Number(row.strength),clip:row.strengthTwo===undefined?null:Number(row.strengthTwo)});
 }return rows;
}
export function inspectRenderSource(raw,output){
 const bundle=renderBundle(raw),p=bundle.prompt;
 const outputs=Object.entries(p).filter(([,n])=>['SaveImage','SaveVideo'].includes(n.class_type)).map(([id,n])=>({id,label:(n.class_type==='SaveImage'?'Kép':'Videó')+' · '+(n._meta?.title||n.class_type)+' #'+id,mode:n.class_type==='SaveImage'?'image':'video'}));
 if(!outputs.length)throw Error('SaveImage vagy SaveVideo kimenet szükséges.');
 output=output||outputs[0].id;if(!outputs.some(o=>o.id===output))throw Error('Ismeretlen kimenet.');
 const b=renderBranch(p,output),mode=p[output].class_type==='SaveImage'?'image':'video';let info={};
 if(mode==='video')info=Object.values(b).some(n=>['EmptyLTXVLatentVideo','LTXVImgToVideo'].includes(n.class_type))?inspectLTX(b,output,{textNodes,scalar,hash:renderHash}):inspectVideo(bundle,output);
 const samples=Object.entries(b).filter(([,n])=>['KSampler','KSamplerAdvanced','SamplerCustomAdvanced'].includes(n.class_type));
 let positive=[],negative=[],width,height,imageLoader;
 if(mode==='image'){
  if(samples.length!==1)throw Error('Az első képes változat egy KSampler / KSamplerAdvanced / SamplerCustomAdvanced ágat támogat. Válassz egyszerű, bevált képes workflow-t.');
  const sampler=samples[0][1];let conditioning=sampler.inputs;
  if(sampler.class_type==='SamplerCustomAdvanced'){const guider=b[sampler.inputs.guider?.[0]];if(!guider||!['BasicGuider','CFGGuider'].includes(guider.class_type))throw Error('A képes forrásban BasicGuider vagy CFGGuider szükséges.');conditioning=guider.inputs;}
  positive=textNodes(b,conditioning.positive||conditioning.conditioning);negative=textNodes(b,conditioning.negative);
  if(!positive.length||negative.some(id=>positive.includes(id)))throw Error('Nem különíthető el biztonságosan a pozitív és negatív szöveg. Használj külön CLIPTextEncode node-okat.');
  const empty=Object.entries(b).filter(([,n])=>/^Empty.*Latent(Image)?$/.test(n.class_type)&&'width' in n.inputs&&'height' in n.inputs);
  // 0.16 DEV: a LoadImage that only feeds an identity reference (PuLID / InstantID face) is not the start image.
  const refs=identityImageNodes(b);const images=Object.entries(b).filter(([id,n])=>n.class_type==='LoadImage'&&!refs.has(id));
  if(images.length>1||empty.length>1)throw Error('Az első változat egy kezdőképet vagy egy üres látens képet támogat.');
  imageLoader=images[0]?.[0];if(!empty.length&&!imageLoader)throw Error('Nem felismert képméret/bemeneti ág.');
  width=empty.length?scalar(b,empty[0][1].inputs.width):1024;height=empty.length?scalar(b,empty[0][1].inputs.height):1024;
  info={family:'Kép · '+sampler.class_type,empty:empty[0]?.[0],imageLoader,positive,negativeNodes:negative,negativeAvailable:negative.length>0,sampler:samples[0][0],width,height};
 }
 const models=Object.entries(b).filter(([,n])=>['UNETLoader','CheckpointLoaderSimple','UNETLoaderGGUF'].includes(n.class_type)).map(([node,n])=>({node,key:n.class_type==='CheckpointLoaderSimple'?'ckpt_name':'unet_name',name:n.inputs.ckpt_name||n.inputs.unet_name,modelOnly:n.class_type==='CheckpointLoaderSimple'&&!Object.values(b).some(other=>Object.values(other.inputs).some(v=>Array.isArray(v)&&v[0]===node&&v[1]===1))}));
 const seeds=Object.entries(b).filter(([,n])=>seedTypes.includes(n.class_type)).flatMap(([node,n])=>['seed','noise_seed'].filter(key=>key in n.inputs).map(key=>({node,key,value:scalar(b,n.inputs[key])})));
 // 0.16 DEV: in a two-stage LTX chain the Hub seed drives the base pass; the refine pass keeps the source's own noise seed (as in the proven GLOBAL workflow).
 if(info.twoStage){const baseNoise=b[info.stages.base]?.inputs.noise?.[0],refineNoise=b[info.stages.refine]?.inputs.noise?.[0];if(refineNoise&&refineNoise!==baseNoise)for(let i=seeds.length-1;i>=0;i--)if(seeds[i].node===refineNoise)seeds.splice(i,1);}
 if(mode==='video'&&!info.videoFamily){const guider=Object.values(b).find(n=>n.class_type==='CFGGuider');negative=textNodes(b,guider?.inputs.negative);info.negativeNodes=negative;info.negativeAvailable=negative.length>0;}
 if(info.videoFamily==='ltx'){positive=info.positive;negative=info.negativeNodes;}const texts=mode==='image'||info.videoFamily==='ltx'?positive.map(id=>{const n=b[id];return scalar(b,n.inputs.text??n.inputs.text_g??'');}):[scalar(b,b[info.h3].inputs.prompt)];
 const samplingFields=[];for(const [node,n]of Object.entries(b))for(const [key,control]of Object.entries({steps:'steps',cfg:'cfg',sampler_name:'sampler',scheduler:'scheduler',denoise:'denoise',guidance:'guidance',video_cfg:'cfg',audio_cfg:'cfg'}))if(key in n.inputs&&['KSampler','KSamplerAdvanced','CFGGuider','BasicScheduler','KSamplerSelect','FluxGuidance','LTXVScheduler','LTXVDualCFGGuider'].includes(n.class_type))samplingFields.push({node,key,control,value:scalar(b,n.inputs[key])});
 return {...info,output,outputs,mode,samplingFields,sampling:Object.fromEntries(samplingFields.map(f=>[f.control,f.value])),needsImage:info.videoFamily==='ltx'?!!info.imageLoader:mode==='video'?!!b[info.h3].inputs.first_frame:!!imageLoader,sourceHash:renderHash(p),models:models.map(m=>m.name),modelFields:models,loras:loraRows(b),seeds,prompt:texts.filter(t=>typeof t==='string').join('\n'),negative:negative.map(id=>scalar(b,b[id].inputs.text??b[id].inputs.text_g??'')).filter(t=>typeof t==='string').join('\n'),width:info.width||1024,height:info.height||576};
}
function setScalar(p,id,key,value){const old=p[id].inputs[key];if(Array.isArray(old)){const constant=p[old[0]];if(!constant||!/^Primitive(Int|Float|String|StringMultiline)$/.test(constant.class_type))throw Error('Nem egyszerűen felülírható beállítás: '+key);constant.inputs.value=value;}else p[id].inputs[key]=value;}
export function applyControls(raw,info,controls={}){
 const bundle=renderBundle(raw),p=bundle.prompt,allowed=loraRows(renderBranch(p,info.output));
 if(controls.sampling)for(const field of info.samplingFields||[]){if(['sampler','scheduler'].includes(field.control)&&controls.samplingOverrides?.[field.control]===false)continue;const v=controls.sampling[field.control];if(v===undefined)continue;if(['sampler','scheduler'].includes(field.control)){if(typeof v!=='string'||v.length>100)throw Error('Hibás mintavételezési beállítás.');}else if(!Number.isFinite(v)||v<0||v>1000||(field.control==='steps'&&(!Number.isInteger(v)||v<1))||(field.control==='denoise'&&(v<.01||v>1)))throw Error('Hibás generálási érték: '+field.control);setScalar(p,field.node,field.key,v);}
 if(controls.models!==undefined){if(!Array.isArray(controls.models)||controls.models.length>info.modelFields.length)throw Error('Hibás modellválasztás.');const seen=new Set();for(const row of controls.models){const ref=info.modelFields.find(f=>f.node===row.node&&f.key===row.key);if(!ref||typeof row.name!=='string'||!row.name.trim()||row.name.length>1000||seen.has(row.node+':'+row.key))throw Error('Hibás modellválasztás.');seen.add(row.node+':'+row.key);setScalar(p,row.node,row.key,row.name);}}
 if(controls.loras!==undefined){if(!Array.isArray(controls.loras)||controls.loras.length!==allowed.length)throw Error('A LoRA-lista megváltozott. Töltsd be újra a forrást.');
  for(const row of controls.loras){const ref=allowed.find(v=>v.node===row.node&&v.key===row.key&&v.name===row.name);if(!ref||typeof row.on!=='boolean'||!Number.isFinite(row.strength)||Math.abs(row.strength)>4||(ref.clip!==null&&(!Number.isFinite(row.clip)||Math.abs(row.clip)>4)))throw Error('Hibás LoRA-beállítás.');const n=p[row.node];
   if(n.class_type==='Power Lora Loader (rgthree)'){n.inputs[row.key]={...n.inputs[row.key],on:row.on,strength:row.strength,...(ref.clip===null?{}:{strengthTwo:row.clip})};if('toggle_all' in n.inputs)n.inputs.toggle_all=true;}
   else {n.inputs.strength_model=row.on?row.strength:0;if(ref.clip!==null)n.inputs.strength_clip=row.on?row.clip:0;}
  }
 }
 if(controls.seed!==undefined){if(!Number.isSafeInteger(controls.seed)||controls.seed<0)throw Error('A seed 0 és 9007199254740991 közötti egész szám legyen.');for(const f of info.seeds)setScalar(p,f.node,f.key,controls.seed);}
 if(controls.addedLoras!==undefined){
  const rows=controls.addedLoras;if(!Array.isArray(rows)||rows.length>128||rows.filter(r=>r.on).length>24)throw Error('Legfeljebb 128 eltárolt és 24 bekapcsolt új LoRA lehet az összeállításban.');
  for(const row of rows)if(typeof row.name!=='string'||!row.name.trim()||row.name.length>1000||typeof row.on!=='boolean'||!Number.isFinite(row.strength)||Math.abs(row.strength)>4||(row.clip!==null&&(!Number.isFinite(row.clip)||Math.abs(row.clip)>4)))throw Error('Hibás hozzáadott LoRA.');
  if(rows.some(r=>r.on)){
   if(info.modelFields.length!==1)throw Error('Új LoRA-hoz egy modellbetöltő szükséges.');
   const field=info.modelFields[0],root=field.node,full=p[root].class_type==='CheckpointLoaderSimple'&&!field.modelOnly;let model=[root,0],clip=[root,1];
   let next=Math.max(...Object.keys(p).map(Number))+1;if(!Number.isSafeInteger(next))throw Error('A node-azonosítók nem alakíthatók át biztonságosan.');
   const existing=Object.keys(renderBranch(p,info.output)),inserted=[];
   for(const row of rows.filter(r=>r.on)){const id=String(next++);p[id]={class_type:full?'LoraLoader':'LoraLoaderModelOnly',inputs:{model,lora_name:row.name,strength_model:row.strength,...(full?{clip,strength_clip:row.clip??row.strength}:{})},_meta:{title:'Creator Hub · '+row.name}};model=[id,0];if(full)clip=[id,1];inserted.push(id);}
   for(const id of existing)if(id!==root)for(const[k,v]of Object.entries(p[id].inputs))if(Array.isArray(v)&&v[0]===root){if(v[1]===0)p[id].inputs[k]=model;else if(full&&v[1]===1)p[id].inputs[k]=clip;}
   // A source UI cannot display newly inserted nodes faithfully without rebuilding links.
   // Export the exact executable API graph instead of a stale visual workflow.
   delete bundle.workflow;delete bundle.widget_map;
  }
 }
 if(bundle.workflow){const editable=renderEditableCopy(renderBundle(raw),p);if(editable)bundle.workflow=editable;else{delete bundle.workflow;delete bundle.widget_map;}}
 return bundle;
}
export function compileRenderShot(raw,plan,imagePath,prefix){
 const info=inspectRenderSource(raw,plan.output),bundle=applyControls(raw,info,plan.controls),dims=renderDimensions(plan.width,plan.height);
 if(info.videoFamily==='ltx'){const p=renderBranch(bundle.prompt,info.output),{width:w2,height:h2,twoStage,...timing}=compileLTX(p,info,plan,imagePath,prefix,setScalar);return {prompt:renderBranch(p,info.output),workflow:null,timing,...dims,...(twoStage?{width:w2,height:h2,twoStage}:{}),output:info.output};}if(info.mode==='video')return compileVideoAtHub(bundle,plan,imagePath,prefix);
 if(!plan.prompt?.trim())throw Error('Írj képpromptot.');
 let p=renderBranch(bundle.prompt,info.output);
 for(const id of info.positive)for(const key of ['text','text_g','text_l'])if(key in p[id].inputs)setScalar(p,id,key,plan.prompt);
 for(const id of info.negativeNodes)for(const key of ['text','text_g','text_l'])if(key in p[id].inputs)setScalar(p,id,key,String(plan.negative||''));
 if(info.empty){setScalar(p,info.empty,'width',dims.width);setScalar(p,info.empty,'height',dims.height);if('batch_size' in p[info.empty].inputs)setScalar(p,info.empty,'batch_size',1);}
 if(info.imageLoader){if(!imagePath)throw Error('Ehhez a képes workflow-hoz kezdőkép szükséges.');p[info.imageLoader].inputs.image=imagePath;
  // Force uploaded img2img input through the explicit target-size core scaler.
  const id=String(Math.max(...Object.keys(bundle.prompt).map(Number))+1),from=info.imageLoader;
  for(const n of Object.values(p))for(const[k,v]of Object.entries(n.inputs))if(Array.isArray(v)&&v[0]===from&&v[1]===0)n.inputs[k]=[id,0];
  p[id]={class_type:'ImageScale',inputs:{image:[from,0],upscale_method:'lanczos',width:dims.width,height:dims.height,crop:'center'}};
 }
 if(plan.nameModel){const label=modelFilenameLabel(inspectRenderSource(bundle,info.output).models);if(label)prefix+='_'+label;}
 p[info.output].inputs.filename_prefix=prefix;p=renderBranch(p,info.output);
 return {prompt:p,workflow:renderEditableCopy(renderBundle(raw),p),timing:{frames:1,fps:0,seconds:0},...dims,output:info.output,prefix};
}
function compileVideoAtHub(bundle,plan,imagePath,prefix){
 const info=inspectRenderSource(bundle,plan.output),timing=h3RenderTiming(plan.duration),p=renderBranch(bundle.prompt,info.output),h3=p[info.h3].inputs;
 if(!plan.prompt?.trim())throw Error('Írj videópromptot.');delete h3.last_frame;h3.prompt=plan.prompt;h3.width=plan.width;h3.height=plan.height;h3.length=timing.frames;
 if(imagePath){const id=String(Math.max(...Object.keys(p).map(Number))+1);p[id]={class_type:'LoadImage',inputs:{image:imagePath}};h3.first_frame=[id,0];}else {if(info.needsImage)throw Error('Ehhez a videótervhez kezdőkép szükséges.');delete h3.first_frame;}
 for(const id of info.negativeNodes||[])for(const key of ['text','text_g','text_l'])if(key in p[id].inputs)setScalar(p,id,key,String(plan.negative||''));
 p[info.create].inputs.fps=24;p[info.output].inputs.filename_prefix=prefix;
 const prompt=renderBranch(p,info.output);return {prompt,workflow:renderEditableCopy(bundle,prompt),timing,width:plan.width,height:plan.height,output:info.output};
}

// Standard UI JSON import uses the backend's own declared widget order.
// Dynamic/custom widgets are accepted only for the explicit rgthree row format.
export function uiToBundle(raw,objects){
 if(!Array.isArray(raw?.nodes))return renderBundle(raw);
 if(!Array.isArray(raw.links)||raw.definitions?.subgraphs?.length)throw Error('Algráfos vagy új linkformátumú forrás: ments API JSON-t vagy Scene DNA workflow-forrást.');
 const prompt={},widget_map={},needed=new Set();
 const visit=id=>{if(needed.has(id))return;needed.add(id);const n=raw.nodes.find(n=>n.id===id);for(const i of n?.inputs||[]){const link=raw.links.find(l=>l[0]===i.link);if(link)visit(link[1]);}};
 for(const n of raw.nodes)if(['SaveImage','SaveVideo'].includes(n.type))visit(n.id);
 for(const n of raw.nodes.filter(n=>needed.has(n.id))){if(n.mode===2)continue;if(n.mode===4)throw Error('Bypass node van a forrásban. Használd a ComfyUI API exportját a pontos kapcsolatokhoz.');if(['Note','MarkdownNote'].includes(n.type))continue;
  const def=objects[n.type];if(!def)throw Error('Hiányzó node a háttérben: '+n.type);const inputs={},map={};let widgets=n.widgets_values;
  // 0.16 DEV: some frontends store a single-widget node (e.g. PrimitiveStringMultiline) as a bare value.
  if(widgets!==undefined&&widgets!==null&&!Array.isArray(widgets)&&['string','number','boolean'].includes(typeof widgets))widgets=[widgets];
  if(widgets!==undefined&&widgets!==null&&!Array.isArray(widgets))throw Error('Egyedi widgetelrendezés: ments API JSON-t.');let index=0;
  const fields={...def.input?.required,...def.input?.optional};const order=[...(def.input_order?.required||Object.keys(def.input?.required||{})),...(def.input_order?.optional||Object.keys(def.input?.optional||{}))];
  // 0.16 DEV: ComfyUI V3 nodes declare widgets as COMBO, typed unions ('FLOAT,INT' + widgetType) or DynamicCombo
  // (selector + dependent sub-widgets such as resize_type.longer_size). The frontend stores them in widgets_values in
  // socket order; the API expects flat dotted keys. Older catalogues (plain arrays / STRING / INT ...) behave as before.
  const isWidgetSpec=(spec,socket)=>Array.isArray(spec?.[0])||['STRING','INT','FLOAT','BOOLEAN','COMBO'].includes(spec?.[0])||!!spec?.[1]?.widgetType||!!socket?.widget&&spec?.[0]!=='COMFY_AUTOGROW_V3';
  // A current frontend lists every widget as a socket; an optional widget without a socket was not saved (older node version).
  const modern=!!n.inputs?.some(i=>i.widget);
  const take=(key,spec,required)=>{if(index>=(widgets?.length||0)){if(required)throw Error('Hiányzó widget: '+n.type+' / '+key);return false;}map[key]=index;inputs[key]=structuredClone(widgets[index++]);if(spec?.[1]?.control_after_generate)index++;return true;};
  const field=(key,spec,required)=>{const socket=n.inputs?.find(i=>i.name===key);const link=socket?.link!=null?raw.links.find(l=>l[0]===socket.link):null;const dynamic=spec?.[0]==='COMFY_DYNAMICCOMBO_V3';const isWidget=dynamic||isWidgetSpec(spec,socket);
   if(link){inputs[key]=[String(link[1]),link[2]];if(isWidget&&socket.widget){map[key]=index++;if(spec?.[1]?.control_after_generate)index++;}return;}
   if(!isWidget)return;if(!required&&modern&&!socket)return;if(!take(key,spec,required))return;if(!dynamic)return;
   const choice=spec[1]?.options?.find(o=>o.key===inputs[key]);if(!choice){if(Array.isArray(spec[1]?.options))throw Error('Ismeretlen választás: '+n.type+' / '+key+' = '+inputs[key]);return;}
   for(const type of ['required','optional'])for(const [child,childSpec]of Object.entries(choice.inputs?.[type]||{})){const path=key+'.'+child;if(type==='optional'&&!n.inputs?.some(i=>i.name===path))continue;field(path,childSpec,type==='required');}
  };
  for(const key of order)field(key,fields[key],key in(def.input?.required||{}));
  // 0.16 DEV: dynamic (autogrow) sockets such as ComfyMathExpression values.a/values.b are not listed in the backend's
  // input order; keep their links so the helper keeps its operands instead of silently losing them.
  for(const socket of n.inputs||[]){if(socket.link==null||socket.name in inputs||!order.some(k=>socket.name.startsWith(k+'.')))continue;const link=raw.links.find(l=>l[0]===socket.link);if(link)inputs[socket.name]=[String(link[1]),link[2]];}
  if(n.type==='Power Lora Loader (rgthree)')for(let i=0;i<(widgets?.length||0);i++){const row=widgets[i];if(row&&typeof row==='object'&&typeof row.lora==='string'&&typeof row.on==='boolean'){const key='lora_'+(Object.keys(map).filter(k=>k.startsWith('lora_')).length+1);inputs[key]=structuredClone(row);map[key]=i;}}
  prompt[String(n.id)]={class_type:n.type,inputs,_meta:{title:n.title||n.type}};widget_map[String(n.id)]=map;
 }
 return renderBundle({prompt,workflow:raw,widget_map});
}
