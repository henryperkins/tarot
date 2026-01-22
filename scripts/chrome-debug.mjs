#!/usr/bin/env node
/**
 * Launch Playwright's bundled Chromium with the Chrome DevTools Protocol (CDP)
 * remote debugging port enabled.
 *
 * Why:
 * - Some dev/debug workflows (e.g. VS Code "Attach to Chrome") expect a browser
 *   already running with --remote-debugging-port=9222.
 * - In many Linux/CI/remote environments, system Chrome is not installed.
 * - Playwright already provides a compatible Chromium binary.
 *
 * Usage:
 *   npm run chrome:debug
 *   npm run chrome:debug:headed
 *   npm run chrome:debug -- --port 9333 --host 0.0.0.0
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

function parseArgs(argv) {
    const args = argv.slice(2);
    const out = {
        port: 9222,
        host: '127.0.0.1',
        headed: false,
        headless: null,
        noSandbox: false,
        forceSandbox: false,
        userDataDir: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--port' && args[i + 1]) {
            out.port = Number(args[++i]);
            continue;
        }
        if (arg.startsWith('--port=')) {
            out.port = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--host' && args[i + 1]) {
            out.host = String(args[++i]);
            continue;
        }
        if (arg.startsWith('--host=')) {
            out.host = String(arg.split('=')[1]);
            continue;
        }
        if (arg === '--headed' || arg === '--headful') {
            out.headed = true;
            out.headless = false;
            continue;
        }
        if (arg === '--headless') {
            out.headless = true;
            continue;
        }
        if (arg === '--no-sandbox') {
            out.noSandbox = true;
            continue;
        }
        if (arg === '--sandbox') {
            out.forceSandbox = true;
            out.noSandbox = false;
            continue;
        }
        if (arg === '--user-data-dir' && args[i + 1]) {
            out.userDataDir = String(args[++i]);
            continue;
        }
        if (arg.startsWith('--user-data-dir=')) {
            out.userDataDir = String(arg.split('=')[1]);
            continue;
        }
    }

    if (!Number.isFinite(out.port) || out.port <= 0) {
        throw new Error(`Invalid --port value: ${out.port}`);
    }

    if (out.headless == null) {
        // Default to headless when no DISPLAY is available (common in remote envs).
        out.headless = !out.headed && !process.env.DISPLAY;
    }

    return out;
}

async function readTextIfExists(filePath) {
    try {
        return (await fs.readFile(filePath, 'utf8')).trim();
    } catch {
        return null;
    }
}

async function detectRestrictedUserNamespaces() {
    if (process.platform !== 'linux') return false;

    // If unprivileged user namespaces are disabled, Chromium's sandbox often fails
    // with: "No usable sandbox".
    const unprivUsernsClone = await readTextIfExists('/proc/sys/kernel/unprivileged_userns_clone');
    if (unprivUsernsClone === '0') return true;

    // Ubuntu / AppArmor may additionally restrict unprivileged user namespaces.
    const apparmorProc = await readTextIfExists('/proc/sys/kernel/apparmor_restrict_unprivileged_userns');
    if (apparmorProc === '1') return true;

    const apparmorModule = await readTextIfExists('/sys/module/apparmor/parameters/restrict_unprivileged_userns');
    if (apparmorModule && ['1', 'y', 'Y', 'true', 'True'].includes(apparmorModule)) return true;

    return false;
}

async function probeCdp(host, port) {
    const url = `http://${host}:${port}/json/version`;
    if (typeof fetch !== 'function') return null;

    // Retry briefly; Chromium can take a moment to open the port.
    const deadline = Date.now() + 5_000;
    let lastErr = null;

    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    return { error: `Failed to probe ${url}: ${lastErr?.message ?? String(lastErr)}` };
}

async function main() {
    const options = parseArgs(process.argv);
    const executablePath = chromium.executablePath();

    // Many remote/containerized Linux environments can't use Chromium's sandbox.
    // Auto-enable --no-sandbox in those environments unless the user explicitly
    // asked for sandboxing.
    if (!options.forceSandbox && !options.noSandbox) {
        const restricted = await detectRestrictedUserNamespaces();
        if (restricted) {
            options.noSandbox = true;
            console.warn('⚠️  Detected restricted unprivileged user namespaces; enabling --no-sandbox for Chromium.');
            console.warn('   (You can force sandbox attempts with --sandbox.)');
            console.warn('');
        }
    }

    const userDataDir = options.userDataDir
        ? path.resolve(options.userDataDir)
        : path.join(os.tmpdir(), `tarot-chrome-debug-profile-${process.pid}`);
    await fs.mkdir(userDataDir, { recursive: true });

    const flags = [
        `--remote-debugging-port=${options.port}`,
        `--remote-debugging-address=${options.host}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update'
    ];

    if (options.headless) {
        // Use the new headless implementation when available.
        flags.push('--headless=new', '--disable-gpu');
    }

    // Many containerized environments require this.
    if (options.noSandbox || process.env.CHROME_NO_SANDBOX === '1') {
        flags.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    // Keep a predictable initial target.
    flags.push('about:blank');

    console.log('🔎 Launching Chromium with remote debugging enabled');
    console.log(`   Chromium: ${executablePath}`);
    console.log(`   CDP:      http://${options.host}:${options.port}`);
    console.log(`   Profile:  ${userDataDir}`);
    console.log(`   Mode:     ${options.headless ? 'headless' : 'headed'}`);
    console.log('');
    console.log('Tip: if you are in a remote dev environment, forward port 9222 (or your chosen port).');
    console.log('');

    const child = spawn(executablePath, flags, {
        stdio: 'inherit',
        env: process.env
    });

    const shutdown = (signal) => {
        if (child.killed) return;
        try {
            child.kill(signal);
        } catch {
            // best-effort
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('exit', () => shutdown('SIGTERM'));

    const version = await probeCdp(options.host, options.port);
    if (version?.webSocketDebuggerUrl) {
        console.log('✅ CDP is up');
        console.log(`   DevTools WebSocket: ${version.webSocketDebuggerUrl}`);
        console.log(`   Version: ${version.Browser ?? 'unknown'}`);
    } else if (version?.error) {
        console.warn('⚠️  Chromium started, but CDP probe did not succeed:');
        console.warn(`   ${version.error}`);
    } else {
        console.log('ℹ️  Chromium started. If your tool still cannot attach, verify the port is reachable.');
    }

    const code = await new Promise((resolve) => {
        child.on('exit', (exitCode) => resolve(exitCode ?? 0));
    });
    process.exitCode = code;
}

main().catch((err) => {
    console.error('Failed to launch Chromium for debugging:', err?.stack || err);
    process.exitCode = 1;
});
