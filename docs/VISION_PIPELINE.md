# Vision Pipeline Prototype

## Goal
Stand up the first iteration of the multimodal pipeline described in the vision research docs (see `docs/VISION_RESEARCH_MODE.md` and `docs/AI_Tarot_Master.md`): embed tarot card images with CLIP, compare them to text prototypes for each card, and surface the closest symbolic matches. This allows us to validate the feasibility of photo-based readings before wiring the flow into the Cloudflare Worker API.

## Implementation Overview
- **Model**: `Xenova/clip-vit-base-patch32` via `@xenova/transformers` (runs locally/in-browser, downloads weights on first use).
- **Card Library**: Built from `src/data/majorArcana.js` + `src/data/minorArcana.js`. Prompts now combine:
  - Curated Major Arcana annotations from `shared/symbols/symbolAnnotations.js`
  - Programmatic Minor Arcana symbol expansions from `shared/vision/minorSymbolLexicon.js`
  - Deck-style metadata from `shared/vision/deckProfiles.js` (RWS, Thoth, Marseille ready)
  - Physical assets live under `public/images/cards/` (RWS scans in the root), with deck-specific folders at `public/images/cards/thoth` and `public/images/cards/marseille`. Asset scanning is driven by `shared/vision/deckProfiles.js`.
- **Pipeline Class**: `shared/vision/tarotVisionPipeline.js` loads CLIP stacks, embeds prompts/images, normalizes vectors, and compares cosine similarity. It accepts file paths, URLs, or browser data URLs so both CLI scripts and the React UI can reuse the same engine.
- **CLI Harness**: `scripts/vision/runVisionPrototype.js` accepts image paths, with flags for deck scope/style and number of matches. Useful for quick regression checks while iterating on symbol prompts.
- **Evaluation Harness**: `scripts/evaluation/runVisionConfidence.js` sweeps `public/images/cards`, logs top-5 matches + confidence, and writes reports under `data/evaluations/` for the guide's Section 3 benchmarking work.
- **Metrics + Review Loop**: `scripts/evaluation/computeVisionMetrics.js` ingests any `vision-confidence.json` snapshot, derives ground-truth labels from `src/data/majorArcana.js`/`src/data/minorArcana.js`, computes micro precision/recall/F1 (Section 3 symbolic recognition metric), and emits:
  - `data/evaluations/vision-metrics.json` — machine-readable stats for release gates.
  - `data/evaluations/vision-review-queue.csv` — mismatched samples for human-in-the-loop review (Section 3 human evaluation). The queue preserves any previously recorded `human_verdict`/`human_notes` so annotations survive subsequent runs.
- **Review Summaries**: Once reviewers fill the queue, run `npm run review:vision` (wrapper around `scripts/evaluation/processVisionReviews.js`) to convert their annotations into `data/evaluations/vision-review-summary.json`, capturing acceptance/rejection rates and sample rows for audit.
- **UI Surface**: `VisionValidationPanel` + `useVisionValidation` hook (see `src/components/VisionValidationPanel.jsx`) let users upload photos per spread when vision research is enabled. `useVisionAnalysis` manages the proof handshake; mismatches are logged for telemetry but do not block `/api/tarot-reading`.

## Rollout Plan
- **Approach:** `/api/tarot-reading` accepts an optional server-signed `visionProof` instead of trusting raw `visionInsights`. Clients POST their base64 photos to `/api/vision-proof`, the worker reruns CLIP to verify the cards, signs the sanitized insights with `VISION_PROOF_SECRET`, and returns a short-lived proof object. Readings proceed without a proof; invalid or expired proofs still return 400/409.
- **UI Changes:** `VisionValidationPanel` handles uploads client-side for instant feedback (conflicts, attention maps, removal/reset). `TarotReading.jsx` triggers the proof handshake immediately before sending the spread so photos are re-verified on the server when research mode is enabled. Uploads are limited to five images, and any change invalidates the cached proof to prevent replay attacks.
- **Sample Payloads:** Dev scripts (`scripts/fix-and-deploy.sh`, `scripts/setup-*.sh`) demonstrate the two-step flow for research mode: call `/api/vision-proof` with a data URL, then reuse the returned `visionProof` when calling `/api/tarot-reading`. Tests build signed proofs via `functions/lib/visionProof.js` helpers—see `tests/api.vision.test.mjs` for an example.
- **Support Expectations:** Automations that previously injected `visionInsights` JSON should be upgraded to obtain proofs when participating in vision research. Proofs are optional, but when supplied they must be valid and signed; set `VISION_PROOF_SECRET` in environments that accept proofs.

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
