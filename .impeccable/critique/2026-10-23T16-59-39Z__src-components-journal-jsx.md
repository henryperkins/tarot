---
target: the Journal
total_score: 19
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 5
target_identity: "file:/home/ubuntu/tarot/src/components/Journal.jsx"
target_fingerprint: "sha256:b703d8d0467c8dd9361f780c1f791440008fb7b6660a6691c76780fd2f49278f"
target_path: /home/ubuntu/tarot/src/components/Journal.jsx
timestamp: 2026-10-23T16-59-39Z
slug: src-components-journal-jsx
closed: true
---
Method: dual-agent (A: /root/journal_design · B: /root/journal_technical), followed by parent source/storage verification. Assessment A finished before detector results entered synthesis.

Target: the Journal — `src/components/Journal.jsx`, `/journal`, mounted entry/filter/Journey components; supplemental gallery review. Local working tree at HEAD `680516f0`, 2026-10-23. Mode: Operate and Read. Read-only review; application/configuration files preserved.

**Verdict:** The Journal is recognizably Tableu and has a coherent reading-room identity. Its biggest design opportunity is to put saved questions and writing ahead of practice analytics and operating chrome. Data retention, account isolation, local deletion and reading accessibility need correction before visual polish.

**Combined assessment:** Nielsen usability **19/40 (Poor)**; technical audit **11/20 (Acceptable; significant work needed)**. Confirmed issue groups: **P0 0, P1 5, P2 8, P3 0**. P1 means a major privacy, retention, control or reading-access problem; P2 means a recoverable usability defect. Scores include parent storage/privacy and error-state probes. The independent snapshots scored A 22/40 and B 14/20 before those additional findings: synthesis lowers error prevention/recovery, implementation integrity and responsive reading space. Desktop filter duplication and access depth are ranked P2 because ordinary controls and scrolling provide workarounds.

**Authorship and implementation integrity:** Product coherence passes: Source Serif headings, brass and plum-ink surfaces, original questions, tarot artwork, card positions and reflections are grounded in Tableu. Functional integrity needs work: device-only storage capabilities and owner identity are not consistently reflected in saved views, deletion and sharing. No palette replacement is warranted.

**Nielsen design/usability scores**

| Heuristic | Score /4 | Principal evidence |
| --- | ---: | --- |
| Visibility of system status | 3 | Local/cloud status, loading, filters and counts are present; scope complexity remains. |
| Match with the real world | 2 | Questions/cards fit the task; generic spread titles and internal D1 wording weaken recognition. |
| User control and freedom | 2 | Disclosure/reset/confirmation work; guests cannot delete a local entry. |
| Consistency and standards | 2 | Visual system is coherent; duplicated filters and storage-dependent actions are inconsistent. |
| Error prevention | 1 | Local retention/import can discard records; saved queries are not owner-scoped. |
| Recognition rather than recall | 2 | Card/date cues help, but the original question is hidden in both collapsed modes. |
| Flexibility and efficiency | 2 | Search, filters, month jumps and saved views exist; primary content is buried. |
| Aesthetic and minimalist design | 1 | Large repeated summaries, nested surfaces and decorative filter maps compete with writing. |
| Error recovery | 2 | Retry/reset exist, but load failures render first-use empty messaging and sharing offers impossible actions. |
| Help and documentation | 2 | Useful local help; cloud eligibility, retention and independent scopes need clearer explanation. |
| **Total** | **19/40** | **Poor under the Impeccable rubric; all ten heuristics apply.** |

**Technical audit scores**

| Dimension | Score /4 | Principal evidence |
| --- | ---: | --- |
| Accessibility | 2 | Confirmed rendered contrast failure; focus and generic-span semantics defects. |
| Performance | 3 | Memoization, lazy/async images, route splitting and ten-entry visible batches; no performance profile. |
| Theming | 3 | Dark/light tokens and renders work; composed dark Journey surfaces fail text contrast. |
| Responsive design | 2 | No document overflow in completed widths/Chromium enlarged-text probe; floating actions obscure prose and Reset view is small. |
| Implementation integrity | 1 | Verified retention, saved-view ownership and storage-capability mismatches. |
| **Total** | **11/20** | **Acceptable; substantial functional and reading-access corrections required.** |

**Five highest-priority findings**

