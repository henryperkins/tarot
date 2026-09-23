import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';
import * as z from 'zod/v4';
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from 'jose';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createBackendClient } from './backend.js';
import { registerJournalTools } from './journal-tools.js';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '3334', 10);
const TABLEAU_BASE_URL = (process.env.TABLEAU_BASE_URL || '').replace(/\/+$/, '');
const TABLEAU_API_KEY = process.env.TABLEAU_API_KEY || '';
const ADAPTER_BIND_HOST = process.env.ADAPTER_BIND_HOST || '127.0.0.1';
const ADAPTER_ALLOWED_HOSTS = parseCsv(process.env.ADAPTER_ALLOWED_HOSTS);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const OAUTH_ENABLED = process.env.OAUTH_ENABLED === 'true';
// Secret stores often append a newline; compare what the operator meant.
const OWNER_TOKEN = (process.env.ADAPTER_OWNER_TOKEN || '').trim();
const OWNER_SUBJECT = (process.env.OAUTH_OWNER_SUBJECT || '').trim();
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];
// Key-set retrieval problems are server faults. Anything else jose rejects is
// a bad token and must be a 401, the only status that makes clients reauthorize.
const JWKS_SERVER_ERRORS = new Set(['ERR_JWKS_INVALID', 'ERR_JWKS_MULTIPLE_MATCHING_KEYS', 'ERR_JWKS_TIMEOUT', 'ERR_JWK_INVALID']);
const INVALID_TOKEN_MESSAGE = 'The access token is invalid or expired.';

if (!TABLEAU_BASE_URL || !TABLEAU_API_KEY) {
  console.error('Missing required env vars: TABLEAU_BASE_URL and TABLEAU_API_KEY');
  process.exit(1);
}

const app = createMcpExpressApp({
  host: ADAPTER_BIND_HOST,
  allowedHosts: ADAPTER_ALLOWED_HOSTS.length ? ADAPTER_ALLOWED_HOSTS : undefined,
});

/**
 * Keeps active sessions for stateful Streamable HTTP transport.
 * Keyed by MCP session id.
 */
const sessions = new Map();
const backend = createBackendClient({
  baseUrl: TABLEAU_BASE_URL, apiKey: TABLEAU_API_KEY,
  ownerUserId: process.env.TABLEAU_OWNER_USER_ID
});

function parseCsv(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeHeader(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Session-Id, Last-Event-ID'
  );
  if (ALLOWED_ORIGIN !== '*') {
    res.setHeader('Vary', 'Origin');
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveResourceServerUrl() {
  const explicit = process.env.OAUTH_RESOURCE_SERVER_URL;
  if (explicit) {
    return new URL(explicit);
  }

  const publicBase = process.env.ADAPTER_PUBLIC_BASE_URL;
  if (publicBase) {
    return new URL('/mcp', publicBase);
  }

  return new URL(`http://localhost:${PORT}/mcp`);
}

function parseScopes(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim());
  }
  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function parseAudiences(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim());
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function parseUrlOrNull(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAudienceAllowed({ tokenAudiences, expectedAudience }) {
  if (!expectedAudience) {
    return true;
  }

  for (const aud of tokenAudiences) {
    if (aud === expectedAudience) {
      return true;
    }

    try {
      if (checkResourceAllowed({ requestedResource: aud, configuredResource: expectedAudience })) {
        return true;
      }
    } catch {
      // Ignore non-URL audience values for resource-style matching.
    }
  }

  return false;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Metadata fetch failed (${response.status}) ${url}: ${text || response.statusText}`);
  }

  return response.json();
}

async function loadOAuthMetadata() {
  const explicitMetadataUrl = process.env.OAUTH_METADATA_URL;
  const explicitOpenIdConfigUrl = process.env.OAUTH_OPENID_CONFIGURATION_URL;

  if (explicitMetadataUrl) {
    return fetchJson(explicitMetadataUrl);
  }

  if (explicitOpenIdConfigUrl) {
    return fetchJson(explicitOpenIdConfigUrl);
  }

  const issuer = process.env.OAUTH_ISSUER_URL;
  if (!issuer) {
    throw new Error('OAUTH_ENABLED=true requires OAUTH_ISSUER_URL (or OAUTH_METADATA_URL).');
  }

  const issuerUrl = new URL(issuer);
  const oauthMetadataUrl = new URL('/.well-known/oauth-authorization-server', issuerUrl).href;
  const openIdConfigUrl = new URL('/.well-known/openid-configuration', issuerUrl).href;

  try {
    return await fetchJson(oauthMetadataUrl);
  } catch (error) {
    console.warn(`Failed OAuth metadata lookup at ${oauthMetadataUrl}:`, error.message);
    return fetchJson(openIdConfigUrl);
  }
}

async function callTableau(path, init = {}) {
  return backend.call(path, init);
}

const spreadInfoSchema = z.object({
  name: z.string().min(1),
  key: z.string().optional(),
  deckStyle: z.string().optional(),
}).passthrough();

const cardInfoSchema = z.object({
  position: z.string().min(1),
  card: z.string().min(1),
  orientation: z.enum(['Upright', 'Reversed']),
  meaning: z.string().min(1),
}).passthrough();

const startReadingInputSchema = z.object({
  spreadInfo: spreadInfoSchema,
  cardsInfo: z.array(cardInfoSchema).min(1),
  userQuestion: z.string().optional(),
  reflectionsText: z.string().optional(),
  reversalFrameworkOverride: z.string().optional(),
  deckStyle: z.string().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().optional(),
    accuracy: z.number().positive().optional(),
    source: z.enum(['browser', 'manual']).optional(),
  }).optional(),
  persistLocationToJournal: z.boolean().optional(),
}).passthrough();

const jobRefSchema = z.object({
  jobId: z.string().min(1),
  jobToken: z.string().min(1),
});

function createServer() {
  const server = new McpServer(
    {
      name: 'tableau-tarot-reading-adapter',
      version: '1.2.0',
    },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    'start_tarot_reading',
    {
      title: 'Start tarot reading',
      description: 'Starts an async tarot reading job and returns jobId + jobToken.',
      inputSchema: startReadingInputSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input) => ({
      structuredContent: await callTableau('/api/tarot-reading/jobs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      content: [{ type: 'text', text: 'Tarot reading job started.' }],
    })
  );

  server.registerTool(
    'get_tarot_reading_status',
    {
      title: 'Get tarot reading status',
      description: 'Gets current status/result/error for a tarot reading job.',
      inputSchema: jobRefSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ jobId, jobToken }) => ({
      structuredContent: await callTableau(`/api/tarot-reading/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers: { 'X-Job-Token': jobToken },
      }),
      content: [{ type: 'text', text: 'Fetched tarot reading job status.' }],
    })
  );

  server.registerTool(
    'cancel_tarot_reading',
    {
      title: 'Cancel tarot reading',
      description: 'Cancels a running tarot reading job.',
      inputSchema: jobRefSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ jobId, jobToken }) => ({
      structuredContent: await callTableau(
        `/api/tarot-reading/jobs/${encodeURIComponent(jobId)}/cancel`,
        {
          method: 'POST',
          headers: { 'X-Job-Token': jobToken },
        }
      ),
      content: [{ type: 'text', text: 'Tarot reading job cancellation requested.' }],
    })
  );

  server.registerTool(
    'wait_for_tarot_reading',
    {
      title: 'Wait for tarot reading completion',
      description: 'Polls until tarot job completes/errors or timeout is reached.',
      inputSchema: jobRefSchema.extend({
        timeoutSeconds: z.number().int().positive().max(180).default(60),
        pollEveryMs: z.number().int().positive().max(5000).default(1000),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ jobId, jobToken, timeoutSeconds, pollEveryMs }) => {
      const deadline = Date.now() + timeoutSeconds * 1000;

      while (Date.now() < deadline) {
        const status = await callTableau(`/api/tarot-reading/jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          headers: { 'X-Job-Token': jobToken },
        });

        if (status?.status === 'complete' || status?.status === 'error') {
          return {
            structuredContent: status,
            content: [{ type: 'text', text: `Tarot reading job finished with status: ${status.status}` }],
          };
        }

        await delay(pollEveryMs);
      }

      return {
        structuredContent: {
          status: 'timeout',
          jobId,
          message: 'Timed out waiting for completion. Call get_tarot_reading_status again.',
        },
        content: [{ type: 'text', text: 'Polling timed out before terminal job state.' }],
      };
    }
  );

  registerJournalTools(server, backend);
  return server;
}

function removeSession(sessionId) {
  if (!sessionId) {
    return;
  }
  sessions.delete(sessionId);
}

app.use((req, res, next) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

async function setupAuth() {
  const oauthMetadata = await loadOAuthMetadata();
  const resourceServerUrl = deriveResourceServerUrl();
  const metadataIssuer = oauthMetadata?.issuer || process.env.OAUTH_ISSUER_URL;
  const expectedAudience = process.env.OAUTH_AUDIENCE || resourceServerUrl.href;
  const requiredScopes = parseCsv(process.env.OAUTH_REQUIRED_SCOPES);
  const scopesSupported = parseCsv(process.env.OAUTH_SCOPES_SUPPORTED);
  const introspectionEndpoint =
    process.env.OAUTH_INTROSPECTION_URL || oauthMetadata?.introspection_endpoint || '';

  if (!metadataIssuer || !oauthMetadata?.authorization_endpoint || !oauthMetadata?.token_endpoint) {
    throw new Error(
      'OAuth metadata is missing required fields: issuer, authorization_endpoint, token_endpoint.'
    );
  }

  // One key set for the process, so jose can cache keys between requests.
  const jwksUri = process.env.OAUTH_JWKS_URI || oauthMetadata?.jwks_uri;
  const jwks = jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : null;

  const tokenVerifier = introspectionEndpoint
    ? {
        verifyAccessToken: async (token) => {
          const body = new URLSearchParams({ token });
          const introspectionClientId = process.env.OAUTH_INTROSPECTION_CLIENT_ID || '';
          const introspectionClientSecret = process.env.OAUTH_INTROSPECTION_CLIENT_SECRET || '';
          const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          };

          if (introspectionClientId && introspectionClientSecret) {
            const encoded = Buffer.from(`${introspectionClientId}:${introspectionClientSecret}`).toString('base64');
            headers.Authorization = `Basic ${encoded}`;
          } else if (introspectionClientId) {
            body.set('client_id', introspectionClientId);
          }

          const response = await fetch(introspectionEndpoint, {
            method: 'POST',
            headers,
            body: body.toString(),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Introspection failed (${response.status}): ${text || response.statusText}`);
          }

          const payload = await response.json();
          if (payload.active !== true) {
            throw new InvalidTokenError(INVALID_TOKEN_MESSAGE);
          }

          const tokenAudiences = parseAudiences(payload.aud);
          if (!isAudienceAllowed({ tokenAudiences, expectedAudience })) {
            throw new InvalidTokenError(INVALID_TOKEN_MESSAGE);
          }

          return {
            token,
            clientId: payload.client_id || payload.sub || 'unknown-client',
            scopes: parseScopes(payload.scope),
            expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
            resource: parseUrlOrNull(tokenAudiences[0]) || undefined,
            extra: { subject: payload.sub },
          };
        },
      }
    : {
        verifyAccessToken: async (token) => {
          if (!jwks) {
            throw new Error('OAUTH_JWKS_URI (or metadata.jwks_uri) is required when introspection is disabled.');
          }

          let payload;
          try {
            ({ payload } = await jwtVerify(token, jwks, {
              issuer: process.env.OAUTH_TOKEN_ISSUER || metadataIssuer,
            }));
          } catch (error) {
            if (error instanceof joseErrors.JOSEError && !JWKS_SERVER_ERRORS.has(error.code)) {
              throw new InvalidTokenError(INVALID_TOKEN_MESSAGE);
            }
            throw error;
          }

          const tokenAudiences = parseAudiences(payload.aud);
          if (!isAudienceAllowed({ tokenAudiences, expectedAudience })) {
            throw new InvalidTokenError(INVALID_TOKEN_MESSAGE);
          }

          return {
            token,
            clientId:
              (typeof payload.client_id === 'string' && payload.client_id) ||
              (typeof payload.azp === 'string' && payload.azp) ||
              (typeof payload.sub === 'string' && payload.sub) ||
              'unknown-client',
            scopes: parseScopes(payload.scope || payload.scp),
            expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
            resource: parseUrlOrNull(tokenAudiences[0]) || undefined,
            extra: {
              issuer: payload.iss,
              subject: payload.sub,
            },
          };
        },
      };

  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl,
      scopesSupported: scopesSupported.length ? scopesSupported : undefined,
      resourceName: 'Tableau Tarot Reading Adapter',
    })
  );

  const bearerMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  });
  const authMiddleware = [bearerMiddleware, (req, res, next) => {
    if (req.auth?.extra?.subject !== OWNER_SUBJECT) {
      res.status(403).json({ error: 'This private adapter is restricted to its owner.' });
      return;
    }
    next();
  }];

  if (oauthMetadata?.jwks_uri) {
    app.get('/.well-known/openid-configuration', (_req, res) => {
      res.status(200).json(oauthMetadata);
    });
  }

  return {
    authMiddleware,
    requiredScopes,
    metadataIssuer,
    resourceServerUrl: resourceServerUrl.href,
    usingIntrospection: Boolean(introspectionEndpoint),
  };
}

function attachMcpRoutes(authMiddleware) {
  const postHandler = async (req, res) => {
    const sessionId = normalizeHeader(req.headers['mcp-session-id']);

    try {
      if (sessionId && sessions.has(sessionId)) {
        const active = sessions.get(sessionId);
        await active.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (initializedSessionId) => {
            sessions.set(initializedSessionId, { transport, server });
          },
        });

        transport.onclose = () => {
          removeSession(transport.sessionId);
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: no valid session ID provided.',
        },
        id: null,
      });
    } catch (error) {
      console.error('Error handling MCP POST request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  };

  const getHandler = async (req, res) => {
    const sessionId = normalizeHeader(req.headers['mcp-session-id']);
    const active = sessions.get(sessionId);

    if (!sessionId || !active) {
      res.status(400).send('Invalid or missing MCP session ID.');
      return;
    }

    try {
      await active.transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP GET request:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  };

  const deleteHandler = async (req, res) => {
    const sessionId = normalizeHeader(req.headers['mcp-session-id']);
    const active = sessions.get(sessionId);

    if (!sessionId || !active) {
      res.status(400).send('Invalid or missing MCP session ID.');
      return;
    }

    try {
      await active.transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP DELETE request:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  };

  if (authMiddleware) {
    app.post('/mcp', authMiddleware, postHandler);
    app.get('/mcp', authMiddleware, getHandler);
    app.delete('/mcp', authMiddleware, deleteHandler);
  } else {
    app.post('/mcp', postHandler);
    app.get('/mcp', getHandler);
    app.delete('/mcp', deleteHandler);
  }
}

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'tableau-tarot-reading-adapter',
    mcpEndpoint: '/mcp',
    oauthEnabled: OAUTH_ENABLED,
    bindHost: ADAPTER_BIND_HOST,
    allowedHosts: ADAPTER_ALLOWED_HOSTS.length
      ? ADAPTER_ALLOWED_HOSTS
      : (LOOPBACK_HOSTS.includes(ADAPTER_BIND_HOST) ? 'localhost only' : 'any'),
  });
});

