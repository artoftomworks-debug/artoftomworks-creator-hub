import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleAutomaticModels,automaticAssetMatches} from '../automatic-ui.mjs';

const rows=[
 {id:'checkpoints|same.safetensors',name:'same.safetensors',type:'CheckpointLoaderSimple',family:'h3',supported:false,status:'unsupported'},
 {id:'diffusion_models|same.safetensors',name:'same.safetensors',type:'UNETLoader',family:'h3',supported:true,status:'ready'}
];
test('the automatic chooser shows the usable loader instead of a misleading unsupported duplicate, preserving explicit old selections',()=>{
 assert.deepEqual(visibleAutomaticModels(rows).map(m=>m.id),[rows[1].id]);
 assert.equal(visibleAutomaticModels(rows,rows[0].id).length,2,'an old blocked selection keeps its own explanation visible');
 assert.equal(visibleAutomaticModels([rows[0]]).length,1,'a missing alternative is not hidden');
 assert.equal(visibleAutomaticModels([rows[0],{...rows[1],family:'ltx'}]).length,2,'same filename does not merge different families');
 assert.equal(visibleAutomaticModels([{...rows[0],supported:true},rows[1]]).length,2,'two genuinely supported choices remain distinct');
});
test('local asset selection resolves by its actual loader kind instead of failing on checkpoint/diffusion name duplication',()=>{
 assert.deepEqual(automaticAssetMatches(rows,{path:'C:\\Models\\DiffusionModels\\same.safetensors',kind:'diffusion'}).map(m=>m.id),[rows[1].id]);
 assert.deepEqual(automaticAssetMatches(rows,{path:'C:\\Models\\StableDiffusion\\same.safetensors',kind:'checkpoint'}).map(m=>m.id),[rows[0].id]);
 assert.equal(automaticAssetMatches(rows,{path:'C:\\Models\\other.safetensors',kind:'diffusion'}).length,0);
});
