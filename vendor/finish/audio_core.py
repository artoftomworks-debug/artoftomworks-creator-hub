"""Local audio processing. Final video exports always use stream copy."""
from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

import av

VIDEO_SUFFIXES={'.mp4','.mov','.mkv','.webm','.avi','.m4v'}
AUDIO_SUFFIXES={'.wav','.mp3','.flac','.m4a','.aac','.ogg','.opus'}
MODES=('original','replace','mute','extract_wav')
MP4_CODECS={'h264','hevc','av1','mpeg4'}
NO_WINDOW=getattr(subprocess,'CREATE_NO_WINDOW',0)

@dataclass(frozen=True)
class MediaInfo:
    duration_s: float
    video_index: int | None
    audio_index: int | None
    video_codec: str
    audio_codec: str
    width: int
    height: int
    fps: float
    channels: int
    sample_rate: int
    video_start_s: float
    audio_start_s: float

def media_path(value, *, audio=False):
    candidate=Path(str(value).strip().strip('"')).expanduser()
    if not candidate.is_absolute():
        raise ValueError('Choose a file or enter an absolute local file path.')
    path=candidate.resolve(strict=True)
    if not path.is_file() or path.suffix.lower() not in (VIDEO_SUFFIXES|AUDIO_SUFFIXES if audio else VIDEO_SUFFIXES):
        raise ValueError('Unsupported local media file: '+path.name)
    return path

def _finite(value,name,minimum,maximum):
    try: number=float(value)
    except (ValueError,TypeError): raise ValueError(f'{name} must be a number.') from None
    if not math.isfinite(number) or not minimum<=number<=maximum:
        raise ValueError(f'{name} must be between {minimum} and {maximum}.')
    return number

def probe_media(path):
    try:
        with av.open(str(path),options={'protocol_whitelist':'file,pipe'}) as container:
            videos=[s for s in container.streams if s.type=='video' and not (int(s.disposition)&1024)]
            audios=list(container.streams.audio)
            video=videos[0] if videos else None
            audio=audios[0] if audios else None
            duration=float(video.duration*video.time_base) if video and video.duration is not None and video.time_base else float(container.duration/av.time_base) if container.duration else 0.0
            if not duration and audio and audio.duration is not None and audio.time_base: duration=float(audio.duration*audio.time_base)
            duration=_finite(duration,'Media duration',0.01,3600)
            fps=float(video.average_rate or video.guessed_rate or 0) if video else 0.0
            return MediaInfo(duration,video.index if video else None,audio.index if audio else None,
                video.codec_context.name if video else '',audio.codec_context.name if audio else '',
                video.codec_context.width if video else 0,video.codec_context.height if video else 0,fps,
                audio.codec_context.channels if audio else 0,audio.codec_context.sample_rate if audio else 0,
                float(video.start_time*video.time_base) if video and video.start_time is not None else 0.0,
                float(audio.start_time*audio.time_base) if audio and audio.start_time is not None else 0.0)
    except (ValueError,OSError): raise
    except Exception as exc: raise ValueError(f'Cannot inspect {Path(path).name}: {exc}') from exc

def run_ffmpeg(executable,args,timeout=600):
    try:
        result=subprocess.run([str(executable),'-hide_banner','-nostdin',*map(str,args)],
            capture_output=True,text=True,errors='replace',timeout=timeout,creationflags=NO_WINDOW)
    except subprocess.TimeoutExpired as exc: raise RuntimeError('Audio Fix timed out. Try a shorter source clip.') from exc
    if result.returncode:
        raise RuntimeError('FFmpeg: '+(result.stderr or result.stdout).strip()[-1800:])
    return result

def input_args(path): return ['-protocol_whitelist','file,pipe','-i',str(path)]

def packet_hash(executable,path,index):
    report=run_ffmpeg(executable,['-v','error',*input_args(path),'-map',f'0:{index}','-c','copy','-f','streamhash','-hash','sha256','-']).stdout
    match=re.search(r'SHA256=([a-fA-F0-9]{64})',report)
    if not match: raise RuntimeError('Could not verify the encoded video stream.')
    return match.group(1).lower()

def audio_levels(executable,path,index):
    report=run_ffmpeg(executable,[*input_args(path),'-map',f'0:{index}','-vn','-af','volumedetect','-f','null','-']).stderr
    result={}
    for key in ['mean_volume','max_volume']:
        found=re.search(key+r':\s*(-?inf|[-+\d.]+) dB',report)
        if found:
            number=float(found.group(1));result[key+'_db']=number if math.isfinite(number) else None
    result['silent']=result.get('max_volume_db') is None or result.get('max_volume_db',0)<=-90
    return result

