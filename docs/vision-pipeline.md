# Vision Pipeline

Type: reference
Status: active reference
Last reviewed: 2026-09-25

## Goal
The current multimodal pipeline embeds tarot card images with CLIP, compares them to text prototypes for each card, and surfaces the closest symbolic matches. It is available as an opt-in research capability and is connected to the Worker through server-signed vision proofs; it is not required to complete a normal reading.

## Implementation Overview
- **Model**: `Xenova/clip-vit-base-patch32` via `@xenova/transformers` (runs locally/in-browser, downloads weights on first use).
- **Card Library**: Built from `src/data/majorArcana.js` + `src/data/minorArcana.js`. Prompts now combine:
  - Curated Major Arcana annotations from `shared/symbols/symbolAnnotations.js`
  - Programmatic Minor Arcana symbol expansions from `shared/vision/minorSymbolLexicon.js`
  - Deck-style metadata from `shared/vision/deckProfiles.js` (RWS, Thoth, Marseille ready)
  - Physical assets live under `public/images/cards/` (RWS scans in the root), with deck-specific folders at `public/images/cards/thoth` and `public/images/cards/marseille`. Asset scanning is driven by `shared/vision/deckProfiles.js`.
- **Pipeline Class**: `shared/vision/tarotVisionPipeline.js` loads CLIP stacks, embeds prompts/images, normalizes vectors, and compares cosine similarity. It accepts file paths, URLs, or browser data URLs so both CLI scripts and the React UI can reuse the same engine.
- **Orientation**: the default `clip-default` backend does not infer upright/reversed orientation. Orientation is an optional server-side Llama or hybrid result when that backend is selected and available.
- **CLI Harness**: `scripts/vision/runVisionPrototype.js` accepts image paths, with flags for deck scope/style and number of matches. Useful for quick regression checks while iterating on symbol prompts.
- **Evaluation Harness**: `scripts/evaluation/runVisionConfidence.js` sweeps `public/images/cards`, logs top-5 matches + confidence, and writes reports under `data/evaluations/` for the guide's Section 3 benchmarking work.
- **Metrics + Review Loop**: `scripts/evaluation/computeVisionMetrics.js` ingests any `vision-confidence.json` snapshot, derives ground-truth labels from `src/data/majorArcana.js`/`src/data/minorArcana.js`, computes micro precision/recall/F1 (Section 3 symbolic recognition metric), and emits:
  - `data/evaluations/vision-metrics.json` — machine-readable stats for release gates.
  - `data/evaluations/vision-review-queue.csv` — mismatched samples for human-in-the-loop review (Section 3 human evaluation). The queue preserves any previously recorded `human_verdict`/`human_notes` so annotations survive subsequent runs.
- **Review Summaries**: Once reviewers fill the queue, run `npm run review:vision` (wrapper around `scripts/evaluation/processVisionReviews.js`) to convert their annotations into `data/evaluations/vision-review-summary.json`, capturing acceptance/rejection rates and sample rows for audit.
- **UI Surface**: `VisionValidationPanel` + `useVisionValidation` hook (see `src/components/VisionValidationPanel.jsx`) let users upload photos per spread when vision research is enabled. `useVisionAnalysis` manages the proof handshake; default mismatches are logged for telemetry and do not block `/api/tarot-reading`.

## Rollout Plan
- **Approach:** `/api/tarot-reading` accepts an optional server-signed `visionProof` instead of trusting raw `visionInsights`. Clients POST their base64 photos to `/api/vision-proof`, the worker reruns the selected vision backend to verify the cards, signs the sanitized insights with `VISION_PROOF_SECRET`, and returns a short-lived proof object. Readings proceed without a proof. A malformed, unsigned, tampered, or unsupported proof returns 400; an expired proof returns 409.
- **UI Changes:** `VisionValidationPanel` handles uploads client-side for instant feedback (conflicts, attention maps, removal/reset). `TarotReading.jsx` triggers the proof handshake immediately before sending the spread so photos are re-verified on the server when research mode is enabled. Uploads are limited to five images, and any change invalidates the cached proof to prevent replay attacks.
- **Sample Payloads:** Dev scripts (`scripts/fix-and-deploy.sh`, `scripts/setup-*.sh`) demonstrate the two-step flow for research mode: call `/api/vision-proof` with a data URL, then reuse the returned `visionProof` when calling `/api/tarot-reading`. Tests build signed proofs via `functions/lib/visionProof.js` helpers—see `tests/api.vision.test.mjs` for an example.
- **Support Expectations:** Automations that previously injected `visionInsights` JSON should be upgraded to obtain proofs when participating in vision research. Proofs are optional, but when supplied they must be valid and signed; set `VISION_PROOF_SECRET` in environments that accept proofs.

