# Tableau Backend + ChatGPT App Integration (Production Guide)

Last verified: February 28, 2026

## Goal

Integrate this repo's `tableau` Worker backend into a ChatGPT App via a thin MCP adapter service.

Use an MCP adapter instead of connecting ChatGPT directly to `/api/*` routes.

## Implemented in this repo

Reference implementation is now scaffolded at:

- `mcp/tableau-adapter/server.js`
- `mcp/tableau-adapter/README.md`
- `mcp/tableau-adapter/.env.example`

Root shortcuts:

- `npm run mcp:tableau-adapter:start`
- `npm run dev:mcp:tableau-adapter`

Mode support in scaffold:

- Default: static backend key (`TABLEAU_API_KEY`)
- Optional OAuth mode: `OAUTH_ENABLED=true` + metadata/discovery + bearer validation
- Host-header protection controls: `ADAPTER_BIND_HOST` + `ADAPTER_ALLOWED_HOSTS`

## Why an MCP adapter

- ChatGPT Apps discover and call MCP tools, not arbitrary REST routes.
- You can keep your backend contract stable while evolving tool UX separately.
- You can swap auth mode later (service key now, OAuth later) without changing backend endpoints.

## Backend contract in this repo

- Job routes:
  - `POST /api/tarot-reading/jobs`
  - `GET /api/tarot-reading/jobs/:id`
  - `GET /api/tarot-reading/jobs/:id/stream`
  - `POST /api/tarot-reading/jobs/:id/cancel`
  - Source: `src/worker/index.js:211-214`
- Request payload schema for reading creation:
  - `shared/contracts/readingSchema.js:93`
- Backend accepts bearer API keys (`Authorization: Bearer sk_...`):
  - `functions/lib/auth.js:417-451`
- API key creation/listing is session-auth and Pro-tier gated:
  - `functions/api/keys/index.js:23-35`, `functions/api/keys/index.js:69-81`
- Job token requirement for status/stream/cancel:
  - `functions/api/tarot-reading-job-status.js:13-21`
  - `functions/api/tarot-reading-job-stream.js:15-32`
  - `functions/api/tarot-reading-job-cancel.js:13-21`
- Jobs expire one hour after terminal state:
  - `src/worker/readingJob.js:11`, `src/worker/readingJob.js:442-448`

## Tool mapping (adapter -> backend)

Required starter tools:

1. `start_tarot_reading` -> `POST /api/tarot-reading/jobs`
2. `get_tarot_reading_status` -> `GET /api/tarot-reading/jobs/:id` (+ `X-Job-Token`)
3. `cancel_tarot_reading` -> `POST /api/tarot-reading/jobs/:id/cancel` (+ `X-Job-Token`)

Recommended convenience tool:

4. `wait_for_tarot_reading` -> polls status until `complete` or `error` (hides multi-step orchestration from the model/user).

## Auth model

### Quick start (service account style)

- Keep a backend API key in adapter env: `TABLEAU_API_KEY=sk_...`.
- Adapter sends:
  - `Authorization: Bearer ${TABLEAU_API_KEY}`
  - `X-Job-Token` for job-specific follow-up calls.

### Per-user access (journal/account tools)

For user-scoped data/actions, implement OAuth on the MCP adapter (do not keep a single static backend key):

- Per-tool `securitySchemes`
- `/.well-known/oauth-protected-resource`
- Runtime auth errors containing `_meta["mcp/www_authenticate"]`

## Minimal adapter shape (TypeScript)

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TABLEAU_BASE_URL = process.env.TABLEAU_BASE_URL; // e.g. https://tarot.lakefrontdev.com
const TABLEAU_API_KEY = process.env.TABLEAU_API_KEY;   // sk_...

if (!TABLEAU_BASE_URL || !TABLEAU_API_KEY) {
  throw new Error('Missing TABLEAU_BASE_URL or TABLEAU_API_KEY');
}

const server = new McpServer({
  name: 'tableau-reading-adapter',
  version: '1.0.0',
});

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

