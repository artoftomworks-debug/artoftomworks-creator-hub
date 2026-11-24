# ArtofTomworks Creator Hub 0.17.0 · Companion Workflows

Standalone ComfyUI workflows that ship with Creator Hub 0.17.0. They also run **without** the Hub: drag a `.json` file onto the ComfyUI canvas.
Creator Hub can launch the same files from **Create → Load workflow**.

## What's inside

| Folder | File | What it does |
|---|---|---|
| `workflows/ltx` | `ArtofTomworks_LTX25_DraftFinal_I2V_EN_v1.0.json` | LTX 2.5 image-to-video, **Draft → Final**. Make quick half-resolution drafts with several seeds, then render the seed you like at full resolution with the same composition and motion. |
| `workflows/ltx` | `ArtofTomworks_LTX25_DraftFinal_I2V_HU_v1.0.json` | Same workflow with Hungarian labels. |
| `workflows/ltx` | `ArtofTomworks_LTX25_Simple_I2V_EN_v1.1.json` | LTX 2.5 image-to-video, two-stage with latent upscaling, audio and live preview (v1.1: continuous decoding, no seams up to ~10 s). |
| `workflows/ltx` | `ArtofTomworks_LTX25_Simple_I2V_HU_v1.1.json` | Same workflow with Hungarian labels. |
| `workflows/upscale` | `ArtofTomworks_Krea2_Fast_2x_EN/HU.json` | Fast 2× image upscale (RealESRGAN x2plus) with light sharpening. |
| `workflows/upscale` | `ArtofTomworks_Krea2_Detail_4x_EN/HU.json` | Detailed 4× upscale (4x-UltraSharp) scaled back to a sensible size, with sharpening. |

## Draft → Final in 3 steps

1. Leave group **09 · FINAL** muted (default). Set RandomNoise to `increment` and run a few times to get drafts.
2. Pick the draft you like and note its seed (it is in the file name).
3. Set the seed, switch RandomNoise to `fixed`, right-click group 09 → **Set Group Nodes to Always**, and run once more.

## Requirements

**ComfyUI** with native LTX 2.5 support (a recent version).

**Custom nodes**
- rgthree-comfy (Power LoRA Loader) · https://github.com/rgthree/rgthree-comfy
- ComfyUI-KJNodes (live preview, Tiny VAE loader) · https://github.com/kijai/ComfyUI-KJNodes

The upscale workflows need no custom nodes.

**Models** – file names used in the workflows. If yours are named differently, choose them in the loader nodes.

| Loader | File in the workflow | Folder |
|---|---|---|
| UNETLoader | `ltx25FP8Comfyui_v10.safetensors` (LTX 2.5 FP8) | `models/diffusion_models` |
| CLIPLoader (type `ltxv`) | `gemma412bWithProjLtx25_v10.safetensors` (Gemma 3 12B for LTX 2.5) | `models/text_encoders` |
| VAELoader | `ltx-2.5-video-vae-bf16.safetensors`, `ltx-2.5-audio-vae-bf16.safetensors` | `models/vae` |
| LatentUpscaleModelLoader | `ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors` | `models/latent_upscale_models` |
| VAELoaderKJ (live preview only) | `taeltx2_3.safetensors` (TAE for LTX) | as described by KJNodes |
| UpscaleModelLoader | `RealESRGAN_x2plus.pth`, `4x-UltraSharp.pth` | `models/upscale_models` |

Official LTX 2.5 files: https://huggingface.co/Lightricks/LTX-2.5

## Notes

- The start image is set to ComfyUI's built-in `example.png`. Replace it with your own image.
- LoRAs start **off**.
- The ArtofTomworks branding appears only on the canvas, never in the video.
- These public builds have fixed labels (EN or HU). The language switch and the live CPU/GPU monitor from the author's own setup are not included; generation is identical.

## License

ArtofTomworks Creator Hub Free Use License 1.0 – see `LICENSE.txt`. Free for personal and commercial creative work; you may share the workflows (also modified) free of charge, but not sell them. Models and custom nodes keep their own licenses.
