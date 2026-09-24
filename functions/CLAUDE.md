# Worker guidance

Route from `src/worker/index.js` into thin `functions/api/` handlers; keep shared
service logic in `functions/lib/`. Pure cross-runtime contracts belong in `shared/`.
Preserve ownership, entitlement checks, request cancellation, and `waitUntil()` work.
Apply required D1 migrations before releasing code that uses new columns.

## Journal integration

Worker OAuth/MCP replaces the standalone adapter. Keep
`docs/integrations/openai/chatgpt-mcp.md` authoritative for linking and release
steps. CI uses Node 24 and root tests cover Worker MCP.

- OAuth binds `tableu` scope and the exact `MCP_RESOURCE_URL`; an unset owner
  allowlist denies linking. Check the allowlist and active user on every request.
- Personal HTTP journal saves keep seed deduplication; MCP saves use the reading
  request identity. Preserve atomic SQL admission and compare-and-swap writes.
- HTTP reflections retain append/replace, repeated append, and `entry.id`; MCP
  reflections are append-only with exact retry deduplication. Select policy only
  in the trusted caller, never from request JSON. Preserve raw text in both.
- Keep canonical card identity for images and deck-specific display labels.
  Reusable Thoth labels must resolve to the same card when a tool call is retried.
- Personal journal routes reject `GPT_SERVICE_TOKEN` and `GPT_OWNER_TOKEN` with
  403 `service_account_journal_forbidden`.

## Secrets

Use `.dev.vars` locally and `wrangler secret put <NAME> --config wrangler.jsonc`
for separately authorized remote configuration. Never log values or user data.
- `OPENAI_API_KEY` — OpenAI native Responses API key; provider selection follows the configured backend.
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL` — Azure fallback path
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `RESEND_API_KEY` — Email delivery (auth verification/reset)
- `ADMIN_API_KEY` — Admin endpoints
- `GPT_SERVICE_TOKEN` — Bearer token for the Tableu Custom GPT / ChatGPT App; authenticates as a synthetic service user entitled at `GPT_SERVICE_TIER` (var, default `plus`). Must not use the `sk_` prefix. See `functions/lib/serviceAuth.js` and `docs/integrations/openai/`.
- `GPT_OWNER_TOKEN` — Optional, never-shared owner token. Authenticates as the same synthetic user but additionally unlocks owner-gated diagnostics (`promptDebug`). Kept separate because `GPT_SERVICE_TOKEN` lives inside a GPT that may be published, so service auth proves "trusted integration", not "owner".
- `MCP_ALLOWED_USER_IDS` — Comma-separated Tableu user ids allowed to link ChatGPT;
  unset denies linking and existing-token access (kill switch). The var
  `MCP_RESOURCE_URL` pins the exact OAuth resource.
- `MODAL_PROXY_TOKEN` — Authentication for the configured Modal narrative provider.

OAuth storage uses the dedicated `tableau-oauth` namespace bound as `OAUTH_KV`.
Confirm authorization for resource or release changes; approval already granted
for a rollout applies across its named steps.