function safeParseJson(text: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

async function callTableau(path: string, init: RequestInit = {}) {
  const response = await fetch(`${TABLEAU_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TABLEAU_API_KEY}`,
      ...(init.headers || {}),
    },
  });

  const raw = await response.text();
  const parsed = raw ? safeParseJson(raw) : {};

  if (!response.ok) {
    const errorMessage =
      typeof parsed === 'object' && parsed && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error)
        : `${response.status} ${response.statusText}`;
    throw new Error(`Tableau API error (${response.status}): ${errorMessage}`);
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
}).passthrough();

const jobRefSchema = z.object({
  jobId: z.string().min(1),
  jobToken: z.string().min(1),
});

server.registerTool(
  'start_tarot_reading',
  {
    title: 'Start tarot reading',
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
  }),
);

server.registerTool(
  'get_tarot_reading_status',
  {
    title: 'Get tarot reading status',
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
  }),
);

server.registerTool(
  'cancel_tarot_reading',
  {
    title: 'Cancel tarot reading',
    inputSchema: jobRefSchema,
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: true,
    },
  },
  async ({ jobId, jobToken }) => ({
    structuredContent: await callTableau(`/api/tarot-reading/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: { 'X-Job-Token': jobToken },
    }),
  }),
);

server.registerTool(
  'wait_for_tarot_reading',
  {
    title: 'Wait for tarot reading completion',
    inputSchema: jobRefSchema.extend({
      timeoutSeconds: z.number().int().positive().max(120).default(60),
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
      }) as Record<string, unknown>;

      if (status.status === 'complete' || status.status === 'error') {
        return { structuredContent: status };
      }

      await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
    }

    return {
      structuredContent: {
        status: 'timeout',
        jobId,
        message: 'Timed out waiting for completion. Call get_tarot_reading_status again.',
      },
    };
  },
);
```

Notes:

- Depending on your MCP SDK version, you may see `server.tool(...)` instead of `server.registerTool(...)`.
- Keep transport wiring (`/mcp` HTTP endpoint) in your server bootstrap per SDK docs.

## Connect in ChatGPT (current flow)

As of February 28, 2026:

1. Enable Developer Mode in ChatGPT:
   - `Settings -> Apps & Connectors -> Advanced settings`
2. Create app connector:
   - `Settings -> Connectors -> Create`
3. Provide:
   - Name
   - Description
   - Connector URL: `https://your-adapter-domain/mcp`
4. Confirm tool list loads.
5. In a chat, add the connector via `+ -> More`, then test prompts.

Terminology note:

- ChatGPT renamed "connectors" to "apps" on December 17, 2025, but parts of the UI/docs still reference "Connectors".

## Pre-flight validation checklist

1. Backend direct checks
   - `POST /api/tarot-reading/jobs` returns `jobId` + `jobToken`.
   - `GET /api/tarot-reading/jobs/:id` with `X-Job-Token` returns `running|complete|error`.
   - `POST /api/tarot-reading/jobs/:id/cancel` with same token returns cancellation state.
2. Adapter checks
   - MCP Inspector can list tools from `/mcp`.
   - Every tool returns structured JSON (no HTML/plain-text errors).
3. ChatGPT checks
   - Connector creation succeeds.
   - Tool calls show expected payloads.
   - `start -> wait/status -> done` works in one conversation.

## Common failure modes

- `401 Unauthorized` from backend:
  - Missing/invalid `Authorization: Bearer sk_...` in adapter.
- `403 Invalid job token`:
  - Wrong `X-Job-Token` for the given `jobId`.
- `503 Reading jobs not configured.`:
  - Worker missing `READING_JOBS` binding.
- Tools not appearing in ChatGPT:
  - Wrong connector URL (must end with `/mcp`) or stale connector metadata (refresh connector).
- OAuth linking UI not shown (OAuth mode):
  - Missing resource metadata endpoint or missing `_meta["mcp/www_authenticate"]` on auth errors.

## Source references

OpenAI docs:

- https://developers.openai.com/apps-sdk/quickstart/
- https://developers.openai.com/apps-sdk/build/mcp-server/
- https://developers.openai.com/apps-sdk/build/auth/
- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt/
- https://developers.openai.com/apps-sdk/deploy/troubleshooting/

Repo references:

- `src/worker/index.js:211-214`
- `shared/contracts/readingSchema.js:93`
- `functions/lib/auth.js:417-451`
- `functions/api/keys/index.js:23-35`
- `functions/api/keys/index.js:69-81`
- `src/worker/readingJob.js:11`
