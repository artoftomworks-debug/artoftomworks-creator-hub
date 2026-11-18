"""Bounded local loop processing; original media is never written."""
from __future__ import annotations
import hashlib,json,math,os,subprocess,tempfile
from pathlib import Path
import av

FORMATS={'.mp4':'mov','.mov':'mov','.mkv':'matroska','.webm':'matroska','.avi':'avi','.m4v':'mov','.wav':'wav'}
VIDEO_SUFFIXES=set(FORMATS)-{'.wav'}
NO_WINDOW=getattr(subprocess,'CREATE_NO_WINDOW',0)
PICTURE_METHODS=('crossfade','cut','fadeblack','fadewhite','wipeleft','wiperight','circleopen','hblur')
def number(value,name,low,high):
    try: result=float(value)
    except (TypeError,ValueError): raise ValueError(name+' must be numeric.') from None
    if not math.isfinite(result) or not low<=result<=high:raise ValueError(f'{name}: expected {low} to {high}.')
    return result
def media_path(value):
    raw=str(value).strip().strip('"')
    if raw.startswith(('\\\\','//')) or not Path(raw).is_absolute():raise ValueError('Choose an absolute local video path.')
    path=Path(raw).resolve(strict=True)
    if not path.is_file() or path.suffix.lower() not in VIDEO_SUFFIXES:raise ValueError('Unsupported local video file.')
    return path
def probe(path):
    try:
        with av.open(str(path),format=FORMATS.get(Path(path).suffix.lower()),options={'protocol_whitelist':'file,pipe'}) as c:
            v=next((v for v in c.streams.video if not int(v.disposition)&1024),None)
            if v is None:raise ValueError('No video stream.')
            fps=float(v.average_rate or v.guessed_rate or 0);rate=str(v.average_rate or v.guessed_rate or '24')
            duration=float(v.duration*v.time_base) if v.duration is not None else float(c.duration/av.time_base) if c.duration else 0
            number(duration,'Source duration',.5,300);number(fps,'Frame rate',1,60)
            if not 1<=v.width*v.height<=16777216:raise ValueError('Maximum source size: 16 megapixels.')
            a=next(iter(c.streams.audio),None)
            if a and a.codec_context.channels>2:raise ValueError('This edition supports mono/stereo audio.')
            # Avoid silently discarding HDR/rotation intent while converting to SDR H.264.
            trc=int(v.codec_context.color_trc or 0);primaries=int(v.codec_context.color_primaries or 0)
            if trc in (16,18) or primaries==9:raise ValueError('HDR/wide-gamut source: use a colour-managed editor.')
            frame=next(c.decode(v),None)
            if frame is None:raise ValueError('Video has no decodable frames.')
            rotation=int(getattr(frame,'rotation',0) or float(v.metadata.get('rotate','0') or '0'))%360
            if v.sample_aspect_ratio and float(v.sample_aspect_ratio)!=1:raise ValueError('Non-square pixels: make a square-pixel SDR copy first.')
            if rotation:raise ValueError('Rotated source: create an upright SDR copy first.')
            metadata={};omitted=[]
            for source,tags in [('container',c.metadata),('video',v.metadata)]:
                for k,val in tags.items():
                    if k.lower() not in {'prompt','workflow','parameters','comment','description'}:continue
                    key=k if source=='container' else 'video.'+k
                    if len(str(val))>131072:omitted.append({'key':key,'reason':'over 128 KiB tag limit'})
                    else:metadata[key]=val
            return dict(duration=duration,fps=fps,rate=rate,width=v.width,height=v.height,audio=bool(a),metadata=metadata,metadata_omitted=omitted)
    except (OSError,ValueError):raise
    except Exception as e:raise ValueError('Cannot inspect video: '+str(e)) from e
