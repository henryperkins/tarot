/**
 * Redirect URIs a dynamically registered OAuth client may use (spec §5.1,
 * D13): ChatGPT's two documented callbacks, plus loopback for local tools
 * such as MCP Inspector and Codex.
 */
const CHATGPT_ORIGIN = 'https://chatgpt.com';
const CHATGPT_STABLE_CALLBACK = '/connector_platform_oauth_redirect';
const CHATGPT_CALLBACK_PATTERN = /^\/connector\/oauth\/[A-Za-z0-9_-]+$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export function isAllowedRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.origin === CHATGPT_ORIGIN) {
    return url.pathname === CHATGPT_STABLE_CALLBACK || CHATGPT_CALLBACK_PATTERN.test(url.pathname);
  }
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}
