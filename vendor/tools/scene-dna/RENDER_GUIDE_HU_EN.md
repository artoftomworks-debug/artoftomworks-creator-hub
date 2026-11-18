# Scene DNA 0.7 — Snittek futtatása / Shot runner

## Magyar — első használat

1. A Scene DNA régi példányában **Projekt mentése**, ha van megtartandó munkád. Az új példány más helyi címen indulhat; ilyenkor **Projekt betöltése** hozza át a munkát. A régi változat és képek megmaradnak.
2. A helyi indítót használd; a szerver ablakát tartsd nyitva. A teljesen offline HTML-ben a tervezés működik, a generáló kapcsolat nem.
3. Az egyszeri ComfyUI-hidat az `Install-ComfyBridge.ps1 -ComfyRoot "a tényleges ComfyUI-mappa"` paranccsal lehet telepíteni. SwarmUI esetén a Swarm által használt ComfyUI-t válaszd. Ez nem telepít modellt vagy új Python-csomagot. Ezután teljes ComfyUI/SwarmUI-újraindítás kell. A személyes csomagban külön, előre beállított telepítő is van.
4. Nyisd meg a bevált **H3 Simple/Pro** workflow-dat a ComfyUI-ban. A `MiniMaxH3ImageToVideo` node-on az új **Scene DNA · Save workflow source** gombbal mentsd a forrást. Ugyanez jobb kattintással a vásznon is elérhető. Ez a pillanatnyi modell-, seed-, sampler- és LoRA-beállításokat rögzíti; nem indít generálást és nem módosítja a grafikont. Saját ComfyUI API-formátumú JSON közvetlenül is betölthető.
5. A Scene DNA felső **Snittek futtatása · NEW** gombjára kattints. A **Workflow-forrás JSON betöltése** alatt válaszd az imént mentett fájlt.
6. Ellenőrizd a helyi háttér címét. SwarmUI-nál általában `http://127.0.0.1:7801/ComfyBackendDirect`; önálló ComfyUI-nál például `http://127.0.0.1:8188`. Mindig ugyanazt a hátteret használd a feltöltéshez, JSON betöltéséhez és futtatáshoz.
7. Jelöld ki az egyetlen kívánt snittet, többet vagy az összeset. Alapból **rövid próba** készül, kb. 2 másodperc, H3 esetén 56 képkocka / 24 fps = 2,333 másodperc. A **Teljes tervezett hossz** a kártyák időtartamát használja, snittenként 1–15 másodpercig. A tényleges H3-hossz a modell képkockarácsához igazodik; az előkészítésnél pontosan látszik.
8. A méretek kézzel is állíthatók: 32 többszörösei, oldalanként 256–2048, összesen legfeljebb kb. 2 megapixel. Például 1024×576 vagy 1088×608. Ezek védőkorlátok, nem futtathatósági ígéretek. A rövid próba az időt rövidíti, nem csökkenti automatikusan a felbontást vagy a modell memóriaigényét.
9. Minden snitt a hozzá tartozó képet, ennek hiányában a közös referenciát használja. Ez a meglévő **munkakép**, legfeljebb 1280 px; ha fontos az eredeti felbontás, az **Eredeti kezdőkép a generáláshoz** alatt külön PNG/JPEG/WebP tölthető be, legfeljebb 8 MiB / 60 MP. Az eredeti fájl változatlan marad. A kivágástervező és kameramozgás szöveges iránymutatás; nem garantált képkivágás vagy mechanikus kameravezérlés.
10. A **Generáláshoz használt prompt** alapból **Eredeti videóprompt (fordítás nélkül)**. Az aktuális szöveget használja az alkalmazott jelenetjavaslattal együtt; fordítani nem kötelező. Kész fordításhoz válaszd itt a **Megjelenített nyelv / kész fordítás** opciót. Hiányzó vagy elavult fordításnál megnevezi az érintett snittet. A kártyákon az **Ezt a videópromptot fogja használni** részben ellenőrizhető a pontos szöveg.
11. **Kijelöltek ellenőrzése és előkészítése**: a kijelölt képeket a helyi ComfyUI `input/SceneDNA` almappájába másolja, elkészíti a snittenkénti API-workflow-kat, és megmutatja a méretet, tényleges időt és forrásbeállításokat. Ekkor még nem generál.
12. Most dönthetsz: külön **E snitt JSON-jának mentése**, **Összes workflow JSON mentése (ZIP)**, vagy **Kijelölt snittek indítása**. A JSON-ok közvetlenül behúzhatók ugyanabba a ComfyUI-ba. Felismert, a kapcsolóval rögzített felületnél megőrzi a szerkeszthető elrendezést; más esetben API-importot készít, amelynek elrendezése eltérhet. A ZIP a JSON-okat tartalmazza, nem a feltöltött képeket vagy modelleket; másik gépre önmagában nem hordozható.

