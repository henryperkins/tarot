# Current work — November 10, 2026

This is the current index for master. Earlier reports keep their dated observations.

## Production

Production runs Worker version `9ac98049-7d94-4cc8-9b30-7db2626fdee5`, released from master `42ee4362` and serving all traffic since November 6 at 04:11 UTC. Readings use the OpenAI Responses API first, with `gpt-6-astra` at `high` reasoning effort. The [release record](OPENAI_READINGS_RELEASE_2026-11-06.md) lists its checks, the production variable override, live verification and limits.

Rollback: `3a00b28c-1380-4b96-884b-942737c0ff14` keeps this code with `gpt-5.6-sol` at `xhigh`. `5ac954d1-1f3b-4783-89ce-c77fb56db5ac` returns to the [November 5 release](READING_PANELS_RELEASE_2026-11-05.md) of PRs #136–#138.

Since the November 1 integration below, Wrangler lists six production deployments, each taking all traffic. `db4fb586` was deployed on November 3 at 06:57 UTC; `146f4a51`, `35b897e5` and `5ac954d1` followed on November 5 at 11:58, 16:50 and 23:55; `3a00b28c` and `9ac98049` on November 6 at 03:05 and 04:11. The [reading audio plan](superpowers/plans/2026-11-05-reading-audio-cancellation.md) records the `35b897e5` release. This repository has no release record for the first two.

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

## Local lint and accessibility follow-up

The ignore-only comparison ran both ESLint configs on the same starting checkout, using `eslint.config.js` from `f78880953ecc95609fd01979171bba3853a19752` as the baseline. ESLint listed 1,426 paths before the edit (1,414 owned and 12 artifacts) and 1,414 after (all owned). The sorted relative owned paths matched exactly. `beforeMinusAfter = []`, `afterMinusBefore = []`, and `exactSortedArrayMatch = true`. The two path lists and the comparison are in `~/.local/state/tarot/reading-labels-Xa9Wjy86/`.

The targeted `label-content-name-mismatch` findings are resolved locally with `@axe-core/playwright` and `axe-core` 4.14.0. The setup tests cover current, upcoming, completed, and skipped steps, canvas and responsive layouts, and the quiet and reading-view presentations. The table tests follow setup through empty slots, a face-down deal, a partial reveal, and fully revealed upright and reversed cards. Empty slots include their number and position label in the accessible name. Dealt cards include their position number alongside their state or card details. **Reveal remaining** has the accessible name **Reveal remaining cards**.

The four new cases reproduced the axe violations before the table fix. The local accessibility runs passed 19 Chromium 151.0.7922.34 cases at 1280×720, with handset viewport checks at 320×568 and 390×844, and 3 WebKit 26.5 cases at 390×844 using the iPhone 13 descriptor. The setup-to-table flow ran at 1280×720 and 390×844 in Chromium and 390×844 in WebKit. A separate mounted Chromium fixture exercised the reveal-disabled card branch. See the [accessibility testing guide](../tests/accessibility/README.md).

Diff review reproduced an integration-only failure in the step-navigation regression: the presentation fixture fetched Vite source modules from the Worker's compiled assets and tried to import an undefined URL. The route flow and presentation fixture now run as separate tests. The fixture verifies its mounted navigation/buttons and explicitly skips integration projects. Focused verification passed both Vite tests; integration passed the route flow and reported the expected fixture skip. Evidence is in `/tmp/opencode/reading-label-diff-review/` and `/tmp/opencode/reading-label-fixture-fix/`.

The coupled browser run passed 57 of 58 cases. The reflection test confirmed the card note in the reading request and then timed out waiting for the visual-cue stream with the default flags. Enabling the fixture's visual-cue flags reached the cue-hold assertion, which failed on both the starting and updated checkouts. The root suite passed 6,474 cases with 2 skipped. Lint, documentation links, static accessibility checks, and the local production build passed. The guest smoke passed against that build at 1280×900 and 390×844 in local Chromium.

## Audit regression follow-up — November 10

The four follow-up regressions are fixed locally. Card Collection uses a neutral loading region until both sources settle, then places either the empty notice or populated grid at the same content origin. SavedVisualRecovery owns original subscriptions as well as replay subscriptions, including terminal capability retirement. DeferredReadingContent keeps selected fallback text mounted until selection clears. The audit browser suite recognizes Vite source modules and hashed production chunks and blocks service workers so fault-injection routes cannot be bypassed.

