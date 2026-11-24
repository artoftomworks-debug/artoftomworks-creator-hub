# 0.16 DEV — ArtofTomworks Creator Hub tálcaikon (az óra mellett).
# Megnyitás · Újraindítás · ComfyUI indítása/leállítása · Minden leállítása · Napló. Ha a Hub 30 másodpercig nem válaszol (leállt), az ikon magától eltűnik.
param([int]$Port = 18901, [string]$Root = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$trayLog = Join-Path $Root 'data\logs\tray.log'
trap { try { ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] HIBA: ' + $_.Exception.Message + ' @ ' + $_.InvocationInfo.PositionMessage) | Out-File -LiteralPath $trayLog -Append -Encoding utf8 } catch {}; exit 1 }
('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] Tálca: PowerShell ' + $PSVersionTable.PSVersion + ' elindult') | Out-File -LiteralPath $trayLog -Append -Encoding utf8
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$sha = [System.Security.Cryptography.SHA1]::Create()
$key = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToLowerInvariant())))).Replace('-', '').Substring(0, 16)
$created = $false
$mutex = [System.Threading.Mutex]::new($true, ('Local\ArtofTomworksCreatorHubTray_' + $key), [ref]$created)
if (-not $created) { ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] Tálca: már fut egy ikon, ez kilép') | Out-File -LiteralPath $trayLog -Append -Encoding utf8; exit 0 }

