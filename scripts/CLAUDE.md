# Script guidance

Use Node 24 and native PowerShell on Windows. Script helpers are Node-only;
browser and Worker modules must not depend on filesystem or `process` access.
Run every command example in this file from the repository root. Use `python3` instead of `python` on systems without a `python` alias.

## Verification and release

- `npm test` runs the root unit suite in `tests/*.test.mjs`; `npm run test:deploy`
  and `npm run lint:cloudflare` cover deploy-script and Cloudflare-command
  contracts respectively. Playwright, accessibility, and `functions/__tests__/`
  suites have separate commands and are not included in that glob.
- Narrative and vision changes require `npm run ci:narrative-check` and/or
  `npm run ci:vision-check`. They write under `data/evaluations`; use a detached
  verification worktree and record the candidate SHA, backend, and flagged samples.
- Use `NARRATIVE_EVAL_BACKEND=local-composer` for local proof when a live provider
  has not been authorized. Preserve thresholds; report unsupported samples and
  failed gates explicitly. A build or focused test is not a full QA gate.
- The checked-in release path is `package.json` → `scripts/deploy.js`.
  `npm run deploy` checks and applies pending remote D1 migrations, then builds
  the frontend and runs Wrangler deploy. `npm run deploy:skip-migrations` builds
  and deploys only, so apply migrations separately. `npm run deploy:dry-run`
  previews the script; production changes require `npm run deploy` or
  `npm run migrations:apply`, while local migrations use
  `npm run migrations:apply:local`. Keep publication and cleanup separate.
- The checked-in `.github/workflows/deploy.yml` also invokes `node scripts/deploy.js`.
  Cloudflare Workers Builds may be configured separately in the dashboard; if its
  build command is plain `npx wrangler deploy`, it bypasses `scripts/deploy.js`
  and its migration step. Confirm the external trigger and build command, apply
  migrations separately, and verify the built commit and active production
  version before the next release.
- Use explicit staging allowlists in isolated worktrees. Keep unrelated dirty
  files, stashes, historical evidence, and local settings intact.

## Evaluation / training data workflows

> **Production-data and external-transmission warning:** Export commands can read production D1, KV, or R2 and write personal reading or evaluation data locally. W&B helpers transmit selected data to the external Weights & Biases/Weave service. Confirm authorization, data classification and redaction, destination project, retention, and secret handling before any export or transmission. Training and index commands write derived artifacts; keep them in authorized locations and out of Git unless reviewed.

```bash
node scripts/training/exportReadings.js --metrics-source d1 --out readings.jsonl
node scripts/evaluation/exportEvalData.js --days=7
python3 scripts/training/trainLoRA.py --deck rws --epochs 10 --batch_size 4
python3 scripts/training/buildVectorIndex.py --deck rws --adapter_path models/adapters/rws
```
