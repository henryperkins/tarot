import { fork, spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, rmdir, symlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { verifyOutputIntegrity } from './lib/readingCueOutputIntegrity.mjs';

const sourceManifestBytes = readFileSync(new URL('./lib/readingCueValidationSource.json', import.meta.url));
const sourceManifest = JSON.parse(sourceManifestBytes);
const sourcePaths = Object.freeze(sourceManifest.paths);
const loadedEntrypointSha256 = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');

const root = fileURLToPath(new URL('..', import.meta.url));
const protectedPorts = new Set([8787, 5175, 8789, 9235]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const privateName = /(?:^|\/)(?:\.[^/]+|[^/]*\.(?:pem|crt|key)|(?:auth|credentials|sessions|logs|state))(?:\/|$)/i;
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

export function validationEnvironment(directory, source = process.env) {
  return { PATH: source.PATH || '/usr/bin:/bin', NODE_ENV: 'development', CI: 'true', NO_COLOR: '1',
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', HOME: path.join(directory, 'home'),
    XDG_CONFIG_HOME: path.join(directory, 'home/config'), XDG_CACHE_HOME: path.join(directory, 'home/cache'),
    XDG_DATA_HOME: path.join(directory, 'home/data'), XDG_STATE_HOME: path.join(directory, 'home/state'),
    TMPDIR: path.join(directory, 'tmp'), TMP: path.join(directory, 'tmp'), TEMP: path.join(directory, 'tmp'),
    WRANGLER_LOG_PATH: path.join(directory, 'logs/wrangler.log'), WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', VITE_READING_GESTURES: 'true' };
}

function validateOptions({ host, ports, privateDirectory, sourceHead, live, explicitProviders, budget }) {
  if (live || explicitProviders !== null || budget !== null) throw new Error('Only local offline validation is authorized; live dispatch is closed.');
  if (host !== '127.0.0.1') throw new Error('Offline validation requires the loopback host.');
  if (!ports || Object.keys(ports).sort().join(',') !== 'api,frontend,inspector,optimized'
    || Object.values(ports).some(value => !Number.isInteger(value) || value < 1 || value > 65535 || protectedPorts.has(value))
    || new Set(Object.values(ports)).size !== 4) throw new Error('Four distinct explicit nonprotected ports are required.');
  if (!privateDirectory || !path.isAbsolute(privateDirectory)) throw new Error('An absolute new privateDirectory is required.');
  if (!/^[a-f0-9]{40}$/.test(sourceHead || '')) throw new Error('An exact sourceHead is required.');
}

async function assertNoLinks(location) {
  const absolute = path.resolve(location);
  let current = path.parse(absolute).root;
  const segments = absolute.slice(current.length).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    current = path.join(current, segment);
    const metadata = await lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (metadata?.isSymbolicLink()) throw new Error('Symlinked source/private path rejected.');
  }
}

function restrictWindowsDirectory(directory, created) {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !path.isAbsolute(systemRoot)) throw new Error('Windows directory ACL verification is unavailable.');
  const powershell = path.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$location = $env:TABLEU_CUE_VALIDATION_DIRECTORY
$item = Get-Item -LiteralPath $location -Force
if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { exit 1 }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$sid = $identity.User
$owner = (Get-Acl -LiteralPath $location).GetOwner([Security.Principal.SecurityIdentifier])
# Elevated tokens can default new objects to the Administrators group.
# Only the directory exclusively created by this run may change ownership.
if ($owner.Value -ne $sid.Value -and !($env:TABLEU_CUE_CREATED -eq '1' -and $owner.IsWellKnown('BuiltinAdministratorsSid'))) { exit 1 }
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true, $false)
$rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.AddAccessRule($rule)
if ($identity.Owner.Value -ne $sid.Value) {
  # An elevated token can also make the group owner of newly created files.
  # An OWNER RIGHTS ACE suppresses the owner's implicit right to rewrite the DACL.
  $ownerRights = [Security.Principal.SecurityIdentifier]::new('S-1-3-4')
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($ownerRights, 'Synchronize', 'ContainerInherit,ObjectInherit', 'InheritOnly', 'Allow'))
}
Set-Acl -LiteralPath $location -AclObject $acl
if ((Get-Acl -LiteralPath $location).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { exit 1 }
if ($identity.Owner.Value -ne $sid.Value) { [Console]::Write($sid.Value) }
`;
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { SystemRoot: systemRoot, TABLEU_CUE_VALIDATION_DIRECTORY: directory, TABLEU_CUE_CREATED: created ? '1' : '0' },
    windowsHide: true, timeout: 10000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.status !== 0) throw new Error('Unable to set an owner-only ACL on the Windows validation directory.');
  return result.stdout.trim();
}

/** Explicit enumerated paths only: no glob, recursive source copy, dotenv or symlink following. */
export async function captureValidationSource({ root: sourceRoot, destination, paths = sourcePaths, signal = null }) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length) throw new Error('Invalid immutable source allowlist.');
  await assertNoLinks(sourceRoot);
  for (const filename of paths) {
    signal?.throwIfAborted();
    if (typeof filename !== 'string' || path.isAbsolute(filename) || filename.split('/').includes('..')
      || privateName.test(filename) || filename.includes('\\')) throw new Error('Private/escaping source path rejected.');
    await assertNoLinks(path.join(sourceRoot, filename));
    if (!(await lstat(path.join(sourceRoot, filename))).isFile()) throw new Error('Allowlisted source must be a regular file.');
  }
  await mkdir(destination, { mode: 0o700 });
  const files = [];
  for (const filename of paths) {
    signal?.throwIfAborted();
    const bytes = await readFile(path.join(sourceRoot, filename));
    const output = path.join(destination, filename);
    await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, bytes, { mode: 0o444, flag: 'wx' });
    files.push({ path: filename, sha256: hash(bytes), bytes: bytes.length,
      gitBlobSha1: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') });
  }
  // Detect original changes during capture, including changes to earlier files.
  for (const file of files) {
    signal?.throwIfAborted();
    await assertNoLinks(path.join(sourceRoot, file.path));
    if (hash(await readFile(path.join(sourceRoot, file.path))) !== file.sha256) throw new Error('Source changed while capturing immutable snapshot.');
  }
  await freezeDirectories(destination);
  return { files, digest: hash(JSON.stringify(files)) };
}

export function dirtyValidationPaths(sourceRoot, sourceHead, files) {
  const tree = spawnSync('git', ['ls-tree', '--full-tree', '-rz', sourceHead], {
    cwd: sourceRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH }
  });
  if (tree.status !== 0) throw new Error('Unable to identify HEAD source bytes.');
  const headBlobs = new Map(tree.stdout.split('\0').filter(Boolean).map(entry => {
    const tab = entry.indexOf('\t');
    return [entry.slice(tab + 1), entry.slice(0, tab).split(' ')[2]];
  }));
  return files.filter(file => headBlobs.get(file.path) !== file.gitBlobSha1).map(file => file.path);
}

async function freezeDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await freezeDirectories(path.join(directory, entry.name));
  }
  await chmod(directory, 0o555);
}

export async function removeValidationDirectory(directory) {
  const metadata = await lstat(directory).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (!metadata) return;
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Cleanup refuses an unowned symlink/file root.');
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeValidationDirectory(path.join(directory, entry.name));
  }
  await rm(directory, { recursive: true, force: true });
}

const listen = (server, port, host) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
});
const closeServer = server => new Promise(resolve => {
  if (!server.listening) return resolve();
  server.closeAllConnections?.(); server.close(resolve);
});

async function preflight(ports, host) {
  const handles = [];
  try {
    for (const port of Object.values(ports)) {
      const handle = net.createServer(); handles.push(handle);
      await listen(handle, port, host);
    }
  } finally { await Promise.all(handles.map(closeServer)); }
}

async function terminateChild(child) {
  if (!child) return true;
  if (!child.pid) return true; // A failed spawn never acquired a process.
  let exited = child.exitCode !== null || child.signalCode !== null;
  const exit = exited ? Promise.resolve(true) : new Promise(resolve => child.once('exit', () => { exited = true; resolve(true); }));
  const signal = value => {
    try {
      if (process.platform === 'win32') child.kill(value);
      else process.kill(-child.pid, value);
    }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const groupExists = () => {
    if (process.platform === 'win32') return false; // The Windows job is drained separately.
    try { process.kill(-child.pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  const boundedExit = async delay => {
    let timer;
    const result = await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => resolve(false), delay); })]);
    clearTimeout(timer); return result;
  };
  if (!exited && child.connected) child.send({ kind: 'close' }, () => {});
  if (!exited && !await boundedExit(5000)) {
    signal('SIGTERM');
    if (!await boundedExit(2000)) { signal('SIGKILL'); await boundedExit(2000); }
  }
  // A premature direct-child exit must not strand its workerd/esbuild descendants.
  if (groupExists()) {
    signal('SIGTERM');
    const deadline = Date.now() + 2000;
    while (groupExists() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (groupExists()) {
      signal('SIGKILL');
      const killedDeadline = Date.now() + 2000;
      while (groupExists() && Date.now() < killedDeadline) await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  if (!exited || groupExists()) throw new Error('Owned process group failed bounded shutdown; private state retained.');
  return true;
}

// The guard pins the fork's process handle, confirms its identity over the
// fork's pipes, then assigns it to a job before it can start any descendants.
export function watchWindowsJob(child, directory) {
  const systemRoot = process.env.SystemRoot;
  const guard = spawn(path.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; Add-Type -Path $env:TABLEU_CUE_JOB_SOURCE; exit ([ReadingCueJob]::Watch([int]$env:TABLEU_CUE_CHILD_PID))"], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
      env: { SystemRoot: systemRoot, TEMP: path.join(directory, 'tmp'), TMP: path.join(directory, 'tmp'),
        TABLEU_CUE_JOB_SOURCE: path.join(directory, 'runner/scripts/lib/readingCueWindowsJob.cs'), TABLEU_CUE_CHILD_PID: String(child.pid) }
    });
  // Either peer may already have exited when the other closes its pipe.
  child.stdin.on('error', () => {});
  guard.stdin.on('error', () => {});
  let assigned = false;
  createInterface({ input: guard.stdout }).on('line', line => {
    if (line === 'identify') child.stdin.write('identify\n');
    if (line === 'assigned') { assigned = true; child.stdin.end('assigned\n'); }
  });
  child.stdout.once('data', bytes => {
    if (bytes.toString() === '!') guard.stdin.write('identified\n');
  });
  const finished = new Promise(resolve => {
    guard.once('error', () => resolve(false));
    guard.once('close', code => { if (!assigned) child.stdin.end(); resolve(code === 0); });
  });
  return async () => {
    guard.stdin.end();
    const timeout = setTimeout(() => guard.kill(), 10000);
    try {
      if (!await finished && assigned) throw new Error('Windows job shutdown could not be verified; private state retained.');
    } finally { clearTimeout(timeout); }
  };
}

export async function startReadingCueValidation({ host = '127.0.0.1', ports, privateDirectory, sourceHead,
  live = false, explicitProviders = null, budget = null, signal } = {}) {
  validateOptions({ host, ports, privateDirectory, sourceHead, live, explicitProviders, budget });
  signal?.throwIfAborted();
  const actualHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
  if (actualHead.status !== 0 || actualHead.stdout.trim() !== sourceHead) throw new Error('Expected source HEAD is stale.');
  const directory = path.resolve(privateDirectory); const dependencies = await realpath(path.join(root, 'node_modules'));
  const worktrees = spawnSync('git', ['worktree', 'list', '--porcelain', '-z'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
  const primary = worktrees.stdout?.split('\0')[0];
  if (worktrees.status !== 0 || !primary?.startsWith('worktree ')) throw new Error('Unable to locate the primary checkout.');
  if ([root, dependencies, primary.slice('worktree '.length), '/home/ubuntu/tarot'].some(protectedRoot => within(protectedRoot, directory))) {
    throw new Error('Private state must be outside source, dependencies and the primary checkout.');
  }
  await assertNoLinks(directory);
  const existing = await lstat(directory).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing && (!existing.isDirectory() || (await readdir(directory)).length)) throw new Error('Private directory must be new or empty.');
  await preflight(ports, host);
  signal?.throwIfAborted();
  const runId = randomUUID(); let child; let snapshot; let runnerSnapshot; let created = false; let owned = false; let closing; let runtimeFailure = null; let outputFiles; let outputCompromised = false;
  let closeWindowsJob;
  const controller = new AbortController(); let starting = true; let finishStartup;
  const startupFinished = new Promise(resolve => { finishStartup = resolve; });
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      controller.abort();
      if (starting) await startupFinished;
      process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
      signal?.removeEventListener('abort', onSignal);
      let childExited;
      try { childExited = await terminateChild(child); }
      finally { await closeWindowsJob?.(); }
      let sourceIntegrity = true;
      for (const [folder, captured] of [['source', snapshot], ['runner', runnerSnapshot]]) if (captured) for (const file of captured.files) {
        try { if (hash(await readFile(path.join(directory, folder, file.path))) !== file.sha256) sourceIntegrity = false; } catch { sourceIntegrity = false; }
      }
      const outputIntegrity = !outputCompromised && (!outputFiles || await verifyOutputIntegrity(path.join(directory, 'build'), outputFiles));
      if (!outputIntegrity) runtimeFailure = 'output-integrity-mismatch';
      if (owned) {
        const marker = JSON.parse(await readFile(path.join(directory, '.owner.json'), 'utf8'));
        if (marker.runId !== runId) throw new Error('Cleanup ownership marker changed; state retained.');
        await removeValidationDirectory(directory);
      }
      return { runId, childExited, sourceIntegrity, outputIntegrity, stateRemoved: owned, runtimeFailure };
    })();
    return closing;
  };
  const onSignal = () => { void close().catch(() => { process.exitCode = 1; }); };
  try {
    if (!existing) {
      await mkdir(directory, { mode: 0o700 });
      created = true;
    }
    const explicitFileOwner = process.platform === 'win32' && restrictWindowsDirectory(directory, created);
    await chmod(directory, 0o700);
    await writeFile(path.join(directory, '.owner.json'), JSON.stringify({ runId }), { mode: 0o600, flag: 'wx' });
    owned = true;
    process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
    signal?.addEventListener('abort', onSignal, { once: true });
    if (signal?.aborted) onSignal();
    for (const name of ['config', 'state', 'home/config', 'home/cache', 'home/data', 'home/state', 'tmp', 'logs', 'vite-cache', 'build']) {
      await mkdir(path.join(directory, name), { recursive: true, mode: 0o700 });
    }
    await writeFile(path.join(directory, 'config', '.env'), '', { mode: 0o600, flag: 'wx' });
    snapshot = await captureValidationSource({ root, destination: path.join(directory, 'source'), signal: controller.signal });
    controller.signal.throwIfAborted();
    await chmod(path.join(directory, 'source'), 0o700);
    await symlink(dependencies, path.join(directory, 'source', 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await chmod(path.join(directory, 'source'), 0o555);
    const runnerPaths = ['scripts/lib/readingCueValidationChild.mjs', 'scripts/lib/developmentServerSecurity.mjs', 'scripts/lib/readingCueOutputIntegrity.mjs'];
    if (process.platform === 'win32') runnerPaths.push('scripts/lib/readingCueWindowsJob.cs');
    runnerSnapshot = await captureValidationSource({ root, destination: path.join(directory, 'runner'), paths: runnerPaths, signal: controller.signal });
    await chmod(path.join(directory, 'runner'), 0o700);
    await symlink(dependencies, path.join(directory, 'runner/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await chmod(path.join(directory, 'runner'), 0o555);
    const capturedHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
    if (capturedHead.status !== 0 || capturedHead.stdout.trim() !== sourceHead) throw new Error('Source HEAD changed during capture.');
    const buildIdentity = { runId, expectedHead: sourceHead, actualHead: actualHead.stdout.trim(),
      dirtyPaths: dirtyValidationPaths(root, sourceHead, snapshot.files), snapshotDigest: snapshot.digest, sourceFiles: snapshot.files,
      lockfileSha256: snapshot.files.find(file => file.path === 'package-lock.json').sha256,
      runtimeSourceHashes: { entrypointSha256: loadedEntrypointSha256, runnerFiles: runnerSnapshot.files },
      sourceAllowlistVersion: sourceManifest.version, sourceAllowlistSha256: hash(sourceManifestBytes), sourceScope: sourceManifest.scope,
      mode: 'reading-cue-validation', dev: false, minify: 'esbuild', apiMode: 'offline-fail-closed',
      dataIdentity: 'unconfigured-offline-api', origins: Object.fromEntries(['frontend', 'api', 'optimized'].map(key => [key, `http://${host}:${ports[key]}`])) };
    const config = { directory, dependencies, ports, host, buildIdentity };
    const configPath = path.join(directory, 'config/runtime.json');
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
    if (explicitFileOwner) {
      const result = spawnSync(path.join(process.env.SystemRoot, 'System32/icacls.exe'), [configPath, '/setowner', '*' + explicitFileOwner],
        { windowsHide: true, timeout: 10000, stdio: 'ignore' });
      if (result.status !== 0) throw new Error('Unable to set the Windows runtime configuration owner.');
    }
    controller.signal.throwIfAborted();
    child = fork(path.join(directory, 'runner/scripts/lib/readingCueValidationChild.mjs'), [configPath],
      { cwd: path.join(directory, 'source'), detached: process.platform !== 'win32', execArgv: [],
        env: validationEnvironment(directory), silent: true });
    if (process.platform === 'win32' && child.pid) closeWindowsJob = watchWindowsJob(child, directory);
    // Bounded private log tail. Never embed private child output in public exceptions.
    let log = '';
    const append = chunk => { log = (log + chunk.toString()).slice(-65536); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Owned validation startup timed out.')), 120000);
      const finish = callback => value => { clearTimeout(timer); controller.signal.removeEventListener('abort', aborted); child.removeListener('message', ready); child.removeListener('exit', exit); child.removeListener('error', failed); callback(value); };
      const aborted = finish(() => reject(new Error('Owned validation startup cancelled.')));
      const ready = finish(value => { if (value?.kind === 'ready') resolve(value); else reject(new Error(`Owned validation startup failed: ${value?.error || 'inspect private logs'}`)); });
      const exit = finish(() => reject(new Error('Owned validation child exited during startup.')));
      const failed = finish(() => reject(new Error('Owned validation child could not launch.')));
      controller.signal.addEventListener('abort', aborted, { once: true });
      child.once('message', ready); child.once('exit', exit); child.once('error', failed);
    }).catch(async error => {
      await writeFile(path.join(directory, 'logs/child.log'), log, { mode: 0o600 }); throw error;
    });
    child.once('exit', (code, signal) => { if (!closing) { runtimeFailure = signal ? `child-signal-${signal}` : `child-exit-${code}`; void close().catch(() => { process.exitCode = 1; }); } });
    await writeFile(path.join(directory, 'logs/child.log'), log, { mode: 0o600 });
    Object.assign(buildIdentity, result.identity);
    outputFiles = result.identity.outputFiles;
    child.on('message', message => { if (message?.kind === 'integrity-failed') { outputCompromised = true; runtimeFailure = 'output-integrity-mismatch'; } });
    const ownedResources = { pid: child.pid, processGroup: process.platform !== 'win32' ? child.pid : null,
      listeners: result.listeners, inspector: { port: ports.inspector, reserved: true, measured: false },
      database: { provisioned: true, usedByBrowser: false, persistence: 'private-local-d1', remote: false } };
    controller.signal.throwIfAborted(); starting = false; finishStartup();
    return { origins: buildIdentity.origins, buildIdentity, ownedResources, close };
  } catch (error) {
    starting = false; finishStartup();
    await close();
    if (created && !owned) await rmdir(directory).catch(() => {});
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/dev-reading-cue-validation.mjs /absolute/owned-options.json');
  const owned = await startReadingCueValidation(JSON.parse(await readFile(process.argv[2], 'utf8')));
  // The caller retains this manifest exclusively; it contains no credential values.
  console.log(JSON.stringify({ origins: owned.origins, buildIdentity: owned.buildIdentity, ownedResources: owned.ownedResources }));
}
