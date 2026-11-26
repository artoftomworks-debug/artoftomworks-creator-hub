/* 0.17.1: „Szó a promptban” – egész szavas keresés, "szókapcsolat", szó* (szó eleje), -kizárás.
   Kis- és nagybetűtől és ékezettől független (a „tukor” megtalálja a „tükör”-t). Szerveren és böngészőben is fut. */
export const fold=s=>String(s??'').normalize('NFD').replace(/\p{M}+/gu,'').toLocaleLowerCase('en');
export const tokens=s=>fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export function parseQuery(query){
 const out=[],re=/(-?)"([^"]*)"|(\S+)/g;let m;
 while((m=re.exec(String(query||'')))){
  let neg=!!m[1],raw=m[2]??m[3],phrase=m[2]!==undefined;
  if(!phrase&&raw.startsWith('-')&&raw.length>1){neg=true;raw=raw.slice(1);}
  const prefix=!phrase&&raw.endsWith('*');if(prefix)raw=raw.slice(0,-1);
  const words=tokens(raw);if(!words.length)continue;
  out.push({words,neg,prefix,phrase:phrase||words.length>1});
 }
 return out;
}

function hit(list,term){
 const w=term.words;
 if(w.length===1)return list.some(t=>term.prefix?t.startsWith(w[0]):t===w[0]);
 outer:for(let i=0;i+w.length<=list.length;i++){for(let k=0;k<w.length;k++){const last=k===w.length-1;if(!(last&&term.prefix?list[i+k].startsWith(w[k]):list[i+k]===w[k]))continue outer;}return true;}
 return false;
}

/* text: a keresett szöveg (prompt), terms: parseQuery eredménye. Minden pozitív kifejezésnek szerepelnie kell, a kizártaknak nem. */
export function matchesPrompt(text,terms){
 if(!terms.length)return true;const list=tokens(text);
 return terms.every(t=>t.neg?!hit(list,t):hit(list,t));
}

/* Kiemeléshez: a szöveg darabjai [{text,mark}] – a pozitív kifejezések találatai megjelölve */
export function highlightParts(text,terms){
 const src=String(text||''),pos=terms.filter(t=>!t.neg);if(!pos.length||!src)return [{text:src,mark:false}];
 const spans=[],re=/[\p{L}\p{M}\p{N}]+/gu;let m;while((m=re.exec(src)))spans.push({start:m.index,end:m.index+m[0].length,tok:fold(m[0])});
 const marked=new Array(spans.length).fill(false);
 for(const t of pos){const w=t.words;for(let i=0;i+w.length<=spans.length;i++){let ok=true;for(let k=0;k<w.length;k++){const last=k===w.length-1,tok=spans[i+k].tok;if(!(last&&t.prefix?tok.startsWith(w[k]):tok===w[k])){ok=false;break;}}if(ok)for(let k=0;k<w.length;k++)marked[i+k]=true;}}
 const parts=[];let at=0;
 for(let i=0;i<spans.length;i++){if(!marked[i])continue;let j=i;while(j+1<spans.length&&marked[j+1]&&/^[\s\-]*$/u.test(src.slice(spans[j].end,spans[j+1].start)))j++;if(spans[i].start>at)parts.push({text:src.slice(at,spans[i].start),mark:false});parts.push({text:src.slice(spans[i].start,spans[j].end),mark:true});at=spans[j].end;i=j;}
 if(at<src.length)parts.push({text:src.slice(at),mark:false});return parts;
}
