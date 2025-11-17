# AI Training Guide Analysis for Tarot Project
## Reality Check vs. `guidetoaitraining.md`

**Date:** November 16, 2025  
**Artifact:** `guidetoaitraining.md` — Comprehensive Guide to AI Training for Tarot Interpretation

---

## Executive Summary
- The neuro-symbolic foundation described in the guide is fully implemented: `functions/lib/knowledgeGraph.js` detects Fool's Journey stages, archetypal triads/dyads, and suit progressions, and the UI surfaces these narratives via `src/components/SpreadPatterns.jsx`.
- A working multimodal vision stack now ships with the product. `shared/vision/tarotVisionPipeline.js` embeds photos through CLIP, the React app enforces uploads via `VisionValidationPanel`, and `/api/tarot-reading` rejects readings when conflicts are present.
- Automated benchmarking exists for the vision pillar (`npm run eval:vision` → `data/evaluations/vision-metrics.json` + reviewer queue), but narrative/evaluation metrics lag behind the guide’s Section III expectations.
- A parallel narrative QA harness now mirrors the vision workflow. `npm run eval:narrative` generates deterministic sample readings, `computeNarrativeMetrics.js` now scores spine/agency compliance plus hallucination + tone heuristics, `verifyNarrativeGate.js` enforces thresholds, and `processNarrativeReviews.js` summarizes human annotations for releases.
- Documentation previously framed vision + knowledge-graph work as “future plans”; this report now reflects the shipped state and pinpoints the remaining deltas: enforcing vision-first flows, expanding multi-deck coverage, and adding narrative QA metrics.

---

## I. Current Implementation Status

### 1. Symbolic Encoding & Narrative Controls
- **Knowledge Graph:** Completed and wired into prompts. See `functions/lib/knowledgeGraph.js`, `functions/lib/spreadAnalysis.js` (dynamic enablement), and `src/components/SpreadPatterns.jsx` for UI surfacing.
- **Prompt Spine & Ethics:** `functions/lib/narrative/prompts.js` + `functions/lib/narrativeSpine.js` enforce reversal frameworks, WHAT→WHY→WHAT’S NEXT clauses, and ethical guardrails described in Guide Section I.4.
- **Structured Symbol Data:** `functions/lib/symbolAnnotations.js` plus `shared/vision/minorSymbolLexicon.js` give all 78 cards machine-readable symbols, dominant colors, and archetypes—directly satisfying Section 1.5’s “annotated imagery” requirement.

### 2. Vision Pipeline & Upload UX
- **Model + Card Library:** `shared/vision/tarotVisionPipeline.js` wraps `@xenova/transformers` CLIP weights, couples text prompts with canonical JPEG embeddings (`public/images/cards`), and supports deck profiles (`shared/vision/deckProfiles.js`).
- **Frontend Flow:** `src/components/VisionValidationPanel.jsx` and `src/hooks/useVisionValidation.js` convert user photos to Data URLs, call the pipeline in-browser, and expose conflict lists before any reading request.
- **Server Enforcement:** `/api/vision-proof` re-runs the CLIP pipeline against uploaded photos, signs the sanitized insights with `VISION_PROOF_SECRET`, and `/api/tarot-reading` (`functions/api/tarot-reading.js`) refuses to run unless a valid, unexpired proof is provided. The verified insight bundle is what we pass into the Claude/GPT prompt so the LLM understands the photo evidence.

### 3. Evaluation Harnesses
- `npm run eval:vision` (CLI driver in `scripts/evaluation/runVisionConfidence.js`) bulk-embeds reference images, producing JSON snapshots under `data/evaluations/`.
- `npm run ci:vision-check` (compute metrics + verify thresholds) ensures accuracy ≥ 90 %, high-confidence coverage ≥ 75 %, and high-confidence accuracy ≥ 90 %. Failures populate `data/evaluations/vision-review-queue.csv` for human adjudication—fulfilling the guide’s call for human-in-the-loop review of the CV component.
- `npm run eval:narrative` now generates deterministic readings (`runNarrativeSamples.js` → `narrative-samples.json`), scores them via `computeNarrativeMetrics.js` (spine, agency, hallucination, tone heuristics), and opens `data/evaluations/narrative-review-queue.csv` for human reviewers; `npm run ci:narrative-check` adds the automated gate and `npm run review:narrative` rolls reviewer verdicts into `narrative-review-summary.json`.

### 4. Documentation & Knowledge Base
- `docs/VISION_PIPELINE.md` now documents the entire CLIP pipeline, CLI harnesses, and UI hooks.
- `docs/knowledge-graph/*.md` describe triads, dyads, Fool’s Journey stages, and suit progressions exactly as implemented.
- This analysis file is updated to describe the real system rather than the pre-vision roadmap.

