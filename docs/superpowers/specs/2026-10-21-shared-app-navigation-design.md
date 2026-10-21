# Direction A: one quiet app bar

**Status:** Approved for an isolated Direction A prototype, with the review amendments incorporated on 2026-10-21. Integration follows Gate 1 visual approval. This approval does not authorize a commit, push, PR update, or production release.

**Date:** 2026-10-21

**Baseline:** PR #118, `codex/header-navigation-revamp-20261019`, commit `804c84cd4356ae4ace801517390b60a66fc59bd3`.

**Delivery:** An isolated, working prototype first; integration into the PR follows visual approval.

**Visitor mode:** Operate. Reading content and first-run welcome retain their ceremonial character.

## 1. Purpose and outcome

Make Reading, Journal, and Account feel like parts of one application. A person should recognize the brand, know their current destination, reach their account, and continue their reading without decoding a different header on each page.

Use Direction A: one quiet app bar, text navigation with a restrained brass active marker, and reading progress inside the canvas. Carry over one element from Direction B: the full masthead belongs in first-run welcome. The recurring app bar does not collapse, expand, or disappear in response to scroll direction or spread selection.

Success means:

- The brand and account control keep the same alignment across routes at a given viewport.
- The top bar is 56px tall at normal text size, plus the device's top safe area. It can grow when text or content requires it.
- Destination navigation and reading progress have distinct positions, appearance, and accessible semantics.
- Handset users see one Reading/Journal navigation group on routes with destinations enabled. Focused auth/share routes use the same frame with destinations suppressed. Reading actions remain easy to reach without covering content.
- Existing navigation guards, reading state, menu behavior, authentication, and installation flows continue to work.

## 2. Baseline and visual authority

