# Using This Tarot Backend on a Custom GPT (chatgpt.com)

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
      responses:
        '200':
          description: Reading response
```

## Auth choice for this backend

- `API Key` is typically easiest if you want one shared backend key.
- For per-user identity, use `OAuth`.
- This backend already accepts `Authorization: Bearer sk_...` (see `functions/lib/auth.js`).

## Instruction pattern to reduce tool-call errors

- Example:
  - “When the user asks for a tarot reading, call `createTarotReading`.”
  - “If required fields are missing (`spreadInfo`, `cardsInfo`), ask follow-up questions before calling.”
  - “Do not fabricate card payload fields.”

## Optional: add async job-mode actions

After sync works, add the jobs routes (`/api/tarot-reading/jobs*`) as additional operations in the same OpenAPI file.
