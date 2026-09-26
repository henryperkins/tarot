# Tarot Astro Plugins - Optional Claude Code Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Claude Code (optional tool host)               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /astro-      │  │ /symbol-     │  │ User request  │          │
│  │  reading     │  │  analysis    │  │ in Claude    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────┬───────┴──────────────────┘                  │
│                    │                                              │
│         ┌──────────▼──────────────────────┐                     │
│         │   MCP Protocol Layer             │                     │
│         └──────────┬──────────────────────┘                     │
└────────────────────┼────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐    ┌────────▼─────────┐
│ Ephemeris Server │    │ Symbolism Server │
│  (MCP Server)    │    │  (MCP Server)    │
├──────────────────┤    ├──────────────────┤
│                  │    │                  │
│ • Planetary      │    │ • Symbol Search  │
│   Positions      │    │ • Category       │
│ • Moon Phases    │    │   Browser        │
│ • Aspects        │    │ • Multi-symbol   │
│ • Retrogrades    │    │   Synthesis      │
│ • Daily Weather  │    │ • Color/Number   │
│                  │    │   Analysis       │
├──────────────────┤    ├──────────────────┤
│ sweph bindings   │    │ symbols.json     │
│ + ephemeris data │    │ (Database)       │
└──────────────────┘    └──────────────────┘
```

These plugins are optional Claude Code tools. They are not imported by the Tableu Worker, browser bundle, or reading pipeline, and an installed plugin does not automatically modify an application reading. A tool is used only after Claude Code receives a user request and invokes the corresponding MCP server.

## Plugin Structure

```
tarot-astro-plugins/
│
├── .claude-plugin/
│   └── marketplace.json           ← Marketplace definition
│
├── ephemeris-server/              ← Plugin 1: Astronomical Data
│   ├── .claude-plugin/
│   │   └── plugin.json           ← Plugin manifest
│   ├── .mcp.json                 ← MCP server config
│   ├── commands/
│   │   └── astro-reading.md      ← Custom slash command
│   ├── server/
│   │   ├── index.js              ← MCP server (stdio)
│   │   └── ephemeris.js          ← Astronomical calculations
│   ├── package.json
│   └── README.md
│
├── symbolism-server/              ← Plugin 2: Symbol Database
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── .mcp.json
│   ├── commands/
│   │   └── symbol-analysis.md
│   ├── server/
│   │   ├── index.js              ← MCP server (stdio)
│   │   └── database.js           ← Symbol search engine
│   ├── data/
│   │   └── symbols.json          ← Comprehensive symbol DB
│   ├── package.json
│   └── README.md
│
├── README.md                      ← Main documentation
├── INSTALL.md                     ← Installation guide
└── ARCHITECTURE.md                ← This file
```

## Data Flow: User-Requested Astrological Reading

The following flow begins when a user invokes the command in Claude Code. It is not a hook in the Tableu application.

```
User Request
     │
     ▼
┌─────────────────────────┐
│ /astro-reading command  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude receives command prompt:          │
│ "Get astrological context for reading"   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude invokes MCP tools:                │
│ • get_current_positions()                │
│ • get_daily_astrological_weather()       │
│ • get_moon_phase()                       │
│ • get_planetary_aspects()                │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Ephemeris Server calculates:             │
│ 1. Query Swiss Ephemeris via sweph       │
│ 2. Compute ecliptic positions            │
│ 3. Detect aspects between planets        │
│ 4. Identify retrograde motion            │
│ 5. Generate interpretations              │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Return JSON data to Claude:               │
│ {                                         │
│   "moon": { phase, sign, illumination }  │
│   "aspects": [ Sun-Mars square, ... ]    │
│   "retrogrades": [ Mercury, ... ]        │
│   "theme": "Growth through challenge"    │
│ }                                         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude synthesizes and presents:          │
│                                           │
│ 🌙 Astrological Context                  │
│ Moon Phase: Waxing Gibbous in Pisces     │
│ [formatted, human-readable output]       │
└───────────────────────────────────────────┘
```

## Data Flow: User-Requested Symbol Analysis

This flow is an optional Claude Code tool call; the application does not invoke it automatically.

```
User Request: "/symbol-analysis The Fool"
     │
     ▼
