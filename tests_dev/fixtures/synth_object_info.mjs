// Builds a stand-in ComfyUI /object_info from UI workflow JSON files (test-only).
import {readFileSync} from 'node:fs';
const CTRL=new Set(['PrimitiveInt:value','RandomNoise:noise_seed','KSampler:seed']);
export function synthObjects(files){
  const objects={};
  for(const f of files){const raw=JSON.parse(readFileSync(f,'utf8'));
    for(const n of raw.nodes){if(['Note','MarkdownNote'].includes(n.type))continue;if(objects[n.type])continue;
      const required={},order=[];
      for(const i of n.inputs||[]){let spec;
        if(i.widget){const t=i.type;spec=t==='COMBO'?[['x']]:['INT','FLOAT','STRING','BOOLEAN'].includes(t)?[t,{}]:[t,{}];if(CTRL.has(n.type+':'+i.name))spec=[spec[0],{control_after_generate:true}];}
        else spec=[i.type,{}];
        required[i.name]=spec;order.push(i.name);}
      // Real ComfyUI declares ComfyMathExpression inputs as one autogrow group, not as values.a/values.b.
      if(n.type==='ComfyMathExpression'){objects[n.type]={input:{required:{values:['COMFY_AUTOGROW_V3',{}],expression:['STRING',{}]}},input_order:{required:['values','expression']}};continue;}
      objects[n.type]={input:{required},input_order:{required:order}};}
  }
  return objects;
}
