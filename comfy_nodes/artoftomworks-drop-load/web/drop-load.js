// ArtofTomworks · Drop-to-load: a file dropped onto a Load Image / Load Video node goes INTO that node.
// Runs in the capture phase before ComfyUI's and rgthree's own drop handlers, and only when the drop
// lands on such a node with a matching file type; every other drop behaves exactly as before.
import {app} from '../../scripts/app.js';
import {api} from '../../scripts/api.js';

const IMAGE=/^image\//i, VIDEO=/^video\//i;
const fileWidget=node=>(node?.widgets||[]).find(w=>['image','video','file'].includes(w.name)&&(w.type==='combo'||Array.isArray(w.options?.values)));
const accepts=(node,file)=>{
  const w=fileWidget(node);if(!w)return false;
  const t=String(node.comfyClass||node.type||'');
  if(IMAGE.test(file.type))return w.name==='image'||/image/i.test(t);
  if(VIDEO.test(file.type))return w.name==='video'||w.name==='file'&&/video/i.test(t)||/video/i.test(t);
  return false;
};
function nodeAt(e){
  const el=e.target?.closest?.('[data-node-id]');
  if(el){const n=app.graph?.getNodeById?.(Number(el.dataset.nodeId))||app.graph?.getNodeById?.(el.dataset.nodeId);if(n)return n;}
  const c=app.canvas;if(!c?.graph)return null;
  const pos=c.convertEventToCanvasOffset?c.convertEventToCanvasOffset(e):null;if(!pos)return null;
  const hit=c.graph.getNodeOnPos?.(pos[0],pos[1]);if(hit)return hit;
  // fallback: plain geometry (bounding boxes are only filled after a draw)
  const title=(window.LiteGraph||window.comfyAPI?.litegraph?.LiteGraph)?.NODE_TITLE_HEIGHT||30,nodes=c.graph._nodes||c.graph.nodes||[];
  for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(n.flags?.collapsed)continue;const [x,y]=n.pos,[w,h]=n.size;if(pos[0]>=x&&pos[0]<=x+w&&pos[1]>=y-title&&pos[1]<=y+h)return n;}
  return null;
}
async function upload(file){
  const body=new FormData();body.append('image',file,file.name);body.append('type','input');body.append('overwrite','false');
  const r=await api.fetchApi('/upload/image',{method:'POST',body});if(r.status!==200)throw Error('Upload failed: '+r.status+' '+r.statusText);
  const j=await r.json();return j.subfolder?j.subfolder+'/'+j.name:j.name;
}
async function put(node,file){
  const w=fileWidget(node),name=await upload(file);
  const values=w.options?.values;if(Array.isArray(values)&&!values.includes(name))values.push(name);
  w.value=name;w.callback?.(name,app.canvas,node);node.onWidgetChanged?.(w.name,name,null,w);
  node.setDirtyCanvas?.(true,true);app.graph?.setDirtyCanvas?.(true,true);
}
function onDrop(e){
  const files=[...(e.dataTransfer?.files||[])];if(files.length!==1)return;
  const node=nodeAt(e);if(!node||!accepts(node,files[0]))return;
  e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
  put(node,files[0]).catch(err=>{console.error('[ArtofTomworks drop-load]',err);try{app.extensionManager?.toast?.add({severity:'error',summary:'ArtofTomworks',detail:String(err.message||err),life:5000});}catch{}});
}
app.registerExtension({name:'ArtofTomworks.DropLoad',setup(){window.addEventListener('drop',onDrop,{capture:true});}});
