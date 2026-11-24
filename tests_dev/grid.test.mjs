import test from 'node:test';import assert from 'node:assert/strict';
import {arrangeGrid} from '../grid-ui.mjs';
const it=(model,seed,w,h,extra={})=>({id:model+seed+w,filename:`20261123_x_01_${model}_00001_.png`,seed,width:w,height:h,url:'u',...extra});
test('rows = models, columns = seeds, one tab per format; videos left out',()=>{
  const items=[it('Moss',1,768,1344),it('Moss',2,768,1344),it('SICK OLLIE',1,768,1344),it('SICK OLLIE',2,768,1344),it('Moss',1,1344,768),{id:'v',filename:'a_01_Moss_00001_.mp4',seed:1,width:768,height:1344}];
  const t=arrangeGrid(items);assert.equal(t.length,2);assert.equal(t[0].label,'álló · 768 × 1344');assert.deepEqual(t[0].seeds,[1,2]);
  assert.deepEqual(t[0].rows.map(r=>r.model),['Moss','SICK OLLIE']);assert.equal(t[0].rows[1].cells[1].seed,2);
  assert.equal(t[1].rows[0].cells.length,1);
});
test('missing seed → simple grid; missing cell → null',()=>{
  const t=arrangeGrid([it('A',null,512,512),it('A',null,512,512)]);assert.equal(t[0].structured,false);assert.equal(t[0].rows[0].cells.length,2);
  const g=arrangeGrid([it('A',1,512,512),it('B',2,512,512)]);assert.equal(g[0].rows[0].cells[1],null);
});
// 0.16 DEV — értékelés a rácsban: szűrő, billentyűk
import {passes,filterTab,ratingKey} from '../grid-ui.mjs';
test('rating filter: favourites, at least 3, at least 4; hidden cells keep the seed columns',()=>{
 const a={id:1,favorite:true,rating:2},b={id:2,rating:4},c={id:3,rating:3},t={structured:true,seeds:[1,2],rows:[{model:'A',cells:[a,b]},{model:'B',cells:[c,null]}]};
 assert.equal(passes(a,'fav'),true);assert.equal(passes(b,'fav'),false);assert.equal(passes(c,'r3'),true);assert.equal(passes(c,'r4'),false);assert.equal(passes(null,'all'),false);
 const f=filterTab(t,'r4');assert.equal(f.rows.length,1);assert.deepEqual(f.rows[0].cells,[null,b]);assert.equal(filterTab(t,'all'),t);
 const u=filterTab({structured:false,seeds:[],rows:[{model:'A',cells:[a,b,c]}]},'r3');assert.deepEqual(u.rows[0].cells,[b,c]);});
test('rating keys: 1–5 rate, 0 clears, others ignored',()=>{assert.equal(ratingKey('4'),4);assert.equal(ratingKey('0'),0);assert.equal(ratingKey('6'),null);assert.equal(ratingKey('f'),null);});
