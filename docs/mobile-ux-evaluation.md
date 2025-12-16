**Assumptions (So You Know What This Is Based On)**  
- I’m evaluating the current mobile UX from the React/Tailwind codebase (not a native iOS/Android build). I’m assuming Tableu is used as a mobile web app / PWA / WebView wrapper.  
- I’m focusing on the requested critical flows (onboarding → first reading → narrative → journal) and calling out only issues I can tie to specific screens/components.

---

## 1) Executive Summary (Top 5–10 Recommendations)

- **Mobile deck selection is effectively missing** → Add the existing `DeckSelector` into the mobile settings drawer as a first-class “Deck” section (not just a label + “Change” link). **Impact:** higher personalization satisfaction, better retention, fewer “can’t change deck” drop-offs.
- **Too many competing “where am I / what next” cues on mobile** (sticky step progress + extra 2-button step nav + bottom action bar) → Keep one step navigator (recommend: the sticky `StepProgress`) and remove/merge the redundant mobile 2-button step nav. **Impact:** lower cognitive load, faster first-reading completion.
- **Spread selection doesn’t smoothly hand off to intention** (users must discover/scroll to the question area) → After selecting a spread, auto-scroll to the Quick Intention card and focus the field (or show an inline “Next: add your question” CTA anchored above it). **Impact:** improves onboarding-to-reading conversion.
- **Touch targets are inconsistent (several <44px)** in key moments (banner CTAs, “Save to Journal” in the narrative card, some coach/template controls) → Standardize to 44px minimum touch targets everywhere on mobile. **Impact:** fewer mis-taps, better accessibility, better perceived polish.
- **Settings/Coach access disappears mid-flow** (e.g., while revealing/generating) → Keep a persistent “More” affordance in the bottom action bar (overflow menu) across all modes (Reveal/Generate/Completed). **Impact:** fewer “I can’t find voice/theme/ritual” dead ends.
- **Ritual intent is easy to skip unintentionally** because “Draw cards” is always the obvious primary CTA → Before first shuffle, make the action bar offer a clear fork: “Start draw” + a secondary “Ritual (optional)” that opens the ritual controls. **Impact:** better beginner guidance and higher feature discovery without slowing experts.
- **Journal → Start Reading suggestions don’t appear to prefill** (state is passed but not consumed) → Ensure suggested spread + suggested question actually land in the reading setup UI. **Impact:** strengthens the journal loop (retention driver) and reduces “why didn’t it use my suggestion?” frustration.
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
  - **Issue:** “Deck: … / Change” implies deck art can be changed on mobile, but the mobile drawer doesn’t expose `DeckSelector` (only theme/deck *scope*).  
  - **Why:** Breaks user expectation (Nielsen: consistency + error prevention) and blocks a core personalization lever.  
  - **Severity:** **Critical**  
  - **Fix:** Add a **Deck** section inside the mobile drawer (tab or top section) that reuses the existing deck carousel; keep “Change deck” as a direct deep-link to that section.  
  - **Effort:** **Medium**  
  - **Platform notes:** Both iOS/Android; more painful on phones because deck selector is currently desktop-only.

- **UX-2**  
  - **Location:** Reading – top sticky header (`StepProgress`) + mobile-only 2-step nav (`Spread / Question`)  
  - **Issue:** Redundant step navigation patterns compete for attention; users get two different “progress” UIs.  
  - **Why:** Increases cognitive load and visual clutter; “recognition over recall” suffers when multiple controls represent the same concept.  
  - **Severity:** **High**  
  - **Fix:** Pick one: keep `StepProgress` and remove the 2-button mini nav, or merge them by making `StepProgress` the only step navigator and making it open the drawer for “Question/Ritual” on mobile (already supported).  
  - **Effort:** **Low–Medium**  
  - **Platform notes:** Both.

