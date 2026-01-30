# Tableu Coach Suggestion Loop - Engineering-Focused Analysis

## Goal
Improve the "Journal insights -> coach suggestion -> next action" loop so users:
1) Understand the detected pattern  
2) Trust where it came from  
3) Know what to do next

This doc aligns strictly to the current codebase and avoids breaking `useJourneyData` consumers.

---

# 1) System Data Flow (Actual Implementation)

## 1.1 Stats generation  
**Function:** `computeJournalStats(entries)` in `shared/journal/stats.js`  
**Behavior:**
- Returns **null** when `entries` empty.
- Computes:
  - `totalReadings`, `totalCards`, `reversalRate`
  - `frequentCards` (top 4, with reversed counts)
  - `contextBreakdown`
  - `monthlyCadence` (last 6 months)
  - `recentThemes` + `themeSignals` via `extractRecentThemes` / `buildThemeSignals` (recency-weighted themes from `themes.*`; falls back to `entry.context` only when theme extraction is missing)

## 1.2 Coach suggestion priority  
**Functions:** `computeEnhancedCoachSuggestions` in `src/hooks/useJourneyData.js` + `COACH_SOURCE_PRIORITY` in `src/lib/journalInsights.js`  
**Priority order (actual):**
1. `drift` (priority 100)  
2. `badge` (90)  
3. `topCard` (80)  
4. `majorArcana` (75)  
5. `theme` (70)  
6. `streak` (65)  
7. `context` (60)  
8. `emergingDrift` (55)  
9. `embeddings` / `extractedSteps` / `nextSteps` (50)  
10. `default` (10)

**Output shape includes (varies by source):**
- `sourceLabel`, `sourceDetail`, `signalsUsed`, `priority`
- `statusMessage` (extraction coverage)
- `relatedSteps`, `clusterSize` (embedding/step sources)

## 1.3 Drift detection  
**Function:** `computePreferenceDrift(entries, focusAreas)` in `src/lib/journalInsights.js`  
**Mapping:**
```
love -> love
career -> career
self_worth -> self
healing -> wellbeing
creativity -> career
spirituality -> spiritual
```
- Returns null if no entries or no focusAreas.
- Produces detail lines: `Expected focus`, `Most read`, `Drift (+count)`.

## 1.4 Embedding-based suggestions  
**Function:** `computeCoachSuggestionWithEmbeddings` in `src/lib/journalInsights.js`  
- Uses precomputed `extractedSteps` + `stepEmbeddings` per entry.
- Clusters via cosine similarity >= 0.75.
- Adds extraction coverage signal + `statusMessage` when coverage is low.
- If no embeddings: falls back to `computeExtractedStepsCoachSuggestionFromSorted` or `computeNextStepsCoachSuggestion` (heuristic from narrative "Gentle Next Steps").

## 1.5 Selection logic  
In `useJourneyData`:
- Build `coachSuggestions` from `nextStepsCoachSuggestion` + `computeEnhancedCoachSuggestions`.
- Sort by priority, dedupe by source+text, and expose `coachSuggestion` as the top pick.
- `CoachSuggestionSwitcher` lets users cycle through the top options (up to 3).

## 1.6 UI surface reality  
- **CoachSuggestion.jsx**: shows `sourceLabel` + tooltip with `sourceDetail`, badge callout, extraction `statusMessage`, related steps, multi-CTA actions (Start Reading / Save Intention / Open Journal), optional "Set focus areas" CTA, and scope label when filters are active.  
- **SeasonSummary.jsx** / **JourneySidebar.jsx** / **JourneyMobileSheet.jsx**: render `CoachSuggestionSwitcher` + `CoachSuggestion` to surface multi-suggestion flow.  
- **GuidedIntentionCoach.jsx**: loads `coachStatsSnapshot` / `journalInsights`; provenance is per-suggestion via `sourceDetail`.

---

# 2) Current Behavior Checklist (Implemented)

### 1) Source transparency
- CoachSuggestion renders `sourceLabel` with an Info tooltip for `sourceDetail`.

### 2) Multi-CTA actions
- Start Reading / Save Intention / Open Journal actions, plus optional focus-areas CTA.

### 3) Embedding provenance + extraction status
- `relatedSteps` + `clusterSize` shown for embedding/step sources, and `statusMessage` surfaced when extraction coverage is low.

### 4) Drift + emerging drift
- Drift suggestion when thresholds are met; emerging drift suggestion when below thresholds and no drift is present.

### 5) Filter scope visibility
- "Scoped to: {scopeLabel}" appears when `filtersActive` is true and scope label exists.

