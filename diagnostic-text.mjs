export const redact=value=>String(value).replace(/(Bearer\s+)[\w.\-]+/gi,'$1[rejtve]').replace(/((?:api[_-]?key|token|password|authorization|secret|credential)["']?\s*[:=]\s*["']?)[^\s,"'}&]+/gi,'$1[rejtve]');

export function runErrorNotice(run,job,engine){
 const error=job?.error||run?.error;if(!error)return null;
 const sameEngine=engine?.enabled&&engine.mode==='managed'&&engine.backend===run.backend;
 const earlier=sameEngine&&engine.owned&&engine.started>0&&run.created>0&&run.created<engine.started&&!run.autoRun&&(!job?.started||job.started<engine.started);
 if(earlier)return {kind:'previous',error:false,text:'Korábbi, megszakadt futás · '+error+' A kész eredmények megmaradnak. Az új generálás külön indítható; a korábbi futás csak kérésre folytatódik.'};
 if(sameEngine&&engine.state==='starting'&&/fetch failed|ECONNREFUSED|ECONNRESET|No queue\/history record/i.test(error))return {kind:'starting',error:false,text:'A ComfyUI még indul. A futás állapotát az üzemkész motorral ellenőrizzük.'};
 return {kind:'current',error:true,text:error};
}

