# ChatGPT MCP: readings, journal saves, and reflections (owner-only)

Type: design spec
Status: approved design, pending implementation plan
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
| D5 | Saves rebuild the entry from the completed job's snapshot. The contract payload remains as a fallback. | The narrative and cards never pass through the model, so they can't drift. Saves become idempotent by `requestId`. |
| D6 | Draws run as jobs: the server draws, starts a job, and returns the cards immediately. | Respects the ~60 s tool limit and keeps the existing job workflow. |
| D7 | `mcp/tableau-adapter/` is retired. Its four tools move into the Worker unchanged in name. | Avoids two diverging tool definitions and a static-key auth model the docs discourage. |
| D8 | Client registration uses DCR only. CIMD is disabled. | The library's CIMD support needs the Worker-wide `global_fetch_strictly_public` compatibility flag, which would change `fetch` behaviour for the whole app. The docs still support DCR. |

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
  allowlist check → loadActiveUserById → McpServer(tools bound to user)
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
| `resourceMetadata` | `{ resource: env.MCP_RESOURCE_URL, scopes_supported: ["tableu"], resource_name: "Tableu" }` |

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

The library validates the token (existence, expiry, audience). The MCP handler
then does four things:
1. Rejects `ctx.props.userId` values that aren't in `MCP_ALLOWED_USER_IDS`.
   Removing an ID kills every existing token immediately.
2. Loads the user with `loadActiveUserById`. The account must exist and have
   `is_active = 1`. Failures in steps 1 or 2 return 401 with
   `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="…"`.
3. Builds an `McpServer` with the tools bound to that user and object. It uses
   `jsonSchemaValidator: new CfWorkerJsonSchemaValidator()`, because Ajv's
   runtime code generation is disallowed on Workers.
4. Serves the request through `WebStandardStreamableHTTPServerTransport` with
   `sessionIdGenerator: undefined` and `enableJsonResponse: true`. This is
   stateless, so no sessions live in isolate memory. GET and DELETE return 405.

Tool-level auth failures, such as a user deactivated mid-session, return
`isError` results carrying `_meta["mcp/www_authenticate"]`, as the docs
require.

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
- `securitySchemes: [{ type: "oauth2", scopes: ["tableu"] }]`, mirrored in
  `_meta.securitySchemes`;
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

The job consumes one reading from the owner's normal quota when it runs.

### 6.2 `start_tarot_reading`

Input follows the audited `CreateTarotReadingRequest` minus the same three
fields:
- `spreadInfo: { name, key? }`;
- `cardsInfo` (1–78 items), each
  `{ position, card, orientation, meaning, number?, suit?, rank?, rankValue? }`;
- the optional fields from §6.1, except `allowReversals` and `seed`.

`orientation` accepts `upright | reversed | Upright | Reversed` and is normalized
to the capitalized form the reading schema requires. The snapshot has no seed.

### 6.3 Compact status

