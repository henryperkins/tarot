Below is an **addendum** that ingests additional UI surfaces (core reading flow, spread/deck selection, card reveal and reflections, mobile settings drawer, mobile info components, and the Share Reading page) and **refines the earlier evaluation**. New issues are numbered **UX-11+** and plug into the same roadmap phases.

---

## 1. Executive Summary (Refined & Additional Recommendations)

These focus on mobile Tarot reading, card reveal, spread/deck selection, and shared reading views.

1. **Smooth out mobile setup: stacked carousels + quick-intention + bottom bar**

   - **Issue / Opportunity**: On phones, the setup area in [`TarotReading()`](src/TarotReading.jsx:33) stacks a deck carousel, a spread carousel, and a “Quick intention” card above the reading area, with the primary CTA actually in the bottom bar (`Draw cards` in [`MobileActionBar()`](src/components/MobileActionBar.jsx:442)). This can feel busy and makes the next step ambiguous.
   - **Recommended Fix**: On mobile, treat **spread + quick intention** as the main grid, and visually subordinate deck selection behind the “More” / settings drawer (already done partially). Add a slim “Next: Draw cards below” line under Quick Intention when a spread is selected and a question is present.
   - **Expected Impact**: Clearer mental model of the flow; fewer users hunting for the “right” CTA; higher conversion from setup to draw.

2. **Make spread & deck carousels more glanceable and less cognitively heavy on phones**

   - **Issue / Opportunity**: Both [`DeckSelector()`](src/components/DeckSelector.jsx:117) and [`SpreadSelector()`](src/components/SpreadSelector.jsx:126) use large, richly-decorated cards in horizontally scrollable carousels. On small phones, this is **two heavy, scrollable galleries in a row**, with long descriptions.
   - **Recommended Fix**: On small screens, trim per-card copy (one-line description), slightly reduce vertical padding, and add a short, fixed “Recommended for new readers” chip anchored above the first recommended card so users don’t have to read each tile.
   - **Expected Impact**: Faster choice of spread/deck; less “catalog fatigue” in first 10 seconds.

3. **Align mobile question input with iOS text-zoom best practices and scroll behavior**

   - **Issue / Opportunity**: Desktop uses [`QuestionInput()`](src/components/QuestionInput.jsx:7) with `text-base` (16px) to avoid iOS zoom; mobile’s inline quick-intention field in [`TarotReading()`](src/TarotReading.jsx:653) uses `text-sm`, which can trigger zooming on iOS and may be partially obscured by the keyboard + bottom bar.
   - **Recommended Fix**: On small screens, give the Quick Intention `<input>` a `text-base` class and add an `onFocus` handler to scroll it into center view (mirroring the keyboard-avoidance work already done for the bottom bar).
   - **Expected Impact**: Less jarring zoom behavior and fewer “I can’t see what I’m typing” moments while composing questions on phones.

4. **Tighten card reveal & reflections UX on mobile without adding complexity**

   - **Issue / Opportunity**: The card component [`Card()`](src/components/Card.jsx:18) is very rich: swipe-to-reveal, large card art, meanings, symbol overlay, and reflections with character count logic. On small phones, the combined height can be long, especially once reflections are opened for multiple cards.
   - **Recommended Fix**: For mobile, keep only **one fully expanded reflection block visible at a time** (auto-collapse others when a new one opens) and slightly increase line height for the meaning paragraph. Consider showing a “Reflections 2 / 500” micro-label in the card header to reduce the need to scroll down to check progress.
   - **Expected Impact**: More focused reflection writing experience with less vertical thrash.

5. **Reinforce mobile carousel hints and navigation for spreads and cards**

   - **Issue / Opportunity**: Horizontal affordances are already there (edge fades, pulsing arrows in [`SpreadSelector()`](src/components/SpreadSelector.jsx:302) and `Swipe to explore cards →` in [`ReadingGrid()`](src/components/ReadingGrid.jsx:339)), but users may still miss that both spreads and cards are carousels—especially stacked back-to-back on first load.
   - **Recommended Fix**: On the **very first visit on mobile**, show a short one-time banner above spreads: “Swipe to browse spreads; tap to pick one.” and keep the card swipe hint visible slightly longer (e.g., 6s) for the first reading.
   - **Expected Impact**: Reduced risk that users think the first card/spread is the only option; better discovery of multi-card layouts.

