# AI reliability and release checks

The October 7 reliability changes require migrations 0033, 0034 and 0035 before
activation. They protect paid feature access, settle server narration only after
successful synthesis, return retryable safety-check outages, and preserve model
provenance. See [feature safeguards](ai-feature-safeguards.md) for operational
quota defaults and request limits.

## Provider budgets

`READING_TASK_TIMEOUT_MS` defaults to 240,000 ms and is bounded to 1,000–600,000 ms.
Each nonstreaming narrative provider gets at most 90,000 ms within that overall
budget. `TEXT_TASK_TIMEOUT_MS` defaults to 120,000 ms, bounded to 1,000–300,000 ms,
for suggested questions, follow-ups and journal summaries. The same cancellation
signal follows provider fallbacks and memory-tool continuations. OpenAI deadlines
include response bodies and retry delays; incomplete, failed or prematurely ended
Responses outputs do not count as complete answers.

Short OpenAI tasks use 4,096 output tokens, including reasoning; journal summaries
use 8,192. Prompts retain their concise answer requirements. Modal follow-ups and
repairs use 4,000 tokens. These ceilings provide reasoning headroom, not a promise
that the model will always complete within the limit.

OpenAI Responses requests explicitly set `store:false`. This disables default
response storage; it is not a claim that all provider retention is disabled.

## Attempt records

`inference_attempts` separates requested and returned model IDs, including
fallback models actually returned by a provider. It stores logical calls and
known token usage with `known`, `partial` or `unknown` status. Unknown usage remains
NULL. It does not reconstruct vendor billing or itemize SDK-internal retries.
No prompts, user identity or raw provider error bodies belong in this table.

For readings, acceptance means the provider passed the reading quality checks;
the final safety outcome is recorded separately. Short-task acceptance means the
provider completed its response. Failure to write operational provenance logs a
warning rather than preventing a delivered answer. Successful-reading metrics
remain separate from unsuccessful provider attempts.

Quality analysis groups evaluator models and score sources separately. Historical
records without provenance cannot reliably be assigned to a particular model.
Journal coach extraction records its model and skips canned fallback readings.

## Safe release QA

Importing `scripts/evaluation/runNarrativeSamples.js` now only defines its helpers;
executing its CLI is required to generate samples. Never use an import as a way
to run a benchmark. Unit tests stub inference and verify import behavior with
invalid dummy credentials.

`npm run ci:release-check` defaults to the `claude-subscription` backend. It builds
the exact `claude-api` reading request: the same prompts, `ANTHROPIC_MODEL`,
`ANTHROPIC_EFFORT`, `ANTHROPIC_TIMEOUT_MS` deadline and 32,000-token output ceiling.
It then sends that request through the release host's Claude Code subscription
login (`services/claude-code/runner.mjs`) instead of the paid API key. The samples
therefore qualify the primary provider's model and settings without per-token
charges. A sample answered by any other model fails. The server-side advisor
tool is disabled, so the request has no tools, as on the API.

Claude Code 2.1.292 still differs from the API request in ways no supported
setting removes. It prefixes the system prompt with an Agent SDK identity line.
It adds about 510 tokens of context reminders: working directory and OS, the
model name, today's date, and the logged-in account's email address. The API's
server-side refusal fallback is unavailable, so a refused sample fails the gate
rather than switching models. Claude Code also applies its own transport retries.

Release QA checks `claude auth status` before the code checks start. It accepts
only a first-party `claude.ai` subscription login; API-key logins and
`CLAUDE_CODE_OAUTH_TOKEN` are refused. Run `claude auth login` on the release host
first. Hosted runners (GitHub Actions and Workers Builds) lack that login, so
`npm run deploy` runs from the owner's host, and no workflow receives
`ANTHROPIC_API_KEY`. Paid API QA needs an explicit `NARRATIVE_EVAL_BACKEND=claude-api`
override plus the key. An explicit override can also test Modal or OpenAI, but
that result qualifies only the chosen provider. Ordinary CI checks the committed
narrative samples offline; those samples do not qualify the current provider.

Live narrative QA generates 11 synthetic samples, which count toward the
subscription's shared usage limits. Paid-provider overrides incur charges, and
retry attempts can add to them. Offline provider/route tests are not live
model-quality evidence. A vision photo gate additionally needs the independent
held-out corpus described in [vision evaluation integrity](vision-evaluation-integrity.md).
Neither a mock run nor generated card art substitutes for that corpus.

## Rollout

1. Review the branch and migration results, including existing usage/quality data.
2. Log the release host into the Claude subscription and run one recorded live narrative gate.
3. Apply migrations and deploy the reviewed version through the normal release path.
4. Verify the active Worker version, assets, login, quota behavior and retry UI.
5. Inspect logical attempt failures and safety outages before changing evaluator
   models or operational limits. Clef remains a qualification candidate.

No production setting or secret is deleted merely because it is absent from
runtime code: check build tooling and external consumers before a separate cleanup.
