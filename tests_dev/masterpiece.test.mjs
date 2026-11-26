import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';
import {createHistory,resultID} from '../history.mjs';
const base=path.resolve('./tests/.runtime');
test('♛ Remekmű: korona → ★ + 5; 5 alatti értékelés vagy a ★ levétele a koronát is leveszi; szűrés',async()=>{
 await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'crown-')),output=path.join(root,'output'),dir=path.join(root,'data','runs');
 try{await mkdir(output);await mkdir(dir,{recursive:true});const h=createHistory({root}),backend='http://127.0.0.1:7821';await h.configure({backend,outputRoot:output});
  const add=async n=>{const id=n.toString(16).padStart(32,'0'),filename=n+'.png';await writeFile(path.join(output,filename),'x'+n);await writeFile(path.join(dir,id+'.json'),JSON.stringify({schema:'artoftomworks.scene-dna.run',id,created:1000+n,backend,title:'F',jobs:[{mode:'image',shotId:'work',number:1,state:'complete',width:64,height:64,results:[{filename,subfolder:'',type:'output'}]}]}));h.invalidate();return resultID(id,'work',0);};
  const a=await add(1),b=await add(2);
  let e=await h.annotate({id:a,masterpiece:true});assert.deepEqual([e.masterpiece,e.favorite,e.rating],[true,true,5]);
  assert.deepEqual((await h.list({rating:'masterpiece'})).items.map(x=>x.id),[a]);
  e=await h.annotate({id:a,masterpiece:false});assert.deepEqual([e.masterpiece,e.favorite,e.rating],[false,true,5],'a korona levétele a ★-ot és az 5-öst meghagyja');
  await h.annotate({id:a,masterpiece:true});e=await h.annotate({id:a,rating:4});assert.deepEqual([e.masterpiece,e.rating],[false,4]);
  await h.annotate({id:b,masterpiece:true});e=await h.annotate({id:b,favorite:false});assert.deepEqual([e.masterpiece,e.favorite],[false,false]);
  await assert.rejects(h.annotate({id:a,masterpiece:'yes'}));
 }finally{await rm(root,{recursive:true,force:true});}
});
