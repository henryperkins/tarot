# Tableau Journal Insights + Coach Suggestion Report

**Updated:** 2026-01-27
**Scope:** Reading Journey insights + coach suggestion pipeline (client + worker).

## Top 7 status updates and remaining gaps (ranked by user impact)

1) Coach suggestions now align with the scoped insights window; selected alternates persist in the coach snapshot.
2) Theme signals are weighted by recency + frequency with source and confidence in the tooltip; context is no longer a theme candidate.
3) Core stats now expose reliability flags; UI shows "Emerging" for low sample sizes.
4) Preference drift now requires 3+ readings and minimum count/ratio; emerging interest is surfaced with an "Update focus areas" CTA.
5) Next-steps extraction now exposes coverage and status messaging, and clustered steps show counts.
6) Coach selection now supports a primary + alternates via a switcher (mobile + sidebar).
7) Motivation mechanics now feed coach prompts (streak + major arcana); badges still require a top-card match.

## Findings table

| ID | Feature | Status | Notes | Evidence |
| --- | --- | --- | --- | --- |
| I1 | Insights + Coach windowing | Addressed | Coach suggestions are computed from scoped entries to match the visible window. | `src/hooks/useJourneyData.js` |
| I2 | Theme signal | Addressed | Recency/frequency weighting + theme source confidence; context removed from theme candidates. | `shared/journal/stats.js`, `src/hooks/useJourneyData.js` |
| I3 | Core stats | Addressed | Reliability flags for reversal rate and card frequency; UI shows "Emerging" with sample size. | `shared/journal/stats.js`, `src/components/ReadingJourney/JourneySidebar.jsx` |
| I4 | Preference drift | Addressed | Thresholds and emerging interest state added; CTA copy updates to "Update focus areas". | `src/lib/journalInsights.js`, `src/components/ReadingJourney/sections/ContextBreakdown.jsx` |
| I5 | Next steps + embeddings | Addressed | Extraction coverage signals and status message surfaced; cluster size label shown. | `src/lib/journalInsights.js`, `src/components/CoachSuggestion.jsx` |
| I6 | Coach selection | Addressed | Coach suggestions return a ranked list with a 3-option switcher. | `src/hooks/useJourneyData.js`, `src/components/ReadingJourney/CoachSuggestionSwitcher.jsx` |
| I7 | Motivation mechanics | Addressed | Streak and major arcana now generate coach prompts; badges remain conditional. | `src/lib/journalInsights.js` |
| I8 | Persistence | Addressed | Snapshot stores the selected coach suggestion with index/key for restoration. | `src/components/ReadingJourney/JourneyContent.jsx` |

## UI concepts (wireframe-level)

### Concept 1: Next Step Spotlight

- Implemented: coach card now shows cluster size and related steps, plus extraction status messaging.
- First-time mode: status messaging now nudges users to add a "Gentle Next Steps" section.

### Concept 2: Pattern Triad Switchboard

- Implemented: coach switcher exposes up to three sources (theme/card/drift/etc) with "why this" details in the tooltip.
- Implemented: selected tile persists via coach snapshot metadata.

### Concept 3: Return Loop Ladder

- Partially implemented: streak and major arcana prompts now feed coach suggestions.
- Opportunity: tie badges to a next-action CTA and show progress to next badge.

## Integration points deep dive (current)

### 1) Journal entry ingestion -> stats computation -> insights UI

- Input source: `/api/journal` returns entries with `cards_json`, `themes_json`, `context`, and `narrative`. Local-only flows use `useJournal` and persist insights to localStorage.
- Stats computation: `computeJournalStats()` now returns `themeSignals`, `topTheme`, and reliability flags in addition to `recentThemes`.
- Theme extraction: recency + frequency weighted across archetype, suit, element, and reversal description. Context is no longer a theme candidate.
- UI integration: `useJourneyData()` computes stats on `scopedEntries`; reliability flags drive "Emerging" labels for low sample sizes.

### 2) Journal save -> AI extraction -> embeddings -> client clustering

- Trigger: `scheduleCoachExtraction()` runs on save when AI/DB bindings exist and narrative length >= 100.
- Extraction: `extractNextStepsWithAI()` returns steps, `v1-empty`, or `v1-steps-only` status when parsing or embeddings fail.
- Retrieval: `/api/journal` includes extracted steps for all entries, embeddings for the newest entries only.
- Clustering: `computeCoachSuggestionWithEmbeddings()` surfaces extraction coverage signals and adds a status message when steps are missing.

### 3) Coach suggestion generation -> selection -> UI surfaces -> next reading

- Generation: `useJourneyData()` builds next-steps suggestions from `scopedEntries` and enhanced suggestions from drift/badge/top card/major arcana/theme/streak/context/default.
- Selection: candidates are ranked by `COACH_SOURCE_PRIORITY`, deduped, and surfaced as `coachSuggestions`.
- Display: `CoachSuggestionSwitcher` lets users toggle up to three options in the journey surfaces.
- Action routing: "Start Reading" routes to `/` with `suggestedSpread` and `suggestedQuestion` as before.

### 4) Coach suggestion -> Guided Intention Coach & local persistence

- Snapshot persistence: `JourneyContent` stores the selected `coachSuggestion` plus index/key for restoration.
- Coach usage: `GuidedIntentionCoach` uses the snapshot or stored journal insights.
- Personalization: `buildPersonalizedSuggestions()` now reads `reversedCount` as well as `reversed` to preserve reversal detail.

### 5) Preference drift integration

- Computation: `computePreferenceDrift()` now returns `hasEmerging` and `insufficientData` with thresholded drift.
- Surfaces: context breakdown uses "Drift" vs "Emerging interest" labels; coach CTA copy updates accordingly.

### 6) Motivation mechanics integration

- Streaks and major arcana now generate coach suggestions with dedicated labels.
- Badges still only trigger when the top card matches the most recent badge.

### 7) Integration gaps to be aware of

- `saveCoachRecommendation()` is still only used to clear stored data; no persistence of coach suggestions is wired for reading reuse.
- Alternates are now persisted in snapshot metadata; cross-device persistence remains a future enhancement.
