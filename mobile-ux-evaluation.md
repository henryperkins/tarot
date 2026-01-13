Assumptions (based on repo): Tableau is primarily a mobile PWA (React/Vite) used in Safari/Chrome and "installed" standalone via `manifest.webmanifest`; the core mobile flows are `/` (reading), `/journal` (journal + insights), `/journal/gallery` (card collection), plus full-screen overlays (onboarding, intention coach, drawers).

**1. Executive Summary (Top Recommendations)**
- ✅ ~~Issue/Opportunity: PWA/offline shell is brittle (missing icon assets + misbranded offline screen). Recommended Fix: align icon paths + precache list to real PNGs and update offline page copy/CTAs. Expected Impact: higher install/offline success, fewer "broken app" moments, improved trust/retention.~~ **FIXED**
- ✅ ~~Issue/Opportunity: iOS safe-area is partially implemented but the viewport isn't configured to use it. Recommended Fix: add `viewport-fit=cover` and audit sticky/fixed elements for safe-area insets. Expected Impact: prevents notch/home-indicator collisions; smoother iPhone experience and fewer accidental taps.~~ **FIXED**
- ✅ ~~Issue/Opportunity: Key mobile input lacks an accessible label (quick intention). Recommended Fix: add a real label/`aria-label` and helper text tied to the field. Expected Impact: better accessibility (VoiceOver/TalkBack) and fewer user errors.~~ **FIXED**
- ✅ ~~Issue/Opportunity: Several tap targets are under the 44px minimum (filters, back links, "reset reveals", carousel arrows). Recommended Fix: standardize minimum hit area to 44px and consolidate secondary actions into larger controls. Expected Impact: fewer mis-taps, faster completion of reading/journal tasks.~~ **FIXED**
- ✅ ~~Issue/Opportunity: Android system Back doesn't consistently dismiss overlays (only onboarding handles it). Recommended Fix: apply the onboarding `popstate` guard pattern to coach/drawers/modals. Expected Impact: fewer rage-quits; better platform-native feel.~~ **FIXED**
- ✅ ~~Issue/Opportunity: Reduced-motion preference isn't respected for some attention animations. Recommended Fix: disable `animate-pulse`/similar when `prefers-reduced-motion`. Expected Impact: accessibility compliance and improved comfort for motion-sensitive users.~~ **FIXED**
- ✅ ~~Issue/Opportunity: Journal "Pulse" uses 9–10px labels that are hard to read on phones. Recommended Fix: raise minimum label size (12–14px), reduce tracking, and re-balance hierarchy. Expected Impact: higher comprehension and engagement with insights (journal stickiness).~~ **FIXED**
- ✅ ~~Issue/Opportunity: Card Collection filtering UI is cramped and unlabeled. Recommended Fix: move filters into a bottom-sheet (phones) with clear Apply/Clear and 44px controls + proper field labels. Expected Impact: easier exploration and more time spent in collection/journal flows.~~ **FIXED** (accessibility labels + 44px targets; bottom-sheet deferred)

**2. Strengths & What to Preserve**  
- Mobile action bar is strong: context-aware states + keyboard avoidance + safe-area padding (`src/components/MobileActionBar.jsx:6`).  
- Spread selection is mobile-first (snap carousel, selected state, premium lock cues) (`src/components/SpreadSelector.jsx:381`).  
- Deck ritual supports both gestures and explicit buttons (good for accessibility and learnability).  
- Narrative readability is carefully constrained (line length, long-text guardrails, “show all now” control).  
- Onboarding supports resume-later + back-button guard + safe-area padding (great mobile foundation).  
- Accessibility baseline is solid in many places (skip links, `aria-live`, focus management via `useModalA11y`).

**3. Detailed Findings & Fixes**  