async function start() {
  let authRuntime = null;

  if (OAUTH_ENABLED ? !OWNER_SUBJECT : OWNER_TOKEN.length < 32) {
    throw new Error('Private access requires OAUTH_OWNER_SUBJECT in OAuth mode, or a random ADAPTER_OWNER_TOKEN of at least 32 characters.');
  }
  if (!LOOPBACK_HOSTS.includes(ADAPTER_BIND_HOST) && !ADAPTER_ALLOWED_HOSTS.length) {
    throw new Error('A public bind address requires ADAPTER_ALLOWED_HOSTS.');
  }
  await backend.verifyOwner();

  if (OAUTH_ENABLED) {
    authRuntime = await setupAuth();
  } else {
    /**
     * Explicit 404s for OAuth discovery routes in key-only mode.
     * This avoids ambiguous upstream 502-style failures during connector setup.
     */
    app.get(/^\/\.well-known\/oauth-protected-resource(?:\/.*)?$/, (_req, res) => {
      res.status(404).json({ error: 'OAuth not configured for this adapter.' });
    });
    app.get('/.well-known/oauth-authorization-server', (_req, res) => {
      res.status(404).json({ error: 'OAuth not configured for this adapter.' });
    });
    app.get('/.well-known/openid-configuration', (_req, res) => {
      res.status(404).json({ error: 'OAuth not configured for this adapter.' });
    });
  }

  const ownerAuth = (req, res, next) => {
    // The auth scheme is case-insensitive (RFC 9110), as in the OAuth path.
    const match = /^bearer\s+(.+)$/i.exec(normalizeHeader(req.headers.authorization));
    const token = match ? match[1].trim() : '';
    const digest = value => createHash('sha256').update(value).digest();
    if (!token || !timingSafeEqual(digest(token), digest(OWNER_TOKEN))) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="Tableu owner"');
      res.status(401).json({ error: 'Owner authentication required.' });
      return;
    }
    next();
  };
  attachMcpRoutes(authRuntime?.authMiddleware || ownerAuth);

  app.listen(PORT, ADAPTER_BIND_HOST, (error) => {
    if (error) {
      console.error('Failed to start adapter:', error);
      process.exit(1);
    }

    console.log(`Tableau MCP adapter listening on port ${PORT}`);
    console.log(`Adapter bind host: ${ADAPTER_BIND_HOST}`);
    if (ADAPTER_ALLOWED_HOSTS.length) {
      console.log(`Adapter allowed hosts: ${ADAPTER_ALLOWED_HOSTS.join(', ')}`);
    } else if (LOOPBACK_HOSTS.includes(ADAPTER_BIND_HOST)) {
      console.log('Only localhost Host headers are accepted. Behind a reverse proxy or tunnel, set ADAPTER_ALLOWED_HOSTS to its public hostname.');
    }
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);

    if (authRuntime) {
      console.log('OAuth mode: enabled');
      console.log(`OAuth issuer: ${authRuntime.metadataIssuer}`);
      console.log(`OAuth resource server: ${authRuntime.resourceServerUrl}`);
      console.log(`OAuth verifier: ${authRuntime.usingIntrospection ? 'introspection' : 'jwks-jwt'}`);
      if (authRuntime.requiredScopes.length > 0) {
        console.log(`OAuth required scopes: ${authRuntime.requiredScopes.join(', ')}`);
      }
    } else {
      console.log('Private owner bearer authentication enabled.');
    }
  });
}

start().catch((error) => {
  console.error('Adapter startup failed:', error);
  process.exit(1);
});

async function shutdown() {
  for (const [sessionId, active] of sessions.entries()) {
    try {
      await active.transport.close();
      await active.server.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    } finally {
      removeSession(sessionId);
    }
  }
  process.exit(0);
}

// Containers stop with SIGTERM, and node as PID 1 ignores it unless handled.
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
