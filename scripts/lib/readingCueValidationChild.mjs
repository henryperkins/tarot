// Owned subprocess only. Importing this module has no runtime side effects.
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { secureDevelopmentServer, PRIVATE_FILE_DENIES } from './developmentServerSecurity.mjs';

import { freezeOutput, hashOutputFiles, verifyOutputIntegrity } from './readingCueOutputIntegrity.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, location) => location === root || location.startsWith(root + path.sep);
const listen = (server, port, host) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
});
const stop = server => new Promise(resolve => {
  if (!server.listening) return resolve();
  server.closeAllConnections?.(); server.close(resolve);
});
const offlineApi = (_request, response) => {
  response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end('{"error":"offline_api_unconfigured"}');
};
const denied = response => response.writeHead(403, { 'Cache-Control': 'no-store' }).end('Forbidden');
const missing = response => response.writeHead(404, { 'Cache-Control': 'no-store' }).end('Not found');

function requestPath(request) {
  try {
    const raw = request.url.split('?')[0];
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..')) return null;
    return decoded;
  } catch { return null; }
}
function validHost(request, ports) {
  return ['127.0.0.1', 'localhost'].some(host => [host, ...Object.values(ports).map(port => `${host}:${port}`)].includes(request.headers.host));
}

async function restrictPrivateDirectories(directory) {
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) await restrictPrivateDirectories(location);
    else if (entry.isFile() && /\.(?:log|json)$/.test(entry.name)) await chmod(location, 0o600);
  }
}

