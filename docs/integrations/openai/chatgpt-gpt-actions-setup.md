# Using This Tarot Backend On A Custom GPT

Type: guide
Status: active reference
Last reviewed: 2026-09-13

This setup uses GPT Actions with your existing Worker API.

Companion file: upload `gpt-knowledge-base.md` (same directory) to the GPT's
Knowledge section — it teaches the GPT how to use the app (spreads, question
crafting, Action usage) and how to interpret cards (position-first method,
reversal frameworks, patterns, 78-card reference, ethics).

## Official OpenAI GPT Actions docs

- Getting started: https://developers.openai.com/api/docs/actions/getting-started
- Authentication: https://developers.openai.com/api/docs/actions/authentication
- Introduction: https://developers.openai.com/api/docs/actions/introduction
- Production notes: https://developers.openai.com/api/docs/actions/production
- Actions library/examples: https://developers.openai.com/api/docs/actions/actions-library

## Backend route mapping in this repo

- Synchronous reading endpoint: `POST /api/tarot-reading`
  - Route mapping: `src/worker/index.js` (`/api/tarot-reading`)
  - Handler: `functions/api/tarot-reading.js`
- Async jobs endpoints:
  - `POST /api/tarot-reading/jobs`
  - `GET /api/tarot-reading/jobs/{id}`
  - `GET /api/tarot-reading/jobs/{id}/stream`
  - `POST /api/tarot-reading/jobs/{id}/cancel`
  - Route mapping: `src/worker/index.js`
- Journal write endpoints (see "Journal write Actions" below):
  - `POST /api/journal` — handler `functions/api/journal.js`
  - `POST /api/journal/{id}/reflections` — handler `functions/api/journal/reflections.js`
  - Route mapping: `src/worker/index.js`

## Quick start (recommended first: sync endpoint)

1. Deploy your backend to a public HTTPS domain.
2. Create/import an OpenAPI 3.1 schema in GPT Builder under **Configure -> Actions**.
3. Add authentication in the Action settings (`None`, `API Key`, or `OAuth` per OpenAI docs).
4. Add GPT instructions that explicitly reference your Action operation name and required JSON fields.
5. Test in the GPT Action test panel, then iterate on schema/parameter descriptions.

## Minimal OpenAPI starter (`POST /api/tarot-reading`)

Expected request contract is defined in `shared/contracts/readingSchema.js`.

```yaml
openapi: 3.1.0
info:
  title: Tarot Reading API
  version: 1.0.0
servers:
  - url: https://YOUR_DOMAIN
paths:
  /api/tarot-reading:
    post:
      operationId: createTarotReading
      summary: Generate a personalized tarot reading
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [spreadInfo, cardsInfo]
              properties:
                spreadInfo:
                  type: object
                  required: [name]
                  properties:
                    name: { type: string }
                    key: { type: string }
                cardsInfo:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required: [position, card, orientation, meaning]
                    properties:
                      position: { type: string }
                      card: { type: string }
                      orientation: { type: string, enum: [Upright, Reversed] }
                      meaning: { type: string }
                userQuestion: { type: string }
                reflectionsText: { type: string }
                includePromptDebug:
                  type: boolean
                  default: false
                  description: >
                    Diagnostic opt-in. When true AND the request is
                    authenticated as the first-party service account AND the
                    backend has PROMPT_DEBUG_ENABLED set, the response includes a
                    promptDebug object with the assembled system/user prompt.
                    Ignored (silently) for any other caller.
      responses:
        '200':
          description: Reading response
          content:
            application/json:
              schema:
                type: object
                required: [reading]
                properties:
                  reading:
                    type: string
                    description: Generated tarot-reading narrative.
                  provider:
                    type: string
                    description: Narrative provider used (e.g. openai-native, azure-gpt5, local-composer).
                  requestId:
                    type: string
                    description: Unique request identifier.
                  promptDebug:
                    type: object
                    description: >
                      Present only for authorized diagnostic requests (service
                      account + PROMPT_DEBUG_ENABLED + includePromptDebug=true).
                      Omitted otherwise, and absent when the local composer
                      served the reading (it uses no LLM prompt).
                    properties:
                      templateVersion:
                        type: string
                        description: Reading prompt template version (READING_PROMPT_VERSION).
                      provider:
                        type: string
                        description: Backend that assembled the prompt.
                      systemPrompt:
                        type: string
                        description: Verbatim system prompt sent to the narrative model.
                      userPrompt:
                        type: string
                        description: Verbatim user prompt assembled from cards and context.
```

