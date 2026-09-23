# Script guidance

Use Node 24 and native PowerShell on Windows. Script helpers are Node-only;
browser and Worker modules must not depend on filesystem or `process` access.

## Verification and release

- `npm test`, `npm run test:deploy`, and `npm run lint:cloudflare` cover repository,
  deploy-script, and Cloudflare-command contracts respectively.
- Narrative and vision changes require `npm run ci:narrative-check` and/or
  `npm run ci:vision-check`. They write under `data/evaluations`; use a detached
  verification worktree and record the candidate SHA, backend, and flagged samples.
- Use `NARRATIVE_EVAL_BACKEND=local-composer` for local proof when a live provider
  has not been authorized. Preserve thresholds; report unsupported samples and
  failed gates explicitly. A build or focused test is not a full QA gate.
- `npm run deploy:dry-run` previews the release. `npm run deploy` and
  `npm run migrations:apply` affect production; local migrations use
  `npm run migrations:apply:local`. Keep publication and cleanup separate.
- Use explicit staging allowlists in isolated worktrees. Keep unrelated dirty
  files, stashes, historical evidence, and local settings intact.

## Evaluation / training data export

```bash
node scripts/training/exportReadings.js --metrics-source r2 --out readings.jsonl
node scripts/evaluation/exportEvalData.js --days=7
```

Exports may contain personal reading data. Retain them only in the authorized
destination, keep prompt persistence opt-in, and never include local OAuth tokens,
PKCE material, or user identifiers in public verification artifacts.
