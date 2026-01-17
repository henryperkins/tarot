1) Executive Summary (Top 7–10 Recommendations)
Assumptions: Audit is based on code in this repo (no live UI run); behavior is inferred from components/hooks and API handlers.
- Issue / Opportunity → Recommended Fix → Expected Impact: Search and filters are exposed in multiple places (sticky search, full filter panel, floating controls), making scope ambiguous → Consolidate to one primary search entry point or make the sticky bar focus the filter panel’s search field; add inline scope note like “Searching latest 25 of 180 — Load older entries to expand” → Faster discovery and fewer false‑negative searches, especially on mobile.
- Issue / Opportunity → Recommended Fix → Expected Impact: Card Gallery deep‑links to Journal entries can silently fail when the entry isn’t loaded → Auto‑load older pages until the entry is found or add a dedicated “fetch by ID” path; show a “Loading entry…” banner with a fallback “Load older entries” CTA → Restores trust in link‑back from gallery and reduces dead‑end navigation.
- Issue / Opportunity → Recommended Fix → Expected Impact: JournalEntryCard only shows follow‑up actions when follow‑ups already exist → Always render a follow‑up block with an empty state (“No follow‑ups yet — Ask one”) and keep tier/limit messaging visible → Higher follow‑up adoption and clearer next steps.
- Issue / Opportunity → Recommended Fix → Expected Impact: Export/share scope can diverge from the filtered history view → Add an explicit scope selector (All / Current filters / Current scope) and default to “Current filters” when filters are active; warn when exporting unfiltered while filtered view is active → Prevents accidental data leakage and builds trust in exports.
- Issue / Opportunity → Recommended Fix → Expected Impact: Reading Journey blends server and client data without a clear “source” indicator → Add a lightweight “Scope + Source” chip (e.g., “This month · D1” or “Filtered · Journal”) in Journey header and summary band → Increases transparency and reduces confusion when stats shift with filters.
- Issue / Opportunity → Recommended Fix → Expected Impact: Share UX hides primary actions and doesn’t surface link‑creation failures clearly → Add a visible “Share” quick action in the card header and make share failures explicit (“Link failed — summary copied instead”) → Better share discoverability and clearer outcomes.
- Issue / Opportunity → Recommended Fix → Expected Impact: Analytics disabled state has no direct action → Add a “Go to Settings” CTA in Journey disabled states (mobile + desktop), matching Card Gallery → Faster recovery and higher analytics opt‑in.
- Issue / Opportunity → Recommended Fix → Expected Impact: Signed‑in/no‑cloud banner copy doesn’t clearly explain entitlement impact → Update microcopy to “Plan doesn’t include cloud sync; entries stay on this device” and keep the upgrade CTA adjacent → Stronger trust and clearer upgrade rationale.
- Issue / Opportunity → Recommended Fix → Expected Impact: Long history lists lack fast scanning aids → Add sticky month headers with counts, optional “Jump to month,” and/or lightweight virtualization for long lists → Faster navigation for heavy users and improved perceived performance.

2) What’s Working (Preserve)
- JournalStatusBanner handles cache fallback, migration, and legacy import with explicit CTAs, reducing data‑leak risk (`src/components/journal/JournalStatusBanner.jsx`).
- Filters include saved views, search help, and results count feedback, which supports power users (`src/components/JournalFilters.jsx`).
- JournalEntryCard hierarchy is strong: collapsible sections, card insights, reflections, and inline status are well structured (`src/components/JournalEntryCard.jsx`).
- Reading Journey has thoughtful empty/filtered/disabled states and a backfill banner without blocking insights (`src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`).
- Export supports PDF/CSV/Markdown plus share links with expiry and limits (`src/components/ReadingJourney/sections/ExportSection.jsx`).
- Card Gallery provides a clear progress meter and links back to related journal entries (`src/pages/CardGalleryPage.jsx`, `src/components/CardModal.jsx`).
- Follow‑up chat includes tier limits, usage counters, and server‑turn reconciliation to prevent over‑counting (`src/components/FollowUpChat.jsx`).

