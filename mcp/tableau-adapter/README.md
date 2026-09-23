# Tableu private MCP adapter

Owner-only Streamable HTTP MCP at `/mcp`. This service forwards one personal
Tableu backend credential. It is not a multi-user authorization system.

## Tools

| Tool | Backend |
| --- | --- |
| `start_tarot_reading` | POST `/api/tarot-reading/jobs` with supplied cards |
| `get_tarot_reading_status` | GET `/api/tarot-reading/jobs/:id` |
| `wait_for_tarot_reading` | Poll the existing job; a timeout is not a new reading |
| `cancel_tarot_reading` | POST `/api/tarot-reading/jobs/:id/cancel` |
| `drawTarotReading` | POST `/api/tarot-reading/draw`; backend draws and generates a narrative |
| `saveReadingToJournal` | POST `/api/journal`; explicit user consent required |
| `addReflectionToJournalEntry` | POST `/api/journal/:id/reflections`; explicit consent required |

After explicit consent, pass a draw's returned `savePayload` unchanged to the save
tool. It preserves the full narrative, card order/positions/orientations, canonical
deck identities, metadata and the returned seed. For supplied-card jobs, retain
the actual request cards and completed result; never start another job to save it.

Compatibility extensions to the v0.27.3 audited contract: `personalReading` is
required; numeric backend seeds are accepted and stored as strings; null optional
card metadata is omitted. As in app saves, each card's `name` is its canonical
card, which every journal view and statistic keys on. A deck label that differs,
such as Thoth's Prince of Cups for the canonical Knight, is kept as `displayName`
for display, and `canonicalName`/`canonicalKey` are preserved. A draw's
`savePayload` records `rws-1909` when no deck was chosen, and keeps the location
only when the draw set `persistLocationToJournal`.

Deduplication uses the draw's seed paired with its `requestId`, so saving the same
draw twice returns the original entry, while a later draw with the same caller
seed is saved separately. Omit `sessionSeed` for supplied-card jobs. A
deduplicated save returns the original entry without overwriting it.

A crisis-gated draw (`gateReason: crisis_gate`) returns only the support message,
with no cards and no `savePayload`. Share it; never present or save a reading.

Reflections preserve 1–2,000 characters verbatim and append. Name the card as it
was saved or as the reading showed it, with its position when that name is
repeated. The adapter accepts only an entry id
returned by a successful save in the same MCP transport session. After session
loss, check the app; do not guess an id or repeat an unseeded save to recover it.
No history or archetype-tracking tools are exposed.

Write tools declare `readOnlyHint: false` and `idempotentHint: false`. No network
write is retried automatically. Lost responses, malformed successes and server
failures return `isError: true`, `outcome: unknown`, and instructions to check the
app. Explicit rejections return `outcome: rejected`. An identity mismatch blocks
dispatch with `outcome: not_started`. A failed read, such as a job status poll,
also reports `not_started` with the backend's reason and is safe to repeat.

## Setup and identity proof

Use Node 22.16+ or Node 24. Run `npm ci` in this directory, copy
`.env.example` to an ignored `.env`, and configure:

- `TABLEAU_BASE_URL`: deployed backend HTTPS origin.
- `TABLEAU_API_KEY`: personal app API key (`sk_...`), or temporary personal
  session bearer for verification. Existing app entitlements still apply.
- `TABLEAU_OWNER_USER_ID`: exact `user.id` from the signed-in app's
  `/api/auth/me` response. Do not infer it from an email or successful auth.
- Owner access authentication as described below.

Startup and every backend operation verify `/api/auth/me` and reject a different
or synthetic account. `GPT_SERVICE_TOKEN` represents a synthetic account.
Changing `GPT_SERVICE_USER_ID` to a human id is not a supported workaround.

For read-only account parity proof, set `TABLEAU_APP_SESSION_TOKEN` in the local
process environment from the signed-in app, then run `npm run verify:identity`.
It compares bearer and cookie identity independently and prints only the matched
user id/auth method. Remove that temporary variable afterward. Keep the evidence
private; never commit credentials or actual account identifiers to a public PR.

## Owner access authentication

**Private bearer mode:** set `OAUTH_ENABLED=false` and a separate random
`ADAPTER_OWNER_TOKEN` of at least 32 characters. Every `/mcp` method requires
it, including on localhost. This mode is for clients/tunnels that securely supply
a bearer header; it does not implement ChatGPT account linking. Never put a token
in plugin sources.

**Owner OAuth mode for ChatGPT:** set `OAUTH_ENABLED=true`,
`OAUTH_OWNER_SUBJECT` to the exact owner's issuer subject, and configure the
issuer/metadata/JWKS or introspection fields in `.env.example`. Set
`OAUTH_RESOURCE_SERVER_URL` to the actual deployed HTTPS URL ending `/mcp`.
Configure audience/scopes and register the exact callback shown by ChatGPT at the
issuer. The issuer needs MCP-compatible authorization, PKCE S256, and a supported
client registration method.

Other OAuth subjects are denied, even with an existing session id. OAuth does not
select the backend user: all allowed calls use the separately verified personal
backend credential. See [OpenAI authentication](https://developers.openai.com/plugins/build/auth)
and [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).
Keep the Tableu plugin private.

## Hosting and checks

`npm start` defaults to `127.0.0.1:3334`, which accepts only localhost `Host`
headers. Behind a reverse proxy or tunnel that forwards the public hostname, set
`ADAPTER_ALLOWED_HOSTS` to that hostname. Public/container binding requires
`ADAPTER_BIND_HOST=0.0.0.0` and explicit `ADAPTER_ALLOWED_HOSTS`. Terminate
HTTPS at the host proxy, preserve Authorization/MCP headers, and support SSE
without buffering. Use one replica or sticky sessions; state is in memory.

The optional Dockerfile runs as a non-root user. Inject credentials from the
host's secret store at runtime. This repository does not allocate a real MCP URL.

Run `npm test` here. From the repository root, run `npm test`,
`npm run test:mcp`, `npm run test:e2e:journal`, and `npm run build` after
installing both dependency trees and Playwright Chromium.

`smoke:backend` starts a real reading job and may consume quota; it is not the
read-only identity test. See [the rollout checklist](../../docs/integrations/openai/owner-journal-rollout.md)
for deployment, connection and the live ChatGPT acceptance test.
