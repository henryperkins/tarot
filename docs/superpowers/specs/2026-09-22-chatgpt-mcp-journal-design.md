# ChatGPT MCP: readings, journal saves, and reflections (owner-only)

Type: design spec
Status: approved by owner after review round 1 (see §13)
Date: 2026-09-22
Branch: `feat/chatgpt-mcp-journal` (based on local `master` at `4f0e125`)

## 1. Goal

Let the Tableu ChatGPT plugin (v0.27.3, migrated from the former Custom GPT) run a
complete reading → save → reflection flow against the production backend, with
every write landing in the owner's own Tableu account. This first version is
private and owner-only. Per-user distribution and archetype-tracking integration
are later work.

Deliverable: one reviewable PR with the backend and MCP changes, tests, and the
deployment requirements in this document.

### Success criteria

1. A draw from ChatGPT returns real backend cards immediately and a narrative
   via the job workflow, with no tool call approaching ChatGPT's ~60 s limit.
2. A saved entry holds the narrative and cards exactly as generated, under the
   owner's verified `user_id`.
3. Saving the same reading twice returns the same entry.
4. A reflection lands on the intended card, or on the whole reading, and renders
   legibly in the app.
5. A wrong-user request or an uncertain outcome is never reported as success.
6. Production deploys go through CI from the merged branch.

## 2. Background

What the 0.27.3 plugin audit (`migration-audit.md` in the plugin package) found,
and what this investigation added:

- **Journal writes are partly implemented locally.** Commit `4f0e125` (local
  `master`, unpushed) switched the journal handlers to `getUserFromRequest` and
  added `POST /api/journal/:id/reflections`. The audit read `origin/master` and
  missed it. The commit diverges from the audited contract in four ways:
  - a 500-character cap, where the contract allows 1–2,000;
  - a `mode: "replace"` option, where the contract is append-only;
  - a 403 for another user's entry, where the contract says 404, "not found for
    this user";
  - no top-level `entryId` or `key` in the response.
- **The shared service token can't identify the owner.** `GPT_SERVICE_TOKEN`
  authenticates as the synthetic `service:gpt` user. Its password hash has no
  known preimage, so no one can ever sign in as it. Entries written through it
  are invisible in the app.
- **ChatGPT ends MCP tool calls after about 60 seconds.** The contract's
  synchronous `drawTarotReading` draws cards and generates the full narrative in
  one call, so it would exceed that. The existing adapter's
  `wait_for_tarot_reading` defaulted to a 60 s wait.
- **ChatGPT can't send an API key to an MCP server.** Per the OpenAI plugin
  docs, the options are OAuth 2.1, no auth, or Secure MCP Tunnel. The docs say
  write actions should authenticate users, and that a plugin may use "your own
  authorization server when you need to connect to an existing server-side
  application".
- **The Node adapter was never deployed.** `mcp/tableau-adapter/` exposes the
  four reading-job tools with a static backend key. It has no hosting target.
- **The journal UI shows raw reflection keys.** It prints map keys as labels
  (`0`, `1`, `Overall`), and the text export prints `Position 0:`. App-saved
  reflections already look like this. Appended notes also run together on one
  line.
- **CI deploys on every push to `master`.** The main checkout carries
  uncommitted `wrangler.jsonc` edits (`PROMPT_DEBUG_ENABLED: "true"`,
  `OPENAI_REASONING_EFFORT: "xhigh"`) that must not ship.

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | The MCP endpoint lives on the main Tableu Worker at `/mcp`. | Owner's choice. It ships with the normal CI deploy, and there's no second service to run. |
| D2 | Authentication is OAuth 2.1 with Tableu as the authorization server, using `@cloudflare/workers-oauth-provider`. | This is the plugin docs' model for write tools. Writes resolve to the signed-in Tableu account by construction. The library supports PKCE S256, DCR, RFC 8707 and RFC 9207. |
| D3 | Access is limited to the owner by a `user_id` allowlist (`MCP_ALLOWED_USER_IDS` secret). If the secret is unset, nobody can link. | Keeps this version private. Deploying the code doesn't enable it. The same code becomes per-user by dropping the allowlist. |
| D4 | MCP tools call service functions with an explicit principal. OAuth tokens are valid only at `/mcp`. | Least privilege: `/api/*` routes learn no new credential. The app and ChatGPT share one validation and dedup path. |
| D5 | Saves rebuild the entry from the completed job's snapshot. The contract payload remains as a fallback. Both modes share one reading identity (D9). | The narrative and cards never pass through the model, so they can't drift. A reading saved in either mode is recognised by the other. |
| D6 | Draws run as jobs: the server draws, starts a job, and returns the cards immediately. | Respects the ~60 s tool limit and keeps the existing job workflow. |
| D7 | `mcp/tableau-adapter/` is retired. Its four tools move into the Worker unchanged in name. | Avoids two diverging tool definitions and a static-key auth model the docs discourage. |
| D8 | Client registration uses DCR only. CIMD is disabled. | The library's CIMD support needs the Worker-wide `global_fetch_strictly_public` compatibility flag, which would change `fetch` behaviour for the whole app. The docs still support DCR. |
| D9 | MCP saves carry a reading identity, `idempotency_key = "reading:<requestId>"`, enforced by a partial unique index (migration `0030`). | A lookup followed by an insert can race: `idx_journal_request_id` is non-unique. The constraint makes deduplication atomic, and the app path is untouched. |
| D10 | Principal-backed jobs are reachable only through MCP. The public `/status`, `/stream`, and `/cancel` routes answer 404 for them. | Job tokens reach the ChatGPT conversation. Outside `/mcp` they must not grant access, before or after allowlist removal. |
| D11 | Saved cards take canonical identity from the reading pipeline's own resolver (`resolveReadingCards`). | Deck labels such as Thoth "Prince of Wands" aren't catalog names. Every consumer of journal cards reads canonical `name`: thumbnails, archetype tracking, search, and follow-up context. |
| D12 | The MCP handler enforces the `tableu` scope on the access token before dispatch. | The provider validates existence, expiry, resource and audience, but not scope. |
| D13 | Dynamically registered clients never expire. Registration is limited to ChatGPT callback and loopback redirect URIs, and is rate-limited. | ChatGPT registers once per connection and reuses the client. OpenAI requires the client to stay valid while the connection exists. |

## 4. Architecture

