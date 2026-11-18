export const redact=value=>String(value).replace(/(Bearer\s+)[\w.\-]+/gi,'$1[rejtve]').replace(/((?:api[_-]?key|token|password|authorization|secret|credential)["']?\s*[:=]\s*["']?)[^\s,"'}&]+/gi,'$1[rejtve]');

export function runErrorNotice(run,job,engine){
 const error=job?.error||run?.error;if(!error)return null;
 const sameEngine=engine?.enabled&&engine.mode==='managed'&&engine.backend===run.backend;
 const earlier=sameEngine&&engine.owned&&engine.started>0&&run.created>0&&run.created<engine.started&&!run.autoRun&&(!job?.started||job.started<engine.started);
 if(earlier)return {kind:'previous',error:false,text:'Korábbi, megszakadt futás · '+error+' A kész eredmények megmaradnak. Az új generálás külön indítható; a korábbi futás csak kérésre folytatódik.'};
 if(sameEngine&&engine.state==='starting'&&/fetch failed|ECONNREFUSED|ECONNRESET|No queue\/history record/i.test(error))return {kind:'starting',error:false,text:'A ComfyUI még indul. A futás állapotát az üzemkész motorral ellenőrizzük.'};
 return {kind:'current',error:true,text:error};
}
