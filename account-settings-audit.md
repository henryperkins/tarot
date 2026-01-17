1) **Executive Summary (Top 7-10 Recommendations)**
- Issue/Opportunity: Settings naming is inconsistent (Settings vs Account) -> Recommended Fix: unify labels to "Account & Settings" in header, H1, and menu -> Expected Impact: clearer orientation and higher trust.
- Issue/Opportunity: Long scroll with no quick navigation -> Recommended Fix: add sticky "Jump to" chips tied to existing section anchors -> Expected Impact: faster discovery on mobile and fewer missed controls.
- Issue/Opportunity: Billing management lacks clear next steps and deletion does not imply cancellation -> Recommended Fix: add provider-specific actions and a pre-delete billing warning with a "Manage billing" CTA -> Expected Impact: fewer billing disputes and support contacts.
- Issue/Opportunity: Usage dashboard shows used counts but not remaining or urgency -> Recommended Fix: add "X remaining" callouts, threshold styling, and an upgrade CTA near limits -> Expected Impact: clearer limits and improved upgrade conversion.
- Issue/Opportunity: Archetype Journey toggle has minimal feedback and is duplicated -> Recommended Fix: show "Saving..." and success toasts, unify copy, and add "Manage data" link -> Expected Impact: more confident opt-in/opt-out behavior.
- Issue/Opportunity: Guest CTAs emphasize sign-in only -> Recommended Fix: "Sign in or create account" with a register-first CTA and benefit preview -> Expected Impact: higher account creation conversion.
- Issue/Opportunity: Device-only preferences look account-synced -> Recommended Fix: add "Device-only" chips and microcopy about local storage -> Expected Impact: better expectation alignment.
- Issue/Opportunity: Auto-narrate is locked behind Reader Voice -> Recommended Fix: allow pre-setting or add an inline "Enable Reader Voice" action -> Expected Impact: smoother audio setup.
- Issue/Opportunity: Settings entry points are inconsistent (assumption: /account is the only settings route in current routes) -> Recommended Fix: add a consistent gear entry in reading/journal headers and keep deep links to section anchors -> Expected Impact: higher discoverability.

2) **What’s Working (Preserve)**
- Sectioned layout with icons and SectionCard hierarchy makes scanning easier.
- Guest-accessible settings with clear locked-state messaging avoids dead ends.
- Subscription status line and provider label increase billing transparency.
- Usage progress bars and reset date help with monthly mental model.
- Confirm modals for destructive actions reinforce safety and trust.
- Settings toggles meet touch target sizes and include focus/ARIA states.
- Deep links to `#analytics` and `#audio` already reduce friction in context.