## Prompt Eligibility and Mismatch Policy

Uploaded evidence is annotated before prompt assembly. The default prompt confidence
floor is `0.65`, with a `0.45` symbol-match floor and a `0.65` weighted-symbol floor.
`VISION_PROMPT_CONFIDENCE_FLOOR` and `VISION_PROMPT_SYMBOL_MATCH_FLOOR` can override
the corresponding values; an explicit symbol floor also becomes the weighted floor.
Only recognized uploads returned by `annotateVisionInsights()` enter the annotated
set. That recognized list is the source of suppression-reason metadata: each entry
has a `suppressionReason` when it is not prompt-eligible; low-confidence, mismatched,
or otherwise unverified entries are telemetry-only, while entries that cannot be
resolved to a card are filtered out.

Deck and mismatch-rate strictness is opt-in. `VISION_STRICT_DECK_MATCH=true` returns
409 for a proof from the wrong deck. `VISION_STRICT_MISMATCH_RATE=true` returns 409
when the mismatch rate exceeds `VISION_MAX_MISMATCH_RATE` (default `0.5`). With the
default policies disabled, mismatches are recorded and the reading continues.

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

The first run downloads the model weights into the Transformers cache; the exact cache size varies by model version and runtime. Subsequent runs reuse the cache.

### Deck-specific evaluation suite

- `npm run eval:vision:rws` → evaluates Rider–Waite–Smith reference scans and writes `data/evaluations/vision-confidence.rws.json`.
- `npm run eval:vision:thoth` → evaluates the Thoth placeholders/scans and writes `data/evaluations/vision-confidence.thoth.json`.
- `npm run eval:vision:marseille` → evaluates the Marseille scan set and writes `data/evaluations/vision-confidence.marseille.json`.
- `npm run eval:vision:all` → runs the three commands sequentially so every deck has a fresh confidence snapshot before computing metrics.

## RWS Evidence Chain

When a signed proof is attached to `/api/tarot-reading`, the Worker derives `visionEvidence` packets from the recognized annotated uploads:

`visionProof.insights → annotateVisionInsights() → buildVisionEvidencePackets() → buildEnhancedClaudePrompt()`

The prompt treats uploaded visible evidence separately from canonical Rider-Waite-Smith imagery. Recognized annotated uploads that are not prompt-eligible remain available for metrics but must not steer interpretation. Each packet carries `evidenceMode` (`uploaded_image` or `telemetry_only`) and a `suppressionReason` (`null` for prompt-eligible evidence, a reason for suppressed evidence) so downstream telemetry can distinguish prompt influence from research-only data.

The user prompt renders an **Uploaded Visible Evidence** section with literal/symbolic separation per detected symbol, while the system prompt's IMAGE EVIDENCE RULES instruct the model to omit symbols not present in the uploaded evidence or canonical card profile. `cardBuilders.js` labels stock RWS imagery hooks as **Canonical RWS imagery** so the model never implies the user uploaded those visual details.

## Current QA and Follow-ups

`npm run gate:vision` and `npm run ci:vision-check` are shipped. The CI workflow runs
`ci:vision-check` after evaluating all three deck styles, computing per-deck metrics,
and checking accuracy, high-confidence coverage and accuracy, symbol coverage,
weighted symbol coverage, high-salience recall, absent-symbol false positives, and
high-confidence error rate. Thresholds remain configurable through the `VISION_*`
environment variables; lower them only with an explicit quality decision.

The vision review CSV and generated metrics remain useful release artifacts. Future
work may persist proof summaries for longer-term auditing, but the current
prompt-eligibility, confidence, and telemetry paths are already implemented.
