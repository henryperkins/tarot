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

`npm run ci:release-check` and `npm run ci:narrative-check` generate through the
owner's Claude subscription, defaulting to Opus 5.5 at `xhigh`. Local runs use the
existing Claude Code login automatically. Hosted runners require the private
subscription gateway described in [subscription setup](claude-subscription.md#run-narrative-evals).
No paid API key is required or used by these gates. The deployment step runs
fresh subscription QA before any remote migration or rollout.
Ordinary CI checks saved narrative samples offline; those samples do not qualify
the current provider. This keeps each deployment to one fresh narrative batch,
and GitHub preserves its evidence even if the deployment fails.
Missing subscription access fails release QA. Paid backend overrides are rejected;
there is no paid API or local-composer fallback for qualification.

Live narrative QA generates synthetic samples and consumes the owner's subscription
allowance. Offline provider/route tests are not live model-quality evidence.
A vision photo gate additionally needs the independent
held-out corpus described in [vision evaluation integrity](vision-evaluation-integrity.md).
Neither a mock run nor generated card art substitutes for that corpus.

## Rollout

1. Review the branch and migration results, including existing usage/quality data.
2. Verify the subscription login or private build gateway and run one recorded live narrative gate.
3. Apply migrations and deploy the reviewed version through the normal release path.
4. Verify the active Worker version, assets, login, quota behavior and retry UI.
5. Inspect logical attempt failures and safety outages before changing evaluator
   models or operational limits. Clef remains a qualification candidate.

No production setting or secret is deleted merely because it is absent from
runtime code: check build tooling and external consumers before a separate cleanup.
