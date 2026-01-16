**Assumptions**
- Review is based on repository source only; I did not run a live build. Observations are inferred from `src` components and styles.
- This is a responsive web app used on mobile Safari/Chrome (not a native wrapper) with the default dark theme.
- Critical flow is spread selection -> intention -> ritual (optional) -> draw/reveal -> narrative -> journal.

**Executive Summary (Top 5-10 Recommendations)**
- Issue/Opportunity: Spread selection uses a preview confirmation bar while the bottom action bar still offers Shuffle and draw. Recommended Fix: Auto-confirm on tap or merge the preview CTA into the action bar and disable shuffle until confirmed. Expected Impact: Faster time-to-first-reading and higher completion.
- Issue/Opportunity: Reveal flow exposes three concurrent interaction models (deck tap, board tap, action bar). Recommended Fix: Pick a primary method per phase and de-emphasize the others until the next phase. Expected Impact: Lower cognitive load and fewer reveal mistakes.
- Issue/Opportunity: Mobile narrative generation CTA is duplicated in-content and in the action bar. Recommended Fix: Keep the action bar as the sole primary CTA on handset and convert the inline CTA to helper copy. Expected Impact: Clearer hierarchy and higher narrative generation rate.
- Issue/Opportunity: Onboarding header area is dense and swipe navigation can misfire. Recommended Fix: Consolidate header elements and tighten swipe detection thresholds. Expected Impact: Improved onboarding completion and fewer accidental step changes.
- Issue/Opportunity: Safe-area handling is inconsistent for key controls. Recommended Fix: Standardize bottom padding and move top-right controls into safe-area aware headers. Expected Impact: Better iOS usability and fewer missed taps.
- Issue/Opportunity: Key microcopy and step context rely on very small type and short-lived tooltips. Recommended Fix: Raise minimum text size and show persistent labels. Expected Impact: Better readability and accessibility.
- Issue/Opportunity: Quick intention placeholder auto-rotates. Recommended Fix: Freeze placeholder and add an explicit Inspire me button to cycle prompts. Expected Impact: Reduced distraction and improved input focus.
- Issue/Opportunity: Follow-up chat is easy to miss on mobile. Recommended Fix: Add a post-narrative inline nudge or highlight the chat button once. Expected Impact: Higher follow-up engagement.
- Issue/Opportunity: No visible offline or low-connectivity feedback on API failure. Recommended Fix: Show a lightweight offline banner and retry guidance near the action bar. Expected Impact: Increased trust and reduced abandonment.

**Strengths & What to Preserve**
- Thematic visual identity is cohesive and distinctive across onboarding, reading, and journal, which supports trust and delight.
- The mobile action bar is state-aware, thumb-friendly, and handles keyboard avoidance well.
- Gesture education (overlay) plus explicit ritual buttons creates a good accessibility balance.
- Narrative streaming includes reduced motion support and a mobile opt-in for long texts, which is thoughtful and performant.
- Journal experience has strong framing (summary band, filters, floating controls) that supports long-term retention.