```ts
{
  jobId, status: "running" | "complete" | "error",
  spreadInfo, cardsInfo, seed?,          // from the job snapshot (ground truth)
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

   Cards, per the contract's `JournalCard` rules:
   - keep `position`;
   - `card` becomes `name`;
   - orientation becomes `Upright` or `Reversed`;
   - keep `number`, `suit`, `rank` and `rankValue` only when present;
   - drop `meaning` and everything else;
   - keep the order.

   The reading response's context object is never copied.
4. Call `saveJournalEntry` in job mode (§7.2).

**Payload mode (fallback when the job has expired).** Input is the audited
`SaveReadingRequest`:
- `spread`, `spreadKey` (enum), `cards` (`JournalCard[]`, at least one), and
  `personalReading` (non-empty; the contract marks it optional, but omitting it
  loses the narrative);
- optionally `question`, `themes`, `context`, `provider`, `sessionSeed`,
  `requestId`, `deckId` and `userPreferences`.

It is validated strictly and saved with the contract's semantics (§7.2).

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

**App path and payload mode** keep the contract's behaviour.
- A save with `sessionSeed` looks up `(user_id, session_seed)`. On a hit it
  returns 200 with `deduplicated: true` and the existing entry, which is left
  unchanged.
- A save without a seed always inserts.

**Job mode.** The reading's `requestId` identifies it.
1. `SELECT … WHERE user_id = ? AND request_id = ?`. On a hit, return
   `already_saved`.
2. If the snapshot has a seed and a *different* entry already holds it (for
   example, a reused seed phrase), insert with `session_seed = NULL` and return
   `seedShared: true`. That keeps the new reading and doesn't silently merge it
   into the old one. Retries still dedupe through step 1.
3. Otherwise, insert with the seed.

**All paths.**
- *Unique-index race.* If the insert fails on
  `idx_journal_user_session_seed_unique`, re-select by the dedup key and return
  the deduplicated response instead of a 500.
- *Verify after error.* If the insert fails for any other reason and a key
  exists (`request_id` in job mode, or `session_seed`), re-check before
  answering. The answer is then "saved" if the row landed, or a definite "not
  saved".
- Coach extraction is still scheduled for new entries that have a narrative.

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
- Retries are idempotent. If the target's stored note already equals the text,
  or ends with `"\n\n" + text`, nothing is written and `alreadyPresent: true` is
  returned.
- A single target holds at most 20,000 characters. An append that would exceed
  that gets 400 "This reflection is full".
- Writes use compare-and-swap:
  `UPDATE … SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND reflections_json IS ?`,
  where the last value is the JSON that was read. If no row changes, re-read and
  retry, up to 3 attempts, then return a 409 "Please retry".
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
- **New internal `/snapshot` path.** It is token-gated and returns
  `{ jobId, status, principalUserId, snapshot, result, error, meta: { themes } }`
  for the MCP tools. The public `/status`, `/stream` and `/cancel` routes are
  unchanged.
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
| User deactivated or removed from the allowlist | Refused before any tool runs: HTTP 401 with `WWW-Authenticate` (§5.3), which prompts ChatGPT to re-link. An auth failure that surfaces inside a tool call carries `_meta["mcp/www_authenticate"]`. |
| Job expired (410) in a job-mode save | "Not saved: this reading's job has expired" plus a payload-mode hint |
| Crisis safety-gate job | "Not saved: this response was a safety message, not a reading" |
| Unexpected internal error on a write | Verify after error (§7.2). If it still can't be decided: "Could not confirm … check the Tableu app" |

**Retry guidance in tool descriptions.**
- A job-mode save or a reflection may be retried once after an unclear failure.
  Both are idempotent.
- A payload-mode save without a seed must not be retried. Check the app.

**Logging.** Log the tool name, outcome, `requestId`, job ID, entry ID and
duration. Never log tokens, narratives, reflection text or questions.

## 9. Testing

All tests use `node --test`, live in `tests/*.test.mjs`, and run in CI on Node
20. D1 is mocked with the existing hand-rolled doubles. Unique-violation and
compare-and-swap behaviour are simulated explicitly.

1. **`journalEntriesService.test.mjs`**
   - A new save returns 201.
   - A seeded duplicate returns 200 `deduplicated`.
   - A unique-violation race resolves to dedup.
   - Verify-after-error gives both "saved" and "not saved".
   - Job-mode `requestId` idempotency.
   - Seed shared by a different reading gives a `NULL` seed and `seedShared`.
   - The service account gets 403 on every journal route.
   - The narrative is stored byte for byte: Unicode, CRLF and leading or
     trailing whitespace in the body, a 20k-character text.
2. **`journalReflections.test.mjs`** (updated) and
   **`journalReflectionsService.test.mjs`**
   - Text lengths 1, 2,000, 2,001 and empty.
   - `mode` gets 400.
   - A wrong user and a missing entry give identical 404s.
   - The response carries `entryId` and `key`.
   - The append separator.
   - An idempotent retry.
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
   - Orientation normalization.
   - `meaning` is dropped.
   - Optional metadata is kept only when present.
   - `context` comes from input only.
   - The reading context object never leaks.
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
   - A CSRF mismatch gets 403.
   - Deny redirects only to the registered URI.
   - Removing the user from the allowlist rejects existing tokens.
   - `/api/*` routing is untouched.
6. **`readingJobPrincipal.test.mjs`**
   - The principal and snapshot reach `tarot-reading`.
   - `/snapshot` is token-gated.
   - The public `/status` shape is unchanged.
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
one PR to `master`. No D1 migration is needed; `journal_entries.request_id`
already exists.

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
- **DCR is open to anyone.** Registered clients can do nothing without an
  allowlisted user's consent, and they expire after 90 days (library default).
