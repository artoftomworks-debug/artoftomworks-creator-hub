import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LANGUAGES,languageCode,createTranslator} from '../i18n.mjs';
test('Global uses the exact Prompt Studio language set and accepts browser locale codes',()=>{assert.deepEqual(LANGUAGES,['HU','EN','DE','FR','ES','IT','PT','PL']);assert.equal(languageCode('pt-BR'),'PT');assert.equal(languageCode('xx'),'EN');});
test('dynamic translation preserves user data, filenames, placeholders and whitespace',()=>{
 const t=createTranslator({'Aktív modell: ${0}':'Active model: ${0}','${0} kijelölve':'${0} selected','Sorozat: ${0} / ${1} kész':'Series: ${0} / ${1} complete','Kép':'Image'}, {'Hiba: ${0}':'Error: ${0}'});
 assert.equal(t('Aktív modell: Kép.safetensors'),'Active model: Kép.safetensors');assert.equal(t('2 kijelölve'),'2 selected');assert.equal(t('Sorozat: 1 / 3 kész'),'Series: 1 / 3 complete');assert.equal(t('Hiba: saját prompt'),'Error: saját prompt');assert.equal(t('  Kép  '),'  Image  ');assert.equal(t('My untouched custom prompt'),'My untouched custom prompt');assert.equal(t('C:\\képek\\Kép.png'),'C:\\képek\\Kép.png');
});
test('language catalogs have usable core actions and preserve every translated template slot',async()=>{
 for(const code of LANGUAGES.filter(c=>c!=='HU')){const catalog=JSON.parse(await readFile(new URL('../locales/'+code+'.json',import.meta.url),'utf8'));assert(catalog['Generálás indítása']);assert(catalog['MI-segítő']);for(const [key,value]of Object.entries(catalog)){assert.equal(typeof value,'string');const slots=s=>[...s.matchAll(/\$\{\d+\}/g)].map(m=>m[0]).sort();assert.deepEqual(slots(value),slots(key),code+': '+key);}}
});
