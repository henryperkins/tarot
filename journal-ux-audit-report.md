1) Executive Summary (Top 7–10 Recommendations)
Assumptions: This audit is code-based (not a live UI run). Entry-point flows were inferred from `src/components/nudges/JournalNudge.jsx`, `src/hooks/useSaveReading.js`, and `src/components/Journal.jsx`. The “Find a reading” jump-to-filters button referenced in your prompt is assumed to exist outside the files inspected (not found in `src/components/Journal.jsx`).
- Search scope is limited to loaded entries, but the “no matches” states do not sufficiently explain that limit → Surface a persistent “Searching loaded entries only” label and move “Search older entries” CTA into the empty state and sticky summary (`src/components/Journal.jsx`, `src/components/JournalFilters.jsx`) → Reduces false negatives, increases trust, and improves discovery of older readings. (Implemented)
- Export defaults to “current scope” (often this month) when unfiltered → Default export/share scope to “All entries” when filters are off and the user hasn’t touched scope, and add a strong scope confirmation line (e.g., “Exporting: All entries”) (`src/components/ReadingJourney/sections/ExportSection.jsx`) → Prevents accidental partial exports and aligns with user expectations. (Implemented)
- Filters vs insights scope mismatch is only called out in the Summary band → Reuse the “Filters not applied to insights” warning in Reading Journey sidebar + mobile hero and apply-filters CTA (`src/components/journal/JournalSummaryBand.jsx`, `src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`) → Clarifies analytic scope and reduces confusion. (Implemented)
- Journal entry discovery after saving is weak → Add a “View entry” CTA on save success that deep-links to Journal with highlight (`src/hooks/useSaveReading.js`, `src/components/ReadingDisplay.jsx`) → Increases immediate Journal engagement and reinforces value. (Implemented)
- Share UX is ambiguous for guests vs authenticated users → Rename actions and inline statuses to reflect actual behavior (e.g., “Copy summary” vs “Create share link”) in entry cards and Export panel (`src/components/JournalEntryCard.jsx`, `src/components/ReadingJourney/sections/ExportSection.jsx`) → Improves trust and reduces mis-taps. (Implemented)
- Follow-up limits/gating lack upgrade path and clarity → Add explicit “per reading” limit text, Plus upgrade CTA when limit reached, and “Open full chat” action (`src/components/JournalEntryCard.jsx#L1174`, `src/components/FollowUpChat.jsx#L71`) → Raises conversion and reduces frustration. (Implemented)
- Sync status visibility is inconsistent when healthy → Show a subtle, always-on sync pill with last sync time and data source (`src/components/journal/JournalStatusBanner.jsx`, `src/components/Journal.jsx`) → Improves trust and perceived reliability. (Implemented)
- Card Gallery stats can be partial without warning → Add “Stats based on last N loaded entries” banner + “Load full history” CTA when remote stats are unavailable (`src/pages/CardGalleryPage.jsx#L62`, `src/hooks/useJournal.js#L131`) → Prevents misinterpretation of collection completeness. (Implemented)
- Large-journal performance risk from client-only filtering → Add virtualization or server-side search fallback, leveraging existing search utilities (`src/hooks/useJournalFilters.js#L60`, `functions/lib/journalSearch.js`) → Improves performance at scale and preserves usability. (Implemented)

Implementation Status (January 17, 2026)
- Phase 1 complete: J-01, J-02, J-03, J-05, J-07, J-08, J-10 implemented in codebase.
- Phase 2 complete: J-09, J-11, J-15 implemented in codebase.

2) What’s Working (Preserve)
- Clear visual hierarchy and rich mood-setting in Journal shell and cards (`src/components/Journal.jsx`, `src/components/JournalEntryCard.jsx`).
- Sticky summary + floating controls provide strong wayfinding while scrolling (`src/components/Journal.jsx#L765`, `src/components/journal/JournalFloatingControls.jsx`).
- Deep-linking to Journal search and entry highlight is already implemented and robust (`src/components/Journal.jsx#L175`).
- Follow-up previews are concise and contextual, with pattern badges surfaced when present (`src/components/JournalEntryCard.jsx#L1184`).
- Export UX includes scope warnings and large-export confirmation (`src/components/ReadingJourney/sections/ExportSection.jsx#L453`, `src/components/ReadingJourney/sections/ExportSection.jsx#L491`).
- Summary generation surfaces provider badge and entry counts for transparency (`src/components/ReadingJourney/sections/JournalSummarySection.jsx#L98`).
- Card Gallery has strong scannability and filters with lightweight animations (`src/pages/CardGalleryPage.jsx#L429`).

