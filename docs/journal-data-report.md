# Complete Journal Data Report

## Table of Contents
1. [Component Hierarchy](#1-component-hierarchy)
2. [Data Displayed Per Component](#2-data-displayed-per-component)
3. [Statistics Computation](#3-statistics-computation)
   - [3.1 Entry Deduplication](#31-entry-deduplication)
   - [3.2 computeJournalStats()](#32-computejournalstatsentries-from-sharedjournalstatsjs)
   - [3.3 Theme Extraction Priority](#33-theme-extraction-priority)
   - [3.4 Preference Drift Computation](#34-preference-drift-computation)
   - [3.5 Journey Summary Builder](#35-journey-summary-builder)
   - [3.6 Knowledge Graph Analysis](#36-knowledge-graph-analysis)
4. [Export Data Formats](#4-export-data-formats)
5. [Shared/External Data Exposure](#5-sharedexternal-data-exposure)
   - [5.1 Share Link Creation](#51-share-link-creation-post-apishare)
   - [5.2 Share Link View](#52-share-link-view-get-apisharetoken)
   - [5.3 Share Link Management](#53-share-link-management-users-own-links)
   - [5.4 API Endpoints](#54-api-endpoints)
6. [Data Flow Diagram](#6-data-flow-diagram)
   - [6.1 LocalStorage Schema](#61-localstorage-schema)
   - [6.2 Database Schema](#62-database-schema)
7. [Reading Save Process](#7-reading-save-process)
8. [Coach Storage System](#8-coach-storage-system)
9. [Summary: Complete Data Inventory](#9-summary-complete-data-inventory)
10. [Computed but Not Surfaced in UI](#10-computed-but-not-surfaced-in-ui)

---

## 1. Component Hierarchy

```
Journal.jsx (1,461 lines) - Main orchestrator
├── JournalFilters.jsx (711 lines) - Filter controls + constellation viz
├── JournalEntryCard.jsx (719 lines) - Individual entry display
│   └── CardSymbolInsights.jsx (365 lines) - Symbol tooltips/bottom sheets
├── JournalInsightsPanel.jsx (946 lines) - Analytics dashboard
│   ├── ArchetypeJourneySection.jsx (561 lines) - Card tracking gamification
│   └── CoachSuggestion.jsx (133 lines) - AI-powered recommendations
└── SavedIntentionsList.jsx (192 lines) - Coach history cards
```

---

## 2. Data Displayed Per Component

### 2.1 Journal.jsx - Main Dashboard

#### Summary Statistics ("Journal Pulse")

| Field | Source | Computation |
|-------|--------|-------------|
| Entries logged | `entries.length` | Direct count |
| Reversal rate | `stats.reversalRate` | `(reversedCards / totalCards) * 100` |
| Top context | `stats.contextBreakdown[0].name` | Most frequent context |
| Last entry | `latestEntry.ts` | Max timestamp |

#### Hero Card Section (Latest Reading)

| Data | Source |
|------|--------|
| Card image | `card.image` or path derived from `card.name` |
| Card name | `card.name` |
| Orientation | `card.orientation` ("Upright" / "Reversed") |
| Element | Derived from `card.suit` (Wands→Fire, Cups→Water, etc.) |
| Traditional meaning | `card.upright` or `card.reversed` from card data |
| Date badge | `entry.ts` formatted |

#### Entry List

| Data | Format |
|------|--------|
| Month headers | Grouped by `MMMM YYYY` |
| Timestamp | `ddd, MMM D, h:mm A` |
| Spread name | `entry.spread` or `entry.spreadName` |
| Context badge | Icon + label (Love, Career, Self, etc.) |
| Card count | `entry.cards.length` |
| Reflection count | `Object.keys(entry.reflections).length` |
| Question preview | Truncated to ~60 chars |

---

### 2.2 JournalFilters.jsx - Filter Controls

#### Filter Options Available

| Filter | Type | Options |
|--------|------|---------|
| Search query | Text input | Free text search |
| Timeframe | Single-select | All time, 30d, 90d, This year |
| Contexts | Multi-select | Dynamic from entries |
| Spreads | Multi-select | Dynamic from entries |
| Decks | Multi-select | Dynamic from entries |
| Reversals only | Toggle | Boolean |

#### Constellation Visualization (Desktop)

Displays 6 filter nodes with values:
- **Search**: Active query or "All readings"
- **Timeframe**: Selected label
- **Contexts**: "X selected" or "Any"
- **Spreads**: "X chosen" or "Any"
- **Decks**: "X deck(s)" or "Any"
- **Reversals**: "Only reversed" or "Include all"

#### Saved Filters

| Data | Storage |
|------|---------|
| Filter name | User-defined |
| Filter values | `{query, contexts[], spreads[], decks[], timeframe, onlyReversals}` |
| Persisted to | `localStorage.journal_saved_filters_v1` |

---

### 2.3 JournalEntryCard.jsx - Individual Entry

#### Collapsed Header

| Field | Source |
|-------|--------|
| Spread name | `entry.spread` |
| Context badge | `entry.context` with icon |
| Reflection indicator | Count of non-empty reflections |
| Timestamp | `entry.ts` |
| Card count | `entry.cards.length` |
| Question preview | Truncated `entry.question` |

#### Expanded Content

**Cards Section** (per card):

| Field | Source |
|-------|--------|
| Position label | `card.position` |
| Card name | `card.name` |
| Suit icon | Derived from `card.suit` |
| Orientation badge | `card.orientation` |
| Symbol insights button | Opens `CardSymbolInsights` |

**Key Themes Section**:

| Theme | Source | Example Display |
|-------|--------|-----------------|
| Context lens | `CONTEXT_SUMMARIES[entry.context]` | "Relationship lens — center relational reciprocity..." |
| Suit focus | `entry.themes.suitFocus` | "Cups-dominant reading" |
| Elemental balance | `entry.themes.elementalBalance` | "Water-heavy: emotions, intuition" |
| Reversal lens | `entry.themes.reversalDescription` | "Blocked energy pattern" |
| Timing profile | `TIMING_SUMMARIES[entry.themes.timingProfile]` | "Energy shifts in the near-term" |

**Reflections Section** (per position):

| Field | Source |
|-------|--------|
| Position label | `entry.cards[index].position` |
| Reflection text | `entry.reflections[index]` |

**Reading Narrative**:

| Field | Source |
|-------|--------|
| Full narrative | `entry.personalReading` |
| Collapsible | Yes, with expand/collapse |

**Share Links** (if any):

| Field | Source |
|-------|--------|
| Title | `shareLink.title` |
| View count | `shareLink.viewCount` |
| Expiry status | Computed from `shareLink.expiresAt` |
| Entry count | `shareLink.entryCount` |

---

### 2.4 CardSymbolInsights.jsx - Symbol Tooltips

#### Displayed Data

| Field | Source |
|-------|--------|
| Card name | `insights.name` |
| Orientation | "Upright" or "Reversed" |
| Keywords | `insights.keywords.slice(0, 3)` |
| Archetype | `insights.archetype` |
| Symbols | `insights.symbols[]` with object, position, meaning |
| Color palette | `insights.colors[]` with color name + meaning |

#### Data Sources

- **Major Arcana**: `shared/symbols/symbolAnnotations.js`
- **Minor Arcana**: `shared/vision/minorSymbolLexicon.js`
- **Card base data**: `src/data/majorArcana.js`, `src/data/minorArcana.js`

---

### 2.5 JournalInsightsPanel.jsx - Analytics Dashboard

#### Header Stats

```
Filtered: 12 of 45 entries · 23% reversed
// or when not filtered:
45 entries · 156 cards · 18% reversed
```

#### Frequent Cards Section

| Field | Limit |
|-------|-------|
| Card name | Top 5 (3 in landscape) |
| Appearance count | `X×` format |

#### Context Mix Section

| Field | Display |
|-------|---------|
| Context icon | Mapped per context type |
| Context name | Capitalized |
| Count badge | Number of entries |

#### Recent Themes Section

| Source | Limit |
|--------|-------|
| `stats.recentThemes` | Up to 4 themes |

#### Emerging Interests (Preference Drift)

When `hasDrift` is true:

```
You've been exploring Love and Self themes beyond your selected focus areas.
Consider updating your focus areas in Settings...
```

**Computed from**:
- User's `focusAreas` from preferences
- Actual `context` values in entries
- Drift = contexts used but not in focus areas

#### Coach Suggestion

| Field | Source |
|-------|--------|
| Question | `recommendation.question` |
| Spread name | `recommendation.spreadName` |
| Custom focus | `recommendation.customFocus` |
| Source type | `recommendation.source` (theme:X, context:Y, card:Z) |

---

### 2.6 ArchetypeJourneySection.jsx - Gamification

#### Header Stats

```
December 2024
12 entries this month · Avg 3/week · 45 total
Last analyzed Dec 4, 10:30 AM · 45 entries processed
```

#### Top Cards Section

| Field | Limit |
|-------|-------|
| Rank (1-5) | Numbered badges |
| Card name | Full name |
| Count | `X×` format |

#### Recent Patterns (Streaks)

| Field | Display |
|-------|---------|
| Card name | Full name |
| Count | "Appeared X time(s) this month" |
| Limit | Top 3, "+N more" indicator |

#### Achievements (Badges)

| Field | Source |
|-------|--------|
| Badge icon | `getBadgeIcon(badge.badge_type)` |
| Card name | `badge.card_name` |
| Context | `badge.metadata.context` |

#### Backfill Results (when triggered)

```
Backfill complete!
- 45 entries processed
- 156 cards tracked
- 3 badges awarded
```

---

### 2.7 SavedIntentionsList.jsx - Coach History

#### Per Intention Card

| Field | Source |
|-------|--------|
| Question text | `item.question` |
| Created date | `item.createdAt` formatted |
| Visual style | Sticky note with tape effect |

#### Pagination

- Page size: 6 items
- Shows: `{page} / {totalPages}` with prev/next

---

## 3. Statistics Computation

### 3.1 Entry Deduplication

Before computing statistics, entries are deduplicated via `dedupeEntries()` from `shared/journal/dedupe.js`:

**Deduplication Strategy (Priority Order):**
1. **sessionSeed** - If present, uses `seed:{sessionSeed}` as unique key (server-side constraint)
2. **Fingerprint** - Composite hash: `ts:{timestamp}|spread:{spreadKey}|q:{question}|cards:{cardSignature}`

**Card Signature Format:**
```javascript
// Per card: "position|name|orientation" (lowercased)
// Cards joined with semicolons
"past|the fool|upright;present|death|reversed;future|the star|upright"
```

### 3.2 `computeJournalStats(entries)` from `shared/journal/stats.js`

```javascript
{
  totalReadings: number,      // entries.length
  totalCards: number,         // sum of all cards across entries
  reversalRate: number,       // (reversedCards / totalCards) * 100, rounded
  frequentCards: [            // top 4 by count
    { name: string, count: number, reversed: number }
  ],
  contextBreakdown: [         // all contexts with counts
    { name: string, count: number }
  ],
  monthlyCadence: [           // last 6 months
    { label: "Dec 2024", count: number }
  ],
  recentThemes: string[]      // up to 4 unique themes from recent entries
}
```

### 3.3 Theme Extraction Priority

From `extractRecentThemes()` in `shared/journal/stats.js`:

1. `themes.archetypeDescription`
2. `themes.suitFocus`
3. `themes.elementalBalance`
4. `themes.reversalDescription.name`
5. `entry.context`

### 3.4 Preference Drift Computation

From `computePreferenceDrift()` in `src/lib/journalInsights.js`:

```javascript
computePreferenceDrift(entries, focusAreas) → {
  expectedContexts: string[],     // mapped from focus areas
  actualTopContexts: [{context, count}],
  driftContexts: [{context, count}],  // used but not expected
  hasDrift: boolean
}
```

**Focus Area to Context Mapping:**

| Focus Area | Maps to Context |
|------------|-----------------|
| `love` | `love` |
| `career` | `career` |
| `self_worth` | `self` |
| `healing` | `wellbeing` |
| `creativity` | `career` |
| `spirituality` | `spiritual` |

### 3.5 Journey Summary Builder

`buildHeuristicJourneySummary(entries, statsOverride)` from `shared/journal/summary.js`:

Generates prose summary for AI consumption:
```
Over {totalReadings} logged readings, a {reversalRate}% reversal tilt and {totalCards} cards point to the themes you keep circling back to.
Top contexts: {context} ({count}), ...
Recurring cards: {name} · {reversed} rev, ...
Recent themes whisper about {theme1}, {theme2}, {theme3}.
• {spread} ({context} lens) on {date} featured {card1}, {card2}...
Notice where these threads overlap and invite one grounded action to honor the energy.
```

---

## 4. Export Data Formats

### 4.1 CSV Export (`buildJournalCsv`)

| Column | Source |
|--------|--------|
| Timestamp | `entry.ts` as ISO string |
| Spread | `entry.spread` |
| Spread Key | `entry.spreadKey` |
| Question | `entry.question` |
| Cards | Formatted as "Position: Name (Orientation) \| ..." |
| Context | `entry.context` |
| Provider | `entry.provider` |
| Deck | `entry.deckId` |
| Session Seed | `entry.sessionSeed` |
| Reflections | JSON stringified |
| Themes | JSON stringified |
| Narrative | `entry.personalReading` |

### 4.2 PDF Export (`exportJournalInsightsToPdf`)

**Page 1 - Summary**:
- Title: "Mystic Tarot · Journal Snapshot"
- Stats line: Entries, Cards, Reversal Rate
- Recent themes (if any)
- Context cadence bar chart

**Page 2+ - Highlighted Entries** (up to 4):
- Entry number
- Spread name, context, date
- Intention/question
- Cards list (up to 5): "Position: Name (Orientation)"

### 4.3 SVG Visual (`downloadInsightsSvg`)

```svg
- Header: "Mystic Tarot · Snapshot"
- Stats: "Entries: X · Cards: Y · Reversals: Z%"
- Bar chart: Context breakdown (top 5)
- Dimensions: 640x360
```

### 4.4 Clipboard Summary Formats

**Journal Summary** (`copyJournalShareSummary`):

```
Mystic Tarot Journal Snapshot
Entries: 45
Cards logged: 156
Reversal rate: 18%
Top cards: The Star (5×), Six of Cups (4×)
Themes: Love; Growth; Healing
```

**Entry Summary** (`copyJournalEntrySummary`):

```
Spread: Three-Card Story
Question: How can I improve my relationships?
Cards: The Star (Upright), Six of Cups (Reversed), The Sun (Upright)
Context: love
When: 12/4/2024, 10:30 AM
```

### 4.5 Knowledge Graph Analysis

When `enableKnowledgeGraph` is true (default), `analyzeSpreadThemes()` in `functions/lib/spreadAnalysis.js` returns additional pattern data:

```javascript
themes.knowledgeGraph: {
  // From buildGraphContext()
  graphKeys: {
    completeTriadIds: string[],    // e.g., ['death-temperance-star']
    triadIds: string[],            // All detected triads (partial + complete)
    foolsJourneyStageKey: string,  // e.g., 'integration', 'mastery'
    dyadPairs: [{
      cards: number[],
      names: string[],
      significance: 'high' | 'medium',
      category: string
    }],
    suitProgressions: [{
      suit: string,
      stage: string,
      significance: 'strong-progression' | 'moderate'
    }]
  },
  
  // From retrievePassages()
  retrievedPassages: [{
    priority: number,              // 1=triads, 2=journey, 3=dyads, 4=progressions
    type: 'triad' | 'fools-journey' | 'dyad' | 'suit-progression',
    patternId: string,
    title: string,
    theme: string,
    text: string,                  // Passage content
    source: string,                // Attribution
    relevance: number,             // Keyword match score
    relevanceScore?: number        // Semantic similarity (if enabled)
  }]
}
```

**GraphRAG Quality Metrics** (from `buildQualityRetrievalSummary()`):

```javascript
{
  passagesRetrieved: number,
  passagesByType: { triad: n, dyad: n, ... },
  qualityMetrics: {
    averageRelevance: number,
    minRelevance: number,
    maxRelevance: number,
    semanticScoringUsed: boolean
  }
}
```

---

## 5. Shared/External Data Exposure

### 5.1 Share Link Creation (`POST /api/share`)

**Request**:

```javascript
{ scope: 'entry'|'journal', entryIds: [], limit: 5, expiresInHours: 168, title: "My reading" }
```

**Stored Metadata** (`buildShareMeta`):

```javascript
{
  entryCount: number,
  spreadKeys: string[],
  contexts: string[],
  lastEntryTs: number
}
```

### 5.2 Share Link View (`GET /api/share/:token`)

**Data Exposed to External Viewers**:

| Field | Exposed |
|-------|---------|
| `scope` | Yes |
| `title` | Yes (user-defined or default) |
| `createdAt` | Yes |
| `expiresAt` | Yes |
| `viewCount` | Yes (incremented on each view) |
| `meta` | Yes (entryCount, spreadKeys, contexts, lastEntryTs) |
| `stats` | Yes (full computeJournalStats output) |
| `entries` | **Yes - Full entry data** |
| `notes` | Yes (collaboration notes) |

**Full Entry Data Exposed**:
- `id`, `created_at`, `spread_key`, `spread_name`
- `question`
- `cards_json` (all card data)
- `narrative` (full reading text)
- `themes_json`
- `reflections_json`
- `context`, `provider`, `session_seed`

### 5.3 Share Link Management (User's own links)

Displayed per share:

| Field | Display |
|-------|---------|
| Token | Hidden, used for URL |
| Title | User-defined or default |
| Scope | "entry" or "journal" |
| Entry count | Number |
| View count | Number |
| Expiry | Relative time or "Expired" |
| Spread keys | List |
| Contexts | List |

---

### 5.4 API Endpoints

#### Journal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/journal` | GET | Fetch user's journal entries |
| `/api/journal` | POST | Create new journal entry |
| `/api/journal/[id]` | DELETE | Delete specific entry (ownership verified) |
| `/api/journal-summary` | POST | Generate AI-powered journal summary |
| `/api/journal-export` | GET | Export all readings as PDF |
| `/api/journal-export/[id]` | GET | Export single reading as PDF |

#### Share Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/share` | GET | List user's share links |
| `/api/share` | POST | Create share link |
| `/api/share/:token` | GET | View shared content (increments view count) |
| `/api/share/:token` | DELETE | Revoke share link |
| `/api/share-notes/:token` | GET | Get collaboration notes for shared link |
| `/api/share-notes/:token` | POST | Add collaboration note to shared link |

#### Archetype Journey Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/archetype-journey` | GET | Get analytics data for authenticated user |
| `/api/archetype-journey/track` | POST | Track card appearances (called on reading save) |
| `/api/archetype-journey/preferences` | PUT | Update analytics preferences |
| `/api/archetype-journey/reset` | POST | Reset all analytics data |
| `/api/archetype-journey-backfill` | POST | Backfill card_appearances from journal history |

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
├─────────────────────────────────────────────────────────────────────┤
│  D1 Database (authenticated)  │  localStorage (unauthenticated)     │
│  - journal_entries            │  - tarot_journal                    │
│  - share_tokens               │  - tarot_journal_cache              │
│  - card_appearances           │  - tarot_journal_insights           │
│  - archetype_badges           │  - tarot_coach_recommendation       │
│  - user_analytics_prefs       │  - tarot_coach_stats_snapshot       │
│                               │  - tarot_journal_share_tokens       │
│                               │  - journal_saved_filters_v1         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PROCESSING LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  dedupeEntries()          - Fingerprint-based deduplication         │
│  computeJournalStats()    - Aggregate statistics                    │
│  computePreferenceDrift() - Focus area vs actual usage              │
│  buildCardInsights()      - Symbol/archetype enrichment             │
│  extractRecentThemes()    - Theme extraction from entries           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DISPLAY COMPONENTS                             │
├─────────────────────────────────────────────────────────────────────┤
│  Journal.jsx              │  JournalInsightsPanel.jsx               │
│  - Hero cards             │  - Frequent cards                       │
│  - Entry list             │  - Context mix                          │
│  - Summary stats          │  - Recent themes                        │
│                           │  - Preference drift                     │
│  JournalEntryCard.jsx     │  - Coach suggestion                     │
│  - Full entry details     │                                         │
│  - Themes                 │  ArchetypeJourneySection.jsx            │
│  - Reflections            │  - Top cards this month                 │
│  - Share links            │  - Streaks/patterns                     │
│                           │  - Badges                               │
│  JournalFilters.jsx       │                                         │
│  - Constellation viz      │  SavedIntentionsList.jsx                │
│  - Filter dropdowns       │  - Coach history                        │
│  - Saved filters          │  - Sticky note cards                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        EXPORT FORMATS                                │
├─────────────────────────────────────────────────────────────────────┤
│  CSV        │  PDF          │  SVG          │  Clipboard            │
│  - 12 cols  │  - Summary    │  - Bar chart  │  - Plain text         │
│  - All data │  - 4 entries  │  - 640x360    │  - Journal/entry      │
│             │  - Context    │  - Context    │    summary            │
│             │    bars       │    breakdown  │                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SHARING                                 │
├─────────────────────────────────────────────────────────────────────┤
│  /share/:token endpoint exposes:                                    │
│  - Full entry data (question, cards, narrative, themes, reflections)│
│  - Computed stats                                                   │
│  - View count tracking                                              │
│  - Optional expiration                                              │
│  - Collaboration notes                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6.1 LocalStorage Schema

| Key | Purpose | TTL | Max Items |
|-----|---------|-----|-----------|
| `tarot_journal` | Unauthenticated entries | None | 100 |
| `tarot_journal_cache` | Entry cache (authenticated) | None | Unlimited |
| `tarot_journal_insights` | Cached stats | None | 1 |
| `tarot_coach_recommendation` | Coach suggestion | 24 hours | 1 |
| `tarot_coach_stats_snapshot` | Stats at coach generation | None | 1 |
| `tarot_journal_share_tokens` | Share token history | None | 50 |
| `journal_saved_filters_v1` | Saved filter presets | None | Unlimited |
| `tarot_coach_templates` | Coach configuration templates | None | 8 |
| `tarot_coach_history` | Question history from coach | None | 10 |

**Coach Recommendation Structure:**
```javascript
{
  question: string,
  spreadName: string,
  customFocus: string,
  source: string,        // 'theme:X', 'context:Y', 'card:Z'
  updatedAt: number      // timestamp
}
```

**Stats Snapshot Structure:**
```javascript
{
  stats: { /* computeJournalStats output */ },
  meta: {
    filtersActive: boolean,
    filterLabel: string | null,
    entryCount: number,
    totalEntries: number
  },
  updatedAt: number
}
```

**Coach Template Structure:**
```javascript
{
  id: string,
  label: string,
  topic: string,
  timeframe: string,
  depth: string,
  customFocus: string,
  useCreative: boolean,
  savedQuestion: string,
  updatedAt: number
}
```

**Coach History Item Structure:**
```javascript
{
  id: string,
  question: string,
  createdAt: number
}
```

---

### 6.2 Database Schema

The following D1 database tables store journal data for authenticated users:

#### journal_entries

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (UUID) |
| `user_id` | TEXT | Foreign key to users table |
| `spread_key` | TEXT | Spread identifier |
| `spread_name` | TEXT | Human-readable spread name |
| `question` | TEXT | User's question/intention |
| `cards_json` | TEXT | JSON array of card objects |
| `narrative` | TEXT | AI-generated reading text |
| `themes_json` | TEXT | JSON object of themes |
| `reflections_json` | TEXT | JSON object of user reflections |
| `context` | TEXT | Reading context (love, career, etc.) |
| `provider` | TEXT | AI provider used |
| `session_seed` | TEXT | Unique session identifier |
| `user_preferences_json` | TEXT | Snapshot of user preferences at reading time |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |

#### share_tokens

| Column | Type | Description |
|--------|------|-------------|
| `token` | TEXT | Primary key (share URL token) |
| `user_id` | TEXT | Owner of the share link |
| `scope` | TEXT | 'entry' or 'journal' |
| `title` | TEXT | User-defined or default title |
| `created_at` | INTEGER | Unix timestamp |
| `expires_at` | INTEGER | Unix timestamp (nullable) |
| `view_count` | INTEGER | Number of views |
| `meta_json` | TEXT | JSON metadata |

#### share_token_entries

| Column | Type | Description |
|--------|------|-------------|
| `token` | TEXT | Foreign key to share_tokens |
| `entry_id` | TEXT | Foreign key to journal_entries |
| `sort_index` | INTEGER | Display order |

#### share_notes

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (UUID) |
| `token` | TEXT | Foreign key to share_tokens |
| `author_name` | TEXT | Commenter's name |
| `body` | TEXT | Note content |
| `card_position` | TEXT | Optional card position reference |
| `created_at` | INTEGER | Unix timestamp |

#### card_appearances

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (UUID) |
| `user_id` | TEXT | Foreign key to users |
| `card_name` | TEXT | Canonical card name |
| `appeared_at` | INTEGER | Unix timestamp |
| `context` | TEXT | Reading context |

#### archetype_badges

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (UUID) |
| `user_id` | TEXT | Foreign key to users |
| `badge_type` | TEXT | Badge category (e.g., 'streak') |
| `badge_key` | TEXT | Unique badge identifier |
| `card_name` | TEXT | Associated card |
| `earned_at` | INTEGER | Unix timestamp |
| `metadata_json` | TEXT | Additional badge data |

#### user_analytics_prefs

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Primary key, foreign key to users |
| `archetype_journey_enabled` | INTEGER | Boolean (0/1) |
| `show_badges` | INTEGER | Boolean (0/1) |
| `updated_at` | INTEGER | Unix timestamp |

---

## 7. Reading Save Process

When a user saves a reading, `useSaveReading.js` constructs the entry:

### 7.1 Entry Structure Created by `useSaveReading()`

```javascript
{
  spread: string,                // Human-readable spread name
  spreadKey: string,             // Spread identifier
  question: string,              // User's question
  cards: [{
    position: string,            // Position label (e.g., "Past", "Present", "Future")
    name: string,                // Card name
    number: number | null,       // Major Arcana number (0-21)
    suit: string | null,         // Suit (Wands, Cups, Swords, Pentacles)
    rank: string | null,         // Rank (Ace, Two, ..., King)
    rankValue: number | null,    // Numeric rank (1-14)
    orientation: string          // "Upright" or "Reversed"
  }],
  personalReading: string,       // AI-generated narrative
  themes: object | null,         // Theme analysis
  reflections: object,           // User reflections per position
  context: string | null,        // Reading context
  provider: string,              // AI provider
  sessionSeed: string,           // Unique session ID
  deckId: string,                // Deck style identifier
  userPreferences: {             // Snapshot at save time
    readingTone: string,         // 'balanced', 'mystical', 'practical'
    spiritualFrame: string,      // 'mixed', 'secular', 'spiritual'
    tarotExperience: string,     // 'beginner', 'intermediate', 'advanced'
    preferredSpreadDepth: string,// 'quick', 'standard', 'deep'
    displayName?: string         // Optional user name
  } | null
}
```

### 7.2 Save Flow

1. **Validation**: Requires drawn cards and generated narrative
2. **Duplicate Check**: Prevents re-saving same session (via `sessionSeed`)
3. **Storage Routing**:
   - Authenticated: POST to `/api/journal`, cache to `tarot_journal_cache`
   - Unauthenticated: Save to `tarot_journal` localStorage (max 100 entries)
4. **Analytics Tracking**: For authenticated users, calls `/api/archetype-journey/track`
5. **Insights Update**: Calls `persistJournalInsights()` to update cached stats

---

## 8. Coach Storage System

The Coach Storage System (`src/lib/coachStorage.js`) manages saved templates and question history for the Guided Intention Coach.

### 8.1 Storage Keys

| Key | Purpose | Max Items |
|-----|---------|-----------|
| `tarot_coach_templates` | Saved coach configuration presets | 8 |
| `tarot_coach_history` | Recently used questions | 10 |

### 8.2 Template Operations

```javascript
// Load all templates
loadCoachTemplates() → Template[]

// Save or update a template (dedupes by label)
saveCoachTemplate(template) → { success, templates, template }

// Delete a template by ID
deleteCoachTemplate(templateId) → { success, templates }
```

### 8.3 History Operations

```javascript
// Load question history
loadCoachHistory(limit?) → HistoryItem[]

// Record a new question (dedupes, moves existing to top)
recordCoachQuestion(question, limit?) → { success, history }

// Delete a history item
deleteCoachHistoryItem(itemId) → { success, history }
```

### 8.4 Cross-Tab Synchronization

Changes dispatch a `coach-storage-sync` custom event for real-time updates across components:

```javascript
window.addEventListener('coach-storage-sync', (event) => {
  const { key } = event.detail;
  // Refresh relevant data
});
```

---

## 9. Summary: Complete Data Inventory

| Category | Data Points |
|----------|-------------|
| **Entry Core** | id, timestamp, spread, spreadKey, question, context, provider, sessionSeed, deckId, request_id |
| **Cards** | position, name, number, suit, rank, rankValue, orientation, image |
| **Themes** | suitFocus, elementalBalance, reversalDescription, timingProfile, archetypeDescription, dominantSuit, deckStyle |
| **Knowledge Graph** | graphKeys (triads, dyads, foolsJourneyStage, suitProgressions), retrievedPassages |
| **Vision Profile** | tone (descriptors), emotion (descriptors), symbolVerification, attention heatmap |
| **Reflections** | Per-position user notes |
| **Narrative** | Full AI-generated reading text |
| **User Preferences** | user_preferences_json snapshot (readingTone, spiritualFrame, tarotExperience, preferredSpreadDepth, displayName) |
| **Statistics** | totalReadings, totalCards, reversalRate, frequentCards, contextBreakdown, monthlyCadence, recentThemes |
| **Archetype Journey** | topCards, streaks, badges, thisMonth, avgPerWeek, totalReadings, lastAnalyzedAt |
| **Symbol Insights** | keywords, archetype, composition, symbols (object, position, meaning), colors (color, meaning) |
| **Preference Drift** | expectedContexts, actualTopContexts, driftContexts, hasDrift |
| **Share Links** | token, scope, title, createdAt, expiresAt, viewCount, entryCount, spreadKeys, contexts |
| **Share Notes** | id, token, author_name, body, card_position, created_at |
| **Coach Recommendation** | question, spreadName, customFocus, source, updatedAt |
| **Coach Templates** | id, label, topic, timeframe, depth, customFocus, useCreative, savedQuestion, updatedAt |
| **Coach History** | id, question, createdAt |
| **Saved Filters** | name, query, contexts[], spreads[], decks[], timeframe, onlyReversals |
| **Analytics Prefs** | archetype_journey_enabled, show_badges |

---

## 10. Computed but Not Surfaced in UI

The following data is computed server-side but not prominently displayed in journal components:

| Data | Source | Potential Use |
|------|--------|---------------|
| Complete triads | `themes.knowledgeGraph.graphKeys.completeTriadIds` | Highlight archetypal narratives |
| Fool's Journey stage | `graphKeys.foolsJourneyStageKey` | Show developmental context |
| High-significance dyads | `graphKeys.dyadPairs` | Surface card synergies |
| Elemental dignities | `spreadAnalysis.relationships[]` | Show card interactions |
| Celtic Cross cross-checks | `celticAnalysis.crossChecks` | Goal vs Outcome alignment |
| Vision tone/emotion | `visualProfile.tone`, `visualProfile.emotion` | Display mood descriptors |
| Symbol alignment | `symbolVerification.symbolAlignment[]` | Show attention focus |
| Passage relevance scores | `retrievedPassages[].relevanceScore` | Quality indicators |

---

*Generated: December 2024 · Updated: December 7, 2024 · Verified against codebase*
