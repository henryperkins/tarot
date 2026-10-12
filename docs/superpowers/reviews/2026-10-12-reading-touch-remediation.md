# Reading-touch UI implementation report

The reading now leads from the original question and cards into continuous prose, full card inspection, persistent saving and a contextual follow-up. Supporting tools sit in a collapsed disclosure after completion. The code changes are implemented, and the previously failing WebKit streaming UI check now passes. Physical iPhone and independent-reader checks remain open.

## Source and scope

- Worktree: `/home/ubuntu/tarot/.worktrees/reading-touch-20261012`.
- Branch: `claude/reading-touch-20261012`; baseline HEAD: `f002ad4e321bc9434b795280a53487addb7c7f0f`, plus the implementation tracked on this branch; commit and preview publication are authorized.
- Final source manifest digest: `c7cae1735f5794972cd1834373ec4ef4ea02e9ad6477e2cdc496c65837eb4a8f` (54 JavaScript/CSS source and test files). Runtime application code matches the earlier unit/build snapshot. The browser config, screenshot capture, fixture keepalive comments and one trailing blank line changed afterward; all owned JavaScript files were linted again.
- [Checklist](../plans/2026-10-12-reading-touch-review-remediation.md). Verification was narrowed to the changed UI at the user's instruction. Broad runs were stopped and are not qualifying evidence.

## Implemented changes

| Task | Result |
| --- | --- |
| 1. Visible cues | Streaming and scrolling share occurrence eligibility. Visible turns retain source order and 1800 ms exposure, including split phrases. Inspection pauses automatic turns; returning to prose resumes eligible work. Streaming completion preserves the mounted narrative and playback identity. |
| 2. Full inspection | Shelf cards, inline artwork, names and detail phrases open the same full-artwork dialog. Back to reading, Escape and backdrop dismissal restore passage focus and scroll. Edition/reversal labels remain readable; missing art has a working fallback. |
| 3. Reading order | Your reading, the original question/notes, safety information, cards and one listening group precede the original prose. Reading options contains Hide extra panels. |
| 4. Completion | One save controller owns pending, saved and error states across dock/desktop controls and owner changes. View saved entry opens the returned entry and its narrative. Ask about this reading is secondary; New reading is a quiet in-flow action. |
| 5. Optional tools | Explore this reading contains insights, input provenance and visual creation. Opening it makes no provider request. Installation moves to App options while reading, including the period before the first streamed text. |
| 6. Readability | Card captions and supporting labels are at least 14 px; prose remains 16 px. Full inspection uses contained artwork, modest inline art preserves phone text width, and the measured dock retains one clearance owner. The compact reading header avoids dismissal/completion reflow. |
| 7. UI validation | Targeted checks and source review completed as recorded below. Routine browser defaults now cover desktop Chromium and phone WebKit; the extended matrix is opt-in. The streaming check is resolved; manual device/comprehension checks remain open. |

No narrative generation, prompt/provider configuration, migrations or deployment changed. Existing mobile overview, full-card artwork and bottom clearance fixes were retained.

## Evidence

Logs and source manifests are retained locally in `.superpowers/sdd/2026-10-12-reading-touch-review-remediation/`. These are separate runs at the stated stages, not one uninterrupted matrix.

| Check | Result and boundary |
| --- | --- |
| Root Node suite | 3073 passed, 520 suites, zero failures/skips on the final application source (`npm-test-acceptance.log`). |
| Build and owned JavaScript lint | Passed on the final application source (`build-acceptance.log`, `owned-lint-acceptance.log`). |
| Static accessibility | Command passed; 1132 warnings remain. This does not establish screen-reader or rendered accessibility acceptance (`a11y-acceptance.log`). |
| Documentation and whitespace | All 189 maintained Markdown files have valid local links; `git diff --check` passed after removing one trailing blank line. |
| Repository-wide lint | 65 existing `no-var` errors in untouched WordPress `case-study-compare/editor.js` and `pricing-table/editor.js`; those files were not changed. |
| Save and composition | Four Chromium flow checks passed during implementation: ordering, delayed/failed saving and optional tools (`task5-browser.log`). |
| Final edge cases | Six Chromium checks passed for offscreen streaming cues, deduplicated/missing entry IDs, enlarged short-screen inspection with missing artwork, and pending save settlement while the owner is away (`final-edges-fixed.log`). This preceded the final hover/combined-cue corrections. |
| Final review regressions | Detail-to-card-name hover passed in Chromium; split-fragment and surviving combined-turn motion cases passed in the unit suite. No source-review findings remain unresolved. |
| Full inspection in WebKit | Focused full-artwork and all three dismissal/focus/scroll paths passed on the final application source (`focused-ui-final.log`). |
| Installation utility | Eight focused Chromium/WebKit checks passed during the menu fix. The final WebKit 200% text/landscape/safe-area case passed afterward (`pwa-fix.log`, `focused-install-final.log`). |
| Real local Pro | Normal authentication, active Pro entitlement, save status 201, original-content equality, exact-entry navigation and studio opening passed with synthetic narrative data. Test entry deletion and logout both returned 200; zero follow-up provider requests (`real-review.json`). This proves the tested local persistence path, not a final all-state authentication matrix. |
| WebKit streaming closeout | The original failing case passed after fixture keepalive comments were added; its Chromium counterpart also passed with unchanged UI assertions (`webkit-closeout-before.log`, `webkit-closeout-after.log`, `chromium-closeout.log`). |
| Final phone/desktop review | Guest fixture review passed on dark WebKit phone (390 × 844) and light Chromium desktop (1280 × 900): full contained artwork, zero scroll shift, trailing-action clearance, local saving and exact-entry reopening. Eight viewport captures were inspected (`ui-closeout.json`). |
| Phone image | Final WebKit capture inspected and retained at `/tmp/tableu-reading-purpose/accepted/phone-reading-inspection.png`. Full-page capture includes fixed elements at the capture scroll position; geometry/focus assertions supply clearance evidence. |

The stopped final browser run recorded 1 passed, 1 interrupted and 372 not run. The stopped PWA run recorded 6 passed, 1 interrupted and 102 not run. Neither is represented as successful acceptance. There were no live model calls.

## Open checks

1. **Resolved WebKit partial-stream rendering:** a minimal HTTP/SSE reproduction outside the application showed that a large delta could remain partly buffered while the controlled connection was idle. Periodic SSE keepalive comments released the complete payload. The fixture now sends those comments and clears its timer on connection closure; comments add neither prose nor event IDs. The original failing WebKit regression passed, as did the Chromium case. The application streaming parser and UI assertions were unchanged.
2. **Physical device and comprehension:** physical iPhone/VoiceOver and an independent human reader were unavailable. Mocked tiers and emulated WebKit do not replace them.
3. **Remote preview:** the existing Access-protected guest review Worker is the publication target. Its synthetic replay controller, origin, Access policy and 24-hour window are preserved. Publication evidence will be recorded separately; the running beta services remain protected.

Remaining manual review is limited to physical iPhone/VoiceOver and an independent reader. No additional reading/provider matrix is required.
