"""Bounded local media preparation, adapted from Prophetero Take Compare."""
from __future__ import annotations
import math,re,subprocess,uuid
from pathlib import Path
import av
SUFFIXES={'.mp4':'mov','.mov':'mov','.m4v':'mov','.mkv':'matroska','.webm':'matroska','.avi':'avi'}
ID=re.compile(r'^[0-9a-f]{32}$')
MAX_FILE=2*1024**3
MAX_TOTAL=6*1024**3

def number(value,name,low,high):
    try:n=float(value)
    except (TypeError,ValueError):raise ValueError(name+' must be numeric.') from None
    if not math.isfinite(n) or not low<=n<=high:raise ValueError(f'{name}: expected {low:g} to {high:g}.')
    return n

def media_path(value):
    raw=str(value).strip().strip('"')
    if not Path(raw).is_absolute() or raw.startswith(('//','\\\\')):raise ValueError('Choose an absolute local video path.')
    p=Path(raw).resolve(strict=True)
    if not p.is_file() or p.suffix.lower() not in SUFFIXES:raise ValueError('Choose a supported local video.')
    if p.stat().st_size>MAX_FILE:raise ValueError('Maximum source size: 2 GiB.')
    return p

def probe(path):
    with av.open(str(path),format=SUFFIXES[path.suffix.lower()],options={'protocol_whitelist':'file,pipe'}) as c:
        v=next((v for v in c.streams.video if not int(v.disposition)&1024),None)
        if v is None:raise ValueError('No video stream.')
        fps=float(v.average_rate or v.guessed_rate or 0)
        duration=float(v.duration*v.time_base) if v.duration is not None else float(c.duration/av.time_base) if c.duration else 0
        number(fps,'Source FPS',1,60);number(duration,'Source duration',.5,120)
        if not 1<=v.width*v.height<=8388608:raise ValueError('Maximum source size: 8 megapixels.')
        if int(v.codec_context.color_trc or 0) in (16,18) or int(v.codec_context.color_primaries or 0)==9:raise ValueError('Use an SDR source; this preview is not HDR colour-managed.')
        a=next(iter(c.streams.audio),None)
        if a and a.codec_context.channels>2:raise ValueError('This edition supports mono/stereo audio.')
        v.codec_context.thread_count=2
        first=next(c.decode(v),None)
        if first is None:raise ValueError('No decodable video frame.')
        if int(getattr(first,'rotation',0) or float(v.metadata.get('rotate','0') or '0'))%360:raise ValueError('Use an upright source.')
        if v.sample_aspect_ratio and float(v.sample_aspect_ratio)!=1:raise ValueError('Use a square-pixel source.')
        return {'duration':duration,'fps':fps,'rate':str(v.average_rate or v.guessed_rate),'width':v.width,'height':v.height,'audio':bool(a),'video_index':v.index,'audio_index':a.index if a else None,'codec':v.codec_context.name,'audio_codec':a.codec_context.name if a else None,
            'frame_count':int(v.frames or round(duration*fps)),'frame_count_estimated':not bool(v.frames),
            'generation_tags_present':[k for k in c.metadata if k.lower() in {'prompt','workflow','parameters','comment','description'}]}

def run(exe,args):
    try:r=subprocess.run([str(exe),'-hide_banner','-nostdin',*map(str,args)],capture_output=True,timeout=240,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired:raise RuntimeError('Preview preparation timed out. Try a shorter clip.') from None
    if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-1400:] or 'FFmpeg failed.')

def prepare(exe,path,destination):
    """Encode only a browser viewing proxy; never replace or modify source media."""
    info=probe(path);temporary=destination.with_name(destination.stem+'.pending.mp4')
    try:
        run(exe,['-v','error','-protocol_whitelist','file,pipe','-f',SUFFIXES[path.suffix.lower()],'-i',path,
            '-map',f"0:{info['video_index']}",*(['-map',f"0:{info['audio_index']}"] if info['audio'] else ['-an']),'-vf',f"fps={info['rate']},scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
            '-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','20','-c:a','aac','-b:a','160k',
            '-map_metadata','-1','-movflags','+faststart','-threads','2','-n',temporary])
        with av.open(str(temporary)) as c:
            if not c.streams.video:raise ValueError('Preview has no video.')
        if destination.exists():raise ValueError('Preview already exists.')
        temporary.rename(destination)
    finally:temporary.unlink(missing_ok=True)
    return info

def validate_id(value):
    value=str(value)
    if not ID.fullmatch(value):raise ValueError('Unknown take.')
    return value
