# Authorship and runtime

This beta contains ArtofTomworks-authored HTML, CSS, JavaScript, text examples, documentation and an optional ComfyUI companion bridge. System fonts and browser APIs are supplied by the user's platform. Recipe/prompt templates are editable planning aids, not a proprietary generative model.

The offline planner needs a modern desktop browser. The optional local server, AI connection and shot runner require separately installed Node.js 22+. Ollama and its selected text/vision models are separate optional dependencies. Video generation requires the user's own ComfyUI backend, compatible source workflow and all its dependencies. The small included bridge adds workflow capture and scoped cancellation; it is not an upstream generation engine.

No Node.js binary, Ollama model, generation model, third-party custom-node implementation or example media is bundled. Examples contain text only. Development tools and browser profiles are not part of the runnable ZIPs. Imported media and generated outputs remain subject to their applicable rights.

Upstream projects retain authorship and their own terms:

- Node.js: https://nodejs.org/
- Ollama: https://ollama.com/
- ComfyUI / Comfy Org: https://github.com/Comfy-Org/ComfyUI
- rgthree-comfy, where used by the source workflow: https://github.com/rgthree/rgthree-comfy
- KJNodes / Preview Override, where used: https://github.com/kijai/ComfyUI-KJNodes
- Crystools, where used: https://github.com/crystian/ComfyUI-Crystools

DaSiWa, Eros and MiniMax H3 are independently authored generation technologies, not models created or redistributed by Scene DNA. Use the model author's own page and terms for the exact version in your source workflow. Scene DNA does not grant rights to a model or its outputs. Its software license covers only the included ArtofTomworks-authored material.