## Optional: prompt debug (`promptDebug`)

For first-party diagnostics, the backend can return the exact prompt it
assembled from the cards so the GPT can inspect it. This is **off by default**
and gated three ways — all required:

1. **Env flag** — set `PROMPT_DEBUG_ENABLED=true` (var in `wrangler.jsonc`).
   Unset/false disables the feature entirely. Defaults to `false`.
2. **Owner token** — the request must authenticate with `GPT_OWNER_TOKEN`, a
   *separate* secret from `GPT_SERVICE_TOKEN`. Ordinary service-account callers,
   API-key, session, and anonymous callers never receive `promptDebug`, even
   with the flag on. When `GPT_OWNER_TOKEN` is unset nobody is an owner, so the
   channel stays closed.
3. **Opt-in** — the request body must set `includePromptDebug: true`.

> **Why the owner token is separate.** `GPT_SERVICE_TOKEN` is embedded in a
> Custom GPT. If that GPT is published, every one of its users can instruct it
> to call this Action with `includePromptDebug: true` and read the system prompt
> back. Service authentication proves "a trusted integration", never "the
> owner" — so the two capabilities need two credentials. Put the owner token
> only in a private GPT (or call the API directly with `curl`).

When all three hold, the `200` response gains a `promptDebug` object containing
the **verbatim (unredacted)** `systemPrompt` and `userPrompt`, plus
`templateVersion`, the assembling `provider`, and a `truncated` flag. Each
prompt is capped at 15,000 characters so the response stays under the
100,000-character ceiling GPT Actions enforces; `truncated: true` means text was
elided (marked inline).

`promptDebug` is omitted when the reading is served by the local composer, which
generates deterministically without an LLM prompt.

Example diagnostic request:

```json
{
  "spreadInfo": { "name": "Three Card" },
  "cardsInfo": [
    {
      "position": "Past",
      "card": "The Fool",
      "orientation": "Upright",
      "meaning": "New beginnings and openness"
    }
  ],
  "includePromptDebug": true
}
```

## Auth choice for this backend

- `API Key` is typically easiest if you want one shared backend key.
- For per-user identity, use `OAuth`.
- This backend already accepts `Authorization: Bearer sk_...` (see `functions/lib/auth.js`).

### Service token (recommended for the owner's own GPT)

Per-user `sk_...` API keys are **Pro-only** and must belong to a Stripe-backed
account, so they can't be minted for a GPT that just needs Plus-level access
(e.g. the Celtic Cross spread requires Plus). For a trusted first-party
integration, configure a **service token** instead:

1. Generate a long random secret and set it:

   ```bash
   openssl rand -hex 32 | wrangler secret put GPT_SERVICE_TOKEN
   ```

   The token must **not** begin with `sk_` — that prefix is the per-user API-key
   namespace, and such a token is routed to key validation and never matched as
   a service token. A misconfigured `sk_` value is rejected at startup with a
   warning rather than silently failing every request.

2. (Optional) Choose the entitlement tier — defaults to `plus`, clamped to
   Plus-or-higher. Set `GPT_SERVICE_TIER` to `pro` in `wrangler.jsonc` to also
   unlock custom spreads and unlimited readings.

3. (Optional) For owner-gated diagnostics, mint a second, never-shared token:

   ```bash
   openssl rand -hex 32 | wrangler secret put GPT_OWNER_TOKEN
   ```

   It authenticates as the same synthetic user but additionally unlocks
   `promptDebug`. Use it only from a private GPT or direct API calls.

