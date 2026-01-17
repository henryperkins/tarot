1) **Executive Summary (Top 7–10 Recommendations)**
- ✅ Implemented: Guest Settings now includes a sign‑in banner + locked cards with a single CTA in `src/pages/AccountPage.jsx` → Expected Impact: higher conversion and fewer "where is my data" support questions.
- ✅ Implemented: Settings navigation now shows an active Settings item and a top "Done" control in `src/pages/AccountPage.jsx` → Expected Impact: faster navigation on mobile and less scroll fatigue.
- ✅ Implemented: Archetype Journey quick toggle + "View Journey" link now lives in `src/components/UserMenu.jsx` → Expected Impact: better discoverability and clearer consent for analytics.
- ✅ Implemented: Analytics preference now distinguishes 403 vs load errors, stays unknown on failure, and offers retry in `src/pages/AccountPage.jsx` → Expected Impact: fewer false opt‑outs and higher trust.
- ✅ Implemented: Settings toggles are fully tappable with `aria-describedby` wiring and inline error placement in `src/pages/AccountPage.jsx` → Expected Impact: fewer mis‑taps and better accessibility.
- ✅ Implemented: Auto‑Narrate locked state and friendly voice engine labels in `src/pages/AccountPage.jsx` → Expected Impact: faster comprehension and fewer toggling errors.
- ✅ Implemented: Usage dashboard helper text, refresh, last‑updated timestamp, and improved error copy (backed by `functions/api/usage.js`) → Expected Impact: reduced confusion about limits and usage.
- ✅ Implemented: Billing portal now shows inline errors with provider guidance and reliable store‑link navigation in `src/pages/AccountPage.jsx` + `functions/api/create-portal-session.js` → Expected Impact: higher billing task completion.
- ✅ Implemented: Privacy copy now clarifies what syncs vs stays local in `src/pages/AccountPage.jsx` → Expected Impact: stronger trust and consent clarity.

2) **What's Working (Preserve)**
- Subscription card structure is clear and scannable (tier, price, features) in `src/pages/AccountPage.jsx`.
- Usage bars communicate limits/unlimited well in `src/pages/AccountPage.jsx`.
- Upgrade and Manage CTAs are prominent and motion-aware (`prefersReducedMotion`) in `src/pages/AccountPage.jsx`.
- Privacy & Data section groups analytics and exports logically in `src/pages/AccountPage.jsx`.
- Account delete flow uses a confirm modal and explicit consequences in `src/pages/AccountPage.jsx`.
- User menu keeps Settings, Replay Tutorial, and Sign Out reachable in `src/components/UserMenu.jsx`.
- Consistent focus-visible styles and touch targets appear across key controls.

3) **Detailed Findings & Fixes**