## Futtatás, leállítás, folytatás

- Egyszerre egy Scene DNA-snitt van sorban/futásban. Ha a ComfyUI más munkán dolgozik, a sor vár. A kiválasztott kimeneti ág fut, más mentő/generáló ágak kimaradnak.
- **Leállítás a jelenlegi snitt után**: az aktuális munka befejeződhet; a többi vár. **E futtatás megszakítása most**: a híd csak ennek a sornak a saját feladatazonosítóját állítja le. Nem ad globális megszakítást. Régi, célzott leállítást nem támogató háttérnél a hátralévő munka szünetel, az aktuális munkát a ComfyUI-ban lehet megállítani.
- **Hiányzó snittek folytatása**: a kész eredményeket kihagyja. A hibás/megszakított/bizonytalan feladatokhoz külön újrapróbálás kell. Hiba esetén az egész sor szünetel, nem halad tovább és nem próbálkozik végtelenül.
- Ha új snittet adsz a kijelöléshez: ismét **ellenőrzés és előkészítés**. A változatlan, már kész snittek megmaradnak; csak az új/módosított kap új generálást. A méret, forrásworkflow, prompt vagy kép változása új feladatot jelent. Az **Új előkészítés** új, külön futtatást készít, és megtartja a képeket/forrást.
- A futtatás előtt ellenőrzi, hogy ugyanaz a terv van-e még betöltve. A módosított tervhez új előkészítés kell; nem indítja el észrevétlenül a régi beállításokat.
- A szerver a futási állapotot a csomag `data/SceneDNARuns` könyvtárába menti. Böngészőbezárás után tovább futhat, amíg a helyi szerver és a ComfyUI fut. Szerver-újraindítás után nem indul automatikusan új snitt: az ismert feladatot egyezteti a ComfyUI sorával/előzményeivel, majd te kérhetsz folytatást. Ismeretlen státuszt nem küld be automatikusan újra.
- A kész videókat saját vezérlővel visszanézheted. A kimeneti könyvtár a kiválasztott ComfyUI output mappáján belül `ArtofTomworks/SceneDNA/<futtatás>/Shot_XX…`. A letöltött JSON ezt a helyet használja. Nincs automatikus összevágás vagy áttűnés ebben a változatban.

## Jelenlegi támogatás és korlátok

H3 `MiniMaxH3ImageToVideo` → `CreateVideo` → `SaveVideo`, egy kiválasztott kimeneti ággal. A modellek, LoRA-k, egyéb szükséges node-ok és bemeneti fájlok külön kellenek. A forrásban korábbi Scene Planner-köztesképek nem engedélyezettek: használj tiszta Simple/Pro grafikont. Más modellek/LTX nem futnak ebből az első generálási változatból. A prompttervező általános profiljai továbbra is használhatók más generátorhoz, kézi másolással.

Nem módosítja a kiinduló workflow-t, nem telepít/letölt modelleket, nem garantál képi folytonosságot vagy a gépen való futtathatóságot. A modell engedélyei és a forrásmédia felhasználási feltételei továbbra is érvényesek.

