# AI reliability production release — October 7, 2026

The application changes reviewed at `4265424` were published through the normal
local release path. Worker `986fa84d-8ffe-4441-9b60-994248e197d3` was independently
confirmed at 100% traffic after publication at 10:22 UTC. Migrations 0033–0035 are
applied. The earlier [implementation report](2026-10-07-ai-reliability-verification.md)
records the pre-release checks and historical limitations; this update supersedes
its unrun-Claude-QA and pending-migration status.

## Release evidence

- Fresh primary-Claude QA generated all 11 synthetic samples. Every response
  identified `claude-opus-5-5`; story-spine and card coverage were 100%, with zero
  flagged samples. The batch used 79,828 input and 61,505 output tokens.
- The same release invocation passed 2,818 root tests, 36 release/deployment tests,
  264 Cloudflare command checks, and links in 171 maintained Markdown files.
  The frontend build passed in 12.07 seconds.
- A fresh D1 Time Travel bookmark was recorded before migration. Afterward, all
  39 tracked migration checksums matched, all 36 historical tracking entries were
  unchanged, and all 175 original aggregate IDs and captured totals were preserved.
  Journal count and the aggregate sequence were unchanged. Required schema objects
  were present, foreign-key checks had no violations, and D1 `quick_check` returned
  `ok`. The earlier synthetic rehearsal additionally proved preservation of all
  original aggregate fields. No production user rows were exported.
- Twelve production public checks passed: current asset references and matching
  JS/CSS bytes, disabled video capability, retired Hume returning 410, protected
  guest routes returning 401, and guest question suggestions using a local template.
- One synthetic guest reading returned HTTP 200 through `claude-api` in 30.181
  seconds, with no provider errors or safety block. Its accepted attempt identified
  actual model `claude-opus-5-5`, with 4,864 input and 2,576 output tokens.
  Background evaluation identified GLM 5.3, with known token usage and an unblocked
  metrics record. The production runtime credential therefore worked independently
  of the local QA credential.

Fresh sample/metric evidence is retained under the ignored evaluation run
`data/evaluations/runs/2026-10-07T10-21-48.723Z-mq24Bf/`, with an additional copy
and deployment, recovery, public-check and provenance reports under
`/tmp/tableu-ai-reliability-20261007/`. Generated QA files were preserved before
restoring the committed offline fixtures. No secret value was printed or committed.

## Remaining qualification and operational limits

Direct-backend QA does not exercise the production route's 90-second per-provider
deadline or its complete 240-second task budget. The slowest Claude sample took
83.941 seconds, leaving about six seconds of provider headroom; latency variation
can still cause fallback. The single production guest reading verifies the primary
path, not every spread or subscription state.

The new raw evaluation metric has explicit model/source provenance. Existing stored
quality aggregates remain historical NULL cohorts until scheduled aggregation;
their old evaluator identities cannot be reconstructed reliably.

The prior local browser coverage and its limits still apply. No signed-in
production account or real-device audio playback was exercised. Current vision
photo quality and live Clef comparisons remain unqualified; production evaluation
remains on GLM.

This rollout used the supplied funded local Claude key because the available local
Cloudflare credentials could not configure Workers Builds secrets. The default
build trigger still needs its private `ANTHROPIC_API_KEY` configured for future
automatic releases. GitHub jobs remain blocked by an account billing lock; neither
hosted check status substitutes for the independent production evidence above.
No unused production secret was deleted or runtime credential rotated.
