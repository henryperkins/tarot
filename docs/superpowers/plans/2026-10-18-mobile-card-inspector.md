# Mobile card inspector implementation plan

**Goal:** Resolve F-01 through F-16 in the consolidated mobile inspection review and verify the real reading flow in Chromium and WebKit.

**Spec:** Consolidated F-01–F-16 review, with [implementation and finding dispositions](../reviews/2026-10-20-mobile-card-inspector-acceptance.md). The user's implementation request approves its single-inspector direction; the supplied original review remains preserved locally. Work is isolated at `.worktrees/card-inspector-20261018`, initially based on `e3f30ecb`, reconciled with `97ab037f` on October 20; unrelated primary files are recorded in `/home/ubuntu/.cache/tableu-card-inspector-20261018/preservation.json`.

**Architecture:** Keep CardModal as the single owner of focus, history, and the document scroll lock. Use a persistent identity header and navigation footer around one scrolling body. Render complete curated symbol details inline, reserve the artwork frame and load the selected card's preview before its scan, and restrict optional navigation gestures to that artwork. Existing standalone symbol insights remain available to other callers.

## Constraints

- Preserve Tableu's semantic theme tokens, full artwork, orientation, deck identity, reading text, and original opener.
- Implementation checks use controlled narratives without paid API calls or dependency upgrades. The October 20 approval authorizes final checks, scoped commit, push and deployment; deployment qualification uses only the owner's Claude subscription.
- Preserve unrelated primary dirty work and index entries, plus existing review snapshots.
- Use real local Pro login for authenticated browser acceptance; fixtures supply reading text only. Cover guests separately and log out.
- Keep viewport emulation distinct from physical-device and assistive-technology acceptance.

## Tasks

- [x] Establish RED for motion navigation opacity and simultaneous nested dismissal in an actual fixture-backed reading.
- [x] Repair entrance/accordion animation cleanup and remove the nested inspector Symbols dialog, then prove both P1 paths green.
- [x] Implement persistent controls, identity before artwork, scroll reset, one set of safe-area insets, complete readable inline symbols, and a labeled spread counter.
- [x] Reserve artwork dimensions, prevent stale image identity, support slow/failed loading, and constrain horizontal navigation to one deliberate artwork gesture.
- [x] Make caption and artwork one target while preserving heading semantics, improve narrow reference wrapping, and mount the hidden overview only when needed.
- [x] Run Chromium/WebKit with motion on/off, themes, narrow/landscape/enlarged layouts, navigation, all dismissal routes, focus/scroll recovery, gestures, image recovery, and contrast/accessibility checks.
- [x] Run root unit suite, relevant existing browser coverage, changed-file ESLint, build, and one final mechanical design scan.
- [x] Obtain fresh independent code review, resolve actionable findings, integrate only owned files into the primary checkout, and verify preservation.

## Review focus

- Rapid Next/Previous and close during entrance must not retain stale animations or set state after unmount.
- Symbols and any history/cinematic content must not introduce an independent body lock inside the inspector.
- Artwork identity and orientation must agree under delayed, failed, or changing image requests across all three decks.
- Touch cancellation, multi-touch, vertical/diagonal movement, selection, controls, and edge gestures must preserve scrolling and zoom.
- Ordinary focus restoration must keep the original reference after browsing; enlarged text and landscape must retain reachable return controls.

## Execution record

- Baseline and source inventory recorded; root Node suite started before production edits.
- Independent browser regression author owns the new inspection suite/config. Reference changes are isolated to ReadingSpread, its existing stylesheet, and the drawn-card disclosure caller. Coordinator owns CardModal, artwork, symbol content, and final integration.
- The consolidated review is the approved implementation brief; no additional design approval is required for these repairs.

- October 20: preserved 16 implementation files before fast-forwarding the isolated worktree to `97ab037f`; resolved overlaps while retaining the shared modal/Back fixes. Explicit frozen-source capture now includes the artwork component and inspector stylesheet.
- Both P1 paths passed in both engines with motion on/off. Reviewer layout probes reproduced and repaired 320px overview-name overflow and 200% short-landscape control clipping. Independent review found no remaining P1/P2 issue; its wrapped-final-card image-size precision note was addressed.
- Real local Pro/active and guest built-asset sessions passed all four dismissal routes in both engines; Pro sessions logged out. Existing overlay checks passed 20/20, seven affected follow-ups passed, and adjacent reference/large-text checks passed 8/8.

- Full inspection matrix passed 80/80. Final multi-touch cancellation and widened short-landscape layout passed eight affected follow-ups across both engines and motion preferences. See the [acceptance record](../reviews/2026-10-20-mobile-card-inspector-acceptance.md).

- An earlier full `npm test` passed 4,371 tests, with two skipped and zero failed, before the final Symbols animation target correction. The final source passed the focused frozen-source cold-start/build/callable-JSX test, production build, and scoped ESLint. Static a11y/contrast and 194 maintained Markdown link checks also completed.
- A stronger settled-animation 200% text/rotation assertion reproduced a retained numeric Symbols height in both engines with motion enabled. Ending expansion at `auto` passed all 12 responsive/theme cases, followed by all 20 P1 regressions on the final source. Fresh rebuilt guest and real Pro sessions again passed all 16 dismissal checks; exact served entry/inspector JS/CSS bytes matched the build. Independent code review found no issue with the final height fix.
- Integrated all 19 owned files into the primary checkout with matching SHA-256 hashes. Verified that the 47 pre-existing dirty/untracked files, HEAD and Git index tree were preserved. Acceptance and compact browser evidence are available in the primary checkout; no commit, push or deployment was performed.
- The user subsequently approved final full-suite verification, physical-device acceptance where available, a 19-file scoped commit, push and deployment. Release checks and generated evaluation evidence use an isolated checkout. Physical-device and assistive-technology connections are unavailable here and remain explicit acceptance gaps.
- Pre-commit verification on the final integrated source: full root suite 4,371 passed, two skipped, zero failed; 14 scoped JavaScript lint targets passed; all links in 199 maintained Markdown files resolved. Claude subscription authentication passed for the mandatory deployment gate.