## English — first run

1. Save the project in your old Scene DNA window before switching versions. Import that project into the new window if its local address changes.
2. Start with the local launcher and keep its server window open. Offline HTML still supports planning, but cannot connect to the generator.
3. Install the optional `comfy-bridge` into the **actual** ComfyUI backend using `Install-ComfyBridge.ps1 -ComfyRoot "your ComfyUI folder"`, then restart that backend. No models or Python dependencies are installed. With SwarmUI, select the backend it actually uses.
4. Open your working H3 Simple/Pro graph. Click **Scene DNA · Save workflow source** on `MiniMaxH3ImageToVideo`, or use the canvas context menu. Capture stores the current API settings without modifying or executing the graph. A standard API-format JSON can also be loaded directly.
5. In Scene DNA choose **Run shots · NEW**, load the captured JSON, and check the local backend address. SwarmUI commonly uses `http://127.0.0.1:7801/ComfyBackendDirect`; standalone ComfyUI commonly uses port 8188.
6. Select one, several or all shots. Short-test mode requests about two seconds (H3: 56 frames at 24 fps = 2.333 s); full mode uses each shot's planned 1–15 seconds. Exact aligned duration is displayed. Resolution is independent: multiples of 32, 256–2048 per side, at most about 2 MP. Short tests do not shrink the model or guarantee sufficient VRAM.
7. Each shot uses its working image (up to 1280 px), falling back to the shared reference. Optionally attach a separate original start image per shot: PNG/JPEG/WebP, up to 8 MiB / 60 MP. Composition and camera plans remain prompt guidance, not guaranteed geometric controls.
8. **Prompt used for generation** defaults to **Original video prompt (no translation required)**. This uses the current source prompt, including any applied scene idea, without requiring translation. To use a translation, explicitly choose **Displayed language / finished translation**; missing or outdated translations identify the affected shot. Each shot card shows the exact text under **Video prompt that will be used**.
9. **Check and prepare** copies selected images into this backend's `input/SceneDNA` folder, creates execution copies and shows settings. It does not queue inference.
10. Save one JSON, all JSONs as a ZIP, or explicitly start the selected shots. Saved JSONs load directly into the same ComfyUI. Recognized captured UI graphs keep an editable layout; otherwise a correct API JSON is exported and its imported layout may differ. The ZIP contains workflows only, not uploaded images/models, so it is not a portable project by itself.

Jobs run sequentially and wait for existing backend work. Failure pauses the sequence. Stop-after-current keeps its completed result; immediate stop targets only this run's owned job through the bridge. Unsupported older backends pause the remaining work and ask you to stop the current job in ComfyUI. No global interrupt is sent.

Continue skips completed shots; failed/cancelled/unknown jobs need an explicit retry. Add a third shot, prepare again, then start: unchanged completed shots are reused. Changed prompts, images, dimensions or source settings create new work. The original graph remains untouched. The plan is checked again before starting, so an old prepared plan cannot silently run after edits.

Run state is saved locally under `data/SceneDNARuns`. Closing the browser does not stop an already-started sequence while the server and ComfyUI remain running. After restarting the server, queue/history are reconciled, but no next job starts until Continue. Uncertain submissions are never automatically repeated. Finished results use the selected backend's output directory under `ArtofTomworks/SceneDNA/<run>/Shot_XX…` and can be played individually.

First execution version: one standard H3 I2V/CreateVideo/SaveVideo output branch, without inherited Scene Planner guide frames. LTX/other generation families, automatic assembly and transitions are not implemented here. Their prompt-planning profiles still work. All models, LoRAs and third-party nodes remain separate, with their own licenses.
# Élő futásnézet / Live run monitor — 2026-11-12

