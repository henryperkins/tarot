import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

const scripts = fileURLToPath(new URL('../scripts/evaluation/qualification/', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const minimalEnv = () => Object.fromEntries(['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
async function exists(file) { try { await readFile(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function running(pid) {
  try { return !(await readFile(`/proc/${pid}/stat`, 'utf8')).split(') ')[1].startsWith('Z'); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function waitFor(check, message) {
  const until = Date.now() + 6000;
  while (Date.now() < until) { if (await check()) return; await delay(15); }
  assert.fail(message);
}
function command(script, args, env = minimalEnv()) {
  const child = spawn('python3', [path.join(scripts, script), ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close');
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  return { child, closed, stderr: () => stderr };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'tableu-qualification-'));
  const pids = path.join(root, 'pids.json');
  const worker = path.join(root, 'worker.py');
  const source = `import os,pathlib,json,signal,subprocess,sys,time
root=pathlib.Path(__file__).parent
signal.signal(signal.SIGTERM,signal.SIG_IGN)
signal.signal(signal.SIGINT,signal.SIG_IGN)
grandchild=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);signal.signal(signal.SIGINT,signal.SIG_IGN);time.sleep(60)'],start_new_session=True,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
(root/'pids.json').write_text(json.dumps({'worker':os.getpid(),'descendant':grandchild.pid}))
while True:
 print('fixture-progress',flush=True)
 time.sleep(0.02)
`;
  await writeFile(worker, source);
  t.after(async () => {
    if (await exists(pids)) for (const pid of Object.values(await json(pids))) { try { process.kill(pid, 'SIGKILL'); } catch { /* Fixture process may already have exited. */ } }
    await rm(root, { recursive: true, force: true });
  });
  return { root, pids, worker };
}

async function captureFixture(t) {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'prompts'));
  const system = 'Controlled system fixture'; const user = 'Controlled input fixture';
  const systemFile = path.join(f.root, 'system.txt'); await writeFile(systemFile, system);
  const executable = path.join(f.root, 'fake-cli');
  await writeFile(executable, `#!/usr/bin/python3\nexec(compile(open(${JSON.stringify(f.worker)}).read(),${JSON.stringify(f.worker)},'exec'))\n`);
  await chmod(executable, 0o700);
  await writeFile(path.join(f.root, 'standard-transport.json'), JSON.stringify({ realClaudeExecutable: executable, model: 'fixture-model', effort: 'xhigh', maxOutputTokens: 32000, semanticCap: 1 }));
  await writeFile(path.join(f.root, 'generation-plan.json'), JSON.stringify({ executionOrder: [{ key: 'FIXTURE-candidate', action: 'generate' }] }));
  await writeFile(path.join(f.root, 'prompts/FIXTURE-candidate-receipt.json'), JSON.stringify({ systemSha256: hash(system), userSha256: hash(user) }));
  const args = [f.root, 'semantic', 'FIXTURE-candidate', '-p', '--model', 'fixture-model', '--effort', 'xhigh', '--tools', '', '--no-session-persistence', '--system-prompt-file', systemFile];
  return { ...f, user, args, capture: path.join(f.root, 'generations/cli/FIXTURE-candidate'), env: { ...minimalEnv(), CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000' } };
}
const linux = { skip: process.platform !== 'linux', timeout: 15000 };

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`qualification launcher records ${signal} and stops its detached descendants`, linux, async t => {
    const f = await fixture(t);
    const proc = command('run-check.py', [f.root, 'attempt', f.root, 'python3', f.worker]);
    proc.child.stdout.resume();
    t.after(() => { if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL'); });
    await waitFor(() => exists(f.pids), 'Controlled subprocess did not start');
    proc.child.kill(signal);
    const [code] = await proc.closed;
    const observedPids = await json(f.pids);
    t.diagnostic(JSON.stringify({ signal, receiptExists: await exists(path.join(f.root, 'attempt.json')), workerAlive: await running(observedPids.worker), descendantAlive: await running(observedPids.descendant) }));
    assert.equal(await exists(path.join(f.root, 'attempt.json')), true, 'Missing terminal receipt after launcher interruption');
    const receipt = await json(path.join(f.root, 'attempt.json'));
    assert.equal(code, signal === 'SIGTERM' ? 143 : 130);
    assert.equal(receipt.exit_code, code);
    assert.equal(receipt.cleanupComplete, true);
    const pids = await json(f.pids);
    assert.equal(await running(pids.worker), false, 'Worker survived interruption');
    assert.equal(await running(pids.descendant), false, 'Detached descendant survived interruption');
    assert.match(await readFile(path.join(f.root, 'attempt.log'), 'utf8'), /fixture-progress/);
  });
}

test('qualification launcher preserves an existing attempt instead of launching a retry', linux, async t => {
  const f = await fixture(t);
  const args = [f.root, 'once', f.root, 'python3', '-c', 'print("original output")'];
  const first = command('run-check.py', args); first.child.stdout.resume();
  assert.equal((await first.closed)[0], 0);
  const before = await readFile(path.join(f.root, 'once.json'));
  const log = await readFile(path.join(f.root, 'once.log'));
  const marker = path.join(f.root, 'retry-started');
  const retry = command('run-check.py', [f.root, 'once', f.root, 'python3', '-c', `open(${JSON.stringify(marker)},'w').write('retry')`]); retry.child.stdout.resume();
  assert.notEqual((await retry.closed)[0], 0);
  assert.equal(await exists(marker), false, 'A second attempt started');
  assert.deepEqual(await readFile(path.join(f.root, 'once.json')), before);
  assert.deepEqual(await readFile(path.join(f.root, 'once.log')), log);
});

test('qualification launcher writes failure receipt when the command cannot start', linux, async t => {
  const f = await fixture(t);
  const proc = command('run-check.py', [f.root, 'missing', f.root, '/no-such-tableu-test-command']); proc.child.stdout.resume();
  assert.notEqual((await proc.closed)[0], 0);
  assert.equal(await exists(path.join(f.root, 'missing.json')), true);
  assert.equal((await json(path.join(f.root, 'missing.json'))).cleanupComplete, true);
});

test('capture preserves a partial stream and kills its descendants when the consumer closes', linux, async t => {
  const f = await captureFixture(t);
  const proc = command('capture-claude.py', f.args, f.env);
  t.after(() => { if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL'); });
  proc.child.stdin.end(f.user);
  await waitFor(() => exists(f.pids), 'Controlled capture child did not start');
  proc.child.stdout.destroy();
  assert.notEqual((await proc.closed)[0], 0);
  const capture = path.join(f.root, 'generations/cli/FIXTURE-candidate');
  const observedPids = await json(f.pids);
  t.diagnostic(JSON.stringify({ downstreamClosed: true, receiptExists: await exists(path.join(capture, 'completion.json')), workerAlive: await running(observedPids.worker), descendantAlive: await running(observedPids.descendant) }));
  assert.equal(await exists(path.join(capture, 'completion.json')), true, 'Lost capture terminal receipt on BrokenPipe');
  const receipt = await json(path.join(capture, 'completion.json'));
  assert.equal(receipt.cleanupComplete, true);
  assert.equal(receipt.failure, 'downstream_closed');
  assert.match(await readFile(path.join(capture, 'stdout.jsonl'), 'utf8'), /fixture-progress/);
  for (const pid of Object.values(await json(f.pids))) assert.equal(await running(pid), false, 'Capture descendant survived BrokenPipe');
});

test('a successful capture forwards exact UTF-8 bytes and refuses a second attempt', linux, async t => {
  const f = await captureFixture(t);
  const stream = '{"fixture":"日本語 — literal bytes"}\n'.repeat(5000);
  await writeFile(f.worker, `import sys\nsys.stdin.read()\nsys.stdout.buffer.write(${JSON.stringify(stream)}.encode('utf-8'))\nsys.stdout.flush()\n`);
  const proc = command('capture-claude.py', f.args, f.env);
  let actual = ''; proc.child.stdout.setEncoding('utf8'); proc.child.stdout.on('data', value => { actual += value; });
  proc.child.stdin.end(f.user);
  assert.equal((await proc.closed)[0], 0, proc.stderr());
  assert.equal(actual, stream);
  const before = await readFile(path.join(f.capture, 'completion.json'));
  assert.equal(JSON.parse(before).rawOutputSha256, hash(stream));
  assert.equal(JSON.parse(before).cleanupComplete, true);
  const retry = command('capture-claude.py', f.args, f.env); retry.child.stdout.resume(); retry.child.stdin.end(f.user);
  assert.notEqual((await retry.closed)[0], 0);
  assert.deepEqual(await readFile(path.join(f.capture, 'completion.json')), before);
  assert.equal(await readFile(path.join(f.capture, 'stdout.jsonl'), 'utf8'), stream);
});

test('capture still refuses halted, wrong-prompt and paid-credential attempts before child startup', linux, async t => {
  for (const refusal of ['halt', 'prompt', 'credential']) {
    const f = await captureFixture(t);
    if (refusal === 'halt') await writeFile(path.join(f.root, 'manual-review-halt.json'), '{}');
    const proc = command('capture-claude.py', f.args, { ...f.env, ...(refusal === 'credential' ? { ANTHROPIC_API_KEY: 'fixture-not-a-key' } : {}) });
    proc.child.stdout.resume(); proc.child.stdin.end(refusal === 'prompt' ? 'changed input' : f.user);
    assert.notEqual((await proc.closed)[0], 0);
    assert.equal(await exists(f.pids), false);
    assert.equal(await exists(path.join(f.capture, 'request.json')), false);
  }
});

test('outer launcher interruption preserves the nested capture receipt and leaves an unrelated process running', linux, async t => {
  const f = await captureFixture(t);
  const sentinel = spawn('python3', ['-c', 'import time;time.sleep(60)'], { stdio: 'ignore' });
  t.after(() => { try { sentinel.kill('SIGKILL'); } catch { /* Fixture process may already have exited. */ } });
  const bridge = `import os,sys;os.environ['CLAUDE_CODE_MAX_OUTPUT_TOKENS']='32000';os.execv(sys.executable,[sys.executable,${JSON.stringify(path.join(scripts, 'capture-claude.py'))},*${JSON.stringify(f.args)}])`;
  const proc = command('run-check.py', [f.root, 'nested', f.root, 'python3', '-c', bridge]);
  proc.child.stdout.resume(); proc.child.stdin.end(f.user);
  t.after(() => { if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL'); });
  await waitFor(() => exists(f.pids), 'Nested capture did not start');
  proc.child.kill('SIGTERM');
  assert.equal((await proc.closed)[0], 143);
  if (!(await exists(path.join(f.capture, 'completion.json')))) {
    t.diagnostic(await readFile(path.join(f.root, 'nested.log'), 'utf8'));
    t.diagnostic(JSON.stringify(await json(path.join(f.root, 'nested.json'))));
  }
  const receipt = await json(path.join(f.capture, 'completion.json'));
  assert.equal(receipt.exitCode, 143);
  assert.equal(receipt.cleanupComplete, true);
  assert.equal((await json(path.join(f.root, 'nested.json'))).cleanupComplete, true);
  for (const pid of Object.values(await json(f.pids))) assert.equal(await running(pid), false);
  assert.equal(await running(sentinel.pid), true, 'Unrelated sibling process was stopped');
});


// Pause at actual filesystem boundaries without changing the production script.
async function barrierCommand(f, script, args, boundary, env = minimalEnv()) {
  const tracer = path.join(f.root, `barrier-${boundary}.py`);
  await writeFile(tracer, `import pathlib,runpy,sys,time
sys.dont_write_bytecode=True
script,root,boundary,*args=sys.argv[1:]
root=pathlib.Path(root)
original_open=pathlib.Path.open
original_mkdir=pathlib.Path.mkdir
def pause(name):
 (root/(name+'-ready')).write_text('ready')
 deadline=time.monotonic()+8
 while not (root/'release').exists():
  if time.monotonic()>deadline:raise RuntimeError('Fixture barrier expired')
  time.sleep(.005)
def observed_open(self,*args,**kwargs):
 value=original_open(self,*args,**kwargs)
 if boundary=='reservation' and self.name.endswith('-reservation.json'):pause('reservation')
 return value
def observed_mkdir(self,*args,**kwargs):
 target=self.parent.name=='cli' and self.name.endswith('-candidate')
 if target and boundary=='before-capture':pause(self.name)
 value=original_mkdir(self,*args,**kwargs)
 if target and boundary=='after-capture':pause(self.name)
 return value
pathlib.Path.open=observed_open
pathlib.Path.mkdir=observed_mkdir
sys.path.insert(0,str(pathlib.Path(script).parent))
sys.argv=[script,*args]
runpy.run_path(script,run_name='__main__')
`);
  const child = spawn('python3', [tracer, path.join(scripts, script), f.root, boundary, ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close'); let stderr = '';
  child.stderr.on('data', value => { stderr += value; }); child.stdout.resume();
  return { child, closed, stderr: () => stderr };
}

for (const [wrapper, signal] of ['launcher', 'capture'].flatMap(wrapper => ['SIGTERM', 'SIGINT'].map(signal => [wrapper, signal]))) {
  test(`${wrapper} records ${signal} immediately after reserving an attempt, before starting its child`, linux, async t => {
    const f = await captureFixture(t);
    const isCapture = wrapper === 'capture';
    const proc = await barrierCommand(f, isCapture ? 'capture-claude.py' : 'run-check.py',
      isCapture ? f.args : [f.root, 'startup', f.root, 'python3', f.worker],
      isCapture ? 'after-capture' : 'reservation', f.env);
    t.after(() => { if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL'); });
    proc.child.stdin.end(f.user);
    await waitFor(() => exists(path.join(f.root, isCapture ? 'FIXTURE-candidate-ready' : 'reservation-ready')), 'Startup barrier was not reached');
    proc.child.kill(signal);
    await delay(30);
    await writeFile(path.join(f.root, 'release'), 'release');
    const [code] = await proc.closed;
    const receiptPath = isCapture ? path.join(f.capture, 'completion.json') : path.join(f.root, 'startup.json');
    assert.equal(await exists(receiptPath), true, 'Reservation survived but terminal receipt was lost');
    const expectedCode = signal === 'SIGTERM' ? 143 : 130;
    assert.equal(code, expectedCode, proc.stderr());
    const receipt = await json(receiptPath);
    assert.equal(isCapture ? receipt.exitCode : receipt.exit_code, expectedCode);
    assert.equal(receipt.cleanupComplete, true);
    assert.equal(await exists(f.pids), false, 'An interrupted startup launched its child');
  });
}

test('concurrent distinct capture keys cannot exceed the shared attempt cap', linux, async t => {
  const f = await captureFixture(t);
  await writeFile(f.worker, `import pathlib,sys\nsys.stdin.read()\nwith (pathlib.Path(__file__).parent/'executions').open('a') as f:f.write('executed\\n')\nprint('local fixture')\n`);
  await writeFile(path.join(f.root, 'generation-plan.json'), JSON.stringify({ executionOrder: ['FIXTURE-candidate', 'SECOND-candidate'].map(key => ({ key, action: 'generate' })) }));
  await writeFile(path.join(f.root, 'prompts/SECOND-candidate-receipt.json'), await readFile(path.join(f.root, 'prompts/FIXTURE-candidate-receipt.json')));
  const first = await barrierCommand(f, 'capture-claude.py', f.args, 'before-capture', f.env);
  first.child.stdin.end(f.user);
  t.after(() => { if (first.child.exitCode === null && first.child.signalCode === null) first.child.kill('SIGKILL'); });
  await waitFor(() => exists(path.join(f.root, 'FIXTURE-candidate-ready')), 'First cap reservation barrier was not reached');
  const secondArgs = [...f.args]; secondArgs[2] = 'SECOND-candidate';
  const second = await barrierCommand(f, 'capture-claude.py', secondArgs, 'before-capture', f.env);
  second.child.stdin.end(f.user);
  t.after(() => { if (second.child.exitCode === null && second.child.signalCode === null) second.child.kill('SIGKILL'); });
  // The old implementation lets both reach mkdir after their cap check. A lock
  // makes the second wait until the first reservation becomes visible.
  await delay(250);
  await writeFile(path.join(f.root, 'release'), 'release');
  const exits = await Promise.all([first.closed, second.closed]);
  assert.equal(exits.filter(([code]) => code === 0).length, 1, 'Both attempts consumed a cap of one');
  assert.equal((await readFile(path.join(f.root, 'executions'), 'utf8')).trim().split('\n').length, 1);
});

test('capture finishes and drains owned descendants when its provider exits with stdout still inherited', linux, async t => {
  const f = await captureFixture(t);
  await writeFile(f.worker, `import os,pathlib,json,subprocess,sys\nroot=pathlib.Path(__file__).parent\nsys.stdin.read()\nchild=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(60)'],start_new_session=True)\n(root/'pids.json').write_text(json.dumps({'worker':os.getpid(),'descendant':child.pid}))\nprint('provider finished',flush=True)\n`);
  const proc = command('capture-claude.py', f.args, f.env);
  proc.child.stdout.resume(); proc.child.stdin.end(f.user);
  t.after(() => { if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL'); });
  await waitFor(() => exists(f.pids), 'Controlled child did not start');
  await waitFor(async () => !(await running((await json(f.pids)).worker)), 'Controlled provider did not exit');
  let neededExternalSignal = false;
  const fallback = setTimeout(() => { neededExternalSignal = true; proc.child.kill('SIGTERM'); }, 3000);
  t.after(() => clearTimeout(fallback));
  const [code] = await proc.closed; clearTimeout(fallback);
  assert.equal(neededExternalSignal, false, 'Capture stalled until an external signal despite provider exit');
  assert.equal(code, 0, proc.stderr());
  const receipt = await json(path.join(f.capture, 'completion.json'));
  assert.equal(receipt.providerExitCode, 0);
  assert.equal(receipt.cleanupComplete, true);
  assert.equal(await readFile(path.join(f.capture, 'stdout.jsonl'), 'utf8'), 'provider finished\n');
  for (const pid of Object.values(await json(f.pids))) assert.equal(await running(pid), false);
});

test('process ownership propagates an interruption during proc inspection', linux, async t => {
  const f = await fixture(t);
  const probe = `import sys,pathlib
sys.dont_write_bytecode=True
sys.path.insert(0,${JSON.stringify(scripts)})
from process_owner import process_table
def interrupted_read(*args,**kwargs):raise InterruptedError('controlled signal interruption')
pathlib.Path.read_text=interrupted_read
try:process_table()
except InterruptedError:sys.exit(0)
sys.exit('Interruption was swallowed as an ordinary missing-process read')
`;
  const proc = command('run-check.py', [f.root, 'proc-interrupt', f.root, 'python3', '-c', probe]);
  proc.child.stdout.resume();
  assert.equal((await proc.closed)[0], 0, proc.stderr());
});
