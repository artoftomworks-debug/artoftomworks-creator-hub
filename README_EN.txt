ARTOFTOMWORKS CREATOR HUB GLOBAL
0.14.0 — Public Beta — 18 November 2026

A local workspace for AI images, video and creative finishing, powered by
ComfyUI. Choose a model, add compatible LoRAs, write your prompt and create
without building a graph for every supported model family.

INTERFACE LANGUAGES
Hungarian, English, German, French, Spanish, Italian, Portuguese and Polish.
Use the globe selector in the header. Your choice is remembered. Changing
the interface language does not translate or alter your prompts, model
names, seeds, filenames or generation settings. Technical backend messages
can fall back to English; messages from third-party tools may remain in
their original language. The bundled Prompt Studio and Scene DNA have
their own language selectors with the same eight-language set.

WINDOWS QUICK START
1. Extract the entire Windows ZIP into a writable folder. Do not run inside
   the ZIP, and do not place it in Program Files.
2. Run START_CREATOR_HUB.cmd. The Windows package includes Node.js 24 x64.
   Keep the server window open while using the Hub.
3. In your browser, choose Image or Video and a ready local model. On the
   first generation the Hub checks and starts the existing ComfyUI engine.
   SwarmUI does not have to run.
4. If there are multiple ComfyUI installations, open Engine, choose the one
   you use and save. The correct ComfyUI Python environment is required.
5. Enter your prompt, select size and count, then Generate. Validation and
   preparation happen automatically. The status explains missing items.
6. Watch the current job and live preview. Click the live preview to pause
   or resume viewing. A preview is approximate; it is not the final video.
7. Select a finished thumbnail to inspect it. Click for the large viewer;
   use the wheel to zoom, arrows to browse and click outside to return.

REQUIREMENTS
- Windows 10/11 x64 for this packaged release and native Explorer actions.
- A working, separately installed ComfyUI with its own Python environment.
- Suitable image/video models, encoders, VAEs and required custom nodes.
- Hardware suitable for those models. There is no universal VRAM minimum;
  long or large video jobs require much more memory than small images.
- A current Chromium-based browser is recommended.
The source edition requires Node.js 22+; no npm installation is necessary.
This is not a bundled ComfyUI/model installer. Generative model weights,
Ollama and the optional DeepSeek model are not included. A MediaPipe pose
landmark model is included for the pose tool; see THIRD_PARTY.md.

WHAT IS INCLUDED
- Image and video workspace, positive/negative prompts, size presets,
  orientation swap, custom sizes, steps, CFG, sampler and scheduler.
- Random, fixed and stepped seeds with an adjustable stride. A fixed seed
  with Fixed mode intentionally repeats; use Stepped mode for variations.
- Sequential generation series, visible queue and job status, stop after
  current job and stop now. Closing a browser tab does not cancel a job.
- Local library discovery, folder management, thumbnail/list views, search,
  favorites, family compatibility and clearly visible active model/LoRAs.
  LoRAs can be disabled while remaining in the active strip for later use.
- Local/online model browsing and supported downloads. Login, gated files,
  license terms and unknown architectures can require manual action.
- History by date and media type, favorites, 1–5 ratings, categories, batch
  selection, trash/restore and confirmed permanent deletion.
- Image/video metadata inspection and explicit parameter reuse. Dropping a
  file does not silently replace your settings. Some files lack metadata.
- Creative recipes with optional prompt, seed and start-image reuse, undo,
  and clear missing-model/LoRA feedback. Recipes are saved with the project.
- Camera/subject-motion prompt controls, pose/studio tools, comparison and
  trial grids. These are creative aids, not guarantees of model output.
- Image editor, Loop Lab, video editing, CPU finishing, Audio Fix, Final
  Check, Take Compare and Scene DNA/Prompt Studio workshop entry points.
