# Kép / videó választás az MI-segítőben — 2026-11-04

Futtasd az UPDATE.cmd fájlt ebből a kicsomagolt mappából. Alapértelmezett cél: <your Prompt Studio folder>. Utána Ctrl+F5. Szerver-újraindítás nem szükséges. A frissítő ellenőrzi az ismert korábbi verziót és a csomag épségét, mentést készít, hiba esetén visszaállítja a lecserélt fájlokat. A médiákat, archívumot és személyes böngészőbeállításokat nem törli. Ismeretlen verziónál megáll.

## Hol találod?

Kérdezd az MI-t → Feladat: Saját kérdés → Mihez kérsz promptot? → Kép / Videó. A választó közvetlenül a felső segítő/modell/feladat sor alatt jelenik meg, NEW jelöléssel az újdonságlistában.

- Új kérésnél és régi, célt nem tartalmazó mentésnél Kép az alapértelmezés.
- Kép esetén a kérés külön előírja az egyetlen állóképet, mozgássor és hangutasítás nélkül. Videó esetén mozgást és folytonosságot kérő videóprompt a cél.
- Általános kérdésre továbbra is lehet normál választ kérni: a célválasztó a generálási promptokra vonatkozik, nem kényszerít minden választ prompttá.
- Célváltás nem küld kérést és nem törli a már kapott választ; az új cél a következő elküldéskor érvényesül.
- A választás megmarad panelbezárás és lapújratöltés után. A bevált kérések is mentik; Előző állapot vissza tudja hozni az előző választást. Az Alaphelyzetbe állítás Képre vált.
- A célválasztás a helyi kérésbe és a külső segítőnek másolt szövegbe is bekerül. A modell hibázhat, a kimenetet ellenőrizni kell.
- A meglévő képből videó és képből prompt feladatokat a frissítés nem alakítja át; az új választó a Saját kérdésnél jelenik meg.

## Miért csak SFW látható?

Bekapcsolt SFW menüszűrőnél csak az SFW címke választható. Most a mező alatt ezt kiírjuk, és a Felnőtt választék megjelenítése gombbal ott helyben kikapcsolhatod a szűrőt. Ekkor a többi rendszerezési címke választható. Az eredeti SFW kapcsoló továbbra is megmarad. A kapcsoló menüszűrő, nem szülői zár és nem tartalomvizsgáló. A címkék nem explicit generálási sablonok és nem oldanak fel modellkorlátozásokat.

## English changelog

- Added an explicit Image / Video selector under the top controls in Ask AI → My question. Image is the default for new work and older saved requests.
- Sends a clear generation-target instruction to both local models and external assistant handoffs. A still-image request asks for one frozen moment rather than animation or audio; video requests ask for coherent motion and continuity.
- General questions can still receive ordinary answers. The selected target applies when a generation prompt is requested. Model compliance is not guaranteed.
- Preserves the selected target in drafts, saved requests and previous-state recovery. Changing it keeps the existing question and answer and never sends automatically. Reset returns to Image.
- Leaves existing dedicated image / image-to-video tasks intact.
- Explains why only SFW is visible when the menu filter is on and adds an adjacent, explicit Show adult choices button. Labels remain classification only; the toggle is not parental control or content scanning.
- Localised in EN, HU, DE, FR, ES, IT, PT and PL; includes dismissible NEW navigation.

Run UPDATE.cmd from the extracted folder, then Ctrl+F5. No server restart is needed. The updater validates known versions, backs up changed files and rolls back incomplete replacements. This package is an incremental personal update for the verified installation, not a full first-install release.

## Ellenőrzés / Verification

Automated tests exercise eight-language local image/video requests, external copy, no send on changing the selector, draft/reload/previous-state/saved-request persistence, SFW controls, earlier text-only/vision/copy behaviour and full offline script syntax. The updater is checked using disposable installs, a repeat run, refusal of unknown files and rollback on a locked later file. No live model inference or visual browser acceptance test was performed for this update.
