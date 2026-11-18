# Scene DNA 0.3 — Kivágástervező / Composition planner

## Magyar — első próba

1. A régi Scene DNA példányban ments projektfájlt. Az új példányban a **Projekt betöltése** gombbal nyisd meg. A korábbi próbamappa változatlanul megmarad. Ez önálló Scene DNA frissítés, nem Prompt Studio- vagy ComfyUI-telepítés.
2. Tölts be példát vagy készíts snittkártyákat. Adj hozzá egy közös referenciaképet vagy egy snitt saját eredményképét.
3. A snitt képénél válaszd a **Kivágás tervezése ↗** gombot. Külön, átméretezhető, nagy szerkesztőablak nyílik. Ha a böngésző blokkolja, engedélyezd az előugró ablakot ehhez a helyi laphoz. A fő lapot tartsd nyitva.
4. Ha mindkét kép rendelkezésre áll, a **Forráskép** listában választhatsz közülük. Először a közös referencia a forrás; ha csak eredmény van, az használható. A képet nem elemzi automatikusan.
5. A **Kezdő kivágás** az induló kompozíció. Húzd a keret belsejét az eltoláshoz, a sarkát az átméretezéshez. A projekt képaránya végig megmarad; a keret nem húzható a képen kívülre. A görgővel a kurzor körül nagyíthatsz, legfeljebb tízszeresre.
6. A **Fókuszpont jelölése** után kattints az általad fontosnak tartott részre. A **Keret mozgatása / méretezése** gombbal válthatsz vissza. A harmadolóvonalak kikapcsolhatók. A csúszkákkal finomíthatsz. Fókuszált képfelületen a nyilak mozgatnak, Shift+nyíl nagyobb lépés; + és − nagyít/kicsinyít.
7. Videóhoz kapcsold be a **Mozgó kivágás** opciót, majd állítsd be a **Záró kivágás** keretét. A **Kezdő átmásolása a záróhoz** jó kiindulópont. A **Javasolt kiindulópont** a snitt képkivágás- és kamerabeállításából ad sablont; nem képtartalomból dolgozik, és felülírja az ablak még nem alkalmazott tervét.
8. Az **Előnézet lejátszása** a két kivágás között, a snitt megadott időtartama alatt mozgatja a kétdimenziós nézetet, ismételve. Így ellenőrizhető, mi kerül a keretbe. Ez nem új videó, nem térbeli kameramozgás, és nem exportálható kész filmként.
9. **Alkalmazás a snittre**: ekkor kerül a terv a projektbe. A snitt alatt kezdő/záró bélyegkép jelenik meg; a promptok új kivágási leírást kapnak. A mozgó terv felülírja a snitt külön kameramozgás-választását, ezért az ilyenkor letiltott. Kép-promptba nem kerül mozgás. Módosult prompt esetén a régi fordítást ismét frissíteni kell.
10. **Mégse / bezárás**: az ablakban végzett új módosításokat elveti, a már alkalmazott tervet megtartja. A snitt **Kivágásterv törlése** gombja eltávolítja a tervet, így újra a korábbi képkivágás-/kameramezők érvényesülnek.

### Megőrzés és korlátok

- A Projekt mentése a képbélyegképekkel együtt elmenti a kivágásokat és fókuszpontot. A projektbetöltés és a böngésző teljes helyi mentése is visszaállítja őket. A csak szöveges tartalékmentés képet nem tartalmaz; a kép visszaadása szükséges.
- Referencia-/eredménykép vagy képarány változtatásakor a terv ellenőrzendővé válik, és kimarad a promptból. Nyisd meg újra a szerkesztőt, ellenőrizd és alkalmazd az új tervet. Régi szerkesztőablakból nem menthető rá az időközben megváltozott projektre.
- Ha a megjelölt fókuszpont valamelyik kereten kívülre esik, figyelmeztetést kapsz. Ez tudatos felfedésnél lehet szándékos, ezért nem tiltás.
- A kivágás szöveges tervezési támpont. Nem ControlNet-, pose- vagy depth-térkép; nem állítja be a generátort, és nem garantál pixelpontos modellkövetést. A mozgás síkbeli: nincs parallaxisa, új nézőpontja vagy a referencia szélén túli képtartalma.
- A munkakép legfeljebb 1280 képpontos előnézet. Nagyításkor az előnézet életlenedhet; az eredeti képfájl érintetlen. Gyártáshoz az eredetit használd a generátorodban.
- Maga a szerkesztő nem használ MI-modellt, hálózatot vagy generáló GPU-feladatot. Fordításhoz továbbra is külön helyi Ollama szükséges. Az új funkció NEW jelzése elrejthető.