4. In GPT Builder, set the Action auth to **API Key** with **Auth Type:
   `Bearer`**, and paste the same token value.

Any request presenting `Authorization: Bearer <GPT_SERVICE_TOKEN>` then
authenticates as a synthetic service user entitled at that tier
(`auth_provider: 'service'`). It does **not** require a Stripe subscription and
is not subject to the Pro-only, metered API-key limiter. When
`GPT_SERVICE_TOKEN` is unset, auth behaves exactly as before.

On first authenticated request the service account is provisioned a real row in
`users` (id `service:gpt` by default). This is required, not cosmetic: per-user
tables declare `FOREIGN KEY (user_id) REFERENCES users(id)` and D1 enforces
foreign keys by default, so without the row every metering and journal write
fails. The row carries random, unusable credentials and a reserved `.invalid`
address, so it can never be signed into or password-reset. (Registration also
refuses `.invalid` addresses, so the derived address cannot be squatted.)

Provisioning is verified, and **authentication fails closed if it cannot be**:

- If `GPT_SERVICE_USER_ID` names a row that is not a service account, the
  request is rejected. Otherwise a misconfigured id pointing at a real person
  would let the shared token act *as that person* — reading their memories and
  reaching their media.
- If the row cannot be created or read back at all (unique collision, D1 error),
  the request is rejected rather than served unmetered.
- If usage tracking then fails for a machine credential, the request is denied.
  Interactive users still fail open, since a transient D1 blip should not block
  a reading someone is waiting on.

Notes:

- Use a long, random token. Values shorter than 24 chars are ignored.
- Reading quota follows the tier: `plus` = 50 readings/mo (tracked under a
  single service-account id), `pro` = unlimited. Override the id with
  `GPT_SERVICE_USER_ID` if you want separate metering.
- The token is a **machine credential**: account and billing endpoints
  (profile, password, delete, Stripe checkout/portal, subscription restore)
  reject it with `401 Session authentication required`, same as an API key.
- `GPT_SERVICE_EMAIL` is a label for logs only. The backing row's address is
  always derived from the id so a misconfigured value can't collide with a real
  account and block provisioning.
- Rotate by putting a new secret; the old token stops working immediately.
  Rotation does not change the `users` row, so usage history carries over.
- Implementation: `functions/lib/serviceAuth.js`, wired in `functions/lib/auth.js`.

## Journal write Actions (`tarot-journal-actions.yaml`)

`tarot-journal-actions.yaml` (repo root, next to `tarot-reading-openapi.yaml`)
is a second Action schema that lets the GPT persist what it read:

| Operation | Route | Handler |
|---|---|---|
| `saveJournalEntry` | `POST /api/journal` | `functions/api/journal.js` |
| `addJournalReflection` | `POST /api/journal/{id}/reflections` | `functions/api/journal/reflections.js` |

The journal routes (`/api/journal`, `/api/journal/{id}`, and the reflections
route) authenticate through `getUserFromRequest`, so the service token works
there, as do `sk_` API keys and bearer session tokens. The app's own cookie
session is unaffected. The service account is minted at Plus, which clears the
journal's `isEntitled(user, 'plus')` gate, and its backing `users` row is what
lets the `journal_entries` foreign key succeed.

### Install

1. In GPT Builder, **Configure → Actions → Create new action** a second time
   and paste the file. It is a separate Action because each Action carries a
   single auth configuration.
2. Set auth to **API Key**, **Auth Type: `Bearer`**, with the same
   `GPT_SERVICE_TOKEN` value as the reading Action.
3. If the GPT is owner-only, you can instead merge the journal `paths` and
   `components.schemas` into `tarot-reading-openapi.yaml` and drop the
   duplicated `ErrorResponse` and `bearerAuth`.

### Contract rules the schema encodes