3) **Detailed Findings & Fixes** (table)
| ID | Location | Issue (user perspective) | Why it matters (heuristics / platform guidelines / accessibility) | Severity | Suggested Fix (specific UI/copy/interaction change) | Effort | Platform Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ACC-1 | Account header nav + H1 (`src/pages/AccountPage.jsx`) | "Settings" in nav but "Account" as page title feels inconsistent. | Consistency and standards; orientation. | Medium | Rename to "Account & Settings" in both nav and H1 for authenticated users; keep guest as "Settings." | Low | Same on mobile and desktop. |
| ACC-2 | Title actions + footer link (`src/pages/AccountPage.jsx`) | "Done" and "Back to Reading" feel redundant and unclear. | Efficiency; reduces decision noise. | Low | Keep a single primary exit CTA: "Back to Reading" in the top-right; remove footer link. | Low | Mobile benefits most from reduced scroll. |
| ACC-3 | Section navigation (`src/pages/AccountPage.jsx`) | I have to scroll a lot to reach Audio, Privacy, or Subscription. | Recognition over recall; mobile ergonomics. | Medium | Add a sticky horizontal chip bar: Profile, Subscription, Audio, Display, Reading, Privacy, Actions (anchors already exist). | Medium | iOS Safari: horizontal scroll chips; Android: same. |
| ACC-4 | Guest CTA and locked cards (`src/pages/AccountPage.jsx`, `src/components/UserMenu.jsx`, `src/components/nudges/AccountNudge.jsx`) | I see "Sign in" but not "Create account." | Conversion clarity; reduces friction. | Medium | Update copy to "Sign in or create account"; add secondary "Create free account" button and open AuthModal in register mode. | Medium | Stack buttons vertically on narrow screens. |
| ACC-5 | Profile save feedback (`src/pages/AccountPage.jsx`) | I hit save and the panel closes; not sure it worked. | Visibility of system status. | Medium | Keep panel open with inline "Saved" state and fire a toast on success. | Low | No platform differences. |
| ACC-6 | Subscription status banner + manage CTA (`src/pages/AccountPage.jsx`, `functions/api/create-portal-session.js`) | I am canceled/past-due but unsure where to fix it. | Error recovery and trust. | High | Show provider-specific CTAs (App Store/Play Store vs Stripe) and a short "Next step" line in the banner. | Medium | iOS/Android should link to store subscriptions; desktop to Stripe portal. |
| ACC-7 | Delete account flow (`src/pages/AccountPage.jsx`) | If I delete, will billing stop? | Error prevention; reduces chargebacks. | High | If active/trialing, prepend warning: "Deleting does not cancel billing." Add "Manage billing" button in the modal. | Medium | Store subscriptions need store links. |
| ACC-8 | Usage dashboard stats (`src/pages/AccountPage.jsx`, `functions/api/usage.js`) | I see used/limit but not how many are left. | Decision support; conversion timing. | Medium | Add "X remaining" line and threshold styling (e.g., amber at 80%). Include "Upgrade for more" link. | Medium | Keep copy compact on mobile. |
| ACC-9 | Usage unavailable state (`src/pages/AccountPage.jsx`) | "Tracking unavailable" provides no recovery. | Visibility of system status. | Medium | Add a retry button and microcopy: "Usage updates within a few minutes; limits still enforced." | Low | Same on mobile/desktop. |
| ACC-10 | Archetype Journey toggle (`src/pages/AccountPage.jsx`, `src/components/UserMenu.jsx`, `functions/api/archetype-journey.js`) | Toggle feels inactive; I cannot tell if it saved. | Feedback and reliability. | Medium | Add inline "Saving..." state, success toast, and a "Manage data" link to `/account#analytics`. | Medium | Ensure switch remains 44px touch target. |
| ACC-11 | Device-only preferences (`src/pages/AccountPage.jsx`, `src/contexts/PreferencesContext.jsx`) | I assumed Audio/Theme sync across devices. | Trust and expectation management. | Medium | Add "Device-only" chips and microcopy: "Saved on this device until you sign in." | Low | Mobile chips should be compact. |
| ACC-12 | Auto-narrate lock (`src/pages/AccountPage.jsx`, `src/contexts/PreferencesContext.jsx`) | I cannot pre-set Auto-Narrate unless Reader Voice is on. | Flexibility and efficiency of use. | Medium | Allow toggling regardless of Voice state or add inline "Enable Reader Voice" CTA. | Low | No platform differences. |
| ACC-13 | Settings entry points (`src/components/ReadingPreparation.jsx`, `src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`, `src/pages/CardGalleryPage.jsx`, `src/components/UserMenu.jsx`) | I only find Settings via the menu; it feels hidden. | Discoverability. | Medium | Add a consistent gear icon in reading/journal headers and keep existing deep links to section anchors. | Medium | On mobile, icon-only; desktop, icon + label. |
| ACC-14 | Replay tutorial + sign out (`src/pages/AccountPage.jsx`, `src/components/UserMenu.jsx`) | Actions sit together without extra confirmation; easy mis-tap. | Error prevention on mobile. | Low | Add "Account Actions" header and a sign-out confirmation dialog on mobile. | Low | iOS/Android: standard modal dialog. |

4) **Prioritized Roadmap**
- Phase 1 (Now: high impact, low-medium effort): ACC-1, ACC-3, ACC-5, ACC-7, ACC-8, ACC-11.
- Phase 2 (Soon: high impact, higher effort): ACC-4, ACC-6, ACC-9, ACC-10, ACC-13.
- Phase 3 (Later: nice-to-have): ACC-2, ACC-12, ACC-14.

If you want, I can translate any phase into a concrete implementation checklist with microcopy drafts per component.
