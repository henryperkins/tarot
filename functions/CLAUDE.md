## Secrets

Via `wrangler secret put`:
- `OPENAI_API_KEY` — OpenAI native Responses API key (preferred; when set, takes priority over Azure)
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL` — Azure fallback path
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `RESEND_API_KEY` — Email delivery (auth verification/reset)
- `ADMIN_API_KEY` — Admin endpoints
- `GPT_SERVICE_TOKEN` — Bearer token for the Tableu Custom GPT / ChatGPT App; authenticates as a synthetic service user entitled at `GPT_SERVICE_TIER` (var, default `plus`). Must not use the `sk_` prefix. See `functions/lib/serviceAuth.js` and `docs/integrations/openai/`.
- `GPT_OWNER_TOKEN` — Optional, never-shared owner token. Authenticates as the same synthetic user but additionally unlocks owner-gated diagnostics (`promptDebug`). Kept separate because `GPT_SERVICE_TOKEN` lives inside a GPT that may be published, so service auth proves "trusted integration", not "owner".
