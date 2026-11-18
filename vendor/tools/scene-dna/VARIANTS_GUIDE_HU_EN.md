# Scene DNA 0.5 — Jelenetváltozatok és bevált ötletek

## Magyar — első használat

1. A korábbi példányban **Projekt mentése**, majd indítsd az új 0.5-ös példányt és válaszd a **Projekt betöltése** gombot. A régi próbamappák megmaradnak. Ennél a frissítésnél a szerver is változott: az új indítót használd. Ha a régi szerver fut, az új automatikusan szabad címet keres; másik címhez külön böngészőtár tartozik.
2. Készíts vagy tölts be snitt-tervet, és csatolj kezdőképet. Felül a **Jelenetjavaslat a képhez** gombbal nyisd meg az első snitt tervezőjét. A többi snittnek saját tervezője van.
3. Állítsd be a kategóriát, mozgást, hangulatot, saját elképzelést és a helyi képértő modellt, ahogy a SCENE_PLANNER_HU_EN.md mutatja. Az időtartam, kamera és kivágásterv minden alternatívánál közös kiindulás.
4. **Három javaslat — egy MI-kérés**: egy képértő kérés három lehetséges értelmezést kér ugyanarra a snittre: **Visszafogott**, **Filmes**, **Kreatív**. Ezek alternatívák, nem három egymás után lejátszandó snitt. A rögzített kameratervet mindháromnak követnie kell; a történésben és tempóban térhetnek el. A modell ezt elvétheti, ezért ellenőrizd.
5. MI nélkül a **Három kategóriasablon** gomb is használható. Ez nem elemzi a képet, és ezt jelzés mutatja. A saját sablonszövege angol, a beírt recepted változatlan marad.
6. Az új kártyák hozzáadódnak a meglévőkhöz. A korábbi szerkeszthető vázlat és az alkalmazott videóprompt megmarad. Ha még egyáltalán nincs vázlat, az első új változat megjelenik a szerkesztőben, alkalmazás nélkül.
7. A kártyákon a megszokott sorrend látható: cím és állapot, rövid összefoglaló és szövegelőnézet, alattuk a műveletek. **Szerkesztés** megnyitja a teljes promptot a nagy szerkeszthető mezőben. Az átírt szöveg az adott változatban is megmarad. **Prompt másolása · Videóprompt** csak annak a kártyának a teljes promptját másolja.
8. **Alkalmazás videópromptként** teszi aktívvá a változatot. A kép-promptot nem módosítja. Másik változat szerkesztése nem írja át a már alkalmazott promptot. Az alkalmazott kártya külön jelzést kap; a normál videópromptmező mindig az aktuálisan használt szöveget mutatja.
9. **Saját változat hozzáadása** üres, szerkeszthető alternatívát készít. A **Változat eltávolítása** a kártya alatti lenyitható részben található, és megerősítést kér. Ha egy alkalmazott kártyát távolítasz el, a már alkalmazott prompt szövege megmarad. A többi, nem alkalmazott törölt változat visszaállításához korábbi projektmentés szükséges.
10. Snittenként legfeljebb **24 változat** lehet. Újabb három kéréséhez legyen elegendő hely; a program nem törli a régieket a háttérben. A még külön kártyába nem tett korábbi vázlatot szükség esetén „Korábbi vázlat” néven őrzi meg.

## Bevált jelenetötletek

- Egy kártyán vagy az aktuális szerkesztő alatt válaszd a **Mentés a bevált ötletek közé** gombot, majd adj nevet. A tár ebben a böngészőben és ezen a helyi címen marad meg, nem csak az aktuális projektben.
- A **Bevált jelenetötletek** lenyitható részben válassz mentett ötletet, majd **Hozzáadás ehhez a snitthez**. Ez új kártyát ad hozzá; nem írja felül a meglévőket és nem alkalmazza magától.
- Az ötlet a korábbi képhez/recepthez tartozhat. Ilyenkor a másolásig újra át kell nézni, majd alkalmazáskor jóváhagyni. A jóváhagyás a szöveget változatlanul hagyja: nem elemzi újra a képet és nem javítja át automatikusan a régi részleteket.
- A tár legfeljebb **50 ötletet** tárol. Szöveg, összefoglaló, korábbi modellmegfigyelés és tervezési környezet kerül bele; **képfájlt vagy bélyegképet nem tartalmaz**. A korábbi megfigyelés nem állítás az új kép tartalmáról.
- **Bevált ötletek exportálása**: külön `SceneDNA_SavedScenes.json` fájl. Ezt használd biztonsági másolatnak, más böngészőhöz vagy másik helyi címhez. **Betöltés** a meglévővel egyesíti az ötleteket az azonosítójuk alapján; az azonos azonosítójú bejegyzést a betöltött változat frissíti. Hibás fájl nem üríti ki a tárat.
- A normál **Projekt mentése** tartalmazza a snitt változatait, a szerkesztett vázlatot és az alkalmazott prompt pillanatképét. A teljes, több projektben használt beváltötlet-tár külön exportálható. Böngészőadat-törléskor a helyi tár elveszhet, ezért mindkét fajta mentést érdemes használni.