def run(exe,args,timeout=360):
    try:r=subprocess.run([str(exe),'-hide_banner','-nostdin',*map(str,args)],capture_output=True,timeout=timeout,creationflags=NO_WINDOW)
    except subprocess.TimeoutExpired:raise RuntimeError('Loop processing timed out. Use a shorter cut.') from None
    except OSError as e:raise RuntimeError('Cannot run FFmpeg: '+str(e)) from e
    if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-1600:] or 'FFmpeg failed.')
    return r.stdout
def inp(path):return ['-protocol_whitelist','file,pipe','-f',FORMATS[Path(path).suffix.lower()],'-i',str(path)]
def settings(info,start_s=0,end_s=0,method='crossfade',blend_s=.5):
    fps=info['fps'];start=number(start_s,'Start',0,info['duration']);end=number(end_s,'End',0,info['duration']+.05)
    if end==0:end=info['duration']
    start_frame=round(start*fps);end_frame=min(math.floor(info['duration']*fps+1e-4),round(end*fps));frames=end_frame-start_frame
    if frames<max(4,math.ceil(fps*.5)) or frames/fps>60:raise ValueError('Choose a cut between 0.5 and 60 seconds.')
    if method not in PICTURE_METHODS:raise ValueError('Unknown loop method.')
    blend=0 if method=='cut' else max(2,round(number(blend_s,'Blend',.05,5)*fps))
    if blend and blend*3>frames:raise ValueError('Blend must be at most one third of the selected cut.')
    return dict(start_frame=start_frame,frames=frames,start_s=start_frame/fps,end_s=end_frame/fps,method=method,blend_frames=blend,blend_s=blend/fps,cycle_frames=frames-blend,cycle_s=(frames-blend)/fps)
