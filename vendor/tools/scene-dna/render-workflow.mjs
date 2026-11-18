// H3 execution copies. Never mutate the source graph or guess a custom layout.
import {createHash} from 'node:crypto';
export const renderHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const renderClone=value=>structuredClone(value);
export function backendURL(value){
 const u=new URL(value);if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||u.username||u.password||u.search||u.hash||!['/','/ComfyBackendDirect/','/ComfyBackendDirect'].includes(u.pathname))throw Error('Use a local ComfyUI address, for example http://127.0.0.1:7801/ComfyBackendDirect.');
 return u.origin+u.pathname.replace(/\/$/,'');
}
export function renderBundle(raw){
 const prompt=raw?.prompt||raw?.output||raw;
 if(!prompt||typeof prompt!=='object'||Array.isArray(prompt)||prompt.nodes||!Object.keys(prompt).length||Object.keys(prompt).length>1500)throw Error('Load an API workflow, or use ComfyUI: right-click canvas → Scene DNA → Save workflow source. A Scene DNA project is not a generator workflow.');
 for(const [id,n]of Object.entries(prompt))if(!/^\d+$/.test(id)||!n||typeof n.class_type!=='string'||!n.inputs||Array.isArray(n.inputs)||typeof n.inputs!=='object')throw Error('Unsupported API workflow layout. Capture the source from ComfyUI.');
 if(Buffer.byteLength(JSON.stringify(prompt))>3*1024**2)throw Error('Workflow limit: 3 MiB.');
 const result={prompt:renderClone(prompt)};
 if(raw.workflow&&Array.isArray(raw.workflow.nodes)&&Array.isArray(raw.workflow.links)&&!raw.workflow.definitions?.subgraphs?.length&&Buffer.byteLength(JSON.stringify(raw.workflow))<=3*1024**2){result.workflow=renderClone(raw.workflow);result.widget_map=renderClone(raw.widget_map||{});}
 return result;
}
export function renderBranch(prompt,output){
 const found=new Set(),visiting=new Set();function visit(id){if(found.has(id))return;if(visiting.has(id))throw Error('Cyclic workflow.');const n=prompt[id];if(!n)throw Error('Missing workflow connection: '+id);visiting.add(id);for(const v of Object.values(n.inputs))if(Array.isArray(v)&&v.length===2&&typeof v[0]==='string'&&Number.isInteger(v[1]))visit(v[0]);visiting.delete(id);found.add(id);}visit(output);
 return Object.fromEntries(Object.entries(prompt).filter(([id])=>found.has(id)).map(([id,n])=>[id,renderClone(n)]));
}
export function inspectRenderSource(raw,output){
 const {prompt}=renderBundle(raw),outputs=Object.entries(prompt).filter(([,n])=>n.class_type==='SaveVideo').map(([id,n])=>({id,label:n._meta?.title||'SaveVideo · '+id}));
 if(!outputs.length)throw Error('This first version needs a standard H3 → CreateVideo → SaveVideo workflow.');
 if(!output&&outputs.length!==1)throw Error('Choose one saved-video output.');output=output||outputs[0].id;if(!outputs.some(v=>v.id===output))throw Error('Unknown saved-video output.');
 const branch=renderBranch(prompt,output),h3=Object.entries(branch).filter(([,n])=>n.class_type==='MiniMaxH3ImageToVideo'),creates=Object.entries(branch).filter(([,n])=>n.class_type==='CreateVideo');
 if(h3.length!==1||creates.length!==1)throw Error('Use a Simple/Pro H3 source with one MiniMaxH3ImageToVideo and one CreateVideo on the selected output. LTX and other families are not supported by this runner yet.');
 if(Object.values(branch).some(n=>n.class_type==='MiniMaxH3AddGuide'))throw Error('This source contains guide frames from another plan. Capture a clean Simple/Pro H3 workflow first.');
 function scalar(v,seen=new Set()){if(!Array.isArray(v))return v;const [id]=v;if(seen.has(id))return null;seen.add(id);const n=branch[id];return n&&['PrimitiveInt','PrimitiveFloat','PrimitiveString','PrimitiveStringMultiline'].includes(n.class_type)?scalar(n.inputs.value,seen):null;}
 const settings=h3[0][1].inputs;
 const models=Object.values(branch).filter(n=>['UNETLoader','CheckpointLoaderSimple'].includes(n.class_type)).map(n=>n.inputs.unet_name||n.inputs.ckpt_name).filter(v=>typeof v==='string');
 const loras=[];for(const n of Object.values(branch)){if(['LoraLoader','LoraLoaderModelOnly'].includes(n.class_type))loras.push({name:n.inputs.lora_name,strength:n.inputs.strength_model,clip:n.inputs.strength_clip});if(n.class_type==='Power Lora Loader (rgthree)')for(const row of Object.values(n.inputs))if(row&&typeof row==='object'&&!Array.isArray(row)&&row.on===true&&typeof row.lora==='string')loras.push({name:row.lora,strength:row.strength,clip:row.strengthTwo??row.strength});}
 return {output,outputs,h3:h3[0][0],create:creates[0][0],family:'H3',width:scalar(settings.width),height:scalar(settings.height),models,loras,sourceHash:renderHash(prompt)};
}
export function h3RenderTiming(seconds){if(!Number.isFinite(seconds)||seconds<1||seconds>15)throw Error('H3 shot length must be between 1 and 15 seconds.');const frames=Math.max(5,5+Math.floor((seconds*24-5)/17+.5)*17);return {frames,fps:24,seconds:frames/24};}
export function renderDimensions(width,height){if(![width,height].every(v=>Number.isInteger(v)&&v>=256&&v<=2048&&v%32===0)||width*height>2097152)throw Error('Choose multiples of 32 between 256 and 2048; maximum 2 megapixels per frame.');return {width,height};}
export function compileRenderShot(raw,plan,imagePath,prefix){
 const info=inspectRenderSource(raw,plan.output),timing=h3RenderTiming(plan.duration),dims=renderDimensions(plan.width,plan.height);
 if(typeof plan.prompt!=='string'||!plan.prompt.trim()||plan.prompt.length>24000)throw Error('A non-empty video prompt is required (maximum 24,000 characters).');
 if(typeof imagePath!=='string'||!/^SceneDNA\/[a-f0-9]{32}\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(imagePath))throw Error('Invalid prepared image path.');
 if(!/^ArtofTomworks\/SceneDNA\/[a-f0-9]{32}\/Shot_\d{2}/.test(prefix))throw Error('Invalid output prefix.');
 let prompt=renderBranch(renderBundle(raw).prompt,info.output);const h3=prompt[info.h3].inputs;
 // Each DNA card is one independent shot. Old end-image inputs never leak in.
 delete h3.last_frame;h3.prompt=plan.prompt;h3.width=dims.width;h3.height=dims.height;h3.length=timing.frames;
 const uiIds=raw.workflow?.nodes?.map(n=>Number(n.id)).filter(Number.isFinite)||[];const id=String(Math.max(...Object.keys(prompt).map(Number),...uiIds)+1);prompt[id]={class_type:'LoadImage',inputs:{image:imagePath},_meta:{title:'Scene DNA · shot start image'}};h3.first_frame=[id,0];
 prompt[info.create].inputs.fps=24;prompt[info.output].inputs.filename_prefix=prefix;
 prompt=renderBranch(prompt,info.output);
 if(Object.values(prompt).some(n=>n.class_type==='LoadImage'&&n.inputs.image!==imagePath))throw Error('This source has additional image branches. Use a standard Simple/Pro graph without other image references.');
 return {prompt,workflow:renderEditableCopy(renderBundle(raw),prompt),timing,...dims,output:info.output};
}
// Keep captured custom-widget rows verbatim. Unknown layouts fall back to API JSON.
export function renderEditableCopy(bundle,prompt){
 if(!bundle.workflow)return null;
 try{
  const w=renderClone(bundle.workflow);if(w.nodes.some(n=>!Number.isInteger(n.id))||w.links.some(l=>!Array.isArray(l)||l.length!==6))return null;
  const by=new Map(w.nodes.map(n=>[String(n.id),n])),keep=new Set(Object.keys(prompt));let nextId=Math.max(...w.nodes.map(n=>n.id),...Object.keys(prompt).map(Number))+1,nextLink=Math.max(0,...w.links.map(l=>l[0]))+1;
  w.nodes=w.nodes.filter(n=>keep.has(String(n.id))||n.type==='Note');w.links=w.links.filter(l=>keep.has(String(l[1]))&&keep.has(String(l[3])));
  const newNodes=[];const make=(id,type,widgets,kind,title)=>{const n={id:Number(id),type,pos:[100+(newNodes.length%3)*460,Math.max(0,...w.nodes.map(n=>Number(n.pos?.[1])||0))+550],size:[410,180],flags:{},order:w.nodes.length,mode:0,inputs:[],outputs:kind==='IMAGE'?[{name:'IMAGE',type:'IMAGE',links:[]},{name:'MASK',type:'MASK',links:[]}]:[{name:kind,type:kind,links:[]}],properties:{'Node name for S&R':type},widgets_values:widgets,title};w.nodes.push(n);newNodes.push(n);by.set(String(id),n);return n;};
  function connect(target,key,value,kind){let slot=target.inputs?.findIndex(i=>i.name===key)??-1;if(slot<0){target.inputs=target.inputs||[];target.inputs.push({name:key,type:kind,widget:{name:key},link:null});slot=target.inputs.length-1;}w.links=w.links.filter(l=>!(String(l[3])===String(target.id)&&l[4]===slot));const link=nextLink++;target.inputs[slot].link=link;w.links.push([link,Number(value[0]),value[1],target.id,slot,kind]);}
  for(const[id,n]of Object.entries(prompt))if(!by.has(id)){if(n.class_type!=='LoadImage')return null;make(id,'LoadImage',[n.inputs.image,'image'],'IMAGE','Scene DNA · start image');}
  for(const[id,n]of Object.entries(prompt)){const ui=by.get(id),old=bundle.prompt[id];if(!old)continue;if(ui.type!==n.class_type)return null;
   for(const key of Object.keys(old.inputs))if(!(key in n.inputs)){const slot=ui.inputs?.findIndex(i=>i.name===key);if(slot>=0){w.links=w.links.filter(l=>!(String(l[3])===id&&l[4]===slot));ui.inputs[slot].link=null;}}
   for(const[key,value]of Object.entries(n.inputs)){if(JSON.stringify(value)===JSON.stringify(old.inputs[key]))continue;
    if(Array.isArray(value)){if(key!=='first_frame')return null;connect(ui,key,value,'IMAGE');continue;}
    const index=bundle.widget_map?.[id]?.[key],widgets=ui.widgets_values;
    if(!Array.isArray(old.inputs[key])){if(!Array.isArray(widgets)||!Number.isInteger(index)||index<0||index>=widgets.length||JSON.stringify(widgets[index])!==JSON.stringify(old.inputs[key]))return null;widgets[index]=renderClone(value);continue;}
    const kind=typeof value==='string'?'STRING':Number.isInteger(value)&&key!=='fps'?'INT':'FLOAT',type={STRING:'PrimitiveStringMultiline',INT:'PrimitiveInt',FLOAT:'PrimitiveFloat'}[kind];const constant=make(nextId++,type,kind==='INT'?[value,'fixed']:[value],kind,'Scene DNA · '+key+': '+value);connect(ui,key,[String(constant.id),0],kind);if(Array.isArray(widgets)&&Number.isInteger(index)&&index>=0&&index<widgets.length)widgets[index]=value;
   }
  }
  const ids=new Set(w.nodes.map(n=>n.id));w.links=w.links.filter(l=>ids.has(l[1])&&ids.has(l[3]));for(const n of w.nodes){for(const output of n.outputs||[])output.links=[];for(const input of n.inputs||[])if(!w.links.some(l=>l[0]===input.link&&l[3]===n.id))input.link=null;}for(const l of w.links){const n=by.get(String(l[1]));if(!n?.outputs?.[l[2]])return null;n.outputs[l[2]].links.push(l[0]);}
  w.last_node_id=Math.max(...w.nodes.map(n=>n.id));w.last_link_id=Math.max(0,...w.links.map(l=>l[0]));w.extra={...(w.extra||{}),sceneDNA:{version:1}};return w;
 }catch{return null;}
}
