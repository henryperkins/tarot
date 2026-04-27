# RWS Visual Grounding Complete Solution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Rider-Waite-Smith symbol, coordinate, vision, training, and prompt infrastructure into a supervised visual-grounding loop that rewards verified visual evidence and suppresses unsupported image claims.

**Architecture:** Extend the current evidence spine instead of creating a parallel path. `shared/vision/rwsEvidenceOntology.js` becomes the canonical visual-symbolic schema, `shared/vision/symbolDetector.js` emits salience-weighted verification, `functions/lib/visionEvidence.js` builds the reading-facing evidence ledger, and evaluation/training scripts consume the same contract.

**Tech Stack:** Node ESM scripts and tests, React/Vite UI where needed, Cloudflare Worker functions, existing CLIP/LoRA Python training script, existing vision confidence and narrative gate scripts.

---

## Current-state findings from the checkout

The public-repo critique is directionally right, but the live checkout is already ahead of it in two places:

- `shared/vision/rwsEvidenceOntology.js` already derives major-card evidence from `SYMBOL_ANNOTATIONS`.
- `functions/lib/visionEvidence.js` already builds evidence packets used by prompt assembly.

The remaining gaps are implementation-strength gaps:

- `scripts/training/trainLoRA.py` still trains from filename captions.
- `shared/vision/rwsEvidenceOntology.js` lacks salience, aliases, expected regions, confusables, and absence negatives.
- `shared/vision/rwsEvidenceOntology.js` derives only major-card records from `SYMBOL_ANNOTATIONS`; minor-card ontology must also use `getMinorSymbolAnnotation()` so the generated 78-card caption dataset is symbol-rich.
- `src/data/symbolCoordinates.js` is currently browser-source oriented and imports `symbolAnnotations` without a Node ESM `.js` extension; fix this or move normalized coordinate helpers into `shared/` before importing coordinates from shared Node tests.
- `shared/vision/symbolDetector.js` emits flat `matchRate`, not salience-weighted evidence.
- `shared/vision/symbolDetector.js` only queries expected-symbol labels, so absence false-positive metrics require explicitly adding absence-negative candidate labels and keeping those detections separate from expected-symbol matches.
- `functions/api/vision-proof.js`, `functions/lib/visionProof.js`, and `functions/lib/readingQuality.js` preserve only the flat symbol contract.
- `shared/vision/hybridVisionPipeline.js` chooses CLIP versus Llama by raw confidence and always carries CLIP symbol verification, which must not be treated as proof for a different Llama-selected card.
- `scripts/evaluation/computeVisionMetrics.js` and `scripts/evaluation/verifyVisionGate.js` do not gate weighted grounding, calibration, or absence false positives.
- Prompt code distinguishes telemetry-only evidence, but the evidence ledger does not yet expose three knowledge levels: traditional card meaning, expected Rider symbolism, and verified uploaded-image evidence.

## File map

Create:

- `shared/vision/rwsHardNegatives.js` - deterministic Rider confusable groups and per-card distinguishing features.
- `scripts/training/generateRwsCaptionDataset.mjs` - generates symbol-rich caption/evidence JSONL from ontology.
- `tests/rwsCaptionDataset.test.mjs` - verifies generated captions, salience, hard negatives, and minors.
- `tests/symbolDetectorWeightedScoring.test.mjs` - tests weighted scoring as pure functions without loading the detector model.
- `tests/visionFusionRouter.test.mjs` - tests calibrated fusion behavior without model calls.
- `tests/visionMetricsWeightedGrounding.test.mjs` - tests metric computation with weighted symbol fixtures.
- `data/eval/rws-hard-negatives/README.md` - benchmark manifest contract.
- `data/eval/rws-symbol-absence/README.md` - absence benchmark contract.

Modify:

