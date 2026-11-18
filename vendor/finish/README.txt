ArtofTomworks Creator Hub — video finishing adapter, 2026-11-18

audio_core.py is the existing Prophetero Audio Fix CPU core, copied without
changes from the installed package. Its full license is AUDIO_LICENSE.txt.
finalcheck/core.py and finalcheck/media.py are the existing Prophetero Final
Check 0.3.0 CPU modules, copied without changes. Their license is in
finalcheck/LICENSE.txt. The empty __init__.py selects only these CPU modules;
the full original ComfyUI extension is not bundled here.

worker.py is the ArtofTomworks adapter. It adds a local JSON worker protocol,
bounded preview extraction, ordered assembly, stream-copy publishing and
temporary report cleanup. It does not download dependencies or model files.
It uses the user's existing ComfyUI Python, PyAV, imageio-ffmpeg and FFmpeg.
Those third-party components retain their own licenses and are not bundled
in this folder. RIFE/RealESRGAN processing calls the separately installed
Prophetero Video Interpolator nodes and existing weights through ComfyUI.

The Prophetero components retain their authorship and free-use licenses.
ArtofTomworks branding of the interface does not replace those notices.