# Nyelv: a Hub felületén választott nyelv (data\ui-language.json – a Hub írja nyelvváltáskor); ha még nincs, angol.
$uiLangFile = Join-Path $Root 'data\ui-language.json'
function Read-Lang { try { $j = Get-Content -LiteralPath $uiLangFile -Raw -Encoding UTF8 | ConvertFrom-Json; $l = ([string]$j.lang).ToUpperInvariant(); if (@('HU','EN','DE','FR','ES','IT','PT','PL') -contains $l) { return $l } } catch {}; return 'EN' }
$Lang = Read-Lang
$S = @{
    'open' = @{ HU = 'Creator Hub megnyitása'; EN = 'Open Creator Hub'; DE = 'Creator Hub öffnen'; FR = 'Ouvrir Creator Hub'; ES = 'Abrir Creator Hub'; IT = 'Apri Creator Hub'; PT = 'Abrir Creator Hub'; PL = 'Otwórz Creator Hub' }
    'restart' = @{ HU = 'Újraindítás'; EN = 'Restart'; DE = 'Neu starten'; FR = 'Redémarrer'; ES = 'Reiniciar'; IT = 'Riavvia'; PT = 'Reiniciar'; PL = 'Uruchom ponownie' }
    'restarting' = @{ HU = 'A Hub újraindul… A nyitott oldal magától frissül.'; EN = 'The Hub is restarting… The open page refreshes by itself.'; DE = 'Der Hub startet neu… Die offene Seite lädt von selbst neu.'; FR = 'Le Hub redémarre… La page ouverte se rafraîchit toute seule.'; ES = 'El Hub se está reiniciando… La página abierta se actualiza sola.'; IT = 'L’’Hub si sta riavviando… La pagina aperta si aggiorna da sola.'; PT = 'O Hub está a reiniciar… A página aberta atualiza-se sozinha.'; PL = 'Hub uruchamia się ponownie… Otwarta strona odświeży się sama.' }
    'askAfter' = @{ HU = 'Újraindítsam, amint a futó munka véget ér?'; EN = 'Restart as soon as the current work finishes?'; DE = 'Neu starten, sobald die laufende Arbeit fertig ist?'; FR = 'Redémarrer dès que le travail en cours est terminé ?'; ES = '¿Reiniciar en cuanto termine el trabajo actual?'; IT = 'Riavviare appena termina il lavoro in corso?'; PT = 'Reiniciar assim que o trabalho atual terminar?'; PL = 'Uruchomić ponownie po zakończeniu bieżącej pracy?' }
    'scheduled' = @{ HU = 'Újraindítás betervezve: a futó munka után.'; EN = 'Restart scheduled: after the current work.'; DE = 'Neustart geplant: nach der laufenden Arbeit.'; FR = 'Redémarrage planifié : après le travail en cours.'; ES = 'Reinicio programado: después del trabajo actual.'; IT = 'Riavvio pianificato: dopo il lavoro in corso.'; PT = 'Reinício agendado: depois do trabalho atual.'; PL = 'Restart zaplanowany: po bieżącej pracy.' }
    'external' = @{ HU = 'A ComfyUI-t nem a Hub kezeli (külső motor).'; EN = 'ComfyUI is not managed by the Hub (external engine).'; DE = 'ComfyUI wird nicht vom Hub verwaltet (externe Engine).'; FR = 'ComfyUI n’’est pas géré par le Hub (moteur externe).'; ES = 'ComfyUI no lo gestiona el Hub (motor externo).'; IT = 'ComfyUI non è gestito dall’’Hub (motore esterno).'; PT = 'O ComfyUI não é gerido pelo Hub (motor externo).'; PL = 'ComfyUI nie jest zarządzany przez Hub (silnik zewnętrzny).' }
    'notOwned' = @{ HU = 'Ezt a ComfyUI-t nem a Hub indította, ezért nem állítom le.'; EN = 'This ComfyUI was not started by the Hub, so I won’’t stop it.'; DE = 'Dieser ComfyUI wurde nicht vom Hub gestartet, daher beende ich ihn nicht.'; FR = 'Ce ComfyUI n’’a pas été lancé par le Hub, je ne l’’arrête donc pas.'; ES = 'Este ComfyUI no lo inició el Hub, así que no lo detengo.'; IT = 'Questo ComfyUI non è stato avviato dall’’Hub, quindi non lo arresto.'; PT = 'Este ComfyUI não foi iniciado pelo Hub, por isso não o paro.'; PL = 'Ten ComfyUI nie został uruchomiony przez Hub, więc go nie zatrzymuję.' }
    'askStopComfy' = @{ HU = "Leállítsam a ComfyUI-t?`n`nA betöltött modellek kikerülnek a memóriából. A Hub tovább fut, a következő generálás újraindítja."; EN = "Stop ComfyUI?`n`nThe loaded models leave memory. The Hub keeps running; the next generation starts it again."; DE = "ComfyUI beenden?`n`nDie geladenen Modelle werden aus dem Speicher entfernt. Der Hub läuft weiter; die nächste Generierung startet ihn neu."; FR = "Arrêter ComfyUI ?`n`nLes modèles chargés quittent la mémoire. Le Hub continue ; la prochaine génération le relance."; ES = "¿Detener ComfyUI?`n`nLos modelos cargados salen de la memoria. El Hub sigue funcionando; la próxima generación lo reinicia."; IT = "Arrestare ComfyUI?`n`nI modelli caricati escono dalla memoria. L’Hub resta attivo; la prossima generazione lo riavvia."; PT = "Parar o ComfyUI?`n`nOs modelos carregados saem da memória. O Hub continua; a próxima geração volta a iniciá-lo."; PL = "Zatrzymać ComfyUI?`n`nZaładowane modele zostaną usunięte z pamięci. Hub działa dalej; następne generowanie uruchomi go ponownie." }
    'comfyStopped' = @{ HU = 'A ComfyUI leállt.'; EN = 'ComfyUI has stopped.'; DE = 'ComfyUI wurde beendet.'; FR = 'ComfyUI est arrêté.'; ES = 'ComfyUI se ha detenido.'; IT = 'ComfyUI è stato arrestato.'; PT = 'O ComfyUI parou.'; PL = 'ComfyUI został zatrzymany.' }
    'comfyStarting' = @{ HU = 'A ComfyUI indul… (a modellek betöltése eltarthat egy ideig)'; EN = 'ComfyUI is starting… (loading the models may take a while)'; DE = 'ComfyUI startet… (das Laden der Modelle kann dauern)'; FR = 'ComfyUI démarre… (le chargement des modèles peut prendre un moment)'; ES = 'ComfyUI se está iniciando… (cargar los modelos puede tardar)'; IT = 'ComfyUI si sta avviando… (il caricamento dei modelli può richiedere un po’’)'; PT = 'O ComfyUI está a iniciar… (carregar os modelos pode demorar)'; PL = 'ComfyUI się uruchamia… (ładowanie modeli może chwilę potrwać)' }
    'st_ready' = @{ HU = 'fut'; EN = 'running'; DE = 'läuft'; FR = 'en marche'; ES = 'en marcha'; IT = 'in esecuzione'; PT = 'em execução'; PL = 'działa' }
    'st_starting' = @{ HU = 'indul…'; EN = 'starting…'; DE = 'startet…'; FR = 'démarrage…'; ES = 'iniciando…'; IT = 'avvio…'; PT = 'a iniciar…'; PL = 'uruchamianie…' }
    'st_stopping' = @{ HU = 'leáll…'; EN = 'stopping…'; DE = 'wird beendet…'; FR = 'arrêt…'; ES = 'deteniéndose…'; IT = 'arresto…'; PT = 'a parar…'; PL = 'zatrzymywanie…' }
    'st_stopped' = @{ HU = 'áll'; EN = 'stopped'; DE = 'gestoppt'; FR = 'arrêté'; ES = 'detenido'; IT = 'fermo'; PT = 'parado'; PL = 'zatrzymany' }
    'st_error' = @{ HU = 'hiba'; EN = 'error'; DE = 'Fehler'; FR = 'erreur'; ES = 'error'; IT = 'errore'; PT = 'erro'; PL = 'błąd' }
    'extShort' = @{ HU = 'külső'; EN = 'external'; DE = 'extern'; FR = 'externe'; ES = 'externo'; IT = 'esterno'; PT = 'externo'; PL = 'zewnętrzny' }
    'extMenu' = @{ HU = 'ComfyUI: külső motor'; EN = 'ComfyUI: external engine'; DE = 'ComfyUI: externe Engine'; FR = 'ComfyUI : moteur externe'; ES = 'ComfyUI: motor externo'; IT = 'ComfyUI: motore esterno'; PT = 'ComfyUI: motor externo'; PL = 'ComfyUI: silnik zewnętrzny' }
    'stopSuffix' = @{ HU = ' — leállítás'; EN = ' — stop'; DE = ' — beenden'; FR = ' — arrêter'; ES = ' — detener'; IT = ' — arresta'; PT = ' — parar'; PL = ' — zatrzymaj' }
    'startSuffix' = @{ HU = ' — indítás'; EN = ' — start'; DE = ' — starten'; FR = ' — démarrer'; ES = ' — iniciar'; IT = ' — avvia'; PT = ' — iniciar'; PL = ' — uruchom' }
    'notOwnedShort' = @{ HU = ' (nem a Hub indította)'; EN = ' (not started by the Hub)'; DE = ' (nicht vom Hub gestartet)'; FR = ' (pas lancé par le Hub)'; ES = ' (no lo inició el Hub)'; IT = ' (non avviato dall’’Hub)'; PT = ' (não iniciado pelo Hub)'; PL = ' (nie uruchomiony przez Hub)' }
    'stopAll' = @{ HU = 'Minden leállítása (Hub + ComfyUI)'; EN = 'Stop everything (Hub + ComfyUI)'; DE = 'Alles beenden (Hub + ComfyUI)'; FR = 'Tout arrêter (Hub + ComfyUI)'; ES = 'Detener todo (Hub + ComfyUI)'; IT = 'Arresta tutto (Hub + ComfyUI)'; PT = 'Parar tudo (Hub + ComfyUI)'; PL = 'Zatrzymaj wszystko (Hub + ComfyUI)' }
    'askStopAll' = @{ HU = "Leállítsam a Hubot és az általa indított ComfyUI-t?`n`nÚjra a START_CREATOR_HUB.cmd-vel indítható."; EN = "Stop the Hub and the ComfyUI it started?`n`nStart it again with START_CREATOR_HUB.cmd."; DE = "Hub und den von ihm gestarteten ComfyUI beenden?`n`nNeustart mit START_CREATOR_HUB.cmd."; FR = "Arrêter le Hub et le ComfyUI qu’il a lancé ?`n`nRelance avec START_CREATOR_HUB.cmd."; ES = "¿Detener el Hub y el ComfyUI que inició?`n`nSe vuelve a iniciar con START_CREATOR_HUB.cmd."; IT = "Arrestare l’Hub e il ComfyUI che ha avviato?`n`nSi riavvia con START_CREATOR_HUB.cmd."; PT = "Parar o Hub e o ComfyUI que ele iniciou?`n`nVolta a iniciar com START_CREATOR_HUB.cmd."; PL = "Zatrzymać Hub i uruchomiony przez niego ComfyUI?`n`nPonowne uruchomienie: START_CREATOR_HUB.cmd." }
    'askForce' = @{ HU = 'Leállítás most? A futó munka megszakad és elvész.'; EN = 'Stop now? The running work is interrupted and lost.'; DE = 'Jetzt beenden? Die laufende Arbeit wird abgebrochen und geht verloren.'; FR = 'Arrêter maintenant ? Le travail en cours est interrompu et perdu.'; ES = '¿Detener ahora? El trabajo en curso se interrumpe y se pierde.'; IT = 'Arrestare ora? Il lavoro in corso viene interrotto e perso.'; PT = 'Parar agora? O trabalho em curso é interrompido e perdido.'; PL = 'Zatrzymać teraz? Bieżąca praca zostanie przerwana i utracona.' }
    'openLog' = @{ HU = 'Napló megnyitása'; EN = 'Open log'; DE = 'Protokoll öffnen'; FR = 'Ouvrir le journal'; ES = 'Abrir registro'; IT = 'Apri registro'; PT = 'Abrir registo'; PL = 'Otwórz dziennik' }
    'noLog' = @{ HU = 'Még nincs napló.'; EN = 'No log yet.'; DE = 'Noch kein Protokoll.'; FR = 'Pas encore de journal.'; ES = 'Aún no hay registro.'; IT = 'Ancora nessun registro.'; PT = 'Ainda não há registo.'; PL = 'Brak dziennika.' }
    'hide' = @{ HU = 'Ikon elrejtése (a Hub tovább fut)'; EN = 'Hide icon (the Hub keeps running)'; DE = 'Symbol ausblenden (der Hub läuft weiter)'; FR = 'Masquer l’’icône (le Hub continue)'; ES = 'Ocultar icono (el Hub sigue funcionando)'; IT = 'Nascondi icona (l’’Hub resta attivo)'; PT = 'Ocultar ícone (o Hub continua)'; PL = 'Ukryj ikonę (Hub działa dalej)' }
    'running' = @{ HU = 'fut'; EN = 'running'; DE = 'läuft'; FR = 'en marche'; ES = 'en marcha'; IT = 'in esecuzione'; PT = 'em execução'; PL = 'działa' }
    'noResponse' = @{ HU = 'nem válaszol'; EN = 'not responding'; DE = 'antwortet nicht'; FR = 'ne répond pas'; ES = 'no responde'; IT = 'non risponde'; PT = 'não responde'; PL = 'nie odpowiada' }
}
function T([string]$Key) { $e = $S[$Key]; if (-not $e) { return $Key }; $v = $e[$Lang]; if (-not $v) { $v = $e['EN'] }; return [string]$v }

