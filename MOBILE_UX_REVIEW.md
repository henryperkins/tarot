# Mystic Tarot — Mobile UX Review

## Executive Summary (Top Recommendations)
- Long, skip-unclear onboarding: Compress to 3–4 steps with a sticky “Start now” CTA and explicit “Skip onboarding.” Expect faster first-reading rate and lower abandonment.
- Landscape hides personalization controls: Keep focus areas and spiritual framing visible via compact accordions so recommendations stay relevant in any orientation.
- Spread selection carousel obscures details: Preselect a recommended spread, surface positions inline, and add a sticky “Use this spread” button to reduce mis-taps and speed selection.
- Intention entry is high-friction: Autofill with the best-fit question, add 1-tap suggested questions, and slim the coach into a bottom sheet with “Apply” CTA to boost engagement and intent quality.
- Ritual gestures are hidden: Replace long-press/double-tap reliance with an explicit “Cut deck” button plus first-use overlay and presets; improves task success and confidence.
- Save blocked until narrative: Allow “Save cards now, add narrative later” with a queued state to prevent data loss on slow/failed generation.
- Pricing page is a long scroll with diluted CTAs: Add a sticky bottom CTA, tighten copy into bullets, and place a compact comparison above the fold to improve upgrade clarity and conversion.
- Coach lacks contextual nudges: Prefill topic/timeframe from spread/focus and surface “Quick apply” chips under the intention field to raise coach activation without modal fatigue.
- Mobile prep/drawer friction: On phones the “Question/Ritual” steps open a drawer (`TarotReading.jsx`), hiding the primary CTA; keep an inline CTA bar visible to speed first draw.
- Reveal learnability & labels: Swipe hint auto-dismisses after 8s even without interaction (`ReadingGrid.jsx`), and the action bar label “Draw cards” triggers shuffle; add a persistent “Next card” CTA and clearer naming.

## Strengths to Preserve
- Strong mobile-safe touch targets and chip/toggle patterns across onboarding and settings.
- Rich educational copy for spreads and ritual with reduced-motion handling.
- Mobile action bar adapts to reading state and keeps coach/settings access handy.
- Haptics/gestures in DeckRitual add delight for confident users (keep as secondary shortcuts).

## Detailed Findings & Fixes
| ID | Location | Issue | Why It’s a Problem | Severity | Suggested Fix | Effort | Platform Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-1 | Onboarding modal (`OnboardingWizard.jsx` steps 1–7) | 7 steps, heavy scroll, skip hidden behind “X” | High cognitive load; unclear fast path (Nielsen: user control/minimalism) | High | Offer 3–4 step condensed path; sticky bottom “Start now”; explicit “Skip onboarding”; gate optional education behind “Learn more” | Medium | iOS/Android |
| UX-2 | Onboarding landscape (`SpreadEducation.jsx`, `QuestionCrafting.jsx`) | Focus areas + spiritual framing hidden in landscape | Loses personalization → generic recs; orientation inconsistency | High | Always show via compact accordion/chips in landscape; persist settings | Low-Med | Tablets/rotated phones |
| UX-3 | Spread selection (`SpreadSelector.jsx`) | Horizontal carousel hides spreads/positions; no clear recommended default | Poor discoverability; mis-selection risk (recognition over recall) | Medium | Preselect recommended spread; show positions inline; add sticky “Use this spread” CTA with summary | Medium | All |
| UX-4 | Intention entry (`QuestionInput.jsx`, `GuidedIntentionCoach.jsx`) | Typing required before feedback; coach is multi-step modal; save feedback tiny | Beginners stall; coach feels heavy (cognitive load) | High | Autofill best-fit question; add 1-tap suggested questions from spread/focus; coach as bottom sheet with “Apply”; toast/snackbar for “Saved” | Medium | All |
| UX-5 | Ritual gestures (`DeckRitual.jsx`) | Long-press/double-tap not surfaced; cut slider unlabeled | Hidden controls → task failure; mapping issue | High | First-use overlay (“Tap to knock, tap Cut to choose split, double-tap = shuffle”); explicit “Cut deck” button opens slider; presets (Top/Middle/Intuitive) with labels | Medium | All; clarify for screen readers |
| UX-6 | Save flow (`hooks/useSaveReading.js`) | Cannot save without narrative; errors block journal | Data loss if generation fails/slow; hurts trust | High | Allow save of cards+question immediately; queue narrative; show retry/offline banner | Medium | All |
| UX-7 | Pricing page (screens `Tableu_slice1-3.png`) | Long scroll, repeated cards, free buried, small FAQ toggles; no sticky CTA | Choice paralysis; lower upgrade clarity | Medium | Sticky bottom CTA; compact comparison table above fold; bullet copy; move FAQs below divider | Low-Med | All |
| UX-8 | Coach entry (`GuidedIntentionCoach.jsx`, `MobileActionBar.jsx`) | Coach only via modal; no inline nudge when intention empty | Low activation of guidance | Medium | Inline “Need help? Try these” chips under intention field; open coach as prefilled bottom sheet; add shortcut hint in action bar | Medium | All |
| UX-9 | Mobile prep/drawer (`TarotReading.jsx`, `ReadingPreparation.jsx`) | On phones, tapping “Question/Ritual” opens a drawer; main CTA hidden behind it | Extra taps and context switching; slows first draw | Medium | Keep a lightweight inline bar for question/ritual on mobile (or default drawer open until first draw); surface primary CTA (“Shuffle & draw”) without opening drawer | Low-Med | iOS/Android |
| UX-10 | Reveal guidance (`ReadingGrid.jsx`, `MobileActionBar.jsx`) | Swipe hint auto-hides after 8s even if user hasn’t scrolled; action bar “Draw cards” actually shuffles | Learnability gap; label mismatch | Medium | Persist hint until first swipe; rename CTA to “Shuffle & draw”; add a persistent “Next card” primary button after shuffle completes | Low | All |

## Prioritized Roadmap
- Phase 1 (Now, high impact / low–med effort): UX-2, UX-4 quick chips + autofill, UX-5 explicit cut/shuffle overlay, UX-6 save-without-narrative, UX-7 sticky CTA + trimmed pricing copy, UX-9 mobile prep CTA, UX-10 label/hint fixes.
- Phase 2 (Soon, higher effort): UX-1 condensed onboarding with explicit skip, UX-3 recommended spread + inline positions, UX-8 contextual coach sheet.
- Phase 3 (Later, nice-to-have): Ritual presets/haptic tuning, offline/queued narrative state visuals, expanded pricing comparison with testimonials/guarantee strip.
