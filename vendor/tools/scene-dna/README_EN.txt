# ArtofTomworks Scene DNA 0.7.0 — Public Beta

**Plan the scene. Follow every shot.**

A local storyboard and prompt-planning companion for creators who want a sequence to feel like one scene. Build a shared scene recipe, keep continuity fields locked, develop 3–6 shots and copy separate image/video prompts. Optional local AI can suggest editable motion ideas from an image. The optional H3 shot runner turns an installed, supported ComfyUI workflow into a sequential shot queue with a visible live monitor.

Cover: promotional concept artwork; see the publishing package.

The cover is promotional artwork, not a screenshot or a promise of generated visual consistency.

## Choose your download

- [Standard ZIP](https://github.com/artoftomworks-debug/artoftomworks-scene-dna/raw/refs/heads/main/downloads/ArtofTomworks_SceneDNA_0.7.0_Standard.zip): the complete runnable application, text-only examples and all reference guides.
- [Beginners ZIP](https://github.com/artoftomworks-debug/artoftomworks-scene-dna/raw/refs/heads/main/downloads/ArtofTomworks_SceneDNA_0.7.0_Beginners.zip): the same application, plus a prominent START_HERE guide and a step-by-step first-project walkthrough.

Both packages have the same features. Extract the entire ZIP into a writable folder before running it. Neither is a patch, model download or personal archive.

## What it does

- **Shared scene DNA:** location, subjects, appearance, time of day, lighting, palette, visual style and recurring objects. Locked fields flow into every shot; unlock only the details you want to vary.
- **Editable shot planning:** 3–6 shot templates with action, framing, angle, camera movement and intended duration. Reorder, duplicate or remove cards, save notes, export a prompt sheet or print a storyboard/PDF.
- **Reference and result images:** drop an image into the project or an individual shot, enlarge it, and keep it with the saved project. Imported originals stay unchanged; working previews are downscaled to at most 1280 pixels.
- **Composition planning:** a large editor with draggable aspect-locked crops, corner handles, wheel zoom, a point of interest and optional start/end framing. The preview is a 2D planning aid; its prompt wording does not physically control a camera or guarantee a matching crop.
- **Expandable recipes:** lighting, palette, style and sound suggestions, your own presets, explicit append/replace, and separate recipe-library import/export. Sound directions enter video prompts only and do not synthesize audio themselves.
- **Optional local AI:** choose an installed Ollama vision model for image-aware scene ideas, review three editable alternatives, apply one deliberately, and save useful ideas. Text translation has a language selector beside each prompt. Image attachment alone starts no AI request.
- **Director’s desk:** see the ordered shot sequence and rule-based continuity/planning notices before spending time on generation. This checks planning text/settings, not the contents or quality of finished video.
- **Optional H3 shot runner:** import a supported workflow source, prepare one/several/all shots, export each workflow JSON or a ZIP, or explicitly queue the shots one at a time. Source model, LoRA, sampler and seed settings are retained in the execution copies.
- **Visible execution:** the live monitor shows which shot is running, the actual start image, dimensions, frame-derived duration, active node, real node steps and elapsed time. It relays existing ComfyUI/KJ still or animated previews, has a large view and floating return button, and shows the completed video, saved location and download link.
- **Recovery and control:** pause after the current shot, request scoped stop where supported, resume missing shots, retry failed ones explicitly, and reuse unchanged completed shots when adding another. Nothing generates automatically on project load or preparation.

## Requirements and startup

**Offline planning:** a current desktop browser. Run START_OFFLINE.cmd; no Node.js, Ollama or ComfyUI is required for this mode.

**Local page, translation and/or shot execution:** separately install [Node.js 22 or newer](https://nodejs.org/), then run START.cmd. Keep the local server console open. The page uses a loopback address, normally http://127.0.0.1:18879. No cloud account is required. The launcher does not download a runtime.

**Optional AI:** separately install [Ollama](https://ollama.com/) and at least one local model. Image-based suggestions require a vision-capable model, not just a text model. An empty model list usually means Ollama is not running or no suitable model is installed. Models are never bundled/downloaded by Scene DNA. Their output quality and refusal behavior vary.

**Optional H3 generation:** your running [ComfyUI](https://github.com/Comfy-Org/ComfyUI), or its actual SwarmUI backend, plus a supported H3 Simple/Pro source workflow and all models/custom nodes that workflow needs. LTX and arbitrary execution graphs are not supported by this runner. General planning/copying remains useful with other generators.

Use INSTALL_COMFY_BRIDGE.cmd once if you want the workflow-source capture button and scoped cancellation. Select the actual ComfyUI backend folder containing main.py, not your saved-workflow folder. Restart that backend after installation and refresh its page. The bridge does not install models or Python dependencies. On older backends, safe targeted cancellation may be unavailable; no global interrupt fallback is issued.

Windows/Brave is the tested path. Eight interface languages are available: EN, HU, DE, FR, ES, IT, PT and PL. A few new diagnostic/live-monitor labels currently fall back to English outside HU/EN. Linux, macOS, iOS and Android are not certified by this beta; Windows launchers are included.

## First generation

1. Save your existing project before updating. Start the local page with START.cmd; do not run it inside the ZIP.
2. Load one of the text-only examples or describe your scene; attach a suitable reference image and suggest a shot plan. Review each shot’s video prompt. Applying a scene idea does not start generation.
3. Open your installed, working H3 Simple/Pro workflow in ComfyUI. Capture its source using the optional Scene DNA button/menu, or use a compatible ComfyUI API JSON. Source capture is a snapshot, not a live mirror of later ComfyUI edits.
4. In Scene DNA, open **Run shots**, load the source JSON and set the correct local backend URL. SwarmUI commonly uses http://127.0.0.1:7801/ComfyBackendDirect; use the backend that actually contains your models and receives the uploaded images.
5. Select one shot for the first trial. Set dimensions and short/full duration. Automatic orientation follows the actual selected start image while retaining manual control. Before starting, verify the prepared dimensions, frame count and actual seconds.
6. Click **Check and prepare selected shots**. This uploads prepared images locally and builds workflows; it does not generate. You can save a separate workflow JSON here instead of using the queue.
7. Click **Start selected shots** and confirm. Watch **Live run** in Scene DNA. The existing ComfyUI canvas is not automatically replaced; the monitor has a read-only overview of the exact submitted graph. Preview availability depends on the source workflow and backend.
8. Results are saved automatically under the backend’s configured output folder: ArtofTomworks/SceneDNA/<run-id>/Shot_XX.... A finished video can be played/downloaded in the monitor. Download makes an additional copy; it is not required for the original save. **When you add shots and re-prepare, unchanged completed shots are reused from their original output folders. Their videos are not copied into the new run folder.** A five-shot project can therefore have only four files in the newest folder while all five are complete. Reused results and multiple locations are flagged in the UI; every result card has its actual saved path and download. There is no need to regenerate the reused shot.

Read RENDER_GUIDE_HU_EN.md for detailed operation. A 5-second request may become 5.167 seconds because H3 uses aligned frame counts. Planning-card durations can be 1–30 seconds; this H3 runner accepts 1–15 requested seconds per shot. The actual prepared frame count is authoritative. There is no automatic joining, transition editing or lip-sync in this release.

## Keep your work and avoid resource conflicts

Save a **Scene DNA Project JSON** for backup; load it in Scene DNA, not ComfyUI. An exported **workflow JSON** is for ComfyUI. The workflow refers to images uploaded to that backend and is not a self-contained, cross-machine media package.

Browser storage/IndexedDB is a convenience, not a permanent backup. Changing browser/profile/address or clearing storage can make old projects unavailable. Save the project before switching. Exported projects may include your images, prompts and labels; review them before sharing. This download contains none of the author’s projects, media, run ledgers or credentials.

Finish heavy image/video generation before asking a local vision/language model to analyze images, particularly on a memory-limited GPU. CPU mode is the default for optional local AI. Preflight checks and resolution limits are not guarantees against RAM/VRAM exhaustion. Live previews relay already-generated backend previews without an extra model pass; loading/decoding may produce no preview. If the monitor disconnects, the backend may still be working: check status before resubmitting.

On updating an already-running copy, save your project, finish active work, close Scene DNA’s own server console, restart with START.cmd, then Ctrl+F5. A browser refresh alone does not reload server code. Only installing/updating the optional ComfyUI bridge requires a ComfyUI/SwarmUI restart.

## Credits and usage terms

Scene DNA planning UI, prompt assembly, optional bridge and queue monitor: **ArtofTomworks**. This is a separate companion, not Prompt Studio or Prophetero Scene Planner. Generation remains the work of the installed models and ComfyUI. Node.js, Ollama, ComfyUI, model authors and third-party workflow/node authors retain their own credits and terms; see THIRD_PARTY.md. No generation models or third-party node code are redistributed.

The included **ArtofTomworks Scene DNA Free Use License 1.0** permits free personal/commercial creative use and free sharing/modification with the license retained. It prohibits resale or paid bundling of the software and modified versions. Your media and the models you use have their own applicable rights. This is not an MIT-licensed release; see LICENSE.txt for the complete terms.

Public beta: tested automated logic/HTTP/browser paths and user-tested H3 operation, not a guarantee of output quality or compatibility with every workflow, model and machine. Report the version, backend/frontend versions, source workflow type, expected behavior and exact error, omitting private material.
