# Evaluation Pipeline Remediation Plan

- Date: 2026-01-25
- Status: Phase 1 implemented; awaiting review
- Schema: v2 (additive fields only)

**Goal:** Harden the evaluation pipeline with deterministic safety enforcement, unified gate thresholds, and improved observability to keep safety decisions consistent and auditable.

| Decision | Rationale | Notes |
| --- | --- | --- |
| Deterministic safety enforcement | Regex backup if AI misses | Corpus baseline clean (0 safety hits) |
| Unify on gate thresholds | Remove 3 conflicting sources | Gate thresholds are operational truth |
| Keep schema v2 | Additive fields, backward compatible | User preference |
| Low false positive tolerance | Safety-critical, prefer over-flag | User preference |

## Phases

- **Phase 1: Safety Hardening** *(implemented, under review)*
  - [x] Complete EVAL prompt safety criteria (self-harm, abuse/coercion, legal advice to avoid reporting, threats) — `functions/lib/evaluation.js`
  - [x] Add deterministic safety enforcement, feature flag `DETERMINISTIC_SAFETY_ENABLED` — `functions/lib/evaluation.js`
  - [x] Tests for deterministic safety — `tests/evaluation.test.mjs`

- **Phase 2: Observability Enhancements** *(pending)*
  - [ ] Add eval_source to telemetry
  - [ ] Add thresholds_snapshot to telemetry
  - [ ] Add heuristic_triggers and deterministic_overrides arrays
  - [ ] Structure block_reasons as array (keep reason for compat)
  - [ ] Persist prompt truncation events

- **Phase 3: Consistency Fixes** *(pending)*
  - [ ] Unify coverage thresholds (prompt + heuristic use gate thresholds)
  - [ ] Align heuristic rules with AI eval rules; document SCORING_RULES
  - [ ] Update tests for unified thresholds

- **Phase 4: Spread-Specific Improvements** *(pending)*
  - [ ] Expand hints for celtic, relationship, decision spreads

## Notes

- Corpus baseline: 50 readings; 0 safety pattern matches; >90% coverage; 0 hallucinations; low false positive risk.
- Duplicates: 3 pairs (lines 21-22, 26-27, 41-42) in `training/readings.jsonl`.
- Existing tests: `evaluation.test.mjs`, `evaluationHeuristics.test.mjs` cover runEvaluation, checkEvalGate, buildHeuristicScores, runSyncEvaluationGate.