3) Detailed Findings & Fixes (table)
| ID | Location | Issue | Why it matters | Severity | Suggested Fix | Effort | Platform Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J-01 | `src/components/Journal.jsx:576` `src/components/Journal.jsx:589` `src/components/JournalFilters.jsx:700` | Search and filters are duplicated (sticky search + filter panel + floating controls). | Cognitive load and unclear “source of truth” for search scope. | Medium | Keep one primary search input; make the sticky bar a summary + “Edit filters” that scrolls/focuses `JournalFilters` search; hide the secondary search when sticky search is visible. | M | Mobile first; desktop simplification. |
| J-02 | `src/components/Journal.jsx:742` `src/components/Journal.jsx:797` `src/components/JournalFilters.jsx:702` | Search only covers loaded entries; “Search older entries” CTA is far from the search input. | Users assume full‑history search and lose trust when no results appear. | High | Show scope note directly under search (“Searching latest X of Y”); add inline “Load older entries” next to search results; optionally auto‑load more pages on active query until a cap. | M | All platforms; especially desktop. |
| J-03 | `src/pages/CardGalleryPage.jsx:368` `src/components/Journal.jsx:192` | Card Gallery deep‑link highlights only if entry is already loaded. | Link‑back can fail silently for older entries. | High | Add a “fetch by ID” path or auto‑load pages until entry found; show “Loading entry…” and a fallback “Load older entries” button. | M–L | All platforms. |
| J-04 | `src/components/JournalEntryCard.jsx:1150` | Follow‑up section only renders when follow‑ups already exist. | Blocks first‑time follow‑up discovery from Journal history. | High | Always render follow‑up section; show empty state with CTA (“No follow‑ups yet — Ask one”) and keep limit text visible. | S | All platforms. |
| J-05 | `src/components/FollowUpChat.jsx:725` | “Include insights from my journal history” lacks scope/privacy explanation. | Trust risk around what data is shared. | Medium | Add helper text or tooltip: “Uses your saved readings and reflections from this journal only; turn off anytime.” | S | All platforms. |
| J-06 | `src/components/ReadingJourney/sections/ExportSection.jsx:69` `src/hooks/useJourneyData.js:379` `src/hooks/useJournalAnalytics.js:55` | Export defaults to analytics scope, which may not match active filters. | Filtered history view can export unfiltered data. | High | Add explicit export scope selector (All / Current filters / Current scope); default to filters when active; show warning when filters active but exporting unfiltered. | M | All platforms. |
| J-07 | `src/components/ReadingJourney/sections/ExportSection.jsx:205` | Share‑link failures silently fall back to summary copy. | Users think they have a link when they don’t. | Medium | Show explicit error + fallback: “Link failed — summary copied instead.” | S | All platforms. |
| J-08 | `src/components/ReadingJourney/sections/JournalSummarySection.jsx:273` | “Recent” summary scope label doesn’t clarify it’s unfiltered. | Scope ambiguity when filters are active. | Medium | Rename to “Recent (unfiltered)” and “Filtered”; add a short scope note below. | S | All platforms. |
| J-09 | `src/components/ReadingJourney/JourneySidebar.jsx:199` `src/components/ReadingJourney/JourneyMobileSheet.jsx:254` | Analytics disabled state has no direct CTA to settings. | Extra friction to re‑enable analytics. | Medium | Add a “Go to Settings” button (route to `/account#analytics` or `/settings`) consistent with Card Gallery. | S | All platforms. |
| J-10 | `src/components/JournalEntryCard.jsx:832` `src/components/JournalEntryCard.jsx:520` | Compact view action menu is 32px; share/export only in overflow menu. | Touch target too small; low share discoverability. | Medium | Increase to min‑44px; add inline “Share” quick action or a share‑count chip in header. | S–M | Mobile ergonomics. |
| J-11 | `src/lib/journalInsights.js:1136` | Entry share summary uses raw `context` value. | Inconsistent labeling and potential confusion (“self” vs “Self”). | Low | Format via `formatContextName` and add deck/context labels in share text. | S | All platforms. |
| J-12 | `src/components/journal/JournalStatusBanner.jsx:41` | “Signed in – stored on this device” is vague about entitlements. | Trust gap and missed upgrade clarity. | Medium | Update copy to “Plan doesn’t include cloud sync; entries stay on this device.” Keep upgrade CTA adjacent. | S | All platforms. |
| J-13 | `src/components/Journal.jsx:472` | Month grouping is minimal; no quick navigation for long histories. | Slower scanning and heavy scrolling. | Low–Medium | Add sticky month headers with counts and optional “Jump to month” dropdown; consider lightweight virtualization after X entries. | M–L | Desktop + long‑history mobile. |

