# Antigravity Auto-Patch & Proxy Launcher (Portable)
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PassThruArgs
)

$ErrorActionPreference = "SilentlyContinue"

$SrcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent $SrcDir
$Marker = "Antigravity Proxy Auto-Configuration & PAC Helper"

# Locate Antigravity installation
$Candidates = @()
if ($env:LOCALAPPDATA) {
    $Candidates += Join-Path $env:LOCALAPPDATA "Programs\Antigravity"
    $Candidates += Join-Path $env:LOCALAPPDATA "Programs\antigravity"
}
if ($env:ProgramFiles) {
    $Candidates += Join-Path $env:ProgramFiles "Antigravity"
    $Candidates += Join-Path $env:ProgramFiles "antigravity"
}

$AppDir = $Candidates | Where-Object { Test-Path (Join-Path $_ "Antigravity.exe") } | Select-Object -First 1
if (-not $AppDir) { exit 1 }

$AppExe = Join-Path $AppDir "Antigravity.exe"
$AsarPath = Join-Path $AppDir "resources\app.asar"

# 1. Check if app.asar still has the proxy patch; if overwritten by an update, re-inject silently
if (Test-Path $AsarPath) {
    $isPatched = Select-String -Path $AsarPath -Pattern $Marker -SimpleMatch -Quiet
    if (-not $isPatched) {
        if (Get-Command node -ErrorAction SilentlyContinue) {
            & node (Join-Path $RepoDir "install.js") --path $AsarPath --no-shortcut *> $null
        } elseif (Get-Command python -ErrorAction SilentlyContinue) {
            & python (Join-Path $RepoDir "install.py") --path $AsarPath --no-shortcut *> $null
        }
    }
}

# 2. Inject Windows system proxy env vars into this Antigravity process tree
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    $props = Get-ItemProperty -Path $regPath -ErrorAction Stop
    if ($props.ProxyEnable -eq 1 -and $props.ProxyServer) {
        $raw = $props.ProxyServer.Trim()
        if ($raw -match "(?:https?|socks)=([^;]+)") {
            $raw = $Matches[1]
        }
        if ($raw -notmatch "^(https?|socks5?)://") {
            $raw = "http://$raw"
        }
        $env:HTTP_PROXY = $raw
        $env:HTTPS_PROXY = $raw
        $env:NO_PROXY = "localhost,127.0.0.1,::1"
    }
} catch {}

# 3. Launch Antigravity
if ($PassThruArgs -and $PassThruArgs.Count -gt 0) {
    Start-Process -FilePath $AppExe -ArgumentList $PassThruArgs
} else {
    Start-Process -FilePath $AppExe
}
