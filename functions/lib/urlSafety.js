export function resolveAppUrl(env) {
  const value = typeof env?.APP_URL === 'string' ? env.APP_URL.trim() : '';
  return value || 'https://tableu.app';
}

function isRelativePath(value) {
  return typeof value === 'string' && value.startsWith('/');
}

function isLocalhostHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function tryParseOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request, env) {
  const allowed = new Set();

  const envAppUrl = typeof env?.APP_URL === 'string' ? env.APP_URL.trim() : '';
  if (envAppUrl) {
    const envOrigin = tryParseOrigin(envAppUrl);
    if (envOrigin) allowed.add(envOrigin);
  }

  const requestOrigin = tryParseOrigin(request?.url);
  if (requestOrigin) allowed.add(requestOrigin);

  const headerOrigin = tryParseOrigin(request?.headers?.get('Origin'));
  if (headerOrigin) {
    try {
      const parsed = new URL(headerOrigin);
      if (parsed.origin === requestOrigin || isLocalhostHost(parsed.hostname)) {
        allowed.add(parsed.origin);
      }
    } catch {
      // ignore
    }
  }

  return Array.from(allowed);
}

function resolvePrimaryOrigin(request, env) {
  const allowed = getAllowedOrigins(request, env);
  const envOrigin = tryParseOrigin(typeof env?.APP_URL === 'string' ? env.APP_URL.trim() : '');
  if (envOrigin && allowed.includes(envOrigin)) return envOrigin;

  const headerOrigin = tryParseOrigin(request?.headers?.get('Origin'));
  if (headerOrigin && allowed.includes(headerOrigin)) return headerOrigin;

  const requestOrigin = tryParseOrigin(request?.url);
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;

  return 'https://tableu.app';
}

export function sanitizeRedirectUrl(value, request, env, fallbackPath = '/account') {
  const primaryOrigin = resolvePrimaryOrigin(request, env);
  const baseUrl = new URL(primaryOrigin);
  const allowedOrigins = getAllowedOrigins(request, env);
  const safeFallbackPath = isRelativePath(fallbackPath) ? fallbackPath : '/account';

  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) {
    return `${baseUrl.origin}${safeFallbackPath}`;
  }

  if (isRelativePath(candidate)) {
    return `${baseUrl.origin}${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!allowedOrigins.includes(parsed.origin)) {
      return `${baseUrl.origin}${safeFallbackPath}`;
    }
    // Return the original candidate to avoid normalizing/encoding values like
    // Stripe placeholders (e.g. {CHECKOUT_SESSION_ID}) in query strings.
    return candidate;
  } catch {
    return `${baseUrl.origin}${safeFallbackPath}`;
  }
}
