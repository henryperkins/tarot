**Assumptions (So You Know What This Is Based On)**  
- I’m evaluating the current mobile UX from the React/Tailwind codebase (not a native iOS/Android build). I’m assuming Tableu is used as a mobile web app / PWA / WebView wrapper.  
- I’m focusing on the requested critical flows (onboarding → first reading → narrative → journal) and calling out only issues I can tie to specific screens/components.

---

## 1) Executive Summary (Top 5–10 Recommendations)

- **Mobile deck selection is now exposed on mobile** → Added `DeckSelector` to the mobile settings drawer as a first-class “Deck” tab and deep-linked it from the Quick Intention “Change” action. **Status:** Implemented (Dec 16, 2025). **Impact:** higher personalization satisfaction, better retention, fewer “can’t change deck” drop-offs.
- **Too many competing “where am I / what next” cues on mobile** (sticky step progress + extra 2-button step nav + bottom action bar) → Removed the redundant mobile 2-button step nav and rely on the sticky `StepProgress` + bottom action bar. **Status:** Implemented (Dec 16, 2025). **Impact:** lower cognitive load, faster first-reading completion.
- **Spread selection doesn’t smoothly hand off to intention** (users must discover/scroll to the question area) → On first mobile spread selection, auto-scroll to the Quick Intention card and briefly highlight it (no forced autofocus). **Status:** Implemented (Dec 16, 2025). **Impact:** improves onboarding-to-reading conversion.
- **Touch targets are inconsistent (several <44px)** in key moments (banner CTAs, “Save to Journal” in the narrative card, some coach/template controls) → Standardize to 44px minimum touch targets everywhere on mobile. **Impact:** fewer mis-taps, better accessibility, better perceived polish.
- **Settings/Coach access disappears mid-flow** (e.g., while revealing/generating) → Keep a persistent “More” affordance in the bottom action bar (overflow menu) across all modes (Reveal/Generate/Completed). **Impact:** fewer “I can’t find voice/theme/ritual” dead ends.
- **Ritual intent is easy to skip unintentionally** because “Draw cards” is always the obvious primary CTA → Before first shuffle, make the action bar offer a clear fork: “Start draw” + a secondary “Ritual (optional)” that opens the ritual controls. **Impact:** better beginner guidance and higher feature discovery without slowing experts.
- **Journal → Start Reading suggestions now prefill** → The reading screen consumes `suggestedSpread` + `suggestedQuestion`, applies them, then clears router state. **Status:** Implemented (Dec 16, 2025). **Impact:** strengthens the journal loop (retention driver) and reduces “why didn’t it use my suggestion?” frustration.
- **Viewport-height stability on iOS Safari can still bite** (the app shell uses `min-h-screen` / 100vh patterns) → Adopt `100dvh`/`100svh` for the main app shell (not only onboarding) to reduce jumpiness with browser chrome + keyboard. **Impact:** fewer layout jumps and accidental taps, especially in landscape.

---

## 2) Strengths & What to Preserve

- **Tableu “premium” visual language** (gradients, surfaces, borders) feels cohesive across spreads, coach, and narrative panels—don’t flatten it.
- **Bottom action bar as a state machine** (Draw → Reveal next → Create narrative → Save/New) is the right mobile pattern for this flow.
- **Keyboard avoidance work is unusually thorough** (VisualViewport-based offset + safe-area padding) and should be preserved.
- **Guided Intention Coach is genuinely differentiating** (templates, history, quality scoring, spread-aware suggestions). Keep it prominent.
- **Reduced-motion handling is present across key motion surfaces** (action bar, narrative streaming, onboarding). Keep honoring OS settings.
- **Good use of progressive disclosure** (mobile info sections instead of tiny tooltips; expandable insights) is aligned with beginner needs.

---

## 3) Detailed Findings & Fixes

- **UX-1**  
  - **Location:** Reading setup (mobile) – Quick Intention card + Settings drawer  
  - **Issue (pre-fix):** “Deck: … / Change” implied deck art could be changed on mobile, but the mobile drawer didn’t expose `DeckSelector` (only theme/deck *scope*).  
  - **Why:** Breaks user expectation (Nielsen: consistency + error prevention) and blocks a core personalization lever.  
  - **Severity:** **Critical**  
  - **Fix (implemented Dec 16, 2025):** Added a **Deck** tab inside the mobile drawer that renders `DeckSelector`, and wired Quick Intention “Change” to open the drawer on that tab.  
  - **Effort:** **Medium**  
  - **Platform notes:** Both iOS/Android.

