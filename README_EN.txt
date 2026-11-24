ARTOFTOMWORKS CREATOR HUB GLOBAL
0.17.0 — Public Beta — 24 November 2026

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
   The black window is visible only while the Hub starts. The server then
   runs in the background with a tray icon next to the clock (open,
   restart, stop, log). The ⏻ Hub button in the lower right offers the same.
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

SAMPLER, SCHEDULER AND UPDATING
See UPDATE_EN.txt for independent override switches, model settings and safe updating.

SOFTWARE UPDATE NOTIFICATIONS AND NODE PACKAGES
Updates in the header and function search (Ctrl+K) opens one panel.
Published Hub releases (including Public Beta) and stable ComfyUI releases
are checked every 12 hours and cached locally. These two cards notify and
link to release information; they do not install Hub or ComfyUI releases.
The installed engine version comes from the selected managed ComfyUI folder.
Unknown or external installations are marked unverified.

Node packages have a searchable, paginated list and optional update filter.
Select individual packages or all filtered packages, then Update selected.
Review the list and choose Back up and update once for the whole batch.
Only known GitHub repositories on a clean, unchanged local branch qualify.
Each package gets a verified Git backup before downloading and applying a
fast-forward update. Local edits and ignored user-file collisions are preserved.
Progress, skips and failures are shown per package, with a copyable log.
Stop after current package keeps the current operation intact.

Changes to dependency files, installation scripts or submodules are skipped
BEFORE changing package code. The Hub does not run pip or installation scripts
and does not change the Python environment. Such packages need a separate
installation review; a skipped package is not reported as updated.

The last ten batch results are available in the result selector. Restore
requires the exact installed commit, matching source/branch and clean files.
Backups and logs are under data/node-update-backups and node-update-jobs.json.
Backups contain tracked Git code/history, not generated media or Python
environments. They are not deleted automatically when results leave the list.
Restart engine is an explicit action after a successful update or restore,
only for an idle engine managed by this Hub. External engines require their
own launcher. Generation admission is blocked while packages are changing.

Checks query up to 20 GitHub sources per batch with a three-minute cooldown.
Deferred packages are prioritized next time; previous verified findings stay
visible with their original check date until refreshed. Before applying any
update, the local source, branch and commit are checked again.
Copied packages, unknown sources, offline results and divergent histories
are shown explicitly rather than guessed. Current is not a compatibility
guarantee for every workflow.

A project-version-only change in pyproject.toml is allowed; actual dependency
and build-system changes remain gated. The completion summary counts updated,
skipped and failed packages. Local modification details list affected files.

SCENE CONTINUATION
Next scene segment beneath the video; take selection and shared editing timeline.
See SCENE_CONTINUATION_EN.txt.

CIVITAI MODEL SEARCH
Enable Include NSFW-classified models for those models in name searches.
An exact civitai.com/civitai.red model link or numeric model ID also works.
Source access requirements still apply. Rating is independent of model family.
A Civitai Checkpoint label can still require a local diffusion-model destination
for model-only MOSS weights.

REMEMBERING MODEL-SOURCE KEYS
In the model browser credential panel, enable Remember for this Windows
account, then Save / use key. Windows DPAPI protects it; the same Windows
account reloads it after restart. Only encrypted contents are stored in
data/model-credentials.dpapi.json. Another account/machine must enter its
own key. Other systems support session-only use. Forget key removes the
selected provider key without deleting models or download jobs. Resume /
retry the failed job separately after saving. Source access requirements
still apply; saving a key does not prove its validity or permissions.

MODEL THUMBNAILS
The Hub tries to save the selected version’s preview image with each download.
If no usable image is available, the model download still completes.
Add your own image later: model card menu → Add / replace thumbnail, or Details.
PNG, JPEG and WebP up to 24 MiB are accepted; the Hub saves a JPEG thumbnail
with a maximum side of 640 pixels next to the model. Your custom thumbnail
takes priority and is never replaced by automatic source previews.
The model weight file is not modified.

NEW IN 0.16 AND 0.17
- Several models at once: the same prompt with several image or video models
  (and formats) in one start, a series bar with pause/resume/cancel, a grid
  view (models × seeds) and an optional local-AI ranking at the end.
- Two-stage LTX 2.5 custom workflows (half-resolution base → 2× latent
  upscale → refine) are accepted. Save the exact workflow of any result from
  History, or load it back with one click.
- Scene tools: next-scene assistant, storyboard with a short film export
  (crossfades, music), character book, variation family tree.
- Ideas box (Alt+I): text and images, tags, turn an idea into an image or
  video prompt, or send it to the storyboard.
- Sound: a sound plan (ambience, music, one spoken line) for models that
  generate audio (LTX 2.5, MiniMax H3); a sound tool for finished videos
  (fades, volume, loudness levelling, background music with ducking).
- Start image guard: a chip next to Generate shows when a start image is
  still loaded; before starting it asks only if the prompt has changed a lot
  or the image is old. Also used by “Several models at once”.
- Camera: mirrored live view, 3-second countdown, three shots; use one as a
  start image, for video, in the character book or with a style.
- Themes and backgrounds (⚙ Settings), comfortable zoom (A− / A+).
- Privacy switch (header button or Ctrl+Alt+H): blurs every image and video
  and mutes playback until switched back.
- Self-healing on out-of-memory, automatic memory release on model change,
  windowless server with tray icon, and many smaller fixes.

PROFILES AND PARENTAL CONTROLS (OPTIONAL, OFF BY DEFAULT)
⚙ → Enable profiles. The first profile becomes the administrator and owns all
existing data. Each profile has its own password, history, drafts and ideas; additional
profiles also save into an output subfolder (Profil_<name>). A child profile can be limited to selected
models, with LoRAs and the AI assistant allowed separately and a multilingual
word filter on prompts. Known limits: all profiles share one generation queue,
so a child profile can stop it; files on disk stay in the shared output folder.
Parental controls protect the Hub interface; they are not a substitute for
Windows accounts or supervision.

COMPANION WORKFLOWS
The workflows folder contains standalone LTX 2.5 image-to-video workflows
(Draft → Final and Simple, English and Hungarian). They run in ComfyUI on their
own and can be loaded in the Hub via Load workflow. See workflows/README_EN.md.