- `shared/vision/rwsEvidenceOntology.js` - add canonical symbol ids, aliases, salience, coordinate priors, confusables, and absence negatives.
- `shared/vision/symbolDetector.js` - compute `weightedMatchRate`, salience buckets, absent-symbol false positives, and per-symbol weighted matches.
- `functions/api/vision-proof.js` - sanitize and sign the expanded symbol-verification fields.
- `functions/lib/visionProof.js` - preserve the expanded symbol-verification and image-quality fields through proof trimming.
- `functions/lib/readingQuality.js` - gate visual prompt eligibility on `weightedMatchRate` when present.
- `functions/lib/visionEvidence.js` - expose a full visual evidence ledger with knowledge-level separation and no-vision-claim modes.
- `functions/lib/narrative/prompts/visionValidation.js` - render weighted symbol checks and explicit visual-claim constraints.
- `shared/vision/hybridVisionPipeline.js` - replace confidence-only selection with a deterministic calibrated router interface.
- `src/data/symbolCoordinates.js` - make coordinate exports safe for Node ESM imports or move shared coordinate normalization out of `src/`.
- `scripts/evaluation/computeVisionMetrics.js` - compute weighted grounding, high-salience recall, absence false positives, and calibration metrics.
- `scripts/evaluation/verifyVisionGate.js` - add thresholds for weighted grounding and high-salience recall.
- `scripts/evaluation/processVisionReviews.js` - add active-learning failure labels and JSONL export.
- `scripts/training/trainLoRA.py` - optionally load generated JSONL captions instead of filename-only captions.
- `src/components/VisionValidationPanel.jsx` - display weighted symbol score and high-salience missing symbols in research UI.
- `package.json` - add scripts for dataset generation and targeted weighted vision tests.

## Milestone 1: Canonical Rider evidence schema

### Task 1: Add hard-negative definitions

**Files:**

- Create: `shared/vision/rwsHardNegatives.js`
- Test: `tests/rwsEvidenceOntology.test.mjs`

- [ ] Add `RWS_HARD_NEGATIVE_GROUPS` with these groups:

```js
export const RWS_HARD_NEGATIVE_GROUPS = Object.freeze([
  {
    anchor: 'The High Priestess',
    positives: ['pillars', 'scroll', 'veil', 'crescent moon', 'lunar crown'],
    negatives: [
      {
        card: 'Justice',
        sharedFeatures: ['seated figure', 'pillars', 'frontal composition'],
        distinguishingFeatures: ['sword', 'scales', 'red robe']
      },
      {
        card: 'The Hierophant',
        sharedFeatures: ['pillars', 'religious authority'],
        distinguishingFeatures: ['raised hand', 'two acolytes', 'crossed keys']
      }
    ]
  },
  {
    anchor: 'The Sun',
    positives: ['sun', 'child', 'horse', 'sunflowers', 'banner'],
    negatives: [
      {
        card: 'Strength',
        sharedFeatures: ['yellow palette', 'warmth', 'lion'],
        distinguishingFeatures: ['woman and lion', 'infinity symbol', 'flower garland']
      },
      {
        card: 'The Fool',
        sharedFeatures: ['bright sky', 'sun', 'open landscape'],
        distinguishingFeatures: ['cliff edge', 'small dog', 'white rose', 'travel bundle']
      }
    ]
  },
  {
    anchor: 'Two of Swords',
    positives: ['blindfold', 'crossed swords', 'water', 'moon'],
    negatives: [
      {
        card: 'Eight of Swords',
        sharedFeatures: ['blindfold', 'swords', 'restriction'],
        distinguishingFeatures: ['bound figure', 'eight swords', 'muddy ground']
      },
      {
        card: 'Four of Swords',
        sharedFeatures: ['swords', 'stillness', 'pause'],
        distinguishingFeatures: ['tomb', 'recumbent figure', 'stained glass']
      }
    ]
  },
  {
    anchor: 'Queen of Cups',
    positives: ['ornate cup', 'throne', 'water', 'angels'],
    negatives: [
      {
        card: 'The High Priestess',
        sharedFeatures: ['seated feminine figure', 'intuition', 'water'],
        distinguishingFeatures: ['pillars', 'scroll', 'veil', 'crescent moon']
      },
      {
        card: 'Page of Cups',
        sharedFeatures: ['cup', 'water', 'emotional tone'],
        distinguishingFeatures: ['youthful page', 'fish in cup', 'standing figure']
      }
    ]
  },
  {
    anchor: 'The Fool',
    positives: ['cliff', 'dog', 'white rose', 'sun', 'bundle'],
    negatives: [
      {
        card: 'The Sun',
        sharedFeatures: ['sun', 'bright sky', 'open landscape'],
        distinguishingFeatures: ['child', 'horse', 'sunflowers', 'red banner']
      },
      {
        card: 'Strength',
        sharedFeatures: ['yellow palette', 'warmth', 'animal companion'],
        distinguishingFeatures: ['woman and lion', 'infinity symbol', 'flower garland']
      }
    ]
  }
]);
```

