# Symbolism Reference MCP Server

Local symbolism reference data for Claude Code conversations about tarot. Provides meanings for animals, colors, numbers, elements, plants, and celestial symbols.

This is an optional Claude Code MCP server. It is not imported by the Tableu Worker, browser bundle, or reading pipeline, and it does not automatically modify an application reading.

## Features

- **6 Symbol Categories**: Animals, colors, numbers, elements, plants, celestial bodies
- **Rich Meanings**: General, tarot-specific, spiritual, and psychological interpretations
- **Linear Keyword Search**: Scan symbols by name or associated keywords without a search index
- **Theme Exploration**: Discover symbols related to specific themes or archetypes
- **Contextual Interpretation**: Synthesize multiple symbols for coherent readings
- **Cross-References**: Discover relationships between symbols

## Installation

```bash
cd plugins/tarot-astro-plugins/symbolism-server
npm install
```

## Usage

When the plugin is installed in Claude Code, its `.mcp.json` exposes these tools through a local stdio process. A tool is called only when Claude Code invokes it:

```json
{
  "mcpServers": {
    "symbolism": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.js"]
    }
  }
}
```

### Available Tools

#### `search_symbols(query, category?, limit?)`
Search for symbols by keyword or name.

**Parameters:**
- `query` (required): Search term
- `category` (optional): Filter by category (animals, colors, numbers, elements, plants, celestial)
- `limit` (optional): Max results (default: 10)

**Example:**
```javascript
search_symbols("transformation")
// Returns symbols related to transformation across all categories
```

**Response:**
```json
[
  {
    "name": "serpent",
    "category": "animals",
    "relevance": 0.8,
    "keywords": ["transformation", "kundalini", "wisdom", "healing", "renewal"],
    "meanings": {
      "general": "Transformation, shedding old skins, primal energy, healing wisdom",
      "tarot": "The Magician, The Lovers - life force, temptation, transformation"
    }
  }
]
```

#### `get_symbol(category, name)`
Get detailed information about a specific symbol.

**Example:**
```javascript
get_symbol("animals", "lion")
```

**Response:**
```json
{
  "name": "lion",
  "category": "animals",
  "keywords": ["courage", "strength", "solar", "mastery", "heart"],
  "meanings": {
    "general": "Courage, raw power tamed through love, solar majesty",
    "tarot": "Strength - the union of gentleness and power",
    "archetypal": "The Solar Lion, Sekhmet, Heart of the King"
  },
  "cultural_context": "Universal symbol of courage, nobility, and power of the heart"
}
```

#### `get_category(category)`
Get all symbols in a specific category.

**Example:**
```javascript
get_category("elements")
```

**Response:**
```json
{
  "category": "elements",
  "symbols": [
    {
      "name": "fire",
      "keywords": ["will", "passion", "energy", "transformation", "spirit"],
      "summary": "Will, creative force, passion, transformation, spirit, action"
    }
    // ... all elements
  ]
}
```

#### `get_related_symbols(theme, limit?)`
Find symbols related to a specific theme.

**Example:**
```javascript
get_related_symbols("love", 10)
```

**Response:**
```json
[
  {
    "name": "rose",
    "category": "plants",
    "relevance": 0.8,
    "keywords": ["love", "beauty", "unfolding", "heart"],
    "summary": "Divine love, beauty, the unfolding soul, heart wisdom"
  },
  {
    "name": "dove",
    "category": "animals",
    "relevance": 0.7,
    "keywords": ["peace", "spirit", "purity", "love"],
    "summary": "Peace, Holy Spirit, pure love, divine messenger"
  }
]
```

#### `interpret_card_symbols(cardName, symbols)`
Get interpretation framework for symbols in a tarot card.

**Example:**
```javascript
interpret_card_symbols("The Magician", ["serpent", "rose", "lily", "red", "white"])
```

**Response:**
```json
{
  "card": "The Magician",
  "symbols": [
    {
      "symbol": "serpent",
      "category": "animals",
      "data": { /* full symbol data */ }
    }
    // ... all symbols
  ],
  "synthesis": {
    "dominantThemes": ["transformation", "purity", "passion"],
    "symbolCount": 5,
    "interpretation": "The Magician combines 5 symbolic elements creating a rich tapestry of meaning around themes of: transformation, purity, passion."
  }
}
```

#### `get_color_meanings(colors)`
Get comprehensive color symbolism.

**Example:**
```javascript
get_color_meanings(["red", "blue", "gold"])
```

**Response:**
```json
[
  {
    "color": "red",
    "keywords": ["passion", "fire", "energy", "life-force", "action"],
    "meanings": {
      "general": "Vital energy, passion, blood, life force",
      "spiritual": "Root chakra, grounding, survival, physical vitality",
      "elemental": "Fire - transformation, will, creative power"
    },
    "associations": ["Mars", "Aries", "Wands suit"]
  }
  // ... other colors
]
```

#### `get_numerological_insight(number)`
Get numerological meaning for a number.

**Example:**
```javascript
get_numerological_insight("7")
```

