/**
 * Entry point for the ChatGPT MCP endpoint and its OAuth 2.1 authorization
 * server (spec §5). The Worker hands exactly these paths here: /mcp,
 * /oauth/*, and the two /.well-known/oauth-* documents.
 */
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';

import { jsonResponse } from '../utils.js';
import { getMcpResourceUrl, MCP_SCOPE } from './config.js';
import { handleAuthorize } from './consent.js';
import { mcpApiHandler } from './mcpHandler.js';
import { isAllowedRedirectUri } from './redirectUris.js';
import { enforceRegistrationRateLimit } from './registrationLimit.js';

export const OAUTH_PATHS = Object.freeze({
  authorize: '/oauth/authorize',
  token: '/oauth/token',
  register: '/oauth/register'
});

export function isMcpOrOAuthPath(pathname) {
  return pathname === '/mcp'
    || pathname.startsWith('/mcp/')
    || pathname.startsWith('/oauth/')
    || pathname === '/.well-known/oauth-authorization-server'
    || pathname === '/.well-known/oauth-protected-resource'
    || pathname.startsWith('/.well-known/oauth-protected-resource/');
}

/** Dynamic client registration accepts only ChatGPT callback and loopback redirect URIs. */
export function registrationCallback({ clientMetadata }) {
  const redirectUris = Array.isArray(clientMetadata?.redirect_uris) ? clientMetadata.redirect_uris : [];
  if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirectUri)) {
    return {
      code: 'invalid_redirect_uri',
      description: 'Only ChatGPT callback and loopback redirect URIs can be registered.',
      status: 400
    };
  }
  return undefined;
}

const defaultHandler = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === OAUTH_PATHS.authorize) return handleAuthorize(request, env);
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
};

export function buildOAuthProviderOptions(env) {
  const resource = getMcpResourceUrl(env);
  return {
    apiRoute: '/mcp',
    apiHandler: mcpApiHandler,
    defaultHandler,
    authorizeEndpoint: OAUTH_PATHS.authorize,
    tokenEndpoint: OAUTH_PATHS.token,
    clientRegistrationEndpoint: OAUTH_PATHS.register,
    scopesSupported: [MCP_SCOPE],
    // ChatGPT registers once per connection and reuses the client, so
    // registered clients must not expire (D13). An explicit undefined
    // replaces the library's 90-day default.
    clientRegistrationTTL: undefined,
    clientRegistrationCallback: registrationCallback,
    // CIMD needs the Worker-wide global_fetch_strictly_public flag (D8).
    clientIdMetadataDocumentEnabled: false,
    resourceMetadata: {
      resource,
      scopes_supported: [MCP_SCOPE],
      resource_name: 'Tableu'
    }
  };
}

const providers = new Map();

/** One provider per resource URL, reused across requests in an isolate. */
export function getOAuthProvider(env) {
  const resource = getMcpResourceUrl(env);
  let provider = providers.get(resource);
  if (!provider) {
    provider = new OAuthProvider(buildOAuthProviderOptions(env));
    providers.set(resource, provider);
  }
  return provider;
}

/**
 * @param {Request} request
 * @param {object} env - Worker bindings; OAUTH_KV is required
 * @param {ExecutionContext} ctx
 */
export async function handleMcpOrOAuthRequest(request, env, ctx) {
  if (!env?.OAUTH_KV) return jsonResponse({ error: 'Not found' }, { status: 404 });

  const { pathname } = new URL(request.url);
  if (pathname === OAUTH_PATHS.register && request.method === 'POST') {
    const limited = await enforceRegistrationRateLimit(env, request);
    if (limited) return limited;
  }

  // The provider writes ctx.props for the API handler, so give it its own
  // context object rather than the runtime's.
  const providerCtx = {
    waitUntil: (promise) => ctx?.waitUntil?.(promise),
    passThroughOnException: () => ctx?.passThroughOnException?.(),
    props: undefined
  };
  return getOAuthProvider(env).fetch(request, env, providerCtx);
}
