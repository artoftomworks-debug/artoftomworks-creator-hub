import {markNew} from './new-feature-ui.mjs';
import {advisorModel} from './ai-review-ui.mjs';
import {stepAdviceChoices,SAMPLING_SOURCE_TEXT,automaticSamplingDefaults} from './sampling-policy.mjs';
import {presetLabel,sizeAdviceChoices} from './settings.mjs';
import {imageSize} from './preflight-ui.mjs';
import {openOnlineLoras} from './lora-suggest-ui.mjs';

function element(tag,text){
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 return node;
}

export function openCreativeAdvice({title,task,apply,applyText,applySize,trySteps,onlineLoras,applyLabel='Darab modellenként',promptLabel,request,notify}){
 const model=advisorModel();
 if(!model){notify('Válassz helyi modellt a MI-segítőben.',true);return;}
 const dialog=element('dialog');
 dialog.className='generationDialog creativeAdviceDialog';
 const header=element('div');header.className='sectionTitle';
 const close=element('button','Bezárás');close.type='button';
 close.onclick=()=>dialog.close();
 header.append(element('h2',title),close);
 const input=element('input');input.maxLength=500;
 const question=element('label',promptLabel);
 question.append(input);
 const run=element('button','Javaslat készítése');run.type='button';
 const status=element('p');status.setAttribute('role','status');
 const output=element('textarea');output.rows=7;output.hidden=true;
 const extra=element('div');
 dialog.append(header);
 if(promptLabel)dialog.append(question);
 dialog.append(run);
 if(onlineLoras){
  const web=element('button','LoRA keresése az interneten');web.type='button';
  web.onclick=()=>openOnlineLoras({request,notify,...onlineLoras(input.value.trim())});
  dialog.append(markNew(web,"online-loras"));
 }
 dialog.append(status,output,extra);
 dialog.addEventListener('close',()=>dialog.remove());
 document.body.append(dialog);
 dialog.showModal();
 run.onclick=async()=>{
  run.disabled=true;status.textContent='Ellenőrzés…';
  output.hidden=true;extra.replaceChildren();
  try{
   const result=await task(model,input.value.trim());
   if(!dialog.open)return;
   output.value=result.text;output.hidden=false;status.textContent='';
   for(const row of result.entries||[]){
    const link=element('a',row.label);link.href=row.url;link.target='_blank';link.rel='noopener';
    const line=element('p');line.append(link);extra.append(line);
   }
   if(applyText&&result.suggestion){
    const field=element('textarea');field.rows=4;field.value=result.suggestion;
    const label=element('label','Javaslat');label.append(field);
    const take=element('button','Javaslat alkalmazása');take.type='button';
    take.onclick=()=>{
     if(!field.value.trim())return;
     try{applyText(field.value.trim());dialog.close();}
     catch(error){status.textContent=error.message;}
    };
    extra.append(label,take);
    if(trySteps){
     const trial=element('button','Két rövid videó összehasonlítása');trial.type='button';
     const updateTrial=()=>{trial.disabled=!count.checkValidity()||!Number.isInteger(count.valueAsNumber)||count.valueAsNumber===result.plan.steps;};
     count.oninput=updateTrial;
     updateTrial();
     trial.onclick=async()=>{
      const value=count.valueAsNumber;
      if(!count.checkValidity()||!Number.isInteger(value)||value===result.plan.steps)return;
      trial.disabled=true;take.disabled=true;run.disabled=true;
      try{await trySteps(value,result.plan);dialog.close();}
      catch(error){status.textContent=error.message;}
      finally{updateTrial();take.disabled=false;run.disabled=false;}
     };
     extra.append(markNew(trial,"video-step-trial"));
    }
   }
   if(result.summary)extra.append(element('p',result.summary));
   if(applySize&&result.size){
    const take=element('button','Méret átvétele');take.type='button';
    take.onclick=()=>{
     try{applySize(result.size);dialog.close();}
     catch(error){status.textContent=error.message;}
    };
    extra.append(take);
   }
   if(apply&&result.count){
    const count=element('input');count.type='number';count.min=1;count.max=result.maxCount||8;count.step=1;count.value=result.count;
    const label=element('label',applyLabel);label.append(count);
    const take=element('button','Javaslat alkalmazása');take.type='button';
    take.onclick=()=>{
     if(!count.checkValidity()||!Number.isInteger(count.valueAsNumber))return;
     try{apply(count.valueAsNumber,result);dialog.close();}catch(error){status.textContent=error.message;}
    };
    extra.append(label,take);
    if(trySteps){
     const trial=element('button','Két rövid videó összehasonlítása');trial.type='button';
     const updateTrial=()=>{trial.disabled=!count.checkValidity()||!Number.isInteger(count.valueAsNumber)||count.valueAsNumber===result.plan.steps;};
     count.oninput=updateTrial;
     updateTrial();
     trial.onclick=async()=>{
      const value=count.valueAsNumber;
      if(!count.checkValidity()||!Number.isInteger(value)||value===result.plan.steps)return;
      trial.disabled=true;take.disabled=true;run.disabled=true;
      try{await trySteps(value,result.plan);dialog.close();}
      catch(error){status.textContent=error.message;}
      finally{updateTrial();take.disabled=false;run.disabled=false;}
     };
     extra.append(markNew(trial,"video-step-trial"));
    }
   }
  }catch(error){if(dialog.open)status.textContent=error.message;}
  finally{run.disabled=false;}
 };
 return dialog;
}

