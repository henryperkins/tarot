# Saved-reading card verification

Captured and verified locally on 2026-10-26. All reading content and notes are
synthetic. The frontend was built from the journal-entry-card worktree and served
at `http://localhost:8787` with the primary checkout's local Worker and D1 state.

The polish preserves the existing journal design and adds a native disclosure
button inside the entry heading, neutral reversal badges, catalog deck names in
copied summaries, and a fresh expiry check when reusing an entry's share link.

## Rendered review

Chromium 151.0.7922.34 covered eight guest cases: 1280, 768, and 390 CSS pixels,
plus 320 pixels with 200% root text, each in dark and light themes. Two additional
1280-pixel cases used the real local reviewer password login. `/api/auth/me`
confirmed an active Pro subscription before those captures. The session was
logged out after each Pro case; the subsequent auth check returned 401. The
task-created cloud reading and reflection were removed afterward.

All ten cases verified the heading/button relationship, Enter and Space
activation, visible header focus, clicking the chevron, the reflection invitation,
note persistence and Edit focus, the save announcement, menu placement and Escape
focus return, and the card's axe checks. Guest cases also copied a summary with
the Rider-Waite-Smith label. No page overflow or JavaScript page errors were
observed. Guest auth probes returned the expected 401 responses. One optional
external request was blocked by the local review guard.

- [Desktop, dark, 1280 × 900](desktop-dark.png)
- [Phone, light, 390 × 844](phone-light.png)
- [320 × 844 with 200% text](large-text-dark.png)
- [Saved reflection in the real Pro session](pro-reflection-saved.png)

These are browser and accessibility-tree observations. Physical-device, native
keyboard, and screen-reader use were not qualified. Real authentication coverage
is Pro at desktop width; other tiers use existing controlled browser fixtures.

## Checks

- `npm test`: 5,832 tests; 5,830 passed, two skipped, zero failures.
- Card fan, responsive adaptation, and list hardening: 26 Playwright cases passed
  across the configured Chromium and WebKit projects. The header selectors follow
  the question-only button name. The fan screenshot baseline was intentionally
  updated for the neutral reversal badge.
- Journal reachability: 14 Playwright cases passed, including expiry while the
  page stays open, after which the entry control must create a fresh share link.
- Ten rendered guest/real Pro cases passed, including card-scoped axe checks.
- Production frontend build, repository ESLint, and maintained Markdown links
  passed. The manual Impeccable scan returned two advisory size findings in
  existing `.prose-reading` and `.journal-quote` CSS, outside this pass's additions.

The preceding handoff records 55 failures across seven other reading/journal
specs, reproduced on a clean master worktree. That larger comparison was not
repeated during polish; this report claims the checks listed above. The earlier
owner and sharing runs remain separately recorded in the handoff.

## Integration scope

PR [#126](https://github.com/henryperkins/tarot/pull/126) owns the pending follow-up
component changes. Its only changed-file overlap with this branch is
`scripts/lib/readingCueValidationSource.json`: preserve its `openSignIn.js`
addition together with this branch's helper additions and deleted-component
removals. Review the combined saved follow-up rendering before release because
this branch also changes the shared section and turn styles.

The follow-up heading levels, small supporting text, empty-state wording, and
limits wording remain separate work. `.impeccable/design.json` was not refreshed
as a side effect of polish; the maintained journal rules are in `DESIGN.md`.
This verification does not include a production deployment.