4) Prioritized Roadmap
Phase 1 (Now: high impact, low–medium effort) — Completed Jan 17, 2026
- [x] Add follow‑up empty state + CTA for all entries (`src/components/JournalEntryCard.jsx:1150`).
- [x] Surface search scope and “Load older entries” inline with search (`src/components/Journal.jsx:589`, `src/components/JournalFilters.jsx:700`).
- [x] Add CTA for analytics disabled state (`src/components/ReadingJourney/JourneySidebar.jsx:199`, `src/components/ReadingJourney/JourneyMobileSheet.jsx:254`).
- [x] Fix compact action menu touch target and add a visible Share action (`src/components/JournalEntryCard.jsx:832`).
- [x] Make share‑link failure explicit with fallback messaging (`src/components/ReadingJourney/sections/ExportSection.jsx:205`).

Phase 2 (Soon: high impact, higher effort)
- Implement deep‑link reliability from Card Gallery (fetch by ID or auto‑load pages) (`src/pages/CardGalleryPage.jsx:368`, `src/components/Journal.jsx:192`).
- Add explicit export/share scope selector and default to filtered when filters active (`src/components/ReadingJourney/sections/ExportSection.jsx:69`, `src/hooks/useJourneyData.js:379`).
- Add “Scope + Source” chips to Journey + Summary band for transparency (`src/components/ReadingJourney/JourneySidebar.jsx:252`, `src/components/journal/JournalSummaryBand.jsx:130`).

Phase 3 (Later: nice‑to‑have)
- Consolidate duplicate search UI and filter controls into a single, consistent entry path (`src/components/Journal.jsx:576`, `src/components/JournalFilters.jsx:700`).
- Improve long‑history scannability with sticky month headers, counts, and quick‑jump (`src/components/Journal.jsx:472`).
- Refine share summary formatting (context labels, deck info) and microcopy polish (`src/lib/journalInsights.js:1136`).

5) Progress (as of Jan 17, 2026)
Completed
- Phase 1 items (J-02, J-04, J-07, J-09, J-10).

Remaining
- Phase 2: J-03 (deep‑link reliability), J-06 (export/share scope selector + defaults), J-08 (summary scope labeling + note).
- Phase 3: J-01 (search UI consolidation), J-13 (month headers/jump), J-11 (share summary formatting/microcopy).
- Unscheduled quick wins: J-05 (follow‑up scope helper text), J-12 (no‑cloud banner copy).

6) Design Plan (Phase 2 & 3)

Phase 2: High impact, higher effort

J-03 Deep‑link reliability from Card Gallery
- Goal: Deep links always land on the entry or show a clear “not loaded” state with a recovery CTA.
- UX behavior
  - When navigated with a `highlightEntryId`, show a slim banner at the top of Journal history: “Loading entry…” (spinner).
  - If found, scroll + highlight, then dismiss banner after a short delay.
  - If not found after attempts, show: “This entry isn’t loaded yet.” with a “Load older entries” button.
- Data/API
  - Add `GET /api/journal/[id]` in `functions/api/journal/[id].js` with ownership check and optional `includeFollowups=true`.
  - In `src/hooks/useJournal.js`, add `fetchEntryById(id)`:
    - If authenticated + entitled, call the new endpoint and merge into `entries` (dedupe).
    - If not authenticated, return null and let UI fallback to manual loading.
- Journal integration (`src/components/Journal.jsx`)
  - When `pendingHighlightEntryId` is set:
    1) Check current `entries` for ID.
    2) If missing and `hasMoreServerEntries`, call `loadMoreEntries()` in a loop with a hard cap (e.g., 3 pages or 75 entries) or until found.
    3) If still missing, call `fetchEntryById()` (cloud only).
    4) If found, scroll to `#journal-entry-${id}` and clear `pendingHighlightEntryId`.
    5) If not found, keep the banner with CTA.
  - Add a guard to prevent infinite loops if multiple deep‑links arrive.
- Acceptance criteria
  - Deep links to older entries succeed without manual scrolling for cloud users.
  - Non‑cloud users see a clear banner and CTA (no silent failure).
  - Banner never persists after a successful highlight.

