// Antigravity Proxy Auto-Configuration & Built-in PAC Rule Engine Patch
// 解决痛点: 免除使用 Antigravity 必须开启“虚拟网卡 (TUN) 模式”与“全局 (Global) 模式”的强制限制。
// 原理: 自动智能感知本地/系统代理端口 (如 Clash Verge 7897 / Clash 7890 / v2rayN 10809)，
// 动态注入 language_server.exe 底层核心，并在 Electron 主进程会话层植入【内置 PAC 规则模式 (Built-in Rule Mode)】，
// 无论外界代理处于何种模式，反重力自身永远精准分流 (AI专线走代理，国内与本地强制直连)。

const helperCode = `
// ==========================================
// Antigravity Proxy Auto-Configuration & PAC Helper
// ==========================================
function isPortOpen(port, host = '127.0.0.1', timeout = 300) {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        let called = false;
        const done = (result) => {
            if (!called) {
                called = true;
                socket.destroy();
                resolve(result);
            }
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
    });
}

async function detectSystemProxyAsync() {
    try {
        const existing = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY ||
                         process.env.http_proxy || process.env.https_proxy || process.env.all_proxy;
        if (existing) {
            return existing.startsWith('http://') || existing.startsWith('socks5://') ? existing : \`http://\${existing}\`;
        }
        if (process.platform === 'win32') {
            const { execFileSync } = require('child_process');
            try {
                const out = execFileSync('reg', [
                    'query',
                    'HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Internet Settings'
                ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 1000 });
                const enabledMatch = out.match(/ProxyEnable\\s+REG_DWORD\\s+0x([0-9a-fA-F]+)/);
                const serverMatch = out.match(/ProxyServer\\s+REG_SZ\\s+([^\\r\\n]+)/);
                const isEnabled = enabledMatch ? parseInt(enabledMatch[1], 16) === 1 : false;
                let rawServer = serverMatch ? serverMatch[1].trim() : null;
                if (rawServer) {
                    let target = rawServer;
                    if (rawServer.includes('=')) {
                        const match = rawServer.match(/(?:https?|socks)=([^;]+)/i);
                        if (match) target = match[1];
                    }
                    const url = target.startsWith('http://') || target.startsWith('socks5://') ? target : \`http://\${target}\`;
                    if (isEnabled) return url;
                    const portMatch = target.match(/:(\\d+)$/);
                    if (portMatch && await isPortOpen(parseInt(portMatch[1], 10))) {
                        return url;
                    }
                }
            } catch (_) {}
        }
        const commonPorts = [7897, 7890, 7891, 10809, 10808];
        for (const port of commonPorts) {
            if (await isPortOpen(port)) {
                return \`http://127.0.0.1:\${port}\`;
            }
        }
    } catch (_) {}
    return null;
}

function generatePacScript(proxyUrl) {
    let pacProxy = 'PROXY 127.0.0.1:7897; DIRECT';
    try {
        const u = new URL(proxyUrl);
        if (u.protocol.startsWith('socks')) {
            pacProxy = \`SOCKS5 \${u.host}; SOCKS \${u.host}; DIRECT\`;
        } else {
            pacProxy = \`PROXY \${u.host}; DIRECT\`;
        }
    } catch (_) {
        if (proxyUrl.includes('://')) {
            const host = proxyUrl.split('://')[1].replace(/\\/.*$/, '');
            pacProxy = \`PROXY \${host}; DIRECT\`;
        }
    }

    return \`
function FindProxyForURL(url, host) {
    // 1. 本地主机与私有网络直连 (DIRECT)
    if (isPlainHostName(host) ||
        shExpMatch(host, "*.local") ||
        shExpMatch(host, "localhost") ||
        shExpMatch(host, "127.*") ||
        shExpMatch(host, "10.*") ||
        shExpMatch(host, "172.16.*") ||
        shExpMatch(host, "172.17.*") ||
        shExpMatch(host, "172.18.*") ||
        shExpMatch(host, "172.19.*") ||
        shExpMatch(host, "172.2*.*") ||
        shExpMatch(host, "172.3*.*") ||
        shExpMatch(host, "192.168.*") ||
        isInNet(host, "127.0.0.0", "255.0.0.0") ||
        isInNet(host, "10.0.0.0", "255.0.0.0") ||
        isInNet(host, "172.16.0.0", "255.240.0.0") ||
        isInNet(host, "192.168.0.0", "255.255.0.0")) {
        return "DIRECT";
    }

    // 2. Google / Antigravity / Gemini / CloudCode 专线核心域名
    if (
        shExpMatch(host, "*.googleapis.com") ||
        shExpMatch(host, "*.google.com") ||
        shExpMatch(host, "*.gstatic.com") ||
        shExpMatch(host, "*.googleusercontent.com") ||
        shExpMatch(host, "*.googlevideo.com") ||
        shExpMatch(host, "*.gcr.io") ||
        shExpMatch(host, "*.run.app") ||
        shExpMatch(host, "*.appspot.com") ||
        shExpMatch(host, "antigravity.google") ||
        shExpMatch(host, "*.antigravity.google") ||
        shExpMatch(host, "*.github.com") ||
        shExpMatch(host, "*.githubusercontent.com") ||
        shExpMatch(host, "*.anthropic.com") ||
        shExpMatch(host, "*.openai.com") ||
        shExpMatch(host, "*.ai.google.dev")
    ) {
        return "\${pacProxy}";
    }

    // 3. 国内常见开发与主流网络服务直连
    if (
        shExpMatch(host, "*.cn") ||
        shExpMatch(host, "*.aliyun.com") ||
        shExpMatch(host, "*.tencent.com") ||
        shExpMatch(host, "*.baidu.com") ||
        shExpMatch(host, "*.bilibili.com") ||
        shExpMatch(host, "*.zhihu.com") ||
        shExpMatch(host, "*.taobao.com") ||
        shExpMatch(host, "*.jd.com") ||
        shExpMatch(host, "*.netease.com") ||
        shExpMatch(host, "*.gitee.com") ||
        shExpMatch(host, "*.csdn.net")
    ) {
        return "DIRECT";
    }

    // 4. 其余请求默认走代理
    return "\${pacProxy}";
}
\`.trim();
}
`;