- [ ] Export `getRwsHardNegatives(cardName)` that canonicalizes the anchor and returns an empty array for cards with no group.
- [ ] Keep hard negatives directional by default. If reverse lookup is later needed, add a separate `getRwsHardNegativeAnchors(cardName)` helper instead of changing `getRwsHardNegatives()` semantics.
- [ ] Extend `tests/rwsEvidenceOntology.test.mjs` to assert High Priestess returns Justice and Hierophant hard negatives.
- [ ] Assert The Fool returns The Sun and Strength hard negatives so Task 3 caption generation has deterministic Fool negatives.
- [ ] Run `node --test tests/rwsEvidenceOntology.test.mjs`.

### Task 2: Extend ontology records

**Files:**

- Modify: `shared/vision/rwsEvidenceOntology.js`
- Modify: `tests/rwsEvidenceOntology.test.mjs`

- [ ] Import `SYMBOL_COORDINATES` and `getRwsHardNegatives` only after making the coordinate module Node ESM-safe by adding the missing `.js` import extension, or move a normalized coordinate helper into `shared/vision/` and import that from the ontology.
- [ ] Import and use `getMinorSymbolAnnotation()` for minor cards so `getRwsCardEvidence()` returns real visual symbols for all 78 cards, not only majors.
- [ ] Add `symbolId(card, symbol)` that emits ids like `rws.fool.cliff` and `rws.high_priestess.crescent_moon`.
- [ ] Add salience defaults:

```js
const SYMBOL_SALIENCE_OVERRIDES = Object.freeze({
  'The Fool': {
    cliff: 0.95,
    dog: 0.85,
    white_rose: 0.7,
    sun: 0.65,
    bundle: 0.55,
    feather: 0.35
  },
  'The Magician': {
    wand: 0.9,
    infinity_symbol: 0.85,
    cup: 0.75,
    sword: 0.75,
    pentacle: 0.75
  },
  'The High Priestess': {
    pillars: 0.9,
    scroll: 0.8,
    veil: 0.75,
    crescent_moon: 0.75,
    lunar_crown: 0.7
  }
});
```

- [ ] Add fallback salience `0.6` for symbols without an override.
- [ ] Convert `SYMBOL_COORDINATES` shapes into normalized `expectedRegion` values using the 820 x 1430 viewBox.
- [ ] Add aliases using normalized object, object without color adjective, and selected manual aliases such as `small dog` for `dog`, `precipice` for `cliff`, and `travel bundle` for `bundle`.
- [ ] Add `absenceNegatives` from hard-negative distinguishing features plus common absent symbols per card.
- [ ] Include hard-negative metadata on the card record, not each symbol, so `getRwsHardNegatives(card)` and absence-negative generation share one source of truth.
- [ ] Update tests to assert The Fool cliff has `symbolId`, `salience`, `expectedRegion`, and `aliases`, and that the Fool card record exposes hard negatives.
- [ ] Update tests to assert a minor card, for example Two of Swords, has generated ontology symbols and stable ids even when no coordinate priors exist.
- [ ] Run `node --test tests/rwsEvidenceOntology.test.mjs`.

## Milestone 2: Symbol-rich supervised training data

### Task 3: Generate RWS multimodal caption JSONL

**Files:**

- Create: `scripts/training/generateRwsCaptionDataset.mjs`
- Create: `tests/rwsCaptionDataset.test.mjs`
- Modify: `package.json`

- [ ] Implement `buildRwsCaptionRecord(card, options)` that returns:

```js
{
  image_id,
  image,
  deck: 'rider_waite_smith',
  card,
  stable_id,
  orientation,
  positive_captions,
  hard_negative_captions,
  symbols
}
```

- [ ] Generate three captions per card:

```js
`Rider-Waite-Smith ${card}, ${orientation}: ${symbolList}.`
`${card} shows ${themeList} through ${topSymbolList}.`
`A RWS tarot card grounded visually by ${topSymbolList}.`
```

