# Vision evaluation evidence contract

Type: reference
Status: active reference
Last reviewed: 2026-10-01

The reference suite tests image loading and identity mapping. It cannot establish
recognition of physical cards in phone photos: every test image is also a CLIP
reference. Synthetic transformations provide a separate robustness diagnostic;
they are not independent photographs. Keep these results separate from vision
qualification.

## Deployment policy — October 1, 2026

At the owner's direction, independently reviewed photo manifests are no longer
a prerequisite for every deployment. `ci:release-check` always runs the code
checks and live narrative gate. It runs the strict vision gate only when
`VISION_EVAL_MANIFEST_DIR` is configured. Otherwise it explicitly reports vision
qualification as unrun. This changes release policy; it does not change measured
recognition results, annotation eligibility, numerical thresholds, or what counts
as valid vision evidence.

The GitHub CI workflow follows the same policy using the repository variable
`VISION_EVAL_MANIFEST_DIR`. A configured directory must exist in the runner and
contain the required three manifests and images. Invalid configured data or a
failed requested vision check remains fatal. The standalone `ci:vision-check`
and `gate:vision` commands continue to enforce the evidence contract below.

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
within 24 hours, a currently clean source checkout, all 78 card identities, no skipped labels, independently labeled
held-out photos, complete verified symbol/negative annotation coverage, and all
existing quality floors. Unmeasured metrics remain null and fail. Absent-symbol
rates use only samples with negative annotations. High-salience recall uses full
symbol counts; display-list truncation cannot change either metric.

Declared manifest size, declared inference count and actual result count must
agree. A limited diagnostic subset cannot qualify a larger corpus, even when the
retained rows still cover all 78 card identities. Older signed symbol proofs with
no annotation status remain valid signatures but are telemetry-only evidence.

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

NARRATIVE_EVAL_BACKEND=modal-qwen npm run ci:release-check
# Code checks and live narrative gate; reports vision as unrun when its variable is unset.

VISION_EVAL_MANIFEST_DIR=/private/corpus NARRATIVE_EVAL_BACKEND=modal-qwen npm run ci:release-check
# Also opts into strict vision qualification using the supplied corpus.
```

`npm run deploy` and `deploy:skip-migrations` require fresh release checks before
remote changes. `--migrations-only` remains an explicit independent operation;
`--dry-run` does not execute release QA or write production state. Cloudflare
Builds has separate dashboard commands: leave its production build command empty
and set its deployment command to `npm run deploy`. The deployment script runs
release QA once, then migrations, the frontend build, and Worker deployment.
Putting release QA in both commands generates two independent narrative batches
and can reject a release after its first batch passed. Missing
photo data alone no longer blocks release. Required code/narrative checks and
explicitly configured vision checks must still pass.
Changing source alone does not update that external trigger. Direct Wrangler/API
deployments remain privileged operations; this is not an account permission lock.

Every completed narrative evaluation saves its samples, metrics, and review queue
in a unique `data/evaluations/runs/` directory, alongside the latest output files.
These local artifacts are ignored by Git. A failed gate prints the flagged sample
IDs, matching deterministic phrases, detected card names, and evidence directory
to the build log. Preserve that directory when collecting CI artifacts; files in
an ephemeral build environment are not durable storage. The GitHub narrative job
uploads the snapshots even when its gate fails.

`lint:cloudflare` runs a Node script with no shell or ripgrep dependency. Missing
search targets and read errors fail the check instead of being treated as a clean
search.
