ARTOFTOMWORKS CREATOR HUB GLOBAL
0.14.1 — Nyilvános béta — 2026. november 19.

Helyi alkotói felület képhez, videóhoz és utómunkához, ComfyUI-háttérrel.
Válassz modellt, adj hozzá kompatibilis LoRA-kat, írd be a promptot, és
indítsd az alkotást. A támogatott modellekhez a Hub állítja össze a gráfot.

NYOLC NYELV
Magyar, angol, német, francia, spanyol, olasz, portugál és lengyel.
A fejléc földgömbös választója megjegyzi a nyelvet. Nem módosítja a promptot,
seedet, fájlnevet vagy generálási beállítást. A technikai háttérüzenetek
angolra eshetnek vissza; külső eszközök üzenetei eredeti nyelven maradhatnak.
A mellékelt Prompt Studio és Scene DNA ugyanilyen nyolcnyelvű, saját
nyelvválasztóval rendelkezik.

ELSŐ INDÍTÁS WINDOWSON
1. A teljes Windows ZIP-et bontsd ki egy írható mappába. Ne a ZIP-ből és ne
   a Program Files könyvtárból indítsd.
2. START_CREATOR_HUB.cmd. A Windows-csomag Node.js 24 x64 futtatót tartalmaz.
   A megnyíló szerverablak maradjon nyitva használat közben.
3. Válassz Kép vagy Videó módot és egy használatra kész helyi modellt.
   Generáláskor a Hub ellenőrzi és szükség esetén indítja a meglévő ComfyUI-t.
   A SwarmUI-nak nem kell futnia.
4. Több ComfyUI esetén a Motor fülön válaszd ki a megfelelőt, és mentsd.
   A ComfyUI saját Python-környezete szükséges.
5. Add meg a promptot, méretet, darabszámot, majd Generálás indítása.
   Az ellenőrzés és előkészítés automatikus; a hiányokat a felület jelzi.
6. Figyeld az állapotot és az élő előnézetet. A képre kattintva a nézés
   megállítható/folytatható. Ez közelítő előnézet, nem a végleges videó.
7. Az elkészült bélyegképre kattintva nagy nézet nyílik. Görgő: nagyítás;
   nyilak: lapozás; mellékattintás: visszatérés.

KINEK AJÁNLOTT?
ComfyUI-t használó alkotóknak, akik a napi kép- és videókészítést áttekinthető
felületen szeretnék végezni. Kezdőként egy már működő, támogatott modellel,
egyetlen képpel és visszafogott mérettel kezdj. A meglévő ComfyUI-telepítést
és modelleket nem helyettesíti a letöltés. Ez egy teljes nyilvános béta,
nem külön, mindent telepítő „beginners” változat.

FELTÉTELEK
Windows 10/11 x64, működő ComfyUI saját Pythonnal, a modellnek megfelelő
hardver, modellek, kódolók, VAE-k és node-ok. Korszerű Chromium-böngésző
ajánlott. A forrásváltozathoz Node.js 22+ kell; npm-telepítés nem szükséges.
Generatív modell, Ollama és DeepSeek nincs a ZIP-ben. A pózeszközhöz egy
MediaPipe pózfelismerő modell mellékelve van; lásd THIRD_PARTY.md.

FŐ LEHETŐSÉGEK
Kép és videó, pozitív/negatív prompt, méretpresetek, arányfordítás, saját
méretek, lépésszám, CFG, sampler/scheduler. Véletlen, fix és állítható
lépésközű seed. Fix módban a fix seed ismétel; változatokhoz Léptetés mód.
Sorozatok látható sorral, leállítás a jelenlegi után vagy azonnal. A böngésző
bezárása önmagában nem szakítja meg a futást.

Helyi készlettár, keresés, bélyegképek, kedvencek, kompatibilitási jelzések.
A modell és LoRA-k jól látható sávon szerepelnek. A LoRA kikapcsolható úgy,
hogy a sávon maradjon a későbbi visszakapcsoláshoz. Modellböngésző és
engedélyezett letöltések; belépéshez kötött forrásnál kézi teendő is lehet.

Előzmények dátum és médiatípus szerint, 1–5 értékelés, kategória, kedvenc,
csoportos kijelölés, lomtár/visszaállítás és megerősített végleges törlés.
Kép/videó metaadatainak áttekintése és külön kérhető újraalkalmazás.
A behúzott fájl nem írja felül automatikusan a beállításokat. Metaadat
nélküli fájlból nem lehet minden korábbi paramétert visszanyerni.