**FONTOS — újrahasznált eredmények:** Ha újabb snittet adsz a kijelöléshez, az ellenőrzés/előkészítés a változatlan, korábban sikeresen elkészült snitteket újrahasználja. Nem indít rájuk új generálást és nem másolja át a videóikat az új futtatás mappájába. Ezért például egy öt snittből álló projekt új mappájában négy videó is lehet, miközben mind az öt kész: a korábbi snitt az eredeti mappájában maradt. A felület külön jelzi a több mentési mappát és az újrahasznált snittet. Minden eredménykártyán a tényleges útvonal és saját letöltési gomb látható. Nem szükséges emiatt újragenerálni; a Letöltés gombbal külön másolatot menthetsz a választott helyre.

**IMPORTANT — reused results:** When extending a selection, preparation reuses unchanged shots that already completed successfully. It neither regenerates them nor copies their saved videos into the new run folder. A five-shot project can therefore have four videos in its newest folder while all five shots are complete: the reused shot remains in its original folder. The UI flags multiple folders and reused shots. Every result card shows its actual path and individual download. Do not regenerate just because the newest folder has fewer files; Download can save an additional copy to your chosen location.

**HU:** A „Snittek futtatása” részen az indítás után automatikusan az Élő futásnézethez ugrik. Itt látható a futó snitt száma, neve, tényleges kezdőképe, mérete és hossza; az aktuális node, annak valódi lépésszáma és az eltelt idő. A jobb alsó lebegő gombbal visszaugorhatsz ide. A Nagy nézet ugyanazt a képet nagyban mutatja; a szüneteltetés és a célzott leállítás ott is elérhető.

Az előnézet a ComfyUI által már elkészített képet használja, nem indít új dekódolást vagy generálást. KJ Preview Override esetén állóképet, animált WebP-t vagy rövid MP4-et is átvesz. Modellbetöltés, dekódolás vagy előnézet nélküli node közben nincs folyamatos kép: ezt kiírja. A lépésszám az aktuális node-ra vonatkozik, nem a teljes projekt százalékára. Kapcsolatvesztésnél a futás még folytatódhat; ne indítsd el ugyanazt újra. Másik futó ComfyUI-feladatot külön számmal jelez.

Elkészüléskor ugyanitt a teljes végleges videó játszható le, hanggal, kézi indítással; a mentési hely és a letöltés is megjelenik. A „Beküldött workflow” lenyitva az adott snitt ténylegesen beküldött node-jait és kapcsolatait mutatja, nem a ComfyUI másik fülén megnyitott régi vásznat. A pontos JSON külön menthető. A meglévő ComfyUI-vásznat nem cseréli le automatikusan.

**A frissítéshez a Scene DNA saját helyi szerverét kell egyszer újraindítani a megszokott indítóval, majd Ctrl+F5. A SwarmUI újraindítása ehhez nem szükséges. A futó generálás végét várd meg. Projekt mentésével külön fájlban is őrizd meg a képeket és beállításokat.**

**EN:** Starting a run scrolls to the live monitor. It shows the shot number/title, actual uploaded start image, dimensions/duration, active node, real node step and elapsed time. A floating button returns to this view. Large view includes the same preview, pause and scoped stop controls.

It relays ComfyUI's existing previews without extra inference or decoding. KJ Preview Override stills, animated WebP and short MP4 previews are supported. Loading, decoding and nodes without previews may not produce an image; the monitor says so. Progress is for the current node, not a fabricated overall percentage. A lost monitor connection does not prove generation stopped; do not blindly resubmit. Other running ComfyUI jobs are counted separately.

When complete, the same view offers the full saved video with manual playback and audible sound, its relative output location and download. Submitted workflow shows the exact shot's API nodes/connections and highlights the current node; its JSON can be saved. This read-only overview does not automatically replace an existing ComfyUI canvas.

Restart the Scene DNA local server once with its normal launcher, then Ctrl+F5. SwarmUI does not need restarting. Wait for any active generation to finish and keep a saved project backup. Preview bytes remain in bounded server memory and are not stored in project/run JSON files.