6. **Improve Share Reading mobile tab behavior and CTA anchoring**

   - **Issue / Opportunity**: The shared reading page [`ShareReading()`](src/pages/ShareReading.jsx:31) has a nice mobile “Spread / Notes” segmented control, but once you scroll, the toggle bar scrolls away; primary actions like “Add note” live lower in the page.
   - **Recommended Fix**: Make the mobile tab bar sticky at the top of the viewport, and introduce a small bottom-aligned “Add note” button when the Notes tab is active on mobile.
   - **Expected Impact**: Easier collaboration for guests on mobile; fewer users lost between viewing and contributing.

7. **Leverage `MobileInfoSection` instead of tooltips for key mobile explanations**

   - **Issue / Opportunity**: You already built [`MobileInfoSection()`](src/components/MobileInfoSection.jsx:22) as a mobile-friendly alternative to tooltips, but many explanations (e.g., narrative style hint around “Create Personal Narrative” in [`ReadingDisplay()`](src/components/ReadingDisplay.jsx:292)) still rely on [`Tooltip()`](src/components/Tooltip.jsx:16).
   - **Recommended Fix**: For mobile layouts, replace those tooltips with `MobileInfoSection` blocks (“How this narrative is styled”, “How to use these insights”) so explanations are tap-to-expand, stable, and thumb-friendly.
   - **Expected Impact**: Higher comprehension of advanced features on touch devices, lower reliance on hover-like mechanisms.

8. **Further integrate mobile settings drawer with step progress**
   - **Issue / Opportunity**: Step selection in the sticky header (`Spread / Question / Ritual / Reading` in [`Header()`](src/components/Header.jsx:15) + [`TarotReading()`](src/TarotReading.jsx:26)) already routes “Question” and “Ritual” to the [`MobileSettingsDrawer()`](src/components/MobileSettingsDrawer.jsx:31) on small screens, but the drawer itself doesn’t visually echo which **step** you’re fulfilling.
   - **Recommended Fix**: Show a small pill at the top of the drawer (“Step 2 – Question” / “Step 3 – Ritual”) matching the same language as the sticky step bar, and highlight the matching tab in the drawer’s mobile tab strip.
   - **Expected Impact**: Stronger coherence across header, drawer, and bottom bar; users better understand where they are in the flow.

---

## 2. Additional Strengths & What to Preserve (New Surfaces)

Building on the earlier strengths, these are **new positives** surfaced from deeper inspection.

1. **Spread & deck carousels are beautifully executed and mobile-aware**

   - [`SpreadSelector()`](src/components/SpreadSelector.jsx:126) and [`DeckSelector()`](src/components/DeckSelector.jsx:117) both use center-snapping, edge fades, and keyboard-friendly roving tabindex. Landscape-specific sizing (`cardBasisClass` and basis tweaks) shows careful thinking for larger phones and small tablets. Keep the **visual richness and “card gallery” feel**—it’s on-brand and delightful.

2. **Reading grid has an unusually strong mobile layout system**

   - [`ReadingGrid()`](src/components/ReadingGrid.jsx:130) adapts between **carousel**, **compact grid**, and **list** view based on spread type, screen size, and user preference, including a Celtic Cross mini-map and position dots tailored for mobile. This is a high-quality pattern; preserve the layout toggle and mini-map (they meaningfully reduce cognitive load for complex spreads).

3. **Quick intention card is a smart mobile-only optimization**

   - The “Quick intention” section in [`TarotReading()`](src/TarotReading.jsx:653) gives mobile users a lightweight way to set/edit a question without opening a drawer, plus a direct “Coach” button. This is exactly the sort of **inline, low-friction control** mobile flows need. Keep this paradigm and refine it rather than removing it.

4. **Mobile drawer behavior and swipe-to-dismiss are done with care**

   - [`MobileSettingsDrawer()`](src/components/MobileSettingsDrawer.jsx:31) combines **visualViewport-aware padding** with drag-to-dismiss thresholds that avoid accidental closure. It uses `useModalA11y` and safe-area insets. This is a very good implementation; don’t regress these affordances.

5. **Card reveal/zoom affordances are clearly expressed**

   - [`Card()`](src/components/Card.jsx:18) surfaces a large card back with “Tap to reveal”, adds gentle swipe hints, and then gives a prominent zoom/expand button and clickable card area once revealed. On mobile this creates a clear, game-like interaction. The reflections UX (collapsible on small screens) is particularly thoughtful.

