# Inference and evaluator provenance

Apply migration 0035 before activating the inference ledger and coach provenance.
The migration preserves quality aggregate row IDs and values while replacing the
old inline uniqueness constraint. Its new partial unique index protects rows with
evaluator model/source dimensions; historical rows without those dimensions stay
intact. SQLite migration tests cover historical nullable duplicates as well as
new evaluator groups.

`inference_attempts` records each logical provider call, including calls rejected
by reading quality checks and calls that fail before any answer can be delivered.
Requested and returned models are separate. It records provider-reported input,
output, cache and reasoning counts when available. Unknown counts are NULL, while
reported zero remains zero; `usage_status` distinguishes known, partial and unknown
usage. No price is inferred, and no prompt, user identity or raw error is stored.

These are operational records, not a billing ledger. SDK retries inside one logical
call are not itemized. A provider can incur charges without returning usage, and
storage failure can lose an attempt record; recording failures emit a generic
warning and preserve request behavior. Entries have no automatic retention policy.
Operators should size and retain this data according to their existing policies.

A reading attempt is accepted after deterministic reading quality checks. Final
safety delivery is tracked separately in reading metrics. For short text tasks,
evaluation and coach tasks, accepted means the provider completed its response;
downstream validation can still reject or sanitize that output. Provider HTTP
failures retain unknown spend instead of claiming zero.

Quality aggregate keys and rolling baselines include evaluator model, evaluator
source and evaluation prompt version. The admin summary lists evaluator slices;
it leaves the pooled score empty when multiple evaluators, heuristic scores or
unknown historical provenance would otherwise be blended. Historical scores
cannot be assigned reliably to an evaluator after the fact.

Coach extraction and embeddings save their returned model when supplied. Workers
AI bindings without a returned model use the configured model as provenance;
this identifies the requested binding, not an independently verified deployment.
The attempt ledger still leaves its actual model NULL in that case. Canned
`safe-fallback`, `safety-gate`, `heuristic` and `local-fallback` journal readings
skip coach extraction both on save and in backfill. The English local composer
continues to support extraction because its reading contains generated actions.

See [AI reliability](ai-reliability.md) and [feature safeguards](ai-feature-safeguards.md).
