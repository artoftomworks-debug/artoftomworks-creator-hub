export const normalizeName=s=>String(s||'').replaceAll('\\','/').toLowerCase();
export function matchName(name,items){const n=normalizeName(name),exact=items.filter(i=>normalizeName(i.name)===n);if(exact.length===1)return exact[0];if(exact.length>1)return null;const short=s=>normalizeName(s).split('/').at(-1).replace(/\.(safetensors|ckpt|gguf|pt)$/,'');const hits=items.filter(i=>short(i.name)===short(name));return hits.length===1?hits[0]:null;}
export function samplingValues(recipe,inventory){const values={},warnings=[];
 for(const k of ['steps','cfg','denoise','guidance'])if(recipe[k]!==undefined)values[k]=recipe[k];
 const aliases={'euler':'euler','euler a':'euler_ancestral','dpm++ 2m':'dpmpp_2m','dpm++ sde':'dpmpp_sde','dpm++ 2m sde':'dpmpp_2m_sde','ddim':'ddim','heun':'heun'};
 if(recipe.sampler){let raw=recipe.sampler.toLowerCase(),scheduler=recipe.scheduler;if(/ karras$/.test(raw)){raw=raw.replace(/ karras$/,'');scheduler||='karras';}const name=inventory.samplers.includes(recipe.sampler)?recipe.sampler:aliases[raw];if(name&&inventory.samplers.includes(name))values.sampler=name;else warnings.push('Nem támogatott sampler: '+recipe.sampler);if(scheduler){const s=scheduler.toLowerCase();if(inventory.schedulers.includes(s))values.scheduler=s;else warnings.push('Nem támogatott scheduler: '+scheduler);}}
 else if(recipe.scheduler){const s=recipe.scheduler.toLowerCase();if(inventory.schedulers.includes(s))values.scheduler=s;else warnings.push('Nem támogatott scheduler: '+recipe.scheduler);}
 return {values,warnings};}