- **UX-2**  
  - **Location:** Reading – top sticky header (`StepProgress`) + mobile-only 2-step nav (`Spread / Question`)  
  - **Issue (pre-fix):** Redundant step navigation patterns competed for attention; users got two different “progress” UIs.  
  - **Why:** Increases cognitive load and visual clutter; “recognition over recall” suffers when multiple controls represent the same concept.  
  - **Severity:** **High**  
  - **Fix (implemented Dec 16, 2025):** Removed the mobile 2-button mini nav; `StepProgress` is now the single step navigator, and on mobile it opens the drawer on the correct tab for “Question/Ritual”.  
  - **Effort:** **Low–Medium**  
  - **Platform notes:** Both.

- **UX-3**  
  - **Location:** Spread selection → Question entry (mobile)  
  - **Issue (pre-fix):** After a spread tap, nothing “moved you forward”; users could miss the Quick Intention card below.  
  - **Why:** Break in flow momentum (Nielsen: visibility of system status + guidance).  
  - **Severity:** **High**  
  - **Fix (implemented Dec 16, 2025):** On first mobile spread selection, auto-scroll to the Quick Intention card and briefly highlight it (avoids forced autofocus).  
  - **Effort:** **Low**  
  - **Platform notes:** iOS autofocus can trigger scroll/jump; this implementation avoids forced focus.

- **UX-4**  
  - **Location:** Mobile action bar – “Draw cards” in preparation mode  
  - **Issue:** Primary CTA says “Draw cards” but the underlying action is shuffle/start; step badge can show “Step 1/2” while the button reads like Step 4.  
  - **Why:** Mismatch between system and real-world mental model; creates uncertainty for beginners (“Am I skipping something?”).  
  - **Severity:** **High**  
  - **Fix:** Rename to “Shuffle & draw” (or “Shuffle deck”) and add sublabel (or helper text once) like “You can still set a question first (optional).” Ensure the step context on the button matches the reading phase.  
  - **Effort:** **Low**  
  - **Platform notes:** Both.

- **UX-5**  
  - **Location:** Mobile action bar during Reveal / Generate / Completed states  
  - **Issue:** No way to access Settings/Coach mid-reading unless you scroll back up; this is especially frustrating when users want to enable voice after seeing the narrative prompt.  
  - **Why:** Breaks “user control and freedom”; increases effort mid-task.  
  - **Severity:** **High**  
  - **Fix:** Add a persistent overflow icon (“More”) in the action bar across all modes (opens a small sheet with Settings, Coach, Theme, Voice toggle, Deck, etc.).  
  - **Effort:** **Medium**  
  - **Platform notes:** Android users expect back to close the sheet; iOS expects swipe-down.

- **UX-6**  
  - **Location:** Multiple screens – small CTAs (e.g., Personalization banner buttons; “Save to Journal” inside narrative banner; coach “Templates”; onboarding progress dots)  
  - **Issue:** Several interactive elements are below 44px height.  
  - **Why:** Violates iOS HIG / Material touch target guidance; increases mis-taps and accessibility risk.  
  - **Severity:** **High**  
  - **Fix:** Standardize minimum 44px touch height for all tappable controls; where space is tight, use fewer controls + overflow menus.  
  - **Effort:** **Low**  
  - **Platform notes:** iOS is more sensitive due to Safari chrome + safe areas; Android has higher variance in tap accuracy.

- **UX-7**  
  - **Location:** Onboarding → Spread Education – “Show positions” inside a spread card  
  - **Issue (pre-fix):** An interactive control existed inside another interactive control (nested button), causing unpredictable tap/focus behavior.  
  - **Why:** Accessibility + interaction bug risk (VoiceOver/TalkBack focus order, accidental selection).  
  - **Severity:** **High**  
  - **Fix (implemented Dec 16, 2025):** Restructured the spread card so selection is one button and “Show positions” is a sibling control (no nested buttons), with `aria-controls` for the expanded region.  
  - **Effort:** **Medium**  
  - **Platform notes:** TalkBack tends to expose nested controls more harshly than iOS.