```text
ChatGPT (plugin app, OAuth-linked)
  │  POST https://tarot.lakefrontdev.com/mcp   Authorization: Bearer <access token>
  ▼
Worker fetch (src/worker/index.js)
  ├─ /mcp, /oauth/*, /.well-known/oauth-authorization-server,
  │  /.well-known/oauth-protected-resource[/…]  ──► OAuthProvider (OAUTH_KV)
  │      ├─ /oauth/token, /oauth/register, well-known docs   (provider-owned)
  │      ├─ /oauth/authorize  ──► consent handler (session cookie, allowlist, CSRF)
  │      └─ /mcp (valid token) ──► MCP handler, ctx.props = { userId }
  └─ everything else ──► existing router, unchanged

MCP handler
  token scope check (tableu) → allowlist check → loadActiveUserById → McpServer(tools bound to user)
  → WebStandardStreamableHTTPServerTransport (stateless, JSON responses)

Tools ──► service functions (explicit user)
  draw/start      → serverDraw.drawForSpread + readingJobs.startReadingJob({ principal, snapshot })
  status/wait/cancel → ReadingJob DO (job token + principal match)
  save            → job snapshot → buildJournalEntryFromJob → journalEntries.saveJournalEntry
  reflect         → journalReflections.addJournalReflection
  profile         → the resolved user

ReadingJob DO
  start message may carry { principal: { userId }, snapshot }
  runJob → tarot-reading handler with { principal } → loadActiveUserById (no headers)
```

## 5. Public surface and authentication

### 5.1 Routing

`src/worker/index.js` hands exactly these paths to a lazily built,
per-environment `OAuthProvider`:
- `/mcp` and anything under it;
- `/oauth/*`;
- `/.well-known/oauth-authorization-server`;
- `/.well-known/oauth-protected-resource`, including path-suffixed variants.

Every other path keeps the current handler byte for byte. If the `OAUTH_KV`
binding is absent, those paths return 404 and the rest of the app is unaffected.

Provider options:

| Option | Value |
|---|---|
| `apiRoute` / `apiHandler` | `/mcp` / MCP handler |
| `defaultHandler` | serves `/oauth/authorize` (GET and POST); everything else here → 404 |
| `authorizeEndpoint` | `/oauth/authorize` |
| `tokenEndpoint` | `/oauth/token` |
| `clientRegistrationEndpoint` | `/oauth/register` |
| `scopesSupported` | `["tableu"]` |
| `accessTokenTTL` / `refreshTokenTTL` | library defaults (1 h / 30 d) |
| `allowPlainPKCE`, `allowImplicitFlow` | `false` (defaults) |
| `clientIdMetadataDocumentEnabled` | `false` (D8) |
| `clientRegistrationTTL` | explicitly `undefined`, so registered clients never expire (D13). The library merges options over its defaults, so this override replaces the 90-day default. |
| `clientRegistrationCallback` | Rejects a registration unless every `redirect_uris` entry is one of: `https://chatgpt.com/connector_platform_oauth_redirect`, `https://chatgpt.com/connector/oauth/<callback_id>`, or loopback `http://localhost:<port>/…` or `http://127.0.0.1:<port>/…` (MCP Inspector, and Codex later). Anything else gets `invalid_redirect_uri`. |
| `resourceMetadata` | `{ resource: env.MCP_RESOURCE_URL, scopes_supported: ["tableu"], resource_name: "Tableu" }` |

`POST /oauth/register` is rate-limited per client IP to 10 an hour, using the
existing `RATELIMIT` KV before the provider sees the request. Clients are never
deleted automatically. A ChatGPT connection keeps working however long it sits
idle. When its 30-day refresh token lapses, ChatGPT re-runs authorization with
the same, still-valid `client_id`.

`MCP_RESOURCE_URL` is a new var, `https://tarot.lakefrontdev.com/mcp`. Pinning
it binds grants and access-token audiences to exactly that resource (RFC 8707).

A grant stores only `props: { userId }` and `metadata: { username }`. There is
one scope, `tableu`.

### 5.2 Consent page (`/oauth/authorize`)

This is server-rendered HTML with no scripts.
- **GET.**
  1. `env.OAUTH_PROVIDER.parseAuthRequest(request)` parses the request and
     validates the client, response type, and redirect URI. A parse failure
     returns a 400 page and never redirects.
  2. `lookupClient` supplies the client name to display.
  3. The session comes from the existing `session` cookie via
     `getSessionFromCookie` and `validateSession`.
- **Signed out.** The page says "Sign in to Tableu to continue", links to the
  app, and offers a "Continue" button that reloads the same URL.
- **Signed in, but not allowlisted.** The page refuses and shows that account's
  `user_id`, so the owner can copy it into `MCP_ALLOWED_USER_IDS`. It never
  redirects.
- **Allowed.** The page names the client and lists what it may do: draw
  readings (these count against your reading quota), save readings to your
  journal, and add reflections. It shows "Signed in as @username" with Allow and
  Deny buttons.
- **POST** goes to the same URL with the query string preserved. It checks, in
  order:
  1. A CSRF double-submit token. The GET sets a random value in a
     `__Host-oauth_csrf` cookie (`Secure; HttpOnly; SameSite=Strict; Path=/`)
     and in a hidden form field; the POST compares the two in constant time.
  2. The `Origin` header, which must be the app's origin when present.
  3. The session, again.
  4. The allowlist, again.
- **Allow** calls `completeAuthorization({ request, userId, metadata: { username }, scope: ["tableu"], props: { userId } })`
  and responds 302 to `redirectTo`. `iss` is added by the library.
- **Deny** responds 302 to the redirect URI that `parseAuthRequest` validated,
  with `error=access_denied`, `state`, and `iss`.
- **Response headers:**
  - `Cache-Control: no-store`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - CSP: `default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'`

  The CSP deliberately omits `form-action`. Chromium enforces `form-action` on
  the post-submit 302 to the client's redirect URI, so including it would break
  the flow.

### 5.3 `/mcp`

The library validates the token's existence, expiry, resource binding and
audience. It does not check scope; `ctx.props` carries only the decrypted grant
props. The MCP handler then does five things:
1. Enforces scope (D12). It reads the bearer token from `Authorization` and
   calls `env.OAUTH_PROVIDER.unwrapToken(token)`, which returns the access
   token's own `scope` (a refresh can narrow it below the grant). If `tableu` is
   missing, it returns 403 with
   `WWW-Authenticate: Bearer error="insufficient_scope", scope="tableu", resource_metadata="…"`,
   and no tool runs.
