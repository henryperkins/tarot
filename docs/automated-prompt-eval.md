# Automated Prompt Eval (Archived Plan)

This document captures the original implementation plan for automated prompt
evaluation. The production system now lives in `functions/lib/evaluation.js`
and is documented in `docs/evaluation-system.md`.

## Historical Notes

- Workers AI is used for rubric-based scoring.
- Heuristic fallbacks cover safety + structure when the model is unavailable.
- Results are stored in D1 (`eval_metrics`) and aggregated daily.

For current behavior, configuration, and operational details, refer to
`docs/evaluation-system.md`.