A 0.4 indító automatikusan szabad helyi címet keres, ha a régi szerver még fut. Ilyenkor a mentett projektfájlt töltsd be az új címen. Más alkalmazást nem kell leállítani. Fordítás nélkül a START_OFFLINE.cmd használható.

## English — first try

1. Save a project in your previous Scene DNA copy and load it in the new one. The old preview folder is preserved. This is a standalone Scene DNA update, not a Prompt Studio or ComfyUI installation.
2. Load an example or create shot cards. Add a shared reference or a shot's own result image.
3. Click **Composition planner ↗** beside the shot image. A separate, resizable large editor opens. Allow popups for this local page if the browser blocks it. Keep the main page open.
4. Choose **Shared reference** or **Shot result** under Source image when both exist. The shared reference is the initial source; a result alone also works. No automatic image analysis is performed.
5. Set the **Start frame**. Drag inside the frame to move it; drag corners to resize. The project's aspect ratio is maintained, and the frame stays within the image. Wheel zoom is anchored near the cursor, up to 10×.
6. Select **Mark focus**, then click your point of interest. Switch back with **Move / resize frame**. Toggle the thirds grid and use the centre/zoom sliders for finer adjustments. On the focused canvas, arrow keys move the frame, Shift+arrow takes larger steps, and +/− zoom.
7. For video, enable **Animate framing** and adjust the **End frame**. **Copy start to end** gives a useful starting point. **Suggested starting point** uses the shot's framing/camera settings, not image understanding; it replaces this window's unsaved draft.
8. **Play preview** loops a 2D interpolation between the frames using the intended shot duration. It helps inspect what stays in view. It is not a generated video, a 3D camera simulation, or an exportable movie.
9. **Apply to shot** commits the plan. Start/end thumbnails appear on the card and the prompt's framing guidance updates. An animated plan replaces the separate camera-movement selection, which is disabled while the plan is active. Image prompts receive no motion instructions. Existing translations become stale when their source prompt changes and need refreshing.
10. **Cancel / close** discards this window's new changes, preserving an already applied plan. **Clear composition plan** on the card removes it and restores the regular framing/camera fields as the prompt source.

### Persistence and limits

- Project JSON stores the plan and focus together with working image thumbnails. Project import and full browser autosave restore them. The text-only fallback cannot restore missing images.
- Changing the source image or project aspect marks a plan for review and excludes it from prompts. Reopen the editor, check and apply the new plan. An old editor cannot overwrite a project/source that changed while it was open.
- A focus point outside a start/end frame raises an advisory warning; intentional reveals remain possible.
- This is textual composition guidance, not a ControlNet/pose/depth map or a generator setting. Pixel-exact model compliance is not guaranteed. The preview has no parallax, new viewpoint or content beyond the source image.
- Working thumbnails are at most 1280 pixels. Zooming may soften the preview; the original image file is untouched. Use the original in your generation tool.
- The editor requires no model inference, network access or generation task. Optional local translation still requires a separately installed local Ollama model. The new feature's NEW marker can be dismissed.

Version 0.4 startup finds a free local address if an older server is still running. Transfer your saved project file to the new address. Other applications need not be stopped. START_OFFLINE.cmd works without translation.
