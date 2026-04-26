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

### RWS Grounding Gate

Run `npm run ci:rws-grounding-check` after changes to vision evidence, symbol ontology, prompt assembly, or narrative safety. The gate evaluates absent-symbol handling, required visual/symbolic term coverage, symbol hallucination rate, and high-stakes safety boundaries for Rider-Waite-Smith readings.

For current behavior, configuration, and operational details, refer to
`docs/evaluation-system.md`.
