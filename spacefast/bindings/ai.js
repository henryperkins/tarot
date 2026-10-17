const API_BASE = 'https://api.cloudflare.com/client/v4';

function identifier(value, name) {
  const result = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new TypeError(`Invalid ${name}.`);
  return result;
}

function apiError(response, payload) {
  // Do not include upstream text bodies: they can echo inputs or credentials.
  const code = payload?.errors?.[0]?.code;
  const error = new Error(`Workers AI request failed (HTTP ${response.status}${code ? `, code ${code}` : ''}).`);
  error.status = response.status;
  if (code !== undefined) error.code = code;
  return error;
}

async function parseResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok) {
    let payload;
    if (type.includes('json')) {
      try { payload = await response.json(); } catch { /* Status is still available. */ }
    }
    throw apiError(response, payload);
  }
  // Audio/image payloads and SSE use the same body shape as the AI binding.
  if (!type.includes('json')) return response.body;
  const payload = await response.json();
  if (payload?.success === false) throw apiError(response, payload);
  return Object.hasOwn(payload || {}, 'result') ? payload.result : payload;
}

export function createWorkersAI(env, { fetch: fetchRequest = globalThis.fetch } = {}) {
  const account = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  const token = typeof env.CLOUDFLARE_API_TOKEN === 'string' ? env.CLOUDFLARE_API_TOKEN.trim() : '';
  if (!account || !token) return undefined;
  const accountId = identifier(account, 'Cloudflare account ID');

  const binding = {
    aiGatewayLogId: null,
    async run(model, input, options = {}) {
      if (typeof model !== 'string' || !/^@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/.test(model)) {
        throw new TypeError('Invalid Workers AI model identifier.');
      }
      const headers = new Headers({ Authorization: `Bearer ${token}` });
      let body;
      if (input?.multipart) {
        const { body: multipartBody, contentType } = input.multipart;
        if (!/^multipart\/form-data;\s*boundary=/.test(contentType || '') || !multipartBody) {
          throw new TypeError('Workers AI multipart input requires a body and boundary.');
        }
        headers.set('Content-Type', contentType);
        // Buffering supports both browser fetch and Node-based build verification.
        body = await new Response(multipartBody).arrayBuffer();
      } else {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(input);
      }
      if (options.gateway?.id) {
        headers.set('cf-aig-gateway-id', identifier(options.gateway.id, 'AI Gateway ID'));
        if (options.gateway.skipCache !== undefined) headers.set('cf-aig-skip-cache', String(Boolean(options.gateway.skipCache)));
        if (options.gateway.cacheTtl !== undefined) headers.set('cf-aig-cache-ttl', String(options.gateway.cacheTtl));
      }
      const response = await fetchRequest(`${API_BASE}/accounts/${accountId}/ai/run/${model}`, {
        method: 'POST', headers, body, signal: options.signal, redirect: 'error',
      });
      binding.aiGatewayLogId = response.headers.get('cf-aig-log-id');
      return parseResponse(response);
    },

    gateway(gatewayId) {
      const id = identifier(gatewayId, 'AI Gateway ID');
      return {
        async patchLog(logId, patch) {
          const response = await fetchRequest(`${API_BASE}/accounts/${accountId}/ai-gateway/gateways/${id}/logs/${encodeURIComponent(logId)}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(patch), redirect: 'error',
          });
          return parseResponse(response);
        },
      };
    },
  };
  return binding;
}
