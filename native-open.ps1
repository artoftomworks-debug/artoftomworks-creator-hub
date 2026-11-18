param([Parameter(Mandatory=$true)][string]$TargetBase64,[switch]$Directory,[string]$ReportPath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
function Write-Result($value) {
    $json=$value | ConvertTo-Json -Compress
    if($ReportPath){[IO.File]::WriteAllText($ReportPath,$json,(New-Object Text.UTF8Encoding($false)))}
    Write-Output $json
}
try {
    $target=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TargetBase64))
    if (-not (Test-Path -LiteralPath $target)) { throw 'A fájl vagy mappa már nem található.' }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HubExplorer {
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern int SHParseDisplayName(string name, IntPtr context, out IntPtr pidl, uint attributes, out uint found);
 [DllImport("shell32.dll")] static extern int SHOpenFolderAndSelectItems(IntPtr folder, uint count, IntPtr items, uint flags);
 [DllImport("shell32.dll")] static extern IntPtr ILFindLastID(IntPtr pidl);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern Microsoft.Win32.SafeHandles.SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(Microsoft.Win32.SafeHandles.SafeFileHandle handle,System.Text.StringBuilder text,uint size,uint flags);
 public static string Canonical(string path){using(var h=CreateFile(path,0,7,IntPtr.Zero,3,0x02000000,IntPtr.Zero)){if(h.IsInvalid)return path.TrimEnd('\\');var b=new System.Text.StringBuilder(32768);if(GetFinalPathNameByHandle(h,b,(uint)b.Capacity,0)==0)return path.TrimEnd('\\');return b.ToString().Replace("\\\\?\\UNC\\","\\\\").Replace("\\\\?\\","").TrimEnd('\\');}}
 public static void Open(string folder, string file) {
  IntPtr parent=IntPtr.Zero, item=IntPtr.Zero, items=IntPtr.Zero;uint attributes;
  try {
   Marshal.ThrowExceptionForHR(SHParseDisplayName(folder,IntPtr.Zero,out parent,0,out attributes));
   if(file!=null){Marshal.ThrowExceptionForHR(SHParseDisplayName(file,IntPtr.Zero,out item,0,out attributes));items=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(items,ILFindLastID(item));}
   Marshal.ThrowExceptionForHR(SHOpenFolderAndSelectItems(parent,file==null?0u:1u,items,0));
  } finally {if(items!=IntPtr.Zero)Marshal.FreeHGlobal(items);if(item!=IntPtr.Zero)Marshal.FreeCoTaskMem(item);if(parent!=IntPtr.Zero)Marshal.FreeCoTaskMem(parent);}
 }
}
'@
    $folder=if($Directory){$target}else{[IO.Path]::GetDirectoryName($target)}
    $file=if($Directory){$null}else{$target}
    [HubExplorer]::Open($folder,$file)
    $shell=New-Object -ComObject Shell.Application
    $verified=$false;$selected=$false;$canonicalFolder=[HubExplorer]::Canonical($folder)
    for($attempt=0;$attempt -lt 36;$attempt++) {
        foreach($window in $shell.Windows()) {
            try {
                $location=$window.Document.Folder.Self.Path
                if($location -and [HubExplorer]::Canonical($location) -ieq $canonicalFolder) {
                    $hwnd=[IntPtr][long]$window.HWND
                    if([HubExplorer]::IsIconic($hwnd)){[void][HubExplorer]::ShowWindow($hwnd,9)}
                    if(-not [HubExplorer]::IsWindowVisible($hwnd)){[void][HubExplorer]::ShowWindow($hwnd,5)}
                    if([HubExplorer]::IsWindowVisible($hwnd)){
                        if(-not $Directory){try{$item=$window.Document.Folder.ParseName([IO.Path]::GetFileName($target));$window.Document.SelectItem($item,29);foreach($selection in $window.Document.SelectedItems()){if([HubExplorer]::Canonical($selection.Path) -ieq [HubExplorer]::Canonical($target)){$selected=$true;break}}}catch{}}
                        [void][HubExplorer]::SetForegroundWindow($hwnd)
                        $verified=$true
                    }
                }
            } catch {}
            if($verified){break}
        }
        if($verified){break}
        # Windows 11 can reuse a background tab; a folder open is a safe fallback.
        if($attempt -eq 16){$shell.Open($folder)}
        Start-Sleep -Milliseconds 200
    }
    if(-not $verified){throw 'Az Explorer ablaka nem igazolta vissza a megnyitást. Indítsd a Hubot a START_CREATOR_HUB.cmd fájllal a saját Windows-asztalodon; az útvonal a Másolás gombbal is elérhető.'}
    Write-Result @{opened=$true;visible=$true;selected=$selected}
} catch {
    Write-Result @{error=$_.Exception.Message}
    exit 1
}
