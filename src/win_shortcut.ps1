# Hook or restore Windows Desktop / Start Menu shortcuts for Antigravity
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("install", "restore")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$AsarPath,

    [string]$VbsPath
)

$ErrorActionPreference = "Stop"

$ResourcesDir = Split-Path -Parent $AsarPath
$AppDir = Split-Path -Parent $ResourcesDir
$ExePath = Join-Path $AppDir "Antigravity.exe"

if (-not (Test-Path $ExePath)) {
    exit 0
}

$SearchDirs = @()
$DesktopDir = [Environment]::GetFolderPath("Desktop")
if ($DesktopDir -and (Test-Path $DesktopDir)) { $SearchDirs += $DesktopDir }
$StartMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
if (Test-Path $StartMenuDir) { $SearchDirs += $StartMenuDir }

$WshShell = New-Object -ComObject WScript.Shell
$UpdatedCount = 0

foreach ($dir in $SearchDirs) {
    $links = Get-ChildItem -Path $dir -Filter "*Antigravity*.lnk" -Recurse -ErrorAction SilentlyContinue
    foreach ($lnk in $links) {
        try {
            $sc = $WshShell.CreateShortcut($lnk.FullName)
            $isOriginal = ($sc.TargetPath -ieq $ExePath)
            $isHooked = ($sc.TargetPath -like "*wscript.exe") -and ($sc.Arguments -like "*launch_antigravity.vbs*")

            if ($Action -eq "install" -and ($isOriginal -or $isHooked) -and $VbsPath) {
                $sc.TargetPath = "$env:WINDIR\System32\wscript.exe"
                $sc.Arguments = "`"$VbsPath`""
                $sc.WorkingDirectory = $AppDir
                $sc.IconLocation = "$ExePath,0"
                $sc.Save()
                $UpdatedCount++
                Write-Output "HOOKED:$($lnk.FullName)"
            } elseif ($Action -eq "restore" -and $isHooked) {
                $sc.TargetPath = $ExePath
                $sc.Arguments = ""
                $sc.WorkingDirectory = $AppDir
                $sc.IconLocation = "$ExePath,0"
                $sc.Save()
                $UpdatedCount++
                Write-Output "RESTORED:$($lnk.FullName)"
            }
        } catch {}
    }
}
