# From First Prompt to Finished Scene: Meet Creator Hub Global

You have a model you like, a prompt in mind and a few LoRAs worth trying. What you need next is a clear place to work: choose your tools, see the generation happening and find the result when it is finished.

That is the idea behind **ArtofTomworks Creator Hub Global**: a local workspace for images, video and creative finishing, with ComfyUI doing the generation in the background. You can open the graph editor whenever you need it, while everyday work happens in the Hub.

This guide takes you through a first image, a useful series of variations and the next steps toward video. Version 0.14.0 is a public beta.

## Who is it for?

Creators who already have a working ComfyUI installation and want a more direct daily workflow. You do not need to build a new graph for each documented automatic model branch.

If you are new to generation, start with one supported model that already works on your computer. The Windows package includes Node.js, but it does **not** install ComfyUI, its Python environment, generative models or every custom node. This is the full public beta, not a separate all-in-one beginners installer.

## 1. Open your workspace

Extract the whole Windows ZIP into a writable folder and run **START_CREATOR_HUB.cmd**. Keep the server window open while working.

Use the globe selector for Hungarian, English, German, French, Spanish, Italian, Portuguese or Polish. Your choice is remembered; changing the interface does not rewrite your prompt or settings. Technical diagnostics can fall back to English, and workshop tools have their own language handling.

The Hub can start an existing ComfyUI installation when generation needs it. SwarmUI is not required. If several installations are found, open **Engine**, select the one you use and save. Use its own Python environment.

## 2. Make one image first

Choose **Image**, select a ready local model and start with an easy prompt:

> A small brass clock on a wooden desk beside a rain-streaked window, soft morning light, realistic materials, calm cinematic composition.

Use a size suitable for that model and your hardware, choose one result and click **Generate**. Preparation runs automatically. Missing components should be explained on the interface rather than leaving you guessing.

The active-model strip makes the current choice visible. Model-card recommendations can provide sampling values when available; review them and adjust them for your task. A model family being recognized does not guarantee every loader or quantized variant works.

Automatic assembly covers documented branches of SD 1.x/2.x, SDXL, FLUX.1, Krea 2, MOSS, H3 and LTX 2.5 with the matching installed components. H3/LTX use the diffusion-model branch; the automatic LTX branch targets 2.5. Other cases can use a suitable custom workflow.

## 3. Add a LoRA you can actually use

Open the **LoRAs** tab and choose one compatible with your model family. Favorites appear first. The active strip shows what is enabled; you can disable a LoRA without removing it, then bring it back later.

Known incompatible families are not presented as compatible. An unknown family needs an explicit advanced decision. Do not force an unknown LoRA into a valuable long run just because its filename looks familiar.

## 4. Turn a good idea into variations

Once the first result works, try three images with the same settings and **Stepped** seed mode, starting from your chosen seed with a stride of 1.

This gives the series different seeds while preserving a clear starting point. **Fixed** mode intentionally repeats the same seed. Different seeds are a tool for exploring alternatives, not a promise that every result will look dramatically different.

Save a **Creative recipe** when an arrangement works. You can decide whether to reuse its prompt, seed and start image. Applying a recipe is a deliberate action, and missing models or LoRAs should be reviewed before starting.

## 5. Review without losing your place

Watch job status and the live preview. Click the live preview to pause or resume viewing. **Pausing the preview does not pause generation.** It reduces preview work and traffic, but does not unload the generating model.

Click a finished image for the large viewer. Use the wheel to zoom and the arrows to browse; click outside to return. Metadata and parameter reuse help you return to a previous idea without silently replacing the current settings.

The History tab adds dates, favorites, 1–5 ratings, categories and batch selection. Use trash for recoverable cleanup. Permanent deletion requires confirmation and cannot be undone.

## 6. Find your files

The normal generation destinations are inside your ComfyUI output directory:

- `ArtofTomworks/CreatorHub/Images/YYYY-MM-DD/`
- `ArtofTomworks/CreatorHub/Videos/YYYY-MM-DD/`

An individually configured common output folder can differ. Check the selected result's actual path or Open in folder action.

Back up both the Hub's data folder and the media in ComfyUI output. A saved project is not automatically a complete backup of all generated files.

## 7. Move into video, then finish it

Switch to **Video**, choose a ready supported video model and check the start image, orientation, size, duration and seed mode. A short first test helps you judge the motion before committing to a long run.

The camera/subject-motion panel can add a clear movement request beneath your prompt. It is prompt guidance, not a guaranteed camera path or ControlNet constraint. Review the combined request and use Reset when you want a clean motion setup.

When the result works, use the actions beneath it to open the video workshop or Loop Lab. Some finishing tools need optional nodes or processing dependencies. The video editor works on a copy; export and download the edited result there. That export is not automatically added to Hub history yet.

**Important Scene DNA detail:** an unchanged completed shot can be reused. Five planned shots can therefore produce four new files while one previous result remains in use. Check each shot's status and actual path instead of counting only new files.

## An optional local creative assistant

The AI assistant can refine a prompt, translate it, suggest a scene or describe an image with a suitable vision model. Its suggestions stay separate until you apply them. Ollama and its models are optional and separate installations/downloads.

The optional roughly 7 GB 9B model with a DeepSeek name is a Qwen3.5 derivative, not official DeepSeek V4 and not agent training. It can be useful, but its answers still need review. Image/video generation has priority over the assistant's use of GPU memory.

## Keep the creative part moving

Start small, save arrangements that work and make the next step from the result already in front of you. Creator Hub aims to make that rhythm easier to follow while leaving the underlying ComfyUI tools accessible.

Closing the browser does not cancel a running generation. Use **Stop after current** or **Stop now** when you intend to stop the queue.

[Get Creator Hub Global and read the requirements](https://github.com/artoftomworks-debug/artoftomworks-creator-hub)

Free personal and commercial creative use under the included license; software resale is restricted. Models, source media and third-party tools retain their own terms. This is a public beta with documented compatibility limits.

If it helps your creative work, [optional support on Ko-fi](https://ko-fi.com/artoftomworks) helps fund the next improvements.