- **UX-8**  
  - **Location:** Personalization banner (“New: Personalize…”)  
  - **Issue:** CTA (“Set Preferences”) reopens the full onboarding wizard, which may feel like a bait-and-switch when users expect a lightweight settings flow.  
  - **Why:** Violates expectation + increases abandonment risk.  
  - **Severity:** **Medium**  
  - **Fix:** Create a **short preference wizard** (3–4 screens: tone/frame, ritual visibility, spread depth, deck) launched from the banner and from Settings.  
  - **Effort:** **High**  
  - **Platform notes:** Both.

- **UX-9**  
  - **Location:** Journal → “Start reading” from suggestions / empty-state actions  
  - **Issue (pre-fix):** The Journal passed suggested spread/question state, but the reading screen didn’t apply it.  
  - **Why:** Broken promise; damages trust and reduces the value of “guided return” loops.  
  - **Severity:** **High**  
  - **Fix (implemented Dec 16, 2025):** On reading load, consume `suggestedSpread` + `suggestedQuestion` and apply them (spread selection + intention prefill), then clear the router state.  
  - **Effort:** **Low–Medium**  
  - **Platform notes:** Both.

- **UX-10**  
  - **Location:** Narrative view – post-generation actions (save/narrate/view journal)  
  - **Issue:** Actions are split between the narrative card and the bottom action bar, with some in-card buttons visually “small” and easy to miss.  
  - **Why:** Inconsistent hierarchy; duplicates increase noise (especially for beginners).  
  - **Severity:** **Medium**  
  - **Fix:** On mobile, consolidate into one clear action cluster: keep primary actions in the bottom bar; move secondary actions (narration controls, view journal) into a single expandable “Actions” row or overflow.  
  - **Effort:** **Medium**  
  - **Platform notes:** Both.

- **UX-11**  
  - **Location:** Modals/sheets (Settings drawer, Coach)  
  - **Issue:** No explicit handling for Android system back to close overlays first (common expectation in WebView/PWA).  
  - **Why:** Violates platform conventions; increases accidental exits.  
  - **Severity:** **Medium**  
  - **Fix:** Push a history state when opening overlays and close them on `popstate` (so back closes the topmost surface).  
  - **Effort:** **Medium**  
  - **Platform notes:** High impact on Android; iOS Safari back-swipe can also be affected.

- **UX-12**  
  - **Location:** App shell height behavior (especially iOS Safari)  
  - **Issue:** The main shell uses 100vh-style layout (`min-h-screen`), which can cause jumping when browser chrome collapses/expands and when the keyboard opens.  
  - **Why:** Causes perceived instability; can lead to accidental taps near the bottom bar.  
  - **Severity:** **Medium**  
  - **Fix:** Use `100dvh/100svh` for the primary shell (not just onboarding) with a graceful fallback to `vh`.  
  - **Effort:** **Low–Medium**  
  - **Platform notes:** Mostly iOS Safari; still relevant in Android Chrome.

---

## 4) Prioritized Roadmap

**Phase 1 (Now / High Impact, Low–Medium Effort)**  
- Add **Deck selection** into mobile settings drawer (fix UX-1). *(Done Dec 16, 2025)*  
- Fix **Journal → Start Reading** prefill so suggestions actually apply (UX-9). *(Done Dec 16, 2025)*  
- Remove/merge redundant **mobile step nav** (UX-2) and add post-spread “Next” handoff (UX-3). *(Done Dec 16, 2025)*  
- Fix nested onboarding controls in Spread Education (UX-7). *(Done Dec 16, 2025)*  
- Standardize **44px touch targets** for all mobile CTAs (UX-6).  
- Keep **Settings/Coach access** available across action bar states via overflow (UX-5).

**Phase 2 (Soon / High Impact, Higher Effort)**  
- Create a **short “Preferences” wizard** (tone/frame, ritual visibility, spread depth, deck) launched from the banner + settings (UX-8).  
- Add **Android back / history integration** for overlays (UX-11).  
- Update main layout to use **dvh/svh** for stability (UX-12).

