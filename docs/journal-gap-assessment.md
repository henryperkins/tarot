# Journal redesign gap assessment (2025-12-04)

## Snapshot

- ✅ Two-pane layout, summary band with stats, month headers, and compact toggle shipped as described in [`Journal.jsx`](src/components/Journal.jsx#L563-L675) and [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L205-L335).
- ✅ Insights rail hosts filters, analytics, and archetype journey with a sticky toolbar per [`Journal.jsx`](src/components/Journal.jsx#L452-L480) and [`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L665-L839).
- ⚠️ Inline status feedback is still handled through toast notifications in entry cards and insights toolbar (see [`JournalEntryCard.handleEntryCopy()`](src/components/JournalEntryCard.jsx#L143-L150) and [`JournalInsightsPanel.handleExport()`](src/components/JournalInsightsPanel.jsx#L214-L220)), leaving the "no floating toasts required" goal unmet.
- ⚠️ Mobile "accordion" treatment for the rail is approximated with a segmented control, but filters/insights/archetype collapse together rather than as individual accordion panels (`Journal.jsx` mobile sections at [`Journal.jsx`](src/components/Journal.jsx#L605-L749)).
- ⚠️ Saved filters slot remains a disabled placeholder (`JournalFilters` at [`JournalFilters.jsx`](src/components/JournalFilters.jsx#L182-L189)) and button/chip tokens could use a final consistency sweep across entry footer & toolbar controls.

## Component-by-component review

### Journal layout (`Journal.jsx`)

- ✅ Summary band exposes entries, reversal %, top context, and last entry with a single dominant CTA (`New entry`) in [`Journal.jsx`](src/components/Journal.jsx#L563-L602).
- ✅ Desktop grid + sticky rail implemented via `lg:grid` container and `lg:sticky lg:top-6` wrapper ([`Journal.jsx`](src/components/Journal.jsx#L630-L744)).
- ⚠️ Mobile segmentation (`MOBILE_SECTIONS`) swaps entire rail content instead of discrete accordions, so filters/insights/archetype cannot be expanded independently ([`Journal.jsx`](src/components/Journal.jsx#L605-L748)).

### Journal entry cards (`JournalEntryCard.jsx`)

- ✅ Collapsed preview shows spread, context chip, timestamp, quoted question, and first cards with reversal marker ([`JournalEntryCard`](src/components/JournalEntryCard.jsx#L205-L269)).
- ✅ Compact mode adjusts spacing via `headerPadding`/`contentPadding` and keeps labels on desktop/mobile actions ([`JournalEntryCard`](src/components/JournalEntryCard.jsx#L196-L205), [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L395-L492)).
- ⚠️ Copy/export/share/delete actions emit ToastContext messages instead of inline feedback ([`JournalEntryCard.handleEntryCopy()`](src/components/JournalEntryCard.jsx#L143-L150), [`handleEntryExport()`](src/components/JournalEntryCard.jsx#L134-L141), [`handleEntryShare()`](src/components/JournalEntryCard.jsx#L152-L188)).

### Journal filters (`JournalFilters.jsx`)

- ✅ Timeframe, context, spread, deck dropdowns share the same rounded-xl pattern and focus styles ([`JournalFilters.jsx`](src/components/JournalFilters.jsx#L157-L244)).
- ⚠️ "Saved filters" placeholder is disabled rather than reserving a functional slot, leaving the future affordance unfinished ([`JournalFilters.jsx`](src/components/JournalFilters.jsx#L182-L189)).
- ⚠️ Secondary button styles differ slightly between filters (`border-secondary/60`) and entry footer (`border-secondary/30`), so the "one outline rule" goal is only partially met.

### Insights panel (`JournalInsightsPanel.jsx`)

- ✅ Sticky toolbar with labeled actions implemented ([`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L685-L729)), share link list surfaces copy/delete controls with inline feedback ([`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L923-L958)).
- ⚠️ Primary share/export/PDF/visual-card actions still rely on toasts for success/error messaging (`handleExport`, `handlePdfDownload`, `handleVisualCardDownload`, `handleShare` at [`JournalInsightsPanel.jsx`](src/components/JournalInsightsPanel.jsx#L214-L345)), contrary to the "inline feedback" requirement.

### Archetype journey section (`ArchetypeJourneySection.jsx`)

- ✅ Header exposes `analytics.currentMonth`, monthly stats, and divider-separated blocks ([`ArchetypeJourneySection`](src/components/ArchetypeJourneySection.jsx#L424-L444)).
- ✅ Empty state backfill CTA with stats and aria labels present ([`ArchetypeJourneySection`](src/components/ArchetypeJourneySection.jsx#L80-L148)).
- ⚠️ After a successful backfill, "last run / entries processed" appears only within the temporary result block and is not persisted once analytics load, so users lose the run timestamp once the empty state clears ([`ArchetypeJourneySection`](src/components/ArchetypeJourneySection.jsx#L93-L144)).

### Accessibility & spacing

- ✅ Sections employ consistent rounded-3xl shells and prose width caps ([`Journal.jsx`](src/components/Journal.jsx#L630-L736), [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L205-L393)).
- ⚠️ Focus indicators exist, but final audit for button/chip variants and inline status replacements is still outstanding to satisfy the "no floating toasts needed" acceptance criterion.

## Recommended implementation order & effort sizing

1. **Inline status feedback refactor (S, ~1 day)**
   Replace ToastContext usage in `JournalEntryCard` and `JournalInsightsPanel` with inline status text/icons near the action buttons; introduce transient state per action. Touchpoints: [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L134-L188), [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L395-L492), [`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L214-L345), [`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L685-L729).

2. **Mobile rail accordion & persistence tweaks (M, ~2-3 days)**
   Rework mobile view so filters, insights, and archetype journey render as independent accordion panels with their own expand/collapse state, preserving sticky behavior on larger breakpoints. Touchpoint: [`Journal.jsx`](src/components/Journal.jsx#L605-L748) plus potential layout helpers.

3. **Saved filters slot & button token sweep (M, ~2 days)**
   Implement the saved filter surface (even a minimal list + CTA) and normalize outline/fill tokens across filters, entry footer, and insights toolbar for consistent visual language. Touchpoints: [`JournalFilters`](src/components/JournalFilters.jsx#L182-L244), [`JournalEntryCard`](src/components/JournalEntryCard.jsx#L395-L492), [`JournalInsightsPanel`](src/components/JournalInsightsPanel.jsx#L685-L729).

4. **Archetype journey run metadata persistence (S, ~0.5 day)**
   Surface the last backfill timestamp and entries processed inside the populated card header so the context remains visible after analytics load ([`ArchetypeJourneySection`](src/components/ArchetypeJourneySection.jsx#L424-L435)).

5. **Follow-up QA sweep (S, ~0.5 day)**
   Re-run keyboard/screen-reader flows, mobile responsiveness, and empty/filtered states once inline statuses and accordion behavior are updated to close out the acceptance criteria checklist.