## Erőforrások, megszakítás és ellenőrzés

Egy hármas javaslat egyetlen képértő modellhívást használ, egy képpel. Ez hosszabb választ kér, ezért nem jelent azonos futásidőt egyetlen rövid javaslathoz képest. Egyszerre továbbra is egy Scene DNA MI-feladat futhat, a fordítással együtt. A CPU mód alapértelmezett; a memória-/GPU-ellenőrzés és a megszakítás megmaradt. Generálás közben ne indíts képelemzést.

Ha a modell nem ad három teljes, különböző változatot, hibát jelez, és a korábbi munkád megmarad. Az időközben megváltozott projektre vagy kérésalapra nem ír rá későn érkező válasz. A kezelőfelület nem indít videógenerálást.

A 0.5 automatizált logikai/HTTP-próbákat és elkülönített Windows/Brave böngészőpróbákat kapott, tesztmodell-válaszokkal. Az ezt követő valódi helyi próbában a promptstudio-vision:4b egyetlen kérésből 15 másodperc alatt három választ adott. Ez nem általános modellminőségi igazolás; az egyik válasz nem kívánt fényvillódzást javasolt. Az egyes modellek képességeit és a javaslatok tartalmát a saját képeiden ellenőrizd.

## English — scene alternatives and proven ideas

1. Save the project in your previous copy and load it in this separate 0.5 preview. Use the new launcher: the backend changed too. Old previews remain intact; startup finds a free local address if necessary. Browser storage is separate for each address.
2. Open **Scene suggestion from image** on a shot. Choose the category, movement, mood, source and local vision model as in SCENE_PLANNER_HU_EN.md. Duration, camera and applied composition remain common constraints.
3. **Suggest 3 alternatives — one AI request** asks for three alternatives for the same shot: **Restrained**, **Cinematic**, **Creative**. These are alternative interpretations, not sequential shots. The fixed camera/framing plan applies to all; proposed action and pacing may differ. Review model compliance.
4. **3 category templates — no AI** works offline. It uses text settings, not image analysis, and is labelled accordingly. Its own guidance is English; creator-entered text is preserved.
5. New variants append to earlier ones. The current editable draft and applied video prompt are preserved. If there is no draft yet, the first new idea opens in the editor without being applied.
6. Each card has a title/status, a short summary and preview, then its actions. **Edit** opens the full prompt in the large editable field and retains changes in that variant. **Copy · Video prompt** copies its full prompt without explanation. **Apply as video prompt** explicitly replaces the active video prompt; image prompts are unaffected. Editing another variant leaves the applied snapshot intact.
7. Add your own blank variant or remove a card under its removal disclosure, with confirmation. Removing an applied card keeps its applied prompt text. Other removed variants require an earlier project backup to restore. Up to 24 variants per shot; old variants are never silently evicted. A current unlisted draft is archived as Previous draft when necessary.
8. **Save as a proven idea** requests a name and stores the text idea in this browser/address, independently of the project. The saved-ideas section lets you add it as another card in any shot. This does not apply it automatically.
9. Saved ideas may be bound to an older source/recipe. Review before applying to a different context. Explicit approval keeps the text as written; it does not re-analyze the new image or rewrite old details. Earlier model observations are not facts about the new image.
10. Up to 50 saved ideas. The library contains prompt text, summary, previous model observations and planning context; no images or thumbnails. Export to `SceneDNA_SavedScenes.json` for durable backup and transfer. Import merges by ID, with incoming entries updating matching IDs. Invalid imports preserve the library.
11. Project JSON stores the shot's variants, editor draft and applied snapshot. The cross-project saved-idea library has its own export. Browser cleanup may remove local convenience storage, so keep both kinds of backup. Inspect exported text/context before sharing.

One three-alternative batch uses one image-aware inference with one image, but requests a longer answer, so it may take longer than a single short suggestion. CPU default, one active AI task, resource preflight and cancellation remain. Complete media generation before running vision inference. Incomplete, repeated or malformed batches are rejected without replacing prior work; late replies cannot overwrite changed request/project state.

Version 0.5 passed automated logic/HTTP tests and isolated Windows Brave tests with deterministic model replies. A subsequent real local promptstudio-vision:4b request returned three alternatives in 15 seconds. This is not general quality certification: one suggestion introduced unwanted lighting flicker. Review output quality with your own model and images; generated media is never claimed or started by this tool.