### 6) Badge + streak signals
- Badge callout appears for badge-driven suggestions; streak suggestions appear at 2+ days.

### 7) Multi-suggestion switching
- `CoachSuggestionSwitcher` exposes up to three sources with source labels.

---

# 3) Signals Table (Current Behavior)

| ID   | Signal/Feature        | Current behavior                                      | Evidence (logic/UI)                                  | Notes |
| ---- | --------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ----- |
| CI-1 | Source transparency   | Source label + tooltip in CoachSuggestion             | `CoachSuggestion.jsx` uses `sourceLabel`/`sourceDetail` | Shows per-suggestion provenance |
| CI-2 | Next action clarity   | Start/Save/Open CTAs in CoachSuggestion               | `CoachSuggestion.jsx` actions                        | Optional focus-areas CTA |
| CI-3 | Embeddings provenance | Related steps + cluster size + status message         | `computeCoachSuggestionWithEmbeddings` + `CoachSuggestion.jsx` | Extraction coverage messaging |
| CI-4 | Drift + emerging      | Drift or emerging drift surfaced when applicable      | `computePreferenceDrift` + `computeEnhancedCoachSuggestions` | Emerging only when drift absent |
| CI-5 | Filter scope          | Scoped label rendered when filters are active         | `CoachSuggestion.jsx`, journey headers               | Requires `scopeLabel` |
| CI-6 | Badge reward          | "Streak badge earned" callout for badge suggestions   | `CoachSuggestion.jsx`                                 | Badge source only |
| CI-7 | Theme provenance      | Theme tooltip uses counts + source type               | `buildThemeSignalDetail` + `sourceDetail`            | Uses themeSignals |

---

# 4) UI Patterns (Current)

## Pattern 1 - Multi-suggestion coach card  
**Trigger:** `coachSuggestions.length > 1`  
**Render logic:**  
- `CoachSuggestionSwitcher` shows source labels for top suggestions.  
- `CoachSuggestion` shows source tooltip + actions.

```
Try another angle: [Drift] [Theme] [Gentle next steps]
Source: Theme  [i]
Actions: [Start Reading] [Save Intention] [Open Journal]
```

## Pattern 2 - Drift / Emerging drift spotlight  
**Trigger:** `preferenceDrift.hasDrift` or `hasEmerging`  
- Uses computed drift detail lines + context labels.

## Pattern 3 - Gentle Next Steps cluster  
**Trigger:** `source` = embeddings / extractedSteps / nextSteps  
- Shows `relatedSteps`, `clusterSize`, and extraction `statusMessage` when applicable.

---

# 5) Validation Plan

## Metrics (instrument in UI)
1. Suggestion action rate (any CTA)
2. Switcher engagement rate
3. Transparency engagement (Info tooltip)
4. Start-reading conversion
5. Save-intention rate

## Scenarios (expected behavior)
| Scenario              | Preconditions                 | Expected Behavior                                | Signals                 |
| --------------------- | ----------------------------- | ----------------------------------------------- | ----------------------- |
| Empty journal         | 0 entries + focusAreas        | Default prompt + focus-areas CTA if enabled     | default                 |
| First reading saved   | 1 entry                       | TopCard/context if available else default       | topCard/context         |
| Filtered empty        | filtersActive + 0 matches     | No suggestion or reset CTA (UI decision)        | filtersActive           |
| Drift present         | focusAreas set                | Drift suggestion priority 100 + detail tooltip  | drift                   |
| Emerging drift        | below drift thresholds        | Emerging drift suggestion                        | emergingDrift           |
| Badge earned          | card >=3                      | Badge suggestion + callout                       | badge                   |
| Major arcana streak   | major arcana >=2               | Major arcana suggestion                          | majorArcana             |
| Streak active         | currentStreak >=2             | Streak check-in suggestion                       | streak                  |
| Theme cluster         | 3+ theme entries              | Theme suggestion + provenance tooltip            | theme                   |
| Embedding cluster     | steps + embeddings            | Next-steps suggestion + related steps            | embeddings              |

---

# 6) Implementation Notes (Non-breaking)

OK `useJourneyData` now exposes `coachSuggestions` (array) + `coachSuggestion` (top pick).  
OK `CoachSuggestionSwitcher` reads top 2-3 suggestions and uses source labels.  
OK `sourceDetail`, `signalsUsed`, and `statusMessage` are the provenance + extraction hooks.  
OK Focus-areas CTA is additive and gated by `showFocusAreasCta`.

---
