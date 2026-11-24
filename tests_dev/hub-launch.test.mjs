import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {launch,logFile} from '../hub-launch.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'hublaunch-'));
test('launch: hidden server writes its address to the log → PORT line, exit 0',async()=>{
  const dir=temp();fs.writeFileSync(path.join(dir,'server.mjs'),"console.log('ArtofTomworks Creator Hub X\\nhttp://127.0.0.1:18977\\nEzt az ablakot hagyd nyitva.');setTimeout(()=>{},1500);");
  const out=[];const code=await launch({dir,out:s=>out.push(s),timeoutMS:8000});
  assert.equal(code,0);assert.ok(out.includes('PORT=18977'));assert.match(fs.readFileSync(logFile(dir),'utf8'),/==== Creator Hub indítása/);
});
test('launch: server that crashes → exit 1 with the log tail',async()=>{
  const dir=temp();fs.writeFileSync(path.join(dir,'server.mjs'),"console.error('Hiba: Nincs szabad helyi port.');process.exit(3);");
  const out=[];const code=await launch({dir,out:s=>out.push(s),timeoutMS:8000});
  assert.equal(code,1);assert.match(out.join('\n'),/Nincs szabad helyi port/);
});
test('launch: "Már fut." is reported as success',async()=>{
  const dir=temp();fs.writeFileSync(path.join(dir,'server.mjs'),"console.log('ArtofTomworks Creator Hub X\\nhttp://127.0.0.1:18902\\nMár fut.');");
  const out=[];assert.equal(await launch({dir,out:s=>out.push(s),timeoutMS:8000}),0);assert.match(out.join('\n'),/már futott/);
});