export async function runOwnedValidation(configPath) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const { directory, dependencies, host, ports, buildIdentity } = config;
  const source = path.join(directory, 'source'); const buildDirectory = path.join(directory, 'build');
  const owned = []; let vite; let proxy; let closing;
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      process.removeListener('SIGINT', shutdown); process.removeListener('SIGTERM', shutdown);
      process.removeListener('disconnect', shutdown); process.removeListener('message', onMessage);
      await Promise.all(owned.map(stop));
      if (vite) await vite.close();
      if (proxy) await proxy.dispose();
    })();
    return closing;
  };
  const shutdown = () => { void close().then(() => process.exit(0), () => process.exit(1)); };
  const onMessage = message => { if (message?.kind === 'close') shutdown(); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown); process.once('disconnect', shutdown);
  process.on('message', onMessage);
  try {
    const api = http.createServer((request, response) => validHost(request, ports) ? offlineApi(request, response) : denied(response));
    owned.push(api); await listen(api, ports.api, host);
    // Reserve the explicit port; no inspector protocol or inspector measurement is claimed.
    const inspector = net.createServer(socket => socket.destroy());
    owned.push(inspector); await listen(inspector, ports.inspector, host);
    const databaseConfig = { name: `cue-validation-${buildIdentity.runId}`, compatibility_date: '2026-10-01',
      d1_databases: [{ binding: 'DB', database_name: `cue-validation-${buildIdentity.runId}`,
        database_id: randomUUID(), remote: false }] };
    const dbConfigPath = path.join(directory, 'config/d1.json');
    await writeFile(dbConfigPath, JSON.stringify(databaseConfig), { mode: 0o600, flag: 'wx' });
    // Wrangler's real local proxy owns its platform handles; env discovery/remote bindings are disabled.
    const { getPlatformProxy } = await import('wrangler');
    proxy = await getPlatformProxy({ configPath: dbConfigPath, envFiles: [], remoteBindings: false,
      persist: { path: path.join(directory, 'state/v3') } });
    await proxy.env.DB.prepare('CREATE TABLE runtime_identity (run_id TEXT PRIMARY KEY)').run();
    await proxy.env.DB.prepare('INSERT INTO runtime_identity (run_id) VALUES (?)').bind(buildIdentity.runId).run();
    const { createServer, build } = await import('vite');
    const { default: base } = await import(path.join(source, 'vite.config.js'));
    const security = secureDevelopmentServer({ middlewareMode: true, hmr: false, strictPort: true, port: ports.frontend,
      proxy: {}, watch: null, fs: { allow: [source, dependencies, path.join(directory, 'vite-cache')],
        deny: [...PRIVATE_FILE_DENIES, '**/.npmrc', '**/.netrc', '**/*.{key,p12,pfx}', directory + '/config/**', directory + '/state/**', directory + '/logs/**'] } });
    const shared = { ...base, root: source, configFile: false, envFile: false, envDir: path.join(directory, 'config'),
      cacheDir: path.join(directory, 'vite-cache'), logLevel: 'silent',
      define: { 'import.meta.env.VITE_READING_GESTURES': '"true"' } };
    vite = await createServer({ ...shared, mode: 'development',
      // Vite disables the HMR server with hmr:false but still serves a client
      // that opens its socket. Frozen validation has no update channel; retain
      // the client exports used by transformed modules without opening one.
      plugins: [...base.plugins, { name: 'owned-validation-disabled-hmr', enforce: 'post',
        transform(code, id) {
          if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/vite/dist/client/client.mjs')) return null;
          const connect = 'transport.connect(createHMRHandler(handleMessage));';
          if (code.split(connect).length !== 2) throw new Error('Unexpected Vite HMR client startup');
          return { code: code.replace(connect, '/* Frozen validation does not start HMR. */'), map: null };
        }
      }],
      define: { ...shared.define, 'import.meta.env.VITE_CUE_TIMING_PROBE': '"true"' }, server: security });
    const sourceFiles = new Set(buildIdentity.sourceFiles.map(file => path.join(source, file.path)));
    const unsafeName = /(?:^|\/)(?:\.[^/]+|[^/]*\.(?:pem|crt|key|p12|pfx))(?:\/|$)/i;
    const allowedDev = async pathname => {
      if (!pathname.startsWith('/@fs/') && unsafeName.test(pathname)) return false;
      if (['/', '/index.html', '/@vite/client', '/@react-refresh'].includes(pathname) || pathname.startsWith('/@id/')) return true;
      let location;
      if (pathname.startsWith('/@fs/')) location = pathname.slice(4);
      else if (pathname.startsWith('/node_modules/') || sourceFiles.has(path.join(source, pathname))) location = path.join(source, pathname);
      else location = path.join(source, 'public', pathname);
      try {
        const actual = await realpath(location);
        if (inside(dependencies, actual)) return !unsafeName.test(path.relative(dependencies, actual).replaceAll(path.sep, '/'));
        // Optimizer outputs are separately owned generated files, never parent/private configs.
        const cache = path.join(directory, 'vite-cache/deps');
        if (inside(cache, actual) && /\.(?:js|map)$/.test(actual)) return true;
        return sourceFiles.has(actual) && actual === path.resolve(location);
      } catch { return false; }
    };
    let outputFiles = null; let outputDigest = null; let optimizedFlags; let outputCompromised = false;
    const markOutputFailure = () => {
      if (!outputCompromised) process.send?.({ kind: 'integrity-failed', error: 'output-integrity-mismatch' });
      outputCompromised = true;
    };
    const identity = async (server, kind, response) => {
      if (outputFiles && !await verifyOutputIntegrity(buildDirectory, outputFiles)) markOutputFailure();
      const outputIntegrity = Boolean(outputFiles) && !outputCompromised;
      const address = server.address();
      response.writeHead(outputIntegrity ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ runId: buildIdentity.runId, snapshotDigest: buildIdentity.snapshotDigest, apiMode: buildIdentity.apiMode,
          listenerKind: kind, servingOrigin: `http://${address.address}:${address.port}`, optimizedFlags, outputDigest, outputIntegrity,
          servingFlags: kind === 'optimized' ? optimizedFlags : { dev: vite.config.env.DEV, prod: vite.config.env.PROD, mode: vite.config.env.MODE } }));
    };
    const frontend = http.createServer(async (request, response) => {
      const pathname = requestPath(request);
      if (!validHost(request, ports) || !pathname) return denied(response);
      if (pathname === '/api' || pathname.startsWith('/api/')) return offlineApi(request, response);
      if (pathname === '/__cue_validation_identity') return identity(frontend, 'frontend', response);
      const appRoute = /^\/(?:reading|journal|account|pricing|learn|settings|login|register)(?:\/[^.]*)?$/.test(pathname)
        || /^\/__e2e\/(?:reading-gestures|journal-visual)$/.test(pathname);
      if (!appRoute && !await allowedDev(pathname)) return denied(response);
      vite.middlewares(request, response);
    });
    owned.push(frontend); await listen(frontend, ports.frontend, host);
    // A separately identified optimized actual-app build; DEV remains false and fixtures stay absent.
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await build({ ...shared, mode: 'reading-cue-validation',
      plugins: [...base.plugins, { name: 'owned-validation-build-contract', configResolved(value) {
        optimizedFlags = { dev: value.env.DEV, prod: value.env.PROD, mode: value.env.MODE };
        if (value.env.DEV !== false || value.env.MODE !== 'reading-cue-validation') throw new Error('Optimized validation must keep DEV false.');
      } }],
      build: { ...base.build, outDir: buildDirectory, emptyOutDir: true, minify: 'esbuild', sourcemap: false } });
    process.env.NODE_ENV = previousNodeEnv;
    outputFiles = await hashOutputFiles(buildDirectory);
    outputDigest = hash(JSON.stringify(outputFiles));
    await freezeOutput(buildDirectory);
    if (!await verifyOutputIntegrity(buildDirectory, outputFiles)) throw new Error('Optimized output changed before serving.');
    const outputSet = new Set(outputFiles.map(file => file.path));
    const outputMap = new Map(outputFiles.map(file => [file.path, file]));
    const invalidOutput = response => response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"error":"output_integrity_mismatch"}');
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
      '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
    const optimized = http.createServer(async (request, response) => {
      const pathname = requestPath(request);
      if (!validHost(request, ports) || !pathname) return denied(response);
      if (pathname === '/api' || pathname.startsWith('/api/')) return offlineApi(request, response);
      if (pathname === '/__cue_validation_identity') return identity(optimized, 'optimized', response);
      if (unsafeName.test(pathname) || pathname.startsWith('/@fs/') || pathname.startsWith('/__e2e/')) return denied(response);
      if (!['GET', 'HEAD'].includes(request.method)) return missing(response);
      let filename = pathname.replace(/^\//, '') || 'index.html';
      if (!outputSet.has(filename)) {
        if (/^\/(?:reading|journal|account|pricing|learn|settings|login|register)(?:\/[^.]*)?$/.test(pathname)) filename = 'index.html';
        else return missing(response);
      }
      if (outputCompromised) return invalidOutput(response);
      try {
        const expectedLocation = path.join(buildDirectory, filename);
        const location = await realpath(expectedLocation);
        const metadata = await lstat(expectedLocation);
        if (location !== expectedLocation || !metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o444) { markOutputFailure(); return invalidOutput(response); }
        if (!inside(buildDirectory, location)) return denied(response);
        const bytes = await readFile(location);
        if (hash(bytes) !== outputMap.get(filename).sha256 || bytes.length !== outputMap.get(filename).bytes) { markOutputFailure(); return invalidOutput(response); }
        if (outputCompromised) return invalidOutput(response);
        response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
          'Content-Length': bytes.length, ETag: `"${hash(bytes)}"`,
          'Cache-Control': filename.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : bytes);
      } catch { markOutputFailure(); invalidOutput(response); }
    });
    owned.push(optimized); await listen(optimized, ports.optimized, host);
    for (const name of ['config', 'state', 'home', 'tmp', 'logs', 'vite-cache']) await restrictPrivateDirectories(path.join(directory, name));
    const version = async name => JSON.parse(await readFile(path.join(dependencies, name, 'package.json'), 'utf8')).version;
    process.send?.({ kind: 'ready', identity: { optimizedFlags, outputFiles, outputDigest, outputIntegrity: true,
      toolVersions: { node: process.version, vite: await version('vite'), wrangler: await version('wrangler'), playwright: await version('@playwright/test') },
      runtimeConfigDigest: hash(JSON.stringify({ ports, host, mode: 'reading-cue-validation', security: { ...security, fs: { strict: true, deny: security.fs.deny.map(item => item.startsWith(directory) ? item.replace(directory, '<private>') : item) } } })) },
    listeners: ['frontend', 'api', 'optimized', 'inspector'].map(kind => ({ kind, host, port: ports[kind], startedAt: new Date().toISOString() })) });
    for (const server of owned) server.on('error', shutdown);
    return { close };
  } catch (error) {
    // Logs are private, bounded by the parent, and excluded from retained provenance.
    console.error(error.stack || error.message);
    process.send?.({ kind: 'failed', error: String(error.message).slice(0, 1000).replaceAll(directory, '<private>') });
    await close(); throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runOwnedValidation(process.argv[2]).catch(() => { process.exitCode = 1; });
}
