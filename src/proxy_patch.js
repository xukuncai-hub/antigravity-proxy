// Antigravity Proxy Auto-Configuration Patch
// 解决痛点: 免除使用 Antigravity 必须开启“虚拟网卡 (TUN) 模式”与“全局 (Global) 模式”的强制限制。
// 原理: 自动智能感知本地/系统代理端口 (如 Clash Verge 7897 / Clash 7890 / v2rayN 10809)，
// 动态注入 language_server.exe 底层核心与 Electron 主进程，完美适配“系统代理 + 规则模式 (Rule Mode)”。

const helperCode = `
// ==========================================
// Antigravity Proxy Auto-Configuration Helper
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
`;

module.exports = {
  applyLanguageServer(lsCode) {
    if (lsCode.includes('ANTIGRAVITY PROXY AUTO-CONFIGURATION START')) {
      return lsCode;
    }

    const promiseAnchor = 'return new Promise((resolve, reject) => {';
    if (!lsCode.includes(promiseAnchor)) {
      throw new Error('Promise anchor not found in languageServer.js');
    }
    let res = lsCode.replace(promiseAnchor, 'return new Promise(async (resolve, reject) => {');

    const envRegex = /(const env = \{ \.\.\.process\.env, [^\r\n]+[\r\n]+)/;
    if (!envRegex.test(res)) {
      throw new Error('Env declaration not found in languageServer.js');
    }

    const injection = `        /* --- ANTIGRAVITY PROXY AUTO-CONFIGURATION START --- */
        try {
            const detectedProxy = await detectSystemProxyAsync();
            if (detectedProxy) {
                for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
                    if (!env[k]) env[k] = detectedProxy;
                    if (!process.env[k]) process.env[k] = detectedProxy;
                }
                if (!env['NO_PROXY']) env['NO_PROXY'] = 'localhost,127.0.0.1,::1';
                if (!env['no_proxy']) env['no_proxy'] = 'localhost,127.0.0.1,::1';
            }
        } catch (e) {
            console.error('[Antigravity Proxy] Detection error:', e);
        }
        /* --- ANTIGRAVITY PROXY AUTO-CONFIGURATION END --- */\n`;

    res = res.replace(envRegex, `$1${injection}`);

    if (!res.includes('function detectSystemProxyAsync()')) {
      res = helperCode + '\n' + res;
    }
    return res;
  },

  applyMain(mainCode) {
    if (mainCode.includes('ANTIGRAVITY MAIN PROXY START')) {
      return mainCode;
    }

    const target = 'Object.assign(console, main_1.default.functions);';
    if (!mainCode.includes(target)) {
      throw new Error('Main patch anchor not found in main.js');
    }

    const replacement = `${target}
    /* --- ANTIGRAVITY MAIN PROXY START --- */
    try {
        const detectedProxy = await detectSystemProxyAsync();
        if (detectedProxy) {
            for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
                if (!process.env[k]) process.env[k] = detectedProxy;
            }
            if (!process.env['NO_PROXY']) process.env['NO_PROXY'] = 'localhost,127.0.0.1,::1';
            await electron_1.session.defaultSession.setProxy({
                proxyRules: detectedProxy,
                proxyBypassRules: 'localhost,127.0.0.1,<local>'
            });
            console.log('[Antigravity Proxy] Default session proxy set to:', detectedProxy);
        }
    } catch (e) {
        console.error('[Antigravity Proxy] Session proxy error:', e);
    }
    /* --- ANTIGRAVITY MAIN PROXY END --- */`;

    let res = mainCode.replace(target, replacement);
    if (!res.includes('function detectSystemProxyAsync()')) {
      res = helperCode + '\n' + res;
    }
    return res;
  }
};
