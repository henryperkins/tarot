# AI reliability verification — October 7, 2026

Implemented on `codex/ai-reliability-20261007`, based on `c5139fe`, in the isolated
worktree `.worktrees/ai-reliability-20261007`. The original checkout remains at
`2406ed1` with its unrelated changes preserved. This report describes local
implementation and verification, not production deployment.

## Changes

- Server-controlled photo backend and atomic daily/concurrent safeguards for photo
  checks, question suggestions and journal summaries. Released requests restore
  the completed-operation allowance but retain evidence for independent daily and
  rolling-minute attempt caps.
- Hume retired; saved preferences migrate to Aura. One server narration covers up
  to 64,000 characters, synthesized in ordered pieces. Failures/cancellation
  release its allowance. Word Sync uses separate token safeguards and is not
  represented as precisely monthly metered speech.
- Disabled card video is hidden using server availability and tier. FLUX timeouts
  do not start overlapping uncancellable retries.
- Shared delivery safety for JSON/SSE, narrower everyday wellbeing triggers, and
  typed retryable evaluator outages with allowance refunds. Missing/malformed
  scores cannot be coerced into real scores. Hard deadlines also cover bindings
  that ignore cancellation.
- Provider task budgets, bounded short answers, body/tool cancellation, rejected
  incomplete Responses output and explicit `store:false`.
- Logical provider-attempt records, returned model identity, known/partial/unknown
  usage, evaluator-separated quality aggregates and coach provenance. Canned
  fallback readings do not trigger coach extraction.
- Import-safe sample generation; release QA defaults to primary Claude. Clef
  qualification tooling is dry by default, with a labeled synthetic corpus and a
  hard live-call cap. Production GLM remains unchanged.

See [implementation details](../ai-reliability.md),
[feature safeguards](../ai-feature-safeguards.md),
[narration safeguards](../narration-safeguards.md),
[inference provenance](../inference-provenance.md), and
[Clef qualification](../clef-qualification.md).

## Evidence

| Check | Result |
| --- | --- |
| Root unit suite with outbound network denied | 2,816 passed; no failures/skips |
| Additional functions safety/evaluation/telemetry tests | 80 passed |
| Deploy/release command tests | 34 passed |
| Independent review after corrections | 270 tests passed; no unresolved material findings |
| Production frontend build | Passed, 11.72 seconds |
| Maintained documentation links | Passed |
| Cloudflare command checks | Passed |
| Real Chromium browser | Guest and authenticated Pro desktop/mobile passed; Free/Plus explicitly mocked |
| WebKit settings only | Real guest/Pro and mocked Free/Plus passed, desktop/mobile |
| Controlled browser quota/error fixtures | Chromium and WebKit desktop/mobile passed |
| Safety retry browser fixtures | Four Chromium viewport/theme cases passed |

Browser work used an isolated local Worker at `localhost:8787`, a copy of only
the local reviewer account row, no provider credentials or AI binding, and real
login for the Pro lane. Inference data was synthetic/intercepted. The real local
503 narration error was exercised. Sessions were logged out afterward.
WebKit real-session reading transport could not be qualified with the local SSE
fixture; successful mocked WebKit checks do not establish that lane or real-device
speech/audio playback.

All new/changed implementation lint findings were resolved. Seven React lint
errors in existing AccountPage/PreferencesContext code also reproduce in the
unchanged base. They remain a disclosed whole-file lint limitation.

The independent review reproduced and prompted fixes for repeated failed-call
spending, null-score handling and noncooperative evaluator timeouts. Additional
cancellation and browser checks caught stuck narration cancellation and a stale
voice-enable callback. The final unit count includes the resulting regressions.

## Release limits and remaining actions

No external inference was performed during this implementation. No production
migration, deployment, shared-branch push or secret deletion was performed.

- Fresh primary-Claude QA is unrun: `ANTHROPIC_API_KEY` is absent from the local
  shell and known local configuration. Configure the private build secret and run
  one recorded live narrative gate before rollout. Existing saved narrative gates
  pass, but use nine April 24 OpenAI samples and do not qualify current Claude.
- The vision gate fails its evidence requirements: current independently labeled
  held-out photos and current-source inference evidence are unavailable. Photo
  recognition accuracy and symbol quality remain unqualified; do not describe the
  mocked route checks as model-quality evidence.
- Clef has no live comparison result and is not qualified or activated.
- Apply migrations 0033–0035 through the reviewed release path. They were tested
  locally with SQLite, including concurrency and historical aggregate preservation;
  validate against a representative production snapshot before the aggregate-table
  rebuild. Rollout needs subsequent active-version and live behavior verification.
- Attempt telemetry is best effort and does not itemize SDK retries or reconstruct
  unknown vendor charges. Word Sync direct-browser synthesis remains bounded by
  token issuance safeguards rather than exact narration accounting.