- [ ] Use ontology salience to sort symbols and include only the top six in short captions.
- [ ] Include hard negatives from `getRwsHardNegatives(card.name)`.
- [ ] Default image paths to `data/raw_images/rws/<stable_id>.jpg`, with `--image-root` override.
- [ ] Add CLI flags: `--out`, `--image-root`, `--orientation upright|reversed|both`, `--limit`.
- [ ] Add `training:captions:rws` script:

```json
"training:captions:rws": "node scripts/training/generateRwsCaptionDataset.mjs --out data/training/rws_multimodal_captions.jsonl"
```

- [ ] Test The Fool emits cliff, dog, white rose, salience, and Strength/Sun style hard negatives.
- [ ] Test a minor card emits a valid stable id, includes non-empty generated symbols from `getMinorSymbolAnnotation()`, and does not crash when coordinates are absent.
- [ ] Run `node --test tests/rwsCaptionDataset.test.mjs`.

### Task 4: Teach LoRA training to use generated captions

**Files:**

- Modify: `scripts/training/trainLoRA.py`

- [ ] Add `--captions_jsonl data/training/rws_multimodal_captions.jsonl`.
- [ ] Add a JSONL-backed dataset path where each image can rotate through `positive_captions`.
- [ ] Keep filename caption fallback when no JSONL is provided.
- [ ] Validate missing image behavior by logging and skipping rows instead of crashing.
- [ ] Keep current CLI behavior unchanged for existing callers.
- [ ] Run `python scripts/training/trainLoRA.py --deck rws --epochs 1 --batch_size 1 --captions_jsonl data/training/rws_multimodal_captions.jsonl` only in an environment with the Python dependencies installed.

## Milestone 3: Salience-weighted symbol verification

### Task 5: Add pure weighted scoring helpers

**Files:**

- Modify: `shared/vision/symbolDetector.js`
- Create: `tests/symbolDetectorWeightedScoring.test.mjs`

- [ ] Export `computeSymbolVerificationScores(expectedSymbols, matches, unexpectedDetections)`.
- [ ] Calculate:

```js
weightedMatchRate =
  sum(found ? confidence * salience : 0) / sum(salience)
```

- [ ] Emit `highSalienceMissing` where `salience >= 0.75`.
- [ ] Emit `lowSalienceMissing` where `salience < 0.75`.
- [ ] Emit `absentSymbolFalsePositive` when absence-negative detections overlap ontology absence negatives. Do not rely on `unexpectedDetections` alone; those are currently only unmatched expected-symbol candidate labels.
- [ ] Return `absenceDetections` separately from `unexpectedDetections` so absence metrics do not contaminate expected-symbol detection counts.
- [ ] Preserve existing `matchRate`, `expectedCount`, `detectedCount`, `missingSymbols`, and `unexpectedDetections`.
- [ ] Test The Fool example where cliff and dog found but rose and feather missing gives weighted score greater than flat score.
- [ ] Run `node --test tests/symbolDetectorWeightedScoring.test.mjs`.

### Task 6: Emit weighted fields from detector and proof surfaces

**Files:**

- Modify: `shared/vision/symbolDetector.js`
- Modify: `functions/api/vision-proof.js`
- Modify: `functions/lib/visionProof.js`
- Modify: `tests/llamaVision.test.mjs`

- [ ] Attach `symbolId`, `salience`, `expectedRegion`, `aliases`, and `absenceNegatives` to each expected symbol match where available.
- [ ] Add absence-negative candidate labels to the detector prompt set, but keep their matches out of `detectedCount`, `matchRate`, and expected-symbol `matches`.
- [ ] Include `weightedMatchRate`, `highSalienceMissing`, `lowSalienceMissing`, and `absentSymbolFalsePositive` in detector output.
- [ ] Include `verifiedCard` and `verificationSource` in `symbolVerification` so hybrid routing cannot apply one model/card's symbol proof to another model/card's prediction.
- [ ] Sanitize those fields in `functions/api/vision-proof.js`.
- [ ] Preserve those fields in signed proof trimming in `functions/lib/visionProof.js`.
- [ ] Extend existing vision proof tests to assert weighted fields survive sign and verify.
- [ ] Run `node --test tests/llamaVision.test.mjs`.

## Milestone 4: Evidence ledger and prompt controls

### Task 7: Upgrade prompt eligibility to weighted evidence

**Files:**

