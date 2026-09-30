# Vision evaluation evidence contract

Type: reference
Status: active reference
Last reviewed: 2026-09-30

The reference suite tests image loading and identity mapping. It cannot establish
recognition of physical cards in phone photos: every test image is also a CLIP
reference. Synthetic transformations provide a separate robustness diagnostic;
they are not independent photographs. Keep these results separate from release
qualification.

## Dataset inputs

`runVisionConfidence.js --manifest /private/corpus/rws-1909.json` reads a local
manifest. Without it the command uses reference art and marks that fact in the
report. No inference request or model parameter can change the dataset kind.
For the three-deck suite, set `VISION_EVAL_MANIFEST_DIR` to a folder containing
`rws-1909.json`, `thoth-a1.json`, and `marseille-classic.json`.

Manifest structure (illustrative, not a supplied test dataset):

```json
{
  "schemaVersion": 1,
  "id": "physical-deck-photos-v1",
  "kind": "held-out-photos",
  "labelSource": "independent-human",
  "deckStyle": "rws-1909",
  "samples": [
    {
      "id": "photo-001",
      "image": "photos/photo-001.jpg",
      "expected": "The Fool",
      "sha256": "replace-with-the-64-character-sha256-of-the-image"
    }
  ]
}
```

Use canonical RWS card identities even for Thoth/Marseille; recognition output is
mapped into that same identity space. Image paths are local and relative to the
manifest. The harness verifies hashes, unique IDs, duplicate bytes, known labels,
deck selection, and overlap with reference files across all three decks. It fails
before inference on invalid inputs or a missing deck directory. A missing deck
never falls back to RWS images.

Hashes catch exact copies, including renamed reference files and the current
`data/raw_images` copies. They cannot establish that a re-encoded or transformed
reference is a real photograph. A human must review corpus provenance, rights,
labels, and the separation from training/reference data. Keep phone metadata and
incidental personal information out of shared artifacts. Do not commit private
photos as part of this repair.

Synthetic corpora use `kind: "synthetic"` and `labelSource: "synthetic-derived"`.
They remain diagnostic even if their metrics exceed every quality threshold.

## Required annotation work

The current runtime symbol annotations are quarantined. RWS Major Arcana retains
unverified diagnostic queries. Generic Minor Arcana suit/rank templates and RWS
labels applied to other decks are explicitly unsupported. Spatial priors are
unverified; the detector does not assert position verification.

There is no reviewed replacement annotation registry in this change. Supplying
phone photos alone therefore cannot make the symbol gate pass. A follow-up must
create image/deck-specific positive concepts, absence negatives, salience and
audited spatial expectations, independently check them, and connect the reviewed
annotations to the runtime detector. The evaluation must then measure that same
runtime path against held-out image labels. Do not feed the expected card label
into recognition, relabel failed cases from the model's prediction, or mark
existing templates verified without inspection.

The model's raw confidence is not a calibrated probability of correct grounding.
Keep the existing 0.65 weighted floor until labeled measurements justify a
separately reviewed calibration, model replacement or policy change.

## Reports and gates

Version 2 inference reports retain the source revision, whether source was dirty,
dataset kind/hash, input image hashes, expected identities, models, and inference
time. Metrics retain `sourceGeneratedAt`; their own `generatedAt` is only the
aggregation time. Historical version 1 reports remain available but cannot pass
the release gate.

The gate requires the requested deck, the exact committed revision, inference
within 24 hours, all 78 card identities, no skipped labels, independently labeled
held-out photos, complete verified symbol/negative annotation coverage, and all
existing quality floors. Unmeasured metrics remain null and fail. Absent-symbol
rates use only samples with negative annotations. High-salience recall uses full
symbol counts; display-list truncation cannot change either metric.

Review CSVs include symbol failures even when the card identity is correct, and
preserve human verdicts/notes when recomputing. They are triage artifacts, not an
approval mechanism.

Run generated evaluation work in a detached verification worktree so historical
tracked fixtures and the primary checkout remain intact:

```bash
npm run ci:vision-check
# Reference diagnostics run, then the release gate fails for missing evidence.

VISION_EVAL_MANIFEST_DIR=/private/corpus npm run ci:vision-check
# Runs the same recognizer on declared photos. Symbol annotation gaps still fail.

VISION_EVAL_MANIFEST_DIR=/private/corpus NARRATIVE_EVAL_BACKEND=modal-qwen npm run ci:release-check
# Requires all quality checks, plus authorized provider credentials in the environment.
```

`npm run deploy` and `deploy:skip-migrations` require fresh release checks before
remote changes. `--migrations-only` remains an explicit independent operation;
`--dry-run` does not execute release QA or write production state. Cloudflare
Builds has separate dashboard commands: set its production build command to
`npm run ci:release-check` and deployment command to `npm run deploy`. This will
block release while data, credentials, QA capacity or passing evidence is missing.
Changing source alone does not update that external trigger. Direct Wrangler/API
deployments remain privileged operations; this is not an account permission lock.
