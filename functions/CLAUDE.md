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
- `ANTHROPIC_API_KEY` — Claude Messages API key. When set, Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`) is the first provider for readings, follow-up answers, suggested questions and journal summaries; `TEXT_PROVIDER=claude-code` still overrides it.
- `VISION_PROOF_SECRET`
- `EMAIL` `send_email` binding (Cloudflare Email Service) — email delivery for auth, billing and alerts, sent from `ALERT_EMAIL_FROM`; `RESEND_API_KEY` is only a fallback when the binding is absent
- `ADMIN_API_KEY` — Admin endpoints
- `GPT_SERVICE_TOKEN` — Bearer token for the Tableu Custom GPT / ChatGPT App; authenticates as a synthetic service user entitled at `GPT_SERVICE_TIER` (var, default `plus`). Must not use the `sk_` prefix. See `functions/lib/serviceAuth.js` and `docs/integrations/openai/`.
- `GPT_OWNER_TOKEN` — Optional, never-shared owner token. Authenticates as the same synthetic user but additionally unlocks owner-gated diagnostics (`promptDebug`). Kept separate because `GPT_SERVICE_TOKEN` lives inside a GPT that may be published, so service auth proves "trusted integration", not "owner".
- `MCP_ALLOWED_USER_IDS` — Comma-separated Tableu user ids allowed to link ChatGPT;
  unset denies linking and existing-token access (kill switch). The var
  `MCP_RESOURCE_URL` pins the exact OAuth resource.
- `MODAL_PROXY_TOKEN_ID` and `MODAL_PROXY_TOKEN_SECRET` — Modal proxy authentication; the adapter joins them with a dot for the Bearer value. Set both together. An incomplete or empty declared pair fails closed; legacy `MODAL_PROXY_TOKEN` is accepted only when both pair fields are absent.
- `READING_JOB_PURGE_TOKEN` — Unset except while running
  `scripts/purge-expired-reading-jobs.mjs`; it enables
  `POST /api/admin/reading-jobs/retention` (see `docs/integrations/openai/chatgpt-mcp.md`).

The Modal provider uses `Qwen/Qwen3.8-Max-VL-Thinking` at the configured `/v1`
endpoint, high reasoning effort, upstream streaming, temperature `0.3`, and
top-p `0.95`. Full readings omit `max_tokens`; explicit per-call `maxTokens`
is the only supported cap. A legacy `MODAL_MAX_TOKENS` env value is ignored.
Upstream streaming is buffered into the provider result before returning it.
Keep non-secret defaults in `wrangler.jsonc` and credential values out of logs.
The narrative evaluator reads exported shell credentials and Wrangler vars,
not `.dev.vars`; that file supplies local Worker development and `config:check`.

OAuth storage uses the dedicated `tableau-oauth` namespace bound as `OAUTH_KV`.
Confirm authorization for resource or release changes; approval already granted
for a rollout applies across its named steps.
