# Journal Redesign & Enhancement Plan

Context pulled from `Tableu33.png` and the current implementation (`src/components/Journal.jsx`, `JournalEntryCard.jsx`, `JournalFilters.jsx`, `JournalInsightsPanel.jsx`, `ArchetypeJourneySection.jsx`, hooks in `src/hooks/useJournal.js` and `useSaveReading.js`).

## Goals
- Reduce scroll fatigue and make “what to do now” obvious.
- Improve scannability of entries and insights; separate “today” from “history.”
- Tighten visual system (buttons, chips, spacing) while preserving the dark theme and Tailwind tokens.
- Make archetype analytics and sharing/export feel integrated, not bolted on.
- Maintain accessibility: labeled controls, consistent focus states, keyboard reachability.

## Current State (summary)
- Single-column stack of cards; prompts/reports/requests read as a long uniform list.
- Primary actions (e.g., submit entry, share/export) look similar to minor controls.
- Mixed chip and button treatments; icon-only actions lack labels/tooltips.
- Insights and filters scroll away; archetype analytics are isolated and sometimes empty.
- Entry cards hide reflections and use a light preview; share/export feedback floats.

## Proposed Information Architecture
- **Two-pane layout on desktop**: main column for entry creation/history; right rail for filters + insights + archetype journey. Use `lg:grid lg:grid-cols-[1fr_360px] lg:gap-6` and a sticky rail (`lg:sticky lg:top-6`).
- **Mobile**: keep a single column but add top tabs/segmented control for Today / Insights / History; collapse rail into accordion sections.
- **Anchors**: top summary band with stats (entries, reversal %, top context, last entry) and a single primary CTA (start/new entry). Section headers for Today, Insights, History.

## Component-level Changes
### Journal page (`src/components/Journal.jsx`)
- Add a top summary band using `allStats/filteredStats` (entries count, reversal %, top context, last entry date) plus a primary CTA (e.g., “Start a reading” or “New entry”).
- Restructure layout into main + sticky rail. Rail hosts `JournalFilters`, `JournalInsightsPanel`, `ArchetypeJourneySection` (authed only).
- Introduce a “Compact list” toggle (state in Journal) that passes a prop to `JournalEntryCard` to render a condensed list on desktop.
- Paginate or virtualize history beyond the first batch; at minimum, retain batching but add month headers to break monotony.

### Entry cards (`src/components/JournalEntryCard.jsx`)
- Collapsed state should show: spread name, context chip, formatted date, 1-line question, first 2–3 card names (with reversal marker), and optionally a small reflections indicator.
- Add an optional `compact` mode: tighter padding, single-line preview, icons with labels on hover (desktop), always label on mobile.
- Move action buttons into a consistent footer bar with labels/tooltips (Copy, Export CSV, Share, Delete). Use the kebab menu only for small screens.
- Replace floating status toast with inline status text in the footer.
- Surface `reflections` (per-card notes) beneath Cards or as a small list; ensure orientation and spread position are visible.
- Keep `personalReading` toggle but cap width and line length; ensure markdown prose uses readable line height.

### Filters (`src/components/JournalFilters.jsx`)
- Normalize chip/button styling to a single pattern (one radius, one outline rule). Primary vs secondary: accent-filled for main CTA, ghost/outline for utility.
- Add a “Saved filters” slot if needed later; keep clear/reset visible but low-emphasis.

### Insights & share/export (`src/components/JournalInsightsPanel.jsx`)
- Replace dual “Show/Hide” pills with a single toolbar under the header containing labeled buttons: Share, Export CSV, PDF, Visual Card, Custom Link (if authed).
- Make the toolbar sticky within the panel to stay visible while scrolling analytics.
- Keep text labels next to icons for accessibility; ensure focus states.
- If filtered view is empty, show a small explainer (“Filters empty, using full journal”) instead of repeating the action message.

### Archetype Journey (`src/components/ArchetypeJourneySection.jsx` + `src/lib/archetypeJourney.js`)
- Keep placement in the right rail near insights. When empty, show the backfill CTA inline with a tiny “last run / entries processed” caption after a run.
- Expose `analytics.currentMonth` and `stats` in the card header for context; add subtle dividers between Top Cards, Recent Patterns, Achievements.
- Ensure backfill and badge icons have aria-label/title; keep skeletons consistent with rail cards.

### Sharing and export (`src/components/JournalEntryCard.jsx`, `JournalInsightsPanel.jsx`)
- Consolidate per-entry share/export into the footer bar with labels.
- In the panel, show active links in a list with copy/delete icons plus labels; keep text truncation and view counts.
- Provide clear copy feedback inline (not floating).

### Accessibility and spacing
- Standardize padding scale for cards/sections; avoid cramped input/button clusters.
- Add `aria-label`/`title` to icon-only buttons (copy/export/share/backfill/kebab). Keep visible focus rings.
- Slightly increase base font size for body text; cap narrative text width.

## Implementation Outline (incremental)
1) **Layout skeleton** (`Journal.jsx`): add grid + sticky rail; introduce summary band; wire “Compact list” state.
2) **Entry cards**: add compact mode, richer preview, footer actions, inline status; render reflections.
3) **Insights panel**: build labeled sticky toolbar; simplify show/hide controls; tighten share/export messages.
4) **Archetype journey**: surface last updated/backfill stats; ensure aria labels; align styling with rail cards.
5) **Styling sweep**: unify chip/button variants across Filters/Entries/Insights; adjust padding/typography; audit focus states.

## QA Checklist
- Keyboard: tab through filters, toolbar buttons, entry actions, and Archetype Journey backfill; focus rings visible.
- Screen reader: icon-only buttons announce purpose; section headers logical (Today, Insights, History).
- Responsive: desktop two-pane works ≥1024px; rail collapses or becomes accordion on mobile; compact list toggle behaves.
- Data states: empty journal, filtered empty, loading states (skeletons), share link creation failures, archetype backfill success/fail.
- Exports/sharing: CSV download, clipboard copy, PDF/visual card flows; entry-level share when authed vs guest fallback.

## Acceptance Criteria
- Primary CTA clearly visible in the summary band; only one dominant “entry” button on the page.
- Insights/filters/archetype stay accessible without excessive scroll (sticky rail desktop; top-placed accordion mobile).
- Entry list is scannable with context/question/cards visible when collapsed; actions are labeled and consistent.
- Visual system uses a unified button/chip style across journal surfaces.
- Accessibility: labeled icon buttons, visible focus, no floating status toasts needed to understand outcomes.
