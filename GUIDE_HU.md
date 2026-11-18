# Az első prompttól a kész jelenetig — Ismerd meg a Creator Hub Globalt!

Van egy jó modelled, egy ötleted és néhány bevált LoRA-d. A következő lépéshez egy olyan felület kell, ahol kiválasztod az eszközeidet, látod, mi történik, és meg is találod az elkészült munkát.

Az **ArtofTomworks Creator Hub Global** ezt az alkotói munkateret fogja össze képhez, videóhoz és utómunkához. A generálást a háttérben a ComfyUI végzi; a gráfszerkesztőt akkor nyitod meg, amikor szükséged van rá. A 0.14.0 nyilvános béta.

## Kinek ajánlott?

Olyan alkotóknak, akiknek már van működő ComfyUI-telepítésük, és kényelmesebben szeretnék használni a napi feladataikhoz. Kezdőként egy már működő, támogatott modellel indulj.

A Windows-csomag hordozható Node.js-futtatót tartalmaz, de nem telepíti helyetted a ComfyUI-t, annak Pythonját, a generatív modelleket és minden node-ot. Ez a teljes nyilvános béta, nem külön, mindent feltelepítő „beginners” változat.

## Első indítás, első kép

Bontsd ki a teljes Windows ZIP-et írható mappába, majd **START_CREATOR_HUB.cmd**. A szerverablak maradjon nyitva. A földgömbnél választhatsz a magyar, angol, német, francia, spanyol, olasz, portugál és lengyel felület közül. A nyelvváltás nem módosítja a promptodat és beállításaidat. A technikai üzenetek angolra eshetnek vissza; a műhelyeszközöknek saját nyelvkezelésük is van.

A Hub generáláskor ellenőrzi és szükség esetén indítja a meglévő ComfyUI-t. SwarmUI nem kell. Több telepítés esetén a **Motor** fülön válaszd ki a megfelelőt a saját Python-környezetével.

Válassz **Kép** módot és egy használatra kész modellt. Elsőre egy képet kérj, a modellnek és gépednek megfelelő méretben. Példaprompt:

> A small brass clock on a wooden desk beside a rain-streaked window, soft morning light, realistic materials, calm cinematic composition.

A Generálás indítása az ellenőrzést és előkészítést is elvégzi. A modelladatlapból érkező ajánlott értékeket nézd át; az aktív modell sávja mindig segít ellenőrizni, mivel dolgozol.

Az automatikus összeállítás SD 1.x/2.x, SDXL, FLUX.1, Krea 2, MOSS, H3 és LTX 2.5 dokumentált ágait támogatja megfelelő komponensekkel. H3/LTX esetén a külön generálómodell/UNET ág kell; az LTX automatikus támogatása 2.5-re készült. A család felismerése nem jelent minden változatra támogatást. Más esetben megfelelő saját workflow használható.

## LoRA-k és valódi változatok

A **LoRA-k** fülön válassz a modellcsaládhoz illő kiegészítőt. A kedvencek előre kerülnek. A bekapcsolt elemek a jól látható sávon vannak, és eltávolítás nélkül is kikapcsolhatók. Ismeretlen családnál külön haladó döntés szükséges; egy ismerős fájlnév még nem kompatibilitási bizonyíték.

Ha az első kép bevált, próbálj három változatot **Léptetés** seedmóddal, a választott induló seedtől, például 1-es lépésközzel. A **Fix** mód szándékosan ugyanazt a seedet használja. A másik seed új lehetőség, nem biztosíték arra, hogy minden kép látványosan különböző lesz.

A bevált összeállítást mentsd **Alkotói receptként**. Külön eldöntheted, átveszed-e a promptot, seedet és kezdőképet. A hiányzó modellt vagy LoRA-t indítás előtt tisztázd.

## Nézd meg, értékeld, találd meg!

Az élő előnézetre kattintva megállíthatod és folytathatod a nézését. **Ez nem állítja meg a generálást**, és a generálómodellt sem tölti ki a memóriából; az előnézet munkáját és adatforgalmát csökkenti.

Az elkészült képre kattintva nagy nézet nyílik, görgős nagyítással és lapozással. Mellékattintásra visszatérsz. A metaadatokat áttekintheted, a paraméterek újraalkalmazása külön döntés.

Az **Előzményekben** dátum, kedvenc, 1–5 értékelés, kategória és csoportos kijelölés segíti a rendrakást. A lomtár visszaállítható, a megerősített végleges törlés nem.

A normál generálások a ComfyUI output mappáján belül ide kerülnek:

- `ArtofTomworks/CreatorHub/Images/ÉÉÉÉ-HH-NN/`
- `ArtofTomworks/CreatorHub/Videos/ÉÉÉÉ-HH-NN/`

Az egyénileg beállított kimeneti mappa eltérhet. Mindig az adott eredmény tényleges útvonalát nézd. A Hub data mappájáról és a ComfyUI médiáiról egyaránt készíts mentést; a projektfájl nem minden média teljes biztonsági másolata.

## A képből videó, a videóból kész munka

Videó módban ellenőrizd a modellt, kezdőképet, tájolást, méretet, időtartamot és seedmódot. Elsőre rövidebb próbával érdemes megnézni a mozgást, mielőtt hosszú futást kérsz.

A prompt alatti kamera- és szereplőmozgási panel egyértelmű mozgáskérést adhat hozzá. Ez szöveges irányítás, nem kényszerített kameragörbe vagy ControlNet. Nézd át az összeállított kérést; az alaphelyzet gomb segít tiszta beállításról indulni.

A kész videó alatti műveletekből elérhető a videóműhely és a Loop Lab. Egyes utómunkákhoz külön node vagy feldolgozófüggőség kell. A videószerkesztő másolattal dolgozik; az eredményt ott exportáld és töltsd le. Ez az export még nem kerül automatikusan a Hub előzményeibe.

**Fontos a Scene DNA-nál:** a változatlan, korábban elkészült snitt újrahasználható. Öt tervezett snittből ezért négy ÚJ fájl is keletkezhet, miközben az ötödik a korábbi eredményt használja. A snittenkénti állapotot és fájlhelyet ellenőrizd!

## Helyi MI, ha szükséged van rá

A választható MI-segítő promptot finomíthat, fordíthat, jelenetet javasolhat, megfelelő látómodellel képet is értelmezhet. A javaslat csak külön alkalmazásra kerül a munkádba. Ollama és a modellek külön telepítést/letöltést igényelnek.

A kb. 7 GB-os, 9B DeepSeek nevű opció Qwen3.5-származék, nem hivatalos DeepSeek V4 és nem ügynöktanítás. A válaszait ellenőrizd. A generálás elsőbbséget kap a GPU-memóriánál.

A böngésző bezárása nem szakítja meg a futást. Ha ezt szeretnéd, használd a jelenlegi feladat utáni vagy az azonnali leállítást.

[Creator Hub Global — letöltés és követelmények](https://github.com/artoftomworks-debug/artoftomworks-creator-hub)

Ingyenes személyes és kereskedelmi alkotói használat a mellékelt licenc szerint; a program továbbértékesítése korlátozott. A modellek és forrásanyagok jogai külön érvényesek. Nyilvános béta, dokumentált kompatibilitási korlátokkal.

Ha hasznosnak találod, a [Ko-fi támogatás](https://ko-fi.com/artoftomworks) segíti a következő fejlesztéseket.
