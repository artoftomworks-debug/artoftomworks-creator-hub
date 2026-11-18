param([string]$NodeExe = '', [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
try {
    if (-not $NodeExe) {
        $candidates = @((Join-Path $PSScriptRoot 'runtime\node.exe'), (Join-Path (Split-Path $PSScriptRoot -Parent) 'art-of-tomworks-prompt-studio\tools\node-portable\node.exe'))
        $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($installedNode) { $candidates += $installedNode.Source }
        foreach ($candidate in $candidates) {
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $ver = & $candidate --version
                if ($LASTEXITCODE -eq 0 -and $ver -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) { $NodeExe = $candidate; break }
            }
        }
    }
    if (-not $NodeExe) { throw 'Node.js 22+ is required. No runtime is downloaded automatically.' }
    $ver = & $NodeExe --version
    if ($LASTEXITCODE -ne 0 -or $ver -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw 'Node.js 22+ is required.' }
    Write-Host "ArtofTomworks Creator Hub Global - Public Beta ($ver)"
    if ($CheckOnly) { return }
    $restartHelper = Join-Path $PSScriptRoot 'Restart-CreatorHub.ps1'
    if (Test-Path -LiteralPath $restartHelper) {
        . $restartHelper
        $serverText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'server.mjs') -Raw -Encoding UTF8
        if ($serverText -notmatch "export const VERSION='([^']+)'") { throw 'The local Hub version could not be read.' }
        $expectedHubVersion = $Matches[1]
        $null = Restart-HubIfIdle -Root $PSScriptRoot -ExpectedVersion $expectedHubVersion
    }
    & $NodeExe (Join-Path $PSScriptRoot 'server.mjs') --open
    if ($LASTEXITCODE -ne 0) { throw 'The local server stopped with an error.' }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
