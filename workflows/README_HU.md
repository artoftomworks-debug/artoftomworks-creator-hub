# ArtofTomworks Creator Hub 0.17.0 · Kísérő workflow-k

A Creator Hub 0.17.0-hoz tartozó önálló ComfyUI workflow-k. A Hub **nélkül** is futnak: húzd a `.json` fájlt a ComfyUI vásznára.
A Creator Hub ugyanezeket az **Alkotás → Workflow betöltése** menüből indítja.

## Tartalom

| Mappa | Fájl | Mire jó |
|---|---|---|
| `workflows/ltx` | `ArtofTomworks_LTX25_DraftFinal_I2V_EN_v1.0.json` | LTX 2.5 képből videó, **Vázlat → Végleges**, angol feliratokkal. |
| `workflows/ltx` | `ArtofTomworks_LTX25_DraftFinal_I2V_HU_v1.0.json` | Ugyanez magyar feliratokkal. Előbb gyors, fél felbontású vázlatok több seeddel, majd a kiválasztott seed teljes felbontásban, ugyanazzal a kompozícióval és mozgással. |
| `workflows/ltx` | `ArtofTomworks_LTX25_Simple_I2V_EN_v1.1.json` | LTX 2.5 képből videó, kétlépcsős, látens felskálázással, hanggal és élő előnézettel (v1.1: egybefüggő dekódolás, kb. 10 mp-ig varrat nélkül). |
| `workflows/ltx` | `ArtofTomworks_LTX25_Simple_I2V_HU_v1.1.json` | Ugyanez magyar feliratokkal. |
| `workflows/upscale` | `ArtofTomworks_Krea2_Fast_2x_EN/HU.json` | Gyors 2× képfelskálázás (RealESRGAN x2plus), enyhe élesítéssel. |
| `workflows/upscale` | `ArtofTomworks_Krea2_Detail_4x_EN/HU.json` | Részletes 4× felskálázás (4x-UltraSharp), észszerű méretre visszaállítva, élesítéssel. |

## Vázlat → Végleges 3 lépésben

1. A **09 · VÉGLEGES** csoport maradjon némítva (alapállapot). A RandomNoise legyen `increment`, és futtasd néhányszor: így vázlatok készülnek.
2. Válaszd ki a tetsző vázlatot, és jegyezd fel a seedjét (benne van a fájlnévben).
3. Írd be a seedet, állítsd a RandomNoise-t `fixed`-re, a 09-es csoport címén jobb klikk → **Set Group Nodes to Always**, és futtasd még egyszer.

## Követelmények

**ComfyUI** natív LTX 2.5 támogatással (friss verzió).

**Kiegészítők (custom node-ok)**
- rgthree-comfy (Power LoRA Loader) · https://github.com/rgthree/rgthree-comfy
- ComfyUI-KJNodes (élő előnézet, Tiny VAE betöltő) · https://github.com/kijai/ComfyUI-KJNodes

A felskálázó workflow-khoz nem kell kiegészítő.

**Modellek** – a workflow-kban szereplő fájlnevek. Ha nálad máshogy hívják őket, válaszd ki a betöltő node-okban.

| Betöltő | Fájl a workflow-ban | Mappa |
|---|---|---|
| UNETLoader | `ltx25FP8Comfyui_v10.safetensors` (LTX 2.5 FP8) | `models/diffusion_models` |
| CLIPLoader (típus: `ltxv`) | `gemma412bWithProjLtx25_v10.safetensors` (Gemma 3 12B az LTX 2.5-höz) | `models/text_encoders` |
| VAELoader | `ltx-2.5-video-vae-bf16.safetensors`, `ltx-2.5-audio-vae-bf16.safetensors` | `models/vae` |
| LatentUpscaleModelLoader | `ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors` | `models/latent_upscale_models` |
| VAELoaderKJ (csak az élő előnézethez) | `taeltx2_3.safetensors` (TAE az LTX-hez) | a KJNodes leírása szerint |
| UpscaleModelLoader | `RealESRGAN_x2plus.pth`, `4x-UltraSharp.pth` | `models/upscale_models` |

Hivatalos LTX 2.5 fájlok: https://huggingface.co/Lightricks/LTX-2.5

## Tudnivalók

- A kezdőkép a ComfyUI beépített `example.png` képe. Cseréld a sajátodra.
- A LoRA-k alapból **ki** vannak kapcsolva.
- Az ArtofTomworks felirat csak a vásznon látszik, a videón nem.
- A nyilvános változatok feliratai rögzítettek (EN vagy HU). A szerző saját gépén használt nyelvváltó és élő CPU/GPU-monitor nincs benne; a generálás ugyanaz.

## Licenc

ArtofTomworks Creator Hub Free Use License 1.0 – lásd `LICENSE.txt`. Személyes és üzleti alkotómunkára ingyenesen használható; a workflow-k (módosítva is) ingyen továbbadhatók, de nem árusíthatók. A modellekre és kiegészítőkre a saját licencük vonatkozik.
