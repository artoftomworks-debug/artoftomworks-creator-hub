const dynamic=spec=>spec?.[0]==='COMFY_DYNAMICCOMBO_V3';
const options=spec=>Array.isArray(spec?.[0])?spec[0]:spec?.[1]?.options?.map(o=>o.key)||[];
const fail=field=>{throw Error('A videó mentési beállítása nem érvényes a telepített ComfyUI-ban: '+field+'. Válassz támogatott formátumot / kodeket.');};
// DynamicCombo API requests use flat selector paths. ComfyUI reconstructs the
// nested execute() dictionaries itself; sending those dictionaries drops inputs.
export function normalizeVideoOutputs(prompt,objects){let changed=false;
 for(const node of Object.values(prompt)){if(node.class_type!=='SaveVideo')continue;const schema=objects.SaveVideo?.input,format=schema?.required?.format;if(!format)continue;const before=JSON.stringify(node.inputs),input=node.inputs;
  if(dynamic(format)){
   const original=input.format,raw=original&&typeof original==='object'&&!Array.isArray(original)?original:{format:original};if(raw.format===undefined)raw.format=options(format).includes('mp4')?'mp4':options(format).includes('auto')?'auto':undefined;
   if(input.codec!==undefined&&raw.codec===undefined)raw.codec=input.codec;
   const flattened={};function visit(spec,path,value,required=true){const key=path.split('.').at(-1);if(dynamic(spec)){const obj=value&&typeof value==='object'&&!Array.isArray(value)?value:{[key]:value};let selected=obj[key]??input[path];if(selected===undefined){if(!required)return;selected=options(spec).includes('auto')?'auto':options(spec)[0];}if(typeof selected!=='string'||!options(spec).includes(selected))fail(path);flattened[path]=selected;const branch=spec[1].options.find(o=>o.key===selected).inputs||{};for(const type of ['required','optional'])for(const [child,childSpec]of Object.entries(branch[type]||{})){const childPath=path+'.'+child,childValue=obj[child]??input[childPath];if(type==='optional'&&childValue===undefined)continue;visit(childSpec,childPath,childValue,type==='required');}}
    else{let next=value??input[path]??spec?.[1]?.default;if(next===undefined){if(!required)return;fail(path);}if(Array.isArray(spec?.[0])&&!spec[0].includes(next))fail(path);if(['INT','FLOAT'].includes(spec?.[0])&&(!Number.isFinite(next)||spec[0]==='INT'&&!Number.isInteger(next)||spec[1]?.min!==undefined&&next<spec[1].min||spec[1]?.max!==undefined&&next>spec[1].max))fail(path);flattened[path]=next;}}
   visit(format,'format',raw);for(const key of Object.keys(input))if(key==='format'||key.startsWith('format.')||key==='codec'||key.startsWith('codec.'))delete input[key];Object.assign(input,flattened);
  }else{const raw=input.format&&typeof input.format==='object'&&!Array.isArray(input.format)?input.format:null;if(raw){input.format=raw.format;input.codec=raw.codec?.codec??raw.codec??input.codec;}if(input.format===undefined)input.format=options(format).includes('mp4')?'mp4':'auto';if(options(format).length&&!options(format).includes(input.format))fail('format');const codec=schema.required?.codec||schema.optional?.codec;if(codec){if(input.codec&&typeof input.codec==='object'&&!Array.isArray(input.codec))input.codec=input.codec.codec;if(input.codec===undefined)input.codec=options(codec).includes('h264')?'h264':'auto';if(options(codec).length&&!options(codec).includes(input.codec))fail('codec');}}
  if(JSON.stringify(input)!==before)changed=true;
 }return changed;
}
export function validateVideoOutputs(prompt,objects){const copy=structuredClone(prompt);if(normalizeVideoOutputs(copy,objects))throw Error('A videómentő formátumát előbb a telepített ComfyUI-hoz kell igazítani. Készítsd elő újra a tervet.');}
