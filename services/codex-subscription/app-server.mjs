import { spawn } from 'node:child_process';
import { CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES, validateCodexResult } from '../../shared/inference/codexSubscription.js';

export function buildCodexAppServerArgs(execArgs) {
  const args = ['app-server'];
  for (let index = 0; index < execArgs.length; index++) {
    if (['-c', '--enable', '--disable'].includes(execArgs[index])) args.push(execArgs[index], execArgs[++index]);
  }
  // app-server lacks exec's ignore-user-config switch. Disable all startup
  // execution and exports before initialization; effective MCP entries are
  // disabled individually before thread creation below (empty tables merge).
  const overrides = {
    developer_instructions: '', notify: [], approval_policy: 'never', sandbox_mode: 'read-only',
    // Match Codex's ChatGPT-auth endpoint. An API URL here overrides its
    // subscription routing even when forced_login_method remains ChatGPT.
    openai_base_url: 'https://chatgpt.com/backend-api/codex', chatgpt_base_url: 'https://chatgpt.com/backend-api/',
    'otel.exporter': 'none', 'otel.trace_exporter': 'none', 'otel.metrics_exporter': 'none',
    'otel.log_user_prompt': false, 'otel.log_agent_responses': false,
    'experimental_thread_store.type': 'local'
  };
  for (const [key, value] of Object.entries(overrides)) args.push('-c', `${key}=${JSON.stringify(value)}`);
  return args;
}

export function runCodexAppServer(executable, args, { env, cwd, input, prompt, model, effort, signal, onDelta }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Codex request was cancelled.')); return; }
    const child = spawn(executable, args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let buffer = '';
    let outputBytes = 0;
    let text = '';
    let finalItemId;
    let finalItemCompleted = false;
    let threadId;
    let turnId;
    let usage = {};
    let result;
    let failure;
    let killTimer;
    const items = new Map();
    const kill = name => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, name);
        else child.kill(name);
      } catch { /* Already exited. */ }
    };
    const stop = error => {
      if (failure || result) return;
      failure = error;
      terminate();
    };
    const terminate = () => {
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1500);
      killTimer.unref();
    };
    const send = message => child.stdin.write(`${JSON.stringify(message)}\n`);
    const fail = () => stop(new Error('Codex returned an incomplete or inconsistent reading stream.'));
    const onAbort = () => stop(new Error('Codex request was cancelled.'));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const consume = message => {
      if (failure || result) return;
      if (message.error || (message.method && message.id !== undefined)) { fail(); return; }
      if (message.id === 0) {
        send({ method: 'initialized' });
        send({ id: 1, method: 'config/read', params: { includeLayers: false } });
        return;
      }
      if (message.id === 1) {
        const config = message.result?.config;
        if (!config || typeof config !== 'object') { fail(); return; }
        // RPC dotted overrides do not support quoted key segments. Replace the
        // complete server table to preserve literal names (including dots),
        // retaining valid transport definitions while disabling every server.
        // Optional nulls in config/read must be omitted for JSON -> TOML input.
        // This host configuration stays in memory and private child stdin only.
        const disabledMcp = JSON.parse(JSON.stringify(Object.fromEntries(
          Object.entries(config.mcp_servers || {}).map(([name, definition]) => [name, { ...definition, enabled: false }])
        ), (_key, value) => value === null ? undefined : value));
        send({ id: 2, method: 'thread/start', params: {
          model, modelProvider: config.model_provider || 'openai', allowProviderModelFallback: false,
          baseInstructions: input.systemPrompt, developerInstructions: '', cwd,
          approvalPolicy: 'never', sandbox: 'read-only', environments: [], ephemeral: true,
          config: { mcp_servers: disabledMcp }
        } });
        return;
      }
      if (message.id === 2) {
        threadId = message.result?.thread?.id;
        if (typeof threadId !== 'string' || message.result?.model !== model) { fail(); return; }
        send({ id: 3, method: 'turn/start', params: {
          threadId, input: [{ type: 'text', text: prompt }], effort, environments: []
        } });
        return;
      }
      if (message.id === 3) {
        const startedId = message.result?.turn?.id;
        if (typeof startedId !== 'string' || (turnId && turnId !== startedId)) { fail(); return; }
        turnId = startedId;
        return;
      }
      const { method, params = {} } = message;
      if (['error', 'configWarning', 'warning', 'model/rerouted'].includes(method)) { fail(); return; }
      if (params.threadId && params.threadId !== threadId) { fail(); return; }
      if (params.turnId) {
        if (turnId && params.turnId !== turnId) { fail(); return; }
        turnId ||= params.turnId;
      }
      if (method === 'item/started' || method === 'item/completed') {
        const item = params.item;
        if (!item || !['userMessage', 'agentMessage', 'reasoning'].includes(item.type)) { fail(); return; }
        if (method === 'item/started') {
          if (items.has(item.id)) { fail(); return; }
          items.set(item.id, { type: item.type, phase: item.phase });
          if (item.type === 'agentMessage' && item.phase === 'final_answer') {
            if (finalItemId) { fail(); return; }
            finalItemId = item.id;
          }
        } else if (item.type === 'agentMessage' && item.phase === 'final_answer') {
          if (item.id !== finalItemId || item.text !== text) { fail(); return; }
          finalItemCompleted = true;
        }
      } else if (method === 'item/agentMessage/delta') {
        const item = items.get(params.itemId);
        if (!item || item.type !== 'agentMessage' || typeof params.delta !== 'string') { fail(); return; }
        if (item.phase !== 'final_answer') return;
        if (finalItemCompleted) { fail(); return; }
        text += params.delta;
        onDelta(params.delta);
      } else if (method === 'thread/tokenUsage/updated') {
        const last = params.tokenUsage?.last;
        if (last) usage = {
          input_tokens: last.inputTokens || 0, output_tokens: last.outputTokens || 0,
          cached_input_tokens: last.cachedInputTokens || 0, reasoning_output_tokens: last.reasoningOutputTokens || 0
        };
      } else if (method === 'turn/completed') {
        if (params.turn?.status !== 'completed' || params.turn.id !== turnId || !finalItemCompleted || !text.trim()) { fail(); return; }
        result = validateCodexResult({ provider: 'codex-subscription', text, structured: null,
          model, modelSource: 'configured', usage });
        terminate();
      } else if (method?.startsWith('hook/') || method?.startsWith('item/command')
        || method?.startsWith('item/fileChange') || method?.startsWith('item/mcp')) fail();
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES) { stop(new Error('Codex output exceeded the size limit.')); return; }
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try { consume(JSON.parse(line)); } catch { fail(); }
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => { if (!result && !failure) stop(new Error('Codex input could not be delivered.')); });
    child.on('error', () => { failure = new Error('Codex could not be started. Check the CLI installation.'); });
    child.on('close', () => {
      kill('SIGKILL');
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', onAbort);
      if (failure) reject(failure);
      else if (!result) reject(new Error('Codex returned an incomplete reading stream.'));
      else resolve(result);
    });
    send({ id: 0, method: 'initialize', params: {
      clientInfo: { name: 'tableu_reading', title: 'Tableu reading', version: '1.0.0' },
      capabilities: { experimentalApi: true }
    } });
  });
}
