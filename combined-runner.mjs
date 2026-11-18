export function combinedRunner(renderer,getFinish){
 const finish=()=>getFinish(),owned=async id=>!!finish()&&await finish().handles(id);
 const blocked=()=>Error('Másik feldolgozás még fut. A közös Sor gombbal állítsd sorba a következő munkát.');
 return {...renderer,
  async prepare(plan){if(plan.taskType==='finishing'){if(plan.preparedRunId)return finish().status(plan.preparedRunId);return finish().prepare(plan);}if(!plan.exportOnly&&finish()?.hasActive())throw blocked();return renderer.prepare(plan);},
  async start(data){if(await owned(data.id)){if(renderer.hasActive?.())throw blocked();return finish().start(data);}if(finish()?.hasActive())throw blocked();return renderer.start(data);},
  async status(id){return await owned(id)?finish().status(id):renderer.status(id);},
  async stop(data){return await owned(data.id)?finish().stop(data):renderer.stop(data);},
  async load(id){return await owned(id)?finish().load(id):renderer.load(id);},
  async exportRun(data){return await owned(data.id)?finish().exportRun(data):renderer.exportRun(data);},
  async previewMedia(params,res){return await owned(params.get('id'))?finish().previewMedia(params,res):renderer.previewMedia(params,res);},
  async previewControl(data){return await owned(data.id)?{backendControlled:false,paused:!!data.paused}:renderer.previewControl(data);},
  async workflowView(params){if(await owned(params.get('id')))throw Error('Ez utómunka-recept, nem generáló workflow. A feljavítási ablakban találod a beállításait.');return renderer.workflowView(params);},
  isMediaInUse:id=>!!finish()?.isMediaInUse?.(id)||!!renderer.isMediaInUse?.(id),
  isWorking:()=>renderer.isWorking()||!!finish()?.hasActive(),
  close(){finish()?.close();renderer.close();}
 };
}
