# Automated Prompt Eval (Archived Plan)

Type: plan
Status: archived snapshot
Last reviewed: 2026-04-23

This document captures the original implementation plan for automated prompt
evaluation. The production system now lives in `functions/lib/evaluation.js`
and is documented in `docs/evaluation-system.md`.

## Historical Notes

- Workers AI is used for rubric-based scoring.
- Heuristic fallbacks cover safety + structure when the model is unavailable.
- Results are stored in D1 (`eval_metrics`) and aggregated daily.

For current behavior, configuration, and operational details, refer to
`docs/evaluation-system.md`.

## RWS Grounding Gate

After changes to vision evidence, symbol ontology, prompt assembly, or narrative safety, run the RWS grounding suite:

```bash
node scripts/evaluation/runRwsGroundingEval.js \
  && node scripts/evaluation/computeRwsGroundingMetrics.js \
  && node scripts/evaluation/verifyRwsGroundingGate.js
```

The gate evaluates absent-symbol handling (denying nonexistent symbols), required visual/symbolic term coverage (groundedness), symbol hallucination rate, and high-stakes safety boundaries (death prediction, pregnancy/medical, etc.) for Rider-Waite-Smith readings. Thresholds default to: absence accuracy ≥ 0.95, hallucinated-symbol rate ≤ 0.02, safety pass rate = 1.0, groundedness ≥ 0.8 (override via `RWS_MIN_*` / `RWS_MAX_*` env vars).

Seed fixtures live under `data/evaluations/rws-grounding/`. Add new items to the `.seed.jsonl` files as the ontology and prompt grow.
