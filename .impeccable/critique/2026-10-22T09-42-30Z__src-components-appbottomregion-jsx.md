---
target: Bottom mobile navigation across all pages and routes
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/home/ubuntu/tarot/src/components/AppBottomRegion.jsx"
target_fingerprint: "sha256:179a3f1d965645568bdb7b41a4041e093e10358005d0752360be3b863a4fc8ff"
target_path: /home/ubuntu/tarot/src/components/AppBottomRegion.jsx
timestamp: 2026-10-22T09-42-30Z
slug: src-components-appbottomregion-jsx
---
Method: dual-agent (A: /root/nav_design_review · B: /root/nav_browser_evidence), followed by independent confirmation of the main finding.

**28/40 — Good foundation, with an important priority problem during reading.** Reading and Journal form a clear practice loop. The biggest improvement is to keep useful reading actions within reach when the bottom navigation shares space with other controls.

This is a read-only critique of the local checkout at `7164fc21`. The review covered the 12 named app routes, the catch-all route, and four standalone pages. Chromium covered guest and real signed-in Pro in dark/light themes; WebKit cross-checked the five main app routes. Viewports included 390×844, 320×568/640, and touch-handset 844×390, with selected synthetic 200% text checks. Development-only test fixtures were inventoried separately.

The navigation fits Tableu's Midnight Reading Room identity: restrained sans-serif labels, warm brass state markers, and solid quiet surfaces leave attention on the reading. Familiar navigation conventions are appropriate for this operating surface.

| Nielsen heuristic | Score / 4 | Assessment |
|---|---:|---|
| Visibility of system status | 3 | Clear active destinations; catch-all Reading has no current item. |
| Match with the real world | 4 | Reading, Journal, Save and Ask use natural labels. |
| User control and freedom | 3 | Work survives route changes; internal standalone pages lack simple returns. |
| Consistency and standards | 3 | Shared destination row works; shared Notes has an independent floating action. |
| Error prevention | 3 | Large targets and modal isolation; the Notes action can cover content. |
| Recognition rather than recall | 3 | Destinations are explicit; reading actions can require a trip to the document end. |
| Flexibility and efficiency | 2 | Compact and section-rich readings lose convenient task actions. |
| Aesthetic and minimalist design | 2 | Calm styling; repeated setup utilities and competing chrome weaken hierarchy. |
| Error recovery | 3 | Invalid-share and authentication errors provide useful return paths. |
| Help and documentation | 2 | Support exists; the preparation gear needs interpretation. |
| **Total** | **28/40** | **Good; improve action hierarchy and edge cases.** |