| ID | Location | Issue Description | Why It's a Problem | Severity | Suggested Fix | Effort | Status |
|---|---|---|---|---|---|---|---|
| UX-1 | PWA shell + offline (`index.html:7`, `index.html:10`, `public/sw.js:4`, `public/offline.html:6`) | Icon references point to missing SVGs; SW precache includes missing icon URLs; offline page is branded "Mystic Tarot". | Can break SW install (offline won't work) and hurts trust/brand consistency. | Critical | Update favicon + SW precache to existing PNGs (`/icons/icon-192.png`, `/icons/icon-512.png`) and rebrand offline page to Tableau; add "Open Journal" + "Retry" CTAs. | Low | ✅ **FIXED** |
| UX-2 | Viewport/safe-area (`index.html:7`, `public/offline.html:5`) | Missing `viewport-fit=cover` despite safe-area utilities throughout the UI. | iOS notch/home indicator handling can be inconsistent; safe-area CSS may not behave as intended in standalone. | High | Set viewport to include `viewport-fit=cover`; audit sticky elements (e.g., top toolbars) to use safe insets. | Low–Med | ✅ **FIXED** |
| UX-3 | Reading setup (handset) – question entry (`src/components/QuickIntentionCard.jsx:76`) | Quick intention `<textarea>` has no label/`aria-label`. | Violates basic form accessibility (WCAG label requirement); VoiceOver/TalkBack users won't know what the field is. | High | Add visible label ("Your question (optional)") or SR-only label + `id/htmlFor`; keep placeholder as example only. | Low | ✅ **FIXED** |
| UX-4 | Reading flow – "Reset reveals" (`src/components/ReadingDisplay.jsx:344`) | "Reset reveals" button likely <44px tall. | Missed taps and frustration; violates mobile hit target guidance (iOS HIG / Material). | Medium | Add `min-h-[44px]` + larger padding; consider moving into the bottom action bar as a secondary action when `revealedCards.size > 0`. | Low | ✅ **FIXED** |
| UX-5 | Spread selection carousel arrows (`src/components/SpreadSelector.jsx:352`, `src/components/SpreadSelector.jsx:374`) | Arrow buttons are `40x40`. | Harder to hit one-handed; small targets increase error rate. | Medium | Increase to 44px and/or expand the hit area (invisible padding) while keeping visuals compact. | Low | ✅ **FIXED** |
| UX-6 | Service/deck warning banners (`src/TarotReading.jsx:700`, `src/TarotReading.jsx:718`) | Uses `animate-pulse` regardless of reduced-motion preference. | Motion sensitivity/accessibility issue; unnecessary attention draw. | Medium | Add `motion-reduce:animate-none` (or conditional rendering via `useReducedMotion`) and rely on static icon + copy. | Low | ✅ **FIXED** |
| UX-7 | Journal top bar back affordance (`src/components/Journal.jsx:837`) | "Back to Reading" is a plain text button with no minimum hit area. | Hard to tap; inconsistent with other 44px CTAs; also duplicates `GlobalNav`. | Medium | Make it a 44px button (icon + label) or remove it and rely on `GlobalNav` + floating "New Reading" CTA when scrolled. | Low | ✅ **FIXED** |
| UX-8 | Journal Pulse typography (`src/components/Journal.jsx:975`, `src/components/Journal.jsx:996`, `src/components/Journal.jsx:1030`) | Key labels are `9–10px` with heavy tracking. | Readability/accessibility risk on phone screens; increases cognitive load for "Average Users". | High | Raise to ≥12px for labels; reduce tracking; keep hierarchy via weight/color rather than tiny type. | Low–Med | ✅ **FIXED** |
| UX-9 | Card Collection filters (`src/pages/CardGalleryPage.jsx:385`, `src/pages/CardGalleryPage.jsx:405`) | Filters use small tap targets; selects lack labels; status buttons don't expose selection semantics. | Poor thumb usability + accessibility gaps (unlabeled form controls). | High | Add `aria-label` for selects, convert "All/Found/Missing" into a 44px segmented control with `aria-pressed`, and consider a bottom-sheet filter UI on phones. | Med | ✅ **FIXED** |
| UX-10 | Card Collection back affordance (`src/pages/CardGalleryPage.jsx:348`) | "Back to Journal" is a small text button (no min hit). | Same tap-target issue as journal. | Medium | Upgrade to 44px button; optionally make it a standard top app bar pattern. | Low | ✅ **FIXED** |
| UX-11 | Onboarding vs other overlays (Back behavior) (`src/components/onboarding/OnboardingWizard.jsx:202`) | Onboarding guards `popstate`, but other overlays (coach/drawers/modals) don't. | On Android, system Back should dismiss the top-most overlay before navigating routes. | High | Reuse the same history-guard pattern for `MobileSettingsDrawer`, `GuidedIntentionCoach`, `FollowUpDrawer`, `CardModal`. | Med | ✅ **FIXED** |
| UX-12 | Card detail secondary CTA (`src/components/ReadingBoard.jsx:43`) | "Open full card" button likely below 44px. | Tap difficulty while holding phone; secondary action still needs a safe target. | Low | Apply `min-h-[44px]` and slightly larger padding; consider icon + label. | Low | ✅ **FIXED** |
| UX-13 | Onboarding step dots (`src/components/onboarding/OnboardingProgress.jsx:39`) | Step buttons are 32–36px. | Small targets for a high-frequency navigation control. | Low–Med | Increase to 44px on phones or make dots non-interactive (progress only) and rely on Next/Back. | Low | ⏭️ **SKIPPED** (intentional tradeoff: 7×44px overflows narrow screens; Next/Back buttons provide alternative nav) |
| UX-14 | Spread step progress microtype (`src/components/StepProgress.jsx:151`) | Mobile step labels drop to ~0.65–0.78rem; optional marker is even smaller. | Readability risk; "Ritual (opt)" may be missed. | Low–Med | Bump label size to `text-xs-plus` on phones; reduce truncation by using icons + one-word labels consistently. | Low | ✅ **FIXED** |

**4. Prioritized Roadmap**
- ✅ **Phase 1 (COMPLETE)**: UX-1, UX-2, UX-3, UX-4, UX-5, UX-6, UX-8
- ✅ **Phase 2 (COMPLETE)**: UX-7, UX-9, UX-11 (unified overlay/back handling via `useAndroidBackGuard` hook)
- ✅ **Phase 3 (COMPLETE)**: UX-10, UX-12, UX-14 (polish + consistency); UX-13 skipped as intentional space-efficiency tradeoff

---

**5. Implementation Log**

| Date | Items | Changes Made |
|------|-------|--------------|
| 2026-01-13 | UX-1 | Updated `index.html` favicon to `/icons/icon-192.png`, fixed `sw.js` cache name to `tableau-v1` and precache paths, rebranded `offline.html` to "Tableau" with Journal/Retry CTAs |
| 2026-01-13 | UX-2 | Added `viewport-fit=cover` to viewport meta in `index.html` and `offline.html` |
| 2026-01-13 | UX-3 | Added `aria-label="Your question or intention (optional)"` to textarea in `QuickIntentionCard.jsx` |
| 2026-01-13 | UX-4 | Added `min-h-[44px]` and `touch-manipulation` to Reset reveals button in `ReadingDisplay.jsx:344` |
| 2026-01-13 | UX-5 | Increased carousel arrow buttons from `min-w-[40px] min-h-[40px]` to `min-w-[44px] min-h-[44px]` in `SpreadSelector.jsx:352,374` |
| 2026-01-13 | UX-6 | Added `motion-reduce:animate-none` to pulse animations in `TarotReading.jsx:700,718` |
| 2026-01-13 | UX-8 | Changed Journal Pulse labels from `text-[9px]`/`text-[10px]` to `text-xs` (12px) and reduced tracking in `Journal.jsx:975,996,1030` |
| 2026-01-13 | UX-7 | Added `min-h-[44px]`, `touch-manipulation`, rounded styling and focus ring to Journal "Back to Reading" button in `Journal.jsx:837` |
| 2026-01-13 | UX-9 | Added `aria-label`, `min-h-[44px]`, `touch-manipulation` to filter selects; added `role="group"`, `aria-label`, and `aria-pressed` to status buttons in `CardGalleryPage.jsx:388-454` |
| 2026-01-13 | UX-11 | Created `useAndroidBackGuard` hook (`src/hooks/useAndroidBackGuard.js`) and integrated into `MobileSettingsDrawer`, `GuidedIntentionCoach`, `FollowUpDrawer`, and `CardModal` for consistent Android back button handling |
| 2026-01-13 | UX-10 | Added `min-h-[44px]`, `touch-manipulation`, rounded styling and focus ring to Card Collection "Back to Journal" button in `CardGalleryPage.jsx:348` |
| 2026-01-13 | UX-12 | Added `min-h-[44px]`, `touch-manipulation`, and focus ring to "Open full card" button in `ReadingBoard.jsx:43` |
| 2026-01-13 | UX-14 | Increased step label font sizes from `text-[0.65rem]`/`text-[0.68rem]` to `text-[0.7rem]`/`text-xs` (12px) and improved "(opt)" marker visibility in `StepProgress.jsx:192-207` |
| 2026-01-13 | UX-13 | **SKIPPED** — Onboarding step dots kept at 32-36px as intentional tradeoff (7×44px would overflow 375px screens; Next/Back buttons provide alternative navigation) |
