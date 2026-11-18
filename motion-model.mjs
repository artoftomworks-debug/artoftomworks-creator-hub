export const MOTION_CHOICES={
 camera:[['none','Nincs megadva · a saját prompt szerint'],['static','Rögzített kamera'],['push','Közelítés / dolly'],['pull','Távolodás'],['left','Oldalazás balra'],['right','Oldalazás jobbra'],['orbit','Körbejárás'],['follow','Szereplő követése']],
 subject:[['none','Nincs megadva'],['still','Mozdulatlan póz'],['subtle','Finom, természetes mozgás'],['walk','Séta'],['dynamic','Dinamikus akció']],
 intensity:[['none','Nincs megadva'],['gentle','Visszafogott'],['natural','Természetes'],['strong','Intenzív']],
 composition:[['none','Nincs megadva'],['close','Közeli'],['medium','Félközeli'],['full','Teljes alak'],['wide','Nagytotál']],
 speed:[['slow','Lassú'],['medium','Közepes'],['fast','Gyors']],
 focus:[['none','Nincs megadva'],['subject','Fókusz az alanyon'],['deep','Az egész jelenet éles']]
};
export function normalizeMotion(raw={}){const result={enabled:raw?.enabled===true};for(const [key,choices]of Object.entries(MOTION_CHOICES))result[key]=choices.some(([value])=>value===raw?.[key])?raw[key]:key==='speed'?'slow':'none';result.face=raw?.face===true;result.horizon=raw?.horizon===true;result.custom=raw?.custom===true;result.text=typeof raw?.text==='string'?raw.text.slice(0,4000):'';result.customBase=typeof raw?.customBase==='string'?raw.customBase.slice(0,4000):'';return result;}
export function buildMotionText(raw){const m=normalizeMotion(raw),speed={slow:'slow',medium:'moderately paced',fast:'fast'}[m.speed],parts=[];
 const cameras={static:'Camera remains locked off on a tripod; no camera movement.',push:`Camera: a ${speed}, smooth dolly toward the main subject.`,pull:`Camera: a ${speed}, smooth dolly away from the main subject.`,left:`Camera: a ${speed}, smooth lateral tracking move to the left.`,right:`Camera: a ${speed}, smooth lateral tracking move to the right.`,orbit:`Camera: a ${speed}, smooth orbit around the main subject.`,follow:`Camera: a ${speed}, smooth tracking shot following the main subject.`};
 const subjects={still:'The subject holds a steady pose without deliberate body movement.',subtle:'The subject makes subtle, natural movements.',walk:'The subject walks naturally through the scene.',dynamic:'The subject performs dynamic, purposeful action.'};
 const intensities={gentle:'Keep subject movement restrained and gentle.',natural:'Keep subject movement natural and physically coherent.',strong:'Use energetic, pronounced subject movement.'};
 const compositions={close:'Use a close-up composition.',medium:'Use a medium close-up composition.',full:'Keep the entire subject visible in a full-body composition.',wide:'Use a wide establishing composition showing the surrounding environment.'};
 for(const text of [cameras[m.camera],subjects[m.subject],intensities[m.intensity],compositions[m.composition]])if(text)parts.push(text);
 if(m.face)parts.push('Keep the face visible within the frame.');if(m.horizon)parts.push('Keep the horizon level.');if(m.focus==='subject')parts.push('Keep the main subject in focus.');if(m.focus==='deep')parts.push('Use deep focus so the foreground and background remain readable.');return parts.join('\n');
}
export function motionText(raw){const m=normalizeMotion(raw);return m.custom?m.text.trim():buildMotionText(m);}
const compact=text=>String(text||'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function composeVideoPrompt(base,raw){const text=String(base||''),m=normalizeMotion(raw),extra=motionText(m);if(!m.enabled||!extra||compact(text).includes(compact(extra)))return text;return [text.trim(),extra].filter(Boolean).join('\n\n');}
export const MOTION_PRESETS=[
 {id:'cinematic-push',name:'Lassú filmes közelítés',motion:normalizeMotion({enabled:true,camera:'push',speed:'slow',subject:'subtle',intensity:'gentle',composition:'medium',horizon:true,focus:'subject'})},
 {id:'quiet-portrait',name:'Nyugodt portré',motion:normalizeMotion({enabled:true,camera:'static',subject:'subtle',intensity:'gentle',composition:'close',face:true,horizon:true,focus:'subject'})},
 {id:'walking-follow',name:'Sétáló szereplő követése',motion:normalizeMotion({enabled:true,camera:'follow',speed:'medium',subject:'walk',intensity:'natural',composition:'full',horizon:true,focus:'subject'})}
];
const fixed=/(?:static|fixed|stationary|locked[- ]?off)\s+camera|camera\s+(?:(?:remains|is|stays)\s+)?(?:static|fixed|stationary|locked\s+off)|no\s+camera\s+(?:movement|motion)|rögzített\s+kamera|mozdulatlan\s+kamera|kamera\s+(?:nem\s+mozog|mozdulatlan)|nincs\s+kameramozgás/i;
const moving=/camera\s*:?\s*(?:(?:a|an|the|very|slow|slowly|fast|smooth|smoothly|moderately|paced|gentle|gently|gradually|quickly|steadily|begins|starts|to)\s*[,;]?\s*){0,8}(?:dolly|tracking|orbit|pan(?:s|ning)?\b|moves?\b|zooms?\b|pulls?\b|pushes?\b|follows?\b)|(?:dolly|tracking|panning|orbiting)\s+(?:shot|camera)|kamera\s+(?:(?:lassan|gyorsan|finoman)\s+)?(?:közelít|távolod|oldalaz|körbejár|követ)|(?:követő|oldalazó)\s+kamera/i;
const close=/(?:extreme\s+)?close[- ]?up|közeli(?:\s+felvétel)?/i,wide=/wide(?:[- ]angle|\s+establishing)?\s+(?:shot|composition)|full[- ]body|teljes\s+alak|nagytotál/i;
export function motionConflicts(base,raw){const m=normalizeMotion(raw);if(!m.enabled||!motionText(m))return [];const extra=motionText(m),issues=[];
 const add=(id,field,message)=>issues.push({id,field,message});
 const clean=text=>String(text).replace(/no\s+camera\s+(?:movement|motion)/ig,'').replace(/nincs\s+kameramozgás/ig,'');
 if(fixed.test(base)&&moving.test(clean(extra))||moving.test(clean(base))&&fixed.test(extra)||fixed.test(extra)&&moving.test(clean(extra)))add('camera','camera','Rögzített és mozgó kamerakérés is szerepel. Válaszd ki, melyiket szeretnéd megtartani.');
 const explicitStill=/(?:subject|person|character)\s+(?:(?:remains?|stands?|stays?)\s+(?:completely\s+)?(?:still|motionless)|holds\s+a\s+steady\s+pose)|(?:szereplő|alany)\s+(?:mozdulatlan|nem\s+mozog)/i;
 const action=/(?:subject|person|character)\s+(?:(?:walks?|runs?|jumps?|dances?)\b|performs\s+dynamic)|(?:szereplő|alany)\s+(?:sétál|fut|ugrik|táncol)|energetic,\s+pronounced\s+subject/i;
 if(explicitStill.test(base)&&action.test(extra)||action.test(base)&&explicitStill.test(extra)||explicitStill.test(extra)&&action.test(extra))add('subject','subject','Mozdulatlan póz és aktív szereplőmozgás is szerepel a kérésben.');
 if(close.test(base)&&wide.test(extra)||wide.test(base)&&close.test(extra))add('composition','composition','Közeli és teljes alakos / nagytotál kompozíció keveredik.');
 if((m.custom?/keep (?:the )?horizon (?:level|horizontal)/i.test(extra):m.horizon)&&/dutch\s+angle|tilted\s+horizon|horizon\s+tilts|dőlő\s+horizont|ferde\s+kameraszög/i.test(base))add('horizon','horizon','A prompt ferde horizontot kér, a panel vízszintes horizontot tartana.');
 if((m.custom?/keep (?:the )?(?:main )?subject in focus/i.test(extra):m.focus==='subject')&&/rack\s+focus|focus\s+(?:pull|shift)|fókuszváltás/i.test(base))add('focus','focus','Az alanyon tartott fókusz és fókuszváltás is szerepel.');
 return issues;
}
