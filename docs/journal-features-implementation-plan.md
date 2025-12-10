# Journal Features Implementation Plan

## Executive Summary

This document outlines the implementation plan for 6 new features to enhance the journal analytics, UI/UX, and export capabilities. Each feature leverages existing infrastructure while adding new visualization and data export capabilities.

---

## Table of Contents

1. [Card Relationships Visualization](#1-card-relationships-visualization)
2. [Pattern Alerts for Recurring Combinations](#2-pattern-alerts-for-recurring-combinations)
3. [Trend Analysis with Sparklines](#3-trend-analysis-with-sparklines)
4. [Card Gallery with Frequency Badges](#4-card-gallery-with-frequency-badges)
5. [Social Cards (OG Images)](#5-social-cards-og-images)
6. [Markdown Export](#6-markdown-export)
7. [Implementation Priority & Dependencies](#7-implementation-priority--dependencies)
8. [Database Schema Changes](#8-database-schema-changes)

---

## 1. Card Relationships Visualization

### Overview
Display detected dyads, triads, and elemental dignities as an interactive network visualization within journal entries and insights.

### Existing Infrastructure
- [`src/data/knowledgeGraphData.js`](../src/data/knowledgeGraphData.js) - Contains `ARCHETYPAL_TRIADS`, `ARCHETYPAL_DYADS`, `SUIT_PROGRESSIONS`
- [`functions/lib/graphContext.js`](../functions/lib/graphContext.js) - `buildGraphContext()` detects patterns
- [`src/contexts/ReadingContext.jsx`](../src/contexts/ReadingContext.jsx) - Already has `relationshipMeta` for pattern icons

### Implementation Plan

#### 1.1 New Component: `CardRelationshipGraph.jsx`
```
src/components/charts/CardRelationshipGraph.jsx (~250 lines)
```

**Visualization Options:**
- **Option A: Force-directed graph** (using D3-force or react-force-graph-2d)
  - Cards as nodes with images/icons
  - Relationships as edges with labels
  - Pros: Interactive, explorable
  - Cons: More complex, heavier bundle

- **Option B: Chord diagram** (using recharts or visx)
  - Show relationships between card positions
  - Pros: Compact, visually elegant
  - Cons: Less intuitive for non-technical users

- **Option C: Simple connection lines** (SVG-based)
  - Static visualization with labeled connections
  - Pros: Lightweight, fast, accessible
  - Cons: Less interactive

**Recommended:** Option C with progressive enhancement to Option A for desktop users

#### 1.2 Data Flow
```javascript
// Entry-level: Display within JournalEntryCard expanded view
entry.themes.knowledgeGraph.graphKeys → CardRelationshipGraph

// Props interface
{
  cards: Card[],                    // Cards in the reading
  graphKeys: {
    completeTriadIds: string[],     // Full triads detected
    dyadPairs: DyadPair[],          // Card pair synergies
    foolsJourneyStageKey: string,   // Developmental stage
    suitProgressions: Progression[] // Minor Arcana arcs
  },
  compact?: boolean,                // Collapsed vs expanded view
  interactive?: boolean             // Enable hover/click details
}
```

#### 1.3 UI Integration Points
1. **JournalEntryCard.jsx** - Add collapsible "Card Relationships" section after Key Themes
2. **JournalInsightsPanel.jsx** - Add aggregate relationship patterns across filtered entries
3. **Reading results page** - Show relationships in the narrative section

#### 1.4 Effort Estimate
- Option C (Simple): 2-3 days
- Option A (Force-directed): 5-7 days
- Testing & polish: 1-2 days

---

## 2. Pattern Alerts for Recurring Combinations

### Overview
Notify users when the same dyad/triad appears across multiple readings, surfacing meaningful patterns in their journey.

### Existing Infrastructure
- [`functions/api/archetype-journey.js`](../functions/api/archetype-journey.js) - Tracks card appearances
- `card_appearances` table - Monthly card counts per user
- [`shared/journal/stats.js`](../shared/journal/stats.js) - `computeJournalStats()` with `frequentCards`

### Implementation Plan

#### 2.1 Database Schema Addition
```sql
-- New table: pattern_occurrences
CREATE TABLE pattern_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,          -- 'triad', 'dyad', 'progression'
  pattern_id TEXT NOT NULL,            -- e.g., 'death-temperance-star'
  entry_id TEXT NOT NULL,              -- FK to journal_entries
  year_month TEXT NOT NULL,            -- YYYY-MM
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX idx_pattern_user_type ON pattern_occurrences(user_id, pattern_type, pattern_id);
```

#### 2.2 Server-side Pattern Tracking
Extend `/api/archetype-journey/track` to also record patterns:

```javascript
// functions/api/archetype-journey/track.js (extended)
export async function trackPatterns(userId, entry, themes, db) {
  const patterns = themes?.knowledgeGraph?.graphKeys;
  if (!patterns) return;
  
  const yearMonth = new Date().toISOString().slice(0, 7);
  
  // Track triads
  for (const triadId of patterns.completeTriadIds || []) {
    await db.prepare(`
      INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
      VALUES (?, 'triad', ?, ?, ?, ?)
    `).bind(userId, triadId, entry.id, yearMonth, Date.now()).run();
  }
  
  // Track high-significance dyads
  for (const dyad of patterns.dyadPairs?.filter(d => d.significance === 'high') || []) {
    const dyadId = dyad.cards.sort().join('-');
    await db.prepare(`...`).bind(...).run();
  }
}
```

#### 2.3 Pattern Alert Detection API
New endpoint: `GET /api/journal/pattern-alerts`

```javascript
// Returns patterns appearing 3+ times in last 90 days
{
  recurringPatterns: [
    {
      type: 'triad',
      patternId: 'death-temperance-star',
      count: 4,
      lastSeen: '2024-12-05',
      theme: 'Healing Arc',
      entries: ['entry-id-1', 'entry-id-2', ...]
    }
  ],
  newPatterns: [...], // First-time patterns from recent reading
  milestones: [...]   // e.g., "You've seen Death-Star dyad 10 times!"
}
```

#### 2.4 UI: Pattern Alert Banner
```
src/components/PatternAlertBanner.jsx (~120 lines)
```

Display in Journal.jsx above entry list when patterns detected:
```
┌─────────────────────────────────────────────────────────┐
│ 🔮 Recurring Pattern Detected                           │
│ The "Healing Arc" (Death → Temperance → Star) has       │
│ appeared 4 times in your recent readings.               │
│ [View Pattern History] [Dismiss]                        │
└─────────────────────────────────────────────────────────┘
```

#### 2.5 Effort Estimate
- Database migration: 0.5 days
- Backend tracking: 1-2 days
- Alert detection API: 1 day
- UI component: 1-2 days
- Testing: 1 day

**Total: 4.5-6.5 days**

---

## 3. Trend Analysis with Sparklines

### Overview
Expand the existing `TrendSparkline` component to show individual card frequency trends over 6 months in more contexts.

### Existing Infrastructure
- [`src/components/charts/TrendSparkline.jsx`](../src/components/charts/TrendSparkline.jsx) - Already implemented!
- [`src/components/charts/CadenceChart.jsx`](../src/components/charts/CadenceChart.jsx) - Monthly reading cadence
- `analytics.trends` from `/api/archetype-journey` - 6-month card appearance data

### Implementation Plan

#### 3.1 Extend TrendSparkline Usage
Currently used in `ArchetypeJourneySection.jsx` for top cards. Expand to:

1. **JournalInsightsPanel.jsx** - Add sparklines to "Frequent Cards" section
2. **CardSymbolInsights.jsx** - Show trend when viewing card details
3. **Card Gallery** (new) - Sparkline per card in grid view

#### 3.2 New: Context Trend Analysis
Track which contexts (love, career, self, etc.) are trending:

```javascript
// shared/journal/trends.js (extend)
export function computeContextTrends(entries, months = 6) {
  const now = new Date();
  const monthlyContexts = {};
  
  for (let i = 0; i < months; i++) {
    const monthKey = getMonthKey(now, -i);
    monthlyContexts[monthKey] = {};
  }
  
  entries.forEach(entry => {
    const monthKey = getMonthKey(new Date(entry.ts));
    if (monthlyContexts[monthKey] && entry.context) {
      monthlyContexts[monthKey][entry.context] = 
        (monthlyContexts[monthKey][entry.context] || 0) + 1;
    }
  });
  
  return Object.entries(monthlyContexts).map(([label, counts]) => ({
    label,
    ...counts
  }));
}
```

#### 3.3 UI Enhancement: Multi-line Sparkline
Show multiple contexts on one sparkline with different colors:

```jsx
// ContextTrendSparkline.jsx
<ResponsiveContainer width={200} height={40}>
  <LineChart data={contextTrends}>
    <Line dataKey="love" stroke="#ec4899" />
    <Line dataKey="career" stroke="#3b82f6" />
    <Line dataKey="self" stroke="#8b5cf6" />
  </LineChart>
</ResponsiveContainer>
```

#### 3.4 Effort Estimate
- Extend existing sparkline: 0.5 days
- Context trend computation: 0.5 days
- UI integration: 1-2 days

**Total: 2-3 days**

---

## 4. Card Gallery with Frequency Badges

### Overview
A visual grid of all 78 cards showing how often each has appeared, with filtering and exploration capabilities.

### Existing Infrastructure
- [`src/data/majorArcana.js`](../src/data/majorArcana.js) - 22 Major Arcana definitions
- [`src/data/minorArcana.js`](../src/data/minorArcana.js) - 56 Minor Arcana definitions
- `card_appearances` table - User's card frequency data
- Card images in `/public/decks/` organized by deck style

### Implementation Plan

#### 4.1 New Component: `CardGallery.jsx`
```
src/components/CardGallery.jsx (~400 lines)
```

**Features:**
- 78-card grid with card images
- Frequency badges (count overlay)
- Filter by suit, frequency, never-seen
- Sort by frequency, name, number
- Click to view card details + journal entries
- "Never drawn" section for exploration

#### 4.2 Data Requirements
```javascript
// API: GET /api/archetype-journey/card-frequency
{
  cards: [
    {
      cardNumber: 0,
      cardName: 'The Fool',
      totalCount: 12,
      lastSeen: '2024-12-01',
      firstSeen: '2024-06-15',
      trendData: [{ year_month: '2024-07', count: 2 }, ...],
      contexts: { love: 5, career: 3, self: 4 }
    },
    // ... all 78 cards
  ],
  neverSeen: ['Knight of Pentacles', 'Nine of Swords', ...],
  stats: {
    uniqueCardsSeen: 65,
    totalCards: 78,
    coveragePercent: 83.3
  }
}
```

#### 4.3 UI Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Card Gallery                    [Filter ▾] [Sort: Frequency] │
├──────────────────────────────────────────────────────────────┤
│ Coverage: 65/78 cards (83%)     ████████████░░ 13 to discover │
├──────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│ │ 🃏  │ │ 🃏  │ │ 🃏  │ │ 🃏  │ │ 🃏  │ │ 🃏  │             │
│ │Fool │ │Mag  │ │H.P. │ │Emp  │ │Empr │ │Hier │             │
│ │ 12× │ │ 8×  │ │ 7×  │ │ 6×  │ │ 5×  │ │ 5×  │             │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘             │
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│ Never Drawn (13)                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐                                     │
│ │ ?   │ │ ?   │ │ ?   │  Knight of Pentacles, 9 of Swords...│
│ └─────┘ └─────┘ └─────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

#### 4.4 Integration Points
- New route: `/journal/gallery` or tab within Journal page
- Link from JournalInsightsPanel "Frequent Cards" → Gallery filtered
- ArchetypeJourneySection "Top Cards" → Gallery with card highlighted

#### 4.5 Effort Estimate
- API endpoint: 1 day
- CardGallery component: 3-4 days
- Card detail modal: 1-2 days
- Filtering/sorting: 1 day
- Polish & responsive: 1 day

**Total: 7-9 days**

---

## 5. Social Cards (OG Images)

### Overview
Generate shareable images for readings with card visuals, spread layout, and key stats for social media preview (Open Graph).

### Existing Infrastructure
- [`functions/api/journal-export.js`](../functions/api/journal-export.js) - PDF export endpoint
- Share links: `/api/share/:token` - Already shares readings
- Card images available per deck style

### Implementation Plan

#### 5.1 Approach Options

**Option A: Server-side Canvas Generation**
- Use `@napi-rs/canvas` or `sharp` in Cloudflare Worker
- Generate PNG on-demand for share links
- Pros: Full control, consistent output
- Cons: Worker bundle size, compute cost

**Option B: Edge-rendered SVG → PNG**
- Build SVG template, use Cloudflare Image Resizing to convert
- Pros: Lighter, uses existing infra
- Cons: Limited styling options

**Option C: Client-side Generation + Upload**
- Generate in browser using html2canvas, upload to R2
- Pros: Rich styling, no server compute
- Cons: User must wait, requires storage

**Recommended:** Option B with fallback to Option A for complex layouts

#### 5.2 API Endpoint
```
GET /api/share/:token/og-image
→ Returns 1200x630 PNG (standard OG size)
```

#### 5.3 Image Template Structure
```
┌────────────────────────────────────────────────────────────┐
│  ★ MYSTIC TAROT                              Dec 8, 2024  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌──────┐  ┌──────┐  ┌──────┐                            │
│   │ 🃏   │  │ 🃏   │  │ 🃏   │    Three-Card Story       │
│   │      │  │      │  │      │    "What should I focus    │
│   │ The  │  │Death │  │ The  │     on this week?"        │
│   │ Fool │  │      │  │ Star │                            │
│   └──────┘  └──────┘  └──────┘    Theme: Healing Arc     │
│    Past      Present   Future                              │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  mystictarot.app/share/abc123                              │
└────────────────────────────────────────────────────────────┘
```

#### 5.4 Open Graph Meta Tags
Extend share page to include:
```html
<meta property="og:image" content="https://mystictarot.app/api/share/abc123/og-image" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="twitter:card" content="summary_large_image" />
```

#### 5.5 Implementation Files
```
functions/api/share/[token]/og-image.js    - Image generation endpoint
functions/lib/ogImageBuilder.js            - SVG template builder
src/components/SharePreview.jsx            - Client preview (optional)
```

#### 5.6 Effort Estimate
- SVG template design: 1-2 days
- Image generation endpoint: 2-3 days
- Meta tag integration: 0.5 days
- Testing across platforms: 1 day

**Total: 4.5-6.5 days**

---

## 6. Markdown Export

### Overview
Export journal entries in Markdown format for integration with note-taking apps (Obsidian, Notion, etc.).

### Existing Infrastructure
- [`src/lib/journalInsights.js`](../src/lib/journalInsights.js) - `buildJournalCsv()`, `exportJournalEntriesToCsv()`
- Entry structure well-defined with cards, themes, reflections, narrative

### Implementation Plan

#### 6.1 Markdown Builder Function
```javascript
// src/lib/journalInsights.js (extend)

export function buildJournalMarkdown(entries, options = {}) {
  const { 
    includeNarrative = true,
    includeReflections = true,
    includeThemes = true,
    frontmatter = true  // YAML frontmatter for Obsidian
  } = options;
  
  return entries.map(entry => buildEntryMarkdown(entry, options)).join('\n\n---\n\n');
}

function buildEntryMarkdown(entry, options) {
  const lines = [];
  
  // YAML Frontmatter (for Obsidian/Logseq)
  if (options.frontmatter) {
    lines.push('---');
    lines.push(`date: ${new Date(entry.ts).toISOString().split('T')[0]}`);
    lines.push(`spread: ${entry.spread}`);
    lines.push(`context: ${entry.context || 'general'}`);
    lines.push(`cards: [${entry.cards.map(c => `"${c.name}"`).join(', ')}]`);
    lines.push('tags: [tarot, reading]');
    lines.push('---');
    lines.push('');
  }
  
  // Title
  lines.push(`# ${entry.spread} - ${formatDate(entry.ts)}`);
  lines.push('');
  
  // Question
  if (entry.question) {
    lines.push(`> **Question:** ${entry.question}`);
    lines.push('');
  }
  
  // Cards
  lines.push('## Cards Drawn');
  lines.push('');
  entry.cards.forEach(card => {
    const orientation = card.orientation === 'Reversed' ? ' ↺' : '';
    lines.push(`- **${card.position}:** ${card.name}${orientation}`);
  });
  lines.push('');
  
  // Themes
  if (options.includeThemes && entry.themes) {
    lines.push('## Key Themes');
    lines.push('');
    if (entry.themes.suitFocus) lines.push(`- ${entry.themes.suitFocus}`);
    if (entry.themes.elementalBalance) lines.push(`- ${entry.themes.elementalBalance}`);
    if (entry.themes.archetypeDescription) lines.push(`- ${entry.themes.archetypeDescription}`);
    lines.push('');
  }
  
  // Narrative
  if (options.includeNarrative && entry.personalReading) {
    lines.push('## Reading');
    lines.push('');
    lines.push(entry.personalReading);
    lines.push('');
  }
  
  // Reflections
  if (options.includeReflections && entry.reflections) {
    const reflectionEntries = Object.entries(entry.reflections).filter(([_, v]) => v);
    if (reflectionEntries.length > 0) {
      lines.push('## My Reflections');
      lines.push('');
      reflectionEntries.forEach(([position, text]) => {
        lines.push(`**${position}:** ${text}`);
        lines.push('');
      });
    }
  }
  
  return lines.join('\n');
}
```

#### 6.2 Export Options UI
Add to JournalFilters.jsx export menu:
```
Export ▾
├── CSV (spreadsheet)
├── PDF (printable)
├── Markdown (notes)     ← NEW
│   ├── Single file (all entries)
│   ├── Individual files (ZIP)
│   └── Copy to clipboard
└── Share link
```

#### 6.3 Markdown Export Variations

**A. Single File Export**
- All filtered entries in one `.md` file
- Separated by `---` horizontal rules
- Good for: Single notebook page

**B. ZIP of Individual Files**
- Each entry as separate `YYYY-MM-DD-spread-name.md`
- Ideal for Obsidian vault import
- Requires JSZip library

**C. Clipboard Copy**
- Single entry markdown to clipboard
- For pasting into any notes app

#### 6.4 Implementation Files
```
src/lib/journalInsights.js           - buildJournalMarkdown(), buildEntryMarkdown()
src/lib/markdownExport.js            - exportJournalToMarkdown(), exportEntriesToZip()
src/components/ExportMenu.jsx        - Add Markdown options (or extend existing)
```

#### 6.5 Effort Estimate
- Markdown builder: 1 day
- Export UI options: 0.5 days
- ZIP multi-file export: 1 day
- Testing with Obsidian/Notion: 0.5 days

**Total: 3 days**

---

## 7. Implementation Priority & Dependencies

### Recommended Order

| Priority | Feature | Effort | Dependencies | Value |
|----------|---------|--------|--------------|-------|
| 1 | **Markdown Export** | 3 days | None | High - Low effort, immediate utility |
| 2 | **Trend Sparklines** | 2-3 days | Existing TrendSparkline | High - Extends working code |
| 3 | **Card Gallery** | 7-9 days | card_appearances data | High - Major new feature |
| 4 | **Pattern Alerts** | 5-7 days | DB migration | Medium - Complex, powerful |
| 5 | **Card Relationships** | 2-7 days | knowledgeGraphData | Medium - Visual complexity |
| 6 | **Social Cards** | 5-7 days | Share system | Medium - Marketing value |

### Dependency Graph
```
                    ┌─────────────────┐
                    │ Markdown Export │  (standalone)
                    └─────────────────┘
                    
     ┌──────────────────┐         ┌────────────────────┐
     │ Trend Sparklines │         │ Card Gallery       │
     └────────┬─────────┘         └──────────┬─────────┘
              │                              │
              │ uses existing                │ requires
              ▼                              ▼
     ┌──────────────────┐         ┌────────────────────┐
     │ TrendSparkline   │         │ card_appearances   │
     │ (already built)  │         │ API extension      │
     └──────────────────┘         └────────────────────┘
     
     ┌──────────────────┐         ┌────────────────────┐
     │ Pattern Alerts   │────────▶│ DB: pattern_       │
     │                  │         │ occurrences table  │
     └──────────────────┘         └────────────────────┘
     
     ┌──────────────────┐         ┌────────────────────┐
     │ Card Relations   │────────▶│ knowledgeGraphData │
     │ Visualization    │         │ graphRAG system    │
     └──────────────────┘         └────────────────────┘
     
     ┌──────────────────┐         ┌────────────────────┐
     │ Social Cards     │────────▶│ Share system       │
     │ (OG Images)      │         │ Card images        │
     └──────────────────┘         └────────────────────┘
```

---

## 8. Database Schema Changes

### New Tables Required

```sql
-- Migration: 0009_add_pattern_tracking.sql

-- Track pattern occurrences across readings
CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,           -- 'triad', 'dyad', 'progression', 'journey-stage'
  pattern_id TEXT NOT NULL,             -- e.g., 'death-temperance-star'
  entry_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pattern_user_type 
  ON pattern_occurrences(user_id, pattern_type, pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_year_month 
  ON pattern_occurrences(user_id, year_month);

-- Track generated OG images for caching
CREATE TABLE IF NOT EXISTS og_images (
  token TEXT PRIMARY KEY,               -- share token
  image_url TEXT NOT NULL,              -- R2/CDN URL
  generated_at INTEGER NOT NULL,
  expires_at INTEGER                    -- optional expiry
);
```

### API Endpoint Summary

| Endpoint | Method | Feature | Description |
|----------|--------|---------|-------------|
| `/api/journal/pattern-alerts` | GET | Pattern Alerts | Recurring patterns for user |
| `/api/archetype-journey/card-frequency` | GET | Card Gallery | All cards with frequency data |
| `/api/share/:token/og-image` | GET | Social Cards | Generate/return OG image |

---

## Summary

| Feature | Complexity | Effort | New Files | DB Changes |
|---------|------------|--------|-----------|------------|
| Markdown Export | Low | 3 days | 1 | None |
| Trend Sparklines | Low | 2-3 days | 0 (extend) | None |
| Card Gallery | Medium | 7-9 days | 2-3 | None |
| Pattern Alerts | High | 5-7 days | 2-3 | 1 table |
| Card Relationships | Medium-High | 2-7 days | 1-2 | None |
| Social Cards | High | 5-7 days | 2-3 | 1 table |

**Total Estimated Effort: 24-36 days**

---

---

## 9. UX Impact Assessment

### Current UI Complexity

The [`JournalInsightsPanel.jsx`](../src/components/JournalInsightsPanel.jsx:126) already displays **10 distinct sections**:

1. Header stats (filtered count, reversal rate)
2. Toolbar (5 action buttons)
3. Share composer (collapsible form with 6 fields)
4. Reading Rhythm chart (6-month cadence)
5. Frequent Cards list (top 5)
6. Context Mix + Context Timeline Ribbon
7. Recent Themes
8. Story of This Season (prose summary)
9. Emerging Interests (preference drift)
10. Coach Suggestion

**Risk Assessment:** Adding more features without careful design could increase cognitive load and clutter.

### Feature-by-Feature UX Analysis

| Feature | Delight | Cognitive Load | Recommendation |
|---------|---------|----------------|----------------|
| **Markdown Export** | ⭐⭐⭐⭐ High | ⬇️ Low | ✅ **Implement** - Hidden in export menu, surfaces only on demand |
| **Trend Sparklines** | ⭐⭐⭐ Medium | ⬆️ Medium | ⚠️ **Careful** - Already have CadenceChart; redundant visual noise |
| **Card Gallery** | ⭐⭐⭐⭐⭐ Very High | ⬆️ Medium | ✅ **Implement as separate page** - Major feature, deserves its own space |
| **Pattern Alerts** | ⭐⭐⭐⭐ High | ⬆️⬆️ High | ⚠️ **Progressive disclosure** - Alert banner only, details on click |
| **Card Relationships** | ⭐⭐ Low | ⬆️⬆️⬆️ Very High | ❌ **Reconsider** - Complex visualization, limited user value |
| **Social Cards** | ⭐⭐⭐⭐ High | ⬇️ Low | ✅ **Implement** - Invisible to user, enhances sharing |

### Detailed UX Recommendations

#### ✅ Markdown Export - **Proceed**
- **Delight Factor:** High for power users (Obsidian, Notion, PKM enthusiasts)
- **Cognitive Load:** Zero - hidden in existing export dropdown
- **Implementation:** Add to existing toolbar dropdown alongside CSV/PDF
- **UI Change:** Single menu item, no new visual elements

```jsx
// Add to existing export options in toolbar
<MenuItem onClick={handleMarkdownExport}>
  <FileCode className="h-4 w-4" /> Export Markdown
</MenuItem>
```

#### ⚠️ Trend Sparklines - **Reconsider Scope**
- **Delight Factor:** Medium - small visual enhancement
- **Cognitive Load:** Medium - adds 5 tiny charts to Frequent Cards section
- **Problem:** We already have `CadenceChart` (line 858) and `ContextTimelineRibbon` (line 909)
- **Risk:** Visual clutter, diminishing returns on more micro-charts

**Alternative:** Instead of sparklines on every card, show **one "card journey" view** when user clicks a specific card → leads into Card Gallery feature.

#### ✅ Card Gallery - **Proceed as Separate Page**
- **Delight Factor:** Very High - gamification, discovery, collection feeling
- **Cognitive Load:** Medium but **isolated** - own page, not in insights panel
- **Implementation:** New route `/journal/gallery`, link from insights panel

**Why it works:**
- Plays into "collecting" psychology (like Pokémon, achievements)
- "Never drawn" section creates curiosity/anticipation
- Progress indicator (65/78 = 83%) gives accomplishment
- **Not crammed into existing dense panel**

```jsx
// Light touch in JournalInsightsPanel - just a link
<div className="...">
  <h3>Card Collection</h3>
  <p>You've drawn 65 of 78 cards</p>
  <Link to="/journal/gallery">
    Explore your card gallery →
  </Link>
</div>
```

#### ⚠️ Pattern Alerts - **Implement with Progressive Disclosure**
- **Delight Factor:** High - "the cards are speaking to you" mystical feeling
- **Cognitive Load:** Very High if shown inline; Low if banner-only
- **Problem:** Complex concept (triads, dyads) may confuse casual users

**Recommended UX Pattern:**

```
┌──────────────────────────────────────────────────┐
│ 🔮 A pattern is emerging...                [→]  │
│ The Healing Arc has appeared 4 times recently   │
└──────────────────────────────────────────────────┘
```

- **Banner only** in insights panel (1 line, dismissible)
- Full detail on click → modal or dedicated view
- Use mystical language, not technical ("Healing Arc" not "death-temperance-star triad")
- Limit to 1 pattern alert at a time

#### ❌ Card Relationships Visualization - **Deprioritize**
- **Delight Factor:** Low for most users
- **Cognitive Load:** Very High - network graphs are hard to parse
- **Problem:**
  - Most users don't understand triads/dyads/elemental dignities
  - Force-directed graphs require interaction literacy
  - Adds complexity without proportional value
  
**Alternative:** The Pattern Alerts feature already surfaces the **meaningful** relationships with human-readable language. The raw visualization adds little.

**If implemented:** Keep it **opt-in** under an "Advanced" toggle, never default-visible.

#### ✅ Social Cards (OG Images) - **Proceed**
- **Delight Factor:** High when sharing on social media
- **Cognitive Load:** Zero - completely invisible to user
- **Implementation:** Backend-only, auto-generates when share link is viewed

**Why it works:**
- No UI changes needed
- Enhances existing share feature silently
- "Surprise and delight" when user shares and sees rich preview

### Revised Priority Order

| Priority | Feature | Effort | UX Impact | Notes |
|----------|---------|--------|-----------|-------|
| 1 | **Markdown Export** | 3 days | High delight, no clutter | Add to existing menu |
| 2 | **Social Cards** | 5 days | Silent enhancement | Improves sharing experience |
| 3 | **Card Gallery** | 8 days | Flagship feature | Separate page, collection gamification |
| 4 | **Pattern Alerts** | 6 days | High delight if constrained | Banner + modal pattern only |
| 5 | **Trend Sparklines** | 2 days | Low priority | Only if Card Gallery needs it |
| 6 | **Card Relationships** | 7 days | Skip or opt-in only | Too complex for most users |

### Design Principles to Follow

1. **Progressive Disclosure**: Show summary first, details on interaction
2. **Separate Pages for Complex Features**: Don't cram into InsightsPanel
3. **Invisible Enhancements**: Social Cards improve sharing without UI changes
4. **Use Mystical Language**: "Healing Arc" not "death-temperance-star triad"
5. **One Alert at a Time**: Don't overwhelm with multiple pattern notifications
6. **Gamification Over Information**: Card Gallery "collection" > raw statistics

---

## 10. Backend Impact Analysis

### Existing Backend Modules to Reuse

| Module | Location | Features That Can Reuse It |
|--------|----------|---------------------------|
| [`archetype-journey.js`](../functions/api/archetype-journey.js) | `/api/archetype-journey` | Card Gallery, Trend Sparklines, Pattern Alerts |
| [`share.js`](../functions/api/share.js) | `/api/share` | Social Cards (OG Images) |
| [`shareUtils.js`](../functions/lib/shareUtils.js) | Server lib | Social Cards, all sharing features |
| [`graphContext.js`](../functions/lib/graphContext.js) | Server lib | Card Relationships, Pattern Alerts |
| [`graphRAG.js`](../functions/lib/graphRAG.js) | Server lib | Card Relationships, Pattern Alerts |
| [`journalInsights.js`](../src/lib/journalInsights.js) | Client lib | Markdown Export (extend existing) |
| [`stats.js`](../shared/journal/stats.js) | Shared | All features (computeJournalStats) |
| [`trends.js`](../shared/journal/trends.js) | Shared | Trend Sparklines, Card Gallery |

### Backend Changes Per Feature

#### 1. Markdown Export
**Backend Impact: None (client-side only)**

Extends existing [`journalInsights.js`](../src/lib/journalInsights.js:122) pattern:
- Reuse `buildJournalCsv()` structure → create `buildJournalMarkdown()`
- Reuse `exportJournalEntriesToCsv()` → create `exportJournalEntriesToMarkdown()`
- No API changes needed

```javascript
// src/lib/journalInsights.js (extend)
export function buildJournalMarkdown(entries, options) { /* ... */ }
export function exportJournalEntriesToMarkdown(entries, filename) { /* ... */ }
```

---

#### 2. Trend Sparklines
**Backend Impact: Minimal (data already exists)**

Existing data source: [`archetype-journey.js:156-162`](../functions/api/archetype-journey.js:156)
```javascript
// Already returns 6-month trend data
const trendsQuery = await db.prepare(`
  SELECT card_name, card_number, year_month, count
  FROM card_appearances
  WHERE user_id = ? AND year_month >= ?
  ORDER BY year_month DESC, count DESC
`).bind(userId, startMonth).all();
```

**Frontend changes only:**
- Extend [`TrendSparkline.jsx`](../src/components/charts/TrendSparkline.jsx) usage
- Add to JournalInsightsPanel "Frequent Cards" section
- Create `computeContextTrends()` in [`shared/journal/trends.js`](../shared/journal/trends.js)

---

#### 3. Card Gallery
**Backend Impact: New API endpoint**

**Reuse:** [`archetype-journey.js:handleGetAnalytics()`](../functions/api/archetype-journey.js:104) already returns:
- `topCards` - top 5 cards this month
- `allCards` - all cards for current month
- `trends` - 6-month history per card
- `majorArcanaFrequency` - Major Arcana distribution

**New endpoint needed:** `GET /api/archetype-journey/card-frequency`

```javascript
// functions/api/archetype-journey/card-frequency.js (NEW)

export async function onRequestGet(context) {
  const { env, request } = context;
  const user = await getUserFromRequest(request, env);
  
  // Aggregate ALL card appearances (not just current month)
  const allTimeQuery = await env.DB.prepare(`
    SELECT card_name, card_number,
           SUM(count) as total_count,
           MAX(last_seen) as last_seen,
           MIN(first_seen) as first_seen
    FROM card_appearances
    WHERE user_id = ?
    GROUP BY card_name
    ORDER BY total_count DESC
  `).bind(user.id).all();
  
  // Get context breakdown per card
  const contextQuery = await env.DB.prepare(`
    SELECT je.cards_json, je.context
    FROM journal_entries je
    WHERE je.user_id = ?
  `).bind(user.id).all();
  
  // Process and return...
}
```

**Files to create:**
- `functions/api/archetype-journey/card-frequency.js` (~100 lines)

**Files to modify:**
- None (new endpoint in existing API namespace)

---

#### 4. Pattern Alerts
**Backend Impact: Database migration + new API endpoint + tracking extension**

**Reuse:**
- [`graphContext.js:buildGraphContext()`](../functions/lib/graphContext.js) - Already detects triads/dyads
- [`archetype-journey.js:handleTrackCards()`](../functions/api/archetype-journey.js:194) - Tracking pattern

**New database table:** `pattern_occurrences`
```sql
-- migrations/0009_add_pattern_tracking.sql
CREATE TABLE pattern_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);
```

**Extend existing tracking:**
```javascript
// functions/api/archetype-journey.js - extend handleTrackCards()
async function handleTrackCards(db, userId, body, corsHeaders) {
  // ... existing card tracking ...
  
  // NEW: Track patterns from themes
  if (body.themes?.knowledgeGraph?.graphKeys) {
    await trackPatterns(db, userId, body.entryId, body.themes.knowledgeGraph.graphKeys);
  }
}

async function trackPatterns(db, userId, entryId, graphKeys) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const now = Math.floor(Date.now() / 1000);
  
  // Track complete triads
  for (const triadId of graphKeys.completeTriadIds || []) {
    await db.prepare(`
      INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
      VALUES (?, 'triad', ?, ?, ?, ?)
    `).bind(userId, triadId, entryId, yearMonth, now).run();
  }
  
  // Track high-significance dyads
  for (const dyad of graphKeys.dyadPairs?.filter(d => d.significance === 'high') || []) {
    const dyadId = dyad.cards.sort().join('-');
    await db.prepare(`...`).bind(...).run();
  }
}
```

**New API endpoint:** `GET /api/journal/pattern-alerts`
```javascript
// functions/api/journal/pattern-alerts.js (NEW)

export async function onRequestGet(context) {
  const { env, request } = context;
  const user = await getUserFromRequest(request, env);
  
  // Find patterns appearing 3+ times in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startMonth = ninetyDaysAgo.toISOString().slice(0, 7);
  
  const recurring = await env.DB.prepare(`
    SELECT pattern_type, pattern_id, COUNT(*) as occurrence_count,
           MAX(created_at) as last_seen
    FROM pattern_occurrences
    WHERE user_id = ? AND year_month >= ?
    GROUP BY pattern_type, pattern_id
    HAVING COUNT(*) >= 3
    ORDER BY occurrence_count DESC
  `).bind(user.id, startMonth).all();
  
  // Hydrate with pattern metadata from knowledgeGraphData
  // ...
}
```

**Files to create:**
- `migrations/0009_add_pattern_tracking.sql` (~20 lines)
- `functions/api/journal/pattern-alerts.js` (~80 lines)
- `functions/lib/patternTracking.js` (~60 lines)

**Files to modify:**
- `functions/api/archetype-journey.js` (+30 lines to `handleTrackCards`)

---

#### 5. Card Relationships Visualization
**Backend Impact: None (data already computed)**

**Reuse:**
- [`graphContext.js:buildGraphContext()`](../functions/lib/graphContext.js) - Returns `graphKeys`
- Entry's `themes.knowledgeGraph` - Already stored per reading

Data is already computed and stored in `journal_entries.themes_json`:
```javascript
entry.themes.knowledgeGraph = {
  graphKeys: {
    completeTriadIds: ['death-temperance-star'],
    dyadPairs: [{ cards: [13, 17], significance: 'high' }],
    foolsJourneyStageKey: 'integration',
    suitProgressions: [...]
  },
  retrievedPassages: [...]
}
```

**Frontend only changes:**
- Create `CardRelationshipGraph.jsx` component
- Add to `JournalEntryCard.jsx` expanded view

---

#### 6. Social Cards (OG Images)
**Backend Impact: New API endpoint + optional storage**

**Reuse:**
- [`share.js`](../functions/api/share.js) - Share token system
- [`shareUtils.js:hydrateJournalEntry()`](../functions/lib/shareUtils.js:3) - Entry data
- [`shareData.js:loadShareEntries()`](../functions/lib/shareData.js) - Load shared entries

**New API endpoint:** `GET /api/share/:token/og-image`
```javascript
// functions/api/share/[token]/og-image.js (NEW)

import { loadShareRecord, loadShareEntries } from '../../../lib/shareData.js';
import { buildOgImageSvg } from '../../../lib/ogImageBuilder.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;
  
  // Load share data (reuse existing)
  const shareRecord = await loadShareRecord(env.DB, token);
  if (!shareRecord) {
    return new Response('Not found', { status: 404 });
  }
  
  const entries = await loadShareEntries(env.DB, token);
  
  // Build SVG template
  const svg = buildOgImageSvg(entries, shareRecord);
  
  // Option A: Return SVG directly (Cloudflare Image Resizing converts to PNG)
  // Option B: Use @resvg/resvg-wasm to convert to PNG
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
```

**New server library:** `functions/lib/ogImageBuilder.js`
```javascript
// functions/lib/ogImageBuilder.js (NEW)

export function buildOgImageSvg(entries, shareRecord) {
  const entry = entries[0];
  const cards = entry?.cards || [];
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0b0c1d"/>
  
  <!-- Header -->
  <text x="40" y="50" fill="#fcd34d" font-size="24">★ MYSTIC TAROT</text>
  <text x="1160" y="50" fill="#a3a3a3" font-size="18" text-anchor="end">${formatDate(entry.ts)}</text>
  
  <!-- Cards visualization -->
  ${cards.slice(0, 3).map((card, i) => `
    <rect x="${200 + i * 250}" y="120" width="180" height="280" rx="8" fill="#1a1b2e" stroke="#fcd34d" stroke-width="2"/>
    <text x="${290 + i * 250}" y="340" fill="#fff" font-size="16" text-anchor="middle">${card.name}</text>
    <text x="${290 + i * 250}" y="370" fill="#a3a3a3" font-size="12" text-anchor="middle">${card.position}</text>
  `).join('')}
  
  <!-- Spread name -->
  <text x="860" y="180" fill="#fff" font-size="28">${entry.spread}</text>
  
  <!-- Question preview -->
  <text x="860" y="220" fill="#a3a3a3" font-size="14">${truncate(entry.question, 40)}</text>
  
  <!-- Footer -->
  <text x="40" y="600" fill="#666" font-size="14">mystictarot.app/share/${shareRecord.token}</text>
</svg>`;
}
```

**Files to create:**
- `functions/api/share/[token]/og-image.js` (~50 lines)
- `functions/lib/ogImageBuilder.js` (~100 lines)

**Files to modify:**
- Share page HTML to include OG meta tags

---

### Summary: Backend File Changes

| Feature | New Files | Modified Files | DB Migration |
|---------|-----------|----------------|--------------|
| Markdown Export | 0 | `src/lib/journalInsights.js` (+60 lines) | None |
| Trend Sparklines | 0 | `shared/journal/trends.js` (+40 lines) | None |
| Card Gallery | `functions/api/archetype-journey/card-frequency.js` | None | None |
| Pattern Alerts | `functions/api/journal/pattern-alerts.js`, `functions/lib/patternTracking.js` | `functions/api/archetype-journey.js` (+30 lines) | `0009_add_pattern_tracking.sql` |
| Card Relationships | 0 (frontend only) | None | None |
| Social Cards | `functions/api/share/[token]/og-image.js`, `functions/lib/ogImageBuilder.js` | None | None |

### API Endpoint Summary

| Endpoint | Method | Feature | Status |
|----------|--------|---------|--------|
| `/api/archetype-journey` | GET | Card Gallery, Trends | **Existing** - reuse |
| `/api/archetype-journey/track` | POST | Pattern Alerts | **Extend** - add pattern tracking |
| `/api/archetype-journey/card-frequency` | GET | Card Gallery | **New** |
| `/api/journal/pattern-alerts` | GET | Pattern Alerts | **New** |
| `/api/share/:token` | GET | Social Cards | **Existing** - reuse |
| `/api/share/:token/og-image` | GET | Social Cards | **New** |

---

*Created: December 8, 2024*