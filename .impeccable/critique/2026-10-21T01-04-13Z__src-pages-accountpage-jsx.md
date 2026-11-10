---
target: account settings page (src/pages/AccountPage.jsx)
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
target_identity: "file:/home/ubuntu/tarot/src/pages/AccountPage.jsx"
target_fingerprint: "sha256:98b8b4e1579d10a522fe930f1970765859319e28db1f473e51150d012e0bad4d"
target_path: /home/ubuntu/tarot/src/pages/AccountPage.jsx
timestamp: 2026-10-21T01-04-13Z
slug: src-pages-accountpage-jsx
---
# Critique: Account & Settings (`src/pages/AccountPage.jsx`)

Method: dual-agent (A: ses_ea4145c28ffe3gMicDqJwJQSH6 · B: ses_ea4145c27ffepU2v1kE6VBlTAB)

Surface mode: Operate. Live target `http://localhost:8787/account`, real local login, Pro/active verified on every authenticated state.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Current section never persistently marked (chip tint clears after 1.6s, no `aria-current`); usage shows `10/8/2026` under "updates within a few minutes"; locked Auto-Narrate reads "On." |
| 2 | Match System / Real World | 2 | "Manage in manual," "Billed via manual," "API calls," and "Reversal Lens" leak provider and specialist vocabulary at the highest-stakes moments. |
| 3 | User Control and Freedom | 2 | Toggles commit instantly with no undo; "Done" and the chip nav discard unsaved profile edits silently; Sign Out is immediate. |
| 4 | Consistency and Standards | 2 | Section headers are 14px sans with icons except Actions (no icon) and Reader Memory (serif uppercase, 1.75rem radius, different shadow); chip nav looks like tabs but is transient anchors; chip "Reading" collides with the GlobalNav "Reading" destination. |
| 5 | Error Prevention | 2 | Delete has a confirm modal with a safe default, but no typed confirmation; navigation loses edits; Restore purchases is offered to a manual account and fails. |
| 6 | Recognition Rather Than Recall | 2 | Seven sections over ~4,000px with no scrollspy; "Device only" unexplained; guest banner and Privacy copy disagree about whether audio ever syncs. |
| 7 | Flexibility and Efficiency | 3 | Anchor chips, sticky nav, deep links, and roving-tabindex radio groups are real accelerators — undermined by no scrollspy and an undiscoverable handset strip. |
| 8 | Aesthetic and Minimalist Design | 2 | Calm palette, but seven equal-weight cards; section titles smaller than their own content; three exits; 12px body copy. |
| 9 | Error Recovery | 2 | Inline validation and retry paths exist, but "Try again" on the billing error repeats the same dead end; errors render at 12px; stale usage is presented as current. |
| 10 | Help and Documentation | 2 | One-line descriptions for most settings, but nothing explains Archetype Journey, Reversal Lens, plan limits, or "Device only"; no help link; the delete dialog mentions billing without linking to it. |
| **Total** | | **21/40** | **Acceptable (53%)** — careful details on a generic structure. |

No heuristic is `n/a`; all ten apply to an Operate settings surface. Maximum is 40.

## Design Specificity Verdict

**LLM assessment.** The page is *themed* for Tableu but not *composed* for it. The brass/charcoal palette, Source Serif H1, Seeker/Enlightened/Mystic tier names, and Audio copy ("Soft shuffle, candle crackle, and mystic room tone") are recognizably this product. Everything below that is a generic subscription-settings stack: seven equal rounded cards, a chip nav, toggles, usage bars, a danger zone. Find-and-replace the nouns and it ships unchanged in any SaaS.

The gap is not visual, it is structural. DESIGN.md describes a quiet ceremony with a focal hierarchy and reserve — "reserve the strongest light and slower motion for decisions that advance or reveal a reading." On this page nothing is reserved: billing, ambience toggles, theme, and account deletion all carry the same weight and the same card. At 1440 the content is a 672px column with 384px of empty space on each side, so the page is simultaneously sparse and 4,000px tall. The one card with a distinct voice, Reader Memory, looks imported from a different design system and sits outside the navigation entirely.

The missed opportunity is the obvious one: this is a *tarot practice* product, and the account page shows no practice. No recent reading, no journal count, no memory — only quota meters. The most personal thing a returning user owns is rendered as a storage limit.

