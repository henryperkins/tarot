# Journaling & Intention Coach Feature Review

## Journal Insights & Sharing
- **Aggregated stats**: `JournalInsightsPanel` shows entry counts, card totals, reversal rates, context mixes, frequent cards, and themes for either filtered or full journals. It adapts context suggestions into coach recommendations and respects filter state to avoid stale suggestions. 【F:src/components/JournalInsightsPanel.jsx†L73-L205】
- **Exports & visualizations**: Users can export CSVs, generate PDFs, and download a "visual card" from current or full datasets depending on filters. 【F:src/components/JournalInsightsPanel.jsx†L125-L154】
- **Sharing flows**: Quick share uses clipboard-backed links when authenticated, falling back to copied snapshots; filtered views limit shared entries to 10. A custom composer supports journal or single-entry links with expiry, count validation, and filter-aware entry selection. Active links list copy/delete controls. 【F:src/components/JournalInsightsPanel.jsx†L155-L376】
- **Coach handoff**: The panel auto-saves coach recommendations derived from top context/theme/card signals when unfiltered and lets users push the suggestion to the Guided Intention Coach. 【F:src/components/JournalInsightsPanel.jsx†L203-L273】

## Question Suggestion / Guided Intention Coach
- **Three-step wizard**: `GuidedIntentionCoach` guides topic, timeframe, and depth selections with a stepper, template shortcuts, and spread-aware topic suggestions. Modal controls include keyboard focus handling and backdrop close. 【F:src/components/GuidedIntentionCoach.jsx†L542-L660】
- **Persistence & history**: On apply, the coach saves last selections to `localStorage`, records asked questions, refreshes suggestions, and triggers callback hooks. 【F:src/components/GuidedIntentionCoach.jsx†L533-L539】
- **Suggestion display**: `CoachSuggestion` renders inline or journal-styled prompts with apply/dismiss actions and highlights the recommended spread/question pairing. 【F:src/components/CoachSuggestion.jsx†L1-L50】
