# Scene DNA development

An independent offline application. No integration changes to Prompt Studio, ComfyUI or Prophetero.

- Build the self-contained HTML: `node build.mjs`.
- Pure logic checks: `node --test tests/engine.test.mjs`.
- Browser checks: run `tests/browser_test.py` with the existing local Python/aiohttp/browser development environment. This fixture uses a specific local café image read only and never distributes it. The test browser has HTTP(S) blocked; CDP uses loopback only.
- Prepare the expanded runnable package: `node package.mjs`. Packaging is local and does not publish anything. Public ZIP, if required, contains only files listed in MANIFEST.json under the package directory. QA, development tests, browser profiles and user media must stay outside it.

The packaged application itself requires only a modern browser. UI data is rendered through textContent/value, with validated embedded JPEG/PNG/WebP data images only. Import limit 96 MiB (including optional original generation images); image inputs 20 MiB and 60MP; saved working thumbnails 1280px/1.5M data characters each. The CSP permits same-origin connections for the optional loopback translation bridge and blocks external scripts/styles. Project files can contain user text and thumbnails and should be reviewed before sharing.

The rule engine currently uses structured inheritance, explicit override comparison and a limited English/Hungarian day/night keyword check. It is not an image-understanding or translation model. Version 0.2 adds optional local text translation and wording profiles, not automatic generator-parameter transfer. The optional Node bridge exposes only health, model-list and translation routes on loopback and filters remote/cloud model records. The offline planner remains server-free.

## Composition planner 0.3
The pure composition-model.mjs geometry is shared by prompts, validation and the editor. Composition version 1 is optional within existing project schema version 1. Plans are bound to image data via a non-security fingerprint plus aspect; stale plans do not enter prompts. Parent checks current project ID, shot ID, image fingerprint and aspect before explicit Apply. A same-origin about:blank window owns only DOM/canvas; callbacks remain in the parent, with no external scripts or user HTML. Closing the main page closes its editor windows.

Checks: node --test tests/*.test.mjs; tests/composition_browser_test.py uses the local deterministic bridge fixture and genuine Chromium pointer/wheel events, plus popup/save/cancel/stale/restore/narrow-layout checks. tests/extensions_browser_test.py covers local translation behavior. These do not certify actual model translation quality or generated composition adherence.

## Scene suggestions 0.4
scene-model.mjs contains validated optional per-shot settings/drafts. basePrompts remains the automatic source; prompts uses an applied sceneDraft only while the base video, image key and normalized settings match. Context edits suspend the override without deleting its editable text. scene-ui.mjs commits only on Apply and rejects late replies after context or draft changes. Prompt-language SOURCE is selected on Apply for direct copying.

The server uses scene-server.mjs for capability discovery, optional local image-aware chat and resource preflight. All hosts remain loopback-only and POSTs same-origin. Metadata discovery does not infer. Only the selected image bytes and bounded request context enter /api/chat; filenames, other shot images and notes are excluded. One active AI request is shared with translation. nvidia-smi is read-only, hidden and time bounded; absent metrics remain unknown. CPU is the frontend default. The optional tests/live_scene_smoke.mjs is explicitly opt-in and never included in normal tests.

Startup retries up to ten loopback ports and reuses only the same version+hashed instance path; it never kills an existing process. Health only discloses the path hash, not the local path.

UI convention: follow familiar layouts consistently. Prompt title and language settings above the text; one labelled Copy action immediately below each prompt. Avoid duplicate primary controls or surprising action placement.

## Scene variants 0.5
variants-model.mjs validates bounded optional per-shot alternatives and the separate text-only saved-ideas schema. variants-ui.mjs archives unlisted current drafts before changing choices, appends complete batches, and merges favorites only after validation/storage succeeds. sceneApplied is the independent canonical override snapshot; sceneDraft remains the editor state. Stable sceneActiveVariant/sceneAppliedVariant references are checked on project import. Removing an active card drops links, not the current applied text.

/api/scene accepts optional variants:3, retaining the single-reply contract for older callers/tests. A batch performs exactly one /api/chat call, with one image and a three-item JSON schema. Incomplete/repeated responses fail atomically. Longer response budget remains bounded. New UI tests cover selecting/editing/applying independently, append-only batches, manual/removal cases, favorite portability and stale-context review, project persistence and locale/layout behavior. Live testing was deferred on the observed busy machine.

## Director’s desk 0.6

Pure director-model.mjs derives cumulative planned timing, effective adjacent recipe differences, canonical applied-source state and bounded EN/HU positive wording excerpts. Negation lists are suppressed; no semantic/visual-quality guarantee. Composition movement overrides the generic camera enum when authoritative. Applied duration checks use explicit total-duration wording only.

Optional reviewedDirectorFindings is a bounded validated array of 120 unique 8-hex non-security context fingerprints. Context includes effective recipe/camera/geometry/duration/actual video text, so changes reopen review. Marks never change prompts; oldest mark is evicted at capacity. All DOM uses textContent/value. Reports include user titles/excerpts, without adding image data or paths. Refresh compares a serialized derived view before touching the DOM. Tests cover false-positive negation cases, effective inheritance, stale applied/editor independence, persistence, invalid mark imports, all locales, exports, focus navigation and narrow layouts.

The three-variant live smoke test completed on the idle GPU on 2026-11-06: one local request, 15 seconds. The model introduced lighting flicker; use this as an example of why editorial review remains necessary. The generation endpoint implementation was unchanged in 0.6. No inference is used for Director’s desk.


## Local shot execution 0.7

render-workflow.mjs validates one H3/CreateVideo/SaveVideo API branch, freezes source settings and produces per-shot copies. Old end frames and disconnected duration controls are pruned, and 24-fps aligned lengths and dimensions become authoritative literals. Only exact captured widget maps are used to update an editable UI copy. Linked scalars receive new native literal controls; dynamic custom LoRA rows stay untouched. Unrecognized UI layouts fall back to API JSON and the host API importer.

render-server.mjs persists the execution ledger atomically before submission. One local run is active at a time and one shot is submitted at a time, after the backend queue becomes idle. Recovery never auto-starts a next job. Missing history produces an unknown state; explicit retry is required. Completed, fingerprint-identical shots survive a new preparation with an expanded selection. Starting requires the exact prepared context digest. Browser changes cannot silently start an obsolete plan.

The optional ComfyUI bridge captures app.graphToPrompt().output plus its UI snapshot and actual widget-name map via a clearly labeled node button/context item. Its cancellation endpoint checks both prompt ID and the run marker; only native atomic interrupt_if_running is used. There is no global interrupt fallback. Bridge installation is separate from app startup and requires restarting the actual backend.

The browser keeps generator settings/source/run ID in the existing project schema through an optional validated generation field. Working thumbnails are never mislabeled as original files; an optional original input per shot is separately bounded. Run ledgers are local to the server copy, while projects contain local references and images; workflow-only ZIPs are intentionally not portable media bundles. Render media access is confined to returned history output descriptors, including byte-range forwarding.

Checks: tests/render.test.mjs, tests/test_comfy_bridge.py and tests/render_browser_test.py. The browser test uses a simulated ComfyUI upstream, a tiny generated fixture clip, and no user GPU generation. Existing planner tests remain applicable. Read-only inspection confirmed the current local ComfyUI 0.45.0 H3/CreateVideo/SaveVideo schemas; no real /prompt request was submitted.