┌─────────────────────────────────────────┐
│ Claude receives command with card name   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude identifies symbols in The Fool:   │
│ • Dog, cliff, sun, white rose, etc.      │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude invokes MCP tools:                │
│ • interpret_card_symbols(                │
│     "The Fool",                          │
│     ["dog", "sun", "rose", "white"]      │
│   )                                      │
│ • get_color_meanings(["white"])         │
│ • get_numerological_insight("0")        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Symbolism Server processes:              │
│ 1. Search symbols.json for each symbol  │
│ 2. Extract meanings (general, tarot,    │
│    archetypal, cultural)                 │
│ 3. Identify shared themes/keywords      │
│ 4. Generate symbolic synthesis          │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Return structured symbol data:           │
│ {                                        │
│   "symbols": [                           │
│     {                                    │
│       "name": "dog",                     │
│       "keywords": ["loyalty", ...],     │
│       "meanings": { ... }                │
│     }                                    │
│   ],                                     │
│   "synthesis": {                         │
│     "dominantThemes": [...],            │
│     "interpretation": "..."             │
│   }                                      │
│ }                                        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Claude presents layered analysis:        │
│                                          │
│ 🔮 Symbolic Analysis: The Fool          │
│                                          │
│ **Primary Symbols:**                    │
│ Dog - Loyalty, instinct, guidance...    │
│ [formatted, comprehensive output]       │
└──────────────────────────────────────────┘
```

## MCP Tool Catalog

### Ephemeris Server Tools (6 total)

| Tool | Input | Output |
|------|-------|--------|
| `get_current_positions` | none | All planetary positions |
| `get_moon_phase` | date? | Moon phase, sign, illumination |
| `get_planetary_aspects` | date?, orb? | Array of aspects |
| `get_retrograde_planets` | date? | Array of retrograde planets |
| `get_ephemeris_for_reading` | timestamp | Complete snapshot |
| `get_daily_astrological_weather` | date? | Daily overview + theme |

### Symbolism Server Tools (7 total)

| Tool | Input | Output |
|------|-------|--------|
| `search_symbols` | query, category?, limit? | Matching symbols |
| `get_symbol` | category, name | Single symbol details |
| `get_category` | category | All symbols in category |
| `get_related_symbols` | theme, limit? | Related symbols |
| `interpret_card_symbols` | cardName, symbols[] | Multi-symbol synthesis |
| `get_color_meanings` | colors[] | Color symbolism |
| `get_numerological_insight` | number | Number meanings |

## Symbol Database Schema

```json
{
  "category": {
    "symbol-name": {
      "keywords": ["keyword1", "keyword2"],
      "meanings": {
        "general": "Universal meaning",
        "tarot": "Tarot-specific meaning",
        "spiritual": "Esoteric meaning",
        "psychological": "Psychological interpretation"
      },
      "associations": ["related", "concepts"],
      "cultural_context": "Historical/cultural background"
    }
  }
}
```

**Categories:**
- `animals` (12 symbols): dog, wolf, lion, serpent, eagle, etc.
- `colors` (9 symbols): red, blue, yellow, green, purple, white, black, gold, silver
- `numbers` (11 symbols): 0-10, each with tarot + archetypal meanings
- `elements` (5 symbols): fire, water, air, earth, spirit
- `plants` (10 symbols): rose, lily, pomegranate, wheat, lotus, etc.
- `celestial` (4 symbols): sun, moon, stars, lightning

**Total:** 51 curated symbols with rich, multi-layered meanings

## Technical Stack

### Ephemeris Server
- **Runtime**: Node.js
- **Framework**: MCP SDK (`@modelcontextprotocol/sdk`)
- **Astronomy**: `sweph` Node bindings + Swiss Ephemeris data files
- **Transport**: stdio (local process)
- **Data Format**: JSON responses
- **Precision**: The server rounds returned ecliptic longitude and latitude to two decimal places; no arcsecond-level guarantee is exposed

### Symbolism Server
- **Runtime**: Node.js
- **Framework**: MCP SDK
- **Database**: JSON file loaded into memory at runtime
- **Search**: Linear, case-insensitive substring scans over names, keywords, and meanings; exact then partial-name matching; no search index or edit-distance fuzzy matcher
- **Transport**: stdio (local process)
- **Data Format**: Structured JSON

Each plugin's adjacent `.mcp.json` launches `node` with `${CLAUDE_PLUGIN_ROOT}/server/index.js`. The variable is resolved by Claude Code; a relative `server/index.js` path is not sufficient for an installed plugin.

## Optional Integration Points

### With Claude Code

The supported integration is a user-requested conversation with Claude Code:

```text
1. User asks for astrological context.
2. Claude invokes the ephemeris MCP tools.
3. User asks about a card or symbol.
4. Claude invokes the symbolism MCP tools.
5. Claude presents the combined response.
```

There is no automatic call from `src/worker/index.js`, `functions/api/tarot-reading.js`, or the browser bundle. An application would need a separate, explicit MCP client integration.

## Performance Characteristics

The servers are optional local processes. Startup, query latency, and memory use depend on the installed Node version, data files, and host; the following are not Tableu application performance guarantees:

- The ephemeris process loads `sweph` and its configured data files.
- The symbolism process loads `symbols.json` into memory.
- No plugin process runs for a normal Tableu request unless a separate client invokes it.

## Security Considerations

### Data Privacy
- The tools calculate or read local reference data and do not require a Tableu application API key.
- The symbolism server does not store user data.
- The ephemeris server reads local Swiss Ephemeris files; review their separate license and data provenance.

### MCP Security
- stdio avoids opening a network listener for these servers.
- The local Node process still has the filesystem permissions of the user running Claude Code and can read the configured plugin data files.
- This repository does not provide a sandbox; do not describe the process as sandboxed or restricted beyond the operating-system permissions in effect.

## Extensibility

### Adding New Symbols

```javascript
// Edit plugins/tarot-astro-plugins/symbolism-server/data/symbols.json
{
  "animals": {
    "new-symbol": {
      "keywords": [...],
      "meanings": { ... }
    }
  }
}
```

### Adding New Astrological Features

```javascript
// Add to plugins/tarot-astro-plugins/ephemeris-server/server/ephemeris.js
export function getChironPosition(date) {
  // Implement Chiron ephemeris
}

// Expose via MCP in plugins/tarot-astro-plugins/ephemeris-server/server/index.js
{
  name: 'get_chiron_position',
  description: 'Get Chiron position for healing themes',
  inputSchema: { ... }
}
```

### Custom Slash Commands

```markdown
<!-- Add to either plugin's commands/ directory -->
---
description: Your custom command
---

# Custom Command

Instructions for Claude to execute...
```

## Future Architecture Enhancements

These are future optional integrations, not current Tableu runtime behavior.

### Planned Features

1. **Birth Chart Integration**
   - Store user birth data
   - Calculate natal chart
   - Compare transits to natal positions

2. **Historical Ephemeris**
   - Query past dates
   - Track planetary patterns over time
   - Correlate with reading history

3. **Vision Integration**
   - Connect to card image analyzer
   - Automatic symbol detection from card photos
   - Physical deck support

4. **Export & Analytics**
   - Export readings with cosmic context
   - Pattern analysis over time
   - Journal integration

---

**Architecture designed for:** Optional, inspectable Claude Code tools; it is not an integrated Tableu application runtime.
