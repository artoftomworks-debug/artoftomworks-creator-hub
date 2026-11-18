import sys,json,os
from pathlib import Path
os.environ['CUDA_VISIBLE_DEVICES']=''
try:
 import core,imageio_ffmpeg
 data=json.load(sys.stdin);source=core.media_path(data['source']);action=data['action']
 print(json.dumps({'phase':'Videó ellenőrzése'}),flush=True)
 if action=='probe':result=core.probe(source)
 elif action=='analyze':result=core.analyze(imageio_ffmpeg.get_ffmpeg_exe(),source,data.get('start_s',0),data.get('end_s',0))
 elif action in ('preview','render'):
  print(json.dumps({'phase':'Loop előnézet készítése' if action=='preview' else 'Loop videó mentése'}),flush=True)
  allowed=('start_s','end_s','method','blend_s','output_mode','repetitions','target_s','quality','audio_transition','audio_blend_s')
  result=core.render(imageio_ffmpeg.get_ffmpeg_exe(),str(source),Path(data['output']),preview=action=='preview',**{k:data[k] for k in allowed if k in data})
 else:raise ValueError('Ismeretlen Loop-művelet.')
 print(json.dumps({'ok':True,'result':result},ensure_ascii=True),flush=True)
except Exception as e:
 print(json.dumps({'ok':False,'error':str(e)},ensure_ascii=True),flush=True);sys.exit(1)
