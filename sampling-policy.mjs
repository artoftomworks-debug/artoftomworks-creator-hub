// Graph starting values, not a claim about an author's complete workflow.
export const SAMPLING_POLICY_VERSION=3;
// 0.16 DEV: model-specific starting values. A model is recognised by its file name as well as its
// embedded title (many files carry no title). Values come from the proven ArtofTomworks workflows
// (comfy_nodes/artoftomworks-h3-profiles/profiles.json): DaSiWa Hybrid V4 Turbo = 8 steps euler/simple,
// Eros Max = 6 steps res_multistep/simple. Distilled "turbo"/"lightning" H3 files default to 8 steps.
const KNOWN_MODELS=[
 {family:'h3',match:/eros[ _-]?max/i,values:{steps:6,sampler:'res_multistep',scheduler:'simple'},label:'H3 Eros Max'},
 {family:'h3',match:/turbo|lightning|distill/i,values:{steps:8,sampler:'euler',scheduler:'simple'},label:'H3 Turbo'},
 // 0.16 DEV: Stable Yogi „Realism … Moss” is a distilled finetune – 4–6 steps are enough (user-tested); the generic Moss default stays 50.
 {family:'moss',match:/stable[ _-]?yogi|realism[ _-]?by/i,values:{steps:6},label:'Moss · Stable Yogi Realism'},
];
export function modelText(model={}){return [model.title,model.name,model.id].filter(v=>typeof v==='string').join(' ');}
export function knownModelProfile(model={}){const text=modelText(model);return KNOWN_MODELS.find(k=>k.family===model.family&&k.match.test(text))||null;}
// 0.16 DEV: csendes, fájlnév alapú javaslat ismeretlen modellekhez – „8steps”, „turbo”, „lightning”, „hyper”, „lcm”, „schnell”…
// Csak kiinduló érték: a ▦ Próbasorral ellenőrizhető, a felhasználó választása mindig felülírja.
export function nameHints(model={}){const t=modelText(model).toLowerCase(),out={};const m=t.match(/(?:^|[^a-z0-9])(\d{1,2})[ _-]?steps?(?:[^a-z]|$)/);if(m){const n=Number(m[1]);if(n>=1&&n<=50)out.steps=n;}
  const lowCfg=['sd1','sd2','sdxl','pony','illustrious'].includes(model.family);
  if(/\blcm\b|[_-]lcm/.test(t)){out.steps??=6;out.sampler='lcm';if(lowCfg)out.cfg=1.5;}
  else if(/schnell/.test(t)){out.steps??=4;}
  else if(/turbo|lightning|hyper|dmd2?\b|distill/.test(t)){out.steps??=8;if(lowCfg)out.cfg=2;}
  return out;}