def inspect_media(executable,video_path,audio_path='',mode='original',gain_db=0):
    video=media_path(video_path);info=probe_media(video)
    if info.video_index is None: raise ValueError('The selected source has no video stream.')
    sound=media_path(audio_path,audio=True) if mode in ('replace','extract_wav') and str(audio_path).strip() else video
    sound_info=probe_media(sound) if sound!=video else info
    result={'video':asdict(info),'source_name':video.name,'sound_name':sound.name,'picture_copy':True,'audio':None,'warnings':[]}
    if sound_info.audio_index is not None:
        result['audio']=audio_levels(executable,sound,sound_info.audio_index)
        peak=result['audio'].get('max_volume_db')
        if peak is not None:
            result['suggested_max_gain_db']=round(-1.5-peak,2)
            if peak+_finite(gain_db,'Gain',-36,24)>-1.5:result['warnings'].append('Selected gain needs peak limiting or a lower level.')
        if result['audio']['silent']:result['warnings'].append('The selected audio is silent or below the measurable level.')
    else:result['warnings'].append('No audio stream. Choose replacement sound or mute mode.')
    if info.video_codec not in MP4_CODECS:result['warnings'].append('Use Auto or MKV to keep this video codec unchanged.')
    return result

def _audio_setup(video,info,audio_path,mode,offset):
    if mode=='replace' and not str(audio_path).strip():raise ValueError('Choose replacement audio or a video containing sound.')
    sound=media_path(audio_path,audio=True) if mode in ('replace','extract_wav') and str(audio_path).strip() else video
    sound_info=probe_media(sound) if sound!=video else info
    if sound_info.audio_index is None:raise ValueError('The selected sound source has no audio stream. Choose another source or mute mode.')
    if sound_info.channels not in (1,2):raise ValueError('This first version supports mono/stereo audio; convert surround audio separately.')
    shift=offset+(sound_info.audio_start_s-info.video_start_s if sound==video else 0)
    chain=['asetpts=PTS-STARTPTS']
    if shift<0:chain.extend([f'atrim=start={-shift:.6f}','asetpts=PTS-STARTPTS'])
    elif shift>0:chain.append(f'adelay=delays={round(shift*1000)}:all=1')
    chain.extend([f'apad=whole_dur={info.duration_s:.9f}',f'atrim=duration={info.duration_s:.9f}'])
    return sound,sound_info,chain

def _normalizer(executable,sound,index,chain,target,warnings):
    first=run_ffmpeg(executable,[*input_args(sound),'-map',f'0:{index}','-vn','-af',','.join(chain+[f'loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json']),'-f','null','-'])
    blocks=re.findall(r'\{[^{}]*"input_i"[^{}]*\}',first.stderr,re.S)
    if not blocks:raise RuntimeError('Loudness analysis did not return measurements.')
    stats=json.loads(blocks[-1])
    try:values=[float(stats[k]) for k in ['input_i','input_tp','input_lra','input_thresh','target_offset']]
    except (ValueError,KeyError):raise RuntimeError('Invalid loudness measurements.') from None
    if not all(math.isfinite(v) for v in values):
        warnings.append('Silence/very short sound could not be normalized; manual gain was kept.')
        return None
    return f'loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={values[0]}:measured_TP={values[1]}:measured_LRA={values[2]}:measured_thresh={values[3]}:offset={values[4]}:linear=true'

def output_extension(video_info,container,mode):
    if mode=='extract_wav':return '.wav'
    if container not in ('auto','mp4','mkv'):raise ValueError('Choose Auto, MP4 or MKV.')
    if container=='mp4' and video_info.video_codec not in MP4_CODECS:
        raise ValueError('MP4 cannot preserve this video codec here. Choose MKV or Auto; Audio Fix never re-encodes final video.')
    return '.mp4' if container=='mp4' or container=='auto' and video_info.video_codec in MP4_CODECS else '.mkv'

def _publish(temporary,destination):
    created=False
    try:
        with destination.open('xb') as output:
            created=True
            with temporary.open('rb') as source:shutil.copyfileobj(source,output,8*1024*1024)
    except Exception:
        if created:destination.unlink(missing_ok=True)
        raise

