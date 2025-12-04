# Journal Feature Improvements - Implementation Plan

## Prioritized Next Steps

### 1. Inline Status Feedback Refactor (High Priority - ~1 day)
- [ ] Analyze current ToastContext dependencies in JournalEntryCard
- [ ] Create reusable inline status components with role="status"
- [ ] Replace toast-only flows in JournalEntryCard handlers
- [ ] Replace toast-only flows in JournalInsightsPanel
- [ ] Test accessibility of new inline feedback

### 2. Mobile Rail Accordion Overhaul (High Priority - ~2-3 days)
- [ ] Examine current mobile rail implementation in Journal.jsx
- [ ] Design accordion pattern for filters, insights, and archetype journey
- [ ] Implement independent accordion panels for mobile
- [ ] Preserve sticky behavior above lg breakpoint
- [ ] Test responsive behavior and accessibility

### 3. Saved Filters + Token Harmonization (Medium Priority - ~2 days)
- [ ] Analyze current outline token inconsistencies
- [ ] Centralize outline/fill tokens across components
- [ ] Implement minimal saved-filter functionality
- [ ] Apply consistent tokens in JournalFilters, JournalEntryCard, and JournalInsightsPanel
- [ ] Update design tokens configuration

### 4. Archetype Run Metadata Persistence (Low Priority - ~0.5 day)
- [ ] Examine current backfill metadata handling
- [ ] Store lastBackfillAt/entriesProcessed in analytics payload
- [ ] Update ArchetypeJourneySection header rendering
- [ ] Test metadata persistence after analytics load

### 5. Comprehensive QA/Accessibility Sweep (Low Priority - ~0.5 day)
- [ ] Keyboard navigation testing
- [ ] Screen reader testing with aria-live regions
- [ ] Focus ring validation
- [ ] Responsive behavior verification
- [ ] Journal checklist acceptance criteria validation

## Current Issues Identified

### Inline Status Feedback
- `JournalEntryCard` handlers exclusively use `showToast` with no inline state
- `JournalInsightsPanel` duplicates toast dependency
- No aria-live regions or status announcements

### Mobile Rail Behavior
- Sub-lg breakpoints use segmented swap instead of accordions
- Users cannot expand filters, insights, and archetype journey independently
- Lost parity with desktop sticky rail

### Saved Filters & Tokens
- "Saved filters coming soon" disabled placeholder
- Inconsistent outline tokens (`border-secondary/60` vs `/40` vs `/30`)
- Visual inconsistency across components

### Archetype Run Metadata
- Header relies on absent `analytics.stats?.lastAnalyzedAt`
- `runCaption` never persists timestamp after analytics load
- Metadata disappears post-backfill

## Files Referenced
- `src/components/JournalEntryCard.jsx` (lines 133-150, 152-188, 395-492)
- `src/components/JournalInsightsPanel.jsx` (lines 212-345, 685-729)
- `src/components/Journal.jsx` (lines 605-748)
- `src/components/JournalFilters.jsx` (lines 182-189, 182-244)
- `src/components/ArchetypeJourneySection.jsx` (lines 81-149, 424-435)
- `docs/journal-gap-assessment.md` (lines 5-62, 36-41, 45, 61-62)
- `docs/journal-redesign.md` (lines 64-84)
