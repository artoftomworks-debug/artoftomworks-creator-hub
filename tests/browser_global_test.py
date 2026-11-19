import asyncio,base64,json,subprocess,tempfile,time,sys
from pathlib import Path
from aiohttp import ClientSession
import shutil,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/.runtime/browser-qa'
OUT.mkdir(parents=True,exist_ok=True)
NODE=Path(os.environ.get('HUB_TEST_NODE') or shutil.which('node') or str(ROOT/'runtime/node.exe'))
class CDP:
 def __init__(self,ws):self.ws=ws;self.seq=0;self.pending={};self.errors=[];self.reader=asyncio.create_task(self.read())
 async def read(self):
  async for m in self.ws:
   if m.type.name!='TEXT':continue
   data=json.loads(m.data)
   if 'id' in data:
    f=self.pending.pop(data['id'],None)
    if f and not f.done():
     if 'error' in data:f.set_exception(RuntimeError(str(data['error'])))
     else:f.set_result(data.get('result',{}))
   elif data.get('method')=='Runtime.exceptionThrown':self.errors.append(data['params'])
 async def call(self,method,**params):
  self.seq+=1;f=asyncio.get_running_loop().create_future();self.pending[self.seq]=f;await self.ws.send_json({'id':self.seq,'method':method,'params':params});return await asyncio.wait_for(f,25)
 async def eval(self,expression):
  r=await self.call('Runtime.evaluate',expression=expression,awaitPromise=True,returnByValue=True,userGesture=True)
  if r.get('exceptionDetails'):raise AssertionError(r['exceptionDetails'])
  return r.get('result',{}).get('value')
 async def wait(self,expression,seconds=12):
  end=time.monotonic()+seconds
  while time.monotonic()<end:
   if await self.eval(expression):return
   await asyncio.sleep(.06)
  raise AssertionError('Timeout: '+expression+'; UI='+str(await self.eval("[document.querySelector('#message')?.textContent,document.querySelector('#libraryMessage')?.textContent,document.querySelector('#libraryKind')?.value,document.querySelector('#libraryTotal')?.textContent]"))+'; errors='+str(self.errors))
 async def file(self,selector,path):
  doc=await self.call('DOM.getDocument');n=await self.call('DOM.querySelector',nodeId=doc['root']['nodeId'],selector=selector);await self.call('DOM.setFileInputFiles',nodeId=n['nodeId'],files=[str(path)])
