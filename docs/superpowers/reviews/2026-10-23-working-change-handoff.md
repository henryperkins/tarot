# Working-change handoff — 23 October 2026

This checkpoint prepares the existing working changes for continuation in another environment. It is based on remote `master` at `be78c9a4d2370102a2ae0d9b295d28d426d4a828`, including the deployed reading-context remediation. The user authorized committing and pushing the working changes after the provider investigation.

The application changes harden existing-question refinement: preserve literal timing, Unicode, people, perspective and constrained goals; return the exact original when a proposed edit fails the conservative guard; distinguish consumed but rejected suggestions in inference telemetry; and explain preserved wording accurately in the coach. The new pure helpers and route regressions are included. The [coach review](2026-10-23-coach-meaning-preservation.md) records the earlier implementation and six-case live sample with its qualification limits.

The pending design configuration, five historical Impeccable critiques, mobile-card review, coach plan/specification, and plugin-package review are also included. Their source links are portable. References to screenshots and raw local evidence that are not bundled are explicitly marked as local artifacts. Two other remediation plans were already identical in remote `master`.

The [provider diagnosis](../../reviews/2026-10-23-provider-diagnosis/README.md), [sanitized evidence](../../reviews/2026-10-23-provider-diagnosis/evidence.json), [original live-reading review](../../reviews/2026-10-23-provider-diagnosis/LIVE_READING_REVIEW.md), and [prior provider errors](../../reviews/2026-10-23-provider-diagnosis/prior-provider-errors.json) are now in Git. These are dated evidence snapshots. Provider diagnostic/retry repairs have **not** been implemented, and no provider has been restored or freshly qualified by this checkpoint.

## Verification for publication

Fresh local verification on the combined candidate passed:

- Root suite: **5,427 passed, two skipped, zero failures** (5,429 total).
- Repository ESLint: passed.
- Maintained documentation link check: **206 Markdown files**, all local links resolve.
- Additional check of every staged Markdown link: passed, including historical reviews excluded from the maintained-document checker.
- Frontend production build: passed.
- Staged whitespace check and credential-pattern scan: passed.

All nine application/test files match the original working copies byte-for-byte. The checkpoint contains 25 files. No new live model evaluation or deployment is part of this handoff.

The first root test invocation passed 5,425 tests and skipped two; two deterministic prompt-qualification tests refused inherited provider credentials. The complete suite then passed with those variables removed from the test process. This guard is intentional and no application change was needed. Both run logs are retained in the recovery directory below. In an environment with provider credentials exported, use:

```sh
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \
  -u MODAL_PROXY_TOKEN -u WANDB_API_KEY -u AZURE_OPENAI_API_KEY npm test
```

## Local-only material

Browser snapshots under `.playwright-cli/`, conversation/session transcripts, historical plugin ZIPs, and temporary plugin-review output remain on the original host. Credentials, environment files, and browser session state are excluded from Git. These files are not needed to run the application or its unit tests.

Before integration, all 92 dirty/untracked files were archived and the archive contents were verified against their SHA-256 hashes. Integration and verification use an isolated checkout; the primary checkout, its index, and its existing work remain preserved. The recovery archive is local to the original host at `/home/ubuntu/.codex/artifacts/tarot-working-handoff-20261023T205524Z/primary-recovery.tar.gz`.

For the next environment, fetch `origin/master`, install the locked dependencies with `npm ci`, and start with the provider diagnosis above. The first remaining provider task is safe structured error classification and retry handling, followed by a separately bounded live diagnostic run.