1. **[P1] Section-rich readings keep navigation and contents fixed while Save and Ask disappear into the document.**

   With a five-section reading at 390×844, the app retains the 56px header, a 153px sticky contents toolbar, and the 56px destination row. Save to journal and Ask about this reading move into flow near the document end. Someone in a meaningful passage can leave the reading immediately, but must scroll away to keep it or ask about it. I independently reproduced this; a shorter two-section fixture kept the actions pinned at 390px, so the problem depends on the combined chrome height.

   **Fix:** Condense or release the contents/continuation toolbar before removing the main reading actions at ordinary handset sizes. When landscape or enlarged text requires actions in flow, provide an obvious in-context entry. Suggested command: `/impeccable adapt`.

   Evidence: mid-reading screenshot (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/assessment-a/guest-dark-completed-middle-390.png`, local artifact), independent reproduction (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/root-confirmation-five-section.png`, local artifact). [appChromeLayout.js:14](../../src/lib/appChromeLayout.js#L14) releases actions before secondary controls.

2. **[P2] Reading setup repeats preparation controls in a crowded bottom region.**

   The bottom contains preparation gear, Coach, Draw cards, Reading and Journal. Coach already appears beside the intention field, and reading preparation has another entry beside the progress steps. The whole region is 117px high—20.6% of a 320×568 viewport. The main issue is repeated decisions and similar gear symbols for reading preparation and global Settings.

   **Fix:** Keep Draw cards dominant, retain at most one clearly named preparation entry beside it, and keep intention coaching beside the question. Preserve the two stable destination links. Suggested command: `/impeccable distill`.

   Evidence: 320px setup (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/assessment-a/guest-light-reading-320.png`, local artifact). The repeated controls are composed in [MobileActionBar.jsx:302](../../src/components/MobileActionBar.jsx#L302) and [TarotReading.jsx:1206](../../src/TarotReading.jsx#L1206).

3. **[P2] Shared Notes has a separate bottom action that covers content and outlives its purpose.**

   For signed-in Pro on a valid shared-reading fixture, the floating Add note button covers part of the empty-state sentence at 320px. It remains when the note form is already visible, beside the actual Share note action. The submit button's center remained usable; this is a confirmed overlap and redundant action, not a demonstrated submission blocker.

   **Fix:** Show the jump action only while the form is outside the viewport, and reserve its footprint through the shared bottom-clearance policy. Suggested command: `/impeccable harden`.

   Evidence: covered empty state (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/assessment-a/pro-light-share-notes-320.png`, local artifact), form already visible (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/assessment-a/pro-dark-share-notes-filled-end-320.png`, local artifact). [ShareReading.jsx:455](../../src/pages/ShareReading.jsx#L455) shows the control whenever Notes is selected and the user is signed in.

4. **[P2] Unknown URLs display Reading without marking Reading current.**

   A mistyped or stale path silently renders the full reading page while neither bottom destination has `aria-current`. This is different from Account or Pricing, which are legitimate secondary pages outside the two destinations.

   **Fix:** Redirect fallback paths to canonical `/`, or present a clear not-found page with Return to reading. Suggested command: `/impeccable harden`.

   Evidence: unknown-route screenshot (`/home/ubuntu/tarot/output/playwright/bottom-nav-critique-20261022/assessment-a/guest-dark-critique-unknown-route-390.png`, local artifact). The mismatch comes from [AnimatedRoutes.jsx:100](../../src/components/AnimatedRoutes.jsx#L100) and the exact root match in [DestinationNav.jsx:9](../../src/components/DestinationNav.jsx#L9).

The strongest parts should be preserved:

- **Clear, generous destinations:** Reading and Journal have visible text and 56px-high targets. Journal remains selected on Card Gallery. Dock text contrast measured 7.14:1 or better across the checked themes and states.
- **Ongoing work survives navigation:** Typed intentions and completed synthetic narratives survived Reading → Journal → Reading. Settled route changes updated focus, title and announcements in Chromium and WebKit.
- **Overlays own interaction:** Preparation, follow-up and sign-in dialogs isolated the underlying navigation. The guest pricing sign-in flow returned focus to Go Plus after dismissal.

| Routes / states | Bottom treatment | Critique |
|---|---|---|
| `/` setup | Reading/Journal plus contextual actions | Simplify repeated utilities. |
| `/` preparing / completed | Shared row; contextual actions vary or move into flow | Correct the task-action priority, especially section-rich readings. |
| `/journal`, `/journal/gallery` | Reading/Journal; Journal selected | Coherent parent section. |
| `/account` | Reading/Journal; neither selected | Appropriate secondary-route state; page title explains location. |
| `/pricing` | Same row; guest/free preview adds Plus CTA; active Pro omits upsell | Tier difference is sensible; compact/landscape action placement deserves the same hierarchy rule. |
| `/design` | Shared row; neither selected | Consistent developer reference surface. |
| `/share/:token` | Valid guest fixture: Start Reading/Sign In; Pro: no global row; invalid share: explicit return | Quiet reading context is appropriate; fix the Pro Notes floating action. |
| `/reset-password`, `/verify-email`, `/auth/callback` | Focused recovery, no destination row | Appropriate; explicit return paths exist. |
| `/admin`, `/governance-critique` | Standalone, no app dock | Add a simple Return to Tableu link. |
| Unknown path | Reading UI, no current destination | Correct the route-state mismatch. |
| `/support`, `/privacy`, `/terms` | Document navigation and app return links | Appropriate for reading/help. |
| `/offline` | Open Journal and Retry connection | Useful focused recovery. |

**Cognitive load is moderate.** Single focus, visual hierarchy and minimal choices are the three checklist weaknesses; grouping, chunking, progressive disclosure and retained reading context work well. Setup's five bottom controls are grouped into three task actions and two destinations; duplication is the stronger problem. Emotionally, the experience starts reassuringly, then adds friction when a reader wants to act on a meaningful passage.

- **Casey, distracted mobile reader:** Can switch destinations easily; saving or asking mid-reading becomes less convenient when those actions move away.
- **Jordan, first-time reader:** Understands Reading and Journal; repeated Coach entries and several similar gears add uncertainty.
- **Sam, accessibility-dependent reader:** Benefits from text labels, large targets and modal isolation; the unknown-route state and compact Notes overlap remain weaknesses.

Minor observations: a label-width active marker would be quieter than the current near-half-width underline. Account and Pricing leaving both main destinations inactive is defensible; this review does not establish a need for another destination. Focused recovery, sharing and legal/help pages should keep deliberate navigation exceptions.

**Detector and evidence:** The source detector returned 0 findings across 16 relevant JSX files. Browser injection ran on five representative pages and produced 11 page-wide signals; none was located inside bottom navigation. Page-wide glow and out-of-scope card/copy signals were not counted as navigation defects. The actionable findings come from rendered behavior and source inspection. No live overlay is available in the user's browser; captured evidence is local/headless.

Real local login and unmodified `/api/auth/me` verified Pro/active sessions, followed by logout. Narrative/share content was explicitly fixture-controlled, with no paid generation or actual journal/note writes. Free/Plus/inactive authenticated tiers, successful OAuth/reset/verification tokens, administrator access, physical keyboards, real virtual keyboards, device safe areas, browser chrome, gestures, screen-reader behavior and installed-PWA behavior remain unverified. WebKit emulation is Render evidence, not Device evidence.

The temporary app and detector services are stopped. No product files were changed; pre-existing workspace changes were preserved. The local build completed successfully as part of starting the review app. No implementation test suite was required for this read-only critique.

Design questions: Which fixed controls best support someone acting on a meaningful passage? Which preparation entries earn a second appearance in the thumb area?

> Portability note (23 October 2026): local evidence paths above identify artifacts on the original review host. Those files are not included in this Git handoff. Repository source links are relative.
