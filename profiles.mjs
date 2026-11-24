// 0.16 DEV — 👤 Profilok: helyi bejelentkezés a Hubba. Amíg nincs profil, minden a régi, egyfelhasználós módon működik.
// Az első (elsődleges, rendszergazda) profilé marad minden korábbi adat (data/…); a többi profil adatai data/profiles/<id>/ alatt,
// a képei a kimeneti mappán belül Profil_<név> almappában. Minden profil csak a sajátját látja.
// A jelszó scrypttel, sóval tárolódik; a munkamenet-tokennek csak a SHA-256 kivonata kerül lemezre.
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import path from 'node:path';
import {randomBytes,randomUUID,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {atomicJSON,setWriteHook} from './storage.mjs';
const scrypt=promisify(scryptCb);
export const profileContext=new AsyncLocalStorage();
const SCHEMA='artoftomworks.creator-hub.profiles',ROLES=['admin','user','child'],SESSION_DAYS=14,COOKIE='hubSession';
let state={root:null,db:{schema:SCHEMA,profiles:[]},sessions:new Map(),loaded:false,failures:new Map()};
const sha=t=>createHash('sha256').update(String(t)).digest('hex');
const pub=p=>p&&{id:p.id,name:p.name,role:p.role,primary:!!p.primary,created:p.created,restrictions:p.restrictions||null};
export const profilesEnabled=()=>state.db.profiles.length>0;
export const primaryId=()=>state.db.profiles.find(p=>p.primary)?.id||'';
/** A kérést kiszolgáló profil (vagy null, ha nincs bejelentkezés / nincs profil mód). */
export const currentProfile=()=>{const s=profileContext.getStore();return s&&s.id?s:null;};
export const isPrimary=p=>!p||!profilesEnabled()||!!p.primary;
/** Látható-e egy elem (futás, sorbejegyzés) a jelenlegi profilnak. Profilmód nélkül mindig igen. */
export function visibleTo(owner){if(!profilesEnabled())return true;if(profileContext.getStore()?.system)return true;const p=currentProfile();if(!p)return false;return (owner||primaryId())===p.id;}
/** Profilonkénti adatfájl: az elsődleges profil (és a profil nélküli mód) a régi helyet használja. */
export function profileDataFile(root,name){const p=currentProfile();return p&&!p.primary?path.join(root,'data','profiles',p.id,name):path.join(root,'data',name);}
export const safeFolderName=n=>String(n||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'profil';
/** A kimeneti mappán belüli profil-almappa ('' az elsődleges profilnál). */
export function profileOutputSegment(){const p=currentProfile();return p&&!p.primary?'/Profil_'+safeFolderName(p.name):'';}
export function cleanName(v){const n=String(v??'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,40);if(!n)throw Error('Adj nevet a profilnak.');return n;}
async function hashPassword(pw,salt=randomBytes(16).toString('hex')){if(typeof pw!=='string'||pw.length<4||pw.length>200)throw Error('A jelszó legalább 4 karakter legyen.');const h=(await scrypt(pw,salt,32)).toString('hex');return {salt,hash:h};}
async function checkPassword(p,pw){if(typeof pw!=='string'||!p?.hash)return false;const h=await scrypt(pw,p.salt,32);const a=Buffer.from(p.hash,'hex');return a.length===h.length&&timingSafeEqual(a,h);}
const file=()=>path.join(state.root,'data','profiles.json'),sessFile=()=>path.join(state.root,'data','profile-sessions.json');
async function persist(){await atomicJSON(file(),state.db);}
async function persistSessions(){const out={};for(const [k,v] of state.sessions)if(v.expires>Date.now())out[k]=v;await atomicJSON(sessFile(),{schema:SCHEMA+'.sessions',sessions:out});}
export async function initProfiles(root){state.root=root;try{const v=JSON.parse(await readFile(file(),'utf8'));if(v.schema===SCHEMA&&Array.isArray(v.profiles))state.db=v;}catch(e){if(e.code!=='ENOENT')throw e;}
 try{const v=JSON.parse(await readFile(sessFile(),'utf8'));for(const [k,s] of Object.entries(v.sessions||{}))if(s.expires>Date.now()&&state.db.profiles.some(p=>p.id===s.id))state.sessions.set(k,s);}catch{}
 state.loaded=true;
 /* új futásfájl → a létrehozó profil jelölése (csak létrehozáskor, hogy a háttérfrissítések ne írják át) */
 setWriteHook((target,value)=>{if(!profilesEnabled()||!value||value.schema!=='artoftomworks.scene-dna.run'||value.profile)return;if(!/[\\/]data[\\/]runs[\\/][a-f0-9]{32}\.json$/.test(target)||existsSync(target))return;const p=currentProfile();if(p&&!p.primary)value.profile=p.id;});}
function cookieToken(req){const m=String(req.headers.cookie||'').match(/(?:^|;\s*)hubSession=([A-Za-z0-9_-]{20,200})/);return m?m[1]:'';}
/** A kérés profilja a süti alapján (null, ha nincs érvényes munkamenet). */
export function profileFor(req){if(!profilesEnabled())return null;const t=cookieToken(req);if(!t)return null;const s=state.sessions.get(sha(t));if(!s||s.expires<Date.now())return null;const p=state.db.profiles.find(x=>x.id===s.id);return p?pub(p):null;}
const cookie=(t,maxAge)=>`${COOKIE}=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
export function publicState(req){const me=profileFor(req);return {enabled:profilesEnabled(),current:me,profiles:profilesEnabled()?state.db.profiles.map(p=>({id:p.id,name:p.name,role:p.role,...(me?.role==='admin'?{restrictions:p.restrictions||null}:{})})):[]};}
export async function login(req,res,{id,password}={}){const p=state.db.profiles.find(x=>x.id===String(id||''));const key=String(id||'?'),f=state.failures.get(key)||{n:0,until:0};
 if(f.until>Date.now()){const sec=Math.ceil((f.until-Date.now())/1000);throw Error(`Túl sok sikertelen próbálkozás. Várj ${sec} másodpercet.`);}
 if(!p||!(await checkPassword(p,password))){f.n++;if(f.n>=5){f.until=Date.now()+30000;f.n=0;}state.failures.set(key,f);throw Error('Hibás profil vagy jelszó.');}
 state.failures.delete(key);const t=randomBytes(32).toString('base64url');state.sessions.set(sha(t),{id:p.id,expires:Date.now()+SESSION_DAYS*86400000});await persistSessions();res.setHeader('Set-Cookie',cookie(t,SESSION_DAYS*86400));return {current:pub(p)};}
export async function logout(req,res){const t=cookieToken(req);if(t){state.sessions.delete(sha(t));await persistSessions();}res.setHeader('Set-Cookie',cookie('x',0));return {loggedOut:true};}
function requireAdmin(req){const me=profileFor(req);if(!me||me.role!=='admin')throw Error('Ehhez rendszergazda profil szükséges.');return me;}
/** Új profil. Ha még nincs egy sem: ez lesz az elsődleges rendszergazda (és a meglévő adatok gazdája), és be is jelentkezik. */
export async function createProfile(req,res,{name,password,role}={}){const first=!profilesEnabled();if(!first)requireAdmin(req);const n=cleanName(name);
 if(state.db.profiles.some(p=>p.name.toLocaleLowerCase()===n.toLocaleLowerCase()))throw Error('Már van ilyen nevű profil.');if(state.db.profiles.length>=20)throw Error('Legfeljebb 20 profil lehet.');
 const r=first?'admin':ROLES.includes(role)?role:'user';const {salt,hash}=await hashPassword(password);const p={id:randomUUID().replaceAll('-',''),name:n,role:r,primary:first,salt,hash,created:Date.now()};
 state.db.profiles.push(p);await persist();if(first){await login(req,res,{id:p.id,password});}return {profile:pub(p),profiles:publicState(req).profiles};}
export async function updateProfile(req,res,{id,name,password,oldPassword,role,restrictions}={}){const me=profileFor(req);if(!me)throw Error('Jelentkezz be.');const target=state.db.profiles.find(p=>p.id===String(id||me.id));if(!target)throw Error('Nincs ilyen profil.');
 const self=target.id===me.id;if(!self)requireAdmin(req);
 if(self&&password!=null&&me.role!=='admin'&&!(await checkPassword(target,oldPassword)))throw Error('A jelenlegi jelszó nem stimmel.');
 if(name!=null){const n=cleanName(name);if(state.db.profiles.some(p=>p.id!==target.id&&p.name.toLocaleLowerCase()===n.toLocaleLowerCase()))throw Error('Már van ilyen nevű profil.');target.name=n;}
 if(password!=null)Object.assign(target,await hashPassword(password));
 if(role!=null&&!target.primary){requireAdmin(req);if(!ROLES.includes(role))throw Error('Ismeretlen szerep.');target.role=role;}
 if(restrictions!=null){requireAdmin(req);if(self)throw Error('A saját profilod korlátait nem állíthatod.');const {cleanRestrictions}=await import('./parental.mjs');target.restrictions=cleanRestrictions(restrictions);}
 await persist();return {profile:pub(target)};}
export async function deleteProfile(req,res,{id,password}={}){const me=requireAdmin(req);const target=state.db.profiles.find(p=>p.id===String(id||''));if(!target)throw Error('Nincs ilyen profil.');if(target.primary)throw Error('Az elsődleges profil nem törölhető.');
 const meFull=state.db.profiles.find(p=>p.id===me.id);if(!(await checkPassword(meFull,password)))throw Error('A törléshez add meg a saját jelszavadat.');
 state.db.profiles=state.db.profiles.filter(p=>p.id!==target.id);for(const [k,s] of state.sessions)if(s.id===target.id)state.sessions.delete(k);await persist();await persistSessions();
 return {removed:target.id,note:'A profil képei és adatai a lemezen megmaradtak.'};}
/** Profilmód kikapcsolása: csak az elsődleges rendszergazda, csak ha nincs más profil. Az adatok megmaradnak. */
export async function disableProfiles(req,res,{password}={}){const me=requireAdmin(req);const full=state.db.profiles.find(p=>p.id===me.id);if(!full?.primary)throw Error('Csak az elsődleges profil kapcsolhatja ki.');if(state.db.profiles.length>1)throw Error('Előbb töröld a többi profilt.');if(!(await checkPassword(full,password)))throw Error('Hibás jelszó.');
 state.db={schema:SCHEMA,profiles:[]};state.sessions.clear();await persist();await persistSessions();res.setHeader('Set-Cookie',cookie('x',0));return {disabled:true};}
/** Futtatás egy adott profil nevében (pl. a generálási sor háttérben induló terveinél). */
export function runAs(profileId,fn){const p=profileId?state.db.profiles.find(x=>x.id===profileId):null;return profileContext.run(p?pub(p):{id:''},fn);}
