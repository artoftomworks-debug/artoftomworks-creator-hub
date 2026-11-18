# Prompt palette update — 2026-11-04

## Magyar útmutató

Indítás: UPDATE.cmd ebben a kicsomagolt mappában. Az alapértelmezett cél <your Prompt Studio folder>. A frissítő először minden érintett fájlt ellenőriz, biztonsági mentést készít, és csak ismert korábbi változatot cserél. Az archívum, a médiafájlok és a böngészőben tárolt beállítások megmaradnak. Ez felületfrissítés: utána Ctrl+F5, szerver-újraindítás nem szükséges. Ne futtasd ZIP-en belül. Más telepítéshez a PowerShell-frissítő -Target kapcsolója használható; ismeretlen változatnál megáll.

### Hol találod?

- Kérdezd az MI-t → Feladat: Saját kérdés → Promptpaletta.
- Lepj meg egy prompttal → Promptpaletta.
- Az MI-panel helyi modellbeállításai alatt: Helyi modellkatalógus.
- Az újdonságok a megszokott, kikapcsolható NEW jelölést kapják.

A két paletta ugyanazt a választást használja: téma, minőségi előtag, fő stílus és kiegészítő stílus. Például Masterpiece + ultra high resolution + editorial quality + professional quality, vagy olajfestmény cyberpunk hatással. A választás ebben a böngészőben megmarad. A Saját kérdés a választásokat elküldéskor is figyelembe veszi; a beillesztőgombbal a kezelt iránymezőt frissítheted a kérdésben. Új stílus nem halmoz újabb irányblokkot. A meglepi promptoknál az új választás az új generáláskor érvényesül, nem írja át a már elkészült promptot. A művészeti fő stílus lecseréli a fotográfiai nyitást és médiumot.

A bevált kérések mentése már a palettaválasztást is tartalmazza. Betöltéskor megmarad az aktuális SFW szűrő: egy korábbi mentés nem kapcsolhatja ki. A forrásképet, forrásszöveget és MI-választ továbbra sem mentjük a kéréskönyvtárba. A korábbi mentések használhatók.

Az előtagok szöveges támpontok. Az „ultra high resolution” nem állít tényleges pixelméretet és nem garantál jobb képet; a felbontást a generálóeszközben állítsd be. Videópromptoknál is használhatók a stílusirányok.

### Felnőtt jelölések és SFW

Az SFW alapból be van kapcsolva, és elrejti a felnőtt választékot. Kikapcsolva megjelennek a nem szexuális művészi akt és a ruhás boudoir témák, valamint az Adult / 18+ / Explicit / XXX rendszerezési címkék. A címkék önmagukban nem kerülnek generálási utasításként a promptba, és nem adnak hozzá explicit sablont. Az eredmény és az esetleges elutasítás a választott modelltől is függ; a kategória nem old fel modellkorlátozást.

Az SFW kapcsoló menüszűrő, nem szülői zár: nincs PIN, nem vizsgálja a beírt szöveget, csatolt képet vagy a modell válaszát. Véletlen, általános meglepi választásból a felnőtt témák kikapcsolt SFW mellett is kimaradnak; ezeket külön kell kiválasztani.

### Modellkatalógus

Hivatalos képességek alapján összeállított kiinduló lista; nem a felnőtt tartalmakkal kapcsolatos engedékenység szerinti rangsor. A promptminőséget és tartalomelfogadást ebben a frissítésben nem teszteltük élő modelleken.

