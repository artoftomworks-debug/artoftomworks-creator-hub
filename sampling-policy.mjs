// Graph starting values, not a claim about an author's complete workflow.
export const SAMPLING_POLICY_VERSION=2;
export function automaticSamplingDefaults(model){const family=model.family;return {steps:family==='moss'?50:family==='h3'?(/turbo/i.test(model.title)?8:20):20,cfg:['moss','h3','ltx','flux1','krea2'].includes(family)?1:7,sampler:'euler',scheduler:['h3','moss','ltx'].includes(family)?'simple':'normal',denoise:1,guidance:3.5};}
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
export function saveSamplingProfile(state,key,sampling,controls={}){
 const profiles=state.modelSamplingProfiles&&typeof state.modelSamplingProfiles==='object'&&!Array.isArray(state.modelSamplingProfiles)?state.modelSamplingProfiles:{};
 const entries=Object.entries(profiles).filter(([k,v])=>k!==key&&v&&typeof v==='object').slice(-127);
 state.modelSamplingProfiles=Object.fromEntries([...entries,[key,{sampling:cleanSampling(sampling),saved:Date.now(),version:SAMPLING_POLICY_VERSION,overrides:Object.fromEntries(['sampler','scheduler'].map(k=>[k,controls.samplingOverrides?.[k]!==false])),choices:cleanSampling(controls.samplingChoices)}]]);
}
export function migrateSampling(c,model){
 if(c.modelSamplingVersion===SAMPLING_POLICY_VERSION)return false;
 const oldVersion=c.modelSamplingVersion,oldPolicy=c.modelSamplingPolicy;c.modelSamplingVersion=SAMPLING_POLICY_VERSION;c.modelSamplingPolicy=oldPolicy==='manual'?'manual':'remember';
 if(oldPolicy==='manual')return false;
 const defaults=automaticSamplingDefaults(model),sampling={...(c.info?.sampling||{}),...(c.controls?.sampling||{})},changed=[];
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
 else if(profile?.sampling){values={...defaults,...cleanSampling(profile.sampling)};if(model.family==='moss'&&profile.version!==SAMPLING_POLICY_VERSION&&values.cfg===3)values.cfg=1;}
 else {values={...defaults};if(previousFamily===model.family)Object.assign(values,own);else for(const key of ['steps','denoise'])if(own[key]!==undefined)values[key]=own[key];}
 if(mode==='image'&&!useImage&&policy!=='manual')values.denoise=1;
 return values;
}
