A 0.5 már három alternatívát kér egy hívásból, megőrizve a korábbi munkát. Részletek: VARIANTS_GUIDE_HU_EN.md.
Version 0.5 requests three alternatives per call and preserves prior work; see VARIANTS_GUIDE_HU_EN.md.

# Scene DNA 0.4 — Jelenetjavaslat a képhez / Scene suggestion from image

## Magyar — szamárvezető

1. A korábbi példányban **Projekt mentése**, az újban **Projekt betöltése**. Az új példány külön próbamappát kap, a régi változatot nem írja át. Az indító a korábbi szerver mellett is keres szabad helyi címet. Másik címhez külön böngészőtár tartozik, ezért a projektfájlos átvitel fontos.
2. Jobb felül válaszd a **HU** nyelvet. Tölts be példát, vagy írd meg a közös receptet és kérj snitt-tervet. Csatolj kezdőképet közös referenciaként vagy a megfelelő snitt saját képeként.
3. Felül a **Jelenetjavaslat a képhez** gomb az első snitt tervezőjéhez ugrik. Minden kártyán külön tervező van; a NEW jelzés elrejthető. A snitt időtartama, kamerája és az alkalmazott kivágásterv adja a kiindulási keretet.
4. Válassz kategóriát: glamour/felnőtt divat, portré, filmes jelenet, termék, természet, hangulatkép, akció vagy saját kategória. Saját kategóriánál írd be a leírást. Adj mozgásjelleget, hangulatot és saját elképzelést; ezek a projektben megmaradnak, a kártya másolásával is átvihetők.
5. **Forráskép**: közös referencia vagy a snitt saját eredménye. A helyi MI mindig ezt az egy képet kapja; a többi snitt képeit és az alkotói jegyzeteket nem. Az image-to-video generátorban majd az eredeti, jó minőségű képet használd; a Scene DNA csak előnézeti méretű munkaképet tárol.
6. A **Helyi képértő modell** rész megnyitásakor betölti a helyi Ollama által képértőként jelzett telepített modelleket. A **Képértő modellek frissítése** gombbal újra kérhető a lista. Nem a névből találgat: ellenőrzi a modell képességjelzését. Üres lista esetén legyen elindítva az Ollama, és legyen külön telepítve képértő modell. A program nem tölt le modellt. A `promptstudio-vision:4b` csak akkor választható, ha már létrehoztad/telepítetted a gépeden; nem része ennek a csomagnak.
7. **Vázlat nyelve**: a kért MI-válasz nyelve, alapból angol. Ez különbözik a kezelőfelület nyelvétől. A kész vázlat tovább fordítható a szokásos promptnyelv-választóval, alkalmazás után.
8. Fejezd be a kép-/videógenerálást, majd kattints a **Javasolj jelenetet helyi MI-vel** gombra. Csak ekkor kerül a munkakép és a tervezési szöveg a gépeden futó Ollamához. A CPU mód az óvatos alapbeállítás; lassabb lehet. A gépterhelés és memória pillanatnyi ellenőrzése ismert terhelésnél elhalasztja a kérést. Ez óvintézkedés, nem garancia minden túlterhelés ellen.
9. A válasz **szerkeszthető videóprompt**, külön jelenetötlettel és ellenőrizendő modellmegfigyelésekkel. Először csak vázlat. Írd át, amit szeretnél; a **Csak a vázlatprompt másolása** a magyarázatok nélkül másol. A modell tévedhet, visszautasíthat vagy más nyelven válaszolhat; mindig nézd át.
10. **Alkalmazás videópromptként**: ekkor lesz ez a snitt tényleges videópromptja. Az alsó videóprompt nyelve ilyenkor „Eredeti szöveg”, így a megírt vázlat azonnal másolható. A kép-promptot nem írja át, képet vagy filmet nem generál, és a generátort nem állítja be.
11. Ha módosítod a forrásképet, a közös receptet, az időtartamot, a kamerát, a kivágást vagy a jelenetirányt, a vázlat ellenőrzendővé válik. Megmarad szerkeszthetően, de addig az automatikus videóprompt érvényesül. Újraalkalmazáskor külön rákérdez a felülvizsgálatra: a szöveget nem írja át magától.
12. **Automatikus prompt visszaállítása** kikapcsolja a vázlat felülírását, de a szövegét megtartja. **Kérés megszakítása** az aktuális MI-kérést szakítja meg; a korábbi munkát megőrzi. Ha a várakozás alatt megváltozott a projekt vagy a kérés alapja, az érkező válasz nem ír rá az új állapotra.

### Ha nincs helyi képértő modell

A **Kategóriasablon — MI nélkül** gomb fordítós szerver nélkül is működik. A szöveg a receptből, snittbeállításokból és kategóriasablonból áll össze. Ez nem elemzi a képet, és ezt egyértelmű jelzés mutatja. A sablon iránymutatása angol; a saját beírt szöveged változatlan marad. Alkalmazás után fordítható a helyi fordítóval, ha azt elindítod.

