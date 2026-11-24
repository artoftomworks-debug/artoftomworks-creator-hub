// 0.16 DEV — Storyboard: közös (böngésző + szerver) segédfüggvények.
const clip=(v,n)=>String(v??'').slice(0,n);
export function cleanShot(s={},i=0){return {id:clip(s.id,64)||('s'+Date.now().toString(36)+i),text:clip(s.text,4000),duration:Math.max(1,Math.min(30,Number(s.duration)||5)),keyframe:s.keyframe?clip(s.keyframe,64):null,seedOffset:Math.max(0,Math.min(9999,Number.parseInt(s.seedOffset)||0)),video:s.video?clip(s.video,64):null,mirror:s.mirror===true};}
export function cleanBoard(b={}){if(!b||typeof b!=='object')throw Error('Érvénytelen storyboard.');const name=clip(b.name,80).trim();if(!name)throw Error('Adj nevet a storyboardnak.');const shots=(Array.isArray(b.shots)?b.shots:[]).slice(0,60).map(cleanShot);
  return {id:clip(b.id,64)||('b'+Date.now().toString(36)),name,style:clip(b.style,4000),negative:clip(b.negative,4000),seed:Number.isSafeInteger(Number(b.seed))&&Number(b.seed)>=0?Number(b.seed):Math.floor(Math.random()*2147483647),width:Math.max(256,Math.min(4096,Number(b.width)||1024)),height:Math.max(256,Math.min(4096,Number(b.height)||1024)),shots,characterId:b.characterId?clip(b.characterId,64):null,music:b.music?clip(b.music,64):null,updated:Date.now()};}
// A jelenet projektneve – erről ismerjük fel a generált képeket az Előzményekben.
export const shotProject=(board,index)=>'Storyboard · '+board.name+' · '+(index+1)+'. jelenet';
export function shotIndexOf(project,board){const p=String(project||''),pre='Storyboard · '+board.name+' · ';if(!p.startsWith(pre))return -1;const m=p.slice(pre.length).match(/^(\d+)\. jelenet$/);return m?Number(m[1])-1:-1;}
export const shotPrompt=(board,shot)=>[shot.text.trim(),board.style.trim()].filter(Boolean).join(', ');
// 0.16 DEV: a jelenetből készült videók projektneve, és visszafelé a jelenet sorszáma.
export const shotVideoProject=(board,index)=>shotProject(board,index)+' · videó';
export function videoIndexOf(project,board){const p=String(project||''),pre='Storyboard · '+board.name+' · ';if(!p.startsWith(pre))return -1;const m=p.slice(pre.length).match(/^(\d+)\. jelenet · videó$/);return m?Number(m[1])-1:-1;}