J-06 Export/share scope selector + defaults
- Goal: Export/share scope explicitly matches what the user expects when filters are active.
- UX behavior
  - Replace the “Export current scope only” checkbox with a 3‑option selector:
    - All entries
    - Current filters
    - Current scope (analytics scope)
  - Default to “Current filters” when filters are active.
  - Default to “Current scope” when filters are off but analytics scope ≠ “all”.
  - Show warning text when filters are active but “All entries” is chosen.
- Implementation (`src/components/ReadingJourney/sections/ExportSection.jsx`)
  - Add `exportScope` state (`all|filters|scope`) and compute `exportEntries` from:
    - `allEntries` (all)
    - `filteredEntries` (filters)
    - `scopeEntries` (scope)
  - Move label + counts to reflect selected scope.
  - Align share scope selection with the same three options and reuse the same source arrays.
  - Keep the “recent” limit UI for share links but apply it to the selected source.
- Hook alignment
  - Ensure `ReadingJourney` continues passing `scopeEntries`, `filteredEntries`, and `entries` (already present).
  - Update any PDF/CSV export code paths to use `exportEntries` derived from `exportScope`.
- Acceptance criteria
  - With filters active, export defaults to filtered entries.
  - Changing scope updates counts and export/share payloads.
  - Warning appears only when filters are active and “All entries” is selected.

J-08 Summary scope labeling clarity
- Goal: Make unfiltered scope obvious when filters are active.
- Implementation (`src/components/ReadingJourney/sections/JournalSummarySection.jsx`)
  - Rename “Recent” to “Recent (unfiltered)” when filters are active but scope ≠ filters.
  - Add a short note under the label: “Filters aren’t applied to this summary.”
- Acceptance criteria
  - When filters are active, the summary label is explicit about scope.

Scope + Source chips (Phase 2 roadmap item)
- Goal: Expose whether Journey uses server (D1) or local data and which scope.
- Implementation
  - Add a small chip in `src/components/ReadingJourney/JourneySidebar.jsx` header and in `src/components/journal/JournalSummaryBand.jsx` header:
    - Scope text: `scopeLabel` (or “Filtered” if `analyticsScope === 'filters'`).
    - Source text: map `_dataSource === 'server'` → “D1”, else “Journal”.
    - Example: “This month · D1” or “Filtered · Journal”.
  - Optionally mirror the chip in `src/components/ReadingJourney/JourneyMobileSheet.jsx` for parity.
- Acceptance criteria
  - Chips reflect changes when filters or scope change.
  - Source label matches server vs client calculations.

Phase 3: Nice‑to‑have

J-01 Consolidate duplicate search UI
- Goal: One authoritative search input and a single mental model for filters.
- UX approach
  - Make the sticky bar a summary + “Edit filters” action.
  - Keep the actual search input inside `JournalFilters` only.
- Implementation (`src/components/Journal.jsx`, `src/components/JournalFilters.jsx`)
  - Remove the sticky search input when filters panel is visible; replace with:
    - Search summary text (current query + count)
    - “Edit filters” button that scrolls + focuses the `JournalFilters` search input
  - Add a prop to `JournalFilters` to expose its search input ref (e.g., `onSearchRef`), then focus it in `scrollToHistoryFilters`.
  - Update `JournalFloatingControls` to avoid duplicating search access if the sticky summary is visible.
- Acceptance criteria
  - Only one search input is visible at a time.
  - “Edit filters” reliably focuses the filters search field.

J-13 Long‑history scannability (sticky month headers + jump)
- Goal: Faster scanning and navigation for large histories.
- Implementation (`src/components/Journal.jsx`)
  - Group entries by month into sections with a header row that includes count.
  - Make month headers sticky within the history container (`position: sticky`).
  - Add a “Jump to month” select above the list that scrolls to anchors (`#month-YYYY-MM`).
  - Optional: add lightweight virtualization once entries exceed a threshold (e.g., 150), preserving month headers.
- Acceptance criteria
  - Month headers remain visible while scrolling.
  - Jump control scrolls to the right section.

J-11 Share summary formatting polish
- Goal: Consistent context/deck labels in share summaries.
- Implementation (`src/lib/journalInsights.js`)
  - Use `formatContextName(context)` instead of raw `context`.
  - Add deck label if available (deck name or mapped ID).
  - Keep messaging compact; avoid adding multiple lines unless needed.
- Acceptance criteria
  - Share summaries display human‑readable context and deck info.