2. Rejects `ctx.props.userId` values that aren't in `MCP_ALLOWED_USER_IDS`.
   Removing an ID kills every existing token immediately.
3. Loads the user with `loadActiveUserById`. The account must exist and have
   `is_active = 1`. Failures in steps 2 or 3 return 401 with
   `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="…"`.
4. Builds an `McpServer` with the tools bound to that user and object. It uses
   `jsonSchemaValidator: new CfWorkerJsonSchemaValidator()`, because Ajv's
   runtime code generation is disallowed on Workers.
5. Serves the request through `WebStandardStreamableHTTPServerTransport` with
   `sessionIdGenerator: undefined` and `enableJsonResponse: true`. This is
   stateless, so no sessions live in isolate memory. GET and DELETE return 405.

Every request is authenticated before any tool runs, so every auth failure,
including an account deactivated between calls, is an HTTP 401 or 403 with
`WWW-Authenticate`, which prompts ChatGPT to re-link. There is no tool-level
auth failure path, so no tool result carries `_meta["mcp/www_authenticate"]`.
That field only matters for servers that let some tools run anonymously.

### 5.4 Identity (step 3)

`get_profile` returns the resolved user's `id`, a display `name`, and a
`nickname`. It is marked `_meta["openai/profile"]: true` and uses the
documented output schema. Every tool uses the same resolved user object, so a
write can't land under a different account.

### 5.5 Synthetic service account on journal routes

The journal HTTP handlers keep `getUserFromRequest` from `4f0e125`. They are:
- `GET` and `POST /api/journal`;
- `GET` and `DELETE /api/journal/:id`;
- `POST /api/journal/:id/reflections`.

These handlers reject `auth_provider: 'service'` with 403 and
`{ error: "Journal requires a personal account", code: "service_account_journal_forbidden" }`.
`sk_` API keys, bearer session tokens and cookies keep working. The follow-ups
route stays cookie-only.

### 5.6 Not exposed

There are no tools to read, list, search, or delete journal entries, no account
tools, no `includePromptDebug`, and no location fields.

## 6. MCP tools

Server metadata: name `tableu`, version `1.0.0`. The server `instructions`
describe the order of use:
1. Draw with `draw_tarot_reading`, or start from supplied cards with
   `start_tarot_reading`.
2. Wait with `wait_for_tarot_reading`, and never start a second job for the
   same request.
3. Present the cards and the narrative.
4. Call `save_reading_to_journal` or `add_reflection_to_journal_entry` only on
   the user's explicit request, or an unambiguous yes right after an offer.

All tools share these settings:
- `openWorldHint: false`;
- `_meta.securitySchemes: [{ type: "oauth2", scopes: ["tableu"] }]`. The SDK
  passes custom descriptor fields only through `_meta`, which OpenAI documents
  as the back-compatible mirror. Every tool also inherits the server-wide OAuth
  requirement, because `/mcp` answers 401 before any MCP request runs;
- an `outputSchema`, as the docs ask for any tool that returns
  `structuredContent`.

Status strings go in `_meta["openai/toolInvocation/invoking" | "…/invoked"]`,
at most 64 characters.

| Tool | Hints | Input | Output (`structuredContent`) |
|---|---|---|---|
| `get_profile` | readOnly | `{}` | `{ id, name?, nickname? }` |
| `draw_tarot_reading` | write | see §6.1 | `{ jobId, jobToken, status: "running", spreadInfo, cardsInfo, seed, deckStyle }` |
| `start_tarot_reading` | write | see §6.2 | `{ jobId, jobToken, status: "running" }` |
| `wait_for_tarot_reading` | readOnly | `{ jobId, jobToken, timeoutSeconds? }` (integer 1–45, default 40) | compact status (§6.3) + `timedOut` |
| `get_tarot_reading_status` | readOnly | `{ jobId, jobToken }` | compact status |
| `cancel_tarot_reading` | destructive | `{ jobId, jobToken }` | `{ jobId, status: "cancelled" }` |
| `save_reading_to_journal` | write | see §6.4 | `{ outcome: "saved" \| "already_saved", entry: { id, ts }, deduplicated, seedShared? }` |
| `add_reflection_to_journal_entry` | write | see §6.5 | `{ outcome: "added" \| "already_present", entryId, key, target, text }` |

"Write" means `readOnlyHint: false` and `destructiveHint: false`. Only
`cancel_tarot_reading` sets `destructiveHint: true`.

### 6.1 `draw_tarot_reading`

Input follows the audited `DrawTarotReadingRequest`, minus `location`,
`persistLocationToJournal` and `includePromptDebug`:

- `spreadInfo: { name: string, key: "single" | "threeCard" | "fiveCard" | "decision" | "relationship" | "celtic" }` (both required)
- `userQuestion?` (≤ 2,000), `reflectionsText?` (≤ 5,000), `reversalFrameworkOverride?`
- `deckStyle?`: `"rws-1909" | "thoth-a1" | "marseille-classic"`, default `rws-1909`
- `allowReversals?`: boolean, default `true`
- `seed?`: string (≤ 256). The same seed and spread give the same cards.
- `personalization?`: the contract's `Personalization` shape

Behaviour:
1. `serverDraw.drawForSpread` produces the cards, exactly as
   `/api/tarot-reading/draw` does.
2. `readingJobs.startReadingJob` starts a job with `principal: { userId }` and a
   snapshot:
   `{ spreadInfo, cardsInfo, userQuestion, deckStyle, personalization, seed }`.
3. The tool returns at once. `seed` is the 32-bit draw seed as a decimal string.

Each returned card is
`{ position, card, orientation, meaning, number, suit, rank, rankValue }`:
- `card` is the label for the selected deck, for example Thoth "Prince of
  Wands";
- the metadata comes from the catalog.

The canonical-namespace fields that `buildReadingRequestCard` also produces
(`canonicalName`, `canonicalKey`, `aliases`) are not exposed. The model then
works with a single naming scheme, and the server re-derives identity when it
saves (§6.4).

The job consumes one reading from the owner's normal quota when it runs.

### 6.2 `start_tarot_reading`

Input follows the audited `CreateTarotReadingRequest` minus the same three
fields:
- `spreadInfo: { name, key? }`;
- `cardsInfo` (1–78 items), each
  `{ position, card, orientation, meaning, number?, suit?, rank?, rankValue? }`;
