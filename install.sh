#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 &>/dev/null; then
    echo "[错误] 未检测到 python3，请先安装 Python 3 环境。"
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js 环境。"
    exit 1
fi

python3 "$SCRIPT_DIR/install.py" "$@"
