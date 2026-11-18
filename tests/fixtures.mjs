export const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR6kAAAAASUVORK5CYII=';
export const picture={prompt:{
 '1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:'fixture.safetensors'}},
 '2':{class_type:'LoraLoader',inputs:{model:['1',0],clip:['1',1],lora_name:'portrait.safetensors',strength_model:.8,strength_clip:.6}},
 '3':{class_type:'CLIPTextEncode',inputs:{clip:['2',1],text:'A lighthouse at sunset'}},
 '4':{class_type:'CLIPTextEncode',inputs:{clip:['2',1],text:'blurry'}},
 '5':{class_type:'EmptyLatentImage',inputs:{width:1024,height:576,batch_size:1}},
 '6':{class_type:'KSampler',inputs:{model:['2',0],positive:['3',0],negative:['4',0],latent_image:['5',0],seed:42,steps:20,cfg:7,sampler_name:'euler',scheduler:'normal',denoise:1}},
 '7':{class_type:'VAEDecode',inputs:{samples:['6',0],vae:['1',2]}},
 '8':{class_type:'SaveImage',inputs:{images:['7',0],filename_prefix:'old'}}}};
export const video={prompt:{
 '1':{class_type:'CLIPLoader',inputs:{clip_name:'fixture-text.safetensors'}},'2':{class_type:'VAELoader',inputs:{vae_name:'fixture-video.safetensors'}},'3':{class_type:'LoadImage',inputs:{image:'old.png'}},
 '4':{class_type:'MiniMaxH3ImageToVideo',inputs:{clip:['1',0],vae:['2',0],first_frame:['3',0],width:608,height:1088,length:90,prompt:'old'}},
 '5':{class_type:'UNETLoader',inputs:{unet_name:'fixture-dasiwa.safetensors'}},'6':{class_type:'Power Lora Loader (rgthree)',inputs:{model:['5',0],lora_1:{on:true,lora:'motion.safetensors',strength:.85,strengthTwo:.7}}},
 '7':{class_type:'SamplerFixture',inputs:{model:['6',0],positive:['4',0],latent:['4',1],seed:42}},
 '8':{class_type:'CreateVideo',inputs:{images:['7',0],fps:24}},'9':{class_type:'SaveVideo',inputs:{video:['8',0],filename_prefix:'old'}}}};
export const plan=(source=picture)=>({backend:'http://127.0.0.1:7821',source,projectId:'creator-hub',title:'Test',width:1024,height:576,shots:[{id:'work',title:'Test',prompt:'A calm seaside lighthouse',negative:'text',duration:2,image}]});
export function fakeBackend({mediaBytes=Buffer.from(image.split(',')[1],'base64'),mp4=mediaBytes}={}){
 let running=[],history={},other=false,uploads=0;const posts=[];
 const objects=Object.fromEntries([...Object.values(picture.prompt),...Object.values(video.prompt),{class_type:'ImageScale'}].map(n=>[n.class_type,{}]));
 objects.CheckpointLoaderSimple={input:{required:{ckpt_name:[['fixture.safetensors','alternate.safetensors','flux-only.safetensors','unknown.safetensors']]}}};
 objects.UNETLoader={input:{required:{unet_name:[['fixture-dasiwa.safetensors']]}}};
 objects.LoraLoader={input:{required:{lora_name:[['portrait.safetensors','detail.safetensors','flux-lora.safetensors','unknown-lora.safetensors','motion.safetensors']]}}};objects.LoraLoaderModelOnly={};
 objects.VAEEncodeForInpaint={input:{required:{pixels:['IMAGE'],vae:['VAE'],mask:['MASK'],grow_mask_by:['INT',{min:0,max:64}]}}};objects.ImageCompositeMasked={input:{required:{destination:['IMAGE'],source:['IMAGE'],x:['INT'],y:['INT'],resize_source:['BOOLEAN']},optional:{mask:['MASK']}}};
 objects.KSampler.input={required:{sampler_name:[['euler','dpmpp_2m']],scheduler:[['normal','simple','karras']]}};
 objects.CLIPLoader.input={required:{clip_name:[['qwen3vl_4b.safetensors','qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors','clip_l.safetensors','t5xxl_fp8_e4m3fn.safetensors']]}};
 objects.VAELoader.input={required:{vae_name:[['qwen_image_vae.safetensors','ae.safetensors','minimax_h3_video_vae_int8_convrot.safetensors','minimax_h3_audio_vae_fp32.safetensors']]}};
 for(const type of ['DualCLIPLoader','EmptySD3LatentImage','FluxGuidance','ModelSamplingFlux','VAEEncode','RandomNoise','CFGGuider','BasicScheduler','KSamplerSelect','SamplerCustomAdvanced','VAEDecodeAudio'])objects[type]||={};
 return {posts,objects,get uploads(){return uploads;},busy(value){other=value;},finish(){const [num,id,p]=running[0];const [output,n]=Object.entries(p).find(([,n])=>['SaveImage','SaveVideo'].includes(n.class_type));history[id]={status:{completed:true,status_str:'success'},outputs:{[output]:{[n.class_type==='SaveImage'?'images':'videos']:[{filename:n.class_type==='SaveImage'?'result.png':'result.mp4',subfolder:'ArtofTomworks/CreatorHub/test',type:'output'}]}}};running=[];},
 async fetchImpl(url,options={}){const u=new URL(url),data=typeof options.body==='string'?JSON.parse(options.body):{};
  if(u.pathname.endsWith('/object_info'))return Response.json(objects);
  if(u.pathname.includes('/view_metadata/')){const name=u.searchParams.get('filename'),families={'fixture.safetensors':'sdxl_base_v1-0','alternate.safetensors':'sdxl_base_v1-0','flux-only.safetensors':'flux.1-dev','portrait.safetensors':'sdxl_base_v1-0','detail.safetensors':'sdxl_base_v1-0','flux-lora.safetensors':'flux.1-dev','fixture-dasiwa.safetensors':'minimax-h3','motion.safetensors':'minimax-h3'};return families[name]?Response.json({'modelspec.architecture':families[name]}):new Response('',{status:404});}
  if(u.pathname.endsWith('/queue'))return Response.json({queue_running:other?[[0,'foreign',{},{}]]:running,queue_pending:[]});
  if(u.pathname.endsWith('/upload/image')){uploads++;return Response.json({name:options.body.get('image').name,subfolder:options.body.get('subfolder'),type:'input'});}
  if(u.pathname.includes('/history/')){const id=u.pathname.split('/').at(-1);return Response.json(history[id]?{[id]:history[id]}:{});}
  if(u.pathname.endsWith('/prompt')){posts.push(data);running=[[0,data.prompt_id,data.prompt,data.extra_data]];return Response.json({prompt_id:data.prompt_id});}
  if(u.pathname.endsWith('/artoftomworks_scene_dna/cancel')){if(data.prompt_id!==running[0]?.[1])throw Error('Foreign cancellation');running=[];return Response.json({state:'cancelled'});}
  if(u.pathname.endsWith('/view'))return new Response(u.searchParams.get('filename').endsWith('.mp4')?mp4:mediaBytes,{headers:{'Content-Type':u.searchParams.get('filename').endsWith('.mp4')?'video/mp4':'image/png'}});
  throw Error('Unexpected fixture request '+url);
 }
 };
}
