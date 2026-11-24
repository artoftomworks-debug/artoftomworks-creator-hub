$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Security
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.value -isnot [string] -or $request.value.Length -gt 20000) { throw 'Invalid input' }
    $entropy = [Text.Encoding]::UTF8.GetBytes('ArtofTomworks.CreatorHub.ModelCredentials.v1')
    $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
    if ($request.action -eq 'encrypt') {
        $bytes = [Text.Encoding]::UTF8.GetBytes($request.value)
        $result = [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, $scope))
    } elseif ($request.action -eq 'decrypt') {
        $bytes = [Convert]::FromBase64String($request.value)
        $result = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, $scope))
    } else { throw 'Invalid action' }
    [Console]::Out.Write((@{value=$result} | ConvertTo-Json -Compress))
} catch {
    # Never echo input, tokens, or cryptographic exception details.
    [Console]::Out.Write('{"error":"WINDOWS_CREDENTIAL_PROTECTION_FAILED"}')
    exit 1
}