export function automaticSamplingDefaults(model){const family=model.family,known=knownModelProfile(model);return {steps:family==='moss'?50:20,cfg:['moss','h3','ltx','flux1','krea2'].includes(family)?1:7,sampler:'euler',scheduler:['h3','moss','ltx'].includes(family)?'simple':'normal',denoise:1,guidance:3.5,...(known?null:nameHints(model)),...(known?.values||{})};}
// Próbasor: néhány lépésszám ugyanazzal a seeddel. Desztillált (gyors) modellnél sűrűbben a kis értékek körül.
export function trialSteps(base){const d=Math.max(1,Math.round(Number(base)||20));const list=d<=12?[Math.max(2,Math.round(d/2)),d,Math.round(d*1.5),d*2]:[Math.round(d/2),d,Math.round(d*1.5)];return [...new Set(list.map(v=>Math.max(1,Math.min(150,v))))].sort((a,b)=>a-b);}
// Egy modell beállítása „rendezett”, ha már kipróbáltad (Próbasor), kézzel beállítottad, elrejtetted a jelzést, vagy a mentett lépésszám eltér a kiinduló értéktől.
export function isSettled(profile,defaults={}){if(!profile)return false;if(profile.tested||profile.manual||profile.dismissed)return true;const st=profile.sampling?.steps;return typeof st==='number'&&(profile.version||0)>=3&&defaults.steps!==undefined&&st!==defaults.steps;}
const ranges={steps:[1,1000],cfg:[0,100],denoise:[.01,1],guidance:[0,100]};
export function cleanSampling(value={}){const result={};for(const[key,[min,max]]of Object.entries(ranges)){const v=value?.[key];if(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(key!=='steps'||Number.isInteger(v)))result[key]=v;}for(const key of ['sampler','scheduler'])if(typeof value?.[key]==='string'&&value[key].length<=100)result[key]=value[key];return result;}
export function samplingProfileKey(backend,mode,id){return String(backend).replace(/\/+$/,'')+'|'+mode+'|'+id;}
export function effectiveSampling(sampling={},defaults={},overrides={}){const values={...defaults,...sampling};for(const key of ['sampler','scheduler'])if(overrides?.[key]===false){if(defaults[key]!==undefined)values[key]=defaults[key];else delete values[key];}return values;}
export function syncSamplingOverrides(controls,defaults={}){
 controls.sampling||={};controls.samplingChoices||={};controls.samplingOverrides||={};
 for(const key of ['sampler','scheduler']){const s=controls.sampling,choices=controls.samplingChoices;
  if(controls.samplingOverrides[key]!==false){controls.samplingOverrides[key]=true;if(typeof s[key]==='string')choices[key]=s[key];else if(typeof choices[key]==='string')s[key]=choices[key];}
  else{if(choices[key]===undefined&&typeof s[key]==='string')choices[key]=s[key];if(defaults[key]!==undefined)s[key]=defaults[key];else delete s[key];}
 }return controls.sampling;
}
export function toggleSamplingOverride(controls,key,enabled,defaults={}){
 if(!['sampler','scheduler'].includes(key))throw Error('Unknown sampling override');
 syncSamplingOverrides(controls,defaults);controls.samplingOverrides[key]=!!enabled;
 if(enabled&&typeof controls.samplingChoices[key]==='string')controls.sampling[key]=controls.samplingChoices[key];
 return syncSamplingOverrides(controls,defaults);
}
export function saveSamplingProfile(state,key,sampling,controls={},flags={}){
 const profiles=state.modelSamplingProfiles&&typeof state.modelSamplingProfiles==='object'&&!Array.isArray(state.modelSamplingProfiles)?state.modelSamplingProfiles:{};
 const entries=Object.entries(profiles).filter(([k,v])=>k!==key&&v&&typeof v==='object').slice(-127);
 const prev=profiles[key]&&typeof profiles[key]==='object'?profiles[key]:{},keep=Object.fromEntries(['tested','manual','dismissed'].filter(k=>prev[k]||flags[k]).map(k=>[k,true]));
 state.modelSamplingProfiles=Object.fromEntries([...entries,[key,{...keep,sampling:cleanSampling(sampling),saved:Date.now(),version:SAMPLING_POLICY_VERSION,overrides:Object.fromEntries(['sampler','scheduler'].map(k=>[k,controls.samplingOverrides?.[k]!==false])),choices:cleanSampling(controls.samplingChoices)}]]);
}
export function migrateSampling(c,model){
 if(c.modelSamplingVersion===SAMPLING_POLICY_VERSION)return false;
 const oldVersion=c.modelSamplingVersion,oldPolicy=c.modelSamplingPolicy;c.modelSamplingVersion=SAMPLING_POLICY_VERSION;c.modelSamplingPolicy=oldPolicy==='manual'?'manual':'remember';
 if(oldPolicy==='manual')return false;
 const defaults=automaticSamplingDefaults(model),sampling={...(c.info?.sampling||{}),...(c.controls?.sampling||{})},changed=[];
 // 0.16 DEV (v2 → v3): earlier versions carried the step count over from the previously selected model
 // (e.g. LTX 20 → DaSiWa Turbo, which needs 8). Put the model's own step count back once.
 if(oldVersion===2){if(defaults.steps!==undefined&&sampling.steps!==undefined&&sampling.steps!==defaults.steps){const old=sampling.steps;sampling.steps=defaults.steps;(c.controls||={}).sampling=sampling;c.samplingPolicyNotice='A lépésszám a modellhez igazítva: '+old+' → '+defaults.steps+'. Ha mást szeretnél, írd át – a Hub ezt a modellhez megjegyzi.';return true;}return false;}
 if(model.family==='moss'&&sampling.cfg===3){sampling.cfg=1;changed.push('cfg');}
 // Existing advice-only plans retain explicit choices, except for the old
 // MOSS starting CFG. Do not re-run the older card-policy migration on them.
 if(oldVersion===1){if(!changed.length)return false;(c.controls||={}).sampling=sampling;c.samplingPolicyNotice='A korábbi MOSS kiinduló CFG 3 helyett CFG 1 került be. A lépésszám és a többi saját érték megmaradt.';return true;}
 // Remove only values demonstrably inherited unchanged from the former card
 // policy. Preserve values the user changed and every explicit manual plan.
 for(const[key,value]of Object.entries(cleanSampling(c.modelRecommendation?.values)))if(sampling[key]===value&&defaults[key]!==undefined&&value!==defaults[key]){sampling[key]=defaults[key];changed.push(key);}
 // Earlier automatic-card versions could also carry LCM from another model
 // even after the cached recommendation changed. Repair that legacy FLUX/Krea
 // pair once; explicit manual mode and all new saved profiles are exempt.
 if(['flux1','krea2'].includes(model.family)&&sampling.sampler==='lcm')for(const key of ['sampler','scheduler'])if(sampling[key]!==defaults[key]){sampling[key]=defaults[key];if(!changed.includes(key))changed.push(key);}
 if(!changed.length)return false;
 (c.controls||={}).sampling=sampling;c.samplingPolicyNotice='A korábbi automatikus adatlapértékek helyett a kiinduló értékek kerültek be: '+changed.join(', ')+'. Az ajánlások mostantól csak külön kérésre alkalmazhatók.';return true;
}
export function selectionSampling({sampling={},model,previousFamily,profile,policy='remember',useImage=false,mode='image'}={}){
 const own=cleanSampling(sampling),defaults=automaticSamplingDefaults(model);
 let values;
 if(policy==='manual')values={...defaults,...own};
 else if(profile?.sampling){const saved=cleanSampling(profile.sampling);if((profile.version||0)<3)delete saved.steps;values={...defaults,...saved};if(model.family==='moss'&&profile.version!==SAMPLING_POLICY_VERSION&&values.cfg===3)values.cfg=1;}
 // 0.16 DEV: the step count belongs to the model – never take it over from the previously selected one.
 else {values={...defaults};const keep={...own};delete keep.steps;if(previousFamily===model.family){delete keep.sampler;delete keep.scheduler;Object.assign(values,keep);}else if(keep.denoise!==undefined)values.denoise=keep.denoise;}
 if(mode==='image'&&!useImage&&policy!=='manual')values.denoise=1;
 return values;
}

