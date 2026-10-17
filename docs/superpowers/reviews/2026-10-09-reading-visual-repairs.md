# Reading visual handoff repairs

This repair follows the [Tasks 3–4 review](2026-10-09-reading-visual-job-persistence.md). It addresses all six verified findings plus two timing defects discovered in independent review. Work remains local in `codex/reading-gestures-react-bridge`; no model was enabled, migration applied, or deployment performed.

## Changes and evidence

| Finding | Repair | Regression evidence |
| --- | --- | --- |
| Unverified result ownership | Public start resolves the authenticated owner separately from MCP credentials. Trusted result registration precedes attachment; journal saves cannot manufacture results. Commits compare the owner, complete binding, source and prior ledger. | Foreign/null-owner commits, known-ID claims, deleted owners/results and authenticated start tests. |
| Empty real request context | One shared normalization maps `cardsInfo`, question and individual/general reflections to occurrence-indexed cards, supported edition details and fingerprints. Non-RWS editions remain identity-only. Narrative starts independently of optional visual initialization. | Actual request/save shape equivalence; held initialization does not block narrative; immediate save while initialization is held. |
| Lost or stale cue state | Serialized reservations and commits enforce one request in flight plus one latest pending snapshot. Request registry and recovery epochs reject unknown, cancelled and replaced callbacks. D1 and DO state persist before publication; recovery reconciles a D1 commit preceding DO persistence. | Concurrent observations, repeated callbacks, revision replacement during validation, cancellation, eviction and persistence-before-publication tests. |
| Broken save/restore identity | Registered results retain cues completed before save. Attachments validate the stored journal prose, including deduplication. Replacement archives earlier saved bindings and accepted cues. GET/list return complete snapshots. | Completion-before-save, saved-old-source preservation, deduplication, real journal route tests. |
| Missing application and journal connection | `ReadingContext` retains server result identity through ordinary metadata and narrative completion. The independent hook validates full cumulative snapshots, defers cues ahead of prose, recovers EOF through snapshots, and protects held inspection. Local journals persist public snapshots and private account-scoped resume handles separately; restored reading uses the actual gesture renderer. | Paced/burst/final-only delivery; late, duplicate, foreign and ahead-of-prose cues; held cross-batch return; local pending save/reload/late recovery; cloud pending recovery; reduced-motion handset tests. |
| Orphaned/deleted results | Entry deletion removes references and revokes the final job; concurrent final-reference deletions also revoke. Capability access checks the authoritative D1 result and owner. Account deletion, expiry and source replacement cannot resurrect a removed result. | Real DELETE handler, concurrent deletion, owned/guest deleted-result access, expiry and late-write tests. |

Restored inspection is static with either motion preference, including CSS entrances and transitions. Technical cue-label badges were removed. Optional storage failures retain prose; late updates only patch an existing entry with the same binding.

The independent reviewer reproduced two additional defects and then checked their fixes:

- Before trusted initialization finishes, the visual endpoint returns retryable 503; unknown credentials on an initialized job still return 403. The client retries with bounded backoff.
- Accepted narrative events supply the authoritative source revision. A replacement of a buffered suffix now invalidates old cues even when the rendered prefix still matches; reconnects can adopt the current revision without inferring it from partial text.

## Configuration and rollout boundary

The visual adapter now supports an explicitly configured Workers AI binding. Both `VISUAL_CUE_PROVIDER=workers-ai` and `VISUAL_CUE_MODEL=<chosen model>` are required. `VISUAL_CUE_TIMEOUT_MS` defaults to 30,000 and caps at 60,000. Tests stub the binding; there were no inference calls. Missing/unsupported configuration fails closed and never falls back to the reading provider. The reading model's prompt remains unchanged.

The journal gesture wrapper requires `VITE_READING_GESTURES=true`; the existing live reading gesture opt-in remains unchanged. Default production presentation remains off. Migration `0036_reading_visual_results.sql` is still an unapplied feature-branch migration, updated in place before any release. Local isolated database tests apply it.

This repairs the reviewed runtime defects; it does **not** qualify the entire production plan. Outstanding rollout work is explicit:

- Select and qualify an independent visual model against unchanged reading-only outputs, including actual latency and semantic misses. Historical joint-generation timing is not evidence for this pipeline.
- Add the planned bounded re-annotation workflow when a guest capability has expired or a visual attachment could not be established. Current expiry/offline behavior preserves prose and cached cues; it does not regenerate the narrative or falsely promise later uncached cues. Valid pending capabilities and owned pending cloud entries do resume.
- Complete the remaining separated-pipeline corpus/device cases, including translated identity fallback and unknown editions through the actual transport. Existing deck/language renderer tests remain separate evidence.

Task 4's complete fallback workflow and Task 5's live qualification therefore remain open in the plan, even though the reviewed ownership, lifecycle and application-wiring defects are repaired.

## Verification

The [server acceptance report](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/server-repaired.json) passes **9/9** and the [persistence report](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/persistence-repaired.json) passes **4/4**. These use deterministic annotation adapters and isolated state/databases, with actual job, ledger, save and deletion code. They do not measure live model latency.

Root Node suite: **3,197 passed**. Production Vite build passed. ESLint passed with zero warnings across all **48 changed JavaScript paths**. Maintained Markdown checking passed for **180 files**; relative links in the two new review records were also checked directly. `git diff --check` passed.

The final [browser report](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/browser-repaired.json) records **51 passed, zero failed** across the configured desktop and phone projects. Browser checks use mocked auth/network and real React context/renderers; service workers are blocked so requests cannot bypass fixture interception. Pending local save/reload, cloud restore, static revisit with both motion preferences, independent transport, source replacement and held cross-batch inspection passed.

Initial failures caught actual missing subscription and restored CSS animation defects. One broad run was disrupted by Vite hot replacement while application fixes were being saved; the affected lifecycle case passed in isolation. Another run passed 50/51 with a missing restored cue; that test passed unchanged in three isolated repeats. Its fixture connection check could count a pre-reload socket, so the harness now waits for an active connection accepted after reload and provides a cumulative GET snapshot. The failed timing was not captured directly. The final 51-test run passed after that synchronization fix, with application files held steady.

Commands from the worktree root:

```sh
npm test
npm run build
node scripts/evaluation/evaluateVisualCueHandoff.mjs --output output/reading-motion/evidence/visual-handoff-2026-10-09/server-repaired.json
node scripts/evaluation/evaluateVisualCuePersistence.mjs --output output/reading-motion/evidence/visual-handoff-2026-10-09/persistence-repaired.json
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs
npm run docs:check
```

No repository-wide narrative/vision generation gate, paid API, production migration, real-account browser session or deployment was run. The independent source/runtime review used bounded probes and confirmed its two additional repairs with five focused checks.
