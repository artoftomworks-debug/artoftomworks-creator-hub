# ArtofTomworks Creator Hub Global

A local Windows workspace for generating, comparing, and refining AI images and videos with ComfyUI. Create with a single model or run the same prompt and seed across several models to see how they interpret it.

[Download the Windows release](https://github.com/artoftomworks-debug/artoftomworks-creator-hub/releases/download/v0.17.1/ArtofTomworks_CreatorHub_0.17.1_Singularity_Windows_x64_StartupFix.zip) · [Watch the 30-second demo](https://github.com/artoftomworks-debug/artoftomworks-creator-hub/releases/download/v0.17.1/creator-hub-demo-en.mp4)

## Start here

**What you need:** Windows 10 or 11 (64-bit), a working ComfyUI installation, and at least one compatible local model. The Windows package includes Node.js. ComfyUI and model weights are separate.

1. On the Releases page, download the **Windows x64 StartupFix** ZIP from the Singularity 0.17.1 release assets and extract the whole archive into a writable folder.
2. Open the extracted folder and double-click **START_CREATOR_HUB.cmd**. If the Hub asks which ComfyUI installation to use, choose yours in the engine settings.
3. In the Hub, choose **Image** and select a ready model. Enter a prompt, choose a size, and start generation. Try one image to verify that your setup works.
4. To compare models, enter a seed in **Generation Settings**, then open **Group**. Enter one positive prompt and select the models you want to test. Leave **Same seeds for every model** checked, choose one format and one image per model, and start generation. Open **History → Grid** to review the results.

If you prefer English, choose it from the language selector in the Hub header.

## Try the demo prompt

**Seed:** `880250006`  
**Image size:** `1344 × 768`  
**Models shown:** FLUX.1 Dev, SICK OLLIE Krea2 FP8, and Realism by Stable Yogi Moss V2.0. You can follow the same steps with other compatible models already installed on your machine.

> A vast, quiet library built inside the hollow trunk of an ancient tree, seen at dusk. Spiral wooden staircases wind upward into soft darkness, lined with thousands of worn leather books. Warm lantern light glows from small reading alcoves carved into the living wood, each one slightly different: a sleeping cat on a velvet cushion, an open atlas with a brass magnifying glass, a cup of tea still steaming. Through a round window high above, a deep blue evening sky with the first stars and a thin crescent moon. Fine dust drifts in a single shaft of golden light. Moss and tiny ferns grow between the shelves, roots weave through the floor like old rivers. A lone figure in a long coat stands far below, small against the scale of it all, looking up. Rich detail, layered depth, atmospheric perspective, painterly realism, calm and timeless mood, soft volumetric light, intricate textures of wood, paper and leaves., highly detailed, sharp focus, professional photography, award-winning photo

Each model uses its own sampling settings. This is a comparison of how the models render the same brief, and your results will depend on your setup.

## Highlights

- A dedicated multi-model workspace with editable prompts, model cards, LoRAs by family, per-model checks and previews, and prompt transfer to single-model creation.
- Save custom sizes and recall them from Quick Size. Optional local AI recommends framing from the prompt. The Hub proposes a resolution and waits for you to apply it.
- Optional AI assistance for video motion, sampling steps, controlled trials, saved recipe comparison, storyboard continuity and reviewing video sample frames.
- Search public LoRA catalogs from the Hub and optionally ask local AI to review the results. Search uses the terms you approve. LTX 2.3 LoRAs may be shown as candidates for LTX 2.5, with compatibility to be verified per LoRA.
- A clearer generation error panel, copyable filtered diagnostics and an optional local AI explanation. Group checks and queue submission share plan rules.
- A compact History grid with side arrows. The model comparison grid keeps seed alignment. New-feature tags can be dismissed and restored from Settings.
- Replace a video segment using a separately generated clip in Video Studio. Six-frame AI review helps spot visible jumps between samples.

