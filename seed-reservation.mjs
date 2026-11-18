// Reserve only an accepted new series. Checks, exports, retries and previews
// must keep the working seed. An edited working plan must not be overwritten.
export function advanceSeriesSeed(current,{seed,seedMode='increment',seedStep=1,count=1}={}){
 if(seedMode!=='increment'||current.seedMode!=='increment'||seed<0||current.seed!==seed||!Number.isSafeInteger(seed)||!Number.isInteger(count)||count<1||count>24||!Number.isSafeInteger(seedStep)||seedStep<1||seedStep>1000000)return false;
 const next=seed+count*seedStep;if(!Number.isSafeInteger(next))return false;
 current.seed=next;current.controls.seed=next;current.seedBeforeRandom=next;return true;
}
