export class BackendError extends Error {
  constructor(message, { status, outcome = 'not_started' } = {}) {
    super(message);
    this.status = status;
    this.outcome = outcome;
  }
}

export function createBackendClient({ baseUrl, apiKey, ownerUserId, fetchImpl = fetch, timeoutMs = 180000 }) {
  if (!baseUrl || !apiKey || !ownerUserId) {
    throw new Error('TABLEAU_BASE_URL, TABLEAU_API_KEY and TABLEAU_OWNER_USER_ID are required.');
  }
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('TABLEAU_BASE_URL must use HTTPS (HTTP is allowed only on loopback).');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('TABLEAU_BASE_URL must be an origin without credentials, path or query.');
  }

  async function call(path, init = {}) {
    const writing = init.method && init.method !== 'GET';
    let response;
    let payload;
    try {
      response = await fetchImpl(`${url.origin}${path}`, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${apiKey}` }
      });
      payload = await response.json();
    } catch {
      throw new BackendError(writing
        ? 'The operation could not be confirmed. Do not retry; check the Tableu app.'
        : 'The backend response could not be verified.', { outcome: writing ? 'unknown' : 'not_started' });
    }
    if (!response.ok) {
      // Timeouts (including proxy 408/499 responses) cannot prove that a
      // dispatched append was not committed. Only known refusals are rejected.
      const rejected = [400, 401, 403, 404, 405, 409, 413, 415, 422, 429].includes(response.status);
      throw new BackendError(rejected
        ? `Tableu rejected the request (${response.status}). ${typeof payload?.error === 'string' ? payload.error : ''}`
        : 'The operation could not be confirmed. Do not retry; check the Tableu app.',
      { status: response.status, outcome: rejected ? 'rejected' : (writing ? 'unknown' : 'not_started') });
    }
    return payload;
  }

  async function verifyOwner() {
    const { user } = await call('/api/auth/me');
    if (!user || user.id !== ownerUserId || user.auth_provider === 'service' || user.id.startsWith('service:')) {
      throw new BackendError('Backend identity does not match the configured Tableu app owner. No operation was started.');
    }
    return user;
  }

  async function ownerCall(path, init) {
    // Recheck before each operation: adapter login and a working service token
    // are not evidence of journal ownership. This also detects key revocation.
    await verifyOwner();
    return call(path, init);
  }
  return { call: ownerCall, verifyOwner };
}

export function toolError(error) {
  const message = error instanceof BackendError ? error.message : 'The operation could not be confirmed. Do not retry; check the Tableu app.';
  return {
    isError: true,
    structuredContent: { success: false, outcome: error.outcome || 'unknown', ...(error.status ? { status: error.status } : {}), message },
    content: [{ type: 'text', text: message }]
  };
}