- Local AI assistant: prompt refinement, translation, scene ideas and image
  to prompt with a suitable vision model. Suggestions are applied only when
  you choose. Optional 9B DeepSeek-named Qwen3.5 derivative: separate download
  of roughly 7 GB, alongside existing local models. It is not official
  DeepSeek V4 and it does not train an agent. Model results can be wrong.
- Diagnostics, copyable errors, memory profiles and optional Ko-fi support.

AUTOMATIC MODEL SUPPORT — READ BEFORE DOWNLOADING
Automatic assembly is available for supported branches of SD 1.x, SD 2.x,
SDXL, FLUX.1, Krea 2, MOSS, H3 and LTX 2.5. It still requires the matching
files and ComfyUI nodes. H3 and LTX use the diffusion-model/UNET branch;
LTX automatic support currently targets LTX 2.5. Recognition of a model
family does not mean every architecture, quantization or loader works.
FLUX.2 and other recognized but unsupported branches need a suitable custom
workflow. Importing your own workflow remains available. Unknown LoRA
families require an explicit advanced choice; known incompatible LoRAs are
not offered as compatible. Updating ComfyUI is the user's decision.

WHERE YOUR WORK IS SAVED
Finished generation files normally go under the ComfyUI output directory:
  ArtofTomworks/CreatorHub/Images/YYYY-MM-DD/
  ArtofTomworks/CreatorHub/Videos/YYYY-MM-DD/
The configured common output folder can differ. The result's path/copy and
Open in folder actions identify the actual file. Project/index/queue data
live in this Hub's data folder; exporting a project is a separate action.
Back up data AND your ComfyUI output media. A project file is not a backup
of every generated file. Do not move media while a job is running.
Cancelled/incomplete items can be filtered separately. Permanent deletion
is irreversible and requires confirmation; trash can be restored.

WORKSHOP NOTES
The included tools retain their authorship and licenses. Some advanced
operations need optional nodes or external FFmpeg/Python dependencies.
CPU finishing is available where supported; RIFE/interpolation and AI
upscaling need the corresponding separately installed nodes and weights.
The video editor works on a copy. Export and download the edited result in
the editor; its export is not automatically added to Hub history yet.
Scene DNA can reuse already completed unchanged shots. Five planned shots
can therefore mean only four NEW files, with one previous result reused.
Check each shot's result/status and path rather than counting new files.

PERFORMANCE AND PRIVACY
The main Hub is local. Online model search/download/update checks contact
the selected providers; optional external services keep their own policies.
AI-assistant requests use local Ollama. Generation has priority over the
assistant's use of GPU memory. CPU/Auto/High memory choices do not make a
model fit hardware that is too small. Preview quality and throughput are
model/node dependent. Pause preview if you do not need it; this reduces
preview work and traffic, but does not unload the generation model.
Do not expose the local service to the public Internet. No account, token,
private project or generative model weights are supplied in this release.

UPDATING AN EXISTING HUB
Finish or stop active work first and back up your data. Never run two Hub
copies against the same data directory. Keep a copy of your previous
installation. Move your backed-up data folder into the new extracted Hub
only while both are stopped. Relaunch and refresh the browser. Existing
output files remain in ComfyUI. The launcher can replace an idle older Hub
at the same location; it will not silently replace a busy generation.

PUBLIC BETA LIMITS
This release is a broad local tool, not universal support for every model,
plugin or installation. The automated tests use controlled backends;
selected real local model/assistant/finishing paths were tested separately.
No identical performance across GPUs is promised. Report the Hub version,
model family, action and copied error, after removing private information.

LICENSE AND SUPPORT
Free personal/commercial creative use under LICENSE.txt. Software resale
is restricted; this is source-available software, not an OSI license.
Third-party components retain their own licenses. Generated media remain
subject to the model and source-media rights that apply to them.
Optional support: https://ko-fi.com/artoftomworks
GitHub: https://github.com/artoftomworks-debug/artoftomworks-creator-hub