**Detailed Findings & Fixes**
- UX-1 | Location: Spread selection carousel and preview bar in `src/components/SpreadSelector.jsx`, action bar in `src/components/MobileActionBar.jsx`, flow wiring in `src/TarotReading.jsx` | Issue Description: Selecting a spread triggers a preview confirmation bar while the action bar still offers Shuffle and draw; users can proceed without confirming. | Why It’s a Problem: Violates consistency and adds friction without enforcement (Nielsen consistency). | Severity: High | Suggested Fix: Auto-confirm on tap or merge preview CTA into the action bar and disable shuffle until confirmed. | Effort: Medium | Platform Notes: iOS and Android.
- UX-2 | Location: Preview CTA bar class usage in `src/components/SpreadSelector.jsx`, safe-area utilities in `src/styles/tarot.css` | Issue Description: The preview bar uses `safe-area-pb`, which is not defined, so home-indicator padding may be missing. | Why It’s a Problem: iOS HIG safe-area compliance; CTA can sit under the home indicator. | Severity: Medium | Suggested Fix: Replace with `pb-safe` or add a `safe-area-pb` utility that applies `env(safe-area-inset-bottom)`. | Effort: Low | Platform Notes: iOS primary.
- UX-3 | Location: Deck gestures in `src/components/DeckRitual.jsx`, slot tap in `src/components/SpreadTable.jsx`, action bar in `src/components/MobileActionBar.jsx` | Issue Description: Three parallel ways to reveal cards are available at once. | Why It’s a Problem: Increases cognitive load and ambiguity (Nielsen recognition over recall). | Severity: High | Suggested Fix: Stage interactions: during ritual emphasize deck-only; after deal emphasize board tap; hide or de-emphasize action bar reveal when not primary. | Effort: Medium | Platform Notes: iOS and Android.
- UX-4 | Location: Narrative CTA in `src/components/ReadingDisplay.jsx` plus action bar in `src/components/MobileActionBar.jsx` | Issue Description: The in-content Create Personal Narrative CTA duplicates the action bar CTA on handset while the copy says to use the action bar. | Why It’s a Problem: Competing primaries and conflicting guidance. | Severity: Medium | Suggested Fix: On handset, replace the inline CTA with helper copy and keep the action bar as the single primary action. | Effort: Low | Platform Notes: Mobile only.
- UX-5 | Location: Placeholder cycling in `src/TarotReading.jsx`, Quick Intention input in `src/components/QuickIntentionCard.jsx` | Issue Description: Placeholder text cycles every 4 seconds, which can be distracting during contemplation. | Why It’s a Problem: Reduces content stability and focus (cognitive load). | Severity: Low | Suggested Fix: Freeze placeholder after first render and add an explicit Inspire me control. | Effort: Low | Platform Notes: iOS and Android.
- UX-6 | Location: Onboarding chrome in `src/components/onboarding/OnboardingWizard.jsx`, progress in `src/components/onboarding/OnboardingProgress.jsx` | Issue Description: Small screens show multiple stacked sticky bars (progress, step, skip/resume), shrinking the content viewport. | Why It’s a Problem: Increases scrolling and lowers onboarding completion (mobile heuristics). | Severity: Medium | Suggested Fix: Merge into a single compact header or move skip/resume actions into the bottom action area. | Effort: Medium | Platform Notes: Mobile only.
- UX-7 | Location: Gesture handling in `src/hooks/useSwipeNavigation.js` and usage in `src/components/onboarding/OnboardingWizard.jsx` | Issue Description: Horizontal swipe can trigger during diagonal scroll; no vertical delta check. | Why It’s a Problem: Gesture conflict with scroll (iOS HIG and Material). | Severity: Medium | Suggested Fix: Require abs(deltaX) > abs(deltaY) * 1.5 and deltaY < threshold, or restrict swipes to screen edges. | Effort: Low/Medium | Platform Notes: iOS and Android.
- UX-8 | Location: Guided Intention Coach modal in `src/components/GuidedIntentionCoach.jsx` | Issue Description: Close button is absolute top-right without safe-area padding. | Why It’s a Problem: Can be unreachable under a notch (iOS HIG). | Severity: Medium | Suggested Fix: Place close button in a safe-area aware header or add top inset padding. | Effort: Low | Platform Notes: iOS primary.
- UX-9 | Location: Step context in `src/components/StepProgress.jsx` and small labels in `src/components/SpreadSelector.jsx` | Issue Description: Step context relies on transient tooltips and 0.6 to 0.7rem labels on dark translucent backgrounds. | Why It’s a Problem: Tooltips are weak on touch; small text harms readability (WCAG). | Severity: Medium | Suggested Fix: Use persistent short labels with `text-xs-plus` or `text-sm`, and reserve tooltips for optional detail. | Effort: Low | Platform Notes: iOS and Android.
- UX-10 | Location: Card focus overlay in `src/components/ReadingBoard.jsx` | Issue Description: Swipe navigation triggers on horizontal delta only; vertical scroll gestures can flip cards unintentionally. | Why It’s a Problem: Gesture conflict reduces trust. | Severity: Medium | Suggested Fix: Add vertical delta or angle checks before navigating; consider edge-swipe only. | Effort: Low | Platform Notes: iOS and Android.
- UX-11 | Location: Follow-up CTA in `src/components/MobileActionBar.jsx`, drawer in `src/components/FollowUpDrawer.jsx`, narrative context in `src/components/ReadingDisplay.jsx` | Issue Description: Follow-up chat is only a small action bar button on mobile. | Why It’s a Problem: Low discoverability limits engagement. | Severity: Medium | Suggested Fix: Add an inline post-narrative card or highlight the action bar button after completion. | Effort: Low | Platform Notes: Mobile only.
- UX-12 | Location: Journal layout in `src/components/Journal.jsx`, summary band in `src/components/journal/JournalSummaryBand.jsx`, floating controls in `src/components/journal/JournalFloatingControls.jsx` | Issue Description: Summary, filters, entries, and multiple New Reading CTAs stack in one long scroll. | Why It’s a Problem: High cognitive load and CTA competition. | Severity: Medium | Suggested Fix: Collapse summary into an expandable section or insights sheet; keep one primary New Reading CTA plus the floating action on scroll. | Effort: Medium | Platform Notes: Mobile only.
- UX-13 | Location: Health check logic in `src/TarotReading.jsx` | Issue Description: Offline or failed health checks only log debug output, leaving users without visible feedback. | Why It’s a Problem: Poor perceived reliability and unclear recovery. | Severity: Medium | Suggested Fix: Detect offline or request failures and show a lightweight banner with retry guidance near the action bar. | Effort: Medium | Platform Notes: iOS and Android.
- UX-14 | Location: Landscape handset logic in `src/TarotReading.jsx`, Quick Intention Card in `src/components/QuickIntentionCard.jsx`, action bar in `src/components/MobileActionBar.jsx` | Issue Description: In landscape, the quick intention card plus header and action bar compress the spread board below the fold. | Why It’s a Problem: Inefficient use of landscape space and slower reveal flow. | Severity: Medium | Suggested Fix: Collapse Quick Intention into a single-line chip or default it into the settings drawer in landscape. | Effort: Medium | Platform Notes: iOS and Android.

