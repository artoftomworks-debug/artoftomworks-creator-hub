import {effectiveRecipe,prompts,appliedSceneStatus} from './engine.mjs';
import {Geometry} from './composition-model.mjs';

// Limited EN/HU wording checks, not semantic or visual consistency scoring.
function directorPositive(text,pattern){
 for(const sentence of text.split(/[.!?;\n]+/))for(const clause of sentence.split(/\b(?:but|however|viszont|azonban)\b/i)){
  const re=new RegExp(pattern.source,pattern.flags.replace('g','')+'g');let match;
  while((match=re.exec(clause))){
   const prefix=clause.slice(0,match.index);
   if(/\b(?:no|not|never|without|avoid|prevent|exclude|ne|nem|nincs|kerüld)\b[^:]{0,140}$/i.test(prefix)||/-free\b/i.test(clause.slice(match.index+match[0].length,match.index+match[0].length+6)))continue;
   return clause.trim().slice(0,360);
  }
 }return '';
}
function directorFingerprint(value){let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export function directorReview(project){
 const findings=[],rows=[],reviewed=new Set(project.reviewedDirectorFindings||[]);let start=0;
 function add(shot,code,evidence,field='',previous=''){
  const context={recipe:effectiveRecipe(project,shot),camera:shot.camera,angle:shot.angle,framing:shot.framing,duration:shot.duration,composition:shot.composition,video:prompts(project,shot).video};
  const fingerprint=directorFingerprint([shot.id,code,field,evidence,previous,context]);
  findings.push({shot:shot.id,code,field,evidence,previous,fingerprint,reviewed:reviewed.has(fingerprint),level:code==='directorChange'?'info':'review'});
 }
 for(const [index,shot]of project.shots.entries()){
  const recipe=effectiveRecipe(project,shot),applied=appliedSceneStatus(project,shot),composition=Geometry.parts(project,shot),hasApplied=shot.sceneApplied?.applied||shot.sceneDraft?.applied;
  const video=prompts(project,shot).video,text=applied.active?video:shot.action;
  rows.push({id:shot.id,index:index+1,title:shot.title,start,end:start+shot.duration,duration:shot.duration,time:recipe.time,timeText:recipe.timeText,camera:composition?.movement?'planned':shot.camera,source:applied.active?'directorApplied':hasApplied&&applied.stale?'directorPaused':'directorAutomatic'});start+=shot.duration;
  const steady=composition?.movement?composition.movement.startsWith('Keep the planned framing steady'):shot.camera==='static';
  if(steady){const evidence=directorPositive(text,/\b(?:push[- ]?in|pull[- ]?back|dolly|zoom[- ]?in|panning|tracking|camera\s+(?:moves|pans|tracks|orbits|pushes|pulls|tilts|zooms)|kamera\s+(?:mozog|fordul|közelít|távolodik))\b/i);if(evidence)add(shot,'directorCamera',evidence);}
  const timeText=[text,recipe.lighting].join('\n');
  const evidence=recipe.time==='night'?directorPositive(timeText,/\b(?:daylight|midday|noon|nappali|napfény|déli\s+napfény)\b/i):recipe.time==='day'?directorPositive(timeText,/\b(?:midnight|moonlight|éjfél|holdfény)\b/i):'';
  if(evidence)add(shot,'directorTime',evidence);
  const light=directorPositive(text,/\b(?:flicker\w*|flashing|strob\w*|villog\w*|vibrál\w*)/i);if(light)add(shot,'directorLight',light);
  if(applied.active){const match=video.match(/\b(?:intended\s+duration|total\s+duration|duration|időtartam|teljes\s+hossza)\s*(?:of\s+)?[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:seconds?|s\b|másodperc)/i);if(match&&Math.abs(Number(match[1].replace(',','.'))-shot.duration)>.05)add(shot,'directorDuration',match[0]);}
  if(hasApplied&&applied.stale)add(shot,'directorStale','');
  if(index){const previous=effectiveRecipe(project,project.shots[index-1]);for(const field of ['location','subjects','wardrobe','time','lighting','palette','style','props']){
   const a=field==='time'&&previous.time==='custom'?previous.timeText:previous[field],b=field==='time'&&recipe.time==='custom'?recipe.timeText:recipe[field];
   if(a!==b)add(shot,'directorChange',String(b||''),field,String(a||''));
  }}
 }
 return {rows,findings,total:start,pending:findings.filter(f=>!f.reviewed).length,reviewed:findings.filter(f=>f.reviewed).length};
}
