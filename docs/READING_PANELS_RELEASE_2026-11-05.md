# Reading panels release — November 5, 2026

Master `3d236ab139d9ca11b793ec34ddff8333f3fe3937` is in production as Worker version `5ac954d1-1f3b-4783-89ce-c77fb56db5ac` (version 1258). It has served all traffic since November 5 at 23:55 UTC. The owner authorized the merges, the release and one unchanged rerun of release QA. The previous version, `35b897e5-7962-411a-abd7-4cc40090a874`, is the rollback target; its release is recorded in the [reading audio plan](superpowers/plans/2026-11-05-reading-audio-cancellation.md).

## What shipped

Three pull requests were merged into master, each pinned to its reviewed head. Together they change 22 files from the previous production source, none of them vision code.

| PR | Merge commit | Change |
| --- | --- | --- |
| [#136](https://github.com/henryperkins/tarot/pull/136) | `300e7fc9` | Reading Inputs Used shows a neutral **Not needed** row, not a warning, when saved memories were checked and none applied. Spread Insights' Symbol Cue lists symbol meanings instead of repeating the dominant suit and element. Display only. |
| [#137](https://github.com/henryperkins/tarot/pull/137) | `0562b483` | GraphRAG telemetry reports `no_patterns_detected` again for spreads without patterns, and real retrieval failures get their own `retrieval_error` code. Prompt text is unchanged. |
| [#138](https://github.com/henryperkins/tarot/pull/138) | `3d236ab1` | Spread-analysis prose ends card meanings and elemental descriptions as sentences and describes a shared element once. Reading prompt 1.6.14. |

## Release QA

The release ran the normal entrypoint, `npm run deploy`, from a clean detached worktree at `3d236ab1`. Before it, `npm run deploy:dry-run` and Wrangler's packaging dry run passed. Narrative generation used the owner's Claude subscription (Opus 5.5, `xhigh`). No paid narrative API fallback or gate waiver was used.

**First attempt: stopped before production.** QA passed the root suite, deployment tests, Cloudflare command validation and documentation links. It then failed the narrative gate on one deterministic-language finding. The `five-card-creative-project` sample said "…this card suggests showing them the plans before the work is set in stone." No migration or upload started. The phrase describes a window that is still open, not a fixed outcome. The sample's complete Claude request is identical by SHA-256 at `3e55290b` and at `3d236ab1`, so the three merges did not change what the model was asked. The owner chose an unchanged rerun. [#139](https://github.com/henryperkins/tarot/pull/139) exempts this use of the phrase in the evaluator.

**Rerun: passed.**

| Release check | Result |
| --- | --- |
| Root tests | 6,409 passed, 2 skipped, 0 failed. |
| Deployment tests | 74 passed, 0 failed. |
| Cloudflare command validation | 591 files passed. |
| Documentation links | Passed. |
| Narrative qualification | 11 samples generated, 0 flagged. Story spine, card coverage and all four rubric scores were 100%. |
| Prompt assembly | 874 fixtures, 2,541 provider builds, 30 partial pairs, 10 complete triads, 525 canon/deck projections and 12 boundaries passed. |
| Production migrations | Already applied; this release has none. |
| Settings preservation | The deploy script verified that dashboard variables, secrets and monitoring settings were preserved. |
| Vision qualification | Not run, because `VISION_EVAL_MANIFEST_DIR` was unset. |

## Live verification

- **Version and settings.** Wrangler shows `5ac954d1` at 100% from 23:55 UTC. Its compatibility date (`2025-11-24`) and flags (`nodejs_compat`, `enable_request_signal`) are unchanged. Its 109 bindings have the same names and types as the previous version's: 35 secrets, 62 plaintext variables, and 12 resource bindings for AI, assets, version metadata, D1, email, four KV namespaces, R2 and two Durable Object namespaces.
- **Assets.** All 106 built JavaScript and CSS files are served byte-identical to the release build, by SHA-256. The served index matches the build after removing the one script Cloudflare injects.
- **Guest UI.** The deploy script's Browserbase check could not start, because Browserbase returned HTTP 402: the free plan's browser minutes were used up. `npm run deploy` therefore exited nonzero after the upload and settings check had succeeded. The same guest checks and network guard then ran in local Chromium 151 against production at 1280×900 and 390×844. All four checks passed at both sizes: onboarding and exit, deck and spread selection, the sign-in dialog, and draw/deal/reveal. There were no page errors, failed requests or unexpected console errors. As designed, the guard blocked write requests and API reads outside its allowlist.
- **Health.** `/api/health/tarot-reading` and `/api/health/tts` both returned 200 with status `ok`. The reading health check reports `claude-api`, the first configured provider at the time, but does not call it. Claude API requests were in fact failing, so production readings fell back to `modal-qwen`. A later change moves the OpenAI Responses API to the front of the reading order.

## Not verified

- Signed-in Pro flows.
- A generated reading in production. The guest checks block model calls, and a live reading would use the paid Anthropic API.
- Browserbase cloud browsers and physical devices.
- Vision qualification, as noted above.

## Known issues

Two prose repetitions noted in #138 remain. The local composer's You & Them section names the shared element twice, and amplified Celtic Cross cross-checks restate the shared element.

## Evidence

Private evidence is kept outside the repository in `~/.local/state/tarot/release-3d236ab1-20261105T231240Z/`. It holds:

- the deploy logs;
- the narrative samples and metrics from both QA runs;
- the Browserbase report;
- the version, asset and guest-check results;
- the scripts that produced those results.

The merged PR branches were deleted after the release. #136's Playwright report and #138's narrative-check run are kept in `~/.local/state/tarot/pr136-138-branch-artifacts-20261106T001232Z/`.