- the optional fields from §6.1, except `allowReversals` and `seed`.

`orientation` accepts `upright | reversed | Upright | Reversed` and is normalized
to the capitalized form the reading schema requires.

Before the job starts, the cards are resolved with
`resolveReadingCards(cardsInfo, deckStyle)`. This is the same check the reading
pipeline would make later, done here so it fails before any quota is used.
- An unrecognized card returns "Not started" with its index.
- The snapshot stores each card's label together with its catalog metadata, so
  status outputs carry the same shape as a draw (§6.1).
- The snapshot has no seed.

### 6.3 Compact status

```ts
{
  jobId, status: "running" | "complete" | "error",
  spreadInfo, cardsInfo, seed?,          // from the job snapshot (ground truth; card shape as in §6.1)
  reading?, provider?, requestId?,       // when complete
  themes?,                               // meta.themes when available
  gateBlocked?, gateReason?,             // when present
  error?,                                // when status is "error"
  timedOut?                              // wait only
}
```

Large `meta` fields (spread analysis, GraphRAG, diagnostics) are omitted.

If `wait_for_tarot_reading` times out while the job is still running, it
returns `status: "running"`, `timedOut: true`, and text saying: call wait again
with the same job reference, and don't start a new reading.

A job that isn't the caller's returns "Reading job not found." That covers an
unknown ID, a wrong token, a missing principal (for example, an app job), or
another user's principal.

### 6.4 `save_reading_to_journal`

Use exactly one mode. Supplying `jobId` or `jobToken` together with any payload
field other than `context` returns a validation error, and nothing is written.

**Job mode (preferred).** Input is `{ jobId, jobToken, context? }`. `context` is
one of `love | career | self | spiritual | wellbeing | decision | general`.

1. Load the job snapshot. It must be the caller's job, with
   `status === "complete"` and a non-empty reading.
2. Refuse crisis safety-gate results (`provider === "safety-gate"` or
   `gateReason === "crisis_gate"`), which are not readings. Eval-gated
   replacement narratives are what the user saw, so they are saveable.
3. Build the entry with `buildJournalEntryFromJob`, following the audited
   mapping:

   | Job source | Journal field |
   |---|---|
   | `snapshot.spreadInfo.name` | `spread` |
   | `snapshot.spreadInfo.key` | `spreadKey` |
   | `snapshot.userQuestion` | `question` |
   | `result.reading` (verbatim) | `personalReading` |
   | `meta.themes` | `themes` |
   | `result.provider` | `provider` |
   | `result.requestId` | `requestId` |
   | `snapshot.seed` | `sessionSeed` |
   | `snapshot.deckStyle` | `deckId` |
   | `snapshot.personalization` | `userPreferences` |
   | tool input `context` only | `context` |

   Cards follow the contract's `JournalCard` shape, with canonical identity
   (D11):
   - Run the snapshot's cards through
     `resolveReadingCards(cardsInfo, deckStyle)`. This is the resolver the
     reading pipeline used for the same cards. Its input is each card's deck
     label (`cardsInfo[].card`).
   - `name` is the resolved catalog name. That's what the app's own saves store
     (`useSaveReading`), and what thumbnails (`getCardImage`), archetype
     tracking, journal search and follow-up context read. For example, Thoth
     "Prince of Wands" is stored as "Knight of Wands", and Thoth "Knight of
     Wands" as "King of Wands".
   - `number`, `suit`, `rank` and `rankValue` come from the catalog; nulls are
     omitted.
   - Keep `position`. Orientation becomes `Upright` or `Reversed`. Keep the
     order. Drop `meaning` and everything else.
   - The deck-specific label is not stored separately; it can be recomputed
     from `name` plus `deckId` with `getDeckAlias`.

   This deliberately tightens the contract's literal "`card` → `name`" row. The
   contract assumed RWS names, where label and canonical name are the same. For
   RWS readings the result is identical.

   The reading response's context object is never copied.
4. Call `saveJournalEntry` in job mode (§7.2).

**Payload mode (fallback when the job has expired).** Input is the audited
`SaveReadingRequest`, with one addition:
- Required: `spread`, `spreadKey` (enum), `cards` (`JournalCard[]`, at least
  one), `personalReading`, and `requestId`.
  - `personalReading` must be non-empty. The contract marks it optional, but
    omitting it loses the narrative.
  - `requestId` is required here, although the contract has it optional. It is
    the reading's identity (D9), and every backend reading has one.
- Optional: `question`, `themes`, `context`, `provider`, `sessionSeed`,
  `deckId` and `userPreferences`.
- Each card carries its label and its catalog identity, exactly as the
  reading's `cardsInfo` returned them.
  - `name` is the label (`cardsInfo[].card`).
  - Identity metadata is required: `number` for a Major Arcana card, `suit` and
    `rankValue` for a Minor Arcana card. The draw and status outputs always
    include these (§6.1–6.3), so the model has them.
- Resolution works in two steps:
  1. Look up the catalog card by its metadata.
  2. Resolve the label with `resolveReadingCards(…, deckId ?? "rws-1909")`.
     It must name the same card.
  - If either step fails, or the two disagree, the result is "Not saved", with
    the card's index and both readings of it.
  - That catches the ambiguous case where a canonical name is sent for a
    non-RWS deck: canonical "Knight of Wands" under Thoth resolves to the King.

It is validated strictly, stored with canonical cards, and saved under the same
reading identity as job mode (§7.2).

### 6.5 `add_reflection_to_journal_entry`

Input: `{ entryId, text, scope: "reading" | "card", card?, position? }`.
- `text` is the user's words verbatim, 1–2,000 characters; only outer
  whitespace is trimmed.
- `card` is required when `scope` is `card`.
- `position` is required when that card name occurs more than once in the
  entry.

This calls `addJournalReflection` (§7.3).

The output `target` is either `{ scope: "reading" }` or
`{ scope: "card", card, position, cardIndex }`. `text` is the full stored note
for that target after the operation.

## 7. Backend internals

### 7.1 Service layer (`functions/lib/`)

