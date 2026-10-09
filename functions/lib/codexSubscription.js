import { CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES, validateCodexRequest, validateCodexResult } from '../../shared/inference/codexSubscription.js';

export function isCodexSubscriptionEnabled(env) {
  const provider = String(env?.TEXT_PROVIDER || '').trim().toLowerCase();
  if (provider && !['legacy', 'claude-code', 'codex-subscription'].includes(provider)) throw new Error('Invalid TEXT_PROVIDER configuration.');
  return provider === 'codex-subscription';
}

export function getCodexSubscriptionAccessError(env, user) {
  if (!isCodexSubscriptionEnabled(env)) return null;
  const owner = String(env?.CODEX_SUBSCRIPTION_OWNER_USER_ID || '').trim();
  if (!owner) return { status: 503, code: 'codex_owner_not_configured', error: 'Personal inference is not configured.' };
  if (!user?.id || String(user.id) !== owner || user.auth_provider === 'service') {
    return { status: 403, code: 'codex_owner_only', error: 'Personal inference is available only to its owner.' };
  }
  return null;
}

export function ensureCodexSubscriptionConfig(env) {
  let url;
  try {
    url = new URL(env?.CODEX_SUBSCRIPTION_GATEWAY_URL);
    const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new Error('Codex gateway URL must use HTTPS or loopback HTTP without credentials, query or fragment.');
  }
  const token = String(env?.CODEX_SUBSCRIPTION_GATEWAY_TOKEN || '').trim();
  if (!token || /\s/.test(token)) throw new Error('Codex gateway token is missing or invalid.');
  url.pathname = `${url.pathname.replace(/\/+$/, '').replace(/\/v1\/generate$/, '')}/v1/generate`;
  const configuredTimeout = Number(env?.CODEX_SUBSCRIPTION_TIMEOUT_MS || 300000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(600000, Math.max(1000, configuredTimeout)) : 300000;
  return { url: url.toString(), token, timeoutMs };
}

export async function callCodexSubscription(env, { signal: callerSignal, ...input }) {
  validateCodexRequest(input);
  const { url, token, timeoutMs } = ensureCodexSubscriptionConfig(env);
  const controller = new AbortController();
  let reader;
  let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
  cancelled.catch(() => {});
  const abort = message => {
    if (controller.signal.aborted) return;
    rejectAbort(new Error(message));
    controller.abort();
    reader?.cancel().catch(() => {});
  };
  const onAbort = () => abort('Codex request was cancelled.');
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => abort('Codex request timed out.'), timeoutMs);
  if (callerSignal?.aborted) onAbort();
  try {
    if (controller.signal.aborted) return await cancelled;
    const response = await Promise.race([fetch(url, {
      // Workers supports manual redirects; the non-OK guard below rejects every
      // 3xx response without forwarding the gateway credential to Location.
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }), cancelled]);
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`Codex inference unavailable (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    if (!response.body) throw new Error('Codex returned an incomplete response.');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let body = '';
    while (true) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (controller.signal.aborted) return await cancelled;
      if (done) break;
      bytes += value.byteLength;
      if (bytes > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES) throw new Error('Codex response exceeded the size limit.');
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    let result;
    try { result = JSON.parse(body); } catch { throw new Error('Codex returned an invalid response.'); }
    return validateCodexResult(result, input.responseSchema);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}

/** Yield authentic gateway deltas; done must confirm the same immutable source. */
export async function* streamCodexSubscription(env, { signal: callerSignal, ...input }) {
  validateCodexRequest(input);
  const { url, token, timeoutMs } = ensureCodexSubscriptionConfig(env);
  const controller = new AbortController();
  let reader;
  let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
  cancelled.catch(() => {});
  const abort = message => {
    if (controller.signal.aborted) return;
    rejectAbort(new Error(message));
    controller.abort();
    reader?.cancel().catch(() => {});
  };
  const onAbort = () => abort('Codex request was cancelled.');
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => abort('Codex request timed out.'), timeoutMs);
  if (callerSignal?.aborted) onAbort();
  try {
    if (controller.signal.aborted) await cancelled;
    const response = await Promise.race([fetch(url, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(input)
    }), cancelled]);
    if (!response.ok || !response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) {
      await response.body?.cancel();
      const error = new Error(`Codex streaming unavailable (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const encoder = new TextEncoder();
    let buffer = '';
    let text = '';
    let bytes = 0;
    let textBytes = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), cancelled]);
      if (controller.signal.aborted) await cancelled;
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      // Delta text is repeated once in the terminal source, plus JSON framing.
      if (bytes > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES * 3) throw new Error('Codex stream exceeded the size limit.');
      buffer += decoder.decode(chunk.value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop();
      if (buffer.length > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES) throw new Error('Codex stream event exceeded the size limit.');
      for (const block of blocks) {
        const lines = block.split(/\r?\n/);
        const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
        if (!type && !dataLines.length) continue; // SSE comments/heartbeats.
        let data;
        try { data = JSON.parse(dataLines.join('\n')); } catch { throw new Error('Codex returned an invalid stream event.'); }
        if (type === 'meta') continue;
        if (type === 'error') throw new Error('Codex generation failed during streaming.');
        if (type === 'delta') {
          if (typeof data?.text !== 'string' || !data.text) throw new Error('Codex returned an invalid text delta.');
          textBytes += encoder.encode(data.text).byteLength;
          if (textBytes > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES) throw new Error('Codex reading exceeded the size limit.');
          text += data.text;
          yield { type: 'delta', text: data.text };
        } else if (type === 'done') {
          const result = validateCodexResult(data, input.responseSchema);
          if (!text || result.text !== text) throw new Error('Codex final source does not match delivered deltas.');
          yield { type: 'done', result };
          return;
        } else throw new Error('Codex returned an unsupported stream event.');
      }
    }
    decoder.decode();
    throw new Error('Codex stream ended without completion.');
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
    controller.abort();
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
