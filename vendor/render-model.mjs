export function renderPlanText(data){return JSON.stringify({projectId:data.projectId,title:data.title,backend:data.backend,source:data.source,output:data.output,width:data.width,height:data.height,shots:data.shots});}
// Completed jobs can be reused without moving or regenerating their video.
// Infer provenance for older ledgers too, from the exact saved output folder.
export function renderResultLocations(run){
 const files=[];for(const job of run?.jobs||[])for(const result of job.results||[]){const folder=String(result.subfolder||'').replaceAll('\\','/'),sourceRun=folder.match(/(?:^|\/)ArtofTomworks\/SceneDNA\/([a-f0-9]{32})(?:\/|$)/)?.[1];files.push({shotId:job.shotId,number:job.number,title:job.title,path:[folder,result.filename].filter(Boolean).join('/'),folder,reused:!!sourceRun&&sourceRun!==run.id});}
 return {files,folders:[...new Set(files.map(f=>f.folder))],reusedShots:[...new Set(files.filter(f=>f.reused).map(f=>f.shotId))]};
}
export function imageOrientation(width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid image dimensions.');return width/height>1.05?'landscape':height/width>1.05?'portrait':'square';}
export function followRenderOrientation(width,height,imageWidth,imageHeight){
 const target=imageOrientation(width,height),source=imageOrientation(imageWidth,imageHeight);
 if(target===source)return {width,height};
 if(source==='square')return {width:Math.min(width,height),height:Math.min(width,height)};
 if(target!=='square')return {width:height,height:width};
 const long=Math.max(width,height),short=Math.max(256,Math.round(long/(Math.max(imageWidth,imageHeight)/Math.min(imageWidth,imageHeight))/32)*32);
 return source==='landscape'?{width:long,height:short}:{width:short,height:long};
}
// Comfy errors also contain complete tensor inputs. Keep the cause and trace,
// never stringify the entire event and truncate away its useful beginning.
export function renderExecutionError(messages){
 const events=Array.isArray(messages)?messages:[];
 const event=events.find(v=>Array.isArray(v)&&v[0]==='execution_error')||events.find(v=>Array.isArray(v)&&v[0]==='execution_interrupted');
 const raw=event?.[1];
 if(!raw||typeof raw!=='object')return {message:'ComfyUI execution failed. No detailed error was returned.',nodeId:'',nodeType:'',traceback:'',memory:false};
 const clean=(v,n)=>typeof v==='string'?v.replace(/\u001b\[[0-9;]*m/g,'').slice(0,n):'';
 const message=clean(raw.exception_message,3000)||clean(raw.exception_type,300)||'ComfyUI execution interrupted.';
 const traceback=Array.isArray(raw.traceback)?raw.traceback.filter(v=>typeof v==='string').map(v=>clean(v,2000)).join('\n').slice(0,14000):clean(raw.traceback,14000);
 return {message,nodeId:String(raw.node_id??'').slice(0,100),nodeType:clean(raw.node_type,180),traceback,memory:/out.of.memory|CUDA_ERROR_OUT_OF_MEMORY|cudaErrorMemoryAllocation/i.test(message+'\n'+traceback)};
}
export function validateRenderSettings(raw,shotIds=[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid rendering settings.');
 const out={backend:'http://127.0.0.1:7801/ComfyBackendDirect',width:1024,height:576,trial:true,promptMode:'original',selected:[],runId:'',images:{}};
 if(raw.followImageOrientation!==undefined){if(typeof raw.followImageOrientation!=='boolean')throw Error('Invalid image orientation option.');out.followImageOrientation=raw.followImageOrientation;}
 if(raw.promptMode!==undefined){if(!['original','displayed'].includes(raw.promptMode))throw Error('Invalid render prompt choice.');out.promptMode=raw.promptMode;}
 if(raw.backend!==undefined){if(typeof raw.backend!=='string'||raw.backend.length>200)throw Error('Invalid backend address.');out.backend=raw.backend;}
 for(const k of ['width','height'])if(raw[k]!==undefined){if(!Number.isInteger(raw[k])||raw[k]<256||raw[k]>2048||raw[k]%32)throw Error('Invalid render dimensions.');out[k]=raw[k];}
 if(raw.trial!==undefined){if(typeof raw.trial!=='boolean')throw Error('Invalid test option.');out.trial=raw.trial;}
 if(raw.selected!==undefined){if(!Array.isArray(raw.selected)||raw.selected.length>6||raw.selected.some(v=>typeof v!=='string'))throw Error('Invalid shot selection.');out.selected=[...new Set(raw.selected)].filter(v=>shotIds.includes(v));}
 if(raw.runId){if(typeof raw.runId!=='string'||!/^[a-f0-9]{32}$/.test(raw.runId))throw Error('Invalid render run.');out.runId=raw.runId;}
 if(raw.source){const prompt=raw.source.prompt;if(!prompt||typeof prompt!=='object'||Array.isArray(prompt)||Object.keys(prompt).length>1500||JSON.stringify(prompt).length>3*1024**2)throw Error('Invalid generator source.');for(const n of Object.values(prompt))if(!n||typeof n.class_type!=='string'||!n.inputs||typeof n.inputs!=='object')throw Error('Invalid generator node.');out.source=structuredClone(raw.source);}
 if(raw.output!==undefined){if(typeof raw.output!=='string'||raw.output.length>100)throw Error('Invalid output selection.');out.output=raw.output;}
 if(raw.images){for(const id of shotIds){const v=raw.images[id];if(v!==undefined){if(typeof v!=='string'||v.length>12*1024**2||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))throw Error('Invalid generation image.');out.images[id]=v;}}}
 return out;
}
// ZIP "stored" format: one download, no external library or compression dependency.
export function renderZip(files){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0;const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 function header(size){const b=new Uint8Array(size);return[b,new DataView(b.buffer)];}
 for(const file of files){const name=enc.encode(file.name),data=enc.encode(file.content),checksum=crc(data),[local,l]=header(30);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,checksum,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);chunks.push(local,name,data);const[c,v]=header(46);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,checksum,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);central.push(c,name);offset+=local.length+name.length+data.length;}
 const size=central.reduce((n,b)=>n+b.length,0),[end,e]=header(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
