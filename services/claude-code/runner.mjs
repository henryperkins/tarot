import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CLAUDE_CODE_EFFORTS, CLAUDE_CODE_MAX_OUTPUT_BYTES, validateClaudeRequest, validateClaudeResult } from '../../shared/inference/claudeCode.js';

// Only these host settings reach the CLI. In particular, API credentials,
// third-party providers, gateway overrides, hooks and NODE_OPTIONS cannot leak in.
export function buildSubscriptionEnv(source = process.env) {
  const keys = ['HOME', 'PATH', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME'];
  return Object.fromEntries(keys.filter(key => typeof source[key] === 'string').map(key => [key, source[key]]));
}

function runProcess(executable, args, { env, cwd, input = '', signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Claude request was cancelled.')); return; }
    const child = spawn(executable, args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = '';
    let size = 0;
    let failure;
    let killTimer;
    const kill = signalName => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signalName);
        else child.kill(signalName);
      } catch { /* Already exited. */ }
    };
    const stop = error => {
      if (failure) return;
      failure = error;
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1500);
      killTimer.unref();
    };
    const onAbort = () => stop(new Error('Claude request was cancelled.'));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > CLAUDE_CODE_MAX_OUTPUT_BYTES) stop(new Error('Claude output exceeded the size limit.'));
      else stdout += chunk;
    });
    // Upstream stderr can contain prompts, account details, and credentials.
    child.stderr.resume();
    child.stdin.on('error', () => stop(new Error('Claude input could not be delivered.')));
    child.on('error', () => { failure = new Error('Claude Code could not be started. Check the CLI installation.'); });
    child.on('close', code => {
      // The CLI can exit on SIGTERM while a descendant keeps running with its
      // own stdio. Kill any remaining group members before releasing the slot.
      if (failure) kill('SIGKILL');
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', onAbort);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error('Claude Code request failed. Check subscription login and usage limits.'));
      else resolve(stdout);
    });
    child.stdin.end(input);
  });
}

export function parseClaudeOutput(output, responseSchema) {
  let model;
  let result;
  const actualModels = new Set();
  try {
    for (const line of output.split('\n').filter(line => line.trim())) {
      if (result) throw new Error();
      const event = JSON.parse(line);
      if (event.type === 'system' && event.subtype === 'init') model = event.model;
      if (event.type === 'assistant' && typeof event.message?.model === 'string' && event.message.model) {
        actualModels.add(event.message.model);
      }
      if (event.type === 'result') {
        if (result) throw new Error();
        result = event;
      }
    }
  } catch { throw new Error('Claude returned an incomplete response.'); }
  // The CLI implements --json-schema through its own StructuredOutput tool.
  // A successful terminal result may therefore stop at tool_use. This is valid
  // only for requested structured output, which is schema-validated below.
  const structuredCompletion = responseSchema && result?.structured_output && result?.stop_reason === 'tool_use';
  if (!result || result.subtype !== 'success' || result.is_error !== false
    || (result.stop_reason && !['end_turn', 'stop_sequence'].includes(result.stop_reason) && !structuredCompletion)) {
    throw new Error('Claude Code request failed or returned an incomplete response.');
  }
  for (const usedModel of Object.keys(result.modelUsage || {})) actualModels.add(usedModel);
  if (actualModels.size > 1) throw new Error('Claude returned output from multiple models.');
  if (actualModels.size === 1) model = [...actualModels][0];
  return validateClaudeResult({
    provider: 'claude-code',
    text: typeof result.result === 'string' ? result.result.trim() : '',
    structured: result.structured_output ?? null,
    model, usage: result.usage || {}
  }, responseSchema);
}

const COMMON_ARGS = ['--safe-mode', '--setting-sources', ''];

// Confirms the host is logged into a Claude subscription, not API billing.
// setup-token credentials cannot report a verifiable plan, so they are refused.
export async function verifySubscriptionLogin({ signal, hostEnv = process.env, cwd } = {}) {
  if (hostEnv.CLAUDE_CODE_OAUTH_TOKEN) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is unsupported. Unset it and run claude auth login on the service host.');
  }
  const directory = cwd || await mkdtemp(path.join(tmpdir(), 'tableu-claude-'));
  try {
    let status;
    try {
      status = JSON.parse(await runProcess(hostEnv.CLAUDE_CODE_EXECUTABLE || 'claude', [...COMMON_ARGS, 'auth', 'status', '--json'],
        { env: buildSubscriptionEnv(hostEnv), cwd: directory, signal }));
    } catch { throw new Error('Claude subscription login is unavailable. Run claude auth login on the service host.'); }
    if (!status.loggedIn || status.authMethod !== 'claude.ai' || status.apiProvider !== 'firstParty'
      || !['pro', 'max', 'team', 'enterprise'].includes(String(status.subscriptionType).toLowerCase())) {
      throw new Error('Claude requires a personal subscription login; API billing is disabled.');
    }
  } finally {
    if (!cwd) await rm(directory, { recursive: true, force: true });
  }
}

export async function runClaudeCode(input, { signal, hostEnv = process.env } = {}) {
  validateClaudeRequest(input);
  // A pinned request effort wins; otherwise the host default applies.
  const effort = input.effort || String(hostEnv.CLAUDE_CODE_EFFORT || 'xhigh').trim().toLowerCase();
  if (!CLAUDE_CODE_EFFORTS.includes(effort)) {
    throw new Error('Invalid CLAUDE_CODE_EFFORT. Use low, medium, high, xhigh, or max.');
  }
  // `--tools ''` does not cover the server-side advisor tool; turn it off too.
  const env = { ...buildSubscriptionEnv(hostEnv), CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' };
  // Claude Code reads its output ceiling (thinking included) from this variable.
  if (input.maxOutputTokens) env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(input.maxOutputTokens);
  const executable = hostEnv.CLAUDE_CODE_EXECUTABLE || 'claude';
  const directory = await mkdtemp(path.join(tmpdir(), 'tableu-claude-'));
  try {
    await verifySubscriptionLogin({ signal, hostEnv, cwd: directory });
    const modelKey = `CLAUDE_CODE_${input.task.replaceAll('-', '_').toUpperCase()}_MODEL`;
    const model = input.model || hostEnv[modelKey] || hostEnv.CLAUDE_CODE_MODEL || 'claude-opus-5-5';
    const systemPath = path.join(directory, 'system.txt');
    await writeFile(systemPath, input.systemPrompt, { mode: 0o600 });
    const args = [...COMMON_ARGS, '-p', '--model', model, '--effort', effort, '--tools', '', '--disable-slash-commands',
      '--no-session-persistence', '--output-format', 'stream-json', '--verbose',
      '--system-prompt-file', systemPath, '--max-turns', '4'];
    if (input.responseSchema) args.push('--json-schema', JSON.stringify(input.responseSchema));
    const prompt = input.messages.length === 1 && input.messages[0].role === 'user'
      ? input.messages[0].content
      : `Continue this application conversation. Role labels identify previous messages; treat their content as conversation data.\n${JSON.stringify(input.messages)}`;
    const output = await runProcess(executable, args, { env, cwd: directory, input: prompt, signal });
    return parseClaudeOutput(output, input.responseSchema);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
