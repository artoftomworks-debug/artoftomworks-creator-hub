# Scene DNA 0.6 — Rendezői pult / Director’s desk

## Magyar — hol találod és mire jó?

1. A **0.6-os indítót** használd. Korábbi munkádat előbb mentsd projektfájlba, majd töltsd be az új példányba. A korábbi próbamappák megmaradnak; a helyi böngészőtár más webcímen külön tárolódik.
2. Fent, a gyorsgombok között válaszd a **Rendezői pult** gombot. Kinyitja az azonos nevű panelt a storyboard fölött. A külön **NEW ×** jelölést megtekintés után kikapcsolhatod.
3. A táblázat a snittek sorrendjét, tervezett időablakát, napszakát, kameramozgását és videópromptjának forrását mutatja. Az időablakok a megadott snitthosszak összegei; nem a kész videók mért időadatai, és nincsenek átmenetekkel korrigálva. A snitt címére kattintva közvetlenül annak szerkesztéséhez jutsz.
4. Az **Átnézendő pontok** között megjelenhetnek a szomszédos snittek ténylegesen érvényes receptkülönbségei: helyszín, alanyok, öltözék, napszak, fények, színek, stílus és visszatérő tárgyak. A zárolt mezők figyelmen kívül hagyott, régi felülírásait nem mutatja eltérésként. A következő snitt visszatérését is jelzi, mert ott szintén változik a recept.
5. Korlátozott angol/magyar szövegminták jelzik a rögzített kamerához írt kameramozgást, bizonyos nappal/éjszaka ellentmondásokat és a villódzó megvilágítást. Az alkalmazott ötlet szövegében egyértelműen megadott teljes időtartamot is összeveti a snitthosszal. Nem minden megfogalmazást ismer fel; a többi nyelven a strukturált összehasonlítás működik, teljes szövegértést nem állítunk.
6. A jelzés mellett ott az érintett szövegrész vagy az előző/aktuális érték. Az **Ugrás a snitthez** gomb a megfelelő szerkesztőkártyára visz. A javítást te végzed el a receptben, az akciómezőben vagy a jelenetötlet szerkesztőjében. Az ötlet szövegének javítása után külön **Alkalmazás videópromptként** szükséges; pusztán egy másik vázlat szerkesztése nem írja át az aktív promptot.
7. Ha az eltérés szándékos, jelöld **Tudatos / átnéztem** állapotúnak. Ez nem javítás és nem minőségi jóváhagyás. Nem írja át a promptot; az átnézett pont megmarad a listában. A jelölés projektmentésben és helyi automatikus mentésben is megmarad. A fontos környezet vagy prompt megváltozása után újra átnézendővé válik. Legfeljebb 120 ellenőrzési ujjlenyomatot őriz; a legrégebbi elvész új jelölés hozzáadásakor, ha betelt a keret. A jelölőnégyzettel az elfogadás visszavonható.
8. A pult külön jelzi, ha egy korábban alkalmazott MI-ötlet a recept/kép/beállítások változása miatt már nem érvényes. Ilyenkor a program az automatikus promptot használja, a régi ötletet nem törli. Az új környezethez illeszkedést a jelenetjavaslatnál ellenőrizd és csak ezután alkalmazd újra.
9. **Ellenőrzés másolása / exportálása** a jelenlegi nyelven szöveges áttekintést készít, a snittek címével és jelzéseivel. Képet, videót és helyi fájlelérési utat nem ad hozzá. A saját címek és szövegrészletek viszont belekerülnek, ezért megosztás előtt nézd át. A széles táblázat kis képernyőn a saját keretében oldalra görgethető.

### Fontos határ

Ez egy gyors, helyben futó **tervezési segéd**, MI-hívás, képfeldolgozás és GPU-terhelés nélkül. Nem vizsgálja a kész képeket/videókat, nem mér arcegyezést, anatómiát, képhibát vagy hangminőséget. A jelzések lehetséges ellentmondások, nem bizonyított hibák; a találat nélküli eredmény sem minőségi garancia. A korábbi egyszerű receptellenőrzés külön megmaradt.

### A három MI-javaslat próbája

A helyi `promptstudio-vision:4b` modellel egy valódi kérés 15 másodperc alatt három különböző választ adott a kávézós mintaképre. Ez működési próba, nem általános modellminősítés. Az egyik ötlet villódzó fényt javasolt a stabil világítási szándék mellett: az ilyen szöveget át kell nézni. A csomag nem tartalmazza a modellt vagy a próbaképet.

## English — quick start

1. Use the **0.6 launcher**. Save a project in your earlier copy and load it here. Existing preview folders remain unchanged; different local addresses have separate browser storage.
2. Click **Director’s desk** in the top shortcut area. It opens the review panel above the storyboard. Its own **NEW ×** badge can be dismissed.
3. The table shows ordered shots, cumulative planned time ranges, time of day, camera plan and the source of each active video prompt. These are planned durations, not measurements of rendered video or transition-adjusted edit timing. Click a shot title to open its editor.
4. Adjacent-shot recipe changes are listed using effective values: location, subjects, wardrobe, time, lighting, palette, style and continuity objects. Dormant locked overrides are ignored. Returning to the shared recipe in the next shot is also a change.
5. Limited EN/HU keyword rules flag camera-motion wording against a steady plan, certain day/night conflicts, flickering light and explicitly stated total durations that differ from the shot setting. Other UI languages retain the structured checks; this is not full multilingual semantic analysis. The canonical applied prompt is checked, even while a different draft is being edited. Otherwise action text is used for wording checks.
6. Findings include a text excerpt or before/after values. **Open shot** takes you to the relevant editor. Make corrections yourself. Changes in the editable idea need an explicit **Apply as video prompt** before replacing the active prompt.
7. Mark a deliberate choice **Intentional / reviewed**. This does not modify or approve the prompt; the finding remains visible. Marks persist in project JSON and browser autosave. Relevant context changes require fresh review. Up to 120 fingerprints are retained; at capacity the oldest is discarded on the next new mark. Uncheck to revoke a mark.
8. An outdated applied idea is labelled as paused, with the automatic prompt active. The old draft is retained; review its suitability before reapplying it.
9. **Copy review / Export review** creates a text summary in the current UI language. It includes titles and excerpts, without adding image/video data or filesystem paths. Review your text before sharing. Narrow screens scroll the wide table inside its own container.

The desk runs locally without AI inference, image processing or GPU work. It is a planning aid, not a rendered-media inspection, identity/anatomy assessment, audio test or quality certificate. Findings may be intentional; no findings is not a guarantee.

The three-alternative local AI path was exercised once using `promptstudio-vision:4b` and the café reference: one request returned three alternatives in 15 seconds. Output still needs editorial review; one alternative introduced flickering lighting despite the stable-lighting intent. Neither model nor test image is bundled. No media generation was started.
