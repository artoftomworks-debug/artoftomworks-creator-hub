"""Owned CPU media worker. No downloads or model loading; all inputs come from the checked Hub ledger."""
import sys,json,subprocess,tempfile,os,shutil,hashlib
from pathlib import Path
import av,imageio_ffmpeg
import audio_core

def event(**v):print(json.dumps(v,ensure_ascii=False),flush=True)
def probe(file):
    with av.open(str(file),options={'protocol_whitelist':'file,pipe'}) as c:
        v=next((s for s in c.streams.video if not int(s.disposition)&1024),None)
        if v is None:raise ValueError('A fájlban nincs videósáv.')
        fps=float(v.average_rate or v.guessed_rate or 0);duration=float(v.duration*v.time_base) if v.duration is not None else float(c.duration/av.time_base) if c.duration else 0
        if not 0<duration<=3600 or not 0<fps<=240 or not 0<v.width*v.height<=33177600:raise ValueError('A videó hossza, képmérete vagy FPS-e nem támogatott.')
        return {'width':v.width,'height':v.height,'fps':fps,'seconds':duration,'frames':v.frames or round(duration*fps),'audio':bool(c.streams.audio),'codec':v.codec_context.name}
def command(args):
    p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-nostdin','-loglevel','error','-threads','2','-filter_complex_threads','1',*map(str,args)],capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),timeout=1800)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf8','replace')[-2000:])
def check(file,folder):
    from finalcheck import core,media
    root=Path(folder);root.mkdir(parents=True,exist_ok=True);info=media.probe(file);s=file.stat();ident='c'*32
    core.write_json(root/'Records'/(ident+'.json'),{'id':ident,'name':file.name,'path':str(file),'size':s.st_size,'mtime_ns':s.st_mtime_ns,'media':info})
    return core.analyze(imageio_ffmpeg.get_ffmpeg_exe(),root,ident,{'expect_audio':False},progress=lambda stage:event(phase='Ellenőrzés · '+stage))
def run(d):
    action=d['action'];files=[Path(p).resolve(strict=True) for p in d.get('sources',[d.get('source')]) if p]
    if not files or any(not p.is_file() for p in files):raise ValueError('A bemeneti média nem érhető el.')
    if action=='probe':return probe(files[0])
    output=Path(d['output']);output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():raise ValueError('A kimenet már létezik; nem írom felül.')
    if action=='trim':
        info=probe(files[0]);start=float(d.get('start',0));length=min(float(d.get('length',3)),info['seconds']-start)
        if start<0 or length<=0 or length>4:raise ValueError('A próba legfeljebb 4 másodperc, a videón belül legyen.')
        event(phase='Rövid próbarészlet előkészítése')
        command(['-ss',start,'-i',files[0],'-t',length,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-n',output])
    elif action=='assemble':
        infos=[probe(p) for p in files];first=infos[0];w,h=first['width']//2*2,first['height']//2*2;fps=first['fps'];args=[];filters=[];links=[]
        for i,(p,info) in enumerate(zip(files,infos)):
            args+=['-i',p];filters.append(f'[{i}:v:0]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},setpts=PTS-STARTPTS[v{i}]')
            if info['audio']:filters.append(f'[{i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration={info["seconds"]},asetpts=PTS-STARTPTS[a{i}]')
            else:filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={info["seconds"]},asetpts=PTS-STARTPTS[a{i}]')
            links.extend([f'[v{i}]',f'[a{i}]'])
        filters.append(''.join(links)+f'concat=n={len(files)}:v=1:a=1[v][a]');event(phase='Snittek összeállítása · CPU')
        command([*args,'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','veryfast','-crf',d.get('quality',18),'-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-n',output])
    elif action=='audio':
        a=d['audio'];event(phase='Hang feldolgozása · a kódolt képsáv megmarad')
        result=audio_core.render_audio_fix(ffmpeg_exe=imageio_ffmpeg.get_ffmpeg_exe(),video_path=files[0],destination=output,audio_path=d.get('audioSource',''),mode={'edit':'original','replace':'replace','mute':'mute'}[a['mode']],gain_db=a['gain'],normalize=a['normalize'],offset_s=a['offset'],fade_in_s=a['fadeIn'],fade_out_s=a['fadeOut'],limiter=a['limiter'],container=output.suffix[1:])
        return {'media':probe(output),'processing':result}
    elif action=='publish':
        event(phase='Eredmény mentése · képsáv újrakódolása nélkül')
        # The final artifact keeps encoded streams. Source metadata and processing recipe remain in the sidecar/ledger.
        command(['-i',files[0],'-map','0:v:0','-map','0:a:0?','-c','copy','-map_metadata','0','-movflags','+faststart+use_metadata_tags','-n',output])
    else:raise ValueError('Ismeretlen CPU-művelet.')
    result={'media':probe(output)}
    if d.get('check'):
        try:
            with tempfile.TemporaryDirectory(prefix='.creatorhub-check-',dir=output.parent) as folder:result['check']=check(output,folder)
        except ValueError as e:result['checkWarning']='A Final Check ezt a médiát nem támogatja: '+str(e)
    return result
if __name__=='__main__':
    try:
        d=json.loads(sys.stdin.read(131072));result=run(d);event(ok=True,result=result)
    except Exception as e:event(ok=False,error=str(e));sys.exit(1)
