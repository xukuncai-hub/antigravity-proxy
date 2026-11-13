#!/usr/bin/env node
/**
 * Google Antigravity 智能代理适配与专线加速引擎 (Node.js 原生版)
 * 项目地址: https://github.com/xukuncai-hub/antigravity-proxy
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const VERSION = '1.0.1';

// ANSI 颜色
const COLOR_RESET = '\x1b[0m';
const COLOR_GREEN = '\x1b[32m\x1b[1m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RED = '\x1b[31m\x1b[1m';
const COLOR_CYAN = '\x1b[36m';

function printInfo(msg) { console.log(`${COLOR_CYAN}[信息]${COLOR_RESET} ${msg}`); }
function printSuccess(msg) { console.log(`${COLOR_GREEN}[成功]${COLOR_RESET} ${msg}`); }
function printWarn(msg) { console.log(`${COLOR_YELLOW}[警告]${COLOR_RESET} ${msg}`); }
function printError(msg) { console.log(`${COLOR_RED}[错误]${COLOR_RESET} ${msg}`); }

function detectAsarPath() {
    const platform = os.platform();
    const home = os.homedir();
    const candidates = [];

    if (platform === 'win32') {
        const local = process.env.LOCALAPPDATA;
        const prog = process.env.ProgramFiles;
        if (local) {
            candidates.push(path.join(local, 'Programs/Antigravity/resources/app.asar'));
            candidates.push(path.join(local, 'Programs/antigravity/resources/app.asar'));
        }
        if (prog) {
            candidates.push(path.join(prog, 'Antigravity/resources/app.asar'));
            candidates.push(path.join(prog, 'antigravity/resources/app.asar'));
        }
    } else if (platform === 'darwin') {
        candidates.push('/Applications/Antigravity.app/Contents/Resources/app.asar');
        candidates.push(path.join(home, 'Applications/Antigravity.app/Contents/Resources/app.asar'));
    } else {
        candidates.push(path.join(home, '.local/share/Antigravity/resources/app.asar'));
        candidates.push('/opt/antigravity/resources/app.asar');
        candidates.push('/opt/Antigravity/resources/app.asar');
        candidates.push('/usr/lib/antigravity/resources/app.asar');
    }

    for (const p of candidates) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
}

function patchFiles(extractDir, srcDir) {
    const patch = require(path.join(srcDir, 'proxy_patch.js'));

    // 1. LanguageServer
    const lsPath = path.join(extractDir, 'dist/languageServer.js');
    if (fs.existsSync(lsPath)) {
        let lsCode = fs.readFileSync(lsPath, 'utf8');
        lsCode = patch.applyLanguageServer(lsCode);
        fs.writeFileSync(lsPath, lsCode, 'utf8');
        printInfo('已注入 LanguageServer 网络代理自适应加速引擎 (dist/languageServer.js)');
    }

    // 2. Main Process
    const mainPath = path.join(extractDir, 'dist/main.js');
    if (fs.existsSync(mainPath)) {
        let mainCode = fs.readFileSync(mainPath, 'utf8');
        mainCode = patch.applyMain(mainCode);
        fs.writeFileSync(mainPath, mainCode, 'utf8');
        printInfo('已注入主进程网络代理自适应引擎 (dist/main.js)');
    }
}

function patchClashRules() {
    try {
        const appdata = process.env.APPDATA;
        if (!appdata) return;

        const vergeDirs = [
            path.join(appdata, 'io.github.clash-verge-rev.clash-verge-rev'),
            path.join(appdata, 'clash_verge')
        ];

        const prependRules = [
            'DOMAIN-SUFFIX,googleapis.com,🚀 节点选择',
            'DOMAIN-SUFFIX,google.com,🚀 节点选择',
            'DOMAIN-SUFFIX,gstatic.com,🚀 节点选择',
            'DOMAIN-SUFFIX,googleusercontent.com,🚀 节点选择',
            'DOMAIN-SUFFIX,run.app,🚀 节点选择',
            'DOMAIN-SUFFIX,appspot.com,🚀 节点选择',
            'DOMAIN-SUFFIX,antigravity.google,🚀 节点选择',
            'DOMAIN-KEYWORD,cloudcode,🚀 节点选择',
            'DOMAIN-KEYWORD,antigravity,🚀 节点选择',
            'DOMAIN-KEYWORD,google,🚀 节点选择'
        ];

        const dnsDomains = [
            '+.google.com',
            '+.googleapis.com',
            '+.gstatic.com',
            '+.googleusercontent.com',
            '+.run.app',
            '+.appspot.com',
            '+.antigravity.google'
        ];

        for (const vdir of vergeDirs) {
            const profilesDir = path.join(vdir, 'profiles');
            if (!fs.existsSync(profilesDir)) continue;

            // 扫描并更新 rules template
            for (const f of fs.readdirSync(profilesDir)) {
                if (f.endsWith('.yaml')) {
                    const p = path.join(profilesDir, f);
                    let content = fs.readFileSync(p, 'utf8');
                    if (content.includes('prepend:')) {
                        let lines = content.split(/\r?\n/);
                        let prependIdx = lines.findIndex(l => l.trim().startsWith('prepend:'));
                        if (prependIdx !== -1) {
                            let added = 0;
                            for (const r of prependRules) {
                                if (!content.includes(r.split(',')[1])) {
                                    lines.splice(prependIdx + 1, 0, `- ${r}`);
                                    added++;
                                }
                            }
                            if (added > 0) {
                                fs.writeFileSync(p, lines.join('\n'), 'utf8');
                                printInfo(`已自动为 Clash Verge 注入 ${added} 条 Antigravity 专线分流规则 (${f})`);
                            }
                        }
                    }
                }
            }
        }
    } catch (_) {}
}

function install(asarPath) {
    printInfo(`目标 app.asar 路径: ${asarPath}`);
    const resourcesDir = path.dirname(asarPath);
    const backupPath = path.join(resourcesDir, 'app.asar.proxy_bak');

    if (!fs.existsSync(backupPath)) {
        printInfo(`正在备份原始文件到: ${backupPath}`);
        fs.copyFileSync(asarPath, backupPath);
    } else {
        printInfo(`已检测到原版备份: ${backupPath} (保留不变)`);
    }

    const tempDir = path.join(os.tmpdir(), 'antigravity_proxy_patch');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const extractedDir = path.join(tempDir, 'extracted');
    const outputAsar = path.join(tempDir, 'app.asar');
    const scriptDir = __dirname;
    const srcDir = path.join(scriptDir, 'src');

    try {
        printInfo('正在解包 app.asar...');
        execSync(`npx --yes @electron/asar extract "${asarPath}" "${extractedDir}"`, { stdio: 'inherit' });

        printInfo('正在注入网络代理自适应加速引擎...');
        patchFiles(extractedDir, srcDir);

        printInfo('正在重新打包 app.asar...');
        execSync(`npx --yes @electron/asar pack "${extractedDir}" "${outputAsar}" --unpack-dir "node_modules/chrome-devtools-mcp"`, { stdio: 'inherit' });

        printInfo('正在替换并应用新版本...');
        fs.copyFileSync(outputAsar, asarPath);

        patchClashRules();

        printSuccess('网络代理自适应引擎安装成功！🎉');
        printInfo('提示: 您现在可以关闭 TUN 模式并切换为规则模式。');
        printInfo('请重新启动 Antigravity 即可生效。');
    } finally {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function restore(asarPath) {
    const resourcesDir = path.dirname(asarPath);
    const backupPath = path.join(resourcesDir, 'app.asar.proxy_bak');
    if (!fs.existsSync(backupPath)) {
        printError('未找到备份文件，无法执行还原。');
        process.exit(1);
    }
    printInfo(`正在从备份文件还原: ${backupPath} -> ${asarPath}`);
    fs.copyFileSync(backupPath, asarPath);
    printSuccess('已成功还原为修改前版本！🎉');
    printInfo('重启 Antigravity 即可生效。');
}

function main() {
    console.log(`\n${COLOR_CYAN}=== Google Antigravity 智能代理适配与专线加速引擎 v${VERSION} ===${COLOR_RESET}\n`);
    const args = process.argv.slice(2);
    let asarPath = null;
    let isRestore = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--restore') isRestore = true;
        if (args[i] === '--path' && args[i + 1]) asarPath = args[i + 1];
    }

    asarPath = asarPath || detectAsarPath();
    if (!asarPath || !fs.existsSync(asarPath)) {
        printError('未自动找到 Antigravity 的 app.asar 文件！');
        printInfo('请使用 --path 参数手动指定路径，例如:');
        printInfo('node install.js --path ~/.local/share/Antigravity/resources/app.asar');
        process.exit(1);
    }

    if (isRestore) restore(asarPath);
    else install(asarPath);
}

main();
