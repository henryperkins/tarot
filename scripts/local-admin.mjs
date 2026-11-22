import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFile, open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { isLocalLaunchChallenge, localLaunchProof } from '../shared/contracts/localAdminLaunch.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const dashboard = 'http://localhost:8787/admin/ai-configuration';

async function textIfPresent(file) {
  try { return await readFile(file, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
}

async function localFiles(root) {
  const file = path.join(root, '.dev.vars');
  const contents = await textIfPresent(file);
  if (contents !== null) return { file, contents, settings: parseEnv(contents) };
  // Wrangler reads .env and .env.local when .dev.vars is absent.
  const base = await textIfPresent(path.join(root, '.env'));
  const local = await textIfPresent(path.join(root, '.env.local'));
  if (base === null && local === null) return { file, contents: '', settings: {} };
  return { file: path.join(root, '.env.local'), contents: local || '',
    settings: { ...parseEnv(base || ''), ...parseEnv(local || '') } };
}

async function prepareLocalSecrets(root, names, returnName) {
  const initial = await localFiles(root);
  if (names.every(name => initial.settings[name]?.trim())) return initial.settings[returnName];
  // Both npm dev entry points may start together. Publish one set of keys.
  const lockPath = path.join(root, '.dev.vars.portal.lock');
  let lock;
  for (let attempt = 0; !lock; attempt++) {
    try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 60000) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
      if (attempt >= 100) throw new Error('Another local setup is in progress. Try again shortly.', { cause: error });
      await delay(75);
    }
  }
  try {
    const { file, contents, settings } = await localFiles(root);
    const additions = [];
    for (const name of names) {
      if (!settings[name]?.trim()) {
        settings[name] = randomBytes(32).toString('hex');
        additions.push(name + '=' + settings[name]);
      }
    }
    if (additions.length) {
      const newline = contents.includes('\r\n') ? '\r\n' : '\n';
      const separator = contents && !contents.endsWith('\n') ? newline : '';
      await appendFile(file, separator + additions.join(newline) + newline, { mode: 0o600 });
    }
    return settings[returnName];
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

export function prepareLocalAdmin(root = projectRoot) {
  return prepareLocalSecrets(root, ['ADMIN_API_KEY', 'LOCAL_ADMIN_SETUP_TOKEN'], 'LOCAL_ADMIN_SETUP_TOKEN');
}

export function prepareOwnerHostSecret(root = projectRoot) {
  return prepareLocalSecrets(root, ['LOCAL_OWNER_HOST_SECRET'], 'LOCAL_OWNER_HOST_SECRET');
}

export async function localAdminUrl(root = projectRoot, request = fetch) {
  const url = new URL('/api/admin/local-access', dashboard);
  const challenge = randomBytes(32).toString('hex');
  url.searchParams.set('challenge', challenge);
  const response = await request(url, {
    redirect: 'error', signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Local admin setup is unavailable. Start the dev server and apply the local migrations.');
  const state = await response.json();
  if (!state.available || typeof state.passwordConfigured !== 'boolean') throw new Error('The local admin service is unavailable.');
  if (state.passwordConfigured) return dashboard;
  const { settings } = await localFiles(root);
  const token = settings.LOCAL_ADMIN_SETUP_TOKEN;
  const mismatch = 'Could not verify the running local Worker. Restart it with npm run dev, then run npm run admin:open.';
  if (!token || !isLocalLaunchChallenge(state.launchProof)) throw new Error(mismatch);
  const expected = await localLaunchProof(token, challenge);
  if (!timingSafeEqual(Buffer.from(state.launchProof, 'hex'), Buffer.from(expected, 'hex'))) throw new Error(mismatch);
  return dashboard + '#setup=' + encodeURIComponent(token);
}

async function openDashboard() {
  const url = await localAdminUrl();
  const cmd = { win32: ['rundll32.exe', 'url.dll,FileProtocolHandler'], darwin: ['open'] }[process.platform] || ['xdg-open'];
  const browser = spawn(cmd[0], [...cmd.slice(1), url], { stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => {
    browser.once('error', reject);
    browser.once('close', code => code === 0 ? resolve() : reject(new Error('Could not open the local browser.')));
  });
  console.log('Opened the local AI configuration dashboard.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--open')) await openDashboard();
    else await prepareLocalAdmin();
  } catch (error) {
    console.error(error.message === 'fetch failed' ? 'Start the local server with npm run dev, then run npm run admin:open.' : error.message);
    process.exitCode = 1;
  }
}
