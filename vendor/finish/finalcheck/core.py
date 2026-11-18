"""Read-only local video checks. Findings are review suggestions, never a quality verdict."""
from __future__ import annotations
import json, math, os, re, subprocess, threading, time, uuid
from pathlib import Path
from .media import media_path, probe, prepare, validate_id, number

VERSION='0.3.0'
DEFAULTS={'black':True,'freeze':True,'silence':True,'peak':True,'expect_audio':True,
          'black_s':.2,'freeze_s':1.5,'silence_s':1.,'silence_db':-50.,'peak_db':-.1}
LIMITS={'black_s':(.04,5),'freeze_s':(.25,30),'silence_s':(.1,30),'silence_db':(-80,-10),'peak_db':(-6,0)}
class Cancelled(RuntimeError):pass

def options(value=None):
    value={} if value is None else value
    if not isinstance(value,dict):raise ValueError('Check settings must be an object.')
    result=dict(DEFAULTS)
    for key in result:
        if key not in value:continue
        if key in LIMITS:result[key]=number(value[key],key,*LIMITS[key])
        elif type(value[key]) is not bool:raise ValueError('Checkbox settings must be true or false.')
        else:result[key]=value[key]
    return result

def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name('.'+path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temporary.open('x',encoding='utf-8') as f:json.dump(value,f,ensure_ascii=False,indent=2,allow_nan=False)
        os.replace(temporary,path)
    finally:temporary.unlink(missing_ok=True)

def register(exe,root,value,name=None):
    path=media_path(value);stat=path.stat();ident=uuid.uuid4().hex
    proxy=root/'Previews'/(ident+'.mp4');proxy.parent.mkdir(parents=True,exist_ok=True)
    try:
        info=prepare(exe,path,proxy)
        after=path.stat()
        if (after.st_size,after.st_mtime_ns)!=(stat.st_size,stat.st_mtime_ns):raise ValueError('Source changed during preparation.')
        record={'id':ident,'name':str(name or path.name)[:240],'path':str(path),'size':stat.st_size,'mtime_ns':stat.st_mtime_ns,'media':info}
        write_json(root/'Records'/(ident+'.json'),record)
        return public_record(record)
    except Exception:
        proxy.unlink(missing_ok=True);raise

def load_record(root,ident):
    ident=validate_id(ident);file=root/'Records'/(ident+'.json')
    if file.is_symlink() or not file.is_file():raise ValueError('Source unavailable. Add the video again.')
    record=json.loads(file.read_text(encoding='utf-8'));path=media_path(record['path']);stat=path.stat()
    if record.get('id')!=ident or (stat.st_size,stat.st_mtime_ns)!=(record.get('size'),record.get('mtime_ns')):raise ValueError('Source changed. Add the video again.')
    return record

def public_record(record):return {'id':record['id'],'name':record['name'],**record['media'],'proxy':'/prophetero_final_check/preview/'+record['id']+'.mp4'}

def command(exe,args,cancel=None,timeout=300):
    """Own cancellable child process; no shell, original inputs are never outputs."""
    if cancel and cancel.is_set():raise Cancelled('Check cancelled.')
    process=subprocess.Popen([str(exe),'-hide_banner','-nostdin',*map(str,args)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                             creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    deadline=time.monotonic()+timeout
    try:
        while True:
            try:out,err=process.communicate(timeout=.25);break
            except subprocess.TimeoutExpired:
                if cancel and cancel.is_set():raise Cancelled('Check cancelled.')
                if time.monotonic()>deadline:raise RuntimeError('Check timed out. Try a shorter video.')
        if process.returncode:raise RuntimeError(err.decode(errors='replace')[-1600:] or 'Media decoding failed.')
        return out.decode(errors='replace'),err.decode(errors='replace')
    finally:
        if process.poll() is None:
            process.kill();process.communicate()

FLOAT=r'(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)'
def finding(kind,start,end,duration,**extra):
    start=max(0,min(duration,float(start)));end=max(start,min(duration,float(end)))
    return {'kind':kind,'start':round(start,6),'end':round(end,6),**extra}

def parse_video(log,duration,settings):
    result=[];freeze=None
    for line in log.splitlines():
        if settings['black'] and 'black_start:' in line:
            start=re.search('black_start:'+FLOAT,line);end=re.search('black_end:'+FLOAT,line)
            if start and end and float(end[1])-float(start[1])+1e-4>=settings['black_s']:
                result.append(finding('black',start[1],end[1],duration))
        if settings['freeze']:
            start=re.search('freeze_start: '+FLOAT,line);end=re.search('freeze_end: '+FLOAT,line)
            if start:freeze=float(start[1])
            if end and freeze is not None:
                result.append(finding('freeze',freeze,end[1],duration));freeze=None
    if freeze is not None:result.append(finding('freeze',freeze,duration,duration))
    return result

def parse_audio(log,duration,settings):
    result=[];quiet=None;timestamp=0.;peaks=[];peak_max=None
    for line in log.splitlines():
        if settings['silence']:
            start=re.search('silence_start: '+FLOAT,line);end=re.search('silence_end: '+FLOAT,line)
            if start:quiet=float(start[1])
            if end and quiet is not None:
                result.append(finding('silence',quiet,end[1],duration));quiet=None
        at=re.search('pts_time:'+FLOAT,line)
        if at:timestamp=float(at[1])
        if settings['peak']:
            at=re.search(r'lavfi\.astats\.Overall\.Peak_level='+FLOAT,line)
            if at:
                level=float(at[1]);peak_max=level if peak_max is None else max(level,peak_max)
                if level>=settings['peak_db']:peaks.append((timestamp,level))
    if quiet is not None and duration-quiet>=settings['silence_s']-.02:result.append(finding('silence',quiet,duration,duration))
    # 0.1-second audio windows. Near-full-scale peaks are NOT proof of clipping.
    groups=[]
    for timestamp,level in peaks:
        if groups and timestamp<=groups[-1][1]+.015:groups[-1]=(groups[-1][0],timestamp+.1,max(groups[-1][2],level))
        else:groups.append((timestamp,timestamp+.1,level))
    result.extend(finding('peak',a,b,duration,peak_db=round(level,3)) for a,b,level in groups)
    return result,peak_max

def recipe_evidence(path):
    import av
    names=[];prompt=False;workflow=False
    def inspect(value,depth=0):
        nonlocal prompt,workflow
        if depth>4 or not isinstance(value,dict):return
        if value.get('nodes') and isinstance(value['nodes'],list):workflow=True
        if any(isinstance(v,dict) and 'class_type' in v for v in value.values()):prompt=True
        for key,part in value.items():
            key=str(key).lower()
            if key in ('prompt','positive','positive_prompt','parameters') and isinstance(part,str) and part.strip():prompt=True
            if key=='workflow' and isinstance(part,dict) and part.get('nodes'):workflow=True
            if isinstance(part,dict):inspect(part,depth+1)
    with av.open(str(path),options={'protocol_whitelist':'file,pipe'}) as container:
        for key,value in container.metadata.items():
            if key.lower() not in ('prompt','workflow','parameters','comment','description'):continue
            names.append(key)
            if not value or len(value.encode('utf-8'))>1024**2:continue
            try:parsed=json.loads(value)
            except (ValueError,TypeError):
                if key.lower() in ('prompt','parameters') and value.strip():prompt=True
            else:inspect(parsed)
    return {'tag_names':names,'prompt_evidence':prompt,'workflow_evidence':workflow,
            'scope':'Embedded metadata only; sidecars are not scanned. Presence does not prove a complete reproducible recipe.'}

def analyze(exe,root,ident,settings=None,cancel=None,progress=lambda stage:None):
    settings=options(settings);record=load_record(root,ident);path=Path(record['path']);info=record['media'];duration=info['duration'];results=[]
    progress('video');base=['-v','info','-xerror','-threads','2','-protocol_whitelist','file,pipe','-i',path]
    filters=[]
    if settings['black']:filters.append(f"blackdetect=d={settings['black_s']}:pix_th=0.10:pic_th=0.98")
    if settings['freeze']:filters.append(f"freezedetect=n=-55dB:d={settings['freeze_s']}")
    # Decode every source frame, even if visual detectors are disabled. Do not downscale detections.
    _,log=command(exe,[*base,'-map',f"0:{info['video_index']}",'-an','-vf',','.join(filters) or 'null','-f','null','-'],cancel)
    results+=parse_video(log,duration,settings)
    progress('audio');peak_max=None
    if not info['audio']:
        if settings['expect_audio']:results.append(finding('no_audio',0,duration,duration))
    else:
        audio=[]
        if settings['silence']:audio.append(f"silencedetect=noise={settings['silence_db']}dB:d={settings['silence_s']}")
        if settings['peak']:audio+=['aformat=sample_fmts=flt:sample_rates=48000','asetnsamples=n=4800:p=0','astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level','ametadata=mode=print:key=lavfi.astats.Overall.Peak_level']
        _,log=command(exe,[*base,'-map',f"0:{info['audio_index']}",'-vn','-af',','.join(audio) or 'anull','-f','null','-'],cancel)
        found,peak_max=parse_audio(log,duration,settings);results+=found
    progress('metadata');recipe=recipe_evidence(path)
    if not recipe['prompt_evidence'] and not recipe['workflow_evidence']:results.append(finding('recipe',0,0,duration))
    if cancel and cancel.is_set():raise Cancelled('Check cancelled.')
    load_record(root,ident)  # Refuse results if the source changed during scanning.
    results.sort(key=lambda f:(f['start'],f['kind'],f['end']))
    for i,item in enumerate(results):item['id']=f"{item['kind']}-{i}-{item['start']:.6f}"
    report={'schema':'prophetero.final-check.v1','version':VERSION,'id':uuid.uuid4().hex,'source':public_record(record),
            'settings':settings,'findings':results,'metadata':recipe,'audio_peak_db':peak_max,
            'checks_completed':{'video_decode':True,'audio_decode':bool(info['audio']),'black':settings['black'],'freeze':settings['freeze'],'silence':settings['silence'] and bool(info['audio']),'peak':settings['peak'] and bool(info['audio'])},
            'verdict':'Review suggestions only; not a guarantee of quality, rights or platform acceptance.'}
    write_json(root/'Reports'/(report['id']+'.json'),report);progress('done');return report

def source_frame(root,ident,seconds):
    import av
    record=load_record(root,ident);info=record['media'];seconds=number(seconds,'Frame time',0,max(0,info['duration']-1/info['fps']))
    frame_index=int(seconds*info['fps']);path=root/'Frames'/f'{ident}_{frame_index}.png';path.parent.mkdir(parents=True,exist_ok=True)
    if path.is_file() and not path.is_symlink():return path
    with av.open(record['path'],options={'protocol_whitelist':'file,pipe'}) as container:
        stream=next(s for s in container.streams.video if not int(s.disposition)&1024);stream.codec_context.thread_count=2
        origin=float((stream.start_time or 0)*stream.time_base);wanted=frame_index/info['fps']
        container.seek(max(0,int((origin+wanted)/stream.time_base)),stream=stream,backward=True,any_frame=False)
        chosen=None
        for frame in container.decode(stream):
            chosen=frame
            if frame.pts is None or float(frame.pts*stream.time_base)-origin>=wanted-1e-6:break
        if chosen is None:raise ValueError('No decodable frame at this position.')
        temporary=path.with_name(path.stem+'.'+uuid.uuid4().hex+'.tmp')
        try:chosen.to_image().save(temporary,format='PNG');os.replace(temporary,path)
        finally:temporary.unlink(missing_ok=True)
    for old in sorted(path.parent.glob('*.png'),key=lambda f:f.stat().st_mtime,reverse=True)[80:]:
        if old!=path and not old.is_symlink():
            try:old.unlink()
            except OSError:pass
    return path

def handoff(root,payload):
    record=load_record(root,payload.get('source'));kind=payload.get('kind');language=payload.get('language','EN')
    if language not in ('EN','HU','DE','FR','ES','IT','PT','PL'):raise ValueError('Choose a supported language.')
    if kind=='audio_fix':
        node_type='PropheteroAudioFix';values=[record['path'],'','original',0.,'off',-16.,0.,0.,0.,True,'auto',0.,language,'Prophetero_AudioFix']
    elif kind=='loop_lab':
        start=number(payload.get('start',0),'Start',0,record['media']['duration']);end=number(payload.get('end',record['media']['duration']),'End',0,record['media']['duration'])
        if not .5<=end-start<=60 or round((end-start)*record['media']['fps'])<4:raise ValueError('Loop Lab needs 0.5–60 seconds and at least four frames.')
        node_type='PropheteroLoopLab';values=[record['path'],start,end,'cut',.1,'cycle',3,30,18,language,'Prophetero_Loop','smooth',.04]
    else:raise ValueError('Choose Audio Fix or Loop Lab.')
    node={'id':1,'type':node_type,'pos':[450,70],'size':[660,800],'flags':{},'order':0,'mode':0,'inputs':[],
          'outputs':[{'name':'saved_file','type':'STRING','links':None,'slot_index':0}],'properties':{'Node name for S&R':node_type},'widgets_values':values}
    note={'id':2,'type':'Note','pos':[20,70],'size':[400,260],'flags':{},'order':1,'mode':0,'inputs':[],'outputs':[],
          'properties':{},'widgets_values':['Prepared from Final Check. Install the target tool separately, review its settings, then run there. No automatic repair has been applied. This workflow contains a local source path: check before sharing publicly.']}
    return {'id':str(uuid.uuid4()),'version':.4,'revision':0,'last_node_id':2,'last_link_id':0,'nodes':[node,note],'links':[],'groups':[],'config':{},'extra':{}}