3) Detailed Findings & Fixes (table)
| ID | Location | Issue | Why it matters | Severity | Suggested Fix | Effort | Platform Notes |
|---|---|---|---|---|---|---|---|
| J-01 | `src/hooks/useSaveReading.js`, `src/components/ReadingDisplay.jsx` | Save success gives no direct path to the saved entry. | Weakens discoverability and immediate journal reinforcement. | High | Implemented: add “View entry” CTA on success that deep-links to `/journal` with `highlightEntryId` + `fromReading`. | S | All |
| J-02 | `src/components/Journal.jsx`, `src/components/JournalFilters.jsx` | Search is limited to loaded entries, but empty state doesn’t clearly say that or offer a CTA to search older. | Users may trust false negatives and abandon search. | High | Implemented: persistent “Searching loaded entries only” label; CTA added in sticky summary + empty state. | M | All |
| J-03 | `src/components/Journal.jsx` | “Showing X of Y+” is ambiguous (filtered vs loaded vs total). | Users cannot tell what they are seeing, lowering trust. | Medium | Implemented: split into “Filtered: X” and “Loaded: Y of Z” chips. | S | All |
| J-04 | `src/components/JournalFilters.jsx#L567` | Filter constellation is interactive but not explained. | Discoverability gap; users may ignore a powerful control. | Medium | Add helper text “Tap any node to edit filters” and a subtle glow on active nodes. On mobile, append active count to “More filters.” | S | Desktop + mobile |
| J-05 | `src/components/journal/JournalSummaryBand.jsx`, `src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx` | “Timeframe” filter (history) vs analytics “Scope” (insights) is unclear, and mismatch warning only appears in Summary band. | Users won’t know why insights disagree with filtered history. | High | Implemented: “Filters not applied to insights” warning + CTA in Reading Journey header (desktop + mobile). | M | All |
| J-06 | `src/components/ReadingJourney/JourneyMobileSheet.jsx#L323`, `src/components/ReadingJourney/JourneySidebar.jsx#L263` | Scope/source badge shown in some surfaces but not the mobile hero. | Inconsistent trust cues across devices. | Medium | Add “Scope: Filtered · Source: D1/Journal” pill in mobile hero and sheet header, matching Summary band. | S | Mobile |
| J-07 | `src/components/ReadingJourney/sections/ExportSection.jsx` | Export defaults to “Current scope” (often month) even when unfiltered. | Users expecting full journal may export partial data. | High | Implemented: default to “All entries” when filters are off; confirmation line now reads “Exporting: All entries.” | M | All |
| J-08 | `src/components/JournalEntryCard.jsx`, `src/components/ReadingJourney/sections/ExportSection.jsx` | Share action is ambiguous for guests vs authenticated users (summary vs link). | Trust + expectation mismatch. | Medium | Implemented: share labels now “Create share link” (auth) vs “Copy summary” (guest), status copy includes single-reading scope. | S | All |
| J-09 | `src/components/JournalEntryCard.jsx#L1174`, `src/components/FollowUpChat.jsx#L71` | Follow-up limits and tier gating are shown but not explained or upsold. | Users hit limits without a path forward. | Medium | Implemented: helper row “Limits reset per reading.” If limit reached, show “Upgrade to Plus for 3 follow-ups.” “Open full chat” CTA when limits reached. | M | All |
| J-10 | `src/components/journal/JournalStatusBanner.jsx`, `src/components/Journal.jsx` | No always-on sync status when healthy. | Reduces confidence in cloud backup. | Medium | Implemented: always-on sync pill with source + relative time; refresh link when cached. | S | All |
| J-11 | `src/pages/CardGalleryPage.jsx#L62`, `src/hooks/useJournal.js#L131` | When remote stats are unavailable, local stats are based only on loaded entries with no warning. | Collection can appear incomplete or misleading. | Medium | Implemented: banner “Stats based on last {entries.length} loaded entries” + CTA “Load full history” to page through entries. | M | All |
| J-12 | `src/components/JournalEntryCard.jsx#L300` | Action menu placement can overflow in short viewports; no top/bottom clamp. | Menu can render off-screen on mobile landscape. | Low | Clamp top within viewport bounds (min 8px, max `innerHeight - menuHeight - 8`). Consider `@floating-ui`. | M | Mobile landscape |
| J-13 | `src/components/ReadingJourney/sections/BackfillBanner.jsx` | Backfill banner dismissal is not persisted. | Repeated prompts can feel nagging. | Low | Store dismissal in localStorage with user id and an optional TTL (“Remind me in 7 days”). | S | All |
| J-14 | `src/lib/journalInsights.js#L1338`, `src/components/ReadingJourney/*` | Streak uses a grace period but UI does not explain. | Streaks feel inconsistent and reduce trust. | Low | Add tooltip: “Counts from yesterday if no reading today (grace period).” Optionally show last streak date. | S | All |
| J-15 | `src/hooks/useJournalFilters.js#L60`, `functions/lib/journalSearch.js` | Filtering is client-only and can become heavy with large journals. | Perceived performance degrades as users load more entries. | Medium | Implemented: server-side search fallback (`/api/journal/search`) for large histories with semantic fallback and UI states. | L | All |

4) Prioritized Roadmap
- Phase 1 (Done)
- J-01 Save-to-Journal CTA and deep-link highlight
- J-02 Search scope visibility + “Search older entries” CTA in empty state
- J-03 History counts clarity (loaded vs filtered vs total)
- J-05 Scope mismatch warning in Reading Journey
- J-07 Export default scope to All entries
- J-08 Share action labeling by auth state
- J-10 Always-on sync status pill

- Phase 2 (Done)
- J-09 Follow-up limits + upgrade CTA + “Open full chat”
- J-11 Card Gallery completeness banner + full-history load
- J-15 Server-side search fallback for large histories

- Phase 3 (Later: nice-to-have)
- J-04 Filter constellation affordance polish
- J-12 Action menu viewport clamping
- J-13 Persist backfill banner dismissal
- J-14 Streak grace-period tooltip
