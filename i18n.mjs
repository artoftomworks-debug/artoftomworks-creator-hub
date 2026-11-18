export const LANGUAGES=['HU','EN','DE','FR','ES','IT','PT','PL'];
export const LANGUAGE_NAMES={HU:'Magyar',EN:'English',DE:'Deutsch',FR:'Français',ES:'Español',IT:'Italiano',PT:'Português',PL:'Polski'};
export function languageCode(value,fallback='EN'){const code=String(value||'').split(/[-_]/)[0].toUpperCase();return LANGUAGES.includes(code)?code:fallback;}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),normalize=s=>s.replace(/\s+/g,' ').trim();
export function createTranslator(target={},english={}){
 const values={...english,...target},patterns=[],fragments=[];
 for(const [key,value]of Object.entries(values)){
  if(typeof value!=='string')continue;const slots=[...key.matchAll(/\$\{(\d+)\}/g)];
  if(slots.length&&slots.length<=12){const fixed=key.replace(/\$\{\d+\}/g,'');if(fixed.length<5)continue;let at=0,source='^';for(const slot of slots){source+=escape(key.slice(at,slot.index))+'([\\s\\S]*?)';at=slot.index+slot[0].length;}source+=escape(key.slice(at))+'$';patterns.push({regex:new RegExp(source),slots:slots.map(s=>Number(s[1])),value,fixed:fixed.length});}
  else if(key.length>=5&&value!==key)fragments.push([key,value]);
 }
 patterns.sort((a,b)=>b.fixed-a.fixed);fragments.sort((a,b)=>b[0].length-a[0].length);
 return text=>{
  if(typeof text!=='string'||!text.trim()||text.length>6000)return text;const key=normalize(text),padding=text.match(/^(\s*)[\s\S]*?(\s*)$/),wrap=value=>(padding?.[1]||'')+value+(padding?.[2]||'');
  if(typeof values[key]==='string')return wrap(values[key]);
  if(key.length<=2400)for(const p of patterns){const match=p.regex.exec(key);if(match){const captures=new Map(p.slots.map((n,i)=>[n,match[i+1]]));return wrap(p.value.replace(/\$\{(\d+)\}/g,(_,n)=>captures.get(Number(n))??''));}}
  // Only fixed UI fragments at a boundary; captured filenames and user text are opaque.
  for(const [source,value]of fragments){if(key.startsWith(source)&&/^[\s:·/—(\d]/.test(key.slice(source.length)))return wrap(value+key.slice(source.length));if(key.endsWith(source)&&/[\s·—]$/.test(key.slice(0,-source.length)))return wrap(key.slice(0,-source.length)+value);}
  return text;
 };
}