**Implementation Status (Current Branch)**
- UX-1: Done. Spread selection now auto-confirms on tap and no preview bar competes with the action bar.
- UX-2: Done via removal of the preview CTA bar; the `safe-area-pb` usage no longer exists.
- UX-4: Done. Mobile inline narrative CTA is removed; helper copy points to the action bar.
- UX-5: Done. Placeholder auto-rotation removed; an explicit “Inspire me” button is added on the quick intention card.
- UX-7: Done. Swipe detection now requires a clear horizontal intent and vertical delta threshold.
- UX-8: Done. Guided Intention Coach close button is now safe-area aware.
- UX-9: Partial. StepProgress labels and spread badges bumped to `text-xs-plus`/`text-xs`; tooltips still present.
- UX-10: Done. Card focus overlay swipe now checks vertical delta/angle before navigating.
- UX-14: Done. Landscape handset uses a compact quick-intention variant to reclaim space.
- UX-3: Done. Reveal flow now stages deck-first then board-first on handset, with action bar de-emphasized during deck focus.
- UX-6: Done. Onboarding header chrome consolidated so small screens no longer stack multiple sticky bars.
- UX-11: Done. Added a post-narrative inline follow-up nudge on handset.
- UX-12: Done. Mobile journal summary now defaults to a collapsed view and removes redundant "Start Reading" CTAs in the journey panel.
- UX-13: Done. Health checks now surface a lightweight mobile connection banner with retry.

**Prioritized Roadmap**
- Phase 1 (Now / High Impact, Low-Medium Effort): Completed: UX-1, UX-2, UX-4, UX-5, UX-7, UX-8. Partial: UX-9.
- Phase 2 (Soon / High Impact, Higher Effort): Completed: UX-3, UX-6, UX-11, UX-12, UX-14.
- Phase 3 (Nice-to-Have / Long Term): Completed: UX-13.

If you want, I can:
1. Translate Phase 1 items into tickets with acceptance criteria and mobile breakpoints.
2. Mock revised mobile flows (spread selection and reveal) for 390x844 and 844x390.
