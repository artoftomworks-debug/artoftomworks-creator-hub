import {lstat,realpath,writeFile,rename,unlink,link,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export const PREVIEW_LIMIT=8*1024**2;
export function previewExtension(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>PREVIEW_LIMIT)throw Error('Legfeljebb 8 MiB-os PNG, JPEG vagy WebP bélyegkép szükséges.');
 if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.length>=33&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0)return '.png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217)return '.jpg';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length)return '.webp';
 throw Error('A forrás nem használható PNG, JPEG vagy WebP képet adott.');
}
export async function writeAssetPreview(model,bytes,{custom=false}={}){
 const ext=previewExtension(bytes),actual=await realpath(model),info=await lstat(model);
 if(actual!==model||!info.isFile()||info.isSymbolicLink())throw Error('A modellfájl helye megváltozott. Frissítsd a készlettárat.');
 // Uploaded images are normalized by the browser to one consistent JPEG name.
 if(custom&&ext!=='.jpg')throw Error('A saját bélyegképet JPEG formában küldd.');
 const stem=model.slice(0,-path.extname(model).length),target=stem+(custom?'.hub-preview':'.preview')+ext;
 try{const old=await lstat(target);if(!custom)return {saved:false,existing:true};if(old.isSymbolicLink()||!old.isFile())throw Error('A bélyegkép helyén nem szabályos fájl van.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=path.join(path.dirname(model),'.creator-hub-preview-'+randomUUID()+'.tmp');
 try{await writeFile(temp,bytes,{flag:'wx'});if(custom)await rename(temp,target);else try{await link(temp,target);}catch(e){if(e.code==='EEXIST')return {saved:false,existing:true};if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw e;await copyFile(temp,target,constants.COPYFILE_EXCL);}return {saved:true,path:target};}
 finally{await unlink(temp).catch(()=>{});}
}