$base = 'http://127.0.0.1:' + $Port
$title = 'ArtofTomworks Creator Hub'
$logFile = Join-Path $Root 'data\logs\hub.log'

function Invoke-Hub([string]$Path, $Body = @{}) {
    try {
        return Invoke-RestMethod -Uri ($base + '/api/' + $Path) -Method Post -Body ($Body | ConvertTo-Json -Compress) -ContentType 'application/json; charset=utf-8' -TimeoutSec 10
    } catch {
        $msg = $_.Exception.Message
        try { $j = $_.ErrorDetails.Message | ConvertFrom-Json; if ($j.error) { $msg = $j.error } } catch {}
        throw $msg
    }
}
function Ask([string]$Text, [string]$Icon = 'Question') {
    return [System.Windows.Forms.MessageBox]::Show([string]$Text, [string]$title, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]$Icon, [System.Windows.Forms.MessageBoxDefaultButton]::Button2, [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly) -eq [System.Windows.Forms.DialogResult]::Yes
}
function Tell([string]$Text, [string]$Icon = 'Information') {
    $script:tray.ShowBalloonTip(4000, $title, $Text, [System.Windows.Forms.ToolTipIcon]$Icon)
}

# Simple gold round icon with an "A"
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 197, 132))), 1, 1, 30, 30)
$g.DrawString('A', (New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(19, 38, 48))), 5, 1)
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon
$tray.Text = $title + ' · ' + (T 'running')
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$open = $menu.Items.Add((T 'open'))
$open.Font = New-Object System.Drawing.Font($open.Font, [System.Drawing.FontStyle]::Bold)
$open.add_Click({ Start-Process $base })
$tray.add_MouseDoubleClick({ Start-Process $base })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$restart = $menu.Items.Add((T 'restart'))
$restart.add_Click({
    try { [void](Invoke-Hub 'hub/restart'); Tell (T 'restarting') }
    catch {
        $m = "$_"
        if ($m -match 'Most nem') {
            if (Ask ($m + "`n`n" + (T 'askAfter'))) {
                try { $r = Invoke-Hub 'hub/restart' @{ when = 'after' }; Tell (T 'scheduled') } catch { Tell "$_" 'Warning' }
            }
        } else { Tell $m 'Warning' }
    }
})