6. **Share Reading mobile tabs are a great foundation**

   - The “Spread / Notes” segmented control and tabbed panels in [`ShareReading()`](src/pages/ShareReading.jsx:254) make the shared reading page feel like a native app view on mobile. The minimum 44px tab height and roving keyboard handling are strong; only minor tweaks are needed.

7. **Dedicated mobile info primitives show mobile-specific thinking**
   - [`MobileInfoSection()`](src/components/MobileInfoSection.jsx:22) and `InfoText` are exactly the right response to tooltip limitations on touch devices. The fact that these exist suggests a **strong mobile mental model**; the main work now is just consistent adoption in key screens.

---

## 3. Detailed Findings & Fixes (New / Refined Items)

> These build on top of the earlier UX-1…UX-10. New issues begin at **UX-11**.

---

### UX-11 – Mobile setup area feels visually stacked and a bit overwhelming

- **Location**: Core reading setup – deck card, spread carousel, quick intention band in [`TarotReading()`](src/TarotReading.jsx:613).
- **Issue Description**: On small screens, users see:
  1. A compact deck selector card with a “Change” button.
  2. The large spread selector carousel (art + metadata).
  3. The “Quick intention” card with input, Coach button, and “More” button.
     The **primary action** (Draw cards) lives in the bottom action bar (`preparation` mode in [`MobileActionBar()`](src/components/MobileActionBar.jsx:254)). The result is a lot of vertically stacked controls before you even see the reading area.
- **Why It’s a Problem**:
  - Adds perceived friction and cognitive load on mobile, where users often want a “just show me some cards” first-run.
  - The separation between question input and the actual CTA in the bottom bar may make it feel like there’s no obvious next step after typing.
- **Severity**: Medium–High.
- **Suggested Fix**:
  - On mobile, visually group **Spread + Quick intention** as a single “Step 1/Step 2” block, and lightly downplay deck selection (leave it inside the drawer or as a small “Deck: Rider-Waite-Smith · Change” pill).
  - Under the Quick intention input, add a short line: “Next: tap **Draw cards** at the bottom when you’re ready.” that appears only once a spread is chosen.
  - Consider hiding the “Skip ahead to the reading” link on very small screens; the bottom bar already affords that path.
- **Effort (Estimate)**: Medium.
- **Platform Notes**: Works identically on iOS and Android; only Tailwind/layout changes.

---

### UX-12 – Mobile question input font and scroll behavior

- **Location**: Quick intention input inside [`TarotReading()`](src/TarotReading.jsx:652).
- **Issue Description**: The inline `<input>` uses `text-sm` (~14px) rather than `text-base` and does not have explicit scroll-into-view behavior. On iOS, that size can trigger **automatic zoom**, and the combination of keyboard + fixed bottom bar risks partially obscuring the field.
- **Why It’s a Problem**:
  - Triggers the classic iOS “zoom on focus” artifact (violating expectations if the rest of the app does not zoom).
  - Increases risk that the user can’t see the cursor/caret, especially in landscape.
- **Severity**: Medium.
- **Suggested Fix**:
  - Update the quick intention `<input>` class from `text-sm` to `text-base` (16px), mirroring [`QuestionInput()`](src/components/QuestionInput.jsx:96) which explicitly notes “text-base (16px) prevents iOS zoom on focus.”
  - Add a small `onFocus` handler at this level that calls `scrollIntoView({ block: 'center', behavior: 'smooth' })` inside `requestAnimationFrame` when `window.visualViewport` indicates the keyboard is open, to ensure the field is fully visible.
  - Optionally, reuse the same keyboard-offset logic that powers [`MobileActionBar()`](src/components/MobileActionBar.jsx:442) so scrolling and bottom bar adjustments don’t fight each other.
- **Effort**: Low–Medium.
- **Platform Notes**: Primarily affects iOS Safari/PWA; Android benefits from better scroll positioning.

---

### UX-13 – Cognitive load in stacked spread and deck carousels

- **Location**: Deck selection and spread selection panels in [`DeckSelector()`](src/components/DeckSelector.jsx:117) and [`SpreadSelector()`](src/components/SpreadSelector.jsx:126), as used in [`TarotReading()`](src/TarotReading.jsx:621,644).
- **Issue Description**: Both selectors present large, richly-decorated cards with detailed descriptions. On a 6" phone this results in **two dense, horizontally scrollable “galleries” in a row**, each requiring reading and swiping.
- **Why It’s a Problem**:
  - Violates the mobile guideline of **progressive disclosure** for configuration; many users just want a first reading with sensible defaults.
  - Increases decision fatigue: deck art, spread count, complexity stars, palette chips, footnotes, etc.