- Cards use the journal shape: `name`, not `card`.
  `functions/api/archetype-journey.js` reads `card.name` with no fallback, so
  `cardsInfo` forwarded verbatim from a reading would be searchable but
  invisible to archetype tracking.
- `spreadKey` must be one of `single`, `threeCard`, `fiveCard`, `decision`,
  `relationship`, `celtic`. It is stored verbatim and groups history.
- `context` is the reading taxonomy (`love`, `career`, `self`, `spiritual`,
  `wellbeing`, `decision`, `general`); anything else is stored as no context
  (`functions/lib/journalContext.js`).
- Reflections are a flat string map in `reflections_json`, keyed by card index
  (`"0"`, `"1"`, …) or `Overall` for the reading as a whole. That is the only
  shape the journal UI, the export, and follow-up context read. The
  reflections route takes `card` and/or `position`, resolves them to the
  index server-side, and rejects a card that is not in the entry (listing the
  entry's cards so the GPT can correct itself in one retry). It appends to an
  existing note by default; `mode: replace` overwrites.
- Repeating a save with the same `sessionSeed` returns the existing entry with
  `deduplicated: true` instead of writing a second row.

### Caveats

- **One journal per token.** Every write through `GPT_SERVICE_TOKEN` lands in
  the single synthetic service account (`service:gpt` by default). That is
  fine for the owner's private GPT. In a published GPT it means every user
  shares one journal, and any read-back operation would return other people's
  entries. Do not expose these operations from a published GPT without
  per-user OAuth (a separate Action with its own auth config). Gating journal
  writes on `is_owner` (the `GPT_OWNER_TOKEN` path) is the one-line option for
  a private-only version.
- **Archetype tracking is not updated by the save.** The app records
  `card_appearances` from the client after saving (`src/hooks/useJournal.js`
  posts to `/api/archetype-journey/track`); `POST /api/journal` alone does
  not. Run `POST /api/archetype-journey-backfill` to rebuild recurrence data
  from journal entries, or move tracking into the save path before building
  any pattern-query Action on top of it.

### Verify locally

Put `GPT_SERVICE_TOKEN=<long random value>` in `.dev.vars`, apply migrations
to the local database (`npx wrangler d1 migrations apply mystic-tarot-db --local`),
then:

```bash
npx wrangler dev --config wrangler.jsonc --port 8788
```

```bash
# save
curl -sS -X POST http://localhost:8788/api/journal \
  -H "Authorization: Bearer $GPT_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spread":"Three-Card Story (Past · Present · Future)","spreadKey":"threeCard",
       "cards":[{"position":"Past","name":"The Hermit","orientation":"Upright","number":9}],
       "personalReading":"...","sessionSeed":"test-seed-1"}'

# reflect (use the returned entry.id)
curl -sS -X POST http://localhost:8788/api/journal/ENTRY_ID/reflections \
  -H "Authorization: Bearer $GPT_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"six months alone","scope":"card","card":"The Hermit","position":"Past"}'
```

Repeat the save with the same `sessionSeed` and expect `200` with
`deduplicated: true`. Then `GET /api/journal/ENTRY_ID` with the same bearer
token and confirm `reflections` is `{"0":"six months alone"}`, the shape the
journal UI renders.

## Instruction pattern to reduce tool-call errors

Full recommended instruction text: `gpt-instructions.md` (same directory) —
paste it into GPT Builder → Configure → Instructions. Key rules it encodes:

- “When the user asks for a tarot reading, call `createTarotReading`.”
- “If required fields are missing (`spreadInfo`, `cardsInfo`), ask follow-up questions before calling.”
- “Do not fabricate card payload fields.”
- Always send the canonical spread `key` (`single`, `threeCard`, `fiveCard`,
  `decision`, `relationship`, `celtic`) — name-only requests can 400 when the
  display name isn't in the backend alias map (e.g. "Three Card Spread").

## Optional: add async job-mode actions

After sync works, add the jobs routes (`/api/tarot-reading/jobs*`) as additional operations in the same OpenAPI file.