**Deterministic scan.** The static detector returned **0 findings** on `src/pages/AccountPage.jsx` (exit 0), and 0 on each composed component (`ConfirmModal`, `GlobalNav`, `InstallFooter`, `AuthModal`, `MemoryManager`). The engine was sanity-checked against a synthetic bad JSX file that produced 2 findings, so this is a genuine clean pass, not a parse failure.

That zero is the finding. The detector's rule set targets visual anti-patterns — bounce easing, nested cards, tight leading — and this page is mechanically tidy. It has no broken spacing, no runaway shadows, no illegal colors. A page can be clean at the pixel level and still score 21/40, and this one is. Nothing in the deterministic layer can see that "Done" discards work or that billing dead-ends.

The runtime pass found **3** findings, all cosmetic:

| Rule | file:line | Element |
|---|---|---|
| `nested-cards` | `AccountPage.jsx:2194` | "Turning off stops new tracking" panel inside the Privacy & Data card |
| `nested-cards` | `AccountPage.jsx:2295` | "Active subscription detected" panel inside Account Data (only renders for active subscribers) |
| `tight-leading` | `AccountPage.jsx:96` | `#analytics-toggle-description`, 12px/15px — 1 line at 1440 (not reported), 2 lines at 390 (reported) |

These agree with the LLM review at small scale: nested cards are the same instinct that produced seven equal cards, and the tight leading is the same 12px body problem. No false positives. One measurement artifact was correctly excluded: focus styles sampled 90ms after focus read as transparent mid-transition; at 420ms they render a proper 2px ring.

**Visual overlays.** Injection succeeded (`document.title` mutated, script executed). The live server ran on port 8400 and overlays were genuinely visible in the page — 2 at 1440, 3 at 390, labeled `✦ nested cards` and `tight line height`. The server has since been stopped and the browser closed, so nothing is on screen now. Evidence is in `/tmp/opencode/critique-b/*-overlay-scrolled.png`.

## Overall Impression

This is a competent settings page that has been carefully built and never designed. Every individual control is correct — tap targets all clear 44px, focus rings are visible on all 15 tab stops I sampled, headings never skip a level, reduced motion is honored, the delete dialog focuses "Keep account" first. Those are the marks of someone paying attention.

Then the page makes four mistakes a careful builder would not notice, because each one is invisible from inside a single component: the primary mobile button silently discards edits, two visible preferences don't survive a refresh, billing management dead-ends for the account's own provider, and "export your data" exports about a third of it. The biggest opportunity is to stop treating this as seven independent cards and make it one page about a practice, with billing as a disclosure rather than the tallest object on the screen.

## What's Working

1. **The Audio section earns the product.** "Table Ambience: Soft shuffle, candle crackle, and mystic room tone" is the only copy on the page that could not belong to another app. The grouping is right too — three ambience toggles, then Voice Engine, then Narration Speed, with the speed control correctly hidden when Reader Voice is off. That is progressive disclosure doing real work.

2. **The delete confirmation is the right shape.** `ConfirmModal` focuses "Keep account" first, uses a serif title and a duotone warning icon, and explains the billing consequence before the button. The amber pre-warning in Privacy & Data is placed at the moment of decision rather than buried in a help page. The destructive path is the best-designed thing here.

3. **Operational accessibility is genuinely solid, and measured.** 38 interactive elements at 390px, zero under 44×44, minimum 44px on both axes. Zero of 15 tab stops lacked a visible ring. Zero skipped heading levels in both guest and signed-in states. `prefers-reduced-motion: reduce` measurably disables smooth scrolling, removes hover scale, and drops 7 animated elements. Skip link is the first tab stop. These are not claims, they are measurements.

## Priority Issues

**[P1] The section nav is seven anchors pretending to be tabs — and it disappears at 390px**

- **What**: The chip's active class is driven by `highlightedSection`, cleared by a 1.6s timeout. Manual scrolling leaves no chip active; initial load shows none active even though the page starts at Profile. The strip is `nav[aria-label="Jump to section"]` with 7 plain anchors — zero `role="tab"`, zero `aria-selected`, zero `aria-current`, and ArrowRight does not move focus. At 390px the strip is 573px wide inside a 390px viewport: Profile/Subscription/Audio/Display are visible, "Reading" is cut mid-word, Privacy and Actions are offscreen, and `scrollbar-width: none` removes the only cue that it scrolls.
- **Why it matters**: Users lose their place in a 4,000px page, and two of seven destinations look absent on the primary handset. A screen reader never hears which section is current. This is the page's only navigation and its only orientation device.
- **Fix**: Split persistent `activeSection` (hash + IntersectionObserver) from the transient flash; keep the chip selected, add `aria-current="true"`, auto-scroll the active chip into view, and add an edge fade plus scroll-snap. At 390, wrap to two rows or replace with a "Jump to" select. Give the strip `role="tablist"` only if you also implement arrow keys — otherwise keep it a nav and add `aria-current`.
- **Suggested command**: `/impeccable adapt`