- **Severity**: Medium.
- **Suggested Fix**:
  - On small screens, reduce description length to a single sentence and hide the deck’s palette chips under a small “See color palette” `MobileInfoSection`.
  - Use personalization to pre-select a recommended spread and deck (already available via `preferredSpreadDepth` and `DECK_OPTIONS`), and surface an explicit label above the carousel: “Recommended first spread: Three-Card Story” for newbies.
  - Consider collapsing the Deck selector into the mobile settings drawer after first selection; keep only a one-line “Deck: Rider-Waite-Smith · Change” summary on the main screen.
- **Effort**: Medium (mostly layout and copy tweaks).
- **Platform Notes**: Helps on all devices but especially narrow phones.

---

### UX-14 – Card detail view can become very tall on small mobile screens

- **Location**: Revealed card panel and reflections within [`Card()`](src/components/Card.jsx:18).
- **Issue Description**: When a card is revealed on a small phone, the stack becomes: large card art, upright/reversed chip, `CardSymbolInsights`, full-text meaning, and reflections block (toggle + textarea + character count). For spreads with many cards, multiple expanded reflections can push content far below the fold.
- **Why It’s a Problem**:
  - Increases scroll fatigue; violates **“keep primary content within one or two screens”** guideline for key actions (here: reading and reflecting).
  - Makes it harder to compare reflections across cards without lots of scrolling.
- **Severity**: Medium.
- **Suggested Fix**:
  - When `isSmallScreen` is true, enforce **at most one open reflection textarea per spread**: opening a new card’s reflections auto-collapses previous ones (with a small “Tap again to collapse” hint).
  - Optionally provide a compact, per-card “Reflection summary” strip in [`ReadingGrid()`](src/components/ReadingGrid.jsx:359) when reflections exist (e.g., “2 lines of notes” under each card chip), so users can scan without opening each card.
- **Effort**: Medium (local to Card/ReadingGrid).
- **Platform Notes**: Most impactful on narrow iPhones and small Androids; fine on larger screens.

---

### UX-15 – Mobile insight & narrative explanations rely heavily on tooltips

- **Location**: Narrative CTA tooltip around “Create Personal Narrative” and other helper hints in [`ReadingDisplay()`](src/components/ReadingDisplay.jsx:292) and [`ReadingGrid()`](src/components/ReadingGrid.jsx:387).
- **Issue Description**: Some important context is provided via [`Tooltip()`](src/components/Tooltip.jsx:16) (e.g., narrative style description). On touch devices, tooltips are ephemeral and may interfere with tap targets, especially when `asChild` is used.
- **Why It’s a Problem**:
  - Violates mobile best practice to avoid hover-based explanations for critical concepts.
  - Even though the tooltip component itself has excellent accessibility, it’s still less discoverable on phones than a stable text block or expand/collapse section.
- **Severity**: Medium.
- **Suggested Fix**:
  - For mobile `isCompactScreen` or narrow widths, replace tooltips that explain **core concepts** (narrative style, spread insights, etc.) with [`MobileInfoSection()`](src/components/MobileInfoSection.jsx:22) or inline `InfoText`. Example: place a `MobileInfoSection` titled “How we shape your narrative” below the Create Narrative button, containing the explanation currently housed in the tooltip.
  - Keep [`Tooltip()`](src/components/Tooltip.jsx:16) for small, non-critical clarifications or desktop-only states.
- **Effort**: Low–Medium (conditional rendering by breakpoint).
- **Platform Notes**: Improves mobile/touch without harming desktop.

---

### UX-16 – Share Reading mobile view lacks sticky segmentation and clear add-note entry point

- **Location**: Shared reading page mobile segmented control and notes area in [`ShareReading()`](src/pages/ShareReading.jsx:254).
- **Issue Description**: The segmented “Spread / Notes” tabs are strong, but once the user scrolls further down in the Notes view, there’s no persistent “Add note” CTA; the control and tab bar scroll out of view.
- **Why It’s a Problem**:
  - Violates **user flow efficiency** for collaborative input; contributors may read but not realize how to add their own thoughts without scrolling back up.
  - On small devices, it’s easy to lose context about which view (Spread vs Notes) you’re currently in when mid-scroll.