---

## II. Remaining Gaps vs. Guide Recommendations

| Gap | Guide Reference | Reality | Required Work |
| --- | --- | --- | --- |
| **Vision-first enforcement** | Section II.2 “Validate before prompting” | Users could previously spoof a reading by posting fabricated `visionInsights`. | Require a server-signed `visionProof` (photo → `/api/vision-proof` → signed insights) before `/api/tarot-reading` responds, and gate the “Create Personal Narrative” button in `src/TarotReading.jsx` until uploads are conflict-free. Snapshot the proof summary alongside feedback/journal metadata for auditability. |
| **Multi-deck assets & benchmarking** | Sections I.1 & II.3 (multi-tradition adaptation) | Deck profiles exist for RWS/Thoth/Marseille, but only RWS has images + evaluation data. | Add Thoth/Marseille image sets under `public/images/cards/<deck>/`, extend `MAJOR_ARCANA`/`MINOR_ARCANA` metadata where names differ, and run `npm run eval:vision --deck-style <id>` to generate metrics + review queues per deck. Tie prompts/knowledge graph to renamed cards (Adjustment/Lust, pip-only minors). |
| **Narrative QA metrics** | Section III (symbolic comprehension + interpretability) | Deterministic samples + automated scoring now include hallucination + tone heuristics, but still lack rubric-based scoring (accuracy, compassion, actionability). | Add rubric prompts + weighting so reviewer CSV captures per-dimension scores, and feed those aggregates into the gate for quantitative Section III coverage. |
| **Doc + feedback sync** | Section IV (deployment + monitoring) | Docs recently lagged behind shipped features; human feedback is stored in bespoke files. | Maintain a changelog per subsystem (vision, knowledge graph, narrative) and capture reviewer verdicts directly in `data/evaluations/vision-review-summary.json` + a forthcoming `data/evaluations/narrative-review.csv`. |

---

## III. Action Plan

### Immediate (This Sprint)
1. **Hard-stop API without photos**
   - Update `functions/api/tarot-reading.js` to reject requests without a valid signed `visionProof`.
   - Reflect the requirement in `src/TarotReading.jsx` (disable generate button, display helper copy) and add test coverage in `tests/api.vision.test.mjs` (already partially prepared).
2. **Documentation refresh**
   - Keep this report and `docs/VISION_PIPELINE.md` in sync whenever vision behaviour changes.

### Near-Term (2–4 Weeks)
1. **Deck asset expansion**
   - Import Thoth/Marseille art assets, update `shared/vision/deckProfiles.js` palettes if necessary, and regenerate evaluation outputs.
2. **Narrative QA gate enhancements**
   - Expand reviewer prompts/CSV headers to capture rubric-style feedback (accuracy, compassion, actionability) for each release sample, then roll those into `narrative-metrics.json`.
   - Add symbol-mention precision/recall and per-context weighting so the gate reflects qualitative scores, not just heuristics.

### Medium-Term (4–8 Weeks)
1. **Multi-deck prompts + knowledge graph**
   - Inject deck-style cues (e.g., pip numerology for Marseille) into `functions/lib/narrative/prompts.js` and `functions/lib/knowledgeGraph.js`.
2. **Telemetry + analytics**
   - Log anonymized stats (vision confidence averages, reversal-framework usage) so we can demonstrate improvements over time as the guide recommends.

---

## IV. Alignment Snapshot

| Guide Pillar | Status | Evidence |
| --- | --- | --- |
| Encoding deck-specific symbolism | ✅ Shipping | `functions/lib/symbolAnnotations.js`, `functions/lib/knowledgeGraph.js`, `docs/knowledge-graph/*` |
| Handling artistic variation | ⚠️ Partial | CLIP pipeline + deck profiles exist, but only RWS has assets + metrics |
| Evaluating symbolic understanding | ⚠️ Partial | Vision metrics automated; narrative metrics pending |
| Human-in-the-loop review | ⚠️ Partial | Vision review queue implemented; narrative review still manual |

---

## V. Key Takeaways
- We now satisfy the guide’s requirements for annotated symbolism, knowledge-graph reasoning, and a CLIP-based validation loop.
- The highest leverage next step is forcing every reading request to include at least one validated photo; this closes the “vision-first” gap and gives us consistent evidence for audit trails.
- Expanding deck assets and adding narrative QA harnesses will bring Sections II and III of the guide fully online, unlocking multi-tradition robustness and measurable interpretive quality.