// 0.16 DEV — emberi hibaüzenetek. A nyers hibát egy mondatra és egy javaslatra fordítja, javító gombokkal.
// Ismeretlen hibánál null: ilyenkor a nyers szöveg látszik, mint eddig. A nyers szöveg mindig elérhető marad (Technikai részletek).
// actions: free (memória felszabadítása) · size (kisebb méret beállítása) · engine (ComfyUI indítása) · models (modell keresése) · nodes (node-frissítések) · preflight (✦ Ellenőrzés)
const missingFile=text=>{const m=String(text).match(/(?:ckpt_name|unet_name|lora_name|vae_name|clip_name\d?|model_name|control_net_name|upscale_model_name|audio_model|text_encoder\w*)\s*:\s*'([^']+)'\s*not in/i)||String(text).match(/(?:No such file or directory|FileNotFoundError)[^'"]*['"]([^'"]+\.(?:safetensors|ckpt|pt|pth|gguf|bin|sft))['"]/i);return m?m[1]:'';};
export function friendlyError(raw){
 const text=String(raw||'');if(!text)return null;
 if(/out.of.memory|CUDA_ERROR_OUT_OF_MEMORY|cudaErrorMemoryAllocation|OutOfMemoryError|DefaultCPUAllocator: not enough memory|Allocation on device|not enough (?:GPU )?memory/i.test(text))
  return {kind:'memory',title:'Elfogyott a videomemória.',text:'A kép vagy videó ekkora méretben nem fért el a videókártyán. Szabadítsd fel a memóriát, és próbáld újra – ha megint előjön, válassz kisebb méretet vagy rövidebb videót. Az önjavítás (✦ Ellenőrzés panel) ezt magától is megpróbálja.',actions:['free','size','preflight']};
 const file=missingFile(text);
 if(file||/value not in list/i.test(text))
  return {kind:'missing-model',title:'Hiányzik egy modellfájl'+(file?': '+file.split(/[\\/]/).pop():'.')+'',text:'A ComfyUI nem találja ezt a fájlt a modellmappáiban. Lehet, hogy törölted, átnevezted, más mappában van, vagy a workflow egy másik gépről jött. Keresd meg a Modellek ablakban, vagy válassz másik modellt.',file,actions:['models']};
 if(/fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|UND_ERR_SOCKET|other side closed|A ComfyUI leállt|motor nem (?:válaszol|érhető el)/i.test(text))
  return {kind:'engine',title:'A ComfyUI nem válaszol.',text:'Leállt, újraindul, vagy még tölt. Indítsd el (vagy várj egy kicsit), aztán indítsd újra a generálást. A kész képek megmaradtak.',actions:['engine']};
 if(/node (?:type )?['"]?[\w .-]+['"]? (?:does not exist|not found)|missing_node_type|Cannot execute because a node is missing|class_type.*(?:not found|does not exist)|No module named|ImportError|IMPORT FAILED/i.test(text))
  return {kind:'missing-node',title:'Hiányzik egy ComfyUI-bővítmény (node).',text:'A workflow olyan node-ot használ, ami nincs telepítve vagy nem töltődött be. Nézd meg a Node-frissítések ablakot; ha frissen telepítettél valamit, a ComfyUI újraindítása is segíthet.',actions:['nodes','engine']};
 if(/HeaderTooLarge|invalid load key|SafetensorError|Error while deserializing|unexpected EOF|PytorchStreamReader failed|incomplete metadata/i.test(text))
  return {kind:'corrupt',title:'Sérült vagy félig letöltött modellfájl.',text:'A fájl nem olvasható végig – jellemzően megszakadt letöltés. Töltsd le újra a Modellek ablakban.',file:missingFile(text),actions:['models']};
 if(/size mismatch|mat1 and mat2 shapes cannot be multiplied|expected .* channels|Given groups=.*weight of size|shape .* is invalid for input of size/i.test(text))
  return {kind:'mismatch',title:'Nem illő modell és kiegészítő.',text:'Valószínűleg egy LoRA, VAE vagy szövegkódoló másik modellcsaládhoz készült. Kapcsold ki a gyanús LoRA-t, vagy futtasd az ✦ Ellenőrzést, ami megmutatja, mi nem illik össze.',actions:['preflight']};
 if(/aborted due to timeout|TimeoutError|lassan válaszol/i.test(text))
  return {kind:'slow',title:'A ComfyUI lassan válaszol.',text:'Valószínűleg épp modellt tölt vagy nagy munkán dolgozik. Várj egy kicsit, és próbáld újra; ha tartósan így marad, nézd meg a ⚙ Beállítások → Szerver ablakban a naplót.',actions:['engine']};
 if(/execution_interrupted|ComfyUI execution interrupted|Processing interrupted/i.test(text))
  return {kind:'interrupted',title:'A generálás megszakadt.',text:'Valaki (vagy a Hub) leállította a futást. A már kész képek megmaradtak; a generálás újraindítható.',actions:[]};
 if(/Prompt outputs failed validation|Required input is missing|Return type mismatch|Exception when validating/i.test(text))
  return {kind:'validation',title:'A ComfyUI nem fogadta el a generálást.',text:'Valamelyik beállítás vagy bemenet hiányzik vagy nem illik (például üres kép, rossz méret). Az ✦ Ellenőrzés megmutatja, melyik.',actions:['preflight']};
 return null;
}
export const friendlyLine=raw=>{const f=friendlyError(raw);return f?f.title+' '+f.text:String(raw||'');};

export function shareableError(value){
 const text=String(value)
  .replace(/((?:api[_-]?key|token|password|authorization|secret|credential|cookie)["']?\s*[:=]\s*)(["'])[^\r\n]*?\2/gi,'$1[rejtve]')
  .replace(/\b(?:Bearer|Basic)\s+\S+/gi,'[hitelesítés elrejtve]');
 return redact(text)
  .replace(/\b(?:https?|file):\/\/[^\s"'<>]+/gi,'[URL elrejtve]')
  .replace(/(["'])(?:[a-z]:[\\/]|\\\\|\/)[^\r\n]*?\1/gi,'[útvonal elrejtve]')
  .replace(/(?:\b[a-z]:[\\/]|\\\\|(?<!\S)\/(?:[\w.-]+\/)+)[^\r\n"'<>]*/gi,'[útvonal elrejtve]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[e-mail elrejtve]')
  .replace(/\b(?:hf_|sk-)[A-Za-z0-9_-]{10,}\b/g,'[kulcs elrejtve]');
}

export function describeError(raw,{version,models=[]}={}){
 const friendly=friendlyError(raw);
 const title=friendly?shareableError(friendly.title):'Hiba történt';
 const text=friendly?.text||'A hiba oka bizonytalan. Nézd meg a technikai részleteket, vagy kérj MI-magyarázatot.';
 const error=shareableError(raw).slice(0,12000);
 const model=(Array.isArray(models)?models:[]).filter(name=>typeof name==='string')
  .map(name=>shareableError(name.split(/[\\/]/).pop())).filter(Boolean).join(', ');
 const modelLine=model?'Modell: '+model:'';
 const header=[version&&shareableError(version),modelLine].filter(Boolean).join('\n');
 return {
  title,text,known:!!friendly,fix:friendly,modelLine,
  line:friendly?title+' '+text:error,
  report:[header,error].filter(Boolean).join('\n\n'),
  advice:{error:error.slice(0,2400),summary:friendly?title:undefined}
 };
}
