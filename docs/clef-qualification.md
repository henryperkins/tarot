# Evaluator qualification

The production evaluator remains GLM-5.3 / GLM-5.3 Flash. The candidate tooling makes no activation decision: `qualified` is always false. Offline replay verifies control flow, not model quality. A candidate requires bounded live results, independent review of corpus labels and explicit approval before production activation.

## Contract and policy

Cloudflare's [Clef Flash documentation](https://developers.cloudflare.com/workers-ai/models/clef-flash/) specifies `state`, typed `questions`, `instructions`, ordered score `criteria`, a zero-based probability-weighted score and noul yes probability. The adapter supplies the **complete production system rubric** and the **production-built user input**, preserving sanitization, structural metrics and truncation. It asks all five score dimensions and the safety flag. Each required field is validated; score values must be finite numbers within 0–4, probabilities within 0–1, and supplied distributions must cover all five levels, sum to approximately one and match the weighted score. Optional confidence is also bounded. Missing, malformed, string or out-of-range fields are unavailable evaluations.

The adapter adds one to score expectations, then uses the existing production rounding, deterministic safety overrides and `checkEvalGate`. The default safety probability threshold is **0.5**, configurable for qualification and currently uncalibrated. `safety_flag=true`, safety below 2 or tone below 2 blocks delivery; overall alone does not. Candidate transport success does not imply passing safety. This is a gate-contract adapter; it does not produce the full production evaluator's explanatory evidence/weaknesses metadata and cannot be dropped into production without that additional work.

Reports retain model-only and final gate decisions, reason, retryability, scores, candidate safety probability, prompt truncation presence and latency. API failures, hard deadlines and invalid contracts are separate statuses. Summaries count false blocks, missed unsafe cases, model-only misses, quality-bound mismatches, successful-model disagreement and failures separately. Failures remain closed and are not counted as quality passes or ordinary false blocks. A single hard deadline and no automatic retries bound each call, including bindings that ignore abort.

## Corpus and limitations

`qualificationCorpus.js` produces 27 compact synthetic cases. Labels explicitly identify **repository policy expectations**, not independent human annotations. They cover ordinary rest/stress, safe professional referrals, medical/financial/legal/abuse directives, Spanish/French/Japanese/Arabic examples, poor grounding and invented cards, evaluator prompt injection, and long middle/end hazards. Structural metrics are synthetic controlled inputs, not independently extracted evidence. Quality score upper bounds are approximate expectations that require reviewer calibration.

The full rubric is retained, but the production input still sanitizes the reading to 20,000 characters before its 10,000-character front/tail budget. Multilingual hazards in the middle or beyond the initial cap can be absent from model input and missed by English deterministic patterns. These cases deliberately expose this limitation; a favorable aggregate must not hide them. The corpus is not representative enough to establish a calibrated false-positive/negative rate, comprehensive multilingual coverage, or a production safety guarantee.

## Offline usage

From the repository root:

```sh
node scripts/evaluation/qualifyEvaluators.js
node scripts/evaluation/qualifyEvaluators.js --dry-run --cases benign-rest,stop-medication --max-requests 4
node --import /tmp/tableu-ai-reliability-20261007/deny-network.mjs --test tests/clefQualification.test.mjs tests/qualificationCorpus.test.mjs tests/qualifyEvaluatorsCli.test.mjs
```

Default invocation only lists planned case IDs/models/budget and performs zero inference calls. Importing the runner has no executable side effects. Tests use injected fixtures; the network guard path is a session-local verification artifact, not a repository prerequisite. The exported `qualifyEvaluators` supports replay using an injected fixture AI binding; replay always reports `qualified:false` and its latency is local control-flow timing.

## Explicit live usage (not run during implementation)

Live calls require `--live`, synthetic case selection, a total request budget and environment variables `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AUTH_TOKEN`. Do not paste credentials into commands or logs. The default budget is 20; the hard cap is 40 across both models and all cases. All 27 cases would require 54 calls and are therefore rejected in one live invocation. Select bounded batches and retain their outputs for review. No retries occur.

```sh
node scripts/evaluation/qualifyEvaluators.js --live --cases benign-rest,stop-medication,unsafe-es,benign-es --max-requests 8 --timeout-ms 15000 --safety-threshold 0.5
```

Explicit live output contains synthetic case IDs, metrics and decisions, not readings, prompts or credentials. Provider failure details are suppressed. Account credentials and network access are accessed only after budget validation and only in explicit live mode. No live calls, real latency estimates or independent production qualification were performed for this change.
