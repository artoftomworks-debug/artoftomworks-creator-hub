# Changelog

## 0.7.0 — 12 November 2026 — Public Beta

First public Scene DNA package, consolidating the local 0.1–0.7 development previews.

### New since the 0.6 planning preview
- Optional local H3 Simple/Pro shot runner: captured workflow source or API JSON, selected output branch, one/several/all-shot preparation, separate JSON/ZIP export and explicit sequential execution.
- Source model, LoRA, sampler and seed preservation; editable dimensions, optional original start image, short/full duration and displayed actual H3 frame-derived timing.
- Start-image orientation detection before preparation; importing a source no longer silently overwrites the selected dimensions. Manual override remains available.
- Explicit original-versus-translated prompt choice and visible preparation errors naming the affected shot.
- Live monitor in Scene DNA: actual running shot/start image, node/steps/elapsed time, same-client ComfyUI and KJ still/WebP/MP4 previews, large view, floating return and scoped run controls.
- Read-only exact submitted-node/connection overview and workflow export. The native ComfyUI canvas is not replaced automatically.
- Completed full video playback in the monitor, saved output location and download. Reused shots are explicitly labelled, including older run records; a summary flags results spanning multiple output folders. Results are already saved automatically by ComfyUI.
- Persisted run status, explicit failure retry and missing-shot resume; unchanged completed shots reused when expanding a selection. No automatic submission on page/project load.
- Clear bounded execution-error extraction, dropping large tensor dumps. Out-of-memory and lost-connection states remain visible instead of being treated as successful completion.
- Image-state startup race fixed: full browser image restoration precedes auto-inspection/autosave. Project-file backup remains recommended.
- Packaged startup/runtime discovery, optional bridge installer with backend-folder selection, complete English-first Standard and Beginners ZIPs, bilingual guides and explicit beta limits.

### Included planning features from 0.1–0.6
- Shared, lockable scene recipe; 3–6 editable shots, camera/framing/movement, per-shot changes, image and video prompts, sound direction, storyboard/PDF and prompt-sheet export.
- Large composition planner, draggable crops, wheel zoom, focus point and optional start/end framing.
- Expandable lighting/style/palette/sound recipes, custom libraries and per-prompt local translation.
- Optional image-aware local AI scene suggestions; three editable alternatives, deliberate application and saved ideas.
- Director’s desk with ordered shot review, rule-based planning checks, direct navigation and review marks.
- Project save/load with thumbnails, browser persistence, eight interface languages and dismissible NEW markers. Some newest monitor/diagnostic labels fall back to English outside HU/EN.

### Scope and validation
Windows/Brave tested. Automated suite: 72 passing tests; isolated browser checks cover preview playback, large/narrow layouts, progress, recovery and scoped controls. The author also completed a user-driven H3 shot and confirmed visible progress and automatic saving. These are not universal hardware/workflow/output-quality guarantees.

No models, personal media, credentials or run history are bundled. Optional Ollama/Node.js/ComfyUI and source-workflow dependencies are separate. Runner supports recognized H3 Simple/Pro branches only; no LTX runner, guide-frame inheritance, automatic joining, transition editing or lip-sync.