| Module | Exports | Used by |
|---|---|---|
| `journalEntries.js` | `saveJournalEntry({ env, user, entry, mode, waitUntil })` | `POST /api/journal` (thin wrapper, keeps today's lenient validation) and the MCP save |
| `journalReflections.js` | `addJournalReflection({ env, user, entryId, text, scope, card, position, cardIndex })`, `resolveCardIndex` | `POST /api/journal/:id/reflections` (thin wrapper) and the MCP reflect |
| `readingJobs.js` | `startReadingJob({ env, payload, principal?, snapshot?, forwardHeaders? })`, `getJobSnapshot`, `cancelJob` | `tarot-reading-job-start.js` (wrapper, unchanged behaviour) and the MCP tools |
| `serverDraw.js` | `drawForSpread(payload)` → `{ spreadKey, spreadInfo, cardsInfo, seed }` or `{ error, status }` | `tarot-reading-draw.js` (wrapper, unchanged behaviour) and the MCP draw |
| `auth.js` | `loadActiveUserById(db, id)` returns the same shape as `validateSession`, with null session fields | tarot-reading principal path and the MCP handler |
| `mcp/*.js` | the provider factory, consent handler, MCP handler, tool registration, and `buildJournalEntryFromJob` | Worker entry |

### 7.2 Save and dedup rules

**Schema.** Migration `0030_add_journal_idempotency_key.sql`:

```sql
ALTER TABLE journal_entries ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_user_idempotency_key_unique
  ON journal_entries(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

Existing rows stay `NULL`, so the index builds on any data. `scripts/deploy.js`
applies migrations before the Worker deploys, and CI uses that script.

**App path (`POST /api/journal`)** keeps the contract's behaviour and never sets
`idempotency_key`.
- A save with `sessionSeed` looks up `(user_id, session_seed)`. On a hit it
  returns 200 with `deduplicated: true` and the existing entry, unchanged.
- A save without a seed always inserts.
- One fix applies here: if two saves race and the insert fails on
  `idx_journal_user_session_seed_unique`, the loser re-reads by seed and returns
  that deduplicated response instead of a 500.

**MCP saves, both modes.** Every MCP save carries
`idempotency_key = "reading:" + requestId`. In job mode the `requestId` is the
job's; in payload mode it is the required input. The unique index makes this
atomic.

1. **Insert first.** Insert the row with `idempotency_key`, and with
   `session_seed` when there is one.
2. **The key is already taken.** The insert fails on
   `idx_journal_user_idempotency_key_unique`: this reading, or a concurrent save
   of it, is already stored. Re-read the row by `(user_id, idempotency_key)` and
   check identity. The reading's card fingerprint is the ordered list of
   `(position, canonical name, orientation)` plus `spreadKey`.
   - It matches: `already_saved`, returning the existing entry, unchanged.
   - It doesn't: "Not saved: your journal already holds a different reading
     under this request ID". Nothing is written. This covers a model reusing
     another reading's `requestId` in payload mode.
3. **The seed is taken by another reading.** The insert fails on
   `idx_journal_user_session_seed_unique`, for example because of a reused seed
   phrase. The seed never identifies a reading on MCP paths, so retry the insert
   once with `session_seed = NULL`, keeping `idempotency_key`. The result is
   `saved` with `seedShared: true`. That retry can itself hit step 2 if a
   concurrent save of the same reading won; step 2 handles it.
4. **Verify after error.** If the insert fails for any other reason, re-read by
   `(user_id, idempotency_key)` before answering. If the row is there with a
   matching fingerprint, the answer is `saved`; otherwise a definite "Not saved".

So a reading is stored at most once, whichever mode, order or concurrency, and a
seed can never make one reading report another reading's entry as its own.

Coach extraction is still scheduled for newly inserted entries that have a
narrative.

### 7.3 Reflections: aligning `4f0e125` with the contract

- `MAX_REFLECTION_LENGTH` becomes 2,000. This matches the audited contract and
  `CARD_REFLECTION_MAX_LENGTH` in `shared/contracts/readingSchema.js`.
- Replacing is gone; reflections only append. A request that includes `mode`
  gets 400 "Reflections are append-only".
- A missing entry and another user's entry return the same 404,
  `{ error: "Entry not found" }`.
- The response is
  `{ success, entryId, key, reflection, reflections }` plus
  `alreadyPresent` when applicable. That's a superset of the contract's
  `ReflectionResponse`.
- Retries are idempotent through a stable operation identity: the entry, the
  target key, and the exact (outer-trimmed) text.
  - The check is against every note on the target, not only the last one. A
    target's value is its notes joined by `"\n\n"`, so a note is present when
    `("\n\n" + stored + "\n\n").includes("\n\n" + text + "\n\n")`.
  - If it is present, nothing is written and `alreadyPresent: true` is
    returned. That covers the interleaving where note A succeeds, its response
    is lost, note B lands, and then A is retried.
  - The identity is derived from the content rather than supplied by the
    caller. A ChatGPT retry is a fresh model call, which can't be relied on to
    reuse a nonce, but it does resend the user's verbatim words.
  - The trade-off is documented in the tool description. Adding exactly the
    same text to the same target twice is treated as one note. So is a note
    identical to a run of paragraphs already on that target.
- A single target holds at most 20,000 characters. An append that would exceed
  that gets 400 "This reflection is full".
- Writes use compare-and-swap:
  `UPDATE … SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND reflections_json IS ?`,
  where the last value is the JSON that was read. If no row changes, re-read,
  re-run the presence check, and retry, up to 3 attempts, then return a 409
  "Please retry". Two concurrent retries of the same note therefore end with one
  write and one `alreadyPresent`.
- Keys stay as they are: `"0"`, `"1"`, … for cards, `Overall` for the whole
  reading. Card resolution stays as in `4f0e125`: `card`, `position` or
  `cardIndex`, case-insensitive, with a leading "the" ignored. It returns 400
  with the entry's card list when the card is absent or ambiguous.
- `tarot-journal-actions.yaml` is updated to match: the operation IDs become
  `saveReadingToJournal` and `addReflectionToJournalEntry`; `maxLength` becomes
  2,000; the append-only, 404 and response-field rules are added.

### 7.4 Principal path for reading jobs

- **`ReadingJob` start message.** It accepts optional `principal: { userId }`
  and `snapshot`. When a principal is present it stores `principalUserId` and
  the snapshot, and sets retention to 24 h after the terminal state. App jobs
  keep 1 h.
- **`runJob`.** For principal jobs it calls the `tarot-reading` handler with
  `{ request, env, waitUntil, principal }` and no auth headers. Other jobs are
  unchanged.
- **`tarot-reading.js`.** It uses `loadActiveUserById(env.DB, principal.userId)`
  when `principal` is present, and `getUserFromRequest` otherwise. A principal
  that doesn't resolve returns 401.
  - *Why this can't be forged.* Only Worker code constructs these contexts. The
    router builds its context from fixed fields and never copies request data
    into `principal`. The public job-start route never forwards a principal.
    Durable Object paths are reachable only through `stub.fetch` from Worker
    code.
- **Principal jobs are reachable only through MCP (D10).**
  - The DO's `/status`, `/stream` and `/cancel` handlers serve the public
    `/api/tarot-reading/jobs/:id[/stream|/cancel]` routes. They answer 404
    "Reading job not found." for any job that has a `principalUserId`, the same
    as for an unknown job. A job token that surfaces in a ChatGPT conversation
    grants nothing outside `/mcp`, before or after allowlist removal.
  - App jobs, which have no principal, behave exactly as today.
- **Two new internal DO paths serve the MCP tools:**
  - `/mcp/snapshot` returns
    `{ jobId, status, snapshot, result, error, meta: { themes } }`;
  - `/mcp/cancel` cancels the job.

  Each requires `X-Job-Token` *and* `X-Principal-User-Id`, the latter matching
  the stored principal. Only Worker code reaches a DO, through `stub.fetch`, and
  the public route handlers build their own `Headers` with only `X-Job-Token`.
  So no external request can present a principal or reach these paths.
- **Quota.** Principal jobs run as the owner's account, so they count against
  normal reading limits. `auth_provider` is the account's own, so API-key
  metering doesn't apply.

### 7.5 App rendering

- **Labels.** A new pure helper, `shared/journal/reflectionLabels.js`, maps a
  reflections map plus the entry's cards to ordered `[label, note]` pairs:
  - `Overall` becomes "Whole reading" and comes first;
  - a card-index key `i` becomes `"<position> · <name>"` from the entry's cards,
    falling back to `Card i+1`;
  - any other key is kept as-is.

  Cards follow in spread order, then the other keys.
- **Journal UI.** `useEntryMetadata` uses the helper. `ReflectionsSection`
  renders notes with `whitespace-pre-line`, so appended notes stay separate
  paragraphs.
- **Export.** `functions/api/journal-export/index.js` uses the same labels in
  place of `Position <key>:`.

### 7.6 Housekeeping

- Remove `mcp/tableau-adapter/` and the root scripts `dev:mcp:tableau-adapter`,
  `mcp:tableau-adapter:start` and `mcp:tableau-adapter:smoke-backend`. The
  Dependabot branch for it becomes moot.
- New root dependencies, pinned: `@modelcontextprotocol/sdk` (1.30.x),
  `@cfworker/json-schema`, and `@cloudflare/workers-oauth-provider` (0.10.3,
  exact).
- New root devDependency: `sql.js`, for the SQLite test harness (§9).
- New migration: `0030_add_journal_idempotency_key.sql` (§7.2).
- `wrangler.jsonc` gains an `OAUTH_KV` KV binding (a new namespace) and the var
  `MCP_RESOURCE_URL`.

## 8. Errors and uncertain outcomes

Each tool's `content` text states the outcome outright. Failures set
`isError: true`, and the text begins with one of: "Not saved:", "Not added:",
"Not started:", "Not cancelled:", "Could not confirm:".

| Situation | Result |
|---|---|
| Input fails validation | Zod field errors; one corrected retry is appropriate |
| Unknown or someone else's entry or job; wrong job token | Identical "not found" (no existence oracle) |
| Tier or quota limit (403, 429) | Backend message plus `requiredTier`; the text says not to retry |
| User deactivated or removed from the allowlist | Refused before any tool runs: HTTP 401 with `WWW-Authenticate` (§5.3), which prompts ChatGPT to re-link. |
| Access token lacks the `tableu` scope | HTTP 403 `insufficient_scope` before any tool runs (§5.3) |
| Payload `requestId` already holds a different reading | "Not saved: your journal already holds a different reading under this request ID"; nothing is written |
| A card label is unknown, or contradicts its metadata | "Not saved" or "Not started", with the card's index; nothing is written |
| Job expired (410) in a job-mode save | "Not saved: this reading's job has expired" plus a payload-mode hint |
| Crisis safety-gate job | "Not saved: this response was a safety message, not a reading" |
| Unexpected internal error on a write | Verify after error (§7.2). If it still can't be decided: "Could not confirm … check the Tableu app" |

**Retry guidance in tool descriptions.** Any save, in either mode, and any
reflection may be retried once after an unclear failure. A save is keyed by the
reading's `requestId` (§7.2), and a reflection by its exact text on its target
(§7.3), so a retry can't create a duplicate. If the retry also fails, the tool
says "Could not confirm" and points to the app.

**Logging.** Log the tool name, outcome, `requestId`, job ID, entry ID and
duration. Never log tokens, narratives, reflection text or questions.

## 9. Testing

All tests use `node --test`, live in `tests/*.test.mjs`, and run in CI on Node
20.

The journal save and reflection services run against real SQLite. A new test
helper, `tests/helpers/d1Sqlite.mjs`, wraps `sql.js` (a devDependency: SQLite
compiled to WASM, with no native build). It applies the repository's
`migrations/*.sql` in order and exposes the D1 API used by the code
(`prepare`/`bind`/`first`/`run`/`all`/`batch`), with asynchronous boundaries
like D1's. Unique indexes, partial indexes and constraint errors therefore
behave as in production. If a migration uses syntax `sql.js` can't run, the
helper applies only the `users` and `journal_entries` schema those tests need,
and records the gap in the helper's header. Other tests keep the existing
hand-rolled doubles.

1. **`journalEntriesService.test.mjs`** (SQLite harness)
   - **App path:**
     - a new save returns 201;
     - a seeded duplicate returns 200 `deduplicated`;
     - two concurrent seeded saves (`Promise.all`) leave one row, and both
       responses carry its ID.
   - **MCP concurrency.** Two concurrent saves of the same seedless reading
     (`Promise.all`) leave exactly one row, and both report that entry, one as
     `saved` and one as `already_saved`. This reproduces the race in the review
     that motivated D9.
   - **MCP across modes.** Job mode then payload mode, and payload mode then job
     mode, leave one row, with `already_saved` on the second save.
   - **MCP identity conflicts:**
     - a payload `requestId` that belongs to a different stored reading is
       refused with nothing written;
     - a seed held by a different reading gives `session_seed NULL` plus
       `seedShared`, and a later save never returns that other entry.
   - **Verify after error** gives both "saved" and "not saved".
   - The service account gets 403 on every journal route.
   - The narrative is stored byte for byte: Unicode, CRLF and leading or
     trailing whitespace in the body, a 20k-character text.
2. **`journalReflections.test.mjs`** (updated) and
   **`journalReflectionsService.test.mjs`** (SQLite harness)
   - Text lengths 1, 2,000, 2,001 and empty.
   - `mode` gets 400.
   - A wrong user and a missing entry give identical 404s.
   - The response carries `entryId` and `key`.
   - The append separator.
   - An immediate retry gives `alreadyPresent`.
   - A, then B, then a retry of A: A is not duplicated.
   - Two concurrent identical retries end with one write and one
     `alreadyPresent`.
   - The 20k-character target cap.
   - A compare-and-swap conflict retries, and three failures give 409.
   - Targeting:
     - by name;
     - by name and position;
     - a duplicate name without a position gives 400;
     - an absent card gives 400 with the card list;
     - case and a leading "the" are ignored;
     - reading scope uses `Overall`.
3. **`mcpJournalMapping.test.mjs`**
   - Every row of the mapping table (§6.4).
   - **Canonical identity per deck:**
     - RWS labels are unchanged;
     - Thoth "Prince of Wands" is stored as "Knight of Wands";
     - Thoth "Knight of Wands" is stored as "King of Wands";
     - Marseille labels, including the "(RWS: …)" form, are canonicalized;
     - each stored card resolves through `getCardImage` to the correct catalog
       image, never the card back.
   - **Payload mode:**
     - metadata is required;
     - metadata that contradicts the label is refused (canonical "Knight of
       Wands" sent under Thoth);
     - an unresolvable label is refused, with its index.
   - `start_tarot_reading` rejects an unrecognized card before a job starts.
   - Orientation normalization; `meaning` is dropped; catalog metadata only;
     `context` comes from input only; the reading context object never leaks.
4. **`mcpTools.test.mjs`** (SDK `Client` over `InMemoryTransport`)
   - `tools/list`: 8 tools with the right hints, `securitySchemes`,
     `outputSchema`, and the profile marker.
   - The happy path for each tool.
   - Error text for each failure class.
   - A wait timeout returns `running` and starts nothing.
   - Someone else's job is not found.
   - Job versus payload versus mixed save input.
   - Crisis-gate refusal.
   - The expired-job hint.
5. **`mcpOAuth.test.mjs`** (real `OAuthProvider`, in-memory KV, and a
   `cloudflare:workers` loader stub registered with `module.register`)
   - The full flow:
     1. DCR;
     2. authorize while signed out (sign-in page);
     3. authorize while not allowlisted (refusal showing the ID);
     4. authorize while allowed (consent with CSRF);
     5. POST Allow gives a 302 carrying a code, `state` and `iss`;
     6. token exchange with PKCE S256;
     7. `/mcp` `tools/list` with the token returns 200.
   - No token or a bad token gets 401 with `WWW-Authenticate`.
   - A token whose own scope lacks `tableu` gets 403 `insufficient_scope`, and
     no tool runs. The test issues such a token with a scope-narrowing refresh,
     or by a direct KV fixture if the library won't narrow.
   - A CSRF mismatch gets 403.
   - Deny redirects only to the registered URI.
   - Removing the user from the allowlist rejects existing tokens.
   - **Client registration:**
     - a registered client is stored with no KV expiration, and still
       authorizes after a simulated 91 days;
     - a foreign redirect URI is rejected with `invalid_redirect_uri`;
     - ChatGPT callback URIs and loopback URIs are accepted;
     - the 11th registration from one IP within an hour gets 429.
   - `/api/*` routing is untouched.
6. **`readingJobPrincipal.test.mjs`**
   - The principal and snapshot reach `tarot-reading`.
   - `/mcp/snapshot` and `/mcp/cancel` need both the token and the matching
     principal.
   - **Principal jobs on the public paths.** Public `/status`, `/stream` and
     `/cancel` answer 404 for a principal job even with its correct token, and
     the job isn't cancelled.
   - App jobs behave as before on the public paths.
   - Retention is 24 h for MCP jobs and 1 h for app jobs.
   - A request routed from outside cannot carry a principal.
7. **`serverDraw.test.mjs`**
   - The extraction preserves draw behaviour: same seed and spread give the
     same cards; `allowReversals: false`; unknown and custom spreads get 400.
   - The seed is returned as a string.
8. **`reflectionLabels.test.mjs`**: labels, ordering, legacy keys, and export
   lines.
9. **Existing suites stay green**, including `journalBearerAuth`,
   `tarotReadingJobTokenHandling`, `journalEntryApi` and `journal-export`.

Runtime checks before the PR is opened:
- `npx wrangler deploy --dry-run` bundles cleanly: no Node-only imports and no
  Ajv code generation on the hot path.
- `wrangler dev`, using a config copy without the `ai` binding, gets a full
  walkthrough in MCP Inspector: DCR, consent, token, then draw, wait, save and
  reflect.
- A browser check confirms that the saved entry and its reflections render in
  the local app.

## 10. Deployment and rollout

**Branch and PR.** Branch `feat/chatgpt-mcp-journal` lives in the worktree
`C:/Users/htper/tarot-chatgpt-mcp`. The main checkout's uncommitted
`wrangler.jsonc` and `package-lock.json` are never included. The work ships as
one PR to `master`. It includes one additive D1 migration, `0030`: a nullable
column plus a partial unique index, with every existing row `NULL`. The CI
deploy applies it before the Worker ships, and it is safe to apply ahead of the
code.

**Before merge.** Each step is confirmed with the owner first.
1. Run `npx wrangler kv namespace create OAUTH_KV` and commit the resulting
   `id` to `wrangler.jsonc`. CI deploys fail without a real ID.
2. Push and open the PR. CI runs the unit tests and Playwright.

**Merge.** CI deploys through `scripts/deploy.js`. While `MCP_ALLOWED_USER_IDS`
is unset, the surface is live but nobody can link. Never run `npm run deploy`
from the main checkout.

**After deploy.**
1. While signed in to Tableu in the browser, start linking from any OAuth
   client (MCP Inspector or ChatGPT). The consent page refuses, because the
   allowlist is empty, and shows your `user_id`. Run
   `npx wrangler secret put MCP_ALLOWED_USER_IDS` with that value, then link
   again.
2. Run MCP Inspector against `https://tarot.lakefrontdev.com/mcp`. Link through
   OAuth, check `tools/list`, and confirm that `get_profile` returns your ID.
3. In ChatGPT, go to Plugins, then developer mode, then create an app with that
   URL and OAuth authentication. Link it by signing in to Tableu and approving.
   Record the `plugin_asdk_app_…` ID.
4. Update the plugin to 0.28.0 using the files in
   `docs/integrations/openai/plugin/`:
   - `SKILL.md` and `references/actions-contract.md`, updated for the live tool
     names, job-reference saves, the retry rules and the `get_profile` check;
   - a `.app.json` template;
   - a README on applying these to the 0.27.3 package.

   The reference guides are not committed; the repo is public. The finished
   zip is built locally for upload.

**Identity verification.** Three values must match: `get_profile` in ChatGPT,
the ID shown on the consent page, and the allowlist entry. After the first
save,
`npx wrangler d1 execute mystic-tarot-db --remote --command "SELECT user_id FROM journal_entries WHERE id = '<entryId>'"`
must return the same ID.

**End-to-end check from ChatGPT.**
1. Draw a three-card reading, wait, and see the narrative.
2. Say "save this" and get back an entry ID.
3. Add a card reflection and a whole-reading reflection.
4. Repeat one reflection and get `already_present`.
5. In the app, the entry shows the verbatim narrative, the cards with their
   orientations, and reflections labelled "Past · The Hermit" and "Whole
   reading" as separate paragraphs.

**Kill switch.** `npx wrangler secret delete MCP_ALLOWED_USER_IDS` stops all
linking and invalidates every existing token on the next request. For a code
rollback, revert the PR.

**Docs.**
- New `docs/integrations/openai/chatgpt-mcp.md`: architecture, tools, auth,
  runbook, verification checklist, troubleshooting.
- Pointers from `tableau-backend-chatgpt-app-integration.md` and
  `chatgpt-gpt-actions-setup.md`.
- `CLAUDE.md` updates to API endpoints, bindings, vars and secrets.

## 11. Out of scope

- Shared or public distribution: removing the allowlist, abuse and privacy
  review, public plugin submission.
- Archetype tracking for ChatGPT saves.
- Journal read, list and search tools, and cross-session recurrence.
- Follow-up conversations and memories from ChatGPT.
- Changes to the app's existing permissive `/api` CORS policy.
- Deck-specific card art in the journal. The reading screen (`Card.jsx`) shows
  catalog (RWS) art for every deck, and `getDeckImagePath` has no callers. With
  canonical identity (D11), a ChatGPT-saved Thoth or Marseille entry renders
  exactly like an app-saved one. Showing deck art only in the journal would be
  a new app-wide behaviour that diverges from the reading screen, so it is
  deferred to a follow-up by the owner (review round 1).

## 12. Risks and assumptions

- **The ~60 s tool limit** comes from the MCP SDK issue tracker and OpenAI
  community reports, not official docs. Every tool is designed to finish in at
  most 45 s either way.
- **`@cloudflare/workers-oauth-provider` is pre-1.0.** The version is pinned
  exactly, and the OAuth end-to-end test covers the flow ChatGPT uses.
- **MCP SDK on Workers.** Compatibility depends on the cfworker validator and
  the web-standard transport. The bundle check and a `wrangler dev` session
  verify it before the PR opens.
- **Consent needs a Tableu session** in the browser ChatGPT opens for OAuth. If
  there isn't one, the consent page directs the user to sign in first.
- **Spread tier gates still apply.** Relationship, decision and Celtic Cross
  need Plus, and the owner's tier governs them.
- **DCR is open to anyone within limits.** Registration accepts only ChatGPT
  callback and loopback redirect URIs, and it is rate-limited per IP. Registered
  clients can do nothing without an allowlisted user's consent. They never
  expire (D13), so KV grows by one small record per registration. That's
  bounded by the rate limit and cheap at owner-only volume. A sweep of clients
  that were never authorized can be added if it's ever needed.
- **The SQLite test harness isn't D1.** `sql.js` matches SQLite semantics
  (constraints, partial indexes). D1-specific behaviour, such as batch
  transactions and error-message wrapping, is covered by matching on the
  constraint name and by the `wrangler dev` walkthrough.
- **Reflection identity is content-derived.** Two notes with exactly the same
  text on the same target are treated as one (§7.3).

## 13. Revision history

**Review round 1 (2026-09-22).** An external review raised seven findings. Each
was checked against the code and the library source before any change.

| # | Finding | Resolution |
|---|---|---|
| 1 | A job save's lookup and insert aren't atomic; `idx_journal_request_id` is non-unique | Accepted. D9: migration `0030` adds `idempotency_key` with a partial unique index; insert first, then handle the constraint (§7.2); concurrent-save tests on real SQLite (§9) |
| 2 | Public `/status`, `/stream` and `/cancel` bypass owner checks for MCP jobs | Accepted. D10: the public paths return 404 for principal jobs; MCP uses `/mcp/snapshot` and `/mcp/cancel`, which need the token and the principal (§7.4) |
| 3 | An expired-job fallback can report the wrong reading, or duplicate a save | Accepted. Both MCP modes share `reading:<requestId>`, with a card-fingerprint identity check; a seed never selects an entry on MCP paths (§6.4, §7.2) |
| 4 | Reflection retries are idempotent only while the note is last | Accepted. Operation identity is the entry, the target and the exact text, checked against every note on the target (§7.3) |
| 5 | Card mapping drops canonical identity; deck-unaware image lookup | Identity accepted. D11: saves resolve cards with `resolveReadingCards`; payload mode requires catalog metadata (§6.2, §6.4). Deck-specific journal art deferred to a follow-up by the owner (§11) |
| 6 | Declared scopes are never enforced | Accepted. D12: `unwrapToken` scope check, with 403 `insufficient_scope` (§5.3) |
| 7 | The 90-day DCR client expiry breaks connections | Accepted. D13: clients never expire; registration is limited to ChatGPT callback and loopback redirect URIs and rate-limited (§5.1) |
