# ArtofTomworks Creator Hub 0.17.1 — Singularity

Helyi kép- és videóalkotó munkafelület ComfyUI-hoz, egy vagy több modellel. A nyilvános kiadás első indításkor angol. A magyar felületet a Settings → Language menüben választhatod ki.

## Újdonságok

- Külön többmodelles munkafelület saját promptmezőkkel, modellkártyákkal, családonkénti LoRákkal, modellenkénti ellenőrzéssel és promptátvitellel.
- Saját méretek mentése és visszahívása. A helyi MI a prompt alapján képarányt javasol, a felbontást a Hub számítja ki. Te döntesz az átvételről.
- MI-mozgásjavaslat, videós lépésszám-ajánlás és próbasor, recept-összevetés, storyboard-folytonosság és mintaképkockás videóértékelés.
- Internetes LoRA-keresés jóváhagyott keresőkifejezéssel. Az LTX 2.3 LoRák megjelenhetnek LTX 2.5-höz kipróbálható jelöltként.
- Közös generálás előtti ellenőrzés, érthető hibaablak, szűrt másolható jelentés és kérhető helyi MI-magyarázat.
- Hézagmentes Előzmények-rács soronként, oldalsó lapozónyilak, elrejthető és visszaállítható Új jelölések.
- Videószakasz cseréje külön generált klippel a Videóstúdióban. Az MI videónként legfeljebb hat mintaképkockát értékel.

## Indítás

Bontsd ki a teljes Windows ZIP-et, majd az alkalmazás mappájában indítsd a **START_CREATOR_HUB.cmd** fájlt. A Windows csomag tartalmazza a Node.js futtatókörnyezetet, a GitHub-forrásnál Node.js 22 vagy újabb szükséges. A ComfyUI-t, modelleket és az opcionális Ollamát külön kell telepíteni vagy csatlakoztatni. A vizuális MI-funkcióhoz képet is értő modell szükséges.

Első indításkor üres a munkaterület. A régi telepítésed maradjon külön mappában, és készíts mentést, ha később adatokat viszel át. A használat során létrejövő data mappát ne töltsd fel nyilvánosan.