**[P1] "Done" discards unsaved profile edits, and two Reading preferences don't persist at all**

- **What**: "Done" is a `<Link to="/">`. `profileForm` is local state and `handleProfileSave` runs only on Save, so an edited username or email is lost with no warning when the user taps the most prominent button on the mobile screen. Separately, Full Deck and Reversal Lens are session-only: change them, reload, and they reset to `true` and `auto` (verified live). The Reading section carries no "Device only" badge and says "Applies to future readings only," which implies persistence.
- **Why it matters**: The page cannot be trusted. A user who edits their name, taps Done, and returns finds the old name — and will not know whether anything else saved either. Two settings that look committed are not.
- **Fix**: Persist `includeMinors` and `reversalFramework` to localStorage or the account, and add the "Device only" badge the Audio section already uses. Block navigation when `profileEditing && hasProfileChanges` with a "Discard changes?" confirm. Rename "Done" to "Back to reading" and demote it from a full-width brass bar to a quiet link.
- **Suggested command**: `/impeccable harden`

**[P1] Billing management dead-ends, and the copy exposes the provider**

- **What**: Subscription reads "Active · Billed via manual" with a primary "Manage in manual" button. Clicking it renders "Use your billing provider to manage this subscription" plus a "Try again" link that repeats the same request. "Restore purchases" raises a toast: "Restore failed — Payment system not configured." Usage reads "Last updated 10/8/2026" — 13 days stale — directly beneath "Usage updates within a few minutes."
- **Why it matters**: A paying Pro user cannot change or cancel their plan, and the failure is dressed in raw provider vocabulary at the highest-stakes moment on the page. "Try again" that cannot succeed is worse than no button.
- **Fix**: Map `manual` to a human label ("Complimentary Pro" or "Billed by Tableu") and replace the action with "Contact support to change plan" or hide it. Render store/Stripe management only for real providers. Never interpolate a raw provider ID into `Manage in ${providerLabel}`. Hide Restore purchases unless the provider is Apple/Google, and map backend errors to user-facing copy. Add a stale-state treatment when `lastUpdated` exceeds the refresh window.
- **Suggested command**: `/impeccable clarify`

**[P1] "Export your data" exports a fraction of the data**

- **What**: Privacy copy promises "You can export or delete your data anytime." "Download account summary" writes only user, subscription, and preferences JSON. Export PDF and Export CSV cover journal insights only. Readings and Reader Memory are in neither.
- **Why it matters**: A user may delete their account believing they hold a complete copy. That is a privacy-trust failure and a plausible compliance gap, and it is the one issue here with consequences outside the product.
- **Fix**: Add a true "Export all data" covering journal entries, readings, and memories (one zip is fine), and rename the existing action "Download account summary (profile & preferences)" so its scope is explicit. Link it from the delete dialog.
- **Suggested command**: `/impeccable harden`

**[P2] The hierarchy is inverted and the most consequential copy is the smallest**

- **What**: `SectionCard` h2 is 14px/600 sans, while "Theme," "Mystic," and the profile name render at 16–18px. Privacy body, usage notes, and the delete consequence are 12px. The design contract reserves 12px for captions and badges and requires 16px mobile body.
- **Why it matters**: Card titles are quieter than their contents, so the page scans as a pile of labels rather than seven decisions. The delete warning and the export scope — the two things a user most needs to read — are the two smallest texts on the page.
- **Fix**: Section titles to 16–18px (serif would also restore the product voice and give the page the editorial hierarchy DESIGN.md asks for); body copy to 14px minimum, 16px on mobile; reserve 12px for badges and metadata.
- **Suggested command**: `/impeccable typeset`

## Persona Red Flags

**Alex (power user).** Goal: cancel or change the plan, in under a minute. Scans Subscription, hits the brass "Manage in manual," gets a sentence telling him to use his billing provider, then a "Try again" that repeats it, then "Restore failed — Payment system not configured." Notices "Last updated 10/8/2026" thirteen days after the fact and a Refresh that only refetches. Fails at `Manage in manual`, `Try again`, `Restore purchases`, and the stale timestamp — four dead ends in the one flow he came for. No keyboard shortcut exists to jump between sections, and ArrowRight does nothing in the strip.

