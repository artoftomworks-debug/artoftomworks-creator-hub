import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {metadataFamily} from './catalog.mjs';
export async function readAssetSource(file){
 const stem=file.slice(0,-path.extname(file).length);for(const candidate of [stem+'.cm-info.json',stem+'.civitai.info',file+'.civitai.info'])try{const actual=await realpath(candidate);if(path.dirname(actual)!==path.dirname(file)||(await stat(actual)).size>1024**2)continue;const d=JSON.parse(await readFile(actual,'utf8')),modelId=Number(d.ModelId??d.modelId??d.model?.id),versionId=Number(d.VersionId??d.modelVersionId??d.id);if(![modelId,versionId].every(v=>Number.isSafeInteger(v)&&v>0))continue;const hash=d.Hashes?.SHA256??d.hashes?.SHA256;return {provider:'civitai',modelId,versionId,version:String(d.VersionName??d.name??'').slice(0,160),family:metadataFamily({base_model:d.BaseModel??d.baseModel}),sha256:typeof hash==='string'&&/^[a-f0-9]{64}$/i.test(hash)?hash.toLowerCase():null,url:'https://civitai.com/models/'+modelId+'?modelVersionId='+versionId};}catch{}
 return null;
}