**Phase 3 (Nice-to-Have / Long Term)**  
- Rethink navigation as a **mobile bottom tab bar** (Reading / Journal / Account) with contextual reading actions above it (reduces top reach).  
- Add an explicit **text size** control (Small/Default/Large) and a “reduce motion” in-app setting (in addition to OS).  
- A more guided “first narrative” moment: highlight “Save” + “Journal reflection prompt” as a single flow to improve retention.

---

## 5) Repo Map (Verified in Code)

This is the “where do I change code?” map for each UX item (verified against the current repo as of **December 16, 2025**).

- **UX-1 (Deck selection on mobile)**  
  - **Code pointers:** `src/components/ReadingPreparation.jsx`, `src/components/DeckSelector.jsx`, `src/components/QuickIntentionCard.jsx`, `src/TarotReading.jsx`  
  - **Notes:** Implemented via a mobile drawer “Deck” tab (renders `DeckSelector`), with Quick Intention “Change” deep-linking to that tab.

- **UX-2 (Redundant step navigation patterns)**  
  - **Code pointers:** `src/components/Header.jsx` (`StepProgress`), `src/components/StepProgress.jsx`, `src/TarotReading.jsx` (`handleStepNav` opens the drawer on mobile), `src/components/MobileActionBar.jsx` (step badge + action labels)
  - **Notes:** Implemented by removing the redundant mobile `Spread/Question` nav so `StepProgress` is the single step navigator.

- **UX-3 (Spread selection → intention handoff)**  
  - **Code pointers:** `src/TarotReading.jsx` (`handleSpreadSelection`, `scrollQuickIntentionIntoView`), `src/components/QuickIntentionCard.jsx` (highlight), `src/components/SpreadSelector.jsx`
  - **Notes:** Implemented with auto-scroll + brief highlight on first mobile spread selection (no forced focus).

- **UX-4 (“Draw cards” label / step mismatch)**  
  - **Code pointers:** `src/components/MobileActionBar.jsx` (preparation mode uses `onShuffle` + “Draw cards”), `src/TarotReading.jsx` (step indicator labels), `src/hooks/useTarotState.js` (`shuffle` / confirmation flags)

- **UX-5 (Settings/Coach access disappears mid-flow)**  
  - **Code pointers:** `src/components/MobileActionBar.jsx` (utility buttons only render in preparation), `src/components/MobileSettingsDrawer.jsx`, `src/components/GuidedIntentionCoach.jsx`

- **UX-6 (Touch targets < 44px)**  
  - **Code pointers:** `src/components/PersonalizationBanner.jsx` (banner buttons), `src/components/ReadingDisplay.jsx` (narrative completion banner + action chips), `src/components/GuidedIntentionCoach.jsx` (template/history controls)

- **UX-7 (Nested interactive controls in onboarding)**  
  - **Code pointers:** `src/components/onboarding/SpreadEducation.jsx` (selection button + sibling “Show positions” control)
  - **Notes:** Implemented by removing nested interactive controls and adding `aria-controls` for the expanded region.

- **UX-8 (“Set Preferences” reopens full onboarding)**  
  - **Code pointers:** `src/components/PersonalizationBanner.jsx`, `src/TarotReading.jsx` (`handlePersonalizationBannerPersonalize` toggles onboarding), `src/components/onboarding` (wizard flow)

- **UX-9 (Journal suggestions prefill in reading)**  
  - **Code pointers:** `src/components/Journal.jsx` (passes `suggestedSpread`/`suggestedQuestion` via router state), `src/TarotReading.jsx` (consumes suggestions + clears router state)
  - **Notes:** Implemented by applying `suggestedSpread` + `suggestedQuestion` on reading load.

- **UX-10 (Narrative actions split between card and action bar)**  
  - **Code pointers:** `src/components/ReadingDisplay.jsx` (save/narrate/view journal buttons), `src/components/MobileActionBar.jsx` (save/new actions)

- **UX-11 (Android back should close overlays first)**  
  - **Code pointers:** `src/components/MobileSettingsDrawer.jsx`, `src/components/GuidedIntentionCoach.jsx`, `src/hooks/useModalA11y.js` (no `popstate`/history integration today)

- **UX-12 (100vh / `min-h-screen` instability on mobile browsers)**  
  - **Code pointers:** `src/TarotReading.jsx` (app shell uses `min-h-screen`), `src/styles/tarot.css` (currently applies `svh/dvh` only to `.onboarding-modal`)