Alkotói receptek választható prompt/seed/kezdőkép átvétellel és visszavonással;
a receptek a projekttel mentődnek. Kamera- és szereplőmozgási promptpanel,
póz/stúdió eszközök, összehasonlítás, próbarácsok. Képszerkesztő, Loop Lab,
Videóstúdió, Audio Fix, Final Check, Take Compare, Prompt Studio és Scene DNA.
Egyes haladó eszközökhöz külön node vagy külső függőség kell.

Helyi MI-segítő: promptfinomítás, fordítás, jelenetjavaslat, képből prompt
megfelelő látómodellel. A javaslat csak kérésre alkalmazódik. Az opcionális
9B, DeepSeek nevű Qwen3.5-származék kb. 7 GB külön letöltés. Nem hivatalos
DeepSeek V4, és nem tanít ügynököt. A modell tévedhet.

AUTOMATIKUS TÁMOGATÁS
SD 1.x, SD 2.x, SDXL, FLUX.1, Krea 2, MOSS, H3 és LTX 2.5 meghatározott
betöltési ágai, a megfelelő telepített komponensekkel. H3/LTX esetén a
külön generálómodell/UNET ág szükséges; az LTX automatikus ág LTX 2.5-re
készült. A család felismerése nem jelenti minden változat támogatását.
FLUX.2 és más nem támogatott ágak megfelelő saját workflow-val használhatók.
Ismeretlen LoRA-családhoz külön haladó döntés kell; igazoltan eltérő család
nem válik kompatibilissé. A ComfyUI frissítése a felhasználó döntése.

MENTÉSI HELYEK
Alapból a ComfyUI output mappáján belül:
  ArtofTomworks/CreatorHub/Images/ÉÉÉÉ-HH-NN/
  ArtofTomworks/CreatorHub/Videos/ÉÉÉÉ-HH-NN/
Az egyéni közös kimeneti mappa ettől eltérhet. Az eredmény útvonala, másolása
és mappamegnyitása az adott fájlt követi. A Hub data mappája őrzi a jegyzéket,
projekteket és sorokat; a média a ComfyUI kimenetében van. Mindkettőről készíts
mentést. A projektfájl nem minden elkészült média teljes biztonsági másolata.
A megszakított/befejezetlen elemek külön szűrhetők. A végleges törlés nem
visszavonható, a lomtárba tett eredmény visszaállítható.

FONTOS MŰHELYINFÓ
A Videóstúdió a videó másolatával dolgozik. Az elkészült szerkesztést ott
exportáld és töltsd le; a stúdióexport még nem kerül automatikusan a Hub
előzményeibe. RIFE és AI-felskálázás a megfelelő külön node-ot és modellt
igényli; a támogatott CPU-utómunkák ettől függetlenek.
Scene DNA esetén a változatlan, már elkészült snitt újrahasználható. Öt
tervezett snittből ezért négy ÚJ fájl is keletkezhet, miközben az ötödik a
korábbi eredményt használja! A snittenkénti állapotot és fájlhelyet nézd.

HELYI MŰKÖDÉS ÉS TELJESÍTMÉNY
Az alapfelület helyi. Az online modellkeresés/letöltés/frissítésellenőrzés
a kiválasztott szolgáltatót éri el. A helyi MI Ollamát használ, a generálás
elsőbbséget kap a GPU-memóriánál. A memóriaprofil nem tesz végtelenül nagy
modellt futtathatóvá kis kártyán. Az előnézet pontossága és sebessége
modelltől/node-tól függ. Szüneteltetése csökkenti az előnézet feldolgozását,
de nem tölti ki a generálómodellt a memóriából.

FRISSÍTÉS
Fejezd be vagy állítsd le a munkát, készíts mentést a data mappáról és a
médiáról. Két Hub ne fusson ugyanazzal az adatmappával. Az új csomagba a
mentett data mappát csak mindkét példány leállítása után vidd át. A régi
telepítést tartsd meg biztonsági másolatként. Újraindítás után böngészőfrissítés.

BÉTAKORLÁTOK ÉS LICENC
Nem minden modell, node és telepítés támogatott. Az automatikus tesztek
ellenőrzött háttérrel futnak; néhány valódi helyi modell/MI/utómunka útvonal
külön is kipróbált. Minden gépen azonos sebességet nem ígérünk.
Hibajelzéshez verzió, modellcsalád, művelet és a másolható hiba kell;
személyes adatokat előbb távolíts el. A helyi szervert ne tedd ki az internetre.
Ingyenes személyes és kereskedelmi alkotói használat: LICENSE.txt.
A program továbbértékesítése korlátozott; a külső komponensek licence külön él.
Támogatás: https://ko-fi.com/artoftomworks
GitHub: https://github.com/artoftomworks-debug/artoftomworks-creator-hub

SAMPLER, SCHEDULER ÉS FRISSÍTÉS
A kapcsolók, modellbeállítások és biztonságos frissítés leírása: UPDATE_HU.txt.
