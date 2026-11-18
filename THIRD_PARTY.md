# Third-party components and credits

Creator Hub is by ArtofTomworks. Its license applies only to material the
author has the right to license; imported components keep their own terms.

- **ComfyUI**, its contributors, model authors and node authors: external
  runtime, models and plugins. They are not relicensed by this package.
- **Node.js 24.19.0 Windows x64**, Windows download only: official runtime.
  Full upstream license and included third-party notices are in
  `runtime/LICENSE_Node.txt`. Official release checksums are supplied there.
- **MediaPipe**, Google and contributors: pose JavaScript/WASM and the
  included pose landmarker task. See
  `vendor/tools/prompt-studio/pose-assets/LICENSE-MediaPipe.txt` and the
  notices shipped beside these files. Apache License 2.0.
- **ArtofTomworks Prompt Studio and Scene DNA**: included workshop tools.
  Scene DNA's original `vendor/tools/scene-dna/LICENSE.txt` is retained.
  Pose source provenance is in `vendor/pose/SOURCE.txt`.
- **Prophetero Loop Lab**, **Prophetero Audio Fix**, **Prophetero Final Check**
  and related workshop code: original authorship and Free Use licenses
  remain in `vendor/loop/LICENSE.txt`, `vendor/finish/AUDIO_LICENSE.txt`,
  `vendor/finish/finalcheck/LICENSE.txt` and accompanying README/source notes.
  Hub adapters do not replace those original notices.
- **FFmpeg, PyAV, imageio-ffmpeg, Ollama, RIFE and Real-ESRGAN**: optional
  external components, used from the user's installation where supported.
  They and their weights keep their own licenses and are not included as
  generative models in the Hub distribution.
- Optional AI models, including the DeepSeek-named Qwen3.5 derivative, are
  separately downloaded from their named sources. Check the exact model's
  license, provenance and hardware needs. The name does not make it an
  official DeepSeek V4 release.

No affiliation with or endorsement by ComfyUI, Civitai, Hugging Face,
DeepSeek, Qwen, Google, Node.js or the other named projects is implied.

Packaging changes: installation-specific documentation paths were replaced
with neutral placeholders. An obsolete Scene DNA packaging script and
private development caches are omitted. Runtime code retains its credits.