**J1 · P1 — Local save/import silently discards history at 100 entries.** Evidence: Code plus isolated execution of the unchanged production import function with in-memory storage. `src/hooks/useJournal.js:689` slices saves to 100; `:846` slices imports to 100 and removes the legacy bucket. With 99 account-local entries and three newer guest entries, import retained 100 records, dropped two existing account entries, removed the guest bucket, and returned `success: true, imported: 1, skipped: 2` despite actually retaining all three guest entries. The banner says storage depends on the browser and does not disclose eviction (`JournalStatusBanner.jsx:159`). The save confirmation remains “Saved to your journal” (`useSaveReading.js:154`). This can remove private writing while reporting success. Preserve both source buckets when capacity is exceeded; provide explicit capacity/recovery/export behavior and truthful counts. Suggested command: `/impeccable harden`. Evidence: `output/playwright/journal-audit-20261023/local-import-review.json` and its reproduction script. No actual user storage was mutated by this probe.

**J2 · P1 — Saved views expose one account's saved name and query to another account in the same browser.** Evidence: Code + synthetic Render, Chromium 1440×1000. `src/components/JournalFilters.jsx:28`, `:223` and `:252` use a global `journal_saved_filters_v1` key and unscoped component state. A view saved under fixture account A remained visible under fixture account B after reload; applying it restored A's private query. This is leakage of saved search text/names, not evidence that whole reading records cross accounts. Scope views to the owner, isolate guests, reset state on owner changes, and keep ambiguous legacy global views behind an explicit import decision. Suggested command: `/impeccable harden`. Evidence: `saved-view-owner-review.json`, `saved-view-cross-account.png` and reproduction script under the review evidence directory. The two identities were mocked; no real two-account login or backend persistence claim is made.

**J3 · P1 — Guests cannot delete a private local entry from the Journal.** Evidence: real guest Render + Code. Entry actions offers Copy CSV, Export CSV and Export Markdown, but no Delete entry. Real active Pro exposes deletion and a confirmation; Keep Entry was used. `src/components/journal/entry-card/EntryActions/ActionMenu.jsx:39` requires authentication, although Journal supplies a local-capable delete handler and `useJournal.js:769` implements local deletion. Make deletion available whenever the entry's supplied delete capability exists; retain confirmation and gate cloud sharing independently. Suggested command: `/impeccable harden`. Evidence: `design/guest-desktop-entry-menu.png`, `design/pro-mobile-delete-confirm.png`. No delete was confirmed.

