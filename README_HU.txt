ARTOFTOMWORKS CREATOR HUB GLOBAL
0.17.0 — Nyilvános béta — 2026. november 24.

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
   A fekete ablak csak indulás közben látszik. Utána a szerver a háttérben
   fut, az óra melletti tálcaikonnal (megnyitás, újraindítás, leállítás,
   napló). Ugyanezt kínálja a jobb alsó ⏻ Hub gomb is.
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

SZOFTVERFRISSÍTÉSEK ÉS NODE-CSOMAGOK
A fejléc Frissítések gombján vagy a funkciókeresőben (Ctrl+K) érhető el.
A Hub közzétett kiadásait (a Public Betát is) és a ComfyUI stabil kiadásait
12 órás gyorsítótárral ellenőrzi. Ez a két kártya jelez és a kiadáshoz vezet;
a Hubot és a ComfyUI-t nem telepíti automatikusan. A motorverziót a kiválasztott,
kezelt ComfyUI-mappából olvassa. Külső vagy ismeretlen telepítésnél nem találgat.

A node-csomagok kereshető, lapozható listát és frissítési szűrőt kaptak.
Jelöld ki a csomagokat vagy az összes szűrt találatot, majd Kijelöltek frissítése.
A listát áttekintve egyetlen Mentés és frissítés indítja a teljes csoportot.
Csak ismert GitHub-forrású, változatlan helyi ág frissíthető. Minden csomagról
ellenőrzött Git-mentés készül, majd csak egyenes ágon előrelépő frissítés történik.
A helyi módosítások és a figyelmen kívül hagyott saját fájlok megmaradnak.
Csomagonként látszik a folyamat, a kihagyás vagy hiba oka; a napló másolható.
Megállítható az aktuális csomag befejezése után.

Függőségfájl, telepítőszkript vagy almodul változásakor a csomag még a kód
módosítása ELŐTT kimarad és külön jelzést kap. Nem fut pip vagy install.py,
a Python-környezet nem változik. Az ilyen csomag külön telepítési ellenőrzést
igényel; a kihagyást nem jelzi sikeres frissítésnek.

Az eredményválasztóban az utolsó tíz művelet látható. A visszaállításhoz
a pontosan frissített verzió, ugyanaz a forrás/ág és tiszta helyi fájlok kellenek.
A mentések és a napló a data/node-update-backups és node-update-jobs.json
helyen találhatók. A mentés a Gitben követett programkódot és történetét őrzi,
nem a generált képeket vagy a Python-környezetet. A régi mentéseket nem törli
automatikusan.

A Motor újraindítása külön, felhasználói művelet, kizárólag üres feladatsornál
és a Hub által felügyelt motoron. Külső motort a saját indítójával kell
újraindítani. Csomagváltoztatás közben új generálás nem indítható.

Az ellenőrzés legfeljebb húsz GitHub-forrást kérdez le egyszerre, háromperces
kézi várakozással. A kimaradtak legközelebb előre kerülnek; a már igazolt
eredmények a korábbi ellenőrzési dátummal megmaradnak. Alkalmazás előtt
a helyi verziót, az ágat és a forrást újra ellenőrzi. A külön másolt csomagok,
az ismeretlen forrás, a hálózati hiba és az eltérő fejlesztési ág külön jelzést
kap. A naprakész állapot önmagában nem kompatibilitási ígéret minden workflow-ra.

A pyproject.toml puszta projektverzió-változása nem blokkolja a frissítést;
a tényleges függőség- és buildváltozás külön kezelendő. A befejezési összesítés
mutatja a frissített, kihagyott és sikertelen csomagok számát. A helyi
módosítások részletei felsorolják az érintett fájlokat.

JELENETFOLYTATÁS
A kész videó alatt Következő jelenetrész; jelenetsor, változatok és közös vágóasztal.
Részletek: SCENE_CONTINUATION_HU.txt

CIVITAI MODELLKERESÉS
NSFW-besorolású modellek név szerinti kereséséhez kapcsold be az erre szolgáló
jelölőt. Pontos modellhez civitai.com/civitai.red link vagy Civitai modell-ID
is beilleszthető. A forrás hozzáférési feltételei és kulcskérése továbbra is
érvényesek; a besorolás nem a modellcsaládot jelenti. A forrás Checkpoint
címkéje mellett a Hub MOSS-nál generálómodell célmappát választhat.

