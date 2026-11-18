export const sizePresets={
 image:[[1024,1024],[1344,768],[768,1344],[1152,896],[896,1152],[1536,1024],[1024,1536]],
 video:[[768,448],[1024,576],[1088,608],[1280,704],[1344,768],[1920,1088],[608,1088],[768,1344],[768,768]]
};
export function aspect(width,height){const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(width,height);return width/g+':'+height/g;}
export function sizeProblem(width,height){return ![width,height].every(v=>Number.isInteger(v)&&v>=256&&v<=2048&&v%32===0)||width*height>2097152?'256–2048 közötti, 32-vel osztható értékek szükségesek, legfeljebb 2 megapixel.':'';}
export function nearestSize(width,height){let w=Math.min(2048,Math.max(256,Math.round(width/32)*32||1024)),h=Math.min(2048,Math.max(256,Math.round(height/32)*32||1024));while(w*h>2097152){if(w>=h)w-=32;else h-=32;}return {width:w,height:h};}
export function presetLabel(width,height){return width+' × '+height+' · '+aspect(width,height);}
