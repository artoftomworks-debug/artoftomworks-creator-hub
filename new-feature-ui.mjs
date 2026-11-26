const storageKey='creatorhub.seenFeatures.2026-11-26';
const seen=new Set();
try{
 const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
 if(Array.isArray(saved))for(const id of saved)seen.add(id);
 if(localStorage.getItem('creatorhub.gridNavigationSeen')==='1')seen.add('grid-navigation');
}catch{}

function save(){
 try{localStorage.setItem(storageKey,JSON.stringify([...seen]));}catch{}
 const gear=document.getElementById('hubGearButton');
 if(gear)gear.dataset.newFeatures=seen.has('*')?'hidden':'available';
 for(const badge of document.querySelectorAll('[data-new-feature]')){
  badge.hidden=seen.has('*')||seen.has(badge.dataset.newFeature);
 }
}

export function newBadge(id){
 const badge=document.createElement('button');
 badge.type='button';
 badge.className='featureNewBadge';
 badge.dataset.newFeature=id;
 badge.textContent='Új ×';
 badge.title='Az Új jelölés elrejtése';
 badge.setAttribute('aria-label',badge.title);
 badge.hidden=seen.has('*')||seen.has(id);
 badge.onclick=e=>{
  e.stopPropagation();
  seen.add(id);
  save();
 };
 return badge;
}

export function markNew(control,id){
 const group=document.createElement('span');
 group.className='featureNewGroup';
 group.append(control,newBadge(id));
 return group;
}

export function markAllSeen(){
 seen.add('*');
 save();
}

export function showNewFeatures(){
 seen.clear();
 try{localStorage.removeItem('creatorhub.gridNavigationSeen');}catch{}
 save();
}

export const newFeaturesAvailable=()=>!seen.has('*');