- Modify: `functions/lib/readingQuality.js`
- Modify: `tests/narrativeBuilder.promptCompliance.test.mjs`

- [ ] Change `evaluateVisionInsightPromptEligibility()` to prefer `symbolVerification.weightedMatchRate` over `matchRate`.
- [ ] Keep the existing `VISION_PROMPT_SYMBOL_MATCH_FLOOR` env name but compare against the weighted score when present.
- [ ] Raise the default weighted floor to `0.65` when `weightedMatchRate` is present, while preserving the old `0.45` default for legacy `matchRate`-only proofs unless env overrides are set.
- [ ] Add suppression reason `weak_weighted_symbol_verification` for weighted failures.
- [ ] Keep backward compatibility for old proofs that only contain `matchRate`.
- [ ] Add tests for high card confidence plus low weighted symbol score becoming telemetry-only.
- [ ] Run `node --test tests/narrativeBuilder.promptCompliance.test.mjs`.

### Task 8: Expand visual evidence packets into the ledger contract

**Files:**

- Modify: `functions/lib/visionEvidence.js`
- Modify: `tests/visionEvidence.test.mjs`

- [ ] Emit:

```js
{
  cardKnowledge,
  expectedRiderSymbols,
  verifiedUploadedEvidence,
  uncertainSymbols,
  forbiddenClaims,
  evidenceMode,
  visualClaimMode
}
```

- [ ] Set `visualClaimMode`:

```js
if confidence >= 0.85 and weightedMatchRate >= 0.65 => 'verified_visual_evidence'
if confidence >= 0.85 and weightedMatchRate < 0.65 => 'card_level_only'
if confidence < 0.7 => 'ask_for_confirmation'
else => 'limited_visual_evidence'
```

- [ ] Use the same effective weighted threshold as `evaluateVisionInsightPromptEligibility()` instead of duplicating a hardcoded value when env overrides are supplied.
- [ ] Deduplicate visual details against verified symbols so VLM free-text does not create false proof.
- [ ] Mark unverified visual details as `uncertainSymbols`, not `verifiedUploadedEvidence`.
- [ ] Test telemetry-only, card-level-only, and verified modes.
- [ ] Run `node --test tests/visionEvidence.test.mjs`.

### Task 9: Render the three knowledge levels in prompts

**Files:**

- Modify: `functions/lib/narrative/prompts/visionValidation.js`
- Modify: `tests/narrativeBuilder.promptCompliance.test.mjs`

- [ ] In `buildUploadedVisibleEvidenceSection()`, render:

```md
Traditional card knowledge:
Expected Rider symbols:
Verified uploaded-image evidence:
Uncertain image details:
Visual-claim constraints:
```

- [ ] Add explicit language: `Do not say "I see" for symbols outside Verified uploaded-image evidence.`
- [ ] Include weighted symbol score in the diagnostics section when present.
- [ ] Keep mismatched card names masked.
- [ ] Add tests ensuring mismatched evidence does not leak card names or visual details.
- [ ] Add tests ensuring low weighted match produces card-level interpretation language, not visual evidence language.
- [ ] Run `node --test tests/narrativeBuilder.promptCompliance.test.mjs tests/visionEvidence.test.mjs`.

## Milestone 5: Hybrid vision fusion and confidence calibration

### Task 10: Add deterministic calibrated router

**Files:**

- Modify: `shared/vision/hybridVisionPipeline.js`
- Create: `tests/visionFusionRouter.test.mjs`

- [ ] Export `buildVisionRouterFeatures(clipResult, llamaResult)`.
- [ ] Feature shape:

```js
{
  clipScore,
  llamaScore,
  llamaOk,
  clipScoreGap,
  llamaAgrees,
  symbolWeightedMatch,
  orientationKnown,
  imageQualityScore
}
```

- [ ] Export `routeVisionDecision(features)` with transparent initial rules:

```js
if llamaAgrees and symbolWeightedMatch >= 0.65 => calibratedConfidence = max(clipScore, llamaScore) + 0.08 capped at 0.99
if !llamaAgrees and symbolWeightedMatch >= 0.75 and clipScoreGap >= 0.12 => choose clip
if llamaOk and !llamaAgrees and llamaScore >= 0.9 and clipScore < 0.65 => choose llama but mark needsReview
if !llamaOk => choose clip and mark Llama fallback
else choose clip and lower calibratedConfidence by 0.1
```