// 0.16 DEV — „ne legyen csendes hiba”: honnan jön a lépésszám és a CFG, és eltér-e attól, amit a modellhez elmentettél
// (vagy, ha még nincs mentett érték, a modell kiinduló értékétől). Csak jelez; a döntés mindig a felhasználóé.
export const SAMPLING_SOURCE_TEXT={own:'saját beállításod',default:'modell-alapérték',manual:'kézi, nem jegyzi meg',differs:'eltér'};
export function samplingCheck({sampling={},model,profile,policy='remember'}={}){
 if(!model)return null;
 const defaults=automaticSamplingDefaults(model),saved=profile?.sampling?cleanSampling(profile.sampling):null;if(saved&&(profile.version||0)<3)delete saved.steps;
 const out={fields:{},mismatches:[]};
 for(const f of ['steps','cfg']){const v=sampling?.[f];if(typeof v!=='number')continue;let source,expected,from;
  if(policy==='manual')source='manual';
  else if(saved&&saved[f]!==undefined){if(saved[f]===v)source='own';else{source='differs';expected=saved[f];from='profile';}}
  else if(defaults[f]!==undefined){if(defaults[f]===v)source='default';else{source='differs';expected=defaults[f];from='default';}}
  else continue;
  out.fields[f]={value:v,source,expected,from};if(source==='differs')out.mismatches.push({field:f,current:v,expected,from});}
 return out;
}
export function samplingSourceLabel(check){
 if(!check)return '';const list=Object.entries(check.fields);if(!list.length)return '';
 const sources=[...new Set(list.map(([,v])=>v.source))];const name={steps:'lépés',cfg:'CFG'};
 if(sources.length===1)return SAMPLING_SOURCE_TEXT[sources[0]];
 return list.map(([k,v])=>name[k]+': '+SAMPLING_SOURCE_TEXT[v.source]).join(' · ');
}
export function mismatchText(m){const unit=m.field==='steps'?' lépés':' CFG';return m.from==='profile'?'Ehhez a modellhez '+m.expected+(m.field==='steps'?' lépést':' CFG-t')+' mentettél, most '+m.current+' van beállítva.':'A modell kiinduló értéke '+m.expected+unit+', most '+m.current+' van beállítva.';}
