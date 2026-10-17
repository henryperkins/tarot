# Reading bridge isolation, configuration gates and master integration

The user authorized the first three integration steps while requiring the live
beta to keep running. All edits and verification took place in separate managed
worktrees. The original bridge worktree, its source files and its beta processes
on ports 8787/5175 were preserved.

## Branches and commits

- `codex/reading-visual-integration-20261009`, in
  `/home/ubuntu/.codex/worktrees/a10e/tarot`, contains the visual pipeline and a
  Claude-only beta runner.
- `codex/codex-subscription-provider-20261009`, in
  `/home/ubuntu/.codex/worktrees/d970/tarot`, adds the Codex provider separately
  over the integrated visual work. Codex remains an explicit opt-in.
- `64b8648`: Workers-compatible Claude redirect rejection.
- `d42d3b6`: isolated Claude development runner and server privacy policy.
- `f3424f2`: independent visual jobs, persistence/restoration and configuration
  gates, including the original saved evidence.
- `76d1287`: merge of master `b5ba16f`, resolving all six conflicts while retaining
  master's auth/journal lifecycle and narration-provider fixes.
- `af5d0c5`: explicit visual configuration in existing source-identity fixtures.
- `53e4181`: visual reconnect fixture waits for the new active connection.
- `2a5aa8d`: separate Codex provider and streaming implementation; `b6b8575`
  carries the reconnect test correction onto that branch.

## Configuration behavior

New visual jobs require the Durable Object binding, `VISUAL_CUE_PROVIDER=workers-ai`,
a nonblank independent model and a callable Workers AI binding. Missing, partial
or unsupported configuration starts the narrative without visual source hashing,
registration, initialization or capability issuance. The default Worker config
does not select a visual model.

The browser requires the existing development gesture opt-in for live visual
subscriptions, session resume, journal polling and private resume writes. Prose
and cached annotations remain saveable. Configured pending cloud/local restores
retain their independent completion path.

## Verification record

Evidence and the owner-only recovery snapshot are under
`/tmp/bridge-remediation-recovery-20261009-6fxkwwo1/`. The snapshot preserves 132
tracked/untracked paths; browser session artifacts were excluded from commits.
Normal-route geometry checks rewrote four historical output files in the isolated
checkout. Their fresh artifacts were preserved separately, then the historical
files were restored so prior evidence retains its original provenance.

- Integrated visual branch: 3,280 root Node tests passed, zero failures/skips.
- Codex branch: 3,340 passed, zero failures, two opt-in skips. The two installed
  CLI isolation checks also passed separately using controlled local endpoints.
- Changed-source lint: 194 JavaScript paths on integration; 28 provider paths.
- Production frontend builds and Worker bundle dry-runs passed on both branches.
- Controlled independent handoff 9/9 and persistence 4/4 passed. These use
  deterministic responses and isolated state/database fixtures.
- Normal-reading browser lane passed 10/10 across desktop and emulated phone.
- The final bridge browser lane passed 51/51; nine focused auth-route/journal
  lifecycle checks and two disabled-gesture regressions bring the controlled
  browser total to 72 passing checks.
- Disabled-gesture browser regressions passed 2/2 for guest and mock-Pro states
  after both reproduced unwanted subscription requests before the fix.
- Browser coverage uses controlled transport/authentication and real React
  components; phone coverage is emulation. Test API proxies targeted an inactive
  loopback port, so unmatched requests could not reach the live beta.
- Maintained documentation links passed: 181 integration, 182 provider files.

The first full bridge browser run passed 50/51. The source-revision reconnect case
passed three unchanged repeats. Its fixture counted an intercepted HTTP request
before the new SSE connection reached the fixture server, allowing cue delivery
to a stale socket. The test now waits for a connection accepted after the revision
change. This is a fixture synchronization correction; no runtime behavior was
changed to make that case pass. The final full bridge run passed 51/51. Nine
focused auth-route and journal lifecycle checks also passed after the master
merge. The disabled-gesture checks passed again on the final application source.

The full `npm run ci:narrative-check` passed on the Codex branch's tested
application source (`2a5aa8d`; the later `b6b8575` changes only the reconnect test).
Its 11 generated readings used the owner's local Claude Code subscription with
`claude-opus-5-5` and `xhigh`, with completion-model matching enforced. Gateway and
paid API credentials were removed from the child environment. Spine pass rate,
average card coverage and all four rubric averages were 100%; all issue counts
and flagged samples were zero. Prompt assembly checks passed. This qualifies the
configured Claude narrative path, not live Codex output or the independent visual
model. The log and generated run artifacts were preserved outside Git, and the
three tracked evaluation outputs were restored to their pre-QA contents.
The generated fixtures used the Pro tier. Semantic retrieval was requested but
embeddings were unavailable; zero samples used embedding-based scoring.

Final preservation checks compared the original bridge HEAD, complete Git status
and all 132 snapshotted file hashes/modes. The HEAD and 130 files were unchanged.
Concurrent work updated the two existing bridge/handoff plans and added
`2026-10-09-reading-cue-model-qualification.md` in the original worktree. Those
documentation changes were left in place and preserved separately in
the recovery folder; they were not absorbed into this integration. Original
application/configuration files were unchanged, and the beta listeners retained
their original processes (`workerd` 217177 on 8787 and `MainThread` 217299 on
5175). Both integration branches contain master `b5ba16f`; the remote master and
bridge tips remained unchanged. The Codex branch was brought forward to include
this verification record and the integration branch's test correction, with no
additional application changes.

## Remaining rollout work

Expired/failed-attachment re-annotation, measured live streamed cue adoption,
independent visual-model corpus qualification, physical-device and screen-reader
coverage remain open. Controlled browser checks do not establish those results.
Migration 0036 and the Worker Durable Object migration are committed feature
changes; no production migration or deployment was performed. These branches
remain local, and the live beta continues to use its original uncommitted source.