- [ ] Emit `routerFeatures`, `calibratedConfidence`, `decisionReason`, and `abstain`.
- [ ] When the routed card differs from the card that produced `symbolVerification.verifiedCard`, clear the symbol proof or mark it telemetry-only; never apply CLIP symbol evidence to a different Llama-selected card.
- [ ] Keep `mergeSource` for existing UI and telemetry.
- [ ] Test agreement, disagreement, and failed-Llama fallback.
- [ ] Run `node --test tests/visionFusionRouter.test.mjs tests/llamaVision.test.mjs`.

### Task 11: Preserve router metadata through proof and metrics

**Files:**

- Modify: `functions/api/vision-proof.js`
- Modify: `functions/lib/visionProof.js`
- Modify: `scripts/evaluation/runVisionConfidence.js`
- Modify: `scripts/evaluation/computeVisionMetrics.js`

- [ ] Sanitize `routerFeatures`, `calibratedConfidence`, `decisionReason`, and `abstain`.
- [ ] Add a `--backend-id` CLI flag to `scripts/evaluation/runVisionConfidence.js` and use `hybrid` for router/calibration evals; the current script hardcodes `clip-default`, which cannot emit router metadata.
- [ ] Persist router metadata in vision confidence JSON.
- [ ] Compute high-confidence error rate using `calibratedConfidence ?? confidence`.
- [ ] Add Brier score for single-label correctness.
- [ ] Add expected calibration error with 10 bins.
- [ ] Run `node --test tests/llamaVision.test.mjs tests/visionMetricsWeightedGrounding.test.mjs`.

## Milestone 6: Evaluation, benchmarks, and active learning

### Task 12: Add hard-negative and absence benchmark manifests

**Files:**

- Create: `data/eval/rws-hard-negatives/README.md`
- Create: `data/eval/rws-symbol-absence/README.md`
- Modify: `scripts/evaluation/computeVisionMetrics.js`
- Create: `tests/visionMetricsWeightedGrounding.test.mjs`

- [ ] Define JSONL item shape:

```json
{
  "eval_id": "rws_absence_0031",
  "image": "three_of_swords_clean.jpg",
  "expected_card": "Three of Swords",
  "orientation": "upright",
  "absence_negatives": ["animal", "cup", "water"],
  "ideal_absence_answer": "No animal is visible."
}
```

- [ ] Add metrics:

```js
weightedSymbolCoverageRate
highSalienceSymbolRecall
absentSymbolFalsePositiveRate
symbolHallucinationRate
brierScore
expectedCalibrationError
highConfidenceErrorRate
```

- [ ] Keep old metrics in output for backward compatibility.
- [ ] Compute absent-symbol false positives from `symbolVerification.absenceDetections` or explicit absence benchmark rows, not from generic `unexpectedDetections`.
- [ ] Test that weighted metrics are appended under `metricsByDeck[deckStyle]`.
- [ ] Run `node --test tests/visionMetricsWeightedGrounding.test.mjs`.

### Task 13: Gate weighted grounding

**Files:**

- Modify: `scripts/evaluation/verifyVisionGate.js`
- Modify: `package.json`

- [ ] Add env thresholds:

```js
VISION_MIN_WEIGHTED_SYMBOL_COVERAGE=0.65
VISION_MIN_HIGH_SALIENCE_RECALL=0.8
VISION_MAX_ABSENT_SYMBOL_FALSE_POSITIVE_RATE=0.02
VISION_MAX_HIGH_CONFIDENCE_ERROR_RATE=0.05
```

- [ ] Fail `gate:vision` when weighted grounding or calibration is below threshold.
- [ ] Add targeted test script:

```json
"test:vision-grounding": "node --test tests/rwsEvidenceOntology.test.mjs tests/rwsCaptionDataset.test.mjs tests/symbolDetectorWeightedScoring.test.mjs tests/visionEvidence.test.mjs tests/visionFusionRouter.test.mjs tests/visionMetricsWeightedGrounding.test.mjs"
```

- [ ] Run `npm run test:vision-grounding`.

### Task 14: Add active-learning failure labels

**Files:**

- Modify: `scripts/evaluation/processVisionReviews.js`
- Modify: `scripts/evaluation/computeVisionMetrics.js`