**J4 · P1 — Dark Journey text fails contrast on the actual painted surface.** Evidence: measured Render + Code. The season label measured **3.19–4.01:1**, streak explanation **2.24–2.85:1**, coach question **2.88–3.37:1**, and focus-area link **3.39–3.60:1**. These small-text examples fall below the 4.5:1 requirement of [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Sampling used element screenshots with text temporarily transparent, nine backdrop points, computed text alpha compositing and browser sRGB conversion; styles were restored. Locations: `ReadingJourney/sections/SeasonSummary.jsx:90`, `:95`, `:139`; `CoachSuggestion.jsx:210`, `:225`; the shared gradient composition in `src/styles/tarot.css`. Use reliably contrasting local backdrops and full-opacity semantic copy while retaining the warm atmosphere. Suggested command: `/impeccable colorize`, then rendered verification. Evidence: `technical/verification-details.json`, `technical/contrast-verification-dark-1440.png`. Token/static checks and automatic axe results did not establish this contrast.

**J5 · P1 — Floating actions obscure the mobile saved narrative.** Evidence: Render + Code at 390×844. The New Reading and Filters pills cover body-text lines and the card/narrative transition. `src/components/journal/JournalFloatingControls.jsx:35` creates the fixed right-aligned stack whenever filters leave view. A person has to move lines past unrelated controls to read them. Reserve measured action space or release these controls into flow during entry reading; keep a reachable Filters shortcut without painting over prose. Suggested command: `/impeccable adapt`. Evidence: `design/guest-mobile-entry-narrative.png`, `design/guest-mobile-entry-card-fan.png`. This is a demonstrated reading obstruction, not a claim of a particular untested focus-obscuration criterion.

**The central design critique**

**J6 · P2 — Desktop filter cards overlap their own labels.** At 1440px, Timeframe covers Search, Deck covers Context, and Reversals covers Spread. Measured overlaps are about 74.5px, 44.5px and 49.3px. `JournalFilters.jsx:519` uses percentage coordinates inside a 240px map (`:602`) for six 160px-wide decorative cards. Ordinary controls immediately below duplicate their functions. Remove the duplicate constellation from the default task flow, or retain it only as an optional non-overlapping explainer. Preserve all supported filter choices. Suggested command: `/impeccable distill`. Evidence: `design/guest-desktop-filters.png`, `design/interactions-ledger.json`.

**J7 · P2 — Search and saved entries begin multiple sections below arrival.** The populated Journal foregrounds Journey, practice snapshots and filters before the actual entries. The same six-entry dark-theme fixture produced these document positions in CSS pixels:

| Session / viewport | Search input top | First entry top |
| --- | ---: | ---: |
| Guest · 390×844 | 1969 | 2411 |
| Real active Pro · 390×844 | 1768 | 2210 |
| Guest · 1440×1000 | 1675 | 1989 |
| Real active Pro · 1440×1000 | 1494 | 1808 |

`Journal.jsx:856` mounts mobile Journey before history, and `:973` mounts the snapshot before search/list. Lead with search and recent entries, keeping a compact overview or labeled disclosure. In the empty state, move Start a reading beneath the heading/explanation and keep one optional example instead of two before the action. Suggested commands: `/impeccable layout`, `/impeccable onboard`. Evidence: `design/geometry-ledger.json`, initial viewport/full-page captures. Positions depend on content/fonts; the source-defined ordering is consistent across inspected states.

**J8 · P2 — Repeated spread names hide each entry's personal identity.** Both comfortable and compact modes title records Three-Card Story while hiding different questions until expansion. `ComfortableHeader.jsx:92` and `:124` use spread titles; the question appears inside the expanded branch at `JournalEntryCard.jsx:194`. Make the original question the identifying line, with spread/date as supporting metadata and a spread fallback when no question exists. Suggested command: `/impeccable clarify`, then `/impeccable typeset`. Evidence: `design/guest-desktop-entry-collapsed.png`, `design/guest-desktop-list.png`.

**Other confirmed findings**

| ID / severity | Finding and evidence | Recommendation / suggested command |
| --- | --- | --- |
| J9 · P2 | Device-only signed-in entries offer Create share link. The production share handler, exercised with an isolated Free SQLite account and a device-only ID, returns HTTP 400 “No entries available to share”. The browser error was reproduced with a matching scoped fixture. Guests see Sign in to sync, although cloud entitlement requires Plus/Pro. Locations: `Journal.jsx:736`, `useJournalSharing.js:51`, `functions/api/share.js:96`, `JournalStatusBanner.jsx:232`, `SubscriptionContext.jsx:53`. | Offer Copy summary for device-only entries and describe actual cloud eligibility before sign-in. Gate by entry persistence/capability. `/impeccable harden` + `/impeccable clarify`. Evidence: `local-share-handler.json`, `free-local-share-error.png`, `storage-review.json`. |
| J10 · P2 | Cloud outage without cache and malformed local storage both render Start your tarot journal beneath the error. The malformed case also reports Local entries: 0. Failed retrieval is presented as first use. Locations: `Journal.jsx:1099`, `JournalStatusBanner.jsx:246`, `useJournal.js:419`. | Separate known-empty, unavailable and unreadable states. Preserve source data and explain retry/recovery without implying absence. `/impeccable harden`. Evidence: `cloud-outage-without-cache.png`, `corrupt-local-journal.png`, `storage-review.json`. |
| J11 · P2 | Escape collapses the mobile card fan and leaves focus on BODY in both Chromium and WebKit. The next Tab recovers; no keyboard trap is claimed. `CardsDrawnSection/useCardFan.js:183` attempts focus before the collapsed button remounts. | Focus the persistent toggle, or defer focus until the collapsed control exists. `/impeccable harden`. Evidence: `technical/interactions.json`, `technical/verification-details.json`. |
| J12 · P2 | Enabled Reset view is 30px high at desktop and handset widths (`JournalFilters.jsx:481`). | Match Tableu's 44px internal target. This alone is not failure of WCAG 2.2 AA's [24px minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). `/impeccable adapt`. |
| J13 · P2 | Frequency/reversal explanations rely on aria-label on generic spans (`CardsCallingYou.jsx:96`, `:103`); axe identified eight desktop occurrences for manual review. Screen-reader behavior was not tested. | Use real expanded text with appropriately hidden visual shorthand; generic containers prohibit author naming in [WAI-ARIA](https://www.w3.org/TR/wai-aria-1.2/#generic). `/impeccable harden`. |

**Cognitive and emotional experience**

Six of eight Impeccable cognitive-load checks failed: single focus, chunking, visual hierarchy, one decision at a time, minimal choices and working memory. Local grouping and entry/Journey disclosures work, but the largest overview content remains ahead of the archive task. Six filter dimensions are represented twice; their domain choices should be grouped rather than deleted. Separate history, summary and Journey scopes require extra interpretation.

Arrival feels warm and literary. The strongest moment is the original question with cards and readable prose. Traversing analytics before that moment, having the prose covered by floating actions, and lacking guest deletion weaken confidence in a private archive.

Persona red flags: a distracted returning reader must scroll several screens and identify repeated spread titles; a guest on a shared browser cannot remove an entry and can encounter another owner's saved query; a keyboard/low-vision reader faces low-contrast Journey text, duplicate map controls and a fan-collapse focus loss.

**What to preserve**

- The warm brass/plum-ink palette, Source Serif artifact headings, real deck artwork and original question/reflection content express Tableu's private reading-room identity.
- Search, month jumps, context/spread/deck filters and compact mode are useful capabilities. Narrative/card disclosures and the gallery's clear Back to Journal path support different revisit styles.
- Most exercised keyboard interactions worked: listbox arrows/Home/End/Escape, menu dismissal/focus return, Saved Intentions dismissal and Journey tabs. Pro deletion has a safe confirmation. Dark/light rendering, lazy images and visible-entry batching provide a sound implementation foundation.

**Detector, validation and evidence limits**

The scoped Impeccable CLI ran once on 47 JSX files, excluded backups, and returned exit 0 with `[]`. No source rule/file locations were returned. Browser injection succeeded in three fresh terminal-controlled pages: guest empty 390px (3 grouped findings/3 rule instances), guest populated desktop (26/29), and Pro Journey drawer 390px (22/23). Counts overlap across states and are not unique defects. Browser rules included nested-cards, dark-glow, tiny-text, low-contrast, radial-spotlight-glow, kicker-above-heading and straggler. Brand glows, real card nesting and 11px metadata were not automatically treated as defects. The independent painted-surface measurements confirmed the specific contrast issue. Some drawer scan warnings referred to the underlying page, not foreground dialog content. No overlay is claimed to remain visible in the user's browser; the live server was stopped.

The fresh production build passed. `npm run test:a11y` passed 24 token contrast checks with zero static errors and 1071 repository-wide heuristic warnings; those warnings are not 1071 confirmed Journal defects. Completed axe analyses in 22 technical artifacts returned zero automatic violations, while gradients remained incomplete/manual and failed the measured contrast check. “WCAG passed” would be unsupported.

Design review covered 16 initial combinations: guest/real active Pro × empty/synthetic-populated × dark/light × 390×844/1440×1000. Technical review added 320/768px, 15 interaction probes, representative WebKit 26.5, and a recovered Chromium 320px/200% root-text-size case. Chromium version was 151.0.7922.34. Design also exercised gallery, summary-success and delete-cancellation flows. Technical survey recovery and two harness selector assumptions are recorded; coverage is reconciled, not an uninterrupted all-green run. WebKit 200% text remains unqualified. Root added mocked Free/expired/cloud-outage/malformed-storage cases, the saved-view owner-switch reproduction, and isolated production import/share-handler probes. Populated records and model outputs were synthetic. Real Pro authentication was verified against unmocked `/api/auth/me`; no cloud persistence is established by those fixtures.

Untested: physical devices, screen readers, real native touch/drag/swipe, OS text scaling/browser zoom, virtual keyboard/autofill/hardware safe areas, production, measured Web Vitals/CPU profiles, and actual cloud save/delete/share/provider behavior. No model/provider request or backend journal/share mutation was made. No claim of complete WCAG or physical-device qualification is made.

**Cleanup and preservation**

All task browsers and the Impeccable live server were closed. Completed Pro scripts logged out. Root resolved the one interrupted browser's remaining session by matching the exact corrected-survey start timestamp to the sole task-created local reviewer session, sending normal local logout and verifying its deletion while preserving the two pre-existing sessions. No token was retained or printed. Details: `orphan-session-cleanup.json`, `technical/auth-run-notes.json`. Root stopped only the task-owned npm/Vite/Worker process group; ports 5173 and 8787 were closed. SHA-256 comparison verified all 3328 tracked files unchanged from the initial snapshot, including pre-existing dirty work. Only review artifacts and this requested critique archive were added.

**Follow-up direction questions**

1. Which Journal composition should lead a later design pass: history and saved questions first; or a compact practice overview with history visible in the same viewport?
2. Which scope should follow: privacy/retention/reading blockers; or those corrections plus the history/filter/entry-title layout work?

Any authorized remediation should finish with `/impeccable polish` and a focused repeat of the affected rendered and storage checks.
