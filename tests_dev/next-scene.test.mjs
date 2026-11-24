// 0.16 DEV — „Következő jelenet” asszisztens
import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
const {manualPrompt,colorMatch}=await import('../next-scene-ui.mjs');
import {createAssistantService} from '../assistant-service.mjs';
import {cleanBoard} from '../storyboard-model.mjs';
const IMG='data:image/png;base64,iVBORw0KGgo=';
function fakeOllama(reply){const calls=[];return {calls,fetchImpl:async(url,o)=>{const route=new URL(url).pathname,body=o.body?JSON.parse(o.body):null;calls.push({route,body});
 if(route==='/api/tags')return new Response(JSON.stringify({models:[{name:'vision:9b',size:1}]}));if(route==='/api/show')return new Response(JSON.stringify({capabilities:['completion','vision']}));
 if(route==='/api/chat')return new Response(JSON.stringify({message:{content:JSON.stringify(reply(body))}}));return new Response('{}');}};}
test('manual prompt keeps the constants; colour match is symmetric and bounded',()=>{assert.equal(manualPrompt('walks out',{prompt_hint:'red coat',light:''}),'walks out, red coat');const a={r:100,g:100,b:100,l:100};assert.equal(colorMatch(a,a),100);assert.ok(colorMatch(a,{r:255,g:0,b:0,l:54})<70);assert.equal(colorMatch(null,a),null);});
test('continuity sheet: image sent, fields cleaned and limited',async()=>{const f=fakeOllama(()=>({subject:'nő',clothing:'piros kabát',facing:'jobbra',extra:'x',prompt_hint:'woman in red coat'}));const svc=createAssistantService({fetchImpl:f.fetchImpl});
 const r=await svc.request({action:'continuity',model:'vision:9b',image:IMG});assert.equal(r.sheet.clothing,'piros kabát');assert.equal(r.sheet.extra,undefined);assert.equal(r.sheet.light,'');const chat=f.calls.find(c=>c.route==='/api/chat');assert.equal(chat.body.messages[1].images.length,1);});
test('next prompt needs an intent and returns the text',async()=>{const f=fakeOllama(()=>({prompt:'woman in red coat steps out into the rainy street, warm light from left'}));const svc=createAssistantService({fetchImpl:f.fetchImpl});
 await assert.rejects(svc.request({action:'nextPrompt',model:'vision:9b',sheet:{},intent:'  '}),/egy mondatban/);const r=await svc.request({action:'nextPrompt',model:'vision:9b',sheet:{clothing:'piros kabát'},intent:'kilép az utcára'});assert.match(r.prompt,/red coat/);});
test('candidate check: strict booleans, mirror flag, score clamp',async()=>{const f=fakeOllama(()=>({subject:{ok:true,note:'ugyanaz'},clothing:{ok:'yes'},light:{ok:true},facing:{ok:false,note:'balra néz'},mirror_fixes:true,score:14}));const svc=createAssistantService({fetchImpl:f.fetchImpl});
 const r=await svc.request({action:'continuityCheck',model:'vision:9b',sheet:{facing:'jobbra'},image:IMG});assert.equal(r.checks.subject.ok,true);assert.equal(r.checks.clothing.ok,false);assert.equal(r.checks.facing.ok,false);assert.equal(r.mirror,true);assert.equal(r.score,10);});
test('busy generation blocks the AI check with a clear message',async()=>{const f=fakeOllama(()=>({}));const svc=createAssistantService({fetchImpl:f.fetchImpl,isGenerationBusy:async()=>true});await assert.rejects(svc.request({action:'continuity',model:'vision:9b',image:IMG}),/generálás fut/i);});
test('storyboard keeps the mirror flag',()=>{const b=cleanBoard({name:'x',shots:[{text:'a',mirror:true},{text:'b',mirror:'yes'}]});assert.equal(b.shots[0].mirror,true);assert.equal(b.shots[1].mirror,false);});
