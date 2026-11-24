// 0.16 DEV — Jelenetlánc-frissítés a böngészőben (a ComfyUI-s SceneChainRefresh megfelelője, kattintás nélkül).
// Az előző rész utolsó képkockáját színben és fényerőben az 1. rész kezdőképéhez igazítja (csatornánkénti
// átlag/szórás illesztés, korlátozott erősséggel), majd finoman élesíti. Így a halmozódó LTX-kivilágosodás
// (tesztben részenként kb. +13 szint) nem adódik össze a láncban.

const TEXT={
  HU:['Színillesztés az 1. részhez (ajánlott)','Az előző rész utolsó képkockáját az 1. rész kezdőképének színeihez és fényerejéhez igazítja, és finoman élesíti, így a lánc nem színeződik el részről részre.','Fényerő-eltérés az 1. részhez: ','előtte','utána','szint'],
  EN:['Match colours to part 1 (recommended)','Matches the previous part’s last frame to the colours and brightness of part 1’s start image and sharpens it slightly, so the chain does not drift from part to part.','Brightness drift vs part 1: ','before','after','levels'],
  DE:['Farben an Teil 1 angleichen (empfohlen)','Gleicht das letzte Bild des vorigen Teils an Farben und Helligkeit des Startbilds von Teil 1 an und schärft leicht – die Kette verfärbt sich nicht.','Helligkeitsabweichung zu Teil 1: ','vorher','nachher','Stufen'],
  FR:['Harmoniser les couleurs avec la partie 1 (recommandé)','Aligne la dernière image de la partie précédente sur les couleurs et la luminosité de l’image de départ de la partie 1, avec une légère netteté : la chaîne ne dérive pas.','Écart de luminosité avec la partie 1 : ','avant','après','niveaux'],
  ES:['Igualar colores con la parte 1 (recomendado)','Ajusta el último fotograma de la parte anterior a los colores y el brillo de la imagen inicial de la parte 1 y lo enfoca un poco: la cadena no se desvía.','Desviación de brillo respecto a la parte 1: ','antes','después','niveles'],
  IT:['Allinea i colori alla parte 1 (consigliato)','Allinea l’ultimo fotogramma della parte precedente a colori e luminosità dell’immagine iniziale della parte 1 e lo rende leggermente più nitido: la catena non deriva.','Scarto di luminosità rispetto alla parte 1: ','prima','dopo','livelli'],
  PT:['Igualar cores à parte 1 (recomendado)','Ajusta o último quadro da parte anterior às cores e ao brilho da imagem inicial da parte 1 e aumenta um pouco a nitidez: a cadeia não se desvia.','Desvio de brilho em relação à parte 1: ','antes','depois','níveis'],
  PL:['Dopasuj kolory do części 1 (zalecane)','Dopasowuje ostatnią klatkę poprzedniej części do kolorów i jasności obrazu startowego części 1 i lekko wyostrza – łańcuch nie odpływa kolorystycznie.','Różnica jasności względem części 1: ','przed','po','poziomów']
};
export const chainText=(lang,i)=>(TEXT[String(lang||'').toUpperCase()]||TEXT.EN)[i];

// Pure pixel functions (RGBA Uint8ClampedArray) – testable without a browser.
export function channelStats(px){
  const n=px.length/4,s=[0,0,0],q=[0,0,0];
  for(let i=0;i<px.length;i+=4)for(let c=0;c<3;c++){const v=px[i+c];s[c]+=v;q[c]+=v*v;}
  return s.map((v,c)=>{const m=v/n;return {mean:m,std:Math.sqrt(Math.max(0,q[c]/n-m*m))};});
}
export const luma=st=>0.2126*st[0].mean+0.7152*st[1].mean+0.0722*st[2].mean;
export function matchColors(px,ref,{strength=1,minGain=0.8,maxGain=1.25}={}){
  const a=channelStats(px),out=new Uint8ClampedArray(px);
  for(let c=0;c<3;c++){
    const gain=Math.min(maxGain,Math.max(minGain,a[c].std>1e-3?ref[c].std/a[c].std:1));
    for(let i=c;i<out.length;i+=4){const v=(px[i]-a[c].mean)*gain+ref[c].mean;out[i]=px[i]+(v-px[i])*strength;}
  }
  return out;
}
export function sharpen(px,width,height,amount=0.35){
  if(!(amount>0))return px;const out=new Uint8ClampedArray(px);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4;
    for(let c=0;c<3;c++){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=px[i+(dy*width+dx)*4+c];out[i+c]=px[i+c]+amount*(px[i+c]-sum/9);}}
  return out;
}

async function bitmap(src){const img=new Image();img.decoding='async';img.src=src;await img.decode();return img;}
function pixels(img,maxSide=0){const scale=maxSide&&Math.max(img.naturalWidth,img.naturalHeight)>maxSide?maxSide/Math.max(img.naturalWidth,img.naturalHeight):1;const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,w,h);return {cv,g,data:g.getImageData(0,0,w,h),w,h};}

// frame, reference: image URLs (data: or same-origin). Returns {image (PNG data URL), before, after} – before/after = brightness drift in levels.
export async function refreshFrame(frame,reference,{strength=1,sharpenAmount=0.35}={}){
  const [f,r]=await Promise.all([bitmap(frame),bitmap(reference)]);
  const ref=channelStats(pixels(r,512).data.data),cur=pixels(f);
  const before=luma(channelStats(cur.data.data))-luma(ref);
  let px=matchColors(cur.data.data,ref,{strength});px=sharpen(px,cur.w,cur.h,sharpenAmount);
  cur.data.data.set(px);cur.g.putImageData(cur.data,0,0);
  const after=luma(channelStats(px))-luma(ref);
  return {image:cur.cv.toDataURL('image/png'),before,after};
}
