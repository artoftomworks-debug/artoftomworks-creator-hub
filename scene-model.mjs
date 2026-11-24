export function sceneDraft(recipe, image, {prompt, camera='none', speed='slow', audio='', duration, seed}={}) {
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>20000||audio.length>4000)throw Error('Írd le, mi történjen a következő jelenetrészben.');
 const sampling=Object.fromEntries(Object.entries(recipe.info.sampling||{}).filter(([key,value])=>(recipe.info.samplingFields||[]).filter(f=>f.control===key).every(f=>f.value===value)));
 const c={source:structuredClone(recipe.source),sourceName:recipe.filename,info:structuredClone(recipe.info),prompt:[prompt.trim(),audio.trim()?'Audio: '+audio.trim():''].filter(Boolean).join('\n\n'),negative:recipe.info.negative||'',width:recipe.width,height:recipe.height,duration:duration??recipe.duration,seed:seed??recipe.seed,count:1,seedMode:'increment',seedStep:1,image:image||'',useImage:!!image,controls:{loras:structuredClone(recipe.info.loras||[]),models:[],addedLoras:[],seed:seed??recipe.seed,sampling:{},samplingOverrides:{sampler:true,scheduler:true}},motion:{enabled:camera!=='none',camera,speed},prepared:false,preparedRunId:'',sceneOrigin:{id:recipe.id,regenerate:recipe.regenerate===true}};
 if(!Number.isSafeInteger(c.seed)||c.seed<0)throw Error('Érvényes, nem negatív seed szükséges.');
 if(!Number.isFinite(c.duration)||c.duration<1||c.duration>30)throw Error('A jelenetrész hossza 1–30 másodperc lehet.');
 c.controls.sampling=sampling;return c;
}