MODELLFORRÁS-KULCSOK MEGJEGYZÉSE
A modellböngésző Forráshoz hozzáférési kulcs részében jelöld be a Megjegyzés
ezen a Windows-fiókon kapcsolót, majd Kulcs mentése / használata. A Windows
DPAPI titkosítja a kulcsot; újraindítás után azonos Windows-fiókkal betölti.
Tárolás: data/model-credentials.dpapi.json, kizárólag védett tartalommal.
Másik gépen/fiókkal újra meg kell adni. Más rendszeren csak munkameneti
használat érhető el. A Kulcs elfelejtése törli a kiválasztott szolgáltatás
kulcsát; a modelleket és letöltési feladatokat nem törli. A sikertelen feladat
Folytatás / újrapróbálás gombja a kulcs mentése után használható. A forrás
jogosultsági feltételeit a mentett kulcs sem helyettesíti.

MODELLBÉLYEGKÉPEK
A Hub letöltéskor a kiválasztott verzió előnézeti képét is megpróbálja elmenteni.
Ha a forrás nem ad használható képet, a modell ettől még letöltődik.
Saját kép utólag: modellkártya ☰ → Bélyegkép hozzáadása / cseréje, vagy Részletek.
PNG, JPEG és WebP választható, legfeljebb 24 MiB; a Hub legfeljebb 640 pixeles
JPEG-et ment a modell mellé. A saját bélyegkép elsőbbséget kap, automatikus
forráskép-letöltés nem írja felül. A modell súlyfájlja nem módosul.

ÚJ A 0.16-BAN ÉS A 0.17-BEN
- Több modellel: ugyanaz a prompt több kép- vagy videómodellel (és
  formátumban) egy indítással, sorozatsáv szünettel/folytatással/
  megszakítással, rácsnézet (modellek × seedek), a végén opcionális helyi
  MI-kiértékelés.
- Kétlépcsős LTX 2.5 saját workflow-k (fél felbontású alap → 2× látens
  felskálázás → finomítás). Bármely eredmény pontos workflow-ja elmenthető az
  Előzményekből, vagy egy kattintással visszatölthető.
- Jelenetek: „Következő jelenet” asszisztens, storyboard kisfilm-exporttal
  (áttűnés, zene), karakterkönyv, változat-családfa.
- Ötlettár (Alt+I): szöveg és kép, címkék; ötletből kép- vagy videóprompt,
  vagy küldés a storyboardba.
- Hang: hangterv (környezeti hang, zene, egy kimondott mondat) a hangot is
  adó modellekhez (LTX 2.5, MiniMax H3); hangeszköz kész videókhoz (be- és
  kiúsztatás, hangerő, hangerő-kiegyenlítés, háttérzene ducking-gal).
- Kezdőkép-figyelő: a Generálás mellett jelzi, ha bent maradt kezdőkép;
  indítás előtt csak akkor kérdez, ha a prompt sokat változott vagy a kép
  régi. A „Több modellel” indítás is használja.
- Kamera: tükrözött élő kép, 3 mp visszaszámlálás, három kép; kezdőképnek,
  videóhoz, karakterkönyvbe vagy stílussal.
- Témák és háttérkép (⚙ Beállítások), kényelmes nagyítás (A− / A+).
- Vészkapcsoló (gomb a fejlécben vagy Ctrl+Alt+H): minden képet és videót
  elmos, a lejátszást némítja, amíg vissza nem kapcsolod.
- Önjavítás memóriahiánynál, automatikus memóriaürítés modellváltáskor,
  ablak nélküli szerver tálcaikonnal és sok kisebb javítás.

PROFILOK ÉS SZÜLŐI FELÜGYELET (OPCIONÁLIS, ALAPBÓL KI)
⚙ → Profilok bekapcsolása. Az első profil a rendszergazda, övé minden eddigi
adat. Minden profilnak saját jelszava, előzményei, piszkozata és ötletei vannak;
a további profilok kimeneti almappába (Profil_<név>) is mentenek. Gyerekprofilnál csak a kiválasztott
modellek használhatók, a LoRA és az MI-segítő külön engedélyezhető, a promptot
többnyelvű szószűrő ellenőrzi. Ismert korlátok: a profilok közös generálási
sort használnak, így egy gyerekprofil is megállíthatja; a fájlok a lemezen a
közös kimeneti mappában vannak. A szülői felügyelet a Hub felületét védi; nem
helyettesíti a Windows-fiókokat és a felügyeletet.

KÍSÉRŐ WORKFLOW-K
A workflows mappában önálló LTX 2.5 képből videó workflow-k vannak
(Vázlat → Végleges és Simple, angolul és magyarul). ComfyUI-ban önállóan is
futnak, a Hubban a Workflow betöltése gombbal tölthetők be. Lásd:
workflows/README_HU.md.
