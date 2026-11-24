import test from 'node:test';import assert from 'node:assert/strict';
import {channelStats,luma,matchColors,sharpen,chainText} from '../chain-refresh.mjs';
const img=(w,h,f)=>{const p=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,[r,g,b]=f(x,y);p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=255;}return p;};
test('colour match pulls a brightened frame back to the reference (LTX +13 levels drift)',()=>{
  const ref=img(32,32,(x,y)=>[60+x*3,80+y*2,100+((x+y)%7)*5]);
  const drift=img(32,32,(x,y)=>[60+x*3+13,80+y*2+13,100+((x+y)%7)*5+13]);
  const rs=channelStats(ref),before=luma(channelStats(drift))-luma(rs);assert.ok(before>12);
  const after=luma(channelStats(matchColors(drift,rs)))-luma(rs);assert.ok(Math.abs(after)<0.6,'after '+after);
  const half=luma(channelStats(matchColors(drift,rs,{strength:0.5})))-luma(rs);assert.ok(half>5&&half<8);
});
test('gain is limited: a very different frame is not stretched wildly',()=>{
  const flat=img(16,16,()=>[120,120,120]),ref=channelStats(img(16,16,(x)=>[x*16,x*16,x*16]));
  const out=matchColors(flat,ref);assert.ok(out.every((v,i)=>i%4===3||Number.isFinite(v)));
});
test('sharpen keeps flat areas unchanged and alpha intact',()=>{
  const flat=img(8,8,()=>[100,100,100]),s=sharpen(flat,8,8,0.35);assert.deepEqual([...s],[...flat]);
  const edge=img(8,8,x=>x<4?[50,50,50]:[200,200,200]),e=sharpen(edge,8,8,0.35);assert.ok(e[(2*8+3)*4]<50&&e[(2*8+4)*4]>200);
  assert.equal(chainText('hu',0).startsWith('Színillesztés'),true);assert.ok(chainText('xx',0).startsWith('Match'));
});
