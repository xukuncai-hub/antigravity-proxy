# Google Antigravity 智能代理适配安装助手 (PowerShell)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到 Python 3 环境，请先安装 Python 并配置 PATH！" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到 Node.js 环境，请先安装 Node.js！" -ForegroundColor Red
    exit 1
}

python "$ScriptDir\install.py" @args
