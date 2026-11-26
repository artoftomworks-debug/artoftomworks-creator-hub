// 0.17.1 DEV — ✦ MI-címkék szótára (tiszta modul: a böngésző és a szerver is használja).
export const TAGS=[
 ['portrait','portré','portrait'],
 ['glamour','glamour','glamour'],
 ['nude','akt','nude'],
 ['fashion','divat','fashion'],
 ['landscape','tájkép','landscape'],
 ['cityscape','városkép','cityscape'],
 ['architecture','épület','architecture'],
 ['interior','belső tér','interior'],
 ['nature','természet','nature'],
 ['water','víz','water'],
 ['animal','állat','animal'],
 ['fantasy','fantasy','fantasy'],
 ['scifi','sci-fi','sci-fi'],
 ['horror','horror','horror'],
 ['abstract','absztrakt','abstract'],
 ['macro','makró','macro'],
 ['food','étel','food'],
 ['vehicle','jármű','vehicle'],
 ['night','éjszaka','night'],
 ['goldenhour','aranyóra','golden hour'],
 ['lowkey','sötét, low-key','low-key'],
 ['winter','tél','winter'],
 ['vintage','retró','vintage'],
 ['anime','anime / rajz','anime'],
 ['painting','festmény','painting'],
 ['people','emberek','people'],
];
export const TAG_IDS=TAGS.map(t=>t[0]);
export const LEVELS=['none','soft','mature','x'];
export const tagLabel=id=>TAGS.find(t=>t[0]===id)?.[1]||id;
// Pure: a képfelismerő válaszának ellenőrzése – csak a szótár elemei maradnak, legfeljebb 6.
export function cleanVision(r){const tags=[...new Set((Array.isArray(r?.tags)?r.tags:[]).map(v=>String(v).toLowerCase().replace(/[^a-z-]/g,'')).map(v=>v==='sci-fi'?'scifi':v==='golden-hour'?'goldenhour':v==='low-key'?'lowkey':v))].filter(v=>TAG_IDS.includes(v)).slice(0,6);
 const level=LEVELS.includes(String(r?.level||'').toLowerCase())?String(r.level).toLowerCase():'';return {tags,level};}
export function visionSystem(){return 'You label ONE image for a personal gallery. Choose 1 to 6 tags that clearly fit, ONLY from this list: '+TAG_IDS.join(', ')+
 '. Also rate the content level: "none" (no nudity, safe), "soft" (suggestive, swimwear, lingerie, no nudity), "mature" (partial nudity), "x" (explicit nudity or sexual content). Answer ONLY JSON: {"tags":["..."],"level":"none|soft|mature|x"}.';}