| ID | Location | Issue (user perspective) | Why it matters (heuristics / platform guidelines / accessibility) | Severity | Suggested Fix (specific UI/copy/interaction change) | Effort | Platform Notes | Status |
|---|---|---|---|---|---|---|---|---|
| ACC-1 | Account page header + first section (`src/pages/AccountPage.jsx`) | "I am a guest and I do not know what is saved or how to sync." | Visibility of system status; reduce uncertainty | High | Add a top banner for guests with a primary CTA: "Sign in to sync your journal, subscription, and analytics." Lock Profile/Subscription/Privacy sections with a brief note and CTA. | Medium | On iOS Safari, pin the CTA above the safe area; on Android, allow sticky CTA. | ✅ Implemented (banner + locked cards + CTA) |
| ACC-2 | Account page header nav (`src/pages/AccountPage.jsx`) | "I cannot tell I am in Settings, and back navigation is at the bottom." | Navigation clarity; mobile efficiency | Medium | Add an active "Account/Settings" item in the header and a top "Done" / "Back to Reading" button. | Low | iOS expects top-left back; Android users rely on system back but still benefit from a visible CTA. | ✅ Implemented (active nav + Done CTA) |
| ACC-3 | User menu dropdown (`src/components/UserMenu.jsx`) + Archetype Journey toggle (`src/pages/AccountPage.jsx`) | "Archetype Journey is hard to find and I forget where to enable it." | Discoverability; consent visibility | High | Add a quick toggle in the user menu with status text and a link to "View Journey." Example: "Archetype Journey (optional)". | Medium | Keep tap target 44px+ for mobile. | ✅ Implemented (toggle + View Journey) |
| ACC-4 | Analytics fetch and toggle (`src/pages/AccountPage.jsx`) | "The toggle shows Off when my network is flaky." | Error prevention; trust | Medium | On fetch error, keep state unknown (disable toggle) and show "Could not load. Retry." Only set false on explicit 403. | Low | Mobile networks benefit from clear retry states. | ✅ Implemented (unknown state + retry) |
| ACC-5 | SettingsToggle component (`src/pages/AccountPage.jsx`) | "Tapping the label does nothing; only the tiny switch toggles." | Fitts' Law; WCAG target size | Medium | Make the entire row clickable; associate description and error text via `aria-describedby`; place error text below the row. | Medium | Especially important on iOS/Android for 44px minimum targets. | ✅ Implemented (row button + aria wiring) |
| ACC-6 | Auto‑Narrate toggle (`src/pages/AccountPage.jsx`) | "Auto‑Narrate looks off, but I cannot tell why." | Match between system and real world | Medium | Replace "loading" state with a locked visual and helper text: "Requires Reader Voice." Preserve the saved state indicator (e.g., "On (requires Reader Voice)"). | Low | Same on iOS/Android. | ✅ Implemented (locked state + copy) |
| ACC-7 | Voice Engine selector (`src/pages/AccountPage.jsx`) + TTS prefs (`src/contexts/PreferencesContext.jsx`) | "Azure SDK means nothing to me." | Mental model alignment | Low | Rename options to user‑facing labels: "Expressive", "Clear", "Word‑Sync" with short subtitles; show selector even when voice is off (disabled) so users can preselect. | Medium | None. | ✅ Implemented (friendly labels + always visible) |
| ACC-8 | Theme toggle (`src/pages/AccountPage.jsx`) | "Light Mode toggle does not show my current theme at a glance." | Status visibility | Low | Use a segmented control (Light/Dark) or a label "Theme: Dark (tap to change)" with a small preview chip. | Low | None. | ⏳ Not started |
| ACC-9 | Reversal Lens select (`src/pages/AccountPage.jsx`) | "I do not understand the difference between reversal options." | Help and documentation | Low | Add 1‑line descriptions per option or a "Learn more" link; note "Applies to future readings only." | Medium | None. | ⏳ Not started |
| ACC-10 | Usage dashboard (`src/pages/AccountPage.jsx`) + API (`functions/api/usage.js`) | "I do not know what counts and cannot refresh if it looks wrong." | Error recovery; interpretability | Medium | Add "What counts?" text (e.g., "Counts completed readings only"), a last‑updated timestamp, and a Retry button. Replace "Usage tracking unavailable" with "Tracking temporarily unavailable; limits still enforced." | Medium | Android users expect pull-to-refresh; iOS users expect a refresh control. | ✅ Implemented (helper text + refresh + last updated + copy) |
| ACC-11 | Billing portal flow (`src/pages/AccountPage.jsx`) + API (`functions/api/create-portal-session.js`) | "Billing portal failed and I do not know what to do next." | Recovery from errors | High | Show inline error under the button with a "Try again" CTA and provider-specific help. Avoid `window.open` for App Store/Play links; use direct navigation or `<a>` to reduce popup blocking. | Medium | iOS Safari blocks popups; open in the same tab when possible. | ✅ Implemented (inline error + same-tab store nav + error codes) |
| ACC-12 | Subscription status line (`src/pages/AccountPage.jsx`) | "My plan is past due/canceled but there is no clear fix." | Error recovery; subscription retention | Medium | Add a status banner for past_due/unpaid/canceled with a single action: "Update payment" or "Resubscribe." | Low | None. | ⏳ Not started |
| ACC-13 | Privacy copy (`src/pages/AccountPage.jsx`) + prefs storage (`src/contexts/PreferencesContext.jsx`) | "It says preferences sync, but my theme/audio do not move across devices." | Trust; honesty in UX | Medium | Adjust copy to specify what syncs: "Readings and analytics sync. Theme/audio are device‑local." If syncing is planned, add a roadmap note. | Low | None. | ✅ Implemented (copy clarified) |
| ACC-14 | Archetype Journey data control (`src/pages/AccountPage.jsx`) + API (`functions/api/archetype-journey.js`) | "Turning it off does not tell me what happens to my existing data." | Data transparency | Medium | Add "Reset Journey data" with confirm and microcopy: "Turning off stops new tracking; reset clears history." | Medium | Confirm modals should be full‑screen on mobile. | ⏳ Not started |
| ACC-15 | Profile/password edit (`src/pages/AccountPage.jsx`) + API (`functions/api/account/profile.js`, `functions/api/account/password.js`) | "I only discover username/password rules after an error." | Error prevention | Medium | Add inline validation (username/email rules), disable Save until valid, and add show/hide toggles for passwords. | Medium | iOS: add `autoCapitalize="none"` and `autoCorrect="off"` for email. | ⏳ Not started |
| ACC-16 | Export actions (`src/pages/AccountPage.jsx`) | "Export feels frozen for large journals." | Feedback and responsiveness | Low | Add a loading label + spinner ("Preparing export…"), and show how many entries are included. | Low | Mobile downloads can fail silently; keep a toast + inline status. | ⏳ Not started |
| ACC-17 | Replay Tutorial actions (`src/components/UserMenu.jsx`, `src/pages/AccountPage.jsx`) | "I can accidentally restart without warning." | Error prevention | Low | Add a confirm modal or an undo banner ("Tutorial reset. Undo"). | Low | None. | ⏳ Not started |
| ACC-18 | Settings entry points from other screens (`src/components/ReadingPreparation.jsx`, `src/pages/CardGalleryPage.jsx`) | "I land in Settings but not the right section." | Efficiency of use | Low | Add anchor links (e.g., `/account#audio`, `/account#privacy`) and section IDs in `src/pages/AccountPage.jsx`. | Medium | None. | ⏳ Not started |

