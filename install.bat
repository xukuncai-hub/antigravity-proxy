@echo off
chcp 65001 >nul
title Google Antigravity 智能代理适配安装助手

echo =======================================================
echo   Google Antigravity 智能代理适配与专线加速引擎
echo   (突破底层 Go 核心代理限制，免 TUN 模式 / 免全局模式)
echo =======================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Python 环境！请先安装 Python 3 并将其添加到系统 PATH。
    echo 官方下载地址: https://www.python.org/
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js 环境！请先安装 Node.js。
    echo 官方下载地址: https://nodejs.org/
    pause
    exit /b 1
)

python "%~dp0install.py" %*

echo.
echo 按任意键退出...
pause >nul
