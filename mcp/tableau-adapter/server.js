import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import * as z from 'zod/v4';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '3334', 10);
const TABLEAU_BASE_URL = (process.env.TABLEAU_BASE_URL || '').replace(/\/+$/, '');
const TABLEAU_API_KEY = process.env.TABLEAU_API_KEY || '';
const ADAPTER_BIND_HOST = process.env.ADAPTER_BIND_HOST || '0.0.0.0';
const ADAPTER_ALLOWED_HOSTS = parseCsv(process.env.ADAPTER_ALLOWED_HOSTS);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const OAUTH_ENABLED = process.env.OAUTH_ENABLED === 'true';

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
  const response = await fetch(`${TABLEAU_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TABLEAU_API_KEY}`,
      ...(init.headers || {}),
    },
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }
  }

  if (!response.ok) {
    const message = parsed?.error || `${response.status} ${response.statusText}`;
    throw new Error(`Tableau backend error (${response.status}): ${message}`);
  }

  return parsed;
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
      version: '1.1.0',
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
          if (payload.active === false) {
            throw new Error('Token is inactive.');
          }

          const tokenAudiences = parseAudiences(payload.aud);
          if (!isAudienceAllowed({ tokenAudiences, expectedAudience })) {
            throw new Error(`Token audience mismatch. Expected: ${expectedAudience}; got: ${tokenAudiences.join(', ')}`);
          }

          return {
            token,
            clientId: payload.client_id || payload.sub || 'unknown-client',
            scopes: parseScopes(payload.scope),
            expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
            resource: parseUrlOrNull(tokenAudiences[0]) || undefined,
          };
        },
      }
    : {
        verifyAccessToken: async (token) => {
          const jwksUri = process.env.OAUTH_JWKS_URI || oauthMetadata?.jwks_uri;
          if (!jwksUri) {
            throw new Error('OAUTH_JWKS_URI (or metadata.jwks_uri) is required when introspection is disabled.');
          }

          const jwks = createRemoteJWKSet(new URL(jwksUri));
          const { payload } = await jwtVerify(token, jwks, {
            issuer: process.env.OAUTH_TOKEN_ISSUER || metadataIssuer,
          });

          const tokenAudiences = parseAudiences(payload.aud);
          if (!isAudienceAllowed({ tokenAudiences, expectedAudience })) {
            throw new Error(`Token audience mismatch. Expected: ${expectedAudience}; got: ${tokenAudiences.join(', ')}`);
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

  const authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  });

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
        let transport;

        transport = new StreamableHTTPServerTransport({
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
    allowedHosts: ADAPTER_ALLOWED_HOSTS.length ? ADAPTER_ALLOWED_HOSTS : 'any',
  });
});

async function start() {
  let authRuntime = null;

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

  attachMcpRoutes(authRuntime?.authMiddleware || null);

  app.listen(PORT, ADAPTER_BIND_HOST, (error) => {
    if (error) {
      console.error('Failed to start adapter:', error);
      process.exit(1);
    }

    console.log(`Tableau MCP adapter listening on port ${PORT}`);
    console.log(`Adapter bind host: ${ADAPTER_BIND_HOST}`);
    if (ADAPTER_ALLOWED_HOSTS.length) {
      console.log(`Adapter allowed hosts: ${ADAPTER_ALLOWED_HOSTS.join(', ')}`);
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
      console.log('OAuth mode: disabled (static backend key only)');
    }
  });
}

start().catch((error) => {
  console.error('Adapter startup failed:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
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
});