def fingerprint(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as s:
        for chunk in iter(lambda:s.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def rank_loop_points(frames,fps,start_frame=0):
    """Rank forward-time joins using colour and signed frame-to-frame changes.

    End is exclusive. The seam step must resemble ongoing changes, rather
    than merely matching the amount of motion in unrelated directions.
    All measurements are heuristics; they do not certify a seamless loop.
    """
    count=len(frames);minimum=max(4,math.ceil(fps*.5))
    if count<math.ceil(fps):raise ValueError('Choose at least one second for automatic suggestions.')
    step=max(1,round(fps/8));small=[f[::4] for f in frames]
    def score(i,j,full=False):
        f=frames if full else small;a=f[i];b=f[j]
        prev=f[max(0,j-1)];nxt=f[min(count-1,i+1)];size=len(a)*255
        visual=motion=seam=0
        for x,y,z,w in zip(a,b,prev,nxt):
            incoming=y-z;outgoing=w-x
            visual+=abs(x-y);motion+=abs(incoming-outgoing)
            seam+=abs((x-y)-(incoming+outgoing)/2)
        v=visual/size;m=motion/size;e=seam/size
        return .7*e+.2*m+.1*v,v,m,e
    coarse=[]
    for i in range(0,max(1,count//3),step):
        for j in range(max(i+minimum-1,count*2//3),count,step):
            coarse.append((*score(i,j),i,j))
    # Refine native-frame positions around the best coarse pairs.
    candidates={}
    for *_,i,j in sorted(coarse)[:12]:
        for a in range(max(0,i-step),min(count-minimum,i+step)+1):
            for b in range(max(a+minimum-1,j-step),min(count-1,j+step)+1):
                if (a,b) not in candidates:candidates[a,b]=(*score(a,b,True),a,b)
    best=[]
    for total,visual,motion,seam,i,j in sorted(candidates.values()):
        a=(start_frame+i)/fps;b=(start_frame+j+1)/fps
        if any(abs(a-v['start_s'])<.25 and abs(b-v['end_s'])<.25 for v in best):continue
        best.append(dict(start_s=a,end_s=b,start_frame=start_frame+i,end_frame_exclusive=start_frame+j+1,
            difference_percent=round(visual*100,2),motion_difference=round(motion*100,2),seam_error_percent=round(seam*100,2),
            score_percent=round(total*100,2),join_hint='close' if total<.015 else 'review' if total<.045 else 'large_change'))
        if len(best)==3:break
    return best

def analyze(exe,video_path,start_s=0,end_s=0):
    path=media_path(video_path);info=probe(path);s=settings(info,start_s,end_s,'cut',0)
    # At most 60s x 60fps x 32x18 RGB: under 6 MiB, no full-size frame buffer.
    data=run(exe,['-v','error','-ss',s['start_s'],*inp(path),'-an','-vf',f"fps={info['rate']},trim=end_frame={s['frames']},scale=32:18:flags=area,format=rgb24",'-frames:v',s['frames'],'-f','rawvideo','-pix_fmt','rgb24','-threads','2','-'],timeout=90)
    size=32*18*3;frames=[data[i:i+size] for i in range(0,len(data)-size+1,size)]
    best=rank_loop_points(frames,info['fps'],s['start_frame'])
    return {'source':{k:v for k,v in info.items() if k!='metadata'},'candidates':best,
        'metric':'32x18 colour, signed temporal changes and seam-step prediction; native-frame refinement; heuristic, not a seamlessness guarantee'}

def smooth_audio_seam(exe,source,destination,samples,window_s):
    """Equal-length, local boundary crossfade using reflected short contexts.

    The two halves of the bridge surround the wrap, so its centre is the
    file boundary. The middle stays sample-aligned, with no speed change,
    shortening, inserted silence or accumulating A/V drift. Short reflected
    contexts can colour transients: review speech/music or use cut instead.
    """
    n=samples;w=min(round(number(window_s,'Audio blend',.005,.5)*48000),n//6)
    if w<2:raise ValueError('Audio transition is too short.')
    graph=(f'[0:a:0]apad,atrim=end_sample={n},asetpts=N/SR/TB,asplit=3[m][t][h];'
        f'[m]atrim=start_sample={w}:end_sample={n-w},asetpts=N/SR/TB[mid];'
        f'[t]atrim=start_sample={n-w}:end_sample={n},asetpts=N/SR/TB,asplit=2[t1][t2];'
        '[t2]areverse[tr];[t1][tr]concat=n=2:v=0:a=1[tail];'
        f'[h]atrim=end_sample={w},asetpts=N/SR/TB,asplit=2[h1][h2];'
        '[h1]areverse[hr];[hr][h2]concat=n=2:v=0:a=1[head];'
        f'[tail]afade=t=out:ss=0:ns={2*w-1}:curve=tri[ft];'
        f'[head]afade=t=in:ss=0:ns={2*w-1}:curve=tri[fh];'
        '[ft][fh]amix=inputs=2:duration=shortest:normalize=0:dropout_transition=0,asplit=2[b1][b2];'
        f'[b1]atrim=start_sample={w}:end_sample={2*w},asetpts=N/SR/TB[first];'
        f'[b2]atrim=end_sample={w},asetpts=N/SR/TB[last];'
        f'[first][mid][last]concat=n=3:v=0:a=1,apad,atrim=end_sample={n},asetpts=N/SR/TB[a]')
    run(exe,['-v','error',*inp(source),'-filter_complex_threads','1','-filter_complex',graph,'-map','[a]','-vn','-c:a','pcm_s24le','-threads','2','-n',destination])
    return w/48000

def comparison_frames(exe,path,info,s,directory,token):
    result=[]
    for key,time in [('first',s['start_s']),('last',s['end_s']-1/info['fps'])]:
        dest=directory/(token+'_'+key+'.png')
        run(exe,['-v','error','-ss',time,*inp(path),'-frames:v','1','-an','-vf',"scale=720:720:force_original_aspect_ratio=decrease",'-threads','2','-n',dest],timeout=45);result.append(dest.name)
    return result
def render(exe,video_path,destination,start_s=0,end_s=0,method='crossfade',blend_s=.5,output_mode='cycle',repetitions=3,target_s=30,quality=18,preview=False,audio_transition='follow_video',audio_blend_s=.04):
    path=media_path(video_path);info=probe(path);s=settings(info,start_s,end_s,method,blend_s)
    if audio_transition not in ('follow_video','smooth','cut','mute'):raise ValueError('Unknown audio transition.')
    audio_blend_s=number(audio_blend_s,'Audio blend',.005,.5)
    has_audio=info['audio'] and audio_transition!='mute'
    if not preview and info['width']*info['height']*s['blend_frames']>240000000:raise ValueError('This blend needs too much frame memory. Shorten blend_s or use a smaller source.')
    quality=int(number(quality,'Quality',16,25));repetitions=number(repetitions,'Repetitions',1,100)
    if int(repetitions)!=repetitions:raise ValueError('Repetitions must be a whole number.')
    if output_mode not in ('cycle','repetitions','duration'):raise ValueError('Unknown output mode.')
    target_s=number(target_s,'Target duration',.5,600)
    length=s['cycle_s'] if output_mode=='cycle' else s['cycle_s']*int(repetitions) if output_mode=='repetitions' else round(target_s*info['fps'])/info['fps']
    if preview:length=3*s['cycle_s']
    if length>600:raise ValueError('Maximum output length: 600 seconds.')
    dest=Path(destination).resolve();dest.parent.mkdir(parents=True,exist_ok=True)
    if dest==path or dest.exists() or dest.with_suffix('.loop.json').exists():raise ValueError('Choose a new output filename.')
    before=path.stat();source_hash=fingerprint(path);sidecar=dest.with_suffix('.loop.json')
    with tempfile.TemporaryDirectory(prefix='.loop-',dir=dest.parent) as temp:
        temp=Path(temp);cycle=temp/'cycle.mp4';audio=temp/'cycle.wav';finished=temp/'finished.mp4'
        duration=s['frames']/info['fps'];x=s['blend_s'];rate=info['rate']
        base=f"fps={rate},trim=end_frame={s['frames']},setpts=PTS-STARTPTS,pad=ceil(iw/2)*2:ceil(ih/2)*2,setsar=1,format=yuv420p"
        if preview:base+=',scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2'
        if method=='cut':graph='[0:v:0]'+base+'[v]'
        else:
            n=s['frames'];b=s['blend_frames'];fade_time=(b-1)/info['fps']
            transition='fade' if method=='crossfade' else method
            graph=f'[0:v:0]{base},split=3[m][t][h];[m]trim=start_frame={b}:end_frame={n-b},setpts=PTS-STARTPTS[mid];[t]trim=start_frame={n-b}:end_frame={n},setpts=PTS-STARTPTS,fps={rate}[tail];[h]trim=end_frame={b},setpts=PTS-STARTPTS,fps={rate}[head];[tail][head]xfade=transition={transition}:duration={fade_time:.9f}:offset=0[bridge];[mid][bridge]concat=n=2:v=1:a=0,fps={rate}[v]'
        run(exe,['-v','error','-ss',s['start_s'],*inp(path),'-filter_complex_threads','1','-filter_complex',graph,'-map','[v]','-an','-frames:v',s['cycle_frames'],'-c:v','libx264','-preset','veryfast','-crf',quality,'-threads','2','-map_metadata','-1','-n',cycle])
        if has_audio:
            samples=round(s['cycle_s']*48000);overlap=round(s['blend_s']*48000);total_samples=samples+overlap
            abase=f'aresample=48000:async=1:first_pts=0,apad,atrim=end_sample={total_samples},asetpts=N/SR/TB'
            if method=='cut' or audio_transition!='follow_video':ag=f'[0:a:0]{abase},atrim=start_sample={overlap}:end_sample={total_samples},asetpts=N/SR/TB[a]'
            else:
                ag=f'[0:a:0]{abase},asplit=3[am][at][ah];[am]atrim=start_sample={overlap}:end_sample={samples},asetpts=N/SR/TB[amid];[at]atrim=start_sample={samples}:end_sample={total_samples},asetpts=N/SR/TB[atail];[ah]atrim=end_sample={overlap},asetpts=N/SR/TB[ahead];[atail]afade=t=out:ss=0:ns={overlap-1}:curve=tri[fadeTail];[ahead]afade=t=in:ss=0:ns={overlap-1}:curve=tri[fadeHead];[fadeTail][fadeHead]amix=inputs=2:duration=shortest:normalize=0:dropout_transition=0[ab];[amid][ab]concat=n=2:v=0:a=1,apad,atrim=end_sample={samples},asetpts=N/SR/TB[a]'
            run(exe,['-v','error','-ss',s['start_s'],*inp(path),'-filter_complex_threads','1','-filter_complex',ag,'-map','[a]','-vn','-c:a','pcm_s24le','-threads','2','-n',audio])
            if audio_transition=='smooth':
                smoothed=temp/'smooth.wav';audio_blend_s=smooth_audio_seam(exe,audio,smoothed,samples,audio_blend_s);audio=smoothed
        args=['-v','error','-stream_loop','-1',*inp(cycle)]
        if has_audio:args+=['-stream_loop','-1',*inp(audio)]
        metadata_index=2 if has_audio else 1
        args+=inp(path)
        args+=['-map','0:v:0','-c:v','copy']
        args+=['-map','1:a:0','-c:a','aac','-b:a','192k','-af',f'atrim=duration={length:.9f},asetpts=PTS-STARTPTS'] if has_audio else ['-an']
        args+=['-frames:v',round(length*info['fps']),'-t',f'{length:.9f}','-map_metadata',str(metadata_index),'-metadata','prophetero_processing=Loop Lab; source generation metadata retained; adjacent .loop.json holds processing settings','-movflags','+faststart+use_metadata_tags','-threads','2','-n',finished]
        run(exe,args)
        # Output can exceed the supported input-duration limit; inspect it directly.
        with av.open(str(finished)) as c:
            v=c.streams.video[0];actual=float(v.duration*v.time_base);output=dict(width=v.width,height=v.height,fps=float(v.average_rate),duration=actual,audio=bool(c.streams.audio))
        if abs(actual-length)>max(2/info['fps'],.08):raise RuntimeError('Output duration verification failed.')
        after=path.stat()
        if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise RuntimeError('Source changed during processing; output withheld.')
        report={'schema':'prophetero.loop-lab','version':1,'tool_version':'0.3.0','source':{'name':path.name,'sha256':source_hash,'media':{k:v for k,v in info.items() if k!='metadata'},'recorded_metadata':info['metadata']},'processing':{**s,'audio_transition':audio_transition,'audio_blend_s':audio_blend_s if has_audio and audio_transition=='smooth' else 0,'audio_seam_method':'reflected-context equal-length crossfade' if has_audio and audio_transition=='smooth' else audio_transition,'output_mode':output_mode,'requested_repetitions':int(repetitions),'requested_target_s':target_s,'actual_length_s':actual,'ends_on_cycle_boundary':abs(length/s['cycle_s']-round(length/s['cycle_s']))<.00001,'preview':bool(preview),'quality_crf':quality,'picture_reencoded':True},'output':output,'warnings':['Effects are visible transitions, not motion repair. Crossfade can show ghosting; review both repeated joins.','Loop settings are not the original generation prompt; recorded source metadata may be empty.']}
        if has_audio and audio_transition=='smooth':report['warnings'].append('Short reflected audio contexts smooth the join without changing timing; review transients, speech and music.')
        if not report['processing']['ends_on_cycle_boundary']:report['warnings'].append('The requested duration ends inside a cycle. Use cycle or repetitions for an aligned file end/start.')
        report['output']['sha256']=fingerprint(finished)
        recipe=temp/'recipe.json';recipe.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        # Exclusive creation prevents replacing an existing user file even after a race.
        created=[]
        try:
            for src,target in [(finished,dest),(recipe,sidecar)]:
                with src.open('rb') as reader,target.open('xb') as writer:
                    created.append(target)
                    for data in iter(lambda:reader.read(1024*1024),b''):writer.write(data)
        except Exception:
            for target in created:target.unlink(missing_ok=True)
            raise
        return report
