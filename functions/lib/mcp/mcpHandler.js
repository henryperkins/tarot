/**
 * /mcp (spec §5.3). The OAuth library has already validated the token's
 * existence, expiry, resource binding and audience; it does not check scope.
 * This handler enforces the scope, the owner allowlist and an active
 * account, then serves MCP statelessly.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { loadActiveUserById } from '../auth.js';
import { isAllowedMcpUser, MCP_SCOPE, protectedResourceMetadataUrl } from './config.js';
import { createTableuMcpServer } from './server.js';

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function challenge(env, status, error, description) {
  const parts = [
    `Bearer error="${error}"`,
    `error_description="${description}"`,
    `resource_metadata="${protectedResourceMetadataUrl(env)}"`
  ];
  if (error === 'insufficient_scope') parts.push(`scope="${MCP_SCOPE}"`);
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': parts.join(', ')
    }
  });
}

export const mcpApiHandler = {
  async fetch(request, env, ctx) {
    // Stateless transport: no server-sent event stream, no sessions to delete.
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    }

    const token = bearerToken(request);
    const summary = token ? await env.OAUTH_PROVIDER.unwrapToken(token) : null;
    if (!summary) {
      return challenge(env, 401, 'invalid_token', 'The access token is not valid.');
    }
    if (!Array.isArray(summary.scope) || !summary.scope.includes(MCP_SCOPE)) {
      return challenge(env, 403, 'insufficient_scope', `This token lacks the ${MCP_SCOPE} scope.`);
    }

    const userId = ctx?.props?.userId;
    if (!isAllowedMcpUser(env, userId)) {
      return challenge(env, 401, 'invalid_token', 'This account is not allowed to use Tableu from ChatGPT.');
    }
    const user = await loadActiveUserById(env.DB, userId);
    if (!user || user.auth_provider === 'service') {
      return challenge(env, 401, 'invalid_token', 'The linked Tableu account is not available.');
    }

    const server = createTableuMcpServer({
      env,
      user,
      waitUntil: ctx?.waitUntil ? (promise) => ctx.waitUntil(promise) : undefined
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  }
};
