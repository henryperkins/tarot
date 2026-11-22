import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareLocalAdmin, prepareOwnerHostSecret } from './local-admin.mjs';
import { startOwnerSubscriptionHosts } from './lib/ownerSubscriptionHosts.mjs';

// Keep the listeners in this process. A second dev run always receives its
// own ports and credentials, regardless of other CLI sessions on this host.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => /^(?:--remote|-r)(?:$|=)/.test(arg))) throw new Error('The owner subscription portal requires local Wrangler development.');
await prepareLocalAdmin(root);
const secret = await prepareOwnerHostSecret(root);
const hosts = await startOwnerSubscriptionHosts({ secret });
let child;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  void hosts.close();
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const bindings = { AI_CONFIG_ENVIRONMENT: 'local', AI_CONFIG_ENABLED: 'true', ...hosts.bindings };
  const variables = Object.entries(bindings).flatMap(([key, value]) => ['--var', key + ':' + value]);
  child = spawn(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'dev', '--config', 'wrangler.jsonc', ...args, ...variables], { cwd: root, stdio: 'inherit', windowsHide: true });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  process.exitCode = stopping ? 0 : exitCode ?? 1;
} finally {
  await hosts.close();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