def render_audio_fix(*,ffmpeg_exe,video_path,destination,audio_path='',mode='original',gain_db=0,normalize='off',target_lufs=-16,
                     offset_s=0,fade_in_s=0,fade_out_s=0,limiter=True,container='auto',preview_at_s=None,original_preview=False,preview_duration_s=4):
    if mode not in MODES:raise ValueError('Unknown audio mode.')
    if normalize not in ('off','ebu_r128'):raise ValueError('Unknown normalization mode.')
    gain=_finite(gain_db,'Gain',-36,24);target=_finite(target_lufs,'Loudness target',-24,-9)
    offset=_finite(offset_s,'Audio offset',-30,30);fade_in=_finite(fade_in_s,'Fade in',0,10);fade_out=_finite(fade_out_s,'Fade out',0,10)
    if not isinstance(limiter,bool):raise ValueError('Limiter must be enabled or disabled.')
    video=media_path(video_path);info=probe_media(video)
    if info.video_index is None:raise ValueError('The selected source has no video stream.')
    if original_preview:
        if preview_at_s is None:raise ValueError('Original preview requires a preview position.')
        mode='original' if info.audio_index is not None else 'mute';gain=0;normalize='off';offset=0;fade_in=fade_out=0;limiter=False
    if fade_in+fade_out>info.duration_s:raise ValueError('Combined fades must fit inside the video duration.')
    destination=Path(destination).absolute();preview=preview_at_s is not None
    if preview:
        at=_finite(preview_at_s,'Preview position',0,max(0,info.duration_s-.01))
        length=min(_finite(preview_duration_s,'Preview duration',.01,12),info.duration_s-at)
    expected='.mp4' if preview and mode!='extract_wav' else output_extension(info,container,mode)
    if destination.suffix.lower()!=expected:raise ValueError('Output filename must end in '+expected)
    sources=[video]
    if str(audio_path).strip():sources.append(Path(str(audio_path).strip().strip('"')).expanduser().resolve())
    if destination.resolve(strict=False) in sources:raise ValueError('Output may not replace an input file.')
    if destination.exists():raise FileExistsError('Output already exists; choose another filename.')
    warnings=[]
    commands=['-v','error',*input_args(video)]
    audio_map=None
    if mode!='mute':
        sound,sound_info,chain=_audio_setup(video,info,audio_path,mode,offset)
        if fade_in:chain.append(f'afade=t=in:st=0:d={fade_in:.6f}')
        if fade_out:chain.append(f'afade=t=out:st={max(0,info.duration_s-fade_out):.6f}:d={fade_out:.6f}')
        if normalize!='off':
            norm=_normalizer(ffmpeg_exe,sound,sound_info.audio_index,chain,target,warnings)
            if norm:chain.append(norm)
        if gain:chain.append(f'volume={gain:.6f}dB')
        if limiter:chain.append('alimiter=limit=0.841395:level=0:latency=1')
        if sound!=video:
            commands.extend(input_args(sound));audio_map=f'1:{sound_info.audio_index}'
        else:audio_map=f'0:{sound_info.audio_index}'
        commands.extend(['-filter_complex',f'[{audio_map}]{",".join(chain)}[sound]'])
    if mode=='extract_wav':
        commands.extend(['-map','[sound]','-vn','-c:a','pcm_s24le','-ar','48000'])
    else:
        commands.extend(['-map',f'0:{info.video_index}'])
        if preview:
            commands.extend(['-vf','scale=w=min(960\\,iw):h=-2','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p'])
        else:commands.extend(['-c:v','copy'])
        if audio_map:commands.extend(['-map','[sound]','-c:a','aac','-b:a','256k','-ar','48000'])
        else:commands.append('-an')
    commands.extend(['-map_metadata','0','-map_chapters','0','-sn','-dn'])
    if preview:commands.extend(['-ss',f'{at:.6f}','-t',f'{length:.6f}'])
    if expected=='.mp4':commands.extend(['-movflags','+faststart+use_metadata_tags','-metadata','prophetero_processing=Audio Fix; source generation metadata retained'])
    destination.parent.mkdir(parents=True,exist_ok=True)
    temporary=destination.with_name('.'+destination.stem+'.'+os.urandom(8).hex()+'.partial'+expected)
    try:
        run_ffmpeg(ffmpeg_exe,[*commands,'-n',str(temporary)])
        result=probe_media(temporary)
        verified=False
        if not preview and mode!='extract_wav':
            if (result.width,result.height,result.video_codec)!=(info.width,info.height,info.video_codec):raise RuntimeError('Video format changed unexpectedly; output was not published.')
            if packet_hash(ffmpeg_exe,video,info.video_index)!=packet_hash(ffmpeg_exe,temporary,result.video_index):raise RuntimeError('Encoded video verification failed; output was not published.')
            verified=True
        if result.audio_index is not None:
            levels=audio_levels(ffmpeg_exe,temporary,result.audio_index)
            if levels.get('max_volume_db') is not None and levels['max_volume_db']>0:warnings.append('Decoded output peaks exceed 0 dBFS; reduce gain and review the sound.')
            if levels['silent']:warnings.append('Output audio is silent or below the measurable level.')
        else:levels=None
        _publish(temporary,destination)
        return {'path':str(destination),'picture_copy_verified':verified,'preview_reencoded':preview and mode!='extract_wav',
                'mode':mode,'video':asdict(result),'audio_levels':levels,'warnings':warnings}
    finally:temporary.unlink(missing_ok=True)
