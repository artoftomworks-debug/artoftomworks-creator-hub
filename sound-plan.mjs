// 0.16 DEV — 🔊 Hangterv: hangot is generáló videómodellekhez (LTX, MiniMax H3) a promptba írt angol hangleírás.
// Néma modellnél semmi nem kerül a promptba – ott a kész videóhoz a 🔊 Hang utómunka ad hangot.
export const AUDIO_FAMILIES=['ltx','h3'];
export const SOUND_CHOICES={
 ambience:[['none','Nincs megadva'],['auto','A jelenethez illő'],['silence','Csend, csak halk alapzaj'],['city','Város, utcazaj'],['nature','Erdő, madárcsicsergés'],['sea','Tenger, hullámok'],['rain','Eső'],['wind','Szél'],['room','Csendes szoba'],['crowd','Kávézó, tömeg'],['fire','Pattogó tűz'],['scifi','Gépzúgás, sci-fi']],
 music:[['none','Nincs megadva'],['off','Zene nélkül'],['piano','Lágy zongora'],['strings','Filmes vonósok'],['synth','Ambient szintetizátor'],['lofi','Lo-fi'],['guitar','Akusztikus gitár'],['epic','Epikus zenekari'],['beat','Elektronikus ritmus']],
 speech:[['none','Nincs megadva'],['off','Nincs beszéd'],['narration','Nyugodt narráció'],['whisper','Suttogás'],['line','A szereplő mond valamit']]
};
const AMB={auto:'natural ambient sound that matches the scene',silence:'near silence with only a faint room tone',city:'distant city traffic and street ambience',nature:'forest ambience with soft birdsong and rustling leaves',sea:'gentle ocean waves and distant seagulls',rain:'steady rain falling, soft drops on surfaces',wind:'wind blowing through the scene',room:'quiet interior room tone with subtle everyday sounds',crowd:'soft cafe chatter and a murmuring crowd in the background',fire:'crackling fire',scifi:'low mechanical hum and subtle sci-fi machine sounds'};
const MUS={piano:'soft piano music in the background',strings:'cinematic string music in the background',synth:'atmospheric ambient synth pads in the background',lofi:'relaxed lo-fi music in the background',guitar:'gentle acoustic guitar music in the background',epic:'epic orchestral music',beat:'an electronic beat'};
const pick=(key,v)=>SOUND_CHOICES[key].some(([x])=>x===v)?v:'none';
export function normalizeSound(raw={}){return {enabled:raw?.enabled===true,ambience:pick('ambience',raw?.ambience),music:pick('music',raw?.music),speech:pick('speech',raw?.speech),line:String(raw?.line??'').replace(/["“”„]/g,"'").replace(/\s+/g,' ').trim().slice(0,300),custom:raw?.custom===true,text:typeof raw?.text==='string'?raw.text.slice(0,2000):''};}
export function buildSoundText(raw){const s=normalizeSound(raw),sounds=[];if(AMB[s.ambience])sounds.push(AMB[s.ambience]);if(MUS[s.music])sounds.push(MUS[s.music]);
 const out=[];if(sounds.length)out.push('Audio: '+sounds.join(', ')+'.');if(s.music==='off')out.push('No music.');
 if(s.speech==='off')out.push('No dialogue, no voices.');if(s.speech==='narration')out.push('A calm narrator voice-over speaks softly.');if(s.speech==='whisper')out.push('Soft whispering voices.');if(s.speech==='line'&&s.line)out.push(`The character says: "${s.line}"`);
 return out.join(' ');}
export function soundText(raw){const s=normalizeSound(raw);return (s.custom?s.text:buildSoundText(s)).trim();}
export function soundSummary(raw,label=(k,v)=>SOUND_CHOICES[k].find(x=>x[0]===v)?.[1]||v){const s=normalizeSound(raw),p=[];for(const k of ['ambience','music','speech'])if(s[k]!=='none')p.push(k==='speech'&&s[k]==='line'&&s.line?'„'+s.line.slice(0,40)+(s.line.length>40?'…':'')+'”':label(k,s[k]));if(s.custom)p.push('saját szöveg');return p.join(' · ');}
export const audioCapableFamily=f=>AUDIO_FAMILIES.includes(String(f||''));
// Saját (nem automatikus) workflow-nál: van-e benne hangot dekódoló node.
export function workflowHasAudio(source){try{const t=typeof source==='string'?source:JSON.stringify(source||'');return /(?:AudioVAEDecode|VAEDecodeAudio|LTXVAudioVAEDecode|EmptyLatentAudio|LTXVEmptyLatentAudio)/.test(t);}catch{return false;}}