Verification: **6,488 root tests pass, 0 fail, 2 skipped; 79 focused browser checks pass** (25 frontend Chromium, 25 compiled integration Chromium, 19 compiled WebKit, and 5 saved-visual restoration cases per engine). Lint, production build, documentation links and static accessibility checks pass. Browser coverage includes empty/populated collections at 320px, 390px and 1440px in both themes, staggered journal/frequency responses, local-stat fallback, forwards/backwards selection, and failed rendering. The optimized root harness also covers selections spanning the fallback, successful original completion, and original capability responses of 401/403/410 with the gesture chunk blocked. At 390px, content movement is 0px; measured CLS is 0 for empty data and 0.0000062 for populated data.

Rendered review used Chromium 151.0.7922.34: real signed-out API state with synthetic local readings at 390×844/dark, and real local password login verified as Pro/active at 1440×900/light. The reviewer account's actual D1 journal and collection were empty; an additional mocked cloud journal response exercised failed formatting under that real Pro session. Other automated data/authentication and saved-visual backend cases use fixtures. Reviewer sessions were logged out afterward. Screenshots and the coverage record are in `/tmp/opencode/audit-regressions/`.

The final diff review also covered the onboarding/account labels, Gallery WebP renditions, deferred Journal modules, coupled locators, and validation allowlist. The combined candidate passed a fresh root suite with **6,488 passed, 2 skipped, 0 failed**, plus lint, production build, documentation links, static accessibility, and diff checks. Root/build logs and the reviewed patch are in `/tmp/opencode/reading-followup-KZ794j/`.

## Reflection-gesture investigation — November 10

With `VITE_READING_ALIGNER_ENABLED=true` and `VITE_READING_MODEL_ANNOTATIONS=true`, the live reflection case still fails its companion `data-held` assertion; the duplicate-card journal restoration case passes. `GesturePhrase` deliberately routes a single-card cue to the full-card dialog when card inspection is available. The original failure trace and a fresh run both show that dialog, rather than a held companion cue. Default flags separately prevent the visual subscription that the test waits for.

A controlled Chromium continuation at 1280×720 with mocked Pro authentication verified the note in the reading request and accepted cue, the correct card dialog and quoted cue phrase, focus restoration on Escape, and the exact note in both **Your notes** and **Your question and notes**. This investigation made no product behavior change. The existing live test needs an explicit visual-enabled runner and assertions for the current dialog interaction. Its failure log, trace, probe script, and successful probe result are in `/tmp/opencode/reading-followup-KZ794j/`.

## Remaining dispositions and known failures

- The live reflection-gesture E2E case remains open for the runner/assertion maintenance described above.
- The D02 unfinished-plan narrative failure (see above) remains open.
- Two prose repetitions noted in [#138](https://github.com/henryperkins/tarot/pull/138) remain. The local composer's You & Them section names the shared element twice, and amplified Celtic Cross cross-checks restate the shared element.
- [PR #121](knowledge-graph/PR121_DISPOSITION_2026-11-01.md): superseded disposition prepared; historical source retained. No GitHub closure performed.
- [Spacefast / PR #109](SPACEFAST_PARKED_2026-11-01.md): parked with its runtime/preview blockers; no new port or remote probe.
- Sentry 11, Vite React plugin 6, and tsParticles 4 remain deferred under their recorded compatibility requirements. See the [dependency reconciliation](DEPENDENCY_RECONCILIATION_2026-11-01.md).
- The legacy `functions/__tests__/telemetry.test.js`, outside the established Worker lane, has four failures reproduced on the unchanged integration baseline: unknown-context diagnostics, two reflection-retention assertions and conflicting deck metadata. They remain open and are not included in passing counts.
- Historical narrative/F3b failed outputs, the stash, recovery refs and parked feature branches remain preserved.

## Recovery and evidence

The [completed cleanup record](REPOSITORY_RECONCILIATION_2026-11-01.md) and its verified recovery root remain the baseline; they were not redone. The earlier integration evidence is in `/home/ubuntu/.local/state/tarot/integration-grounding-20261101T051522Z`. Its restored Git mirror uses the previous verified recovery mirror as an explicit alternate; retain that recovery chain together.

Each release is a separate owner decision. `npm run deploy` runs fresh QA first and should run from an install that matches the lockfile.