async def main():
 with tempfile.TemporaryDirectory(prefix='hub-browser-',dir=OUT) as temp:
  tmp=Path(temp);server=browser=cdp=None
  try:
   shutil.copyfile(ROOT/'tests/fixtures/live-preview.mp4',tmp/'fixture.mp4')
   cover=ROOT/'assets/cover.png'
   server=subprocess.Popen([str(NODE),str(ROOT/'tests/browser-fixture.mjs'),str(tmp),str(cover)]+['--studio012-fixture','--assistant-fixture'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW)
   for _ in range(100):
    if (tmp/'server.json').exists():break
    if server.poll() is not None:raise AssertionError(server.stderr.read().decode())
    await asyncio.sleep(.1)
   base='http://127.0.0.1:'+str(json.loads((tmp/'server.json').read_text())['port']);profile=tmp/'profile'
   browser=subprocess.Popen([os.environ.get('HUB_TEST_BROWSER','C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'),'--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--remote-allow-origins=*','--window-size=1700,1150','--user-data-dir='+str(profile),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
   for _ in range(120):
    if (profile/'DevToolsActivePort').exists():break
    await asyncio.sleep(.1)
   port=int((profile/'DevToolsActivePort').read_text().splitlines()[0])
   async with ClientSession() as session:
    for _ in range(100):
     async with session.get(f'http://127.0.0.1:{port}/json/list') as r:targets=await r.json()
     if any(t['type']=='page' for t in targets):break
     await asyncio.sleep(.1)
    ws=await session.ws_connect(next(t for t in targets if t['type']=='page')['webSocketDebuggerUrl'],max_msg_size=64*1024**2);cdp=CDP(ws)
    await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('Page.navigate',url=base)
    await cdp.wait("document.body.dataset.ready==='true' && Array.from(document.querySelector('#automaticModel').options).some(o=>o.value==='checkpoints|krea-fixture.safetensors')")
    async def select_model(name):
     await cdp.eval("document.querySelector('#automaticModel').value="+json.dumps('checkpoints|'+name)+";document.querySelector('#automaticModel').dispatchEvent(new Event('change'))")
     await cdp.wait("document.querySelector('#automaticStatus').textContent.includes("+json.dumps('Aktív modell: '+name)+") && !document.querySelector('#automaticModel').disabled")
    async def add_lora(name):
     await cdp.eval("document.querySelector('#tab-loras').click();document.querySelector('#librarySearch').value="+json.dumps(name)+";document.querySelector('#librarySearch').dispatchEvent(new Event('input'))")
     await cdp.wait("!!document.querySelector('[data-asset-name="+json.dumps(name)+"] .assetOpen')")
     await cdp.eval("document.querySelector('[data-asset-name="+json.dumps(name)+"] .assetOpen').click()")
     await cdp.wait("!!document.querySelector('#activeLoras [data-lora="+json.dumps(name)+"]')")
    await select_model('fixture.safetensors')
    await cdp.eval("document.querySelector('#prompt').value='Kép: keep my exact user prompt, Árvíztűrő test';document.querySelector('#prompt').dispatchEvent(new Event('input'));document.querySelector('#negative').value='Modellek';document.querySelector('#negative').dispatchEvent(new Event('input'));document.querySelector('#seed').value='34567';document.querySelector('#seed').dispatchEvent(new Event('input'))")
    expected={'EN':'Generate','DE':'Generieren','FR':'Générer','ES':'Generar','IT':'Genera','PT':'Gerar','PL':'Generuj','HU':'Generálás indítása'}
    sampler_labels={'HU':'Saját sampler: BE','EN':'Custom sampler: ON','DE':'Eigener Sampler: AN','FR':'Échantillonneur personnalisé : OUI','ES':'Sampler propio: SÍ','IT':'Sampler personale: SÌ','PT':'Sampler próprio: LIGADO','PL':'Własny sampler: WŁ.'}
    for language,label in expected.items():
     await cdp.eval("document.querySelector('#hubLanguage').value="+json.dumps(language)+";document.querySelector('#hubLanguage').dispatchEvent(new Event('change'))")
     await cdp.wait("document.documentElement.lang==="+json.dumps(language.lower())+" && document.querySelector('#start').textContent==="+json.dumps(label))
     await cdp.wait("document.querySelector('#samplerOverride').textContent==="+json.dumps(sampler_labels[language]))
     assert await cdp.eval("document.querySelector('#prompt').value==='Kép: keep my exact user prompt, Árvíztűrő test' && document.querySelector('#negative').value==='Modellek' && document.querySelector('#seed').value==='34567' && document.querySelector('#automaticModel').value==='checkpoints|fixture.safetensors'")
     assert await cdp.eval("(async()=> (await import('/i18n-ui.mjs')).sourceText(document.querySelector('#start'))==='Generálás indítása')()")
    await cdp.eval("document.querySelector('#hubLanguage').value='EN';document.querySelector('#hubLanguage').dispatchEvent(new Event('change'))")
    await cdp.wait("document.querySelector('#start').textContent==='Generate'")
    await cdp.eval("document.querySelector('#schedulerOverride').click()")
    await cdp.wait("document.querySelector('#schedulerOverride').textContent==='Custom scheduler: OFF' && document.querySelector('#scheduler').disabled && document.querySelector('#schedulerEffective').textContent.includes('Default')")
    await cdp.eval("document.querySelector('#schedulerOverride').click()")
    await cdp.eval("document.querySelector('#openSetups').click()")
    await cdp.wait("document.querySelector('#setupsDialog h2').textContent==='Creative recipes'")
    await cdp.eval("document.querySelector('#closeSetups').click();document.querySelector('#openAssistant').click()")
    await cdp.wait("document.querySelector('#assistantDialog h2').textContent==='AI assistant'")
    await cdp.eval("document.querySelector('#closeAssistant').click();document.querySelector('#studioSearchButton').click();document.querySelector('#studioSearchInput').value='History';document.querySelector('#studioSearchInput').dispatchEvent(new Event('input'))")
    await cdp.wait("[...document.querySelectorAll('#studioSearch .commandMatches button')].some(b=>b.textContent==='History')")
    await cdp.eval("[...document.querySelectorAll('#studioSearch .commandMatches button')].find(b=>b.textContent==='History').click()")
    await cdp.wait("document.querySelector('#tab-history').getAttribute('aria-selected')==='true' || document.querySelector('#tab-history').classList.contains('selected')")
    await cdp.call('Page.reload');await cdp.wait("document.body.dataset.ready==='true' && document.documentElement.lang==='en' && document.querySelector('#start').textContent==='Generate'")
    assert await cdp.eval("document.querySelector('#prompt').value==='Kép: keep my exact user prompt, Árvíztűrő test' && document.querySelector('#seed').value==='34567'")
    shot=await cdp.call('Page.captureScreenshot',format='png');(OUT/'CreatorHub_0140_Global_EN.png').write_bytes(base64.b64decode(shot['data']))
    await cdp.call('Emulation.setDeviceMetricsOverride',width=900,height=900,deviceScaleFactor=1,mobile=False)
    await cdp.eval("document.querySelector('#hubLanguage').value='DE';document.querySelector('#hubLanguage').dispatchEvent(new Event('change'))")
    await cdp.wait("document.documentElement.lang==='de'")
    assert await cdp.eval("document.documentElement.scrollWidth<=window.innerWidth+2")
    await cdp.call('Page.navigate',url=base+'/?lang=HU')
    await cdp.wait("document.body.dataset.ready==='true' && document.documentElement.lang==='hu'")
    await cdp.eval("document.querySelector('#hubLanguage').value='EN';document.querySelector('#hubLanguage').dispatchEvent(new Event('change'))")
    await cdp.wait("document.documentElement.lang==='en' && new URL(location.href).searchParams.get('lang')==='EN'")
    await cdp.call('Page.reload');await cdp.wait("document.body.dataset.ready==='true' && document.documentElement.lang==='en'")
    for route in ['/image-editor','/loop-lab','/pose-studio']:
     await cdp.call('Page.navigate',url=base+route+'?lang=EN')
     await cdp.wait("document.documentElement.dataset.i18nReady==='true' && document.querySelector('#hubLanguage').value==='EN'")
     await cdp.eval("document.querySelector('#hubLanguage').value='PL';document.querySelector('#hubLanguage').dispatchEvent(new Event('change'))")
     await cdp.wait("document.documentElement.lang==='pl'")
    assert not cdp.errors,cdp.errors
    assert not (tmp/'requests.json').exists(),'Language switching must not generate'
    print(json.dumps({'passed':['eight Prompt Studio languages','live switch and Hungarian restoration','prompt, negative prompt, model and seed remain exact','source labels survive translation','dynamic recipe and assistant dialogs','translated function search','language preference survives reload','900px German layout','no generation started'],'screenshot':'CreatorHub_0140_Global_EN.png'}))
  finally:
   if cdp:await cdp.ws.close();cdp.reader.cancel()
   for proc in [browser,server]:
    if proc and proc.poll() is None:proc.terminate();proc.wait(timeout=15)
if __name__=='__main__':asyncio.run(main())
