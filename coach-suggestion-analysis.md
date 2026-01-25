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
  - `recentThemes` via `extractRecentThemes` (uses `themes.archetypeDescription`, `themes.suitFocus`, `themes.elementalBalance`, `themes.reversalDescription.name`, and entry `context`)

## 1.2 Coach suggestion priority  
**Function:** `computeEnhancedCoachSuggestion` in `src/hooks/useJourneyData.js`  
**Priority order (actual):**
1. `drift` (priority 100)  
2. `badge` (90)  
3. `topCard` (80)  
4. `theme` (70)  
5. `context` (60)  
6. `default` (10)

**Output shape includes:**
- `sourceLabel`  
- `sourceDetail`  
- `signalsUsed`  
- `priority` (from `COACH_SOURCE_PRIORITY` in `journalInsights.js`)

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
- If no embeddings: falls back to `computeExtractedStepsCoachSuggestionFromSorted` or `computeNextStepsCoachSuggestion` (heuristic from narrative "Gentle Next Steps").

## 1.5 Selection logic  
In `useJourneyData`:
- `nextStepsCoachSuggestion` (embeddings)
- `enhancedCoachSuggestion` (drift/badge/topCard/theme/context/default)
- Final `coachSuggestion` is **max priority** of the two.

## 1.6 UI surface reality  
- **CoachSuggestion.jsx**: shows headline + helper + CTA only. **Does not show `sourceDetail` or `signalsUsed`.**  
- **SeasonSummary.jsx**: shows `sourceLabel` + tooltip with `sourceDetail` (Info icon).  
- **GuidedIntentionCoach.jsx**: loads `coachStatsSnapshot` / `journalInsights`, provides personalized suggestions but **no direct per-suggestion provenance**.

---

# 2) Top 7 Issues (Engineering Root Cause -> Fix)

### 1) Source transparency missing in CoachSuggestion
- **Impact:** No provenance in the main suggestion UI.
- **Root Cause:** `sourceDetail` is computed (in `computeEnhancedCoachSuggestion` and embedding suggestion), but not rendered in `CoachSuggestion.jsx`.
- **Fix (additive):** Add a disclosure/tooltip in `CoachSuggestion.jsx` using `recommendation.sourceDetail` and `sourceLabel`.

---

### 2) Next action path is single-CTA
- **Impact:** Users can't decide between reading, journaling, or saving.
- **Root Cause:** CoachSuggestion only has "Use this focus" or "Start with Intention Coach".
- **Fix (additive):** Add secondary actions tied to existing pathways:
  - Start reading with `spread`
  - Save intention via `recordCoachQuestion`
  - Open journal entry

---

### 3) Embedding suggestions lack UI provenance
- **Impact:** AI signals feel opaque.
- **Root Cause:** Embedding suggestion includes `sourceDetail` + `relatedSteps`, but CoachSuggestion ignores it.
- **Fix:** Render `sourceDetail` and show 1-2 `relatedSteps` if source is embeddings/extractedSteps/nextSteps.

---

### 4) Drift never triggers without focus areas
- **Impact:** Drift insight unavailable to onboarding-skippers.
- **Root Cause:** `computePreferenceDrift` returns null if `focusAreas` empty.
- **Fix:** Add lightweight CTA "Set focus areas" near coach suggestion when drift is missing but contexts exist.

---

### 5) Filter scope hidden in CoachSuggestion
- **Impact:** Suggestions change with filters but users don't know why.
- **Root Cause:** `filtersActive` default true (fail-closed) and `filterLabel` is stored in `persistCoachStatsSnapshot` but not rendered.
- **Fix:** Add `Scoped to: {filterLabel}` indicator when `filtersActive` true.

---

### 6) Badge signal not celebrated
- **Impact:** Badge logic is invisible to user, reduces reward loop.
- **Root Cause:** Badge info used for logic only, not UI.
- **Fix:** If `source === 'badge'`, render badge icon and "Streak badge earned for {card}".

---

