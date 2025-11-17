# Vision Pipeline Prototype

## Goal
Stand up the first iteration of the multimodal pipeline described in `guidetoaitraining.md` and `docs/AI_TRAINING_ANALYSIS.md`: embed tarot card images with CLIP, compare them to text prototypes for each card, and surface the closest symbolic matches. This allows us to validate the feasibility of photo-based readings before wiring the flow into the Cloudflare Functions API.

## Implementation Overview
- **Model**: `Xenova/clip-vit-base-patch32` via `@xenova/transformers` (runs locally/in-browser, downloads weights on first use).
- **Card Library**: Built from `src/data/majorArcana.js` + `src/data/minorArcana.js`. Prompts now combine:
  - Curated Major Arcana annotations from `functions/lib/symbolAnnotations.js`
  - Programmatic Minor Arcana symbol expansions from `shared/vision/minorSymbolLexicon.js`
  - Deck-style metadata from `shared/vision/deckProfiles.js` (RWS, Thoth, Marseille ready)
  - Physical assets live under `public/images/cards/{rws-1909|thoth|marseille}`. The Marseille folder contains an 18th-century scan set, while `thoth` includes **enhanced abstract placeholders** (v2) with Art Deco gradients, Hebrew letters, astrological symbols, and geometric mandalas that capture the Thoth visual language without reproducing copyrighted artwork (see `docs/THOTH_ENHANCEMENTS.md`).
- **Pipeline Class**: `shared/vision/tarotVisionPipeline.js` loads CLIP stacks, embeds prompts/images, normalizes vectors, and compares cosine similarity. It accepts file paths, URLs, or browser data URLs so both CLI scripts and the React UI can reuse the same engine.
- **CLI Harness**: `scripts/vision/runVisionPrototype.js` accepts image paths, with flags for deck scope/style and number of matches. Useful for quick regression checks while iterating on symbol prompts.
- **Evaluation Harness**: `scripts/evaluation/runVisionConfidence.js` sweeps `public/images/cards`, logs top-5 matches + confidence, and writes reports under `data/evaluations/` for the guide's Section 3 benchmarking work.
- **Metrics + Review Loop**: `scripts/evaluation/computeVisionMetrics.js` ingests any `vision-confidence.json` snapshot, derives ground-truth labels from `src/data/majorArcana.js`/`src/data/minorArcana.js`, computes micro precision/recall/F1 (Section 3 symbolic recognition metric), and emits:
  - `data/evaluations/vision-metrics.json` — machine-readable stats for release gates.
  - `data/evaluations/vision-review-queue.csv` — mismatched samples for human-in-the-loop review (Section 3 human evaluation). The queue preserves any previously recorded `human_verdict`/`human_notes` so annotations survive subsequent runs.
- **Review Summaries**: Once reviewers fill the queue, run `npm run review:vision` (wrapper around `scripts/evaluation/processVisionReviews.js`) to convert their annotations into `data/evaluations/vision-review-summary.json`, capturing acceptance/rejection rates and sample rows for audit.
- **UI Surface**: `VisionValidationPanel` + `useVisionValidation` hook (see `src/components/VisionValidationPanel.jsx`) let users upload photos per spread. The results must match the drawn cards before `/api/tarot-reading` is called, satisfying the "validate before prompting" requirement.

## Rollout Plan
- **Approach:** `/api/tarot-reading` now requires a server-signed `visionProof` instead of trusting raw `visionInsights`. Clients POST their base64 photos to `/api/vision-proof`, the Pages Function reruns CLIP to verify the cards, signs the sanitized insights with `VISION_PROOF_SECRET`, and returns a short-lived proof object that must accompany the reading request. No proof ⇒ HTTP 400.
- **UI Changes:** `VisionValidationPanel` still handles uploads client-side for instant feedback (conflicts, attention maps, removal/reset), but `TarotReading.jsx` triggers the proof handshake immediately before sending the spread so photos are re-verified on the server. Uploads are limited to five images, and any change invalidates the cached proof to prevent replay attacks.
- **Sample Payloads:** Dev scripts (`scripts/fix-and-deploy.sh`, `scripts/setup-*.sh`) now demonstrate the two-step flow: first call `/api/vision-proof` with a data URL, then reuse the returned `visionProof` when calling `/api/tarot-reading`. Tests build signed proofs via `functions/lib/visionProof.js` helpers—see `tests/api.vision.test.mjs` for an example.
- **Support Expectations:** Automations that previously injected `visionInsights` JSON must be upgraded to obtain proofs (or pipe card photos through the new API). There is no bypass anymore—the server will reject unsigned or expired proofs with a 409/400 response. Set the `VISION_PROOF_SECRET` secret in every environment or the proof endpoints will fail to sign/verify.

## Usage
1. Install dependencies (already part of `npm install` after adding `@xenova/transformers`).
2. Run the CLI against any local card images:
   ```bash
   node scripts/vision/runVisionPrototype.js public/images/cards/RWS1909_-_00_Fool.jpeg
   ```
3. Optional flags:
   - `--all-cards`: include Minor Arcana prototypes (78 cards total).
   - `--max-results N`: change how many matches are displayed per image.
   - `--deck-style rws-1909|thoth-a1|marseille-classic`: swap stylistic prompt cues and card assets.

The first run downloads ~350 MB of model weights into the transformers cache. Subsequent runs reuse the cache and finish quickly.

### Deck-specific evaluation suite

- `npm run eval:vision:rws` → evaluates Rider–Waite–Smith reference scans and writes `data/evaluations/vision-confidence.rws.json`.
- `npm run eval:vision:thoth` → evaluates the Thoth placeholders/scans and writes `data/evaluations/vision-confidence.thoth.json`.
- `npm run eval:vision:marseille` → evaluates the Marseille scan set and writes `data/evaluations/vision-confidence.marseille.json`.
- `npm run eval:vision:all` → runs the three commands sequentially so every deck has a fresh confidence snapshot before computing metrics.

## Next Steps
- Persist proof summaries (requestId, deck, proof id) in KV so we can audit vision evidence post-reading.
- Turn the metrics output into a hard gate (e.g., require accuracy ≥ 0.9 and zero mismatches before releasing deck updates).
- Wire `npm run ci:vision-check` into CI (after `npm run eval:vision`) so builds fail automatically when accuracy < 90%, high-confidence coverage < 75%, or high-confidence accuracy < 90%. Thresholds can be tuned via `VISION_MIN_*` env vars when running the gate. Encourage reviewers to commit annotated CSVs plus the generated summary JSON so every release includes human sign-off artifacts.
- Hook CLIP confidences into spread prompts (e.g., "Vision match confidence: 0.82 on The Hermit") so GPT/Claude can reference the computer-vision certainty when narrating reversals or misreads.
