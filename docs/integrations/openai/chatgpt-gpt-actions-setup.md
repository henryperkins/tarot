# Using This Tarot Backend On A Custom GPT

Type: guide
Status: active reference
Last reviewed: 2026-04-23

This setup uses GPT Actions with your existing Worker API.

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
   Unset/false disables the feature entirely.
2. **Service account** — the request must authenticate with `GPT_SERVICE_TOKEN`
   (`auth_provider: 'service'`). API-key, session, and anonymous callers never
   receive `promptDebug`, even with the flag on.
3. **Opt-in** — the request body must set `includePromptDebug: true`.

When all three hold, the `200` response gains a `promptDebug` object containing
the **verbatim (unredacted)** `systemPrompt` and `userPrompt`, plus
`templateVersion` and the assembling `provider`. Because the system prompt holds
proprietary instructions and the user prompt can carry PII (question,
reflections, stored memories, retrieved passages), keep the flag off in any
environment where the service token is not exclusively owner-controlled.

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

2. (Optional) Choose the entitlement tier — defaults to `plus`, clamped to
   Plus-or-higher. Set `GPT_SERVICE_TIER` to `pro` in `wrangler.jsonc` to also
   unlock custom spreads and unlimited readings.

3. In GPT Builder, set the Action auth to **API Key** with **Auth Type:
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
fails — and `enforceReadingLimit` swallows that failure, which would hand the
service account unlimited unmetered readings. The row carries random, unusable
credentials and a reserved `.invalid` address, so it can never be signed into or
password-reset.

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

## Instruction pattern to reduce tool-call errors

- Example:
  - “When the user asks for a tarot reading, call `createTarotReading`.”
  - “If required fields are missing (`spreadInfo`, `cardsInfo`), ask follow-up questions before calling.”
  - “Do not fabricate card payload fields.”

## Optional: add async job-mode actions

After sync works, add the jobs routes (`/api/tarot-reading/jobs*`) as additional operations in the same OpenAPI file.