### 7) Theme signal lacks provenance
- **Impact:** Themes feel abstract; users don't see why.
- **Root Cause:** `recentThemes` merges multiple sources without count; UI doesn't show counts.
- **Fix:** Add "Theme from X recent readings" line + top context(s) in `sourceDetail`.

---

# 3) Findings Table

| ID   | Signal/Feature        | What Breaks                  | Evidence (logic/UI)                                    | Fix (specific)                   | Effort | Risk |
| ---- | --------------------- | ---------------------------- | ------------------------------------------------------ | -------------------------------- | ------ | ---- |
| CI-1 | Source transparency   | No "why" in CoachSuggestion  | `sourceDetail` computed, not rendered in CoachSuggestion | Render `sourceDetail` with tooltip | Med    | Low  |
| CI-2 | Next action clarity   | Only one CTA                 | CoachSuggestion lacks Save/Journal                     | Add Start/Save/Journal buttons   | Med    | Low  |
| CI-3 | Embeddings provenance | AI feels opaque              | `relatedSteps` unused in UI                              | Show cluster size + 1-2 steps    | Med    | Low  |
| CI-4 | Drift missing         | No drift if focusAreas empty | `computePreferenceDrift` returns null                    | Add focusAreas CTA               | Low    | Low  |
| CI-5 | Filter scope          | Scope not visible            | `filterLabel` stored, not shown                          | Add scope badge                  | Low    | Low  |
| CI-6 | Badge reward          | Badge not celebrated         | Badge logic only                                       | Render badge indicator           | Low    | Low  |
| CI-7 | Theme provenance      | Theme feels abstract         | No theme count/provenance                              | Show "Theme from X readings"     | Med    | Low  |

---

# 4) UI Concepts (Engineering-ready)

## Concept 1 - Insight Card + Provenance Drawer  
**Trigger:** Any `coachSuggestion`.  
**Render logic:**  
- Show `sourceLabel` + `sourceDetail` in collapsible area.  
- Use `spread` to label CTA.

```
Top card - The Empress (3x)
Question: "What is The Empress asking me to notice?"
[Why am I seeing this?] v
  - Top card: The Empress (3x)
Actions: [Start Reading] [Save Intention] [Journal]
```

## Concept 2 - Drift Spotlight  
**Trigger:** `preferenceDrift.hasDrift === true`.  
- Use `drift.context` and `detail` lines already computed.

## Concept 3 - Gentle Next Steps Cluster  
**Trigger:** `source` = embeddings / extractedSteps / nextSteps.  
- Show `relatedSteps` (1-2 items) and `clusterSize`.

---

# 5) Validation Plan

## Metrics (instrument in UI)
1. Suggestion action rate (any CTA)
2. Start-reading conversion
3. Transparency engagement (click on "Why")
4. Trust score survey
5. Save-intention rate

## Scenarios (expected behavior)
| Scenario            | Preconditions              | Expected Behavior                         | Signals            |
| ------------------- | -------------------------- | ----------------------------------------- | ------------------ |
| Empty journal       | 0 entries + focusAreas     | FocusArea suggestions / onboarding        | default/focusAreas |
| First reading saved | 1 entry                    | TopCard/context if available else default | topCard/context    |
| Filtered empty      | filtersActive + 0 matches  | Show "no suggestions" + reset             | filtersActive      |
| Drift present       | focusAreas set             | Drift priority 100 + detail lines         | drift              |
| Badge earned        | card >=3                    | Badge priority 90 + badge indicator       | badge              |
| Theme cluster       | 3+ theme entries           | Theme priority 70 + provenance            | theme              |
| Embedding cluster   | 5+ steps                   | Embedding priority 50 + cluster detail    | embeddings         |
| Cache stale         | coach recommendation > 24h | Recompute suggestion                      | TTL                |

---

# 6) Implementation Notes (Non-breaking)

OK Add UI elements only - do not change `useJourneyData` output shape.  
OK Use `sourceDetail`, `signalsUsed`, `sourceLabel` already computed.  
OK For scope badge, use `coachStatsMeta.filterLabel` (already stored).  
OK For next-step clusters, use `relatedSteps` and `clusterSize` from embedding suggestion.

---