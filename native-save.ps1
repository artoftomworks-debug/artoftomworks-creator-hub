param([Parameter(Mandatory=$true)][string]$NameBase64,[string]$FolderBase64='')
# 0.16 DEV — Windows "Save as" dialog for "Workflow mentése → Máshova…". Only returns the chosen path;
# the Hub writes the file itself and never overwrites an existing one.
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
function Write-Result($value){ Write-Output ($value | ConvertTo-Json -Compress) }
try {
    $name=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($NameBase64))
    $folder=if($FolderBase64){[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($FolderBase64))}else{''}
    Add-Type -AssemblyName System.Windows.Forms
    $owner=New-Object System.Windows.Forms.Form -Property @{TopMost=$true;ShowInTaskbar=$false;StartPosition='CenterScreen';Width=1;Height=1;Opacity=0;FormBorderStyle='None'}
    $dialog=New-Object System.Windows.Forms.SaveFileDialog
    $dialog.Title='Workflow mentése · ArtofTomworks Creator Hub'
    $dialog.Filter='ComfyUI workflow (*.json)|*.json'
    $dialog.FileName=$name
    $dialog.OverwritePrompt=$false
    $dialog.AddExtension=$true
    if($folder -and (Test-Path -LiteralPath $folder)){ $dialog.InitialDirectory=$folder }
    # Started without a console window: the very first Show() is turned into "hidden" by Windows, so show twice.
    $owner.Show(); $owner.Hide(); $owner.Show()
    # No compiled helper code here (Add-Type would write a temporary DLL that antivirus tools flag):
    # the TopMost owner keeps the dialog above the browser.
    $owner.BringToFront()
    $owner.Activate()
    $result=$dialog.ShowDialog($owner)
    $owner.Close()
    if($result -eq [System.Windows.Forms.DialogResult]::OK){ Write-Result @{chosen=$true;path=$dialog.FileName} } else { Write-Result @{chosen=$false} }
} catch { Write-Result @{chosen=$false;error=$_.Exception.Message}; exit 1 }
