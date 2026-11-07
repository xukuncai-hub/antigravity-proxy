@echo off
chcp 65001 >nul
title Google Antigravity 智能代理适配安装助手

echo =======================================================
echo   Google Antigravity 智能代理适配与专线加速引擎
echo   (突破底层 Go 核心代理限制，免 TUN 模式 / 免全局模式)
echo =======================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node "%~dp0install.js" %*
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python "%~dp0install.py" %*
    goto end
)

echo [错误] 未检测到 Node.js 或 Python 环境！
echo 请先安装 Node.js (推荐): https://nodejs.org/
echo 或安装 Python 3: https://www.python.org/
pause
exit /b 1

:end
echo.
echo 按任意键退出...
pause >nul