Use [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and the [design contract](../../design-contract.md) for product truth, semantic tokens, typography, and accessibility. Preserve the Midnight Reading Room identity: dark-first surfaces, warm brass used sparingly, serif headings and artifacts, and sans-serif operation.

The initial critique linked source in the `master` checkout. The PR baseline already removes the large Reading masthead and welcome line, includes a linked brand through [GlobalNav](../../../src/components/GlobalNav.jsx), and gives reading steps a quieter text treatment. [MobileBottomNav](../../../src/components/MobileBottomNav.jsx) exists but is not mounted. Treat these as baseline facts, not pending fixes.

The remaining inconsistency is in the outer layout. [Reading's Header](../../../src/components/Header.jsx) contains a second progress row. [Journal](../../../src/components/Journal.jsx) and [Account](../../../src/pages/AccountPage.jsx) wrap the shared navigation in separate padding and width rules.

Browser measurements captured on 2026-10-21 against the baseline preview:

| Surface | Header at 1440 × 1000 | Header at 390 × 844 | Navigation width at 1440px |
| --- | ---: | ---: | ---: |
| Reading | 126px | 106px | 1024px |
| Journal | 109px | 97px | 1024px |
| Account | 109px | 97px | 640px |

These are Chromium measurements at normal text size with a synthetic Pro session. They establish the current geometry, not redesigned behavior or physical-device validation. The brand mark is present on all three routes; its wordmark is currently hidden on mobile.

The Navigation section of `DESIGN.md` still specifies filled pill destinations. This approved prototype direction proposes a bounded change to that component contract. Preserve the broader design system. Update the navigation documentation and sidecar together after the rendered design is accepted; do not rewrite them while amending this spec.

## 3. Scope and route contract

The first visual prototype covers the primary comparisons and NAV-01 through NAV-07 at Gate 1's defined depth (§10). The implementation also accounts for the supporting consumer routes below, with complete behavioral validation at Gate 2.

| Route or state | App bar and handset dock | Active destination | Page-specific behavior |
| --- | --- | --- | --- |
| `/` and its reading phases | Shared | Reading | Progress and settings in the canvas; reading actions in the bottom region on handsets |
| `/journal` | Shared | Journal | Preserve filters, insights, entry actions, full-history search, and scroll behavior |
| `/journal/gallery` | Shared | Journal | Preserve gallery controls, card inspection, and measured sticky offsets |
| `/account`, including hashes | Shared | Neither | Account control identifies the current area; preserve unsaved-edit protection and section navigation |
| `/pricing` | Shared | Neither | Preserve plan actions and links to `/account#subscription` |
| `/reset-password`, `/verify-email` | Shared quiet variant: `destinations={false}`; no destination dock | None | Preserve frame geometry and account controls; keep token/query handling and focused form behavior |
| `/share/:token` | Shared quiet variant: `destinations={false}`, including loading/error states | None | No top or bottom destination links; retain shared-reading tools and the guest contextual action row |
| `/design` | Shared | Neither | Use the shared component in the design reference without redesigning its content |
| `/auth/callback` | No new persistent chrome | None | Complete the existing redirect/authentication flow |
| `/admin`, `/governance-critique`, development fixtures | Outside this redesign | Existing behavior | Internal tools and test harnesses retain their specialized layouts |
| Static support/privacy pages | Outside this redesign | Existing behavior | No static-site navigation rewrite |

Journey remains part of Journal and its existing entry points; this work does not introduce a `/journey` route. Keep Card Gallery and Journey discoverable within Journal, and plan management in Account/Pricing. The primary destination set remains Reading and Journal.

The quiet variant uses the same `AppHeader` component, width, gutters, brand, and account controls. One route-level `destinations={false}` setting suppresses Reading/Journal in both desktop and handset placements, including during loading/error states and after keyboard dismissal. It does not reserve an empty bottom row. Password/email forms have no bottom region unless they already have a contextual action to host; shared-reading guests retain the Start Reading / Sign In row. This is a composition variant, not another header design.

Out of scope: redesigning page content, changing reading generation or cancellation semantics, subscription entitlements, journal storage, exports, billing, authentication protocols, or adding a navigation library/router migration.

## 4. Shared app-bar design

### Geometry and appearance

- Use one component for the outer header, not just shared links inside page-specific wrappers.
- The normal bar height is 56px, including its border and excluding the top safe area. Treat this as a minimum, not a fixed clipping height.
- Cap the inner row at 64rem on every included route. Page bodies retain their existing widths; Account's narrow body must not narrow the header.
- Deliberately retain the wider Reading canvas container. At 1440px, the header brand and the outer Reading content do not share a left edge. Gate 1 must show and judge that offset in a full-width screenshot; it is not a NAV-01 alignment failure, which compares header alignment between routes. A different width choice requires an explicit visual-review decision.
- Use 16px horizontal gutters on handsets and 24px on desktop, increased where a device safe-area inset requires it.
- Use the opaque semantic page background and one quiet bottom border. No glow, pill tray, recurring hero, or scroll-triggered size transition.
- At normal text size, use the existing brand mark at 28–32px with a compact `Tableu` wordmark, approximately 16–18px. Keep the wordmark visible at 320px. Preserve the existing mark artwork.
- Navigation labels use the existing sans-serif family at 14px and medium/semibold weight. Interactive targets remain at least 44 × 44px.

### Desktop arrangement

```text
┌─────────────────────────────────────────────────────────────────┐
│  [mark] Tableu    Reading       Journal              [◯ Account] │
│                  ───●───                                        │
└─────────────────────────────────────────────────────────────────┘
```

The brand links to `/` with the accessible name `Tableu home`. Reading and Journal are ordinary links, visually styled as text tabs. They do not use ARIA tab roles or arrow-key tablist behavior. The active destination has a thin brass underline with a small dot; inactive destinations have no filled background. The active marker is decorative and accompanies `aria-current="page"`.

Desktop destinations form a left-aligned cluster immediately after the brand, separated by a fixed gap. Do not center that cluster in the header or in the remaining space. The account-control group uses the remaining space to stay at the right edge; changes in its loading/auth state must not move the brand or destination cluster. With `destinations={false}`, omit the cluster and keep both outer anchors in the same positions.

The account control stays right-aligned. Signed-in desktop users see an avatar/initial plus `Account`; the full identity remains available inside the menu and in its accessible name. Handsets use the avatar/initial with an accessible account-menu name. Long names must not widen the bar or truncate navigation.

Guests see a visible `Sign in` control, including at 320px, which opens the existing authentication dialog directly. Registration remains available through that dialog. Beside Sign in, show a gear control with a 44 × 44px minimum target and accessible name `Settings`. Implement it as a real link to `/account`, visually styled as an icon-button. It remains present on Journal and quiet routes as well as Reading, without requiring authentication or opening a menu first. A guest on Journal must reach Settings in one tap.

The normal guest handset row is `[mark] Tableu` at the left and `[Settings gear] [Sign in]` at the right. At 320px, those controls fit within the 288px content width without hiding the wordmark or Sign in label. The reading-canvas settings control remains available for reading-specific access; tutorial replay remains in Account. Preserve existing guest installation/help access when reorganizing the menu.

Reserve the account-control area during authentication loading. Resolve guest/signed-in controls without shifting the brand or destinations. Retain the existing auth-error/retry behavior.

### Sticky behavior

The bar is sticky when sufficient visible height is available. Keep the accessibility purpose of [useResponsiveSticky](../../../src/hooks/useResponsiveSticky.js): oversized chrome returns to document flow. Removing decorative scroll choreography must not remove this accommodation.

Publish actual pinned height for anchor/focus clearance. When unpinned, the reserved pinned height is zero. No ancestor transform may turn fixed menu backdrops into header-local overlays. Menus must not be clipped by the app bar or page containers.

## 5. Handset navigation and bottom actions

Use the existing [useHandsetLayout](../../../src/hooks/useHandsetLayout.js) decision for both navigation and reading actions: widths up to 768px, plus the established touch-first, height-constrained desktop-site case. Do not use an independent breakpoint that leaves top and bottom navigation visible together.

```text
┌─────────────────────────────────────────┐
│  [mark] Tableu                       ◯  │
└─────────────────────────────────────────┘
   Page content / reading progress
   …
┌─────────────────────────────────────────┐
│  Contextual reading actions, when used  │
├─────────────────────────────────────────┤
│       Reading             Journal       │
│       ───●───                           │
└─────────────────────────────────────────┘
   Device bottom safe area
```

The handset destination row is 56px at normal text size, with two equal-width text links and 44px minimum targets. Use the same active marker and route matching as desktop. Account and Pricing do not falsely select Reading or Journal. Quiet auth/share routes omit the destination row entirely.

Desktop and handset destination groups may both remain mounted. Every inactive copy must have `hidden` and `inert` applied to its containing group, removing it from layout, keyboard focus, and the accessibility tree. CSS must not override the `hidden` state. Opacity, off-screen positioning, or `aria-hidden` alone are insufficient. When `destinations={false}`, both copies are omitted or remain `hidden` and `inert`, and their height reservation is zero. Before a breakpoint change hides a focused copy, focus its visible equivalent; if none exists, focus the canvas/page heading.

One bottom-region component owns fixed positioning, measured height, keyboard offset, safe-area padding, and layering. The reading action row is a child of that region, above the destination row. It is not a second independently fixed bar. Routes with destinations enabled but no contextual actions show only the destination row. Quiet routes show only their applicable contextual actions; when neither row is present, the bottom region and its reservation are zero.

Reuse the behavior of [MobileActionBar](../../../src/components/MobileActionBar.jsx): preparation, shuffle, deal/reveal, generate, retry, cancellation when currently offered, Save/View saved entry, and follow-up actions retain their existing labels, eligibility, busy states, duplicate-action protection, and handlers. A reading phase that hides its action row does not hide global navigation. Modal reading settings and follow-up remain available through their existing triggers.

On shared readings, place the guest promotional explanation in page flow. Put its existing Start Reading and Sign In actions in the contextual row on handsets, with no Reading/Journal destination row underneath. Those contextual actions are the recipient's primary onward path. On desktop, keep that promotion in page flow. Preserve shared-note submission, floating scroll controls, and their clearance from the bottom region.

### Clearance, keyboard, and short-screen rules

**Provisional prototype hypotheses:** The 25% bottom-region budget and 40% combined-chrome budget, reduced to 25% below 500px visible height, are starting values to test, not settled acceptance thresholds. At Gate 1, exercise the longest real generating/busy and follow-up action labels in the states where they are shown, plus a keyboard and short-landscape example. Record readable space, wrapping, focus reachability, and each transition into flow. Confirm or adjust the values from that evidence before Gate 2; a prototype can pass with documented revisions to these numbers. Removing overlap and retaining accessible actions are the requirements.

1. Measure the complete visible bottom border box with `ResizeObserver`, including its safe-area padding. Reserve that height once in page padding and focus/scroll clearance. Apply bottom safe-area padding once, at the outermost bottom region.
2. Use the existing viewport/keyboard utilities. While a text field is focused and an on-screen keyboard is detected, set the destination-row container to `hidden` and `inert`. Before hiding it, check whether it contains the active element; if it does, move focus to the canvas/page heading. Preserve focus when it is already in the text field. Keep applicable contextual actions above the keyboard only when they fit the provisional height budget. The app bar remains accessible. On keyboard close, restore only the placement permitted by the current route and layout; quiet routes never gain a destination row.
3. Do not subtract the keyboard twice. A region positioned inside the visual viewport already has that reduced height; a layout-viewport fixed region uses the existing keyboard offset once. Recalculate reservations after orientation, text size, safe-area, and keyboard changes.
4. Start by moving contextual actions into page flow when the complete bottom region exceeds the provisional 25% budget. Keep a compact destination row fixed only if it fits and the route enables it. When moved, contextual actions sit with the relevant reading section, outside nested scroll traps.
5. Start with a combined budget of 40% for pinned top chrome, secondary page controls, and the bottom region, reduced to 25% below 500px visible height. Release the named secondary controls below first, then the app bar, then any destination navigation into flow. Recalculate after each release. Preserve all controls and their order; do not shrink targets or clip labels to meet a provisional budget.
6. On routes with destinations enabled, normal handset layout places them only in the bottom region. The keyboard exception temporarily hides them; the short-screen exception moves the same navigation into flow. Neither exception activates the desktop copy or adds another navigation group.
7. While a modal or onboarding overlay owns interaction, background header/dock controls must be inert. Closing the overlay restores focus to a visible equivalent of the opener. If that control no longer exists in the current layout, focus the relevant canvas/page heading. A resize that changes layout must not strand focus in a hidden control.

Secondary controls are released in this route-specific order before the app bar:

| Route | Secondary controls to return to page flow |
| --- | --- |
| Account | The `Jump to section` chip row (`sectionNavRef`) |
| Journal | The floating filter summary/shortcut bar in [JournalFloatingControls](../../../src/components/journal/JournalFloatingControls.jsx), then sticky month headings, then the desktop insights rail if present. Return filter actions beside `#journal-history-filters`; [JournalFilters](../../../src/components/JournalFilters.jsx) is already in flow and must not become sticky as part of this work |
| Reading | The contents/audio/section toolbar in [ReadingContents](../../../src/components/reading/narrative/ReadingContents.jsx), then any pinned card companion. StepProgress is already in flow |
| Shared reading | The existing section/tab strip below the app bar |
| Gallery, Pricing, password/email forms, design reference | No additional secondary pinning is introduced; retain their normal in-flow controls |

Journal's floating controls must also clear the shared bottom region whenever they remain fixed. Their occupied space participates in the same budget; do not count `--journal-controls-inset` and shared bottom clearance twice.

These behaviors must work with enlarged text and long labels. The 56px target never overrides content, focus, or touch-target requirements.

## 6. Reading progress and first-run welcome

Place progress at the top of the reading canvas, below the app bar and before the current reading section. Use a quiet numbered line:

```text
1 Spread  —  2 Intent  —  3 Ritual  —  4 Read
```

Use three distinct progress treatments:

- **Completed:** A small check replaces the visible numeral; the label uses normal-weight main text. The accessible name retains the step number and label and adds `completed`.
- **Current:** A visible numeral and stronger-weight main text, with `aria-current="step"`. Current styling takes precedence when revisiting a completed step.
- **Upcoming:** A visible numeral and normal-weight muted text, retaining readable contrast and the existing interaction rules.

Derive completion from the reading flow's existing milestones, not merely from position before the active step. An optional ritual that was skipped must not be announced as completed; show its normal numbered label with a `Skipped` annotation when that state is known. This presentation does not create a new completion requirement or persist a new progress model.

Reserve the destination underline/dot treatment for site navigation. Progress has no filled pills and no sticky positioning. At 320px or enlarged text, allow a clean two-row arrangement instead of clipping or requiring horizontal page scrolling.

Retain the ordered list, `Tarot reading progress` navigation label, and current-step semantics. Each accessible name includes its step number and visible label; for example, `Step 2: Intent (question)`. Update selectors that intentionally named the old `Question` label while preserving their behavioral assertions. [StepProgress](../../../src/components/StepProgress.jsx) continues to call the existing step-selection handler and use the same step identifiers; this layout change does not bypass readiness checks, reset a reading, or alter optional ritual behavior.

Keep a canvas-level settings control available throughout the reading flow, including guest setup. Preserve its current handset settings-sheet and desktop Account behavior. Place shuffling status near the relevant reading controls with its existing polite announcement, so asynchronous status cannot add a header row. Completed readings retain reachable progress/settings without inserting controls into interpretation prose.

Use [WelcomeStep](../../../src/components/onboarding/trimmed/WelcomeStep.jsx) for the full masthead and welcome copy. Preserve the current agency-centered message and personalization inputs. Do not reintroduce a recurring tagline or reset onboarding completion; explicit tutorial replay remains the way to revisit the welcome.

## 7. Navigation, focus, and data safeguards

- Use real links for destinations, preserving modified-click and open-in-new-tab behavior. Do not replace them with button-only navigation.
- Keep shared header and bottom navigation within Account's existing click-capture boundary. All same-tab exits, including the brand, Journal dock link, pricing links, Sign out, and Replay tutorial, must preserve the existing discard-edits flow.
- Keep Account's explicit `onRequestExit` path for menu actions. Do not intercept the same action twice or add a second history guard. Browser Back, cancel/stay, and discard/leave must retain their current history behavior.
- Same-page Account hashes are section navigation. `/account#subscription` opens plan details, including direct loads and hash changes, without treating the change as leaving the page or discarding edits.
- Preserve route titles, content focus, and announcements through [RouteAccessibility](../../../src/components/RouteAccessibility.jsx). Keep one `main` landmark and the existing page heading hierarchy. The brand is a link, not an additional page H1.
- Preserve skip links. Focused fields, section anchors, menu items, and final-page controls must remain clear of actual pinned chrome.
- Menus/dialogs retain Escape, outside-click, Back-button, focus-return, and scroll-lock behavior. Authentication or tier changes update controls without leaving stale user information visible.
- Navigation must not depend on a successful journal, Journey, or subscription fetch. Free/local journals, cloud journals, offline/cache states, exports, and account deletion retain their existing semantics.
- Installation entry points remain reachable in each supported reading phase and at page end. Prompts and sheets open above the bottom region and return focus correctly.

## 8. Component responsibilities and migration boundaries

This is a shared-presentation change using the existing React router and state owners. Do not introduce a new global navigation store or move reading state into the header.

| Component or area | Responsibility |
| --- | --- |
| Proposed `AppHeader` | Own the common header wrapper, width/gutters, brand, left-clustered desktop destinations, guest Settings link, account/auth trigger, and header measurement; accept `destinations={false}` for quiet routes |
| `GlobalNav` or an extracted destination component | Own one route model and the Reading/Journal link presentation used in desktop and handset placements; enforce `hidden`/`inert` on inactive copies |
| Proposed shared bottom-region component | Own the handset frame, contextual-action slot, optional destination row, viewport/height policy, and clearance; consume the same route-level destination setting as `AppHeader` |
| `MobileActionBar` / action contents | Keep reading action behavior and state; delegate fixed positioning to the shared bottom region |
| `StepProgress` and `TarotReading` | Own canvas progress, settings, status, and existing step handlers |
| Route page components | Compose the shared chrome inside their guard/focus boundary; retain their own content widths, data, and page-specific controls |
| `UserMenu` and guest auth controls | Preserve session, billing, installation, tutorial, and menu behavior while adopting the compact presentation |
| `navigation.css` | Own common navigation geometry and states using existing semantic tokens |

Compose the same components at page level so Account's guard can contain them. Remove route-specific outer header padding/width rules from included pages. Do not wrap every route in a new provider solely to make the header persistent.

Keep one owner for each measured height. Existing consumers of `--pinned-header-height`, `--sticky-header-height`, `--mobile-action-bar-height`, gallery/share offsets, and root scroll padding must be updated or bridged deliberately. A compatibility variable must refer to the correct complete measured region; it must not create another reservation. Restore route-owned root styles/listeners on unmount.

The existing `MobileBottomNav` may be replaced by the shared destination presentation. Do not mount its current Reading-only implementation as-is. Retire obsolete header-specific CSS and props only after confirming all consumers, including restored journal readings and fixtures.

## 9. Accessibility and motion requirements

- Preserve the repository's 44px minimum interaction targets and 52px primary reading actions where space permits; short-screen primary actions retain at least 44px.
- Use semantic foreground/background/focus tokens in dark, light, and increased-contrast modes. Active state remains discernible without color alone.
- Keep visible keyboard focus independent of active destination styling. Focus rings must not be clipped by the bar, dock, menu, or viewport.
- Preserve browser zoom and text enlargement. Do not impose `overflow: hidden` on the document to hide layout failures.
- Decorative markers and logo ornament are hidden from assistive technology. Visible label text and accessible names remain consistent.
- Respect reduced motion. There is no masthead-collapse choreography; any hover/focus or keyboard-position adjustment must have a stable reduced-motion path.
- Keep controls usable at 320px and in short landscape. Viewport emulation must be identified as such; physical keyboard, screen-reader, and device safe-area evidence must be reported separately when collected.

## 10. Two validation gates

The prototype is a separate source copy/worktree and a separate live URL based on `804c84cd` plus documented prototype edits. Preserve the existing PR preview for comparison. Use isolated synthetic data and real local authentication for the signed-in visual pass; follow the [local reviewer-account workflow](../../local-reviewer-account.md). Keep canonical local-reviewer credentials restricted to their approved origin. A public preview requires its own isolated demo account and session bootstrap, with no credentials in URLs, browser artifacts, or source.

Use deterministic saved readings or mocked generation for completed/error states; record the evidence type. Header work does not require live model calls. Capture the actual preview revision/dirty-source identity, verify public routes/assets, and recheck the URL before sharing it.

### Gate 1 — Isolated prototype and visual approval

Gate 1 covers the primary visual comparisons and NAV-01 through NAV-07 at the bounded depth below. Its purpose is to judge composition, navigation placement, the quiet variant, and the mobile height hypotheses. It does not require the full integration matrix before visual review.

| Prototype coverage | Required evidence |
| --- | --- |
| Primary comparisons | Reading setup, completed reading, populated Journal, empty Journal, and Account at 1440 × 1000 and 390 × 844, in dark and light themes; use ordinary guest and Pro demo identities |
| Guest access and quiet variant | Guest Journal → Settings in one tap; visible Settings and Sign in at 320px; a representative password form and guest shared reading showing the same frame with no desktop or handset destinations |
| NAV-01 to NAV-05 | Header alignment/height, desktop tabs immediately after the brand, one active destination placement with the hidden copy disabled, and distinct completed/current/upcoming step treatments on the representative surfaces |
| NAV-06 and NAV-07 probes | Measured bottom clearance; one keyboard-open/close case, one short-landscape case, and the longest real generating/busy and follow-up labels where displayed; verify focus handoff and `hidden`/`inert` behavior without running every reading phase |
| Visual decisions | Judge the 64rem header against the wider Reading canvas at 1440px; record whether the provisional 25%/40% budgets and the short-view rule should be retained or adjusted |

Use Chromium for the primary visual comparisons and bounded WebKit spot checks for NAV-04, NAV-06, and NAV-07. Passing Gate 1 means the visible design and its basic layout/focus behavior are ready for the user's visual decision, with the height-budget evidence recorded. It does not claim that every route, account state, or reading lifecycle has passed integration testing.

Defer Free/local data verification, long-name/auth-loading/fetch-failure matrices, the full 200% text sweep, dirty-profile exit paths, complete PWA checks, and remaining supporting-route behavior to Gate 2. Keep their contracts in the spec and preserve their existing implementations during prototyping; deferral is not permission to deliberately bypass a guard. Record incidental failures without expanding Gate 1 into the full release suite.

### Gate 2 — Integration and regression validation

After Gate 1 visual approval, integrate the accepted design and validate all NAV-01 through NAV-12 against the full matrix. Gate 2 includes the expanded cases for NAV-01 through NAV-07; a representative prototype pass is not a substitute for this coverage. Confirm the chosen height policy from Gate 1 against enlarged text and the remaining action states, adjusting it if the broader evidence requires it.

| Coverage | Required cases |
| --- | --- |
| Primary visual comparison | Reading setup, completed reading, populated Journal, empty Journal, Account; desktop 1440 × 1000 and handset 390 × 844; dark and light |
| Authentication and data | Guest, including Journal → Settings without sign-in; signed-in Pro through real local auth; Free with local readings; loading and failed auth/data fetches; long account name |
| Layout boundaries | 320px; 768px and 769px; 1024px and 1440px; touch-first desktop-site layout; short landscape; 200% text; safe-area changes |
| Reading phases | Setup, shuffle, deal/reveal, generating, failure/retry, completed, saving, saved, follow-up, settings, first-run welcome, tutorial replay |
| Account protection | Dirty profile → brand, top/dock destinations, pricing, Sign out, replay, browser Back; stay and discard; direct and in-page `#subscription` |
| Navigation and overlays | Active routes, nested Gallery route, direct loads, browser history, modified links, keyboard traversal, hidden mounted-copy isolation, menu close/focus return, route announcements |
| Supporting routes | Pricing, Gallery, reset/verify forms, shared-reading loaded/loading/error/guest states, design reference; quiet routes keep destinations suppressed after auth, keyboard, and viewport changes |
| PWA and viewport | Installation openers, prompt/sheet focus, keyboard opening/closing, orientation, reduced motion, modal isolation, end-of-page clearance |

At Gate 2, run affected browser checks in Chromium and WebKit. Ensure the relevant cases are actually collected by the project's configuration; do not claim coverage from a zero-test command or silently omit handset-tagged cases.

Existing tests requiring integration review include:

- [responsive-adaptation](../../../e2e/responsive-adaptation.spec.js), [question-field](../../../e2e/question-field.spec.js), [mobile-overlays](../../../e2e/mobile-overlays.spec.js), and [frontend-p1-hardening](../../../e2e/frontend-p1-hardening.spec.js).
- [account-data-safety](../../../e2e/account-data-safety.spec.js), [account-recovery](../../../e2e/account-recovery.spec.js), [storage-hardening](../../../e2e/storage-hardening.spec.js), and [account-plan-hardening](../../../e2e/account-plan-hardening.spec.js).
- [journal-responsive-adaptation](../../../e2e/journal-responsive-adaptation.spec.js), [journal-visual-restoration](../../../e2e/journal-visual-restoration.spec.js), and [reading-deck-scope](../../../e2e/reading-deck-scope.spec.js).
- [pwa-install](../../../e2e/pwa-install.spec.js), [pwa-install-lifecycle](../../../e2e/pwa-install-lifecycle.spec.js), [share-note-hardening](../../../e2e/share-note-hardening.spec.js), and [page-transitions](../../../e2e/page-transitions.spec.js).
- [navigationLayout](../../../tests/navigationLayout.test.mjs) and [playwrightFrontendConfig](../../../tests/playwrightFrontendConfig.test.mjs). The former currently asserts enlarged desktop chrome and filled active navigation. Update those assertions to the approved contract; preserve behavioral/browser geometry coverage instead of merely deleting failing expectations.

The implementation plan must separate Gate 1 prototype tasks from Gate 2 integration tasks, map requirements to existing cases, and add only missing behavioral coverage. Preserve valid regressions. At Gate 2, run the affected browser matrix, `npm run lint`, `npm run build`, and `npm test`; run documentation checks when updating the design contract. Record exact counts and remaining gaps for each gate separately. This spec amendment does not itself establish any new application test pass.

## 11. Acceptance checklist

Gate 1 evaluates NAV-01 through NAV-07 on its representative surfaces and probes. Gate 2 revalidates those criteria across the full matrix and completes NAV-08 through NAV-12. All percentages in the fallback policy remain provisional until supported by prototype evidence; acceptance concerns usable space, focus, clearance, and action reachability rather than adherence to an unvalidated number.

- [ ] **NAV-01 — One frame:** Included routes use the same app-bar wrapper. At a fixed viewport and session state, brand/account alignment differs by no more than 1 CSS pixel across routes.
- [ ] **NAV-02 — Normal height:** The bar measures 56px ±1 CSS pixel plus top safe area at normal text size. Enlarged text may increase height without clipping.
- [ ] **NAV-03 — Brand and account:** Mark, wordmark, guest Settings, and Sign in fit at 320px. A guest on Journal reaches Settings in one tap without signing in. Signed-in Account remains usable; Gate 2 extends verification to long identity strings and auth loading.
- [ ] **NAV-04 — Destinations:** Routes with destinations enabled expose exactly one destination group in normal desktop or handset layout; every inactive mounted copy is `hidden` and `inert`. Quiet routes expose zero destination groups and reserve no empty dock. Desktop links form the left cluster after the brand. Route matching and `aria-current` are correct; there is no filled active pill.
- [ ] **NAV-05 — Progress:** Reading steps are in the canvas, distinguish completed/current/upcoming states, remain keyboard operable, preserve step handlers, and never become an extra header row. Skipped optional steps are not falsely announced as completed.
- [ ] **NAV-06 — Bottom ownership:** The handset frame owns contextual actions and navigation. Safe area, keyboard offset, and content clearance are counted once; final-page content and focus remain unobscured.
- [ ] **NAV-07 — Height fallback:** Gate 1 validates the provisional budget/release policy with its longest-action-label, short-screen, and keyboard probes, recording any revised thresholds. Hidden dock focus moves to the heading when needed. Gate 2 extends the policy to enlarged text and the full matrix, without lost actions, duplicate navigation, stale offsets, or stranded focus.
- [ ] **NAV-08 — Account safety:** All specified dirty-profile exit paths prompt once. Staying preserves edits; discarding reaches the requested destination without a history bounce. Section hashes remain in-page actions.
- [ ] **NAV-09 — Reading behavior:** Step navigation, generation/retry/cancellation controls, saving, follow-up, settings, and restoration retain their established behavior.
- [ ] **NAV-10 — Overlays and PWA:** Menus, auth, onboarding, and installation flows preserve focus, Back/Escape handling, layering, and inert backgrounds on both browser engines.
- [ ] **NAV-11 — Theme and accessibility:** Dark/light, increased contrast, reduced motion, keyboard, 320px, and 200% text checks pass; device and assistive-technology gaps are stated honestly.
- [ ] **NAV-12 — Scope and evidence:** No backend or account-data behavior changes. The prototype has a verified source identity and usable URL, and the approved implementation has recorded local validation.

## 12. Review and delivery sequence

1. The user's prototype approval and the requested amendments are incorporated in this spec. Direction A, guest Settings, left-clustered desktop destinations, and the quiet auth/share variant form the prototype brief.
2. Produce an implementation plan with separate Gate 1 and Gate 2 work, tied to the acceptance checklist and confirmed source baseline.
3. Build and verify the isolated prototype at Gate 1. Share a separate live URL, desktop/handset captures, and the height-budget findings alongside the unchanged baseline preview for visual review.
4. Incorporate visual feedback. Apply the visually approved version to the header-navigation branch, update the affected tests and navigation design documentation, and complete Gate 2 local validation.
5. Commit, push, and update PR #118 only when requested. Preserve unrelated files, existing critiques, and the comparison preview throughout.

This amendment changes only the specification. The approved next work is the implementation plan and isolated prototype; integration remains subject to visual approval, and publication remains a separate request.
