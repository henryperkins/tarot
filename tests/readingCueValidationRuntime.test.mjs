import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, access, copyFile, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

let runtime;
try { runtime = await import('../scripts/dev-reading-cue-validation.mjs'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const root = fileURLToPath(new URL('..', import.meta.url));
const sourceHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const temporary = async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-runtime-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};
async function freePorts() {
  const servers = await Promise.all(Array.from({ length: 4 }, async () => {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return server;
  }));
  const values = servers.map(server => server.address().port);
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  return Object.fromEntries(['frontend', 'api', 'optimized', 'inspector'].map((key, i) => [key, values[i]]));
}
const options = (privateDirectory, ports) => ({ privateDirectory, ports, sourceHead });
const missing = async file => assert.rejects(access(file), { code: 'ENOENT' });
const viteFileUrl = file => '/@fs/' + file.split(path.sep).join('/').replace(/^\//, '');
const windows = process.platform === 'win32';
const frozenDirectoryMode = windows ? 0o444 : 0o555;
const powershell = (command, env = {}) => spawnSync(
  path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
  ['-NoProfile', '-NonInteractive', '-Command', command],
  { env: { SystemRoot: process.env.SystemRoot, ...env }, encoding: 'utf8', windowsHide: true, timeout: 10000 }
);

function assertPrivateWindowsDirectory(directory) {
  const result = powershell(String.raw`
$ErrorActionPreference = 'Stop'
$location = $env:TABLEU_CUE_VALIDATION_DIRECTORY
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$sidType = [Security.Principal.SecurityIdentifier]
$directory = Get-Acl -LiteralPath $location
if (!$directory.AreAccessRulesProtected) { exit 1 }
foreach ($acl in @($directory, (Get-Acl -LiteralPath (Join-Path $location 'config/runtime.json')))) {
  $rules = $acl.GetAccessRules($true, $true, $sidType)
  if ($acl.GetOwner($sidType).Value -ne $sid) { exit 1 }
  $userRules = @($rules | Where-Object { $_.IdentityReference.Value -eq $sid })
  if ($userRules.Count -ne 1 -or $userRules[0].FileSystemRights -ne 'FullControl') { exit 1 }
  foreach ($rule in $rules) {
    if ($rule.IdentityReference.Value -ne $sid -and !($rule.IdentityReference.Value -eq 'S-1-3-4' -and $rule.FileSystemRights -eq 'Synchronize')) { exit 1 }
  }
}
`, { TABLEU_CUE_VALIDATION_DIRECTORY: directory });
  assert.equal(result.status, 0, result.stderr || 'validation state and inherited config are accessible only to their owner');
}

test('the launcher exports an import-inert offline runtime', () => {
  assert.equal(typeof runtime?.startReadingCueValidation, 'function', 'the authorized offline runtime is missing');
});

test('strict options reject implicit, protected, duplicated and nonlocal listeners before creating state', async t => {
  const parent = await temporary(t);
  const ports = { frontend: 5317, api: 8817, optimized: 5318, inspector: 9317 };
  for (const change of [{ ports: undefined }, { ports: { ...ports, frontend: 0 } },
    { ports: { ...ports, api: 8787 } }, { ports: { ...ports, api: 5175 } },
    { ports: { ...ports, api: 8789 } }, { ports: { ...ports, api: 9235 } },
    { ports: { ...ports, api: 5317 } }, { ports: { ...ports, api: '8817' } },
    { host: '0.0.0.0' }, { sourceHead: 'stale' }, { live: true, explicitProviders: {}, budget: {} }, { signal: AbortSignal.abort() }]) {
    const privateDirectory = path.join(parent, 'run');
    await assert.rejects(runtime.startReadingCueValidation({ ...options(privateDirectory, ports), ...change }));
    await missing(privateDirectory);
  }
});

test('environment construction drops host providers, dotenv controls, proxies and arbitrary Vite fields', () => {
  const directory = path.resolve('/private');
  const env = runtime.validationEnvironment(directory, { PATH: '/usr/bin', HOME: '/host',
    NODE_OPTIONS: '--require /host/malicious.js', VITE_CANARY: 'host-canary', ANTHROPIC_API_KEY: 'synthetic',
    CLOUDFLARE_API_TOKEN: 'synthetic', HTTPS_PROXY: 'https://example.invalid', XDG_CONFIG_HOME: '/host/config' });
  assert.equal(env.HOME, path.join(directory, 'home'));
  assert.equal(env.XDG_CONFIG_HOME, path.join(directory, 'home/config'));
  assert.equal(env.TMPDIR, path.join(directory, 'tmp'));
  assert.equal(env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, 'false');
  assert.equal(env.VITE_READING_GESTURES, 'true');
  for (const key of ['NODE_OPTIONS', 'VITE_CANARY', 'ANTHROPIC_API_KEY', 'CLOUDFLARE_API_TOKEN', 'HTTPS_PROXY']) assert.equal(env[key], undefined);
});

test('source capture copies only enumerated files, rejects links/private names and remains immutable after original edits', async t => {
  const dir = await temporary(t);
  const source = path.join(dir, 'original'); const snapshot = path.join(dir, 'snapshot');
  await mkdir(source); await mkdir(path.join(source, 'src'));
  await writeFile(path.join(source, 'index.html'), 'original');
  await writeFile(path.join(source, 'src', 'main.jsx'), 'dirty-source');
  await writeFile(path.join(source, 'ignored-secret.json'), 'must-never-copy');
  const result = await runtime.captureValidationSource({ root: source, destination: snapshot, paths: ['index.html', 'src/main.jsx'] });
  await writeFile(path.join(source, 'src', 'main.jsx'), 'later-source');
  assert.equal(await readFile(path.join(snapshot, 'src', 'main.jsx'), 'utf8'), 'dirty-source');
  await missing(path.join(snapshot, 'ignored-secret.json'));
  assert.equal((await stat(path.join(snapshot, 'src', 'main.jsx'))).mode & 0o777, 0o444);
  assert.equal((await stat(snapshot)).mode & 0o777, frozenDirectoryMode);
  assert.equal(result.files.length, 2);
  await assert.rejects(runtime.captureValidationSource({ root: source, destination: path.join(dir, 'deny'), paths: ['.env'] }));
  await symlink(path.join(source, 'ignored-secret.json'), path.join(source, 'src', 'link.js'));
  await assert.rejects(runtime.captureValidationSource({ root: source, destination: path.join(dir, 'link'), paths: ['src/link.js'] }));
  await runtime.removeValidationDirectory(snapshot);
});

test('occupied caller-owned port refuses startup without killing the foreign listener or leaving state', async t => {
  const dir = await temporary(t); const ports = await freePorts();
  const server = http.createServer((_req, res) => res.end('foreign-control'));
  await new Promise(resolve => server.listen(ports.api, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const privateDirectory = path.join(dir, 'run');
  await assert.rejects(runtime.startReadingCueValidation(options(privateDirectory, ports)), /port|listen|EADDRINUSE/i);
  assert.equal(await (await fetch(`http://127.0.0.1:${ports.api}`)).text(), 'foreign-control');
  await missing(privateDirectory);
});

test('snapshot identity reports modified and untracked allowlisted files in a disposable repository', async t => {
  const dir = await temporary(t);
  const source = path.join(dir, 'repo');
  const destination = path.join(dir, 'snapshot');
  await mkdir(source);
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: source, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  await writeFile(path.join(source, 'clean.js'), 'original');
  await writeFile(path.join(source, 'changed.js'), 'original');
  git('add', 'clean.js', 'changed.js');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  await writeFile(path.join(source, 'changed.js'), 'edited');
  await writeFile(path.join(source, 'new.js'), 'new');
  try {
    const { files } = await runtime.captureValidationSource({ root: source, destination, paths: ['clean.js', 'changed.js', 'new.js'] });
    await writeFile(path.join(source, 'changed.js'), 'original');
    assert.deepEqual(runtime.dirtyValidationPaths(source, head, files), ['changed.js', 'new.js']);
  } finally { await runtime.removeValidationDirectory(destination); }
});

test('cold startup serves callable development JSX after the production build, with optimized DEV false', { timeout: 180000 }, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-cold-jsx-test-')); const ports = await freePorts();
  const privateDirectory = path.join(dir, 'run');
  await missing(path.join(privateDirectory, 'vite-cache'));
  const started = runtime.startReadingCueValidation({ ...options(privateDirectory, ports), signal: t.signal });
  const startupFailure = new AbortController();
  const observerSignal = AbortSignal.any([t.signal, startupFailure.signal]);
  let startupSettled = false;
  void started.then(() => { startupSettled = true; }, error => startupFailure.abort(error));
  t.after(async () => {
    try { const owned = await started.catch(() => null); await owned?.close(); }
    finally { await rm(dir, { recursive: true, force: true }); }
  });
  // Request the first entry as soon as the real frontend listener is acquired.
  // Its availability must follow the production build; there is no mock server,
  // warmed optimizer cache, or delay chosen to hide the original startup race.
  const origin = `http://127.0.0.1:${ports.frontend}`;
  const observerNow = Date.now.bind(Date);
  let observerClockAdvanced = false;
  let firstFrontendIdentity;
  while (firstFrontendIdentity === undefined) {
    observerSignal.throwIfAborted();
    const startupWasSettled = startupSettled;
    try {
      // The first accepted request verifies the whole build. Keep it alive
      // until that response, a startup failure, or the test's own deadline.
      const response = await fetch(`${origin}/__cue_validation_identity`, { signal: observerSignal });
      firstFrontendIdentity = { status: response.status, body: await response.json() };
    } catch (error) {
      observerSignal.throwIfAborted();
      // Readiness can overtake a refusal from a probe begun during startup.
      if (startupWasSettled) throw error;
      // Exercise startup beyond the observer's old 60-second cutoff without
      // sleeping or warming the real build, optimizer, or JSX dependency graph.
      if (!observerClockAdvanced) {
        t.mock.method(Date, 'now', () => observerNow() + 61000);
        observerClockAdvanced = true;
      }
    }
    if (firstFrontendIdentity !== undefined) break;
    // The runtime owns the bounded startup deadline. A shorter observer timeout
    // would reject a valid build before the runtime can report ready or failed.
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const entry = await fetch(`${origin}/src/main.jsx`);
  assert.equal(entry.status, 200);
  const transformed = await entry.text();
  const owned = await started;
  assert.equal(observerClockAdvanced, true, 'observe the real cold listener while startup is still pending');
  const dependencyPath = transformed.match(/["']([^"']*\/react_jsx-dev-runtime\.js(?:\?[^"']*)?)["']/)?.[1];
  assert.ok(dependencyPath, 'development entry must import the actual optimized JSX development runtime');
  const modules = new Map();
  const captureDependency = async dependencyUrl => {
    const url = new URL(dependencyUrl, origin);
    assert.equal(url.origin, origin);
    assert.ok(decodeURIComponent(url.pathname).startsWith(viteFileUrl(path.join(privateDirectory, 'vite-cache/deps')) + '/'), url.pathname);
    const filename = path.basename(url.pathname);
    assert.match(filename, /\.js$/);
    if (modules.has(url.href)) return;
    const response = await fetch(url);
    assert.equal(response.status, 200, `actual optimized dependency ${filename}`);
    const code = await response.text();
    // Keep served bytes intact, including Vite's rewritten absolute /@fs imports.
    modules.set(url.href, code);
    for (const match of code.matchAll(/(?:from\s*|import\s*)["']((?:\.\/|\/@fs\/)[^"']+)["']/g)) {
      await captureDependency(new URL(match[1], url));
    }
  };
  await captureDependency(dependencyPath);
  // A Node module linker executes the actual response graph without rewriting
  // imports or substituting the installed package for the served dependency.
  const execute = `import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { createContext, SourceTextModule } from 'node:vm';
    import { renderToStaticMarkup } from 'react-dom/server';
    const { entry, modules: source } = JSON.parse(readFileSync(0, 'utf8'));
    const context = createContext({ console, setTimeout, clearTimeout });
    const modules = new Map(source.map(([identifier, code]) => [identifier, new SourceTextModule(code, { identifier, context })]));
    const runtime = modules.get(entry);
    await runtime.link((specifier, parent) => {
      const identifier = new URL(specifier, parent.identifier).href;
      assert.ok(modules.has(identifier), 'Uncaptured actual dependency ' + identifier);
      return modules.get(identifier);
    });
    await runtime.evaluate();
    const jsxDEV = runtime.namespace.default?.jsxDEV ?? runtime.namespace.jsxDEV;
    assert.equal(typeof jsxDEV, 'function', 'cold optimized development React runtime must expose callable jsxDEV');
    const element = jsxDEV('main', { 'data-testid': 'cold-jsx-runtime', children: 'Fixture mountable' }, undefined, false);
    assert.equal(renderToStaticMarkup(element), '<main data-testid="cold-jsx-runtime">Fixture mountable</main>');`;
  const evaluated = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', execute], {
    cwd: root, input: JSON.stringify({ entry: new URL(dependencyPath, origin).href, modules: [...modules] }), encoding: 'utf8', timeout: 30000
  });
  assert.equal(evaluated.status, 0, evaluated.stderr || evaluated.error?.message);
  assert.equal(firstFrontendIdentity.status, 200, 'the first acquired frontend listener must already have completed optimized output');
  assert.equal(firstFrontendIdentity.body.outputIntegrity, true);
  const frontendIdentity = await (await fetch(`${origin}/__cue_validation_identity`)).json();
  assert.deepEqual(frontendIdentity.servingFlags, { dev: true, prod: false, mode: 'development' });
  const optimizedIdentity = await (await fetch(`${owned.origins.optimized}/__cue_validation_identity`)).json();
  assert.deepEqual(optimizedIdentity.servingFlags, { dev: false, prod: true, mode: 'reading-cue-validation' });
  assert.deepEqual(optimizedIdentity.optimizedFlags, { dev: false, prod: true, mode: 'reading-cue-validation' });
  assert.equal(optimizedIdentity.outputIntegrity, true);
  assert.equal(optimizedIdentity.outputDigest, owned.buildIdentity.outputDigest);
});

test('owned runtime serves frozen allowlisted source, fails APIs closed, provisions private D1 and removes every listener', { timeout: 180000 }, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-runtime-live-test-')); const ports = await freePorts();
  const privateDirectory = path.join(dir, 'run');
  const canary = 'synthetic-private-cue-canary';
  const canaryContent = `VITE_DOTENV_CANARY=${canary}`;
  const canaryPaths = ['.env.local', '.dev.vars', '.npmrc', 'public/.env', 'public/cue-private-ignored.json'];
  // Real checkouts track .npmrc and may hold a private .dev.vars. Never replace
  // or remove an existing file: it becomes a nondisclosure probe, and cleanup
  // removes only the canaries this test created. A file holding exactly the
  // canary is a leftover from a killed run of this test, so it is reclaimed.
  const created = []; const existing = [];
  t.after(async () => { for (const name of created) await rm(path.join(root, name), { force: true }); });
  for (const name of canaryPaths) {
    try { await writeFile(path.join(root, name), canaryContent, { flag: 'wx' }); created.push(name); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const content = (await readFile(path.join(root, name), 'utf8')).trim();
      if (content === canaryContent) created.push(name); else if (content) existing.push(content);
    }
  }
  const outside = path.join(dir, 'outside.txt'); await writeFile(outside, canary);
  const link = path.join(root, 'public/cue-private-link.txt');
  const leftover = await readlink(link).catch(() => null);
  if (leftover !== null && path.basename(path.dirname(leftover)).startsWith('cue-runtime-live-test-')) await rm(link);
  await symlink(outside, link); created.push('public/cue-private-link.txt');
  const originalEnv = process.env.VITE_HOST_CANARY;
  process.env.VITE_HOST_CANARY = 'synthetic-host-canary';
  t.after(() => { if (originalEnv === undefined) delete process.env.VITE_HOST_CANARY; else process.env.VITE_HOST_CANARY = originalEnv; });
  const owned = await runtime.startReadingCueValidation(options(privateDirectory, ports));
  t.after(async () => { await owned.close(); await rm(dir, { recursive: true, force: true }); });
  assert.equal(owned.origins.frontend, `http://127.0.0.1:${ports.frontend}`);
  assert.equal(owned.origins.optimized, `http://127.0.0.1:${ports.optimized}`);
  assert.equal(owned.buildIdentity.apiMode, 'offline-fail-closed');
  assert.equal(owned.buildIdentity.mode, 'reading-cue-validation');
  assert.equal(owned.buildIdentity.dev, false);
  assert.equal(owned.buildIdentity.expectedHead, sourceHead);
  assert.equal(owned.ownedResources.database.provisioned, true);
  assert.equal(owned.ownedResources.database.usedByBrowser, false);
  if (windows) assertPrivateWindowsDirectory(privateDirectory);
  else assert.equal((await stat(privateDirectory)).mode & 0o777, 0o700);
  const dbFiles = async directory => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await dbFiles(location)); else files.push(location);
    }
    return files;
  };
  const sqliteFiles = (await dbFiles(path.join(privateDirectory, 'state'))).filter(file => file.endsWith('.sqlite'));
  const identities = [];
  for (const file of sqliteFiles) {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      if (database.prepare("SELECT name FROM sqlite_master WHERE name = 'runtime_identity'").get()) {
        identities.push(...database.prepare('SELECT run_id FROM runtime_identity').all().map(row => row.run_id));
      }
    } finally { database.close(); }
  }
  assert.deepEqual(identities, [owned.buildIdentity.runId]);
  const secondRoot = path.join(dir, 'second-private');
  const second = await runtime.startReadingCueValidation(options(secondRoot, await freePorts()));
  try {
    assert.notEqual(second.buildIdentity.runId, owned.buildIdentity.runId);
    const secondIdentities = [];
    for (const file of (await dbFiles(path.join(secondRoot, 'state'))).filter(file => file.endsWith('.sqlite'))) {
      const database = new DatabaseSync(file, { readOnly: true });
      try {
        if (database.prepare("SELECT name FROM sqlite_master WHERE name = 'runtime_identity'").get()) {
          secondIdentities.push(...database.prepare('SELECT run_id FROM runtime_identity').all().map(row => row.run_id));
        }
      } finally { database.close(); }
    }
    assert.deepEqual(secondIdentities, [second.buildIdentity.runId]);
    assert.ok(!secondIdentities.includes(owned.buildIdentity.runId));
  } finally { await second.close(); }
  assert.deepEqual(owned.buildIdentity.optimizedFlags, { dev: false, prod: true, mode: 'reading-cue-validation' });
  // Independently recompute uncommitted allowlisted bytes with Git itself; the
  // assertion must not depend on which files happen to be dirty today. Hash the
  // captured snapshot, not the live tree, so a concurrent edit cannot fail it.
  const allowlist = JSON.parse(await readFile(path.join(root, 'scripts/lib/readingCueValidationSource.json'), 'utf8')).paths;
  const git = (args, input) => {
    const result = spawnSync('git', args, { cwd: root, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    return result.stdout;
  };
  const headBlobs = new Map(git(['ls-tree', '-z', '--full-tree', '-r', 'HEAD']).split('\0').filter(Boolean)
    .map(entry => [entry.slice(entry.indexOf('\t') + 1), entry.slice(0, entry.indexOf('\t')).split(' ')[2]]));
  const filenames = allowlist.map(file => path.join(privateDirectory, 'source', file));
  const rawBlobs = git(['hash-object', '--no-filters', '--stdin-paths'], filenames.join('\n') + '\n').trim().split('\n').filter(Boolean);
  assert.equal(rawBlobs.length, allowlist.length);
  assert.deepEqual([...owned.buildIdentity.dirtyPaths].sort(), allowlist.filter((file, index) => headBlobs.get(file) !== rawBlobs[index]).sort());
  const envModule = await (await fetch(`${owned.origins.frontend}/src/lib/readingGestureSettings.js`)).text();
  assert.ok(!envModule.includes('VITE_HOST_CANARY')); assert.ok(!envModule.includes('VITE_DOTENV_CANARY'));
  assert.equal(owned.buildIdentity.sourceAllowlistVersion, 'reading-local-acceptance-v8');
  assert.match(envModule, /"DEV":\s*true/);
  for (const origin of Object.values(owned.origins)) {
    for (const url of ['/api/auth/me', '/api/tarot-reading/jobs', '/api/reading-visual/stream']) {
      const response = await fetch(origin + url, { method: 'POST' });
      assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { error: 'offline_api_unconfigured' });
    }
  }
  assert.equal((await fetch(`${owned.origins.frontend}/src/main.jsx`)).status, 200);
  const dependencyRoot = await realpath(path.join(root, 'node_modules'));
  const font = '/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2';
  for (const url of [`/node_modules${font}`, viteFileUrl(path.join(dependencyRoot, font))]) {
    const response = await fetch(owned.origins.frontend + url);
    assert.equal(response.status, 200, `allowed dependency ${url}`);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  const deliveryManifest = JSON.parse(await readFile(path.join(root, 'public/images/cards/rws-vector/manifest.json'), 'utf8'));
  const face = await fetch(`${owned.origins.frontend}/images/cards/rws-vector/${deliveryManifest.cards[0].filename}`);
  assert.equal(face.status, 200); assert.match(face.headers.get('content-type'), /image\/webp/);
  assert.equal((await face.arrayBuffer()).byteLength, deliveryManifest.cards[0].bytes);
  assert.equal((await fetch(`${owned.origins.frontend}/images/cards/rws-vector/manifest.json`)).status, 200);
  const transformed = await (await fetch(`${owned.origins.frontend}/src/main.jsx`)).text();
  assert.ok(!transformed.includes('synthetic-host-canary'));
  const optimized = await (await fetch(owned.origins.optimized)).text();
  assert.match(optimized, /assets\/app-/);
  for (const origin of [owned.origins.frontend, owned.origins.optimized]) {
    for (const url of ['/.env?raw', '/.npmrc', '/.git/config', '/.dev.vars?import', '/%2eenv', '/private/config/runtime.json',
      viteFileUrl(path.join(privateDirectory, 'config', 'runtime.json')) + '?raw', viteFileUrl(path.join(root, 'src', 'main.jsx')) + '?import',
      '/__e2e/not-a-source-file.js', '/cue-private-ignored.json', '/cue-private-link.txt', viteFileUrl(outside) + '?raw',
      viteFileUrl(path.join(root, '.env.local')) + '?import&raw', '/%2eenv?raw', '/.npmrc?url']) {
      const response = await fetch(origin + url);
      assert.notEqual(response.status, 200, `${origin}${url}`);
      const body = await response.text(); assert.ok(!body.includes('synthetic-host-canary')); assert.ok(!body.includes(canary));
      assert.ok(existing.every(content => !body.includes(content)), `${origin}${url} disclosed an existing private file`);
    }
    const foreign = await new Promise((resolve, reject) => {
      http.get(origin, { headers: { Host: 'foreign.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); }).on('error', reject);
    });
    assert.equal(foreign, 403);
  }
  assert.notEqual((await fetch(`${owned.origins.optimized}/__e2e/reading-gestures`)).status, 200);
  const closed = await owned.close(); assert.deepEqual(await owned.close(), closed);
  assert.equal(closed.childExited, true); assert.equal(closed.sourceIntegrity, true); assert.equal(closed.outputIntegrity, true);
  await missing(privateDirectory);
  for (const port of Object.values(ports)) {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
    await new Promise(resolve => server.close(resolve));
  }
});

test('private ownership rejects nonempty paths and symlinked ancestors without deleting sentinels', async t => {
  const dir = await temporary(t); const ports = await freePorts();
  const nonempty = path.join(dir, 'foreign'); await mkdir(nonempty);
  await writeFile(path.join(nonempty, 'sentinel'), 'foreign-keep');
  await assert.rejects(runtime.startReadingCueValidation(options(nonempty, ports)), /new or empty/);
  assert.equal(await readFile(path.join(nonempty, 'sentinel'), 'utf8'), 'foreign-keep');
  await symlink(nonempty, path.join(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(runtime.startReadingCueValidation(options(path.join(dir, 'link/run'), ports)), /Symlink/);
  const protectedPaths = process.platform === 'win32' ? [root, root.toUpperCase()] : [root];
  for (const protectedPath of protectedPaths) {
    await assert.rejects(async () => {
      const unexpected = await runtime.startReadingCueValidation(options(path.join(protectedPath, 'private-state'), ports));
      await unexpected.close();
    }, /outside/);
  }
  // A linked worktree can live on another drive from the main checkout.
  const list = spawnSync('git', ['worktree', 'list', '--porcelain', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(list.status, 0);
  const primary = list.stdout.split('\0')[0].slice('worktree '.length);
  await assert.rejects(runtime.startReadingCueValidation(options(primary, ports)), /outside/);
  await assert.rejects(runtime.startReadingCueValidation({ ...options(path.join(dir, 'stale'), ports), sourceHead: '0'.repeat(40) }), /stale/);
  await missing(path.join(dir, 'stale'));
});

test('a late racing optimized bind failure closes previously acquired processes/state and preserves its new foreign owner', { timeout: 180000 }, async t => {
  const dir = await temporary(t); const ports = await freePorts(); const privateDirectory = path.join(dir, 'run');
  const started = runtime.startReadingCueValidation(options(privateDirectory, ports));
  // Attach the rejection observer immediately; the test then deliberately races the late listener.
  const rejected = assert.rejects(started, /startup|EADDRINUSE|listen/i);
  const deadline = Date.now() + 30000;
  while (true) {
    try { if ((await fetch(`http://127.0.0.1:${ports.api}/api/test`)).status === 503) break; } catch { /* not bound yet */ }
    if (Date.now() > deadline) throw new Error('Owned API never acquired for racing bind test');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const foreign = http.createServer((_req, response) => response.end('racing-foreign-control'));
  await new Promise((resolve, reject) => foreign.once('error', reject).listen(ports.optimized, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  await rejected;
  assert.equal(await (await fetch(`http://127.0.0.1:${ports.optimized}`)).text(), 'racing-foreign-control');
  await missing(privateDirectory);
  for (const port of [ports.api, ports.frontend, ports.inspector]) {
    const check = net.createServer();
    await new Promise((resolve, reject) => check.once('error', reject).listen(port, '127.0.0.1', resolve));
    await new Promise(resolve => check.close(resolve));
  }
});

const startupCancellation = process.platform === 'win32' ? ['AbortSignal'] : ['SIGINT', 'SIGTERM'];
for (const signal of startupCancellation) test(`${signal} during acquired startup closes owned processes and private state within its deadline`, { timeout: 60000 }, async t => {
  const dir = await temporary(t); const ports = await freePorts(); const privateDirectory = path.join(dir, 'run');
  const useIpc = signal === 'AbortSignal';
  const script = `import { startReadingCueValidation } from ${JSON.stringify(new URL('../scripts/dev-reading-cue-validation.mjs', import.meta.url).href)};
    const controller = new AbortController();
    if (process.connected) process.once('message', () => controller.abort());
    try { await startReadingCueValidation({ ...${JSON.stringify(options(privateDirectory, ports))}, signal: controller.signal }); }
    catch (error) { if (!/startup cancelled/.test(error?.message || '')) throw error; }
    finally { if (process.connected) process.disconnect(); }`;
  const stdio = useIpc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'];
  const harness = spawn(process.execPath, ['--input-type=module', '-e', script], { cwd: root, env: { PATH: process.env.PATH }, stdio });
  let exited = false; const exit = new Promise(resolve => harness.once('exit', (code, signal) => { exited = true; resolve({ code, signal }); }));
  t.after(async () => { if (!exited) { harness.kill('SIGTERM'); await exit; } });
  harness.stdout.resume(); harness.stderr.resume();
  const deadline = Date.now() + 30000;
  while (true) {
    try { if ((await fetch(`http://127.0.0.1:${ports.api}/api/test`)).status === 503) break; } catch { /* startup still acquiring */ }
    if (Date.now() > deadline || exited) throw new Error('Disposable harness failed before owned acquisition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const started = Date.now();
  if (useIpc) harness.send('abort');
  else harness.kill(signal);
  let timer;
  try {
    const result = await Promise.race([exit, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Signal cleanup exceeded 15 seconds')), 15000); })]);
    assert.equal(result.code, 0); assert.equal(result.signal, null); assert.ok(Date.now() - started < 15000);
  } finally { clearTimeout(timer); }
  await missing(privateDirectory);
  for (const port of Object.values(ports)) {
    const check = net.createServer(); await new Promise((resolve, reject) => check.once('error', reject).listen(port, '127.0.0.1', resolve));
    await new Promise(resolve => check.close(resolve));
  }
});

test('premature child death closes its descendants and retained ownership before removing private state', { timeout: 180000 }, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-child-death-test-')); const ports = await freePorts();
  const privateDirectory = path.join(dir, 'run');
  const started = runtime.startReadingCueValidation(options(privateDirectory, ports));
  t.after(async () => {
    const owned = await started.catch(() => null);
    await owned?.close();
    await rm(dir, { recursive: true, force: true });
  });
  const owned = await started;
  let descendants = [];
  if (windows) {
    const result = powershell(
      `Get-CimInstance -ClassName Win32_Process -Filter 'ParentProcessId = ${owned.ownedResources.pid}' | Select-Object Name,ProcessId | ConvertTo-Json -Compress`
    );
    assert.equal(result.status, 0, result.stderr);
    descendants = [JSON.parse(result.stdout)].flat();
    assert.ok(descendants.some(child => child.Name === 'workerd.exe'), 'the owned D1 platform process is running');
  }
  process.kill(owned.ownedResources.pid, 'SIGKILL');
  const evidence = await owned.close();
  assert.equal(evidence.childExited, true); assert.equal(evidence.stateRemoved, true);
  await missing(privateDirectory);
  if (owned.ownedResources.processGroup) assert.throws(() => process.kill(-owned.ownedResources.processGroup, 0), { code: 'ESRCH' });
  for (const child of descendants) {
    assert.throws(() => process.kill(child.ProcessId, 0), { code: 'ESRCH' }, `${child.Name} survived owner exit`);
  }
});

test('Windows job drains a detached grandchild after both ancestors exit', { skip: !windows, timeout: 30000 }, async t => {
  const directory = await temporary(t);
  const lib = path.join(directory, 'runner/scripts/lib');
  await mkdir(lib, { recursive: true });
  await mkdir(path.join(directory, 'tmp'));
  await copyFile(new URL('../scripts/lib/readingCueWindowsJob.cs', import.meta.url), path.join(lib, 'readingCueWindowsJob.cs'));
  const intermediate = `const { spawn } = require('node:child_process');
    const leaf = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 45000)'], { detached: true, stdio: 'ignore' });
    console.log(leaf.pid);
    leaf.unref();`;
  const fixture = `import { windowsJobAssigned } from ${JSON.stringify(new URL('../scripts/lib/readingCueValidationChild.mjs', import.meta.url))};
    import { execFileSync } from 'node:child_process';
    if (await windowsJobAssigned()) {
      const pid = Number(execFileSync(process.execPath, ['-e', ${JSON.stringify(intermediate)}], { encoding: 'utf8' }).trim());
      process.send(pid);
      setTimeout(() => {}, 45000);
    }`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', fixture], { stdio: ['pipe', 'pipe', 'ignore', 'ipc'] });
  const exit = once(child, 'exit');
  const closeJob = runtime.watchWindowsJob(child, directory);
  try {
    const [grandchild] = await Promise.race([once(child, 'message'), exit.then(() => { throw new Error('Job fixture exited before creating its grandchild'); })]);
    assert.ok(Number.isInteger(grandchild) && grandchild > 0);
    child.kill();
    await exit;
    process.kill(grandchild, 0);
    await closeJob();
    assert.throws(() => process.kill(grandchild, 0), { code: 'ESRCH' });
  } finally {
    child.kill();
    await closeJob();
  }
});

test('a change during source capture rejects the entire snapshot before it can be served', { timeout: 30000 }, async t => {
  const dir = await temporary(t); const source = path.join(dir, 'source'); const destination = path.join(dir, 'captured');
  await mkdir(source); await writeFile(path.join(source, 'index.html'), 'before-capture');
  await writeFile(path.join(source, 'payload.js'), Buffer.alloc(32 * 1024 * 1024, 32));
  const captured = runtime.captureValidationSource({ root: source, destination, paths: ['index.html', 'payload.js'] });
  const rejected = assert.rejects(captured, /changed while capturing/);
  while (true) {
    try { await access(path.join(destination, 'index.html')); break; } catch { await new Promise(resolve => setTimeout(resolve, 1)); }
  }
  await writeFile(path.join(source, 'index.html'), 'changed-during-capture');
  await rejected;
});

for (const damage of ['mutation', 'deletion']) test(`optimized output ${damage} invalidates delivery, identity and cleanup`, {timeout:180000}, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-output-integrity-test-')); const privateDirectory = path.join(dir, 'run');
  const owned = await runtime.startReadingCueValidation(options(privateDirectory, await freePorts()));
  t.after(async () => { await owned.close(); await rm(dir, {recursive:true,force:true}); });
  const entry = owned.buildIdentity.outputFiles.find(file => /^assets\/app-.*\.js$/.test(file.path));
  const location = path.join(privateDirectory, 'build', entry.path);
  const original = await readFile(location);
  const before = await (await fetch(owned.origins.optimized + '/__cue_validation_identity')).json();
  const fileMode = (await stat(location)).mode & 0o777;
  const directoryMode = (await stat(path.dirname(location))).mode & 0o777;
  // Simulate owner/root tampering despite filesystem write protection.
  await chmod(location, 0o644);
  if (damage === 'mutation') { await writeFile(location, '/* synthetic-output-mutation */'); await chmod(location, 0o444); }
  else { await chmod(path.dirname(location), 0o755); await rm(location); }
  assert.notEqual((await fetch(owned.origins.optimized + '/' + entry.path)).status, 200);
  for (const origin of [owned.origins.frontend, owned.origins.optimized]) {
    const response = await fetch(origin + '/__cue_validation_identity');
    assert.equal(response.status, 503); assert.equal((await response.json()).outputIntegrity, false);
  }
  // Restoring bytes cannot rehabilitate evidence from the compromised runtime.
  if (damage === 'mutation') await chmod(location, 0o644);
  await writeFile(location, original); await chmod(location, 0o444); await chmod(path.dirname(location), 0o555);
  assert.equal((await fetch(owned.origins.optimized + '/__cue_validation_identity')).status, 503);
  assert.equal(before.listenerKind, 'optimized');
  assert.equal(before.servingOrigin, owned.origins.optimized);
  assert.equal(before.outputDigest, owned.buildIdentity.outputDigest);
  assert.equal(before.outputIntegrity, true);
  assert.deepEqual(before.optimizedFlags, {dev:false,prod:true,mode:'reading-cue-validation'});
  assert.equal(fileMode, 0o444);
  assert.equal(directoryMode, frozenDirectoryMode);
  const cleanup = await owned.close();
  assert.equal(cleanup.outputIntegrity, false); assert.match(cleanup.runtimeFailure, /output-integrity/);
  assert.equal(cleanup.sourceIntegrity, true); assert.equal(cleanup.childExited, true); assert.equal(cleanup.stateRemoved, true);
});