- **Severity**: Medium.
- **Suggested Fix**:
  - Make the segmented control sticky at the top of the viewport (`position: sticky; top: 0`) on mobile, so switching between Spread and Notes is always available.
  - When `mobileView === 'notes'`, introduce a bottom-right floating button or a bottom bar CTA: “Add a note” that scrolls focus to the note form in [`CollaborativeNotesPanel`](src/components/share/CollaborativeNotesPanel.jsx:1) (not shown above, but referenced).
  - Add a small line at the top of Notes: “You’re viewing notes for **[spread name]**.” for orientation.
- **Effort**: Medium.
- **Platform Notes**: Works well as a web app on both iOS and Android; looks familiar to native segmented controls.

---

## 4. Updated Prioritized Roadmap (Incorporating New Findings)

This roadmap merges the earlier set of recommendations with the new UX-11…UX-16 items.

### Phase 1 (Now – High Impact, Low–Medium Effort)

1. **Keyboard & font fixes for mobile question inputs (UX-12)**

   - Raise Quick Intention input to `text-base` and add scroll-into-view on focus.
   - QA on iOS to confirm no zoom and no bottom-bar overlap.

2. **Clarify bottom-bar CTAs in preparation stage and setup area (refines earlier UX-3, UX-11)**

   - Add a short guidance line under Quick Intention tying it to the bottom bar (“Next: tap Draw cards below”).
   - Ensure the bottom bar shows a single, visually dominant primary action in `preparation` mode.

3. **Apply MobileInfoSection to critical explanations instead of tooltips (UX-15)**

   - Swap narrative-style and insight explanation tooltips for `MobileInfoSection` blocks on small screens.
   - Keep tooltips only for optional, non-critical hints.

4. **Enhance discoverability of carousels & swipe hints (UX-5 refinement + UX-13)**

   - Add one-time banners encouraging swipe for spreads and cards.
   - Slightly increase first-run swipe hint duration for card carousel.

5. **Improve Share Reading mobile collaboration affordance (UX-16)**
   - Make the Spread/Notes segmented bar sticky.
   - Add a bottom “Add note” CTA that focuses the note form.

### Phase 2 (Soon – High Impact, Higher Effort)

1. **Simplify and rebalance the mobile setup flow (UX-11 & UX-13)**

   - Visually reorganize mobile deck/spread/question into a clearer stepwise flow (Spread + Quick Intention first, Deck tucked into drawer).
   - Trim descriptive copy in deck/spread tiles for mobile; emphasize recommended options for new users.

2. **Refine Guided Intention Coach for mobile (earlier UX-5)**

   - Implement a “Simple vs Advanced” mode with advanced features (templates, astro, quality meter) behind an accordion.
   - Reduce text density and respect mobile line lengths.

3. **Improve card detail vertical economy (UX-14)**

   - Enforce single-open-reflection at a time on small screens.
   - Add per-card reflection summaries in `ReadingGrid` to support quick scanning without expansion.

4. **Mobile-first journal layout reordering (earlier UX-7)**
   - Move “Journal history” above summary cards and Saved Intentions for mobile.
   - Keep filters/insights in collapsible accordions as currently implemented.

### Phase 3 (Nice-to-Have / Long Term)

1. **Deeper orientation-specific tuning**

   - Create bespoke landscape layouts for core reading, Coach, and Share Reading that use side-by-side arrangements more aggressively (e.g., card + meaning side-by-side, or Spread + Notes on one screen).

2. **Interactive onboarding v2 (earlier UX-1, now informed by core flow)**

   - Redesign onboarding content to mirror the **actual mobile flow** more closely: show deck + spread + Quick Intention as a guided preview, then fade directly into the real screen with the same structure.

3. **Further refine export & sharing flows for mobile power users (earlier UX-8)**

   - On mobile, keep to one primary share CTA while advanced CSV/PDF/visual exports live behind an “Advanced exports” accordion.
   - For custom link composer, default to sensible values and hide advanced parameters unless expanded.

4. **Holistic mobile QA across devices**
   - Test on: iPhone SE/Mini, mainstream iPhone, large Android, and tablets in both portrait and landscape.
   - Pay special attention to: card reflections, Guided Coach, Share Reading tabs, and the interaction between virtual keyboard and bottom bar/drawers.

---

With these refinements, the evaluation now explicitly covers **core mobile reading, spread/deck selection, card reveal and reflections, mobile drawers, and shared readings**, and adjusts prior recommendations to match how these surfaces actually behave in code while preserving the strong foundations you’ve already built.