- **UX-3**  
  - **Location:** Spread selection → Question entry (mobile)  
  - **Issue:** After a spread tap, nothing “moves you forward”; users may not notice the Quick Intention card below.  
  - **Why:** Break in flow momentum (Nielsen: visibility of system status + guidance).  
  - **Severity:** **High**  
  - **Fix:** On spread select: auto-scroll to the Quick Intention card and focus the textarea; alternatively show a temporary anchored toast: “Next: add your question (optional)” with a “Go” button.  
  - **Effort:** **Low**  
  - **Platform notes:** iOS auto-focus can trigger scroll/jump; consider focusing only after user taps “Next”.

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
  - **Issue:** An interactive control exists inside another interactive control (nested button). This often causes unpredictable tap/focus behavior.  
  - **Why:** Accessibility + interaction bug risk (VoiceOver/TalkBack focus order, accidental selection).  
  - **Severity:** **High**  
  - **Fix:** Make the card container non-button (or use a single button with internal disclosure) and implement “Show positions” as a non-nested element (e.g., `<details>` or separate region).  
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
  - **Issue:** The Journal passes suggested spread/question state, but the reading screen doesn’t apply it.  
  - **Why:** Broken promise; damages trust and reduces the value of “guided return” loops.  
  - **Severity:** **High**  
  - **Fix:** On reading load, consume `suggestedSpread` + `suggestedQuestion` and (a) select the spread, (b) prefill intention, (c) optionally open Coach with that suggestion highlighted.  
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
- Add **Deck selection** into mobile settings drawer (fix UX-1).  
- Fix **Journal → Start Reading** prefill so suggestions actually apply (UX-9).  
- Remove/merge redundant **mobile step nav** (UX-2) and add post-spread “Next” handoff (UX-3).  
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

- **UX-1 (Deck selection missing on mobile)**  
  - **Code pointers:** `src/components/QuickIntentionCard.jsx`, `src/TarotReading.jsx`, `src/components/ReadingPreparation.jsx`, `src/components/ExperienceSettings.jsx`, `src/components/DeckSelector.jsx`  
  - **Notes:** `DeckSelector` is gated behind `!isSmallScreen`, while mobile only exposes deck *scope* (Major/Full) via `ExperienceSettings`.

- **UX-2 (Redundant step navigation patterns)**  
  - **Code pointers:** `src/components/Header.jsx` (`StepProgress`), `src/components/StepProgress.jsx`, `src/TarotReading.jsx` (mobile `Spread/Question` nav), `src/components/MobileActionBar.jsx` (step badge + action labels)

- **UX-3 (Spread selection → intention handoff)**  
  - **Code pointers:** `src/components/SpreadSelector.jsx` (calls `onSpreadConfirm`), `src/TarotReading.jsx` (`scrollQuickIntentionIntoView` exists but isn’t called on spread select), `src/hooks/useTarotState.js` (`onSpreadConfirm`)

- **UX-4 (“Draw cards” label / step mismatch)**  
  - **Code pointers:** `src/components/MobileActionBar.jsx` (preparation mode uses `onShuffle` + “Draw cards”), `src/TarotReading.jsx` (step indicator labels), `src/hooks/useTarotState.js` (`shuffle` / confirmation flags)

- **UX-5 (Settings/Coach access disappears mid-flow)**  
  - **Code pointers:** `src/components/MobileActionBar.jsx` (utility buttons only render in preparation), `src/components/MobileSettingsDrawer.jsx`, `src/components/GuidedIntentionCoach.jsx`

- **UX-6 (Touch targets < 44px)**  
  - **Code pointers:** `src/components/PersonalizationBanner.jsx` (banner buttons), `src/components/ReadingDisplay.jsx` (narrative completion banner + action chips), `src/components/GuidedIntentionCoach.jsx` (template/history controls)

- **UX-7 (Nested interactive controls in onboarding)**  
  - **Code pointers:** `src/components/onboarding/SpreadEducation.jsx` (outer spread card is a `<button>` with an inner `<button>` for “Show positions”)

- **UX-8 (“Set Preferences” reopens full onboarding)**  
  - **Code pointers:** `src/components/PersonalizationBanner.jsx`, `src/TarotReading.jsx` (`handlePersonalizationBannerPersonalize` toggles onboarding), `src/components/onboarding` (wizard flow)

- **UX-9 (Journal suggestions not applied in reading)**  
  - **Code pointers:** `src/components/Journal.jsx` (passes `suggestedSpread`/`suggestedQuestion` via router state), `src/TarotReading.jsx` (currently consumes `initialQuestion` + `focusSpread`, not suggestions)

- **UX-10 (Narrative actions split between card and action bar)**  
  - **Code pointers:** `src/components/ReadingDisplay.jsx` (save/narrate/view journal buttons), `src/components/MobileActionBar.jsx` (save/new actions)

- **UX-11 (Android back should close overlays first)**  
  - **Code pointers:** `src/components/MobileSettingsDrawer.jsx`, `src/components/GuidedIntentionCoach.jsx`, `src/hooks/useModalA11y.js` (no `popstate`/history integration today)

- **UX-12 (100vh / `min-h-screen` instability on mobile browsers)**  
  - **Code pointers:** `src/TarotReading.jsx` (app shell uses `min-h-screen`), `src/styles/tarot.css` (currently applies `svh/dvh` only to `.onboarding-modal`)
