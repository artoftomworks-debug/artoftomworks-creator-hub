// 0.16 DEV — fordítás-ellenőrző: minden magyar felületi szövegnek legyen fordítása mind a 7 nyelven (EN DE FR ES IT PT PL).
// A korábbról örökölt hiányokat a tests_dev/i18n-baseline.json rögzíti; egy ÚJ, fordítás nélküli szöveg elbuktatja a tesztet.
// Új funkciónál: add hozzá a szöveget a locales/*.json fájlokhoz (a magyar mondat a kulcs; változó rész: ${0}, ${1} …).
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const HUB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const LANGS=['EN','DE','FR','ES','IT','PT','PL'];
// Csak naplóba / fájlba kerülő vagy keresőkulcs-szövegek, és futás közben töredékként fordított összetételek.
export const ALLOW=new Set(['frissítés update updates verzió version github node csomag','A Hub leállt (a ⏻ Hub gombbal).','tálcaikon indítása (port ${0})','a PowerShell nem indult','a tálcaikon folyamata kilépett (kód','Készült','Méret: ${0}×${1}','Videó: ${0} képkocka · ${1} fps · ${2} s','Ellenőrzés · ${0}${1}${2}','Már fut.','Ezt az ablakot hagyd nyitva. Ctrl+C: leállítás.']);
const HU=/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]|\b(nem|és|vagy|mert|egy|kép|modell|mentés|leállít|indít)\w*/i;
function literals(src){const out=[];const re=/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;let m;while((m=re.exec(src)))out.push(m[1]??m[2]);return out;}
const norm=s=>s.replace(/\s+/g,' ').trim();
export function candidates(src){const out=new Set();for(let raw of literals(src)){raw=raw.replace(/\\n/g,' ').replace(/\\'/g,"'");let slots=0;const t=raw.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g,()=>'${'+(slots++)+'}');
  const s=norm(t),plain=s.replace(/\$\{\d+\}/g,'');if(s.length<3||!HU.test(plain))continue;if(/^[\w./\\:-]+$/.test(s)||/[<>]|=>|==|\)\s*\{|;\s*\}|;\w|^\/|\.mjs|\.json|\\\\|\{[a-z]/i.test(plain))continue;
  const core=s.replace(/^[\s·:—–⚠✦✓↻⏻◼▶☆★⤓▦⧉⏸✕↗⚙📄💾…×,.()-]+|[\s·:—–(,]+$/g,'').trim();if(core.replace(/\$\{\d+\}/g,'').trim().length<3)continue;out.add(core);}return out;}
export function covered(core,catalog,keys){if(core in catalog)return true;for(const k of keys)if(k.includes(core))return true;
  const re=new RegExp('^'+core.split(/\$\{\d+\}/).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');for(const k of keys)if(re.test(k.replace(/\$\{\d+\}/g,'X')))return true;return false;}
export function gaps(lang){const cat=JSON.parse(fs.readFileSync(path.join(HUB,'locales',lang+'.json'),'utf8')),keys=Object.keys(cat),miss=new Set();
  for(const f of fs.readdirSync(HUB).filter(f=>f.endsWith('.mjs')&&f!=='chain-refresh.mjs').sort())for(const c of candidates(fs.readFileSync(path.join(HUB,f),'utf8')))if(!ALLOW.has(c)&&!covered(c,cat,keys))miss.add(c);return miss;}
const baselineFile=path.join(HUB,'tests_dev','i18n-baseline.json');
test('no new Hungarian UI text without translation (all 7 languages)',()=>{const base=JSON.parse(fs.readFileSync(baselineFile,'utf8'));const fresh={};
  for(const l of LANGS){const known=new Set(base[l]||[]);const extra=[...gaps(l)].filter(c=>!known.has(c));if(extra.length)fresh[l]=extra;}
  assert.deepEqual(fresh,{},'Fordítás nélküli új szövegek:\n'+JSON.stringify(fresh,null,1));});
test('placeholders match in every catalog entry',()=>{for(const l of LANGS){const cat=JSON.parse(fs.readFileSync(path.join(HUB,'locales',l+'.json'),'utf8'));for(const[k,v]of Object.entries(cat)){const s=x=>(x.match(/\$\{\d+\}/g)||[]).sort().join();assert.equal(s(v),s(k),l+': '+k);}}});
if(process.argv.includes('--write-baseline')){const out={};for(const l of LANGS)out[l]=[...gaps(l)].sort();fs.writeFileSync(baselineFile,JSON.stringify(out,null,1)+'\n');console.log('baseline:',Object.fromEntries(LANGS.map(l=>[l,out[l].length])));}