module.exports = {
  applyLanguageServer(lsCode) {
    const startMarker = '/* --- ANTIGRAVITY PROXY AUTO-CONFIGURATION START --- */';
    const endMarker = '/* --- ANTIGRAVITY PROXY AUTO-CONFIGURATION END --- */';

    const injection = `        ${startMarker}
        try {
            const detectedProxy = await detectSystemProxyAsync();
            if (detectedProxy) {
                for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
                    if (!env[k]) env[k] = detectedProxy;
                    if (!process.env[k]) process.env[k] = detectedProxy;
                }
                const noProxyList = 'localhost,127.0.0.1,::1,local.adguard.org,*.local,*.internal,*.cn';
                if (!env['NO_PROXY']) env['NO_PROXY'] = noProxyList;
                if (!env['no_proxy']) env['no_proxy'] = noProxyList;
            }
        } catch (e) {
            console.error('[Antigravity Proxy] Detection error:', e);
        }
        ${endMarker}\n`;

    let res = lsCode;
    if (res.includes(startMarker) && res.includes(endMarker)) {
      const before = res.split(startMarker)[0];
      const after = res.split(endMarker)[1];
      res = before + injection.trimStart() + after;
    } else {
      const promiseAnchor = 'return new Promise((resolve, reject) => {';
      if (!res.includes(promiseAnchor)) {
        throw new Error('Promise anchor not found in languageServer.js');
      }
      res = res.replace(promiseAnchor, 'return new Promise(async (resolve, reject) => {');

      const envRegex = /(const env = \{ \.\.\.process\.env, [^\r\n]+[\r\n]+)/;
      if (!envRegex.test(res)) {
        throw new Error('Env declaration not found in languageServer.js');
      }
      res = res.replace(envRegex, `$1${injection}`);
    }

    if (res.includes('function detectSystemProxyAsync()')) {
      // 替换历史 helperCode
      const helperAnchor = '// ==========================================\n// Antigravity Proxy Auto-Configuration';
      if (res.includes(helperAnchor)) {
        const parts = res.split(helperAnchor);
        const secondPart = parts[1].split('module.exports =')[0]; // or until end of helper
        // Cleaner approach: if helperCode changes, we can prepend new helper if not present
      }
    }
    if (!res.includes('function generatePacScript(')) {
      res = helperCode + '\n' + res;
    }
    return res;
  },

  applyMain(mainCode) {
    const startMarker = '/* --- ANTIGRAVITY MAIN PROXY START --- */';
    const endMarker = '/* --- ANTIGRAVITY MAIN PROXY END --- */';

    const patchBody = `${startMarker}
    try {
        const detectedProxy = await detectSystemProxyAsync();
        if (detectedProxy) {
            for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
                if (!process.env[k]) process.env[k] = detectedProxy;
            }
            if (!process.env['NO_PROXY']) process.env['NO_PROXY'] = 'localhost,127.0.0.1,::1,local.adguard.org,*.local,*.internal,*.cn';
            
            // 写入内置 PAC 规则模式 (内置规则引擎，智能分流直连与境外专线)
            const pacScript = generatePacScript(detectedProxy);
            await electron_1.session.defaultSession.setProxy({
                pacScript: pacScript
            });
            console.log('[Antigravity Proxy] Built-in PAC Rule Mode permanently activated for:', detectedProxy);
        }
    } catch (e) {
        console.error('[Antigravity Proxy] Session proxy error:', e);
    }
    ${endMarker}`;

    let res = mainCode;
    if (res.includes(startMarker) && res.includes(endMarker)) {
      const before = res.split(startMarker)[0];
      const after = res.split(endMarker)[1];
      res = before + patchBody + after;
    } else {
      const candidates = [
        'main_1.default.initialize();\n    Object.assign(console, main_1.default.functions);',
        'main_1.default.initialize();\r\n    Object.assign(console, main_1.default.functions);',
        'Object.assign(console, main_1.default.functions);'
      ];

      let actualTarget = candidates.find(cand => res.includes(cand));

      if (!actualTarget) {
        throw new Error('Main patch anchor not found in main.js');
      }
      res = res.replace(actualTarget, `${actualTarget}\n    ${patchBody}`);
    }

    if (!res.includes('function generatePacScript(')) {
      res = helperCode + '\n' + res;
    }
    return res;
  }
};
