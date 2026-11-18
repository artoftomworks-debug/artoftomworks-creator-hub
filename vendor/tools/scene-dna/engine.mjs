import {Geometry} from './composition-model.mjs';
import {validateRenderSettings} from './render-model.mjs';
import {validateSceneSettings,validateSceneDraft,sceneImage,sceneDraftStatus} from './scene-model.mjs';
import {validateVariants} from './variants-model.mjs';
export const VERSION='0.7.0';
export const LANGUAGES=['EN','HU','DE','FR','ES','IT','PT','PL'];
export const FIELDS=['location','subjects','wardrobe','time','lighting','palette','style','props'];
export const TIMES=['day','dawn','sunrise','golden','sunset','dusk','blue','night','custom'];
export const FRAMINGS=['wide','medium','closeup','detail','reverse'];
export const CAMERAS=['static','push','pull','pan','track'];
export const ANGLES=['eye','low','high','overhead'];
export const ASPECTS=['16:9','9:16','1:1','4:3','2.39:1'];
export const SEQUENCES=['atmosphere','product','character'];
const uid=()=>globalThis.crypto?.randomUUID?.()||'s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clean=(v,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid or oversized text.');return v;};
const member=(v,list)=>{if(!list.includes(v))throw Error('Unsupported option.');return v;};
const numeric=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid numeric value.');return v;};
const imageData=(raw)=>{if(raw===null||raw===undefined)return null;if(typeof raw!=='object'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(raw.data)||raw.data.length>1500000)throw Error('Invalid embedded image.');return {data:raw.data,label:clean(raw.label||'',180)};};
export function blankProject(language='EN'){
 return {schema:'artoftomworks.scene-dna',version:1,id:uid(),updated:Date.now(),language:LANGUAGES.includes(language)?language:'EN',title:'',aspect:'16:9',sequence:'atmosphere',count:5,idea:'',recipe:{location:'',subjects:'',wardrobe:'',time:'dusk',lighting:'',palette:'',style:'',props:''},locks:Object.fromEntries(FIELDS.map(k=>[k,true])),audio:{mode:'off',ambience:'',effects:'',speech:'',music:'',space:''},profile:'generic',profileNote:'',reference:null,shots:[]};
}
const PLAN={
 atmosphere:[['Establish the place','wide','static','Establish the environment and its atmosphere.'],['Enter the scene','medium','push','Bring attention to the main subject or focal area.'],['Small detail','detail','static','Isolate one meaningful detail already present in the scene.'],['A closer look','closeup','static','Study the main subject without introducing a new event.'],['Closing view','wide','pull','Return to the wider environment and let the scene settle.'],['Another viewpoint','medium','static','Show the same scene from a complementary viewpoint.']],
 product:[['Product in context','wide','static','Show the product in its established environment.'],['Hero view','medium','push','Make the same product the clear visual focus.'],['Material detail','detail','static','Show one visible surface or construction detail of the same product.'],['Another angle','closeup','pan','Show another side of the same product, preserving its design.'],['Closing hero','medium','pull','Hold a clean final view of the same product.'],['Context detail','detail','static','Connect a visible environmental detail to the same product.']],
 character:[['Character in place','wide','static','Establish the same character in the environment.'],['Character moment','medium','push','Focus on the established character and the described main action.'],['Meaningful detail','detail','static','Isolate a visible detail belonging to the same character or scene.'],['Expression','closeup','static','Focus on the established character’s expression.'],['Closing view','medium','pull','Let the same character’s moment settle.'],['Complementary view','medium','static','Show a complementary view of the same character.']]
};
export function planShots(project){
 const count=Math.max(3,Math.min(6,Math.round(project.count)));const plan=PLAN[project.sequence]||PLAN.atmosphere;
 const indices=count===3?[0,2,4]:count===4?[0,1,2,4]:count===5?[0,1,2,3,4]:[0,1,2,3,5,4];
 return indices.map(i=>({id:uid(),title:plan[i][0],framing:plan[i][1],camera:plan[i][2],angle:'eye',action:plan[i][3],duration:5,overrides:{},notes:'',result:null}));
}
export function copyShot(shot){return {...structuredClone(shot),id:uid()};}
export function effectiveRecipe(project,shot){return {...Object.fromEntries(FIELDS.map(k=>[k,!project.locks[k]&&typeof shot.overrides[k]==='string'&&shot.overrides[k].trim()?shot.overrides[k]:project.recipe[k]])),timeText:!project.locks.time&&shot.overrides.timeText?.trim()?shot.overrides.timeText:project.recipe.timeText||''};}
const FRAME={wide:'Wide establishing shot; show the full environment and keep the main subject readable.',medium:'Medium shot with a clear main subject and enough environmental context.',closeup:'Close-up of the main subject; keep its identifying features consistent.',detail:'Tight detail shot of the detail specified below; preserve its material and design.',reverse:'Reverse-angle shot of the same scene; preserve spatial relationships. The unseen layout must be supplied by the creator.'};
const ANGLE={eye:'Eye-level camera.',low:'Low camera angle looking slightly upward.',high:'High camera angle looking downward.',overhead:'Overhead camera looking straight down.'};
const CAMERA={static:'Locked-off camera. No camera movement.',push:'One gentle, slow push-in toward the established focal point.',pull:'One gentle, slow pull-back from the established focal point.',pan:'One slow, controlled pan across the established subject.',track:'One slow lateral tracking movement past the established subject.'};
const TIME={day:'daytime',dawn:'dawn, before sunrise',sunrise:'sunrise',golden:'golden hour',sunset:'sunset, with the sun at the horizon',dusk:'dusk, after sunset',blue:'blue hour',night:'night'};
export const SOUND_FIELDS=['ambience','effects','speech','music','space'];
export function effectiveSound(project,shot){return Object.fromEntries(SOUND_FIELDS.map(key=>[key,shot.sound?.[key]?.trim()?shot.sound[key]:project.audio?.[key]||'']));}
export function soundPlan(project,shot){const s=effectiveSound(project,shot);return SOUND_FIELDS.filter(key=>s[key].trim()).map(key=>({ambience:'Ambient sound',effects:'Event sounds',speech:'Dialogue / voice',music:'Music',space:'Acoustic space'}[key])+': '+s[key].trim()).join('\n');}
export function basePrompts(project,shot){
 const r=effectiveRecipe(project,shot),parts=[['Location',r.location],['Subjects',r.subjects],['Wardrobe / appearance',r.wardrobe],['Time of day',r.time==='custom'?r.timeText:TIME[r.time]],['Lighting',r.lighting],['Colour palette',r.palette],['Visual style',r.style],['Continuity objects',r.props]].filter(x=>x[1]?.trim()).map(([k,v])=>`${k}: ${v.trim()}.`);
 const common=parts.join('\n'),action=shot.action.trim(),idea=project.idea.trim();
 const composition=Geometry.parts(project,shot),framing=composition?.framing||FRAME[shot.framing];
 const image=[common,idea?'Scene intent: '+idea+'.':'',framing,ANGLE[shot.angle],action?'Moment / focus: '+action:'',`Compose for ${project.aspect} aspect ratio.`, 'Maintain the established subject identity, appearance, object design and spatial relationships. Match the stated visual style.'].filter(Boolean).join('\n');
 let video=[common,idea?'Scene intent: '+idea+'.':'',`One continuous shot, intended duration ${shot.duration} seconds. ${framing}`,ANGLE[shot.angle],composition?.movement||CAMERA[shot.camera],action?'Action / focus: '+action:'',`Maintain the ${project.aspect} framing, subject identity, appearance and stable scene geometry throughout. Natural, coherent motion appropriate to the stated visual style; consistent lighting and exposure. No cuts within this shot.`].filter(Boolean).join('\n');
 const sound=project.audio?.mode==='prompt'?soundPlan(project,shot):'';
 if(project.profile==='ltx')video=video.replaceAll('\n',' ') +(sound?' '+sound.replaceAll('\n','. ')+'.':'');
 else if(project.profile==='h3'){const s=effectiveSound(project,shot);video='integrated_multimodal_description: [Shot 1] '+video.replaceAll('\n',' ');if(sound){if(s.speech)video+=' Dialogue / voice: '+s.speech;video+='\n\noverall_soundscape: '+[s.ambience,s.effects,s.space].filter(Boolean).join('; ')+'\n\nnon_diegetic_music: '+(s.music||'No music requested.');}}
 else {if(sound)video+='\nSound design:\n'+sound;if(project.profile==='custom'&&project.profileNote?.trim())video+='\nAdditional target-workflow guidance: '+project.profileNote.trim();}
 return {image,video};
}
export function sceneStatus(project,shot){return sceneDraftStatus(project,shot,basePrompts(project,shot).video,Geometry.imageKey(sceneImage(project,shot)));}
export function appliedSceneStatus(project,shot){const draft=shot.sceneApplied||shot.sceneDraft;return sceneDraftStatus(project,{...shot,sceneDraft:draft},basePrompts(project,shot).video,Geometry.imageKey(sceneImage(project,shot)));}
export function prompts(project,shot){const out=basePrompts(project,shot);if(appliedSceneStatus(project,shot).active)out.video=(shot.sceneApplied||shot.sceneDraft).text;return out;}
export function issues(project){
 const found=[];for(const field of ['location','subjects','lighting','style'])if(!project.recipe[field].trim())found.push({code:'missing',field});
 for(const shot of project.shots){
  if(!shot.action.trim())found.push({code:'action',shot:shot.id});
  if(shot.framing==='reverse')found.push({code:'reverse',shot:shot.id});
  const composition=Geometry.status(project,shot);if(composition.reason)found.push({code:'compositionStale',shot:shot.id});else if(composition.active&&Geometry.parts(project,shot).focusOutside)found.push({code:'compositionFocus',shot:shot.id});
    if(shot.sceneDraft&&sceneStatus(project,shot).stale)found.push({code:'sceneStale',shot:shot.id});
  for(const field of FIELDS)if(!project.locks[field]&&shot.overrides[field]?.trim()&&shot.overrides[field]!==project.recipe[field])found.push({code:'difference',shot:shot.id,field});
  const r=effectiveRecipe(project,shot),text=[shot.action,shot.notes,r.lighting].join(' ').toLowerCase();
  if((r.time==='night'&&/\b(daylight|midday|noon|nappali|déli napfény)\b/.test(text))||(r.time==='day'&&/\b(midnight|moonlight|éjfél|holdfény)\b/.test(text)))found.push({code:'time',shot:shot.id});
 }
 return found;
}
export function validateProject(raw){
 if(!raw||raw.schema!=='artoftomworks.scene-dna'||raw.version!==1||!Array.isArray(raw.shots)||raw.shots.length>6||!raw.recipe||!raw.locks)throw Error('Not a supported Scene DNA project.');
 const p=blankProject();p.id=clean(raw.id,100);p.updated=numeric(raw.updated||0,0,Number.MAX_SAFE_INTEGER);p.title=clean(raw.title,180);p.idea=clean(raw.idea);p.language=member(raw.language,LANGUAGES);p.aspect=member(raw.aspect,ASPECTS);p.sequence=member(raw.sequence,SEQUENCES);p.count=numeric(raw.count,3,6);if(!Number.isInteger(p.count))throw Error('Invalid shot count.');
 for(const key of FIELDS){p.recipe[key]=key==='time'?member(raw.recipe[key],TIMES):clean(raw.recipe[key]);if(typeof raw.locks[key]!=='boolean')throw Error('Invalid lock.');p.locks[key]=raw.locks[key];}
 if(raw.recipe.timeText!==undefined)p.recipe.timeText=clean(raw.recipe.timeText);
 p.audio.mode=member(raw.audio?.mode||'off',['off','prompt','post']);for(const key of SOUND_FIELDS)p.audio[key]=clean(raw.audio?.[key]||'');p.profile=member(raw.profile||'generic',['generic','ltx','h3','custom']);p.profileNote=clean(raw.profileNote||'');
 if(raw.reviewedDirectorFindings!==undefined){if(!Array.isArray(raw.reviewedDirectorFindings)||raw.reviewedDirectorFindings.length>120||raw.reviewedDirectorFindings.some(v=>typeof v!=='string'||!/^[a-f0-9]{8}$/.test(v))||new Set(raw.reviewedDirectorFindings).size!==raw.reviewedDirectorFindings.length)throw Error('Invalid director review marks.');p.reviewedDirectorFindings=[...raw.reviewedDirectorFindings];}
 p.reference=imageData(raw.reference);const ids=new Set();
 p.shots=raw.shots.map(s=>{if(!s||typeof s!=='object')throw Error('Invalid shot.');const id=clean(s.id,100);if(ids.has(id))throw Error('Duplicate shot.');ids.add(id);const overrides={};for(const key of FIELDS)if(s.overrides?.[key]!==undefined)overrides[key]=key==='time'?member(s.overrides[key],TIMES):clean(s.overrides[key]);const shot={id,title:clean(s.title,180),framing:member(s.framing,FRAMINGS),camera:member(s.camera,CAMERAS),angle:member(s.angle,ANGLES),duration:numeric(s.duration,1,30),action:clean(s.action),notes:clean(s.notes),overrides,result:imageData(s.result)};
 if(s.overrides?.timeText!==undefined)shot.overrides.timeText=clean(s.overrides.timeText);
 if(s.sound){shot.sound={};for(const key of SOUND_FIELDS)shot.sound[key]=clean(s.sound[key]||'');}
 if(s.composition!==undefined)shot.composition=Geometry.validate(s.composition);
 if(s.sceneSettings!==undefined)shot.sceneSettings=validateSceneSettings(s.sceneSettings);
 if(s.sceneDraft!==undefined)shot.sceneDraft=validateSceneDraft(s.sceneDraft);
 if(s.sceneApplied!==undefined)shot.sceneApplied=validateSceneDraft(s.sceneApplied);
 if(s.sceneVariants!==undefined)shot.sceneVariants=validateVariants(s.sceneVariants);
 for(const key of ['sceneActiveVariant','sceneAppliedVariant'])if(s[key]!==undefined){shot[key]=clean(s[key],100);if(!shot.sceneVariants?.some(v=>v.id===shot[key]))throw Error('Unknown scene variant.');}

 if(s.translations){shot.translations={};for(const kind of ['image','video']){shot.translations[kind]={};for(const lang of LANGUAGES){const v=s.translations[kind]?.[lang];if(v)shot.translations[kind][lang]={source:clean(v.source,30000),text:clean(v.text,30000),model:clean(v.model||'',180)};}}}
 if(s.promptLanguages){shot.promptLanguages={image:member(s.promptLanguages.image,['SOURCE',...LANGUAGES]),video:member(s.promptLanguages.video,['SOURCE',...LANGUAGES])};}return shot;});
 if(raw.generation!==undefined)p.generation=validateRenderSettings(raw.generation,p.shots.map(s=>s.id));
 return p;
}
export function withoutImages(project){return {...project,...(project.generation?{generation:{...project.generation,images:{}}}:{}),reference:null,shots:project.shots.map(s=>({...s,result:null}))};}
export function restoreProjectImages(project,recovery){
 if(recovery?.schema!=='artoftomworks.scene-dna.image-recovery'||recovery.version!==1||recovery.projectId!==project.id||!Array.isArray(recovery.shots)||recovery.shots.length>6)throw Error('This image recovery belongs to a different project.');
 const p=validateProject(project),seen=new Set();
 for(const entry of recovery.shots){if(!entry||seen.has(entry.id)||!p.shots.some(s=>s.id===entry.id))throw Error('The recovery contains an unknown or repeated shot.');seen.add(entry.id);const image=imageData(entry.image);if(!image)throw Error('Missing recovery image.');const shot=p.shots.find(s=>s.id===entry.id);if(!shot.result)shot.result=image;}
 const reference=imageData(recovery.reference);if(!p.reference&&reference)p.reference=reference;
 p.updated=Date.now();return p;
}
export function example(sequence='atmosphere',language='EN'){
 const p=blankProject(language);p.sequence=sequence;
 if(sequence==='product'){p.title='Ceramic cup — product story';p.idea='A calm, tactile introduction to a handmade ceramic cup';p.recipe={location:'A simple walnut tabletop beside a window, neutral background',subjects:'One handmade cream-coloured ceramic coffee cup with a rounded handle',wardrobe:'The cup has a matte speckled glaze and no lettering',time:'day',lighting:'Soft window light from camera left, gentle fill from the right',palette:'Warm cream, walnut brown and muted grey',style:'Restrained photorealistic product photography',props:'One folded linen napkin to the right of the cup'};}
 else if(sequence==='character'){p.title='A quiet studio portrait';p.idea='An adult artist pauses beside a window';p.recipe={location:'A small painting studio with a north-facing window and plain plaster walls',subjects:'One adult artist, approximately 40 years old, short dark curly hair',wardrobe:'Ochre linen shirt and dark trousers',time:'day',lighting:'Soft window light from camera left with subtle reflected fill',palette:'Muted ochre, warm grey and natural skin tones',style:'Naturalistic editorial portrait photography',props:'One wooden easel behind the artist and a closed sketchbook'};}
 else {p.title='Rain at the café';p.idea='A quiet moment watching the rain from inside a café';p.recipe={location:'Inside a small European café, looking through a rain-covered window onto a wet street',subjects:'One cream ceramic coffee cup in the foreground; distant passers-by outside',wardrobe:'Distant passers-by wear neutral dark raincoats',time:'dusk',lighting:'Warm amber pendant lights inside; soft cool overcast light outside',palette:'Amber, warm brown, slate blue and muted grey',style:'Photorealistic cinematic stills with restrained colour grading',props:'Round wooden table, cream cup and matching saucer, dark window frame'};}
 p.shots=planShots(p);return p;
}