export async function advice(request,model,kind,context,question=''){
 return request('studio/assistant',{action:'creativeAdvice',model,kind,context,question});
}
export function openStepAdvice({request,notify,getPlan,apply,trial}){
 return openCreativeAdvice({title:'Videós lépésszám ajánlása',request,notify,applyLabel:'Lépésszám',trySteps:trial,
  async task(assistant){
   const plan=await getPlan();
   const {model,steps,source,prompt,width,height,duration}=plan;
   const choices=stepAdviceChoices(model,steps);
   if(!choices.length)throw Error('A lépésszám ennél a workflow-nál nem állítható.');
   const result=await advice(request,assistant,'steps',{
    model:model.name,family:model.family,variant:model.variant,catalogTitle:model.catalogTitle,
    current:steps,source,baseline:automaticSamplingDefaults(model).steps,choices,
    prompt:String(prompt||'').slice(0,2200),width,height,duration
   });
   const summary=String(steps)+' · '+(SAMPLING_SOURCE_TEXT[source]||source);
   return {...result,summary,maxCount:1000,plan};
  },
  apply(value,result){apply(value,result.plan);}
 });
}

export function openSizeAdvice({request,notify,prompt,mode,current,families,image,apply}){
 if(!prompt.trim()){notify('Írj promptot a méretajánláshoz.');return;}
 const choices=sizeAdviceChoices(mode,current,families);
 return openCreativeAdvice({title:'✦ Méretajánlás',request,notify,applySize:apply,
  async task(model){
   const start=await imageSize(image);
   const result=await advice(request,model,'size',{
    prompt:prompt.slice(0,2200),mode,choices:Object.keys(choices),
    image:start?{width:start.width,height:start.height}:null
   });
   const size=choices[result.orientation];
   if(!size)throw Error('Az MI nem adott használható képarányt. Próbáld újra.');
   const differs=start?.width&&start?.height&&
    Math.abs(Math.log((start.width/start.height)/(size.width/size.height)))>.12;
   const labels={landscape:'Fekvő',portrait:'Álló',square:'Négyzetes'};
   return {...result,size,summary:labels[result.orientation]+' · '+presetLabel(size.width,size.height)+
    (differs?' · A kezdőkép eltérő aránya miatt levágás lehet.':'')};
  }
 });
}
