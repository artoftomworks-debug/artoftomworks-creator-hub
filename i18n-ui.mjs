import {LANGUAGES,LANGUAGE_NAMES,languageCode,createTranslator} from './i18n.mjs';
const KEY='creatorHub.language',textRecords=new WeakMap(),attributeRecords=new WeakMap(),catalogs=new Map();
let language='HU',translate=value=>value,observer,pending=false,changing=false,revision=0,selector;
export const getLanguage=()=>language;
export const getLocale=()=>({HU:'hu-HU',EN:'en-GB',DE:'de-DE',FR:'fr-FR',ES:'es-ES',IT:'it-IT',PT:'pt-PT',PL:'pl-PL'})[language];
export const translateText=value=>translate(value);
export function sourceText(element){if(!element)return '';if(element.childNodes.length===1&&element.firstChild.nodeType===3)return textRecords.get(element.firstChild)?.source??element.textContent;return [...element.childNodes].map(n=>n.nodeType===3?(textRecords.get(n)?.source??n.nodeValue):sourceText(n)).join('');}
const ignored='script,style,textarea,pre,code,[contenteditable=true],[data-i18n-ignore],#assistantResult,#recipeFields dd,#assetMeta dd,#assetDescription,.quickPrompt p,.quickPrompt summary span,.quickLoras,.historyCard>small,.historyCard>.muted,.assetCard .assetName,.assetCard small,#activeModelName,.activeLoraName,#assetPath,#historyPreviewTitle,.mediaViewerTitle';
async function catalog(code){if(code==='HU')return {};if(!catalogs.has(code))catalogs.set(code,fetch('/locales/'+code+'.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('Language pack unavailable: '+code);return r.json();}));return catalogs.get(code);}
function localize(root=document.body){
 if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){if(!node.parentElement||node.parentElement.closest(ignored))continue;const current=node.nodeValue,previous=textRecords.get(node),source=previous&&current===previous.output?previous.source:current,output=translate(source);textRecords.set(node,{source,output});if(current!==output)node.nodeValue=output;}
 const elements=root.nodeType===1?[root,...root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')]:[];
 for(const element of elements){if(element.closest('[data-i18n-ignore]'))continue;let records=attributeRecords.get(element);if(!records){records={};attributeRecords.set(element,records);}for(const name of ['title','placeholder','aria-label','alt']){if(!element.hasAttribute(name))continue;const current=element.getAttribute(name),old=records[name],source=old&&current===old.output?old.source:current,output=translate(source);records[name]={source,output};if(current!==output)element.setAttribute(name,output);}}
}
function schedule(){if(pending||changing)return;pending=true;queueMicrotask(()=>{pending=false;observer?.disconnect();localize();observe();});}
function observe(){observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});}
export async function setLanguage(code){
 const next=languageCode(code),version=++revision;changing=true;try{const english=await catalog('EN'),selected=next==='HU'?{}:await catalog(next);if(version!==revision)return;language=next;const raw=next==='HU'?v=>v:createTranslator(selected,english),cache=new Map();translate=value=>{if(cache.has(value))return cache.get(value);const result=raw(value);if(cache.size>4000)cache.delete(cache.keys().next().value);cache.set(value,result);return result;};try{localStorage.setItem(KEY,next);}catch{}document.documentElement.lang=next.toLowerCase();if(selector)selector.value=next;observer?.disconnect();localize();observe();window.dispatchEvent(new CustomEvent('creator-hub-language',{detail:{language:next}}));}finally{if(version===revision){changing=false;schedule();}}
}
export async function installLanguageUI(){
 const url=new URL(location.href),query=url.searchParams.get('lang'),fallback=document.querySelector('meta[name=creatorhub-default-language]')?.content||'auto';let saved;try{saved=localStorage.getItem(KEY);}catch{}
 const selected=languageCode(query||saved||(fallback==='auto'?navigator.language:fallback));
 const bar=document.createElement('label');bar.className='hubLanguage';bar.dataset.i18nIgnore='true';bar.append(document.createTextNode('🌐 '));selector=document.createElement('select');selector.id='hubLanguage';selector.setAttribute('aria-label','Interface language');for(const code of LANGUAGES)selector.add(new Option(LANGUAGE_NAMES[code],code));bar.append(selector);
 (document.querySelector('header nav')||document.querySelector('body>header')||document.body).append(bar);
 const error=document.createElement('span');error.id='hubLanguageError';error.setAttribute('role','status');bar.append(error);
 selector.onchange=()=>void setLanguage(selector.value).then(()=>{error.textContent='';if(url.searchParams.has('lang')){url.searchParams.set('lang',language);history.replaceState(history.state,'',url);}}).catch(()=>{selector.value=language;error.textContent='Language pack unavailable. Refresh the page.';});
 observer=new MutationObserver(schedule);
 const originalConfirm=window.confirm.bind(window),originalPrompt=window.prompt.bind(window);window.confirm=text=>originalConfirm(translate(text));window.prompt=(text,value)=>originalPrompt(translate(text),value);
 window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==language)void setLanguage(e.newValue).catch(()=>{});});
 try{await setLanguage(selected);}catch{language='HU';selector.value=language;error.textContent='Language pack unavailable. Refresh the page.';observe();}
 document.documentElement.dataset.i18nReady='true';return {setLanguage,getLanguage};
}