**Sam (keyboard / screen reader).** Goal: reach Privacy and change Archetype Journey. Tab order runs skip link → Reading → Journal → user menu → Done → seven chip anchors before the first setting, so the nav costs eight stops to pass. The chips are anchors with no `aria-current`; the active tint is visual only and expires after 1.6s, so the screen reader never announces "current section" and a sighted keyboard user watches the highlight vanish. The heading outline is legal — h1 → h2 Privacy & Data → h3 Export → h3 Reader Memory → h2 Actions, zero skipped levels — but that nesting makes Reader Memory read as a subsection of Privacy. Privacy body copy is 12px. Focus rings are visible throughout; the switch indicator is a thinner brass outline than the 2px rings elsewhere, so it is the weakest focus state on the page.

**Casey (mobile, one-handed).** Goal: jump to Privacy at 390×844. Sticky header 97px plus chip strip 61px = 158px, 19% of the viewport, permanently occupied. The strip is 573px wide with a hidden scrollbar and no fade or chevron, so "Reading" is cut mid-word and Privacy/Actions are simply not there unless she guesses that a vertical page contains a horizontal scroll. "Done" sits directly under the H1 as a 358×44 brass bar and reads as Save, which it is not. Tap targets pass everywhere; the 12px privacy and usage copy is the part that fails one-handed reading.

## Minor Observations

- **Auto-Narrate** renders as a brass "on" switch that is disabled, locked, and labeled "On (requires Reader Voice)." It looks enabled and cannot be turned off. Show it as unavailable, not as on.
- **Reader Memory** is absent from the chip nav, uses an H3 outside any H2, and carries a 1.75rem radius, soft shadow, and serif uppercase header — three deviations that make it read as a component from another app. **Actions** is the only `SectionCard` without an icon.
- **Three exits compete**: "Done," "Sign Out," and "Back to Reading" all read as ways to leave. Sign Out is a chevron row that logs out immediately — the chevron implies a subpage, and there is no confirm or undo, while Replay Tutorial uses the same chevron and opens a modal.
- **Guest copy contradicts Privacy.** The guest banner says audio preferences stay on device "until you sign in"; Privacy and the "Device only" badges say they always stay on device. `PreferencesContext` confirms they never sync, so the banner is wrong.
- **Mobile delete dialog** is a full-screen sheet with the buttons at the top and ~600px of empty space below, plus a 12px strip of the underlying page (including its own "Delete account" button) visible at the bottom edge. The message pairs a raw ⚠️ emoji with the duotone warning icon.
- **No `contentinfo` landmark.** `InstallFooter` renders a `<footer>` that is hidden except in PWA-install context, so the page has four landmarks and no footer landmark at any viewport.
- **Guest load logs a console error every time**: `GET /api/auth/me` → 401. Expected for an unauthenticated probe, but it is a red line in devtools on the marketing-adjacent path.

## Questions to Consider

1. If this page were a room in the Midnight Reading Room, what would the visitor meet first — their practice, or their billing? Right now the tallest object on the screen is the subscription card.
2. Why is Reader Memory — the most personal, most tarot-specific surface — an unlabeled annex outside the navigation and outside the card system?
3. What would "Done" mean if every change committed inline and the page had no unsaved state? Could the only exit be "Return to your reading," with no way to lose work?
4. Should a reflective practice show API call quotas at all, or should those live behind a "Plan & usage" disclosure for the minority who need them?

## Coverage

Real local login on every authenticated state (`POST /api/auth/login` → 200; `GET /api/auth/me` asserted `pro` / `active`; logout per context). Guest contexts kept separate. Delete confirmation opened and cancelled, never submitted. No application data changed.

- Guest 1440 dark; Pro 1440 dark; Pro 1440 light; Pro 390 dark; Pro 390 light
- All seven signed-in sections visited at 1440 dark; Profile, Subscription, Display, Privacy, Actions at 390
- Both themes verified by seeding `localStorage['tarot-theme']='light'` before navigation

**Uncovered:** signed-in Free, Plus, expired/past_due/canceled, unverified-email, social-auth (password field hidden), Apple/Google store billing, the real Stripe portal, 320px, tablet, landscape, forced-colors, and a real screen-reader run. The captured account uses `subscription_provider=manual`, so the billing dead end is proven for that provider only; Stripe/Apple/Google management was not exercised.
