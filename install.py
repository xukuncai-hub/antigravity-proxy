#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Antigravity 智能代理适配与专线加速引擎 (一键安装/还原脚本)
项目地址: https://github.com/xukuncai-hub/antigravity-proxy
"""

import os
import sys
import json
import shutil
import platform
import subprocess
import argparse
from pathlib import Path

# 确保 Windows 下终端输出 UTF-8，防止 GBK 编码崩溃
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

VERSION = "1.0.2"

# ANSI 颜色定义
COLOR_RESET = "\033[0m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"
COLOR_RED = "\033[31m"
COLOR_CYAN = "\033[36m"
COLOR_BOLD = "\033[1m"


def print_info(msg):
    print(f"{COLOR_CYAN}[信息]{COLOR_RESET} {msg}")


def print_success(msg):
    print(f"{COLOR_GREEN}{COLOR_BOLD}[成功]{COLOR_RESET} {msg}")


def print_warn(msg):
    print(f"{COLOR_YELLOW}[警告]{COLOR_RESET} {msg}")


def print_error(msg):
    print(f"{COLOR_RED}{COLOR_BOLD}[错误]{COLOR_RESET} {msg}")


def is_antigravity_running():
    """检查 Antigravity 进程是否在运行"""
    try:
        if platform.system() == "Windows":
            out = subprocess.check_output(
                ["tasklist", "/fi", "imagename eq Antigravity.exe", "/fo", "csv"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            return "Antigravity.exe" in out
        else:
            out = subprocess.check_output(
                ["pgrep", "-i", "antigravity"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            return bool(out.strip())
    except Exception:
        return False


def detect_asar_path():
    """根据操作系统自动探测 Antigravity resources/app.asar 路径"""
    os_name = platform.system()
    home = Path.home()
    candidates = []

    if os_name == "Linux":
        candidates = [
            home / ".local/share/Antigravity/resources/app.asar",
            Path("/opt/antigravity/resources/app.asar"),
            Path("/opt/Antigravity/resources/app.asar"),
            Path("/usr/lib/antigravity/resources/app.asar"),
        ]
    elif os_name == "Darwin":  # macOS
        candidates = [
            Path("/Applications/Antigravity.app/Contents/Resources/app.asar"),
            home / "Applications/Antigravity.app/Contents/Resources/app.asar",
        ]
    elif os_name == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        program_files = os.environ.get("ProgramFiles")
        if local_app_data:
            candidates.append(
                Path(local_app_data) / "Programs/Antigravity/resources/app.asar"
            )
            candidates.append(
                Path(local_app_data) / "Programs/antigravity/resources/app.asar"
            )
        if program_files:
            candidates.append(
                Path(program_files) / "Antigravity/resources/app.asar"
            )
            candidates.append(
                Path(program_files) / "antigravity/resources/app.asar"
            )

    for p in candidates:
        if p.is_file():
            return p

    return None


def ensure_asar_cli():
    """确保 asar 工具可用（兼容 Windows .cmd 扩展与 UNIX）"""
    asar = shutil.which("asar")
    if asar:
        return [asar]
    npx = shutil.which("npx")
    if npx:
        return [npx, "--yes", "@electron/asar"]
    return None


def run_cmd(cmd, cwd=None):
    res = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"命令执行失败: {' '.join(cmd)}\n{res.stderr}")
    return res.stdout


def patch_files(extract_dir, src_dir):
    """注入网络代理自适应加速引擎"""
    proxy_patch_file = src_dir / "proxy_patch.js"
    if not proxy_patch_file.is_file():
        raise FileNotFoundError(f"未找到补丁文件 {proxy_patch_file}")

    # 1. 注入 dist/languageServer.js
    ls_file = extract_dir / "dist/languageServer.js"
    if ls_file.is_file():
        ls_code = ls_file.read_text(encoding="utf-8")
        if "ANTIGRAVITY PROXY AUTO-CONFIGURATION START" not in ls_code:
            patch_path_json = json.dumps(proxy_patch_file.resolve().as_posix())
            ls_path_json = json.dumps(ls_file.resolve().as_posix())
            script = f"""
const fs = require('fs');
const patch = require({patch_path_json});
let code = fs.readFileSync({ls_path_json}, 'utf8');
code = patch.applyLanguageServer(code);
fs.writeFileSync({ls_path_json}, code, 'utf8');
"""
            subprocess.run(["node", "-e", script], check=True)
            print_info("已注入 LanguageServer 网络代理自适应加速引擎 (dist/languageServer.js)")
        else:
            print_info("dist/languageServer.js 代理自适应加速引擎已就绪")

    # 2. 注入 dist/main.js
    main_file = extract_dir / "dist/main.js"
    if main_file.is_file():
        main_code = main_file.read_text(encoding="utf-8")
        if "ANTIGRAVITY MAIN PROXY START" not in main_code:
            patch_path_json = json.dumps(proxy_patch_file.resolve().as_posix())
            main_path_json = json.dumps(main_file.resolve().as_posix())
            script = f"""