**Response:**
```json
{
  "name": "7",
  "category": "numbers",
  "keywords": ["spiritual", "mystical", "inner", "contemplation", "mastery"],
  "meanings": {
    "general": "Spiritual wisdom, inner journey, mystical number",
    "tarot": "Chariot, Sevens - spiritual mastery, inner journey",
    "spiritual": "Seven chakras, seven days, mystical perfection"
  },
  "archetypal": "The Mystic, The Seeker, The Hermit"
}
```

## Symbol Categories

### Animals
Represents instinctual energies, archetypal forces, and animal wisdom:
- **Dog**: Loyalty, instinct, companionship, guidance
- **Wolf**: Wildness, shadow, lunar consciousness
- **Lion**: Courage, solar strength, heart mastery
- **Serpent**: Transformation, kundalini, healing
- **Eagle**: Spiritual vision, sovereignty, higher perspective
- **Dove**: Peace, spirit, pure love
- **Horse**: Power, freedom, spiritual journey
- **Sphinx**: Mystery, guardian, four-fold wisdom

### Colors
Psychological, spiritual, and elemental meanings:
- **Red**: Passion, fire, life force, action
- **Blue**: Emotion, intuition, depth, spirit
- **Yellow**: Intellect, clarity, consciousness
- **Green**: Growth, heart, healing, nature
- **Purple**: Spiritual wisdom, transformation
- **White**: Purity, light, wholeness
- **Black**: Mystery, void, potential, shadow
- **Gold**: Solar consciousness, enlightenment
- **Silver**: Lunar wisdom, receptivity

### Numbers (0-10)
Numerological and archetypal significance:
- **0**: Infinite potential, the void
- **1**: Unity, beginning, individuation
- **2**: Duality, relationship, balance
- **3**: Creation, synthesis, trinity
- **4**: Structure, stability, manifestation
- **5**: Change, challenge, human number
- **6**: Harmony, balance, beauty
- **7**: Spiritual wisdom, inner journey
- **8**: Power, infinity, karma
- **9**: Completion, wisdom, attainment
- **10**: Wholeness, return, new cycle

### Elements
Classical and alchemical element symbolism:
- **Fire**: Will, passion, transformation
- **Water**: Emotion, intuition, flow
- **Air**: Thought, communication, clarity
- **Earth**: Manifestation, stability, body
- **Spirit**: Unity, transcendence, quintessence

### Plants
Botanical symbolism and sacred plants:
- **Rose**: Divine love, beauty, unfolding
- **Lily**: Purity, resurrection, light
- **Pomegranate**: Underworld wisdom, abundance
- **Wheat**: Harvest, nourishment, cycles
- **Lotus**: Enlightenment, purity arising
- **Oak**: Strength, wisdom, axis mundi
- **Willow**: Flexibility, lunar wisdom

### Celestial
Heavenly bodies and cosmic forces:
- **Sun**: Consciousness, vitality, enlightenment
- **Moon**: Unconscious, intuition, cycles
- **Stars**: Hope, guidance, higher self
- **Lightning**: Revelation, breakthrough, divine fire

## Optional Claude Code Usage

### User-Requested Symbol Analysis

The server does not enrich every application reading. When a user explicitly asks Claude Code to interpret a card or symbol, Claude can use the tools in that conversation. The examples below are standalone tool-use sketches, not code imported by the Tableu application.

Call `interpret_card_symbols` with `cardName: "The Moon"` and the symbols the user names, such as `moon`, `wolf`, `dog`, `crayfish`, `silver`, and `blue`. Claude can then present the returned synthesis.

### Color Analysis in a Claude Code Conversation

Call `get_color_meanings` with `colors: ["blue", "red", "gold"]`, then ask Claude to explain how those meanings interact in the user's context.

### Numerological Context in a Claude Code Conversation

Call `get_numerological_insight` separately for the spread size and card position, such as `"7"` and `"3"`, and ask Claude to combine the returned interpretations.

## Extending the Database

From the repository root, edit `plugins/tarot-astro-plugins/symbolism-server/data/symbols.json`:

```json
{
  "animals": {
    "new-animal": {
      "keywords": ["keyword1", "keyword2"],
      "meanings": {
        "general": "General meaning",
        "tarot": "Tarot-specific meaning",
        "archetypal": "Archetypal associations"
      },
      "cultural_context": "Cultural and historical context"
    }
  }
}
```

## Best Practices

1. **Layered Interpretation**: Use multiple symbol lookups to build rich, contextual meanings
2. **Cross-Reference**: Explore related symbols to discover thematic connections
3. **Cultural Sensitivity**: Remember that symbols have different meanings in different traditions
4. **Synthesis**: Combine multiple symbols for coherent interpretation rather than listing meanings
5. **Context Matters**: Same symbol can mean different things in different card positions

## Technical Details

### Database Structure
- JSON-based symbol database loaded into memory
- Hierarchical category organization
- Multiple meaning contexts per symbol
- Linear, case-insensitive substring scans over names, keywords, and meanings
- Exact then partial-name scans; no search index or edit-distance fuzzy matcher

### Performance
- Lookup cost grows with the number of loaded symbols
- Response time depends on the local Claude Code process and is not an application-runtime guarantee

## License

The symbolism server plugin is MIT licensed, as declared in its package metadata. The optional ephemeris server has separate Swiss Ephemeris licensing; see `plugins/tarot-astro-plugins/ephemeris-server/LICENSE` for that distinction.
