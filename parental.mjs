// 0.16 DEV — 🛡 Szülői felügyelet a gyerekprofilokhoz. Minden ellenőrzés a szerveren fut (a felület csak megjeleníti):
// csak a szülő által engedélyezett modellek, LoRA-k csak külön engedéllyel, tiltott szavak a promptban, kötelező biztonsági
// negatív prompt, MI-segítő és rendszerbeállítások (modellletöltés, motor, frissítések, mappák) tiltva.
import {currentProfile} from './profiles.mjs';
export const DEFAULT_RESTRICTIONS={models:[],loras:false,assistant:false,words:true};
export const SAFE_NEGATIVE='nsfw, nude, naked, nudity, sexual, explicit, erotic, lingerie, gore, blood, violence, weapon, horror';
export function cleanRestrictions(r={}){return {models:[...new Set((Array.isArray(r.models)?r.models:[]).map(v=>String(v).split(/[\\/]/).pop().slice(0,260)).filter(Boolean))].slice(0,500),loras:r.loras===true,assistant:r.assistant===true,words:r.words!==false};}
export function restrictionsFor(profile){if(!profile||profile.role!=='child')return null;return cleanRestrictions({...DEFAULT_RESTRICTIONS,...(profile.restrictions||{})});}
export const activeRestrictions=()=>restrictionsFor(currentProfile());
// Szótövek (szó elején illesztve, utána bármi jöhet): angol + a Hub nyelvei. Szándékosan rövid, jól ismert lista.
const STEMS='nsfw sexy sexual nude nudit naked nake sex porn erotic hentai nipple breast boob topless bottomless genital penis vagina pussy dick cock cum orgasm fetish bdsm bondage lingerie undress strip onlyfans xxx lewd ahegao rule34 gore decapitat dismember mutilat torture corpse suicide self-harm selfharm rape murder kill blood bloody behead meztelen puc\u00e9r szex erotik porn\u00f3 mell mellbimb\u00f3 feh\u00e9rnem\u0171 vetk\u0151z v\u00e9r v\u00e9res gyilkos \u00f6ngyilk er\u0151szak hulla k\u00ednz\u00e1s nackt erotisch br\u00fcste blut mord selbstmord nu nue \u00e9rotique seins sang meurtre desnud er\u00f3tic sangre asesin nuda nudo sesso sangue omicid nua assassin nag seks krew morderst samob\u00f3j'.split(' ');
const RX=new RegExp('(?<![\\p{L}\\p{N}])('+[...STEMS].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','iu');
// rövid tövek, amelyek csak egész szóként tiltottak (különben ártatlan szavakat is fognának: „nu” → „number”, „mell” → „mellow”)
const WHOLE=new Set(['nu','nue','nua','nag','cum','sex','v\u00e9r','mell','nake','strip','dick','cock','blood','sang','mord','krew','hulla','mell']);
export function blockedWord(text){const s=String(text||'');let m,rx=new RegExp(RX.source,'giu');while((m=rx.exec(s))){const w=m[1].toLowerCase(),after=s.slice(m.index+m[0].length);if(WHOLE.has(w)&&/^[\p{L}\p{N}]/u.test(after))continue;return w;}return null;}
const base=n=>String(n||'').split(/[\\/]/).pop().toLowerCase();
/** A workflow-ban használt fő modellek és LoRA-k (a segédfájlok – VAE, szövegkódoló – nem számítanak). */
export function sourceModels(prompt={}){const models=[],loras=[];for(const n of Object.values(prompt||{})){const i=n?.inputs||{};for(const k of ['ckpt_name','unet_name'])if(typeof i[k]==='string')models.push(i[k]);if(typeof i.lora_name==='string'&&i.lora_name!=='None')loras.push(i.lora_name);}return {models,loras};}
/** Generálás előtt (szerveren): kivételt dob, ha a gyerekprofilnak nem engedélyezett; a negatív promptot kiegészíti. */
export function checkPlan(data,bundle,r=activeRestrictions()){if(!r)return;const {models,loras}=sourceModels(bundle?.prompt);const allowed=new Set(r.models.map(base));
 for(const m of models)if(!allowed.has(base(m)))throw Error('Ez a modell nincs engedélyezve ebben a profilban. Kérd meg a szülőt, hogy engedélyezze.');
 if(loras.length&&!r.loras)throw Error('A LoRA-k használata nincs engedélyezve ebben a profilban.');
 for(const s of data?.shots||[]){if(r.words){for(const t of [s.prompt,data.prompt])if(blockedWord(t))throw Error('Ez a prompt ebben a profilban nem használható. Fogalmazd át, vagy kérd a szülő segítségét.');}const neg=String(s.negative??data.negative??'').trim();if(!neg.includes(SAFE_NEGATIVE))s.negative=[neg,SAFE_NEGATIVE].filter(Boolean).join(', ');}}
export function filterCatalog(list,r=activeRestrictions()){if(!r||!list||!Array.isArray(list.models))return list;const allowed=new Set(r.models.map(base));return {...list,models:list.models.filter(m=>allowed.has(base(m.name))||allowed.has(base(m.file))||allowed.has(base(m.id)))};}
/** Gyerekprofilnál tiltott végpontok (rendszer, modellletöltés, beállítások, modellképek). null = engedélyezett. */
const DENY=['/api/models/','/api/engine/configure','/api/updates/check','/api/updates/install/plan','/api/updates/install/start','/api/updates/install/restart','/api/updates/install/restore','/api/updates/install/stop','/api/hub/restart','/api/hub/stop','/api/hub/cancel-restart','/api/hub/open-log','/api/studio/update','/api/studio/updates','/api/studio/local-ai','/api/library/add','/api/library/delete','/api/library/delete-plan','/api/library/manage','/api/library/folder','/api/library/open','/api/library/restore','/api/library/scan','/api/library/stop','/api/library/trash','/api/library/favorite','/api/library/thumbnail','/api/library/preview','/api/library/items','/api/library/detail','/api/library/workflow','/api/self-heal','/api/workflow/save-source','/api/workflow/reveal','/api/history/purge'];
export function deniedPath(pathname,method='GET',r=activeRestrictions()){if(!r)return null;
 if(pathname==='/api/studio/assistant'||pathname==='/api/studio/assistant/state')return r.assistant?null:'Az MI-segítő ebben a profilban nincs engedélyezve.';
 if(pathname==='/api/history/settings'&&method==='POST')return 'Ez a funkció a gyerekprofilban nem érhető el.';
 if(DENY.some(d=>d.endsWith('/')?pathname.startsWith(d):pathname===d))return 'Ez a funkció a gyerekprofilban nem érhető el.';return null;}