| Modell | Hivatalos képesség | Közelítő letöltés | Licenc / forrás |
| --- | --- | --- | --- |
| qwen3:4b | Szöveg | 2.5 GB | [Apache 2.0, hivatalos oldal](https://ollama.com/library/qwen3:4b) |
| gemma3:4b | Szöveg és képértés | 3.4 GB | [Gemma feltételek, hivatalos oldal](https://ollama.com/library/gemma3:4b) |
| qwen3-vl:4b | Szöveg és képértés | 3.3 GB | [Apache 2.0, hivatalos oldal](https://ollama.com/library/qwen3-vl:4b) |

Ellenőrzés dátuma: 2026-11-04. A letöltés mérete nem a futtatáshoz szükséges RAM/VRAM; a kép, a szöveghossz és a többi futó alkalmazás is számít. A forrásoldalak és feltételek változhatnak. Gemma3:4b legalább Ollama 0.6-ot, Qwen3-VL legalább 0.12.7-et igényel a jelenlegi hivatalos jelzés szerint. Használj megfelelően friss Ollamát.

1. Az Ollama külön telepítendő, és futnia kell.
2. A katalógusgomb csak a pontos ollama pull parancsot másolja. Futtasd PowerShellben, várd meg a letöltést.
3. Kattints a Telepített modellek újraellenőrzése gombra, majd válassz modellt a meglévő listában. A katalógus nem választ helyetted.
4. Képelemzéshez képértő modell szükséges; a qwen3:4b csak szöveges feladatokhoz szerepel.
5. Aktív kép-/videógenerálás közben ne indíts helyi képelemzést, ha ugyanazt a GPU-t használják. A párhuzamos memóriaigény megakaszthatja a gépet. Előbb állítsd le/várd meg a generálást.

## English guide and changelog

Run UPDATE.cmd from the extracted folder. Default target: <your Prompt Studio folder>. The updater checks all payloads and existing versions before replacing anything, saves backups and rolls back an incomplete replacement. Archive, media and browser preferences are retained. Refresh with Ctrl+F5 afterwards; this UI update does not require a server restart. Never run from inside the ZIP. Unknown installed versions are refused rather than overwritten.

- Added a shared prompt palette to Ask AI → Your own question and Surprise me.
- Added selectable quality openings, themes, a primary style and an optional secondary style; choices persist locally in this browser and are shared between both panels.
- Artistic primary styles replace photographic opening/medium wording in new surprise prompts, including video prompts. Existing output is retained until you generate again.
- Saved requests now retain palette choices. Loading cannot disable an active SFW filter. Source text, image and answer are excluded from the saved-request library; older saved requests remain compatible.
- Added a default-on, reversible SFW menu filter. Adult / 18+ / Explicit / XXX are classification labels only and do not create explicit generation instructions. Adult theme templates cover non-sexual fine-art nude and clothed boudoir. General random themes exclude adult topics even with SFW off.
- The SFW toggle is not a parental lock and does not inspect input or model output. Category labels do not bypass model restrictions; results depend on the chosen model.
- Added an official local model catalogue with text/vision capability, approximate download size, licence/source links, copy-only download commands and an explicit inventory refresh. No automatic installation, inference or selection.
- Added all interface text in EN, HU, DE, FR, ES, IT, PT and PL and dismissible NEW entries.
- Preserved earlier text-only custom questions, remembered model choices, creative mix integrations and the enhanced single-file offline application.

Quality words do not change actual resolution or guarantee quality. Set pixel dimensions in your generation tool. The catalogue is capability-based, not a ranking for explicit-content permissiveness. Official pages, checked 2026-11-04: [Qwen3:4b](https://ollama.com/library/qwen3:4b), [Gemma3:4b](https://ollama.com/library/gemma3:4b), [Qwen3-VL:4b](https://ollama.com/library/qwen3-vl:4b). Approximate downloads: 2.5 / 3.4 / 3.3 GB respectively; these are not runtime memory requirements. Review each model's own licence and Ollama compatibility. Gemma3:4b requires Ollama 0.6 or later; Qwen3-VL requires 0.12.7 or later according to the linked pages.

Install and run Ollama separately. Copy a catalogue command, run it yourself, wait for completion, refresh the installed-model list and choose your model. Image tasks require a vision model. Avoid simultaneous local vision inference and image/video generation on the same GPU: competing memory use can freeze the system.

### Validation

Automated DOM integration checks cover shared choices, SFW, saved-request round trips, drafts, text-only requests, vision selection, copying, translations, dismissible NEW badges and the full offline script syntax. Updater checks include an isolated install/repeat run, refusal of unknown installed files and rollback after an intentionally locked later file. Actual model content acceptance was not benchmarked. The isolated browser preview was blocked by local connection permissions, so no visual browser verification is claimed.