4) **Prioritized Roadmap**
- **Completed (2026-01-16)**
	- Guest banner + locked sections in `src/pages/AccountPage.jsx` (ACC-1)
	- Active Settings nav + top Done control in `src/pages/AccountPage.jsx` (ACC-2)
	- User menu Archetype Journey toggle in `src/components/UserMenu.jsx` (ACC-3)
	- Analytics preference error state + retry in `src/pages/AccountPage.jsx` (ACC-4)
	- Toggle ergonomics/accessibility in `src/pages/AccountPage.jsx` (ACC-5)
	- Usage dashboard clarity + refresh + last updated in `src/pages/AccountPage.jsx` + `functions/api/usage.js` (ACC-10)
	- Billing portal inline errors + reliable external link handling in `src/pages/AccountPage.jsx` + `functions/api/create-portal-session.js` (ACC-11)
	- Privacy copy accuracy in `src/pages/AccountPage.jsx` (ACC-13)
	- Audio settings clarity + friendly labels in `src/pages/AccountPage.jsx` (ACC-6, ACC-7)

- **Phase 2 (Soon: high impact, higher effort)**
	- Subscription status action banners in `src/pages/AccountPage.jsx` (ACC-12)
	- Archetype Journey reset control in `src/pages/AccountPage.jsx` (ACC-14)
	- Profile/password inline validation + show/hide in `src/pages/AccountPage.jsx` (ACC-15)

- **Phase 3 (Later: nice-to-have)**
	- Theme control refinement and reversal lens explanations in `src/pages/AccountPage.jsx` (ACC-8, ACC-9)
	- Export progress feedback in `src/pages/AccountPage.jsx` (ACC-16)
	- Replay Tutorial confirmation consistency in `src/components/UserMenu.jsx` and `src/pages/AccountPage.jsx` (ACC-17)
	- Deep-linked Settings anchors from other pages (ACC-18)

5) **Design Task Instructions (Remaining Items)**

**ACC-8 Theme control refinement (AccountPage)**
- Goal: Make the current theme obvious at a glance and reduce ambiguity about which mode is active.
- Placement: Theme row in the Account settings page, near existing theme label and preview chip.
- UX requirements:
	- Use a segmented control (Light/Dark) or a single control labeled "Theme: Light/Dark" with a live preview chip.
	- Indicate the active state with clear visual contrast and text (no reliance on color alone).
	- Keep interaction lightweight (single tap to switch).
- States to design: Light selected, Dark selected, focus/keyboard, disabled for guests (locked section), loading if theme is switching.
- Copy guidance: "Theme" label stays; active state should read "Theme: Light" / "Theme: Dark".
- Accessibility: 44px touch targets, keyboard focus ring, aria-pressed for segments if used.
- Acceptance criteria: Users can tell the current theme without interacting; toggle is obvious and accessible.

**ACC-9 Reversal Lens explanations (AccountPage)**
- Goal: Clarify how each reversal option affects readings and when it applies.
- Placement: Under the Reversal Lens selector in the Account settings page.
- UX requirements:
	- Show a 1-line description for the currently selected option.
	- Add a short persistent note: "Applies to future readings only."
	- Optional "Learn more" link only if a valid destination exists in the app docs.
- States to design: default (auto), each option selected, disabled for guests.
- Copy guidance: Keep descriptions short and concrete (7-12 words). Avoid jargon.
- Accessibility: Description text tied to the select via aria-describedby; ensure readable contrast.
- Acceptance criteria: Users can read a clear explanation without changing selections.

