![ArtofTomworks Creator Hub Global](assets/cover.png)

# ArtofTomworks Creator Hub Global

**Your local image & video studio, powered by ComfyUI.** Public Beta **0.17.0**.

Pick a model, write a prompt, add LoRAs and press **Generate** — in a clear workspace with live preview, organized history and creative tools around it. ComfyUI does the generation in the background; its graph editor is one click away whenever you want it. SwarmUI is not required.

**EN · HU · DE · FR · ES · IT · PT · PL** — a remembered interface language that never changes your prompts, model names or settings.

## ⬇ Download

| | |
|---|---|
| **Windows x64 (recommended)** | [ArtofTomworks_CreatorHub_0.17.0_GLOBAL_Windows_x64.zip](downloads/ArtofTomworks_CreatorHub_0.17.0_GLOBAL_Windows_x64.zip) — includes portable Node.js 24 |
| **Companion workflows** | [ArtofTomworks_CreatorHub_0.17.0_Companion_Workflows.zip](downloads/ArtofTomworks_CreatorHub_0.17.0_Companion_Workflows.zip) — LTX 2.5 image-to-video and Krea2 upscalers, also inside the main ZIP |

1. Extract the **entire** ZIP into a writable folder (not Program Files).
2. Run `START_CREATOR_HUB.cmd`. The Hub opens in your browser and keeps running in the background with a tray icon.
3. Choose a model that already works in your ComfyUI, enter a prompt and generate one image first.

**Requires an existing, working ComfyUI** with its own Python environment, models, encoders/VAEs and the custom nodes they need. ComfyUI, model weights, Ollama and the optional 9B assistant model are **not** included. A MediaPipe pose landmark asset is included under its own license.

[English instructions](README_EN.txt) · [Magyar útmutató](README_HU.txt) · [Changes](CHANGELOG_EN.txt) · [Update](UPDATE_EN.txt) / [Frissítés](UPDATE_HU.txt) · [First start](START_HERE_EN.txt) · [Quick-start guide](GUIDE_EN.md) / [Magyar guide](GUIDE_HU.md)

## ✨ New in 0.17.0

- **⧉ Several models at once** for images and video — models × formats in one start, a series bar with pause/resume/cancel, a **▦ grid view** (models × seeds) and optional local-AI suggestions and ranking.
- **Two-stage LTX 2.5** custom workflows; **save or reload the exact workflow** of any result from History.
- **Scenes and stories** — next-scene assistant, storyboard → short film (crossfades, music), character book, variation family tree.
- **🔊 Sound** — a sound plan for audio-capable models (LTX 2.5, MiniMax H3) and a sound tool for finished videos (fades, −16 LUFS levelling, music with ducking).
- **💡 Ideas box** (Alt+I), **start image guard**, **📷 camera** capture, **🎨 themes** and backgrounds.
- **🙈 Privacy switch** (Ctrl+Alt+H), optional **👤 profiles** and **🛡 parental controls**.
- **Out-of-memory self-healing**, automatic memory release on model change, windowless server with tray icon.
- **Companion workflows**: LTX 2.5 *Draft → Final* and *Simple* (EN/HU), Krea2 fast 2× and detailed 4× upscalers.

Full list: [CHANGELOG_EN.txt](CHANGELOG_EN.txt).

## In the workspace

- Image and video generation with resolution presets, custom sizes and sampling controls.
- Random / fixed / stepped seeds, series, visible stop controls and time estimates.
- Local and online model browsing (Civitai, Hugging Face), favourites, thumbnails and compatibility-aware LoRA choices.
- Active model and LoRA strip with temporary disable/enable.
- Date-based history with favourites, ratings, categories, search, batch selection and trash.
- Large media viewer, metadata inspection, explicit parameter reuse and workflow reload.
- Creative recipes, camera-motion prompts, pose tools, comparison and grid view.
- Image editor, Loop Lab, video workshop and finishing, Prompt Studio and Scene DNA.
- Optional local AI assistant whose suggestions change nothing until you apply them.

Automatic model assembly supports documented branches of SD 1.x/2.x, SDXL, FLUX.1, Krea 2, MOSS, MiniMax H3 and LTX 2.5 with matching installed components. Recognition alone does not mean every architecture, quantization or custom-node combination is supported; a suitable custom workflow can be loaded for other cases.

## Source setup and checks

Node.js 22+ is required. No npm installation is needed.

```text
node server.mjs --open
node --test tests/*.test.mjs tests_dev/*.test.mjs
```

The unit/service tests use controlled backends and do not generate with a real AI model. The optional CPU Loop integration test is enabled by `HUB_TEST_PYTHON`. The legacy browser regression (`python tests/browser_global_test.py`) needs Python 3 + aiohttp, `HUB_TEST_NODE` and `HUB_TEST_BROWSER` (Chromium). See [VALIDATION_EN.txt](VALIDATION_EN.txt) for what was tested in this release.

User data, local model weights, credentials and developer caches are excluded. Back up the Hub `data` folder **and** your ComfyUI output before upgrades. Closing a browser tab does not cancel a running generation.

## License, credits and support

Free personal and commercial creative use under [LICENSE.txt](LICENSE.txt). Software resale is restricted; this is a source-available Free Use license. Third-party components and models keep their own terms: [credits](THIRD_PARTY.md).

[☕ Support development on Ko-fi](https://ko-fi.com/artoftomworks)

Please report the version, model family, action and copied error with private details removed. This is a public beta; no universal compatibility or GPU speed is promised.
