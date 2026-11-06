# Current work — November 6, 2026

This is the current index for master. Earlier reports keep their dated observations.

## Production

Production runs Worker version `5ac954d1-1f3b-4783-89ce-c77fb56db5ac`, released from master `3d236ab1` on November 5 at 23:55 UTC and serving all traffic. It carries PRs #136–#138 and narrative prompt 1.6.14. The [release record](READING_PANELS_RELEASE_2026-11-05.md) lists its checks, live verification and limits. The rollback target is the previous version, `35b897e5-7962-411a-abd7-4cc40090a874`.

Since the November 1 integration below, Wrangler lists four production deployments, each taking all traffic. `db4fb586` was deployed on November 3 at 06:57 UTC; `146f4a51`, `35b897e5` and `5ac954d1` followed on November 5 at 11:58, 16:50 and 23:55. The [reading audio plan](superpowers/plans/2026-11-05-reading-audio-cancellation.md) records the `35b897e5` release. This repository has no release record for the first two.

## Local master — November 1

Generated readings in this work were owner-authorized calls to the owner's Claude subscription only. Master was pushed to origin on November 1. Nothing was deployed that day: production then ran Worker version `10d052d3`, deployed at 02:48 UTC, which predates prompts 1.6.12/1.6.13 and F3b.

Local master builds on the qualified integration baseline `99238712` and the index commit `307896e7`, which was pushed to origin on November 1 at 06:46 UTC. Two merges follow, pushed with this index:

- **`f8bb013a`** integrates the narrative correction from `fix/symbolic-deficit-grounding-20261101`. Prompt 1.6.12 frames symbol glosses as possibilities. Prompt 1.6.13 keeps closings and topic exclusions from asserting unsupplied status.
- **`7680c2ca`** integrates F3b retrieval from `wip/f3b-retrieval-20261101`. It was rebased onto 1.6.13 with its delta byte-identical; the old head is kept as the local tag `archive/f3b-retrieval-20261101-on-99238712`.

The merged runtime, test and configuration files are byte-identical to the tested F3b tree `7d226594`, so its results apply: root suite 6,277 pass / 0 fail / 2 skipped, 184 focused checks, 70 Worker tests, 874 fixtures / 2,541 prompt builds, build and lint. Only documentation differs.

## Content evidence and decisions

- **Narrative 1.6.13.** Four subscription readings passed REL05 2/2 and D02 1/2. The D02 failure stays open by owner decision as a known narrative failure: the Seven of Swords "incomplete plan" possibility carries into later sections as a claim about the reader.
- **F3b.** Accepted by the owner on November 1 without full pair coverage, on this evidence:
  - All 50 retrieval cases replay with no regressions.
  - The 23 identical-prompt pairs are settled offline.
  - The three changed-prompt pairs with earlier candidate problems (REL01, FRESH03 and FRESH07) showed zero F3b-attributable faults under two blind reviews.

  The other 20 changed pairs were not generated. The batch's only fault was baseline-only (FRESH03's closing) and belongs to the D02 family.
- **Limits.** Japanese prose quality alone stays waived. Offline, source and targeted content results are not production or device qualification.

Records: [qualification status](knowledge-graph/QUALIFICATION_STATUS.md), [symbol scope](knowledge-graph/NARRATIVE_SYMBOL_SCOPE_2026-11-01.md) and [F3b comparison and protocol](knowledge-graph/F3B_COMPARISON_PREPARATION_2026-11-01.md). Private evidence lives under `~/.local/state/tarot/`: `narrative-closing-scope-v1613-20261101T105456Z`, `narrative-v1613-closing-check-20261101T113816Z` and `f3b-comparison-v1613-20261101T124726Z`.

## Earlier local integration (`99238712`)

The qualified integration baseline is `992387127f3fa21f4baba43c86d1f3231667a6bf`. It preserves the histories of the journal performance test (`f8fb1cfc`), cleanup/disposition documents (`a7684e28`), sharp update (`89b79134`), root dependency group (`ac2b0171`) and astro-plugin lockfile updates (`e5770153`). The combined lockfiles equal exactly the three independently qualified dependency changes; no additional resolver upgrades were accepted.

Combined verification: **6,238 root tests pass, 0 fail, 2 skipped; 19/19 journal Chromium tests; 2/2 affected reading-render tests; 45 ephemeris and 43 symbolism tests plus their manual scripts; build, image round-trip and documentation checks pass.** The 1,000-entry journal test retains its original read-count and rendering-time thresholds. Full root suites ran serially. No active production version was queried or changed.

## Remaining dispositions and known failures

- The D02 unfinished-plan narrative failure (see above) remains open.
- Two prose repetitions noted in [#138](https://github.com/henryperkins/tarot/pull/138) remain. The local composer's You & Them section names the shared element twice, and amplified Celtic Cross cross-checks restate the shared element.
- [PR #121](knowledge-graph/PR121_DISPOSITION_2026-11-01.md): superseded disposition prepared; historical source retained. No GitHub closure performed.
- [Spacefast / PR #109](SPACEFAST_PARKED_2026-11-01.md): parked with its runtime/preview blockers; no new port or remote probe.
- [Dependency deferrals](DEPENDENCY_RECONCILIATION_2026-11-01.md): axe 4.14, Sentry 11, Vite React plugin 6 and tsParticles 4 remain deferred under the recorded failures or compatibility requirements. No assertion was weakened to accept them.
- The legacy `functions/__tests__/telemetry.test.js`, outside the established Worker lane, has four failures reproduced on the unchanged integration baseline: unknown-context diagnostics, two reflection-retention assertions and conflicting deck metadata. They remain open and are not included in passing counts.
- Historical narrative/F3b failed outputs, the stash, recovery refs and parked feature branches remain preserved.

## Recovery and evidence

The [completed cleanup record](REPOSITORY_RECONCILIATION_2026-11-01.md) and its verified recovery root remain the baseline; they were not redone. The earlier integration evidence is in `/home/ubuntu/.local/state/tarot/integration-grounding-20261101T051522Z`. Its restored Git mirror uses the previous verified recovery mirror as an explicit alternate; retain that recovery chain together.

Each release is a separate owner decision. `npm run deploy` runs fresh QA first and should run from an install that matches the lockfile.
