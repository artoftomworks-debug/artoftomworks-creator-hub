// Observe only the runner's own Comfy client. Previews stay in bounded RAM,
// never in the project/run ledger and never trigger extra model decoding.
export function createRenderLive({Socket=globalThis.WebSocket,now=Date.now}={}){
 const entries=new Map();let closed=false;
 const active=j=>['submitting','queued','running','cancelling'].includes(j?.state);
 function dispose(e){clearTimeout(e.retry);clearTimeout(e.connectTimer);const socket=e.socket;e.socket=null;socket?.close();}
 function entry(run,job){let e=entries.get(run.id);if(!e||e.shotId!==job.shotId||e.promptId!==job.promptId){if(e)dispose(e);e={runId:run.id,shotId:job.shotId,promptId:job.promptId,connected:false,armed:false,sequence:0,updated:0,node:'',nodeType:'',phase:'waiting',step:null,total:null,preview:null,run,job};entries.set(run.id,e);}e.run=run;e.job=job;return e;}
 function node(e,id){if(id===undefined||id===null)return;e.node=String(id).slice(0,100);e.nodeType=String(e.job.prompt?.[e.node]?.class_type||'').slice(0,180);e.phase=/SaveVideo|VideoCombine/i.test(e.nodeType)?'saving':/VAE.*Decode|Decode.*VAE|CreateVideo/i.test(e.nodeType)?'decoding':/Sampler|Sample|Guider/i.test(e.nodeType)?'sampling':/Loader|LoadModel/i.test(e.nodeType)?'loading':'processing';e.step=e.total=null;}
 function progress(e,value,max){if(Number.isFinite(value)&&Number.isFinite(max)&&max>0&&value>=0&&value<=max){e.step=value;e.total=max;e.updated=now();}}
 function preview(e,bytes,mime){if(!e.armed||!active(e.job)||bytes.length<8||bytes.length>3*1024**2||!['image/jpeg','image/png','image/webp','video/mp4'].includes(mime))return;const valid=mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216:mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':bytes.toString('ascii',4,8)==='ftyp';if(!valid)return;e.sequence++;e.preview={bytes,mime,at:now(),sequence:e.sequence};e.updated=now();}
 function event(e,event){const data=event?.data||{};if(!active(e.job)||data.prompt_id&&data.prompt_id!==e.promptId)return;
  if(event.type==='execution_start'){if(data.prompt_id!==e.promptId)return;e.armed=true;e.phase='loading';e.updated=now();return;}
  if(event.type==='executing'){if(data.node===null){e.phase='finishing';return;}if(data.prompt_id===e.promptId||['running','queued'].includes(e.job.state)){e.armed=true;node(e,data.node);e.updated=now();}return;}
  if(!e.armed)return;
  if(event.type==='progress'){if(data.node&&String(data.node)!==e.node)node(e,data.node);progress(e,data.value,data.max);return;}
  if(event.type==='progress_state'){const running=Object.entries(data.nodes||{}).filter(([,v])=>v.state==='running');const item=running.find(([id])=>id===e.node)||running.at(-1);if(item){if(item[0]!==e.node)node(e,item[0]);progress(e,item[1].value,item[1].max);}return;}
  if(event.type==='kj_preview_override'){const id=String(data.node_id??'');if(!Object.hasOwn(e.job.prompt||{},id))return;progress(e,data.step,data.total);if(typeof data.image==='string'&&data.image.length<=4*1024**2&&/^[A-Za-z0-9+/]*={0,2}$/.test(data.image))preview(e,Buffer.from(data.image,'base64'),data.mime||'image/jpeg');}
 }
 async function message(e,data){try{if(typeof data==='string'){if(data.length>5*1024**2)return;event(e,JSON.parse(data));return;}const bytes=Buffer.from(data instanceof Blob?await data.arrayBuffer():data);if(bytes.length<8||bytes.length>3*1024**2+65544)return;const type=bytes.readUInt32BE(0);if(type===1)preview(e,bytes.subarray(8),bytes.readUInt32BE(4)===2?'image/png':'image/jpeg');else if(type===4){const length=bytes.readUInt32BE(4);if(length>65536||8+length>=bytes.length)return;const metadata=JSON.parse(bytes.toString('utf8',8,8+length));if(metadata.prompt_id&&metadata.prompt_id!==e.promptId)return;if(metadata.node_id&&!Object.hasOwn(e.job.prompt||{},String(metadata.node_id)))return;preview(e,bytes.subarray(8+length),metadata.image_type);}}catch{/* Unsupported/malformed previews never stop the run. */}}
 async function watch(run,job){if(closed||!Socket||!active(job))return;for(const[id,e]of entries)if(id!==run.id){dispose(e);entries.delete(id);}const e=entry(run,job);if(e.socket)return;
  try{const url=new URL(run.backend+'/ws');url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('clientId','scene-dna-'+run.id);const socket=new Socket(url);socket.binaryType='arraybuffer';e.socket=socket;
   socket.addEventListener('open',()=>{if(e.socket!==socket)return;clearTimeout(e.connectTimer);e.connected=true;e.updated=now();try{socket.send(JSON.stringify({type:'feature_flags',data:{supports_preview_metadata:true}}));}catch{e.connected=false;}});
   socket.addEventListener('message',m=>{if(e.socket===socket)void message(e,m.data);});
   const lost=()=>{if(e.socket!==socket)return;e.connected=false;e.socket=null;clearTimeout(e.connectTimer);if(!closed&&active(e.job))e.retry=setTimeout(()=>void watch(e.run,e.job),2000);};
   socket.addEventListener('close',lost);socket.addEventListener('error',()=>{socket.close();lost();});e.connectTimer=setTimeout(()=>{if(!e.connected){socket.close();lost();}},3000);
   // Attach before submission when possible, but absence of a preview channel
   // must never queue twice, block generation or misreport its state.
   await new Promise(resolve=>{if(e.connected)return resolve();const timer=setTimeout(resolve,350);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});});
  }catch{e.connected=false;e.socket=null;}
 }
 function snapshot(run){const e=entries.get(run.id);if(!e)return null;if(!active(e.job)&&e.socket){dispose(e);e.connected=false;}return {shotId:e.shotId,promptId:e.promptId,connected:e.connected,node:e.node,nodeType:e.nodeType,phase:e.phase,step:e.step,total:e.total,updated:e.updated,preview:e.preview?{sequence:e.preview.sequence,mime:e.preview.mime,at:e.preview.at}:null};}
 function media(runId,shotId){const e=entries.get(runId);if(e?.shotId!==shotId||!e.preview)return null;return e.preview;}
 return {watch,snapshot,media,close(){closed=true;for(const e of entries.values())dispose(e);entries.clear();}};
}
