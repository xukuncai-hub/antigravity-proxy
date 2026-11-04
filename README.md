# Google Antigravity 智能代理适配与专线加速引擎 (Antigravity Proxy)

<p align="center">
  <b>突破底层 Go 核心代理限制 · 免 TUN 虚拟网卡 · 免全局模式 · 支持系统代理与规则模式 (Rule Mode)</b><br>
  专为在中国大陆网络环境下使用 Google Antigravity 的开发者打造
</p>

<p align="center">
  <a href="#-痛点与背景">痛点剖析</a> •
  <a href="#-核心特性">核心特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-工作原理">实现原理</a> •
  <a href="#-一键还原">一键还原</a> •
  <a href="#-常见问题">常见问题</a>
</p>

---

## 🧐 痛点与背景

许多开发者在使用 Google Antigravity 时，经常遇到以下困扰：
- ❌ **每次使用都必须开启“虚拟网卡 (TUN) 模式”**：普通开启客户端的“系统代理”完全不起作用，只要不开虚拟网卡，Antigravity 就报错断连；
- ❌ **每次使用都必须开启“全局 (Global) 模式”**：切换回常用的“规则模式 (Rule Mode)”后，经常提示连接失败或对话无法发出；
- ❌ **严重影响日常网络**：开了全局模式导致微信、B站、百度等国内网页极其缓慢；开启虚拟网卡还会与各类 VPN、企业内网客户端或工控虚拟网卡（如 Siemens PLCSIM）发生严重驱动级冲突。

### 为什么会出现这个问题？

1. **底层通信核心不读取系统代理**：
   Antigravity 的核心大脑是 Go 语言编译的二进制程序 `language_server.exe`。Go 官方网络库（`net/http`）**绝不读取 Windows 注册表中的“系统代理 (WinINet)”**，它只识别 `HTTP_PROXY` / `HTTPS_PROXY` 等环境变量。因此在没有专门环境变量时，它会绕过代理直接向 Google 接口发起底层裸 TCP 直连并被网络墙阻断。过去只有开启 TUN 虚拟网卡强行劫持整机 L3 数据包才能抓取它的流量。
2. **规则模式缺乏专线分流与 DNS 污染**：
   订阅规则未对 `daily-cloudcode-pa.googleapis.com`、`generativelanguage.googleapis.com`、`*.run.app`、`antigravity.google` 等接口设置专线分流，国内 DNS 解析被劫持污染，导致连接中断。

---

## ✨ 核心特性

- 🚀 **智能感知本地与系统代理**：以 `<30ms` 极速自动检测 Windows 代理注册表及本地常用代理端口（如 Clash Verge `7897`、Clash `7890`、v2rayN `10809` 等）；
- 🔌 **动态注入核心进程网络环境**：在 Antigravity 派生 `language_server.exe` 核心进程时精准注入标准代理环境变量，Electron 会话层自动接管，直接走标准的 HTTP CONNECT 隧道代理；
- 🛡️ **彻底摆脱 TUN 虚拟网卡**：无需安装或开启虚拟网卡驱动，不占用网络适配器，绝不与 VPN 或工业虚拟网卡冲突；
- 🌐 **完美支持“规则模式 (Rule Mode)”**：自动为 Clash Verge 注入最高优先级专线分流规则与 DNS 防污染，国内网站满速直连，开发与日常互不干扰；
- 💻 **全平台兼容与无痛还原**：自动备份原版文件，支持一键安全还原。

---

## 🚀 快速开始

### 前置要求
- 已安装 **Google Antigravity**；
- 系统已安装 **Python 3** 与 **Node.js / npx**。

### 方式一：一键自动安装（推荐）

#### 🪟 Windows
1. 克隆或下载本项目：
```powershell
git clone https://github.com/xukuncai-hub/antigravity-proxy.git
cd antigravity-proxy
```
2. 直接**双击运行目录下的 `install.bat`** 即可一键完成全套注入与规则优化！

*也可以打开 PowerShell 执行 `.\install.ps1`。*

#### 🐧 Linux / 🍎 macOS
```bash
git clone https://github.com/xukuncai-hub/antigravity-proxy.git
cd antigravity-proxy
chmod +x install.sh
./install.sh
```

---

## 🎯 安装后的使用姿势

安装完成后，您可以直接恢复到最舒服的日常代理状态：

1. **Clash Verge / 代理客户端设置**：
   - **关闭**【TUN 模式 / 虚拟网卡】；
   - **切换为**【规则模式 (Rule)】；
   - **保持开启**【系统代理】。
2. **重启生效**：
   - 在系统托盘中彻底退出 Antigravity（右键退出）；
   - 重新打开 Antigravity，即可在规则模式和普通系统代理下享受秒级极速响应！

---

## 📦 手动安装（免环境依赖）

如果你没有 Node.js 环境，可以直接前往 **[Releases 页面](https://github.com/xukuncai-hub/antigravity-proxy/releases)** 下载预构建的 `app.asar`，替换 Antigravity 安装目录下的 `resources/app.asar` 即可。

---

## 🔄 一键还原

如果你希望恢复为修改前的官方文件：

```bash
python install.py --restore
```
或直接将 `resources/app.asar.proxy_bak` 覆盖回 `resources/app.asar`。

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。
