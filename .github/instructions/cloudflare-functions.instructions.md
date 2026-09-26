---
applyTo: "functions/**/*.js"
---

# Cloudflare Worker Route Guidelines

## Environment
- Functions run in Cloudflare Workers (not Node.js)
- Use ESM syntax (`import`/`export`)
- Access environment via `env` parameter, not `process.env`

## Security
- Never log API keys, secrets, or PII
- Validate all input using `validatePayload()` pattern
- Rate limit sensitive endpoints using Cloudflare KV

## API Endpoints
- The tarot-reading endpoint returns `{ reading, provider, themes, context, spreadAnalysis }`; other handlers keep their own contract-specific response shapes.
- Include proper CORS headers when needed
- Handle errors gracefully with informative (but not revealing) messages

## Tarot Reading Pipeline
- Use `performSpreadAnalysis()` as the canonical analyzer
- Narrative generation order: `modal-qwen` → `azure-gpt5` (native OpenAI or Azure Responses) → `claude-opus45` → `local-composer`
- Never invent cards or add cards not in `cardsInfo[]`
- Follow ethics guidelines from `CLAUDE.md`: no absolute predictions, no medical/legal/financial advice

## Knowledge Graph
- Pattern detection via `detectAllPatterns()` and `getPriorityPatternNarratives()`
- Limit patterns to high-value ones (triads, Fool's Journey, dyads)
- Update tests when extending patterns or spread analysis

## TTS Endpoint
- Preserve health response shape: `{ status, provider, timestamp }`
- Azure GPT-4o-mini TTS is primary; local WAV tone is fallback