# ComfyUI: állapot és külön indítás/leállítás (a Hub újraindításakor a ComfyUI tovább fut).
$script:engine = $null
$comfy = $menu.Items.Add('ComfyUI: …')
$comfy.add_Click({
    $e = $script:engine
    if (-not $e -or $e.mode -ne 'managed') { Tell (T 'external') 'Warning'; return }
    if ($e.state -eq 'ready') {
        if (-not $e.owned) { Tell (T 'notOwned') 'Warning'; return }
        if (-not (Ask (T 'askStopComfy') 'Warning')) { return }
        try { [void](Invoke-Hub 'engine/stop'); Tell (T 'comfyStopped') } catch { Tell "$_" 'Warning' }
    } elseif ($e.state -eq 'stopped' -or $e.state -eq 'error') {
        try { [void](Invoke-Hub 'engine/start'); Tell (T 'comfyStarting') } catch { Tell "$_" 'Warning' }
    }
})
function Update-Comfy {
    $e = $null
    try { $e = Invoke-RestMethod -Uri ($base + '/api/engine/status') -TimeoutSec 4 } catch {}
    $script:engine = $e
    $names = @{ ready = (T 'st_ready'); starting = (T 'st_starting'); stopping = (T 'st_stopping'); stopped = (T 'st_stopped'); error = (T 'st_error') }
    if (-not $e -or -not $e.enabled -or $e.mode -ne 'managed') { $comfy.Text = (T 'extMenu'); $comfy.Enabled = $false; return (T 'extShort') }
    $n = $names[[string]$e.state]; if (-not $n) { $n = [string]$e.state }
    $comfy.Enabled = $true
    if ($e.state -eq 'ready') { $comfy.Text = 'ComfyUI: ' + $n + (T 'stopSuffix'); if (-not $e.owned) { $comfy.Text = 'ComfyUI: ' + $n + (T 'notOwnedShort'); $comfy.Enabled = $false } }
    elseif ($e.state -eq 'stopped' -or $e.state -eq 'error') { $comfy.Text = 'ComfyUI: ' + $n + (T 'startSuffix') }
    else { $comfy.Text = 'ComfyUI: ' + $n; $comfy.Enabled = $false }
    return $n
}
$menu.add_Opening({ $script:Lang = Read-Lang; $open.Text = (T 'open'); $restart.Text = (T 'restart'); $stop.Text = (T 'stopAll'); $log.Text = (T 'openLog'); $hide.Text = (T 'hide'); [void](Update-Comfy) })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$stop = $menu.Items.Add((T 'stopAll'))
$stop.add_Click({
    if (-not (Ask (T 'askStopAll') 'Warning')) { return }
    try { [void](Invoke-Hub 'hub/stop') }
    catch {
        $m = "$_"
        if ($m -match 'Most nem') {
            if (-not (Ask ($m + "`n`n" + (T 'askForce')) 'Warning')) { return }
            try { [void](Invoke-Hub 'hub/stop' @{ force = $true }) } catch { Tell "$_" 'Warning'; return }
        } else { Tell $m 'Warning'; return }
    }
    $script:tray.Visible = $false; [System.Windows.Forms.Application]::Exit()
})

