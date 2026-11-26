# ArtofTomworks Creator Hub 0.17.1 — Singularity

Singularity brings single- and multi-model image and video creation into one local workspace. This Windows public beta uses your ComfyUI installation and your own models. The interface starts in English. Change it under Settings → Language.

## Highlights

- A dedicated multi-model workspace with editable prompts, model cards, LoRAs by family, per-model checks and previews, and prompt transfer to single-model creation.
- Save custom sizes and recall them from Quick Size. Optional local AI recommends framing from the prompt. The Hub proposes a resolution and waits for you to apply it.
- Optional AI assistance for video motion, sampling steps, controlled trials, saved recipe comparison, storyboard continuity and reviewing video sample frames.
- Search public LoRA catalogs from the Hub and optionally ask local AI to review the results. Search uses the terms you approve. LTX 2.3 LoRAs may be shown as candidates for LTX 2.5, with compatibility to be verified per LoRA.
- A clearer generation error panel, copyable filtered diagnostics and an optional local AI explanation. Group checks and queue submission share plan rules.
- A compact History grid with side arrows. The model comparison grid keeps seed alignment. New-feature tags can be dismissed and restored from Settings.
- Replace a video segment using a separately generated clip in Video Studio. Six-frame AI review helps spot visible jumps between samples.

## Start on Windows

Extract the entire Windows ZIP. Double-click **START_CREATOR_HUB.cmd** in the extracted application folder and point the Hub at your ComfyUI installation. The Windows ZIP includes Node.js. The GitHub source snapshot requires Node.js 22 or later on PATH. Models, LoRAs, ComfyUI and Ollama are separate. Text-based local advice requires an available Ollama model. Image-based review requires a vision-capable model. Prompt-based tags also work without Ollama.

A fresh install has no private drafts, history, profiles, saved credentials or queued jobs. To keep an existing installation, extract the release into a new folder first and make a backup before migrating data. Do not push the data folder that the Hub creates while running.

The companion archive contains example LTX and Krea workflows. Check their model and node requirements before running them.

See LICENSE.txt and THIRD_PARTY.md for terms. See VALIDATION_EN.txt for the checks performed and the remaining live tests.