- [ ] Add accepted labels:

```js
bad_crop
reversed_orientation_missed
similar_card_confusion
symbol_hallucination
deck_variant_unsupported
low_light_or_blur
absence_false_positive
calibration_overconfidence
```

- [ ] Export reviewed failures to `data/evaluations/vision-active-learning.jsonl`.
- [ ] Extend the review CSV producer in `computeVisionMetrics.js` with optional columns for failure label, weighted score, hallucinated symbols, visible symbols, and action so `processVisionReviews.js` has structured data to export.
- [ ] Include expected card, predicted card, confidence, weighted score, hallucinated symbols, visible symbols, and action.
- [ ] Preserve existing CSV review behavior.
- [ ] Run `node scripts/evaluation/processVisionReviews.js --help` and one fixture-backed test if the script already has test coverage.

## Milestone 7: Image quality and rectification metadata

### Task 15: Add non-invasive image-quality metadata first

**Files:**

- Modify: `shared/vision/tarotVisionPipeline.js`
- Modify: `functions/api/vision-proof.js`
- Modify: `functions/lib/visionProof.js`
- Modify: `scripts/evaluation/runVisionConfidence.js`

- [ ] Add lightweight `imageQuality` metadata without changing image pixels:

```js
{
  cardRectFound: null,
  perspectiveSkew: null,
  blurScore: null,
  glareScore: null,
  occlusionScore: null,
  borderVisible: null,
  usableForSymbolDetection: true
}
```

- [ ] Pass metadata through proof, confidence JSON, router features, and metrics.
- [ ] Do not implement OpenCV-style rectification in this PR unless there is an existing image-processing dependency. Keep the contract ready for later native/browser preprocessing.
- [ ] Add a follow-up issue in the plan for actual card rectangle detection and perspective correction.

## Milestone 8: UI research surface

### Task 16: Surface weighted grounding in the vision validation panel

**Files:**

- Modify: `src/components/VisionValidationPanel.jsx`

- [ ] Show flat match rate and weighted match rate side by side.
- [ ] Show high-salience missing symbols separately from low-salience missing symbols.
- [ ] Mark absent-symbol false positives as a review warning.
- [ ] Display `absenceDetections` separately from generic extra objects so reviewers can distinguish expected-symbol misses from true absent-symbol hallucinations.
- [ ] Keep this in research/validation UI only; do not add user-facing spiritual interpretation copy here.

## Milestone 9: End-to-end verification

### Task 17: Targeted tests

**Files:**

- Existing and new tests listed above.

- [ ] Run:

```bash
npm run test:vision-grounding
```

- [ ] Run:

```bash
node --test tests/llamaVision.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs
```

- [ ] Run:

```bash
npm run gate:vision
```

- [ ] Run:

```bash
npm run gate:narrative
```

### Task 18: Training-data smoke generation

**Files:**

- `data/training/rws_multimodal_captions.jsonl`

- [ ] Run:

```bash
npm run training:captions:rws
```

- [ ] Confirm the generated JSONL contains 78 upright rows or 156 rows when `--orientation both` is used.
- [ ] Confirm The Fool row includes cliff, dog, white rose, and hard negatives.

## Release behavior after implementation

After these tasks, the runtime behavior should be:

- Card identity still comes from the selected spread as the authoritative reading input.
- Uploaded image evidence can enrich the prompt only when card matching and weighted symbol verification clear eligibility.
- Low-symbol-confidence uploads remain telemetry-only or card-level-only.
- Mismatched uploads never leak off-spread card names into prompts.
- The LLM receives explicit constraints separating traditional meanings from verified uploaded visual evidence.
- Training data no longer teaches only filenames; it teaches card identity through Rider-specific visual symbols and hard negatives.
- Vision gates fail on overconfident wrong answers, weak high-salience grounding, and absent-symbol false positives.

## Scope deliberately deferred

The following are intentionally not in the first implementation pass:

- Actual perspective correction and card-rectangle detection, because the checkout does not show an existing image-processing dependency suitable for that work.
- A learned logistic-regression or gradient-boosted fusion model, because the repo first needs stable router features and labeled eval outputs.
- New public user-facing UX for evidence explanations, because the first pass should stabilize backend evidence and research UI before changing reading presentation.

These are follow-up work after the metrics show where the real errors are.