$log = $menu.Items.Add((T 'openLog'))
$log.add_Click({ if (Test-Path -LiteralPath $logFile) { Start-Process notepad.exe -ArgumentList ('"' + $logFile + '"') } else { Tell (T 'noLog') 'Warning' } })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$hide = $menu.Items.Add((T 'hide'))
$hide.add_Click({ $script:tray.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$tray.ContextMenuStrip = $menu
$tray.Visible = $true
('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] Tálcaikon elindult (port ' + $Port + ')') | Out-File -LiteralPath $trayLog -Append -Encoding utf8

# Health watch: tooltip, and leave when the Hub is gone for 30 s (stopped from the page or crashed).
$script:downSince = $null
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({
    $ok = $false
    try { $h = Invoke-RestMethod -Uri ($base + '/api/health') -TimeoutSec 2; $ok = ($h.app -eq 'artoftomworks.creator-hub') } catch {}
    if ($ok) { $script:downSince = $null; $c = Update-Comfy; $t = 'Creator Hub · ' + (T 'running') + ' · ComfyUI: ' + $c; if ($t.Length -gt 63) { $t = $t.Substring(0, 63) }; $script:tray.Text = $t }
    else {
        if (-not $script:downSince) { $script:downSince = Get-Date }
        $script:tray.Text = $title + ' · ' + (T 'noResponse')
        if (((Get-Date) - $script:downSince).TotalSeconds -ge 30) { $script:tray.Visible = $false; [System.Windows.Forms.Application]::Exit() }
    }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
$timer.Stop(); $tray.Dispose(); $mutex.ReleaseMutex()
