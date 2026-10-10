import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCueOriginMappings, verifyCueListener } from './readingCueValidationIdentity.mjs';

export async function attachCueValidationFrontend(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateCueOriginMappings(manifest);
  const identity = manifest.buildIdentity;
  const origin = new URL(manifest.origins?.frontend);
  if (origin.hostname !== '127.0.0.1' || origin.protocol !== 'http:' || !origin.port
    || [8787, 5175, 8789, 9235].includes(Number(origin.port)) || origin.pathname !== '/'
    || origin.username || origin.password || origin.search || origin.hash
    || identity?.apiMode !== 'offline-fail-closed' || !/^[a-f0-9]{64}$/.test(identity.snapshotDigest || '')) {
    throw new Error('Qualification requires an explicitly owned immutable offline frontend.');
  }
  const listenerIdentity = await verifyCueListener(manifest, 'frontend');
  return { origin: origin.origin, pid: manifest.ownedResources?.pid, inertPort: Number(new URL(manifest.origins.api).port),
    stateDir: null, buildIdentity: identity, listenerIdentity, async close() {
      const after = await verifyCueListener(manifest, 'frontend');
      return { borrowed: true, closed: false, runId: identity.runId, listenerKind: after.listenerKind, outputDigest: after.outputDigest, outputIntegrity: after.outputIntegrity };
    } };
}

export async function startCueQualificationFrontend() {
  if (process.env.CUE_VALIDATION_MANIFEST) return attachCueValidationFrontend(process.env.CUE_VALIDATION_MANIFEST);
  const stateDir = await mkdtemp(join(tmpdir(), 'cue-browser-owned-'));
  const child = fork(fileURLToPath(import.meta.url), ['--owned-vite', stateDir], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { PATH: process.env.PATH, NODE_ENV: 'development' }, silent: true
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  const owned = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Owned Vite did not start: ${log}`)), 60000);
    child.once('message', value => { clearTimeout(timer); resolve(value); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Owned Vite exited ${code}: ${log}`)); });
  }).catch(async error => { child.kill('SIGTERM'); await rm(stateDir, { recursive: true, force: true }); throw error; });
  return { ...owned, stateDir, log: () => log, async close() {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.send('close'); await exited;
    }
    await rm(stateDir, { recursive: true, force: true });
    return { pid: child.pid, closed: child.exitCode === 0 };
  } };
}
if (process.argv[2] === '--owned-vite') {
  const { createServer } = await import('vite');
  const { createServer: createHttpServer } = await import('node:http');
  const { default: base } = await import('../../vite.config.js');
  const inert = createHttpServer((_req, res) => res.writeHead(503).end('Qualification API not intercepted'));
  await new Promise(resolve => inert.listen(0, '127.0.0.1', resolve));
  const server = await createServer({ ...base, configFile: false, envFile: false,
    cacheDir: join(process.argv[3], 'vite-cache'),
    define: { 'import.meta.env.VITE_READING_GESTURES': '"true"', 'import.meta.env.VITE_CUE_TIMING_PROBE': '"true"' },
    server: { ...base.server, host: '127.0.0.1', middlewareMode: true, hmr: false,
      proxy: { '/api': { target: `http://127.0.0.1:${inert.address().port}` } },
      watch: { ...base.server.watch, ignored: ['**/output/reading-motion/evidence/**', '**/.superpowers/**'] } }
  });
  // Vite interprets port:0 as its default port. Own a genuine OS-assigned
  // listener in middleware mode instead; HMR cannot reload measured snapshots.
  const frontendHttp = createHttpServer((request, response) => server.middlewares(request, response));
  await new Promise(resolve => frontendHttp.listen(0, '127.0.0.1', resolve));
  process.send({ origin: `http://127.0.0.1:${frontendHttp.address().port}`, pid: process.pid, inertPort: inert.address().port });
  const close = async () => { frontendHttp.closeAllConnections(); await new Promise(resolve => frontendHttp.close(resolve)); await server.close(); inert.closeAllConnections(); await new Promise(resolve => inert.close(resolve)); process.exit(0); };
  process.once('message', close); process.once('SIGTERM', close); process.once('disconnect', close);
}
