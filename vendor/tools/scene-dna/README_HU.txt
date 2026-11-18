ARTOFTOMWORKS SCENE DNA 0.7.0 — NYILVÁNOS BÉTA

Egy jelenet. Összetartozó snittek. Látható futás.

Standard és Beginners: ugyanaz a teljes alkalmazás. A Beginners változathoz külön, részletes szamárvezető jár. A teljes ZIP-et csomagold ki írható mappába; ne a ZIP-ből indítsd.

INDÍTÁS
Csak tervezés: START_OFFLINE.cmd, modern asztali böngészővel.
Helyi MI / snittek futtatása: külön telepített Node.js 22+, majd START.cmd. A parancssoros szerverablak maradjon nyitva. Node: https://nodejs.org/
Opcionális MI: külön Ollama és telepített modell. Képelemzéshez képértő modell kell. Üres lista: ellenőrizd az Ollama futását és a modell telepítését. Az alkalmazás nem tölt le modellt. Ollama: https://ollama.com/

MIT TUD?
Közös jelenetrecept és rögzíthető folytonossági mezők; 3–6 szerkeszthető snitt; külön kép-/videóprompt; saját stílus-, fény-, szín- és hangötletek; bővíthető recepttár; nagy kivágástervező; képhez kérhető helyi MI-jelenetjavaslat és három változat; fordítás közvetlenül a prompt mellett; bevált ötletek; rendezői pult, tervezési ellenőrzés; projektmentés, promptlap, nyomtatható storyboard.

Az opcionális futtató a támogatott ComfyUI H3 Simple/Pro workflow-val egy vagy több kijelölt snittet futtat egymás után. Megőrzi a forrás modell/LoRA/sampler/seed beállításait. Külön JSON is menthető. Az előkészítés nem indít generálást; csak külön Indítás után fut.

Az Élő futásnézetben látható a futó snitt, tényleges kezdőképe, mérete, ideje, aktuális node-ja, valódi lépésszáma és az eltelt idő. A meglévő ComfyUI/KJ előnézetét veszi át; külön nagynézet és lebegő visszaugrás is van. A ComfyUI vásznát nem cseréli le automatikusan. A kész videó ugyanott lejátszható és letölthető, mentési helye látható.

ELSŐ FUTTATÁS
1. Opcionális híd: INSTALL_COMFY_BRIDGE.cmd. A valóban használt ComfyUI hátteret válaszd, amelyben main.py van; SwarmUI-nál annak saját hátterét. Telepítés után ezt a hátteret teljesen indítsd újra. Nem modelltelepítő.
2. Nyisd meg a működő H3 Simple/Pro workflow-t. Scene DNA · Save workflow source, vagy kompatibilis API JSON mentése.
3. Scene DNA → Snittek futtatása → forrás JSON betöltése. Jó helyi háttércím kell; SwarmUI-nál gyakran http://127.0.0.1:7801/ComfyBackendDirect.
4. Elsőre egy snittet jelölj ki. Méret, tájolás, rövid próba / teljes tervezett hossz. Az előkészítés után a tényleges képméretet, képkockaszámot és másodpercet ellenőrizd.
5. Ellenőrzés és előkészítés → JSON mentése vagy Kijelölt snittek indítása. A futás a Scene DNA Élő futásnézetében követhető.
6. A videó automatikusan a háttér beállított output mappáján belüli ArtofTomworks/SceneDNA/<futtatás>/ könyvtárba kerül. A Letöltés csak külön másolatot készít. FONTOS: a változatlan, korábban kész snitteket új előkészítéskor újrahasználja, videójuk az eredeti mappában marad. Így öt kész snitt mellett az új mappában csak négy új fájl is lehet. Több mappa és újrahasznált eredmény esetén külön felirati jelzés látható. Minden eredménykártya a valós útvonalát és saját letöltését mutatja; emiatt ne generálj újra.

FONTOS
A prompttervezés más generátorhoz is használható, kézi másolással. A beépített futtató jelenleg H3 Simple/Pro; LTX és tetszőleges workflow nem támogatott. Nincs automatikus összevágás, áttűnés vagy szájszinkron. A prompt és a kivágásterv nem garantálja a generált kép, mozgás vagy hang pontosságát.
A H3 futtató snittenként 1–15 kért másodpercet fogad; a képkockarács miatt a tényleges hossz eltérhet. A tervezőkártya 1–30 másodperce nem minden modell támogatási ígérete.

A projekt JSON-t Scene DNA-ba töltsd vissza; a workflow JSON-t ComfyUI-ba. A projekt képeket is tartalmazhat. Ments projektfájlt, ne csak a böngésző tárolására támaszkodj. Az eredeti képfájlok változatlanok; a munkaképek legfeljebb 1280 pixelesek. A generáláshoz külön eredeti kezdőkép is adható.

Kép-/videógenerálás közben ne terheld ugyanazt a szűk memóriájú GPU-t helyi képolvasással. A CPU mód alapértelmezett a helyi MI-hez, de a gépigény továbbra is modellfüggő. Kapcsolatvesztéskor a háttér még futhat: ne küldd be vakon újra.

Frissítés után a Scene DNA saját szerverablakát is zárd be, indítsd újra START.cmd-vel, majd Ctrl+F5. Csak a böngésző frissítése nem frissíti a szerverkódot. A híd telepítésén kívül nem kell emiatt a SwarmUI-t újraindítani.

Windows/Brave tesztelt. Nyolc felületi nyelv; néhány új diagnosztikai/futásnézeti szöveg HU/EN-en kívül angolul jelenik meg. Linux/macOS/mobil nincs hitelesítve.
Ingyenes személyes és üzleti alkotói használat; a program ingyen továbbadható/módosítható a licenc megtartásával, de nem értékesíthető tovább és nem tehető fizetős csomagba. LICENSE.txt és THIRD_PARTY.md. Más modellek és médiák jogait ez nem adja meg.

Részletes kétnyelvű segítség: RENDER_GUIDE_HU_EN.md, SCENE_PLANNER_HU_EN.md, VARIANTS_GUIDE_HU_EN.md, COMPOSITION_GUIDE_HU_EN.md, DIRECTOR_GUIDE_HU_EN.md.
