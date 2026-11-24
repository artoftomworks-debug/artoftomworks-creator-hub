import test from 'node:test';import assert from 'node:assert/strict';
import {cleanTheme,themeVars,themeWarnings,contrast,PRESETS} from '../theme-ui.mjs';
test('theme cleaning rejects unsafe values',()=>{const t=cleanTheme({preset:'x',accent:'red',bgImage:'http://a/b.png',blur:99});assert.equal(t.preset,'default');assert.equal(t.accent,'');assert.equal(t.bgImage,'');assert.equal(t.blur,30);
 assert.equal(cleanTheme({bgImage:'https://example.com/a.jpg'}).bgImage,'https://example.com/a.jpg');assert.equal(cleanTheme({bgImage:'https://x.com/a.jpg")'}).bgImage,'');});
test('all presets pass the contrast checks',()=>{for(const p of PRESETS)assert.deepEqual(themeWarnings(cleanTheme({preset:p.id})),[],p.id);assert.ok(themeWarnings(cleanTheme({accent:'#203040'})).length>0);assert.ok(contrast('#ffffff','#000000')>20);assert.equal(themeVars(cleanTheme({accent:'#123456'})).gold,'#123456');});