const fs = require('fs');
const patch = require({patch_path_json});
let code = fs.readFileSync({main_path_json}, 'utf8');
code = patch.applyMain(code);
fs.writeFileSync({main_path_json}, code, 'utf8');
"""
            subprocess.run(["node", "-e", script], check=True)
            print_info("已注入主进程网络代理自适应引擎 (dist/main.js)")
        else:
            print_info("dist/main.js 主进程代理引擎已就绪")


def patch_clash_rules():
    """自动检测并配置 Clash / Clash Verge 规则与 DNS，彻底解决必须开启全局模式的问题"""
    try:
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return

        verge_dirs = [
            Path(appdata) / "io.github.clash-verge-rev.clash-verge-rev",
            Path(appdata) / "clash_verge"
        ]

        antigravity_rules = [
            "DOMAIN-SUFFIX,googleapis.com,{group}",
            "DOMAIN-SUFFIX,google.com,{group}",
            "DOMAIN-SUFFIX,gstatic.com,{group}",
            "DOMAIN-SUFFIX,googleusercontent.com,{group}",
            "DOMAIN-SUFFIX,run.app,{group}",
            "DOMAIN-SUFFIX,appspot.com,{group}",
            "DOMAIN-SUFFIX,antigravity.google,{group}",
            "DOMAIN-KEYWORD,cloudcode,{group}",
            "DOMAIN-KEYWORD,antigravity,{group}",
            "DOMAIN-KEYWORD,google,{group}",
        ]

        dns_domains = [
            "+.google.com",
            "+.googleapis.com",
            "+.gstatic.com",
            "+.googleusercontent.com",
            "+.run.app",
            "+.appspot.com",
            "+.antigravity.google"
        ]

        for vdir in verge_dirs:
            profiles_yaml = vdir / "profiles.yaml"
            if not profiles_yaml.is_file():
                continue

            try:
                import yaml
                has_yaml = True
            except ImportError:
                has_yaml = False

            if not has_yaml:
                continue

            with open(profiles_yaml, "r", encoding="utf-8") as f:
                pdata = yaml.safe_load(f)
            if not isinstance(pdata, dict):
                continue

            current_uid = pdata.get("current")
            items = pdata.get("items", [])
            current_item = next((item for item in items if item.get("uid") == current_uid), None)

            proxy_group = "🚀 节点选择"
            if current_item and current_item.get("file"):
                profile_file = vdir / "profiles" / current_item["file"]
                if profile_file.is_file():
                    try:
                        with open(profile_file, "r", encoding="utf-8") as pf:
                            pcontent = yaml.safe_load(pf)
                            groups = [g.get("name") for g in pcontent.get("proxy-groups", []) if isinstance(g, dict)]
                            for g in groups:
                                if any(k in g for k in ["节点", "PROXY", "Proxy", "选择"]):
                                    proxy_group = g
                                    break
                            else:
                                if groups:
                                    proxy_group = groups[0]
                    except Exception:
                        pass

            # 1. 规则增强模板 (rules template)
            rules_uid = current_item.get("option", {}).get("rules") if current_item else None
            rules_item = next((it for it in items if it.get("uid") == rules_uid), None)
            rules_file = vdir / "profiles" / rules_item["file"] if (rules_item and rules_item.get("file")) else None
            if not rules_file or not rules_file.is_file():
                fallback_item = next((it for it in items if it.get("type") == "rules"), None)
                if fallback_item and fallback_item.get("file"):
                    rules_file = vdir / "profiles" / fallback_item["file"]

            if rules_file and rules_file.is_file():
                try:
                    with open(rules_file, "r", encoding="utf-8") as rf:
                        rf_data = yaml.safe_load(rf) or {}
                    prepend_list = rf_data.get("prepend") or []
                    added = 0
                    for r_tmpl in antigravity_rules:
                        rule_entry = r_tmpl.format(group=proxy_group)
                        if rule_entry not in prepend_list:
                            prepend_list.append(rule_entry)
                            added += 1
                    rf_data["prepend"] = prepend_list
                    with open(rules_file, "w", encoding="utf-8") as rf:
                        yaml.dump(rf_data, rf, allow_unicode=True, sort_keys=False)
                    if added > 0:
                        print_info(f"已自动为 Clash Verge 注入 {added} 条 Antigravity 专线分流规则 (免开全局模式)")
                except Exception:
                    pass

            # 2. DNS 防污染模板 (merge template)
            merge_uid = current_item.get("option", {}).get("merge") if current_item else None
            merge_item = next((it for it in items if it.get("uid") == merge_uid), None)
            merge_file = vdir / "profiles" / merge_item["file"] if (merge_item and merge_item.get("file")) else None
            if merge_file and merge_file.is_file():
                try:
                    with open(merge_file, "r", encoding="utf-8") as mf:
                        mf_data = yaml.safe_load(mf) or {}
                    dns_dict = mf_data.get("dns") or {}
                    fb_dict = dns_dict.get("fallback-filter") or {}
                    domain_list = fb_dict.get("domain") or []
                    dns_added = 0
                    for d in dns_domains:
                        if d not in domain_list:
                            domain_list.append(d)
                            dns_added += 1
                    fb_dict["domain"] = domain_list
                    dns_dict["fallback-filter"] = fb_dict
                    mf_data["dns"] = dns_dict
                    with open(merge_file, "w", encoding="utf-8") as mf:
                        yaml.dump(mf_data, mf, allow_unicode=True, sort_keys=False)
                    if dns_added > 0:
                        print_info(f"已自动为 Clash Verge 配置 DNS 防污染 (安全直连 Google/Antigravity)")
                except Exception:
                    pass
    except Exception:
        pass


def install(asar_path):
    print_info(f"目标 app.asar 路径: {asar_path}")
    asar_cmd = ensure_asar_cli()
    if not asar_cmd:
        print_error("未检测到 asar 或 npx 工具！请确保已安装 Node.js。")
        print_info("安装方法: https://nodejs.org/")
        sys.exit(1)

    if is_antigravity_running():
        print_warn("⚠️  检测到 Antigravity 正在运行。")
        print_warn("建议在安装完成后【完全退出并重启软件】（含右下角系统托盘）以使补丁生效！")

    resources_dir = asar_path.parent
    backup_path = resources_dir / "app.asar.proxy_bak"

    # 备份原文件
    if not backup_path.exists():
        print_info(f"正在备份原始文件到: {backup_path}")
        shutil.copy2(asar_path, backup_path)
    else:
        print_info(f"已检测到原版备份: {backup_path} (保留不变)")

    # 准备工作临时目录
    temp_dir = Path("/tmp/antigravity_proxy_patch") if platform.system() != "Windows" else Path(os.environ.get("TEMP", ".")) / "antigravity_proxy_patch"
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

    extracted_dir = temp_dir / "extracted"
    output_asar = temp_dir / "app.asar"

    script_dir = Path(__file__).resolve().parent
    src_dir = script_dir / "src"

    try:
        print_info("正在解包 app.asar...")
        run_cmd(asar_cmd + ["extract", str(asar_path), str(extracted_dir)])

        print_info("正在注入网络代理自适应加速引擎...")
        patch_files(extracted_dir, src_dir)

        print_info("正在重新打包 app.asar...")
        run_cmd(asar_cmd + ["pack", str(extracted_dir), str(output_asar), "--unpack-dir", "node_modules/chrome-devtools-mcp"])

        print_info("正在替换并应用新版本...")
        shutil.copy2(output_asar, asar_path)

        # 智能适配 Clash Verge 分流规则 (免 TUN 模式 & 免全局模式)
        patch_clash_rules()

        unpacked_src = temp_dir / "app.asar.unpacked"
        unpacked_dest = resources_dir / "app.asar.unpacked"
        if unpacked_src.exists() and unpacked_dest.exists():
            shutil.copytree(unpacked_src, unpacked_dest, dirs_exist_ok=True)

        print_success("网络代理自适应引擎安装成功！🎉")
        print_info("提示: 您现在可以关闭 TUN 模式并切换为规则模式。")
        print_info("请重新启动 Antigravity 即可生效。")
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


def restore(asar_path):
    resources_dir = asar_path.parent
    backup_path = resources_dir / "app.asar.proxy_bak"
    if not backup_path.exists():
        backup_path = resources_dir / "app.asar.bak"
    if not backup_path.exists():
        print_error(f"未找到备份文件，无法执行还原。")
        sys.exit(1)

    print_info(f"正在从备份文件还原: {backup_path} -> {asar_path}")
    shutil.copy2(backup_path, asar_path)
    print_success("已成功还原为修改前版本！🎉")
    print_info("重启 Antigravity 即可生效。")


def main():
    print(f"\n{COLOR_CYAN}{COLOR_BOLD}=== Google Antigravity 智能代理适配与专线加速引擎 v{VERSION} ==={COLOR_RESET}\n")

    parser = argparse.ArgumentParser(description="Antigravity 网络代理智能适配安装脚本 (免 TUN / 免全局)")
    parser.add_argument("--path", type=str, help="手动指定 app.asar 的文件绝对路径")
    parser.add_argument("--restore", action="store_true", help="还原为修改前原版")
    args = parser.parse_args()

    asar_path = Path(args.path) if args.path else detect_asar_path()
    if not asar_path or not asar_path.is_file():
        print_error("未自动找到 Antigravity 的 app.asar 文件！")
        print_info("请使用 --path 参数手动指定路径，例如:")
        print_info("python3 install.py --path ~/.local/share/Antigravity/resources/app.asar")
        sys.exit(1)

    if args.restore:
        restore(asar_path)
    else:
        install(asar_path)


if __name__ == "__main__":
    main()