### Erőforrások és adatok

- Egyszerre egy helyi Scene DNA MI-kérés futhat, a fordítást is beleszámítva. A modellképesség-lista lekérése csak metaadatolvasás, nem képelemzés.
- Az erőforrásgomb szabad RAM/VRAM és GPU-terhelés pillanatnyi adatait mutatja. NVIDIA-adat hiányozhat; ilyenkor a CPU mód és a generálás befejezése a célszerű kiindulás.
- A jelenettervezés halaszt, ha a szabad RAM 4 GiB alatti, az ismert GPU-terhelés legalább 35%, vagy a szabad VRAM CPU módban 2 GiB, GPU módban 6 GiB alatti. A terhelés kérés közben is változhat. Ezek egyszerű, óvatos küszöbök, nem modellspecifikus memóriaigény-becslések.
- A kérés befejezése után a használt modellt nem kéri betöltve tartani (`keep_alive: 0`). Más alkalmazások feladatait nem állítja le.
- A projekt JSON a képbélyegképek mellett a vázlatot, megfigyeléseket, modell nevét és beállításokat is tartalmazza. Megosztás előtt ellenőrizd. Az MI-javaslat nem bizonyítja a kép tényeit, a generátor kompatibilitását vagy a végeredmény minőségét.
- A 0.4 Windows/Brave alatt kapott automatizált próbákat, és egy valódi helyi képértő próbát a felhasználó már telepített modelljével. Más platformot és más modellválasztást ez nem igazol.

## English — quick guide

1. Save a project from the previous copy and load it in this one. This is a separate preview folder. Startup now finds another local address if an older server occupies the first; browser storage differs by address, so transfer via a project file.
2. Load an example or create a shared recipe and shot plan; attach a reference or shot result. The top **Scene suggestion from image** button jumps to the first card. Each card has its own planner and a dismissible NEW marker.
3. Pick a category, movement, mood and creator direction. Own category accepts your description. Choose the shared reference or shot result as the source image. Shot duration, camera and applied composition guide are part of the request context.
4. Open **Image-aware local model**. The app lists installed local Ollama models whose reported capabilities include vision; Refresh repeats discovery. Start Ollama and install a suitable model separately if empty. No model is bundled or downloaded. A user-created `promptstudio-vision:4b` alias is available only if already present on that computer.
5. Set the draft language, English by default, independently of the interface language. Finish image/video generation before requesting local AI. CPU mode is the cautious default; it may be slow.
6. Click **Suggest scene with local AI**. Only now are the selected working thumbnail and planning text sent to local Ollama. Other images, local paths and creator notes are excluded.
7. Review the editable video prompt, separate scene summary and model observations. Model observations are not verified facts. Nothing is applied or generated automatically. Copy draft prompt copies the prompt alone.
8. **Apply as video prompt** commits it for this shot and switches the regular video prompt language selector to Original text for immediate copying. Image prompts are unchanged. You can then request a translation through the usual prompt controls.
9. Source image, recipe, shot timing/camera, crop or planning-direction changes mark the draft stale. Its editable text remains; the automatic video prompt is used until you explicitly review/reapply. Reapplying keeps your text as written; it does not silently rewrite timing or camera instructions.
10. **Use automatic prompt again** disables the override but keeps the draft. Cancel stops the current request and preserves prior work. Late replies cannot overwrite changed project/request state. Project JSON and full browser autosave retain the draft and its settings.

**Without a vision model:** Category template works offline. It uses the text recipe, shot settings and a category template, not image analysis. Its own guidance is English; user text is kept as written. A label makes the origin explicit. Translate after applying if a local translator is available.

**Resources:** one Scene DNA AI request at a time, including translation. Read-only resource checks report free RAM/VRAM and GPU utilization where available. Requests are deferred below 4 GiB free RAM, at known GPU utilization of 35% or more, or below 2 GiB free VRAM in CPU mode / 6 GiB in GPU mode. Missing NVIDIA metrics remain unknown. These conservative thresholds are not model-specific memory predictions or a guarantee against later load changes. The request uses `keep_alive: 0`; other applications' jobs are never stopped.

**Limits and privacy:** the draft is a planning aid, not generated media or automatic generator configuration. The model may hallucinate, refuse or fail to follow language/format; review before use. The saved project includes thumbnails, draft, observations, selected model name and settings; inspect before sharing. Eight interface languages are provided; automated desktop checks were run on Windows Brave, not a cross-platform certification.

### Technical references

The local integration uses Ollama's [vision image input](https://docs.ollama.com/capabilities/vision), [chat endpoint](https://docs.ollama.com/api/chat) and [reported model capabilities](https://github.com/ollama/ollama/blob/main/docs/api.md#show-model-information). Models and Ollama remain separate installations with their own terms.
