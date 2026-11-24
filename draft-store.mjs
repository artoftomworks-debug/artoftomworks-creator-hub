// 0.16 DEV — Per-model sampling profiles must never be lost by a whole-draft overwrite.
// Several open Hub pages (another tab, an older window) each save their full state; the
// per-model step counts are therefore merged key by key on the server – the newer "saved" wins,
// a page that does not know a profile can never delete it.
export const PROFILE_LIMIT=256;
export function mergeProfiles(stored,incoming){
  const ok=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const out={...(ok(stored)?Object.fromEntries(Object.entries(stored).filter(([,v])=>ok(v))):{})};
  if(ok(incoming))for(const [k,v] of Object.entries(incoming)){if(!ok(v))continue;const old=out[k];if(!old||(Number(v.saved)||0)>=(Number(old.saved)||0))out[k]=v;}
  return Object.fromEntries(Object.entries(out).sort((a,b)=>(Number(a[1].saved)||0)-(Number(b[1].saved)||0)).slice(-PROFILE_LIMIT));
}
