# Restart only an older, idle Creator Hub from this exact application folder.
function Get-HubLocalJson {
    param([string]$Url, [switch]$Optional, [switch]$Post)
    try {
        $uri = [Uri]$Url
        if ($uri.Scheme -ne 'http' -or -not $uri.IsLoopback) { throw 'Only local HTTP endpoints are allowed.' }
        $origin = $uri.GetLeftPart([System.UriPartial]::Authority)
        if ($Post) { return Invoke-RestMethod -Uri $Url -Method Post -Body '{}' -ContentType 'application/json' -Headers @{Origin=$origin} -TimeoutSec 8 -ErrorAction Stop }
        return Invoke-RestMethod -Uri $Url -Headers @{Origin=$origin} -TimeoutSec 4 -ErrorAction Stop
    } catch { if ($Optional) { return $null }; throw }
}
function Test-HubLocalPort {
    param([int]$Port)
    $socket = New-Object System.Net.Sockets.TcpClient
    try { $task = $socket.ConnectAsync('127.0.0.1',$Port); return [bool]($task.Wait(180) -and $socket.Connected) } catch { return $false } finally { $socket.Dispose() }
}
function Test-HubProcessMatch {
    param($Process, [string]$Root)
    if (-not $Process -or [IO.Path]::GetFileName($Process.ExecutablePath) -ine 'node.exe') { return $false }
    $entry = Join-Path $Root 'server.mjs'
    return [bool]($Process.CommandLine -match ('(?i)(?:^|[\s"])' + [regex]::Escape($entry) + '(?=$|[\s"])'))
}
function Get-HubServerProcess {
    param([int]$Port, [string]$Root)
    $rows = @(& netstat.exe -ano -p tcp)
    $pattern = '^\s*TCP\s+127\.0\.0\.1:' + $Port + '\s+\S+\s+LISTENING\s+(\d+)\s*$'
    $ids = @($rows | ForEach-Object { if ($_ -match $pattern) { [int]$Matches[1] } } | Select-Object -Unique)
    if ($ids.Count -ne 1) { throw 'A regi Hub folyamata nem azonosithato biztonsagosan. Zard be a regi Hub szerverablakat, majd inditsd ujra ezt az inditot.' }
    $hubProcessId = $ids[0]
    try { $entry = Get-CimInstance Win32_Process -Filter "ProcessId = $hubProcessId" -ErrorAction Stop } catch { throw 'A regi Hub folyamata innen nem ellenorizheto. Zard be a regi Hub szerverablakat, majd inditsd ujra ezt az inditot.' }
    if (-not (Test-HubProcessMatch -Process $entry -Root $Root)) { throw 'A portot masik program hasznalja. Nem allitom le.' }
    return $entry
}
function Stop-HubServerProcess {
    param([int]$ProcessId)
    Stop-Process -Id $ProcessId -ErrorAction Stop
}
function Assert-HubIdle {
    param([string]$Base, $Engine, [string]$Root)
    $nodeUpdates = Get-HubLocalJson -Url ($Base + '/api/updates/install/status') -Optional
    if ($nodeUpdates -and $nodeUpdates.active) { throw 'A node-csomagok frissitese meg folyamatban van. Vard meg a veget, majd inditsd ujra a Hubot.' }
    $queue = Get-HubLocalJson -Url ($Base + '/api/generation/status')
    if ($null -eq $queue -or -not ($queue.PSObject.Properties.Name -contains 'armed')) { throw 'A Hub feladatsora nem ellenorizheto. A regi peldanyt nem allitom le.' }
    if ($queue.armed -or @($queue.entries | Where-Object { $_.state -in @('running','waiting-cancel') }).Count) { throw 'A Hub meg dolgozik. Vard meg a futo munka veget, majd inditsd ujra ezt az inditot.' }
    $backend = $Engine.backend
    if (-not $backend) {
        $draftFile = Join-Path $Root 'data\draft.json'
        if (Test-Path -LiteralPath $draftFile) { $backend = (Get-Content -LiteralPath $draftFile -Raw -Encoding UTF8 | ConvertFrom-Json).backend }
    }
    if ($backend) {
        $uri = [Uri]$backend
        if ($uri.Scheme -ne 'http' -or -not $uri.IsLoopback) { throw 'A kulso motor feladatsora nem ellenorizheto biztonsagosan. Zard be kezzel a regi Hubot, ha a munka mar veget ert.' }
        $jobs = Get-HubLocalJson -Url ($backend.TrimEnd('/') + '/queue') -Optional
        if ($null -eq $jobs) {
            if ($Engine.state -in @('ready','starting','stopping')) { throw 'A motor allapota nem ellenorizheto. A regi Hubot nem allitom le.' }
        } else {
            if (-not ($jobs.PSObject.Properties.Name -contains 'queue_running') -or -not ($jobs.PSObject.Properties.Name -contains 'queue_pending')) { throw 'Ismeretlen motorvalasz. A regi Hubot nem allitom le.' }
            if (@($jobs.queue_running).Count -or @($jobs.queue_pending).Count) { throw 'A ComfyUI meg dolgozik vagy varakozo feladata van. A munka utan inditsd ujra ezt az inditot.' }
        }
    }
}
function Restart-HubIfIdle {
    param([string]$Root, [string]$ExpectedVersion)
    $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\','/')
    for ($port = 18901; $port -le 18910; $port++) {
        if (-not (Test-HubLocalPort -Port $port)) { continue }
        $base = 'http://127.0.0.1:' + $port
        $health = Get-HubLocalJson -Url ($base + '/api/health') -Optional
        if (-not $health -or $health.app -ne 'artoftomworks.creator-hub' -or -not $health.root) { continue }
        $remoteRoot = [IO.Path]::GetFullPath([string]$health.root).TrimEnd('\','/')
        if (-not [string]::Equals($resolvedRoot,$remoteRoot,[StringComparison]::OrdinalIgnoreCase)) { continue }
        if ($health.version -eq $ExpectedVersion) { return $false }
        try { $older = [version]$health.version -lt [version]$ExpectedVersion } catch { throw 'A futo Hub verzioja nem ellenorizheto. Nem allitom le.' }
        if (-not $older) { throw 'Ujabb Hub fut. A regi inditoval nem allitom vissza.' }
        $engine = Get-HubLocalJson -Url ($base + '/api/engine/status')
        if ($null -eq $engine) { throw 'A regi Hub motorallapota nem ellenorizheto.' }
        Assert-HubIdle -Base $base -Engine $engine -Root $resolvedRoot
        $target = Get-HubServerProcess -Port $port -Root $resolvedRoot
        Assert-HubIdle -Base $base -Engine $engine -Root $resolvedRoot
        Write-Host ('A regi, ures Hub frissitese: ' + $health.version + ' -> ' + $ExpectedVersion)
        if ($engine.owned) { $null = Get-HubLocalJson -Url ($base + '/api/engine/stop') -Post }
        Stop-HubServerProcess -ProcessId $target.ProcessId
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 150
            if ($null -eq (Get-HubLocalJson -Url ($base + '/api/health') -Optional)) { return $true }
        }
        throw 'A regi Hub meg nem zart be teljesen. Probald ujra az inditot egy pillanat mulva.'
    }
    return $false
}
