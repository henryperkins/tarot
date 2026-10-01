import { CLAUDE_CODE_MAX_OUTPUT_BYTES, validateClaudeRequest, validateClaudeResult } from '../../shared/inference/claudeCode.js';

export function isClaudeCodeEnabled(env) {
  const provider = String(env?.TEXT_PROVIDER || '').trim().toLowerCase();
  if (provider && !['legacy', 'claude-code'].includes(provider)) throw new Error('Invalid TEXT_PROVIDER configuration.');
  return provider === 'claude-code';
}

export function getClaudeCodeAccessError(env, user) {
  if (!isClaudeCodeEnabled(env)) return null;
  const owner = String(env?.CLAUDE_CODE_OWNER_USER_ID || '').trim();
  if (!owner) return { status: 503, code: 'claude_owner_not_configured', error: 'Personal inference is not configured.' };
  if (!user?.id || String(user.id) !== owner || user.auth_provider === 'service') {
    return { status: 403, code: 'claude_owner_only', error: 'Personal inference is available only to its owner.' };
  }
  return null;
}

export function ensureClaudeCodeConfig(env) {
  let url;
  try {
    url = new URL(env?.CLAUDE_CODE_GATEWAY_URL);
    const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new Error('Claude gateway URL must use HTTPS or loopback HTTP without credentials, query or fragment.');
  }
  const token = String(env?.CLAUDE_CODE_GATEWAY_TOKEN || '').trim();
  if (!token || /\s/.test(token)) throw new Error('Claude gateway token is missing or invalid.');
  url.pathname = `${url.pathname.replace(/\/+$/, '').replace(/\/v1\/generate$/, '')}/v1/generate`;
  const configuredTimeout = Number(env?.CLAUDE_CODE_TIMEOUT_MS || 300000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(600000, Math.max(1000, configuredTimeout)) : 300000;
  return { url: url.toString(), token, timeoutMs };
}

export async function callClaudeCode(env, { signal: callerSignal, ...input }) {
  validateClaudeRequest(input);
  const { url, token, timeoutMs } = ensureClaudeCodeConfig(env);
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
  const onAbort = () => abort('Claude request was cancelled.');
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => abort('Claude request timed out.'), timeoutMs);
  if (callerSignal?.aborted) onAbort();
  try {
    if (controller.signal.aborted) return await cancelled;
    const response = await Promise.race([fetch(url, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }), cancelled]);
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`Claude inference unavailable (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    if (!response.body) throw new Error('Claude returned an incomplete response.');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let body = '';
    while (true) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (controller.signal.aborted) return await cancelled;
      if (done) break;
      bytes += value.byteLength;
      if (bytes > CLAUDE_CODE_MAX_OUTPUT_BYTES) throw new Error('Claude response exceeded the size limit.');
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    let result;
    try { result = JSON.parse(body); } catch { throw new Error('Claude returned an invalid response.'); }
    return validateClaudeResult(result, input.responseSchema);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