**ACC-12 Subscription status action banner (AccountPage)**
- Goal: Surface payment or cancellation issues with a single, clear recovery action.
- Placement: Inside the Subscription card, directly below the status line.
- UX requirements:
	- Show a status banner for past_due/unpaid/canceled states.
	- Provide one primary action: "Update payment" (past_due/unpaid) or "Resubscribe" (canceled).
	- For App Store/Play subscriptions, show provider-specific guidance and a direct "Manage in App Store/Google Play" action.
	- Banner should be visually distinct but not alarming (warning tone).
- States to design: past_due, unpaid, canceled, action loading, action error (inline).
- Copy guidance: Short, direct, no guilt language; include a 1-line explanation.
- Accessibility: Banner should be announced by screen readers; action is keyboard focusable.
- Acceptance criteria: Users in affected states see exactly one recovery CTA and understand next steps.

**ACC-14 Archetype Journey reset control (AccountPage)**
- Goal: Explain data impact of disabling Journey and provide a safe reset option.
- Placement: Within the Archetype Journey section, near the toggle.
- UX requirements:
	- Add a secondary action labeled "Reset Journey data".
	- Provide confirm modal with clear consequences: "Turning off stops new tracking; reset clears history."
	- Confirm modal should be full-screen on mobile and include Cancel/Confirm.
	- Show success toast/message after reset and keep toggle state unchanged unless user changes it.
- States to design: enabled, disabled, reset confirmation, reset loading, reset error.
- Accessibility: Destructive action styling with clear focus state; modal traps focus.
- Acceptance criteria: Users can understand the difference between off vs reset and confirm safely.

**ACC-15 Profile/password inline validation + show/hide (AccountPage)**
- Goal: Prevent avoidable errors by exposing rules before submit and improving password entry.
- Placement: Profile and Password edit forms in Account settings.
- UX requirements:
	- Inline helper text for username/email/password rules shown by default.
	- Validate on blur and on change; disable Save until inputs are valid and changed.
	- Add show/hide toggles for all password fields with accessible labels.
	- Preserve server error mapping (email/username in use, incorrect password).
- Validation rules (design copy must reflect): username 3-30 chars, letters/numbers/underscore; valid email format; new password minimum 8 chars.
- States to design: valid, invalid (inline error), disabled save, loading save, server error.
- Accessibility: autoCapitalize="none"/autoCorrect="off" for email, clear error association, 44px targets for toggles.
- Acceptance criteria: Users see requirements before submitting and can reveal passwords safely.

**ACC-16 Export progress feedback (AccountPage)**
- Goal: Make export actions feel responsive for large journals.
- Placement: Export section under Privacy & Data.
- UX requirements:
	- Show a spinner + label "Preparing export…" while export runs.
	- Display entry count once known: "Includes X entries."
	- Keep CTA disabled while loading; show inline error if export fails.
	- Maintain existing success toast messaging.
- States to design: idle, loading, success (toast + count), error.
- Accessibility: Spinner has aria-label; status text is readable.
- Acceptance criteria: Users see active feedback within 1s of tapping export.

**ACC-17 Replay Tutorial confirmation (UserMenu + AccountPage)**
- Goal: Prevent accidental tutorial resets and keep behavior consistent across entry points.
- Placement: User menu item and Account page action.
- UX requirements:
	- Require confirmation before reset (modal or undo banner).
	- Provide concise description of impact and a safe Cancel.
	- If using undo banner, show "Tutorial reset. Undo" for ~8-10s.
- States to design: default, confirm open, confirm loading, reset success, reset error.
- Accessibility: Modal focus trap or banner with keyboard focus, clear labels.
- Acceptance criteria: No accidental resets without a confirmation step.

**ACC-18 Deep-linked Settings anchors (ReadingPreparation + CardGalleryPage + AccountPage)**
- Goal: Deep links land users in the relevant settings section with clear orientation.
- Placement: Entry points in ReadingPreparation/CardGallery; target sections in AccountPage.
- UX requirements:
	- Use URL hashes (e.g., /account#audio, /account#privacy, /account#analytics, /account#export).
	- On load with hash, scroll to section and highlight it briefly (subtle outline or background).
	- Set focus on the section heading for screen readers.
- States to design: standard navigation, hash navigation with highlight.
- Accessibility: Respect reduced motion (no long scroll animation); focus-visible on headings.
- Acceptance criteria: Users land on the correct section and can tell where they are immediately.
