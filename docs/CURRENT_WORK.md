# Current local work — November 1, 2026

This is the current index for the approved local integration and the two separate qualification efforts. Earlier reports retain their dated observations. No push, deployment or generated reading was made in this pass.

## Included in this local integration

The qualified integration baseline is `992387127f3fa21f4baba43c86d1f3231667a6bf`. It preserves the histories of the journal performance test (`f8fb1cfc`), cleanup/disposition documents (`a7684e28`), sharp update (`89b79134`), root dependency group (`ac2b0171`) and astro-plugin lockfile updates (`e5770153`). The combined lockfiles equal exactly the three independently qualified dependency changes; no additional resolver upgrades were accepted.

Combined verification: **6,238 root tests pass, 0 fail, 2 skipped; 19/19 journal Chromium tests; 2/2 affected reading-render tests; 45 ephemeris and 43 symbolism tests plus their manual scripts; build, image round-trip and documentation checks pass.** The 1,000-entry journal test retains its original read-count and rendering-time thresholds. Full root suites ran serially.

This closes the small local integration decisions. Publication remains separate. The remote master observed at the start of this pass was `19be91ab`; this local integration is not on that remote revision. No active production version was queried or changed.

## Separate local checkpoints

| Work | Checkpoint | Current decision |
| --- | --- | --- |
| Symbol-scope correction | `fix/symbolic-deficit-grounding-20261101` at `9b92c4a5`, prompt 1.6.12 | Offline-qualified; held outside this integration. The original creative-project unsupported unfinished-plan failure is not cleared by a prompt change. |
| F3b retrieval | `wip/f3b-retrieval-20261101` at `13dd8684`, retrieval source `f264bf74` | Rebased onto the qualified integration baseline, delta preserved. Offline comparison prepared on common prompt 1.6.11; no fresh generated pair. Held outside this integration. |

The narrative correction changes the local symbol projection to `May symbolize: object → meaning`, retaining canonical imagery, interpretations and supplied context. Root: **6,241 pass / 0 fail / 2 skip**; 237 focused passes; established Worker lane 70 passes; prompt assembly 874 fixtures / 2,541 builds; build/lint/docs pass. Fifteen frozen inputs across three provider budgets yield 45 before/after comparisons with only the intended symbol formatting changes; trimming, GraphRAG metadata and scene contracts remain unchanged. The branch's `docs/knowledge-graph/NARRATIVE_SYMBOL_SCOPE_2026-11-01.md` contains the complete source diagnosis and limits.

The independent F3b replay keeps all 50 frozen cases and exactly reproduces prior selected IDs/scores/weak flags in both arms: **7/7 original, 19/19 seen and 12/12 former-holdout positives**, with no new judged false positives or cap/weak-floor regressions. All 46 eligible pairs produce final semantic prompts with GraphRAG retained and exact question bytes: 23 changed-prompt pairs and 23 identical-prompt controls. The former holdout is now seen evidence. The 171 focused checks pass with the combined dependencies. The branch's `docs/knowledge-graph/F3B_COMPARISON_PREPARATION_2026-11-01.md` records the freeze and unchanged relative criteria.

The separate narrative correction is excluded from both F3b arms. Reusing it in a future comparison requires putting it in both arms and freezing a new experiment. Current generation authorization is zero. The prepared fixed five-pair F3b pilot would require 10 readings; the full matrix would require 92 fresh readings because the old narrative baseline's outputs are not reused. Remaining dispatch requires a complete passing blind pilot and authorization to continue. Japanese prose quality alone stays waived.

## Remaining dispositions and known failures

- [PR #121](knowledge-graph/PR121_DISPOSITION_2026-11-01.md): superseded disposition prepared; historical source retained. No GitHub closure performed.
- [Spacefast / PR #109](SPACEFAST_PARKED_2026-11-01.md): parked with its runtime/preview blockers; no new port or remote probe.
- [Dependency deferrals](DEPENDENCY_RECONCILIATION_2026-11-01.md): axe 4.14, Sentry 11, Vite React plugin 6 and tsParticles 4 remain deferred under the recorded failures or compatibility requirements. No assertion was weakened to accept them.
- The legacy `functions/__tests__/telemetry.test.js`, outside the established Worker lane, has four failures reproduced on the unchanged integration baseline: unknown-context diagnostics, two reflection-retention assertions and conflicting deck metadata. They remain open and are not included in passing counts.
- Historical narrative/F3b failed outputs, the stash, recovery refs and parked feature branches remain preserved. Offline/source success is not content, production or device qualification.

## Recovery and evidence

The [completed cleanup record](REPOSITORY_RECONCILIATION_2026-11-01.md) and its verified recovery root remain the baseline; they were not redone. New scoped evidence is in `/home/ubuntu/.local/state/tarot/integration-grounding-20261101T051522Z`: the plan/ledger, source and prompt comparisons, all check receipts including failed first attempts, frozen F3b sources/inputs/protocol, and incremental recovery bundles. Its restored Git mirror uses the previous verified recovery mirror as an explicit alternate; retain that recovery chain together.

The next decision is content evidence: a bounded narrative diagnostic on the exact 1.6.12 checkpoint, and independently whether to authorize the prepared F3b pilot. Neither gate needs another unrelated source correction or a repeated repository cleanup before that decision.
