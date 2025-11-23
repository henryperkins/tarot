# Tarot Astro Plugins

Enhance your tarot readings with real-time astrological context and comprehensive symbolism analysis.

## Overview

This marketplace provides two powerful MCP server plugins that bring depth and cosmic context to your tarot practice:

### 📡 Ephemeris Server
Real-time astronomical data including planetary positions, moon phases, aspects, and retrograde tracking. Adds astrological context to readings with accurate celestial information.

### 🔮 Symbolism Reference Database
Comprehensive symbolism database covering animals, colors, numbers, elements, plants, and celestial bodies. Provides multi-layered interpretations for tarot card imagery.

## Quick Start

### Installation

1. **Add the marketplace** to Claude Code:
   ```bash
   cd /home/azureuser/tarot
   /plugin marketplace add ./plugins/tarot-astro-plugins
   ```

2. **Install both plugins:**
   ```bash
   /plugin install ephemeris-server@tarot-astro-plugins
   /plugin install symbolism-server@tarot-astro-plugins
   ```

3. **Install dependencies** for each plugin:
   ```bash
   cd plugins/tarot-astro-plugins/ephemeris-server
   npm install

   cd ../symbolism-server
   npm install
   ```

4. **Restart Claude Code** to activate the MCP servers

### Verify Installation

Once installed, you should see:

```bash
# Check that both plugins are loaded
/plugin

# Check that MCP servers are running
/mcp

# Try the custom slash commands
/astro-reading
/symbol-analysis The Fool
```

## Features

### Ephemeris Server Features

✨ **Current Planetary Positions**
- All planets by sign and degree
- Longitudinal and latitudinal coordinates
- Real-time astronomical accuracy

🌙 **Moon Phase Tracking**
- Current phase name and angle
- Illumination percentage
- Sign placement and interpretation
- Waxing/waning status

⚡ **Planetary Aspects**
- Conjunctions, oppositions, squares, trines, sextiles
- Configurable orb tolerance
- Interpretive meanings for each aspect

♒ **Retrograde Detection**
- Identifies all retrograde planets
- Sign and degree placement
- Interpretation guidance

📅 **Daily Astrological Weather**
- Overview of key transits and themes
- Major aspects within tight orbs
- Recommended focus areas

### Symbolism Server Features

🦁 **Animal Symbolism**
- 12+ animals with rich meanings
- Tarot-specific interpretations
- Archetypal associations

🎨 **Color Analysis**
- 9 primary colors
- Psychological, spiritual, and elemental meanings
- Chakra and suit associations

🔢 **Numerological Insights**
- Numbers 0-10
- Tarot and spiritual significance
- Archetypal meanings

🌊 **Elemental Wisdom**
- Five elements (Fire, Water, Air, Earth, Spirit)
- Alchemical correspondences
- Directional and quality associations

🌸 **Plant & Botanical Symbols**
- Sacred plants and their meanings
- Mythological connections
- Spiritual significance

⭐ **Celestial Bodies**
- Sun, Moon, Stars, Lightning
- Astrological and spiritual interpretations

## Usage Examples

### Adding Astrological Context to a Reading

```bash
# Get current cosmic context
/astro-reading

# Then proceed with your reading
# Claude will have access to current planetary positions,
# moon phase, aspects, and retrograde information
```

**Example output:**
```
🌙 Astrological Context for Your Reading

**Moon Phase:** Waxing Gibbous in Pisces (87% illuminated)
The moon is building toward fullness while moving through intuitive
Pisces, suggesting a time of refinement and emotional deepening.

**Planetary Highlights:**
- Sun square Mars (orb: 0.8°) - Dynamic tension catalyzing breakthroughs
- Venus trine Jupiter (orb: 2.3°) - Expansive love energy, optimism
- Mercury in Capricorn - Practical, grounded communication

**Integration with Your Cards:**
With Mars and the Sun in dynamic square, themes of action, courage,
or constructive conflict in your cards may be especially relevant.
```

### Deep Symbol Analysis

```bash
# Analyze symbols in a specific card
/symbol-analysis The High Priestess

# Or ask Claude to interpret symbols
> "What does the pomegranate symbolize in The High Priestess?"
```

**Example output:**
```
🔮 Symbolic Analysis: The High Priestess

**Primary Symbols:**

Pomegranate
• Keywords: underworld, knowledge, abundance, fertility, Persephone
• General meaning: Underworld mysteries, sacred knowledge
• In this card: The veil decorated with pomegranates represents
  the threshold between conscious and unconscious
• Archetypal resonance: Seeds of wisdom, descent into the
  underworld, hidden abundance

[Additional symbols analyzed...]

**Symbolic Synthesis:**
The High Priestess sits at the threshold between opposites, veiled
by pomegranates (hidden wisdom), with the moon at her feet
(unconscious mastery). She holds wisdom that must be accessed
through intuition and inner knowing.
```

### Integration During Readings

The plugins work automatically during readings. Claude can:

```bash
# Reference current planetary energies
> "Consider the current Mars square Uranus when interpreting The Tower"

# Look up symbol meanings
> "What does the color blue represent in The Star card?"

# Check numerological significance
> "What's the significance of position 7 in this spread?"

# Get moon phase context
> "How does today's new moon affect this reading?"
```

## MCP Tools Reference

### Ephemeris Server Tools

| Tool | Description | Example Use |
|------|-------------|-------------|
| `get_current_positions` | All planetary positions | Current cosmic snapshot |
| `get_moon_phase` | Moon phase data | Lunar timing context |
| `get_planetary_aspects` | Active aspects | Understanding tensions/harmonies |
| `get_retrograde_planets` | Retrograde list | Reflection periods |
| `get_ephemeris_for_reading` | Complete snapshot for timestamp | Record cosmic context of reading |
| `get_daily_astrological_weather` | Daily overview | Morning cosmic check-in |

### Symbolism Server Tools

| Tool | Description | Example Use |
|------|-------------|-------------|
| `search_symbols` | Search by keyword | Find all "transformation" symbols |
| `get_symbol` | Get specific symbol | Detailed lion symbolism |
| `get_category` | All symbols in category | All animal symbols |
| `get_related_symbols` | Theme-based search | All love-related symbols |
| `interpret_card_symbols` | Multi-symbol synthesis | Analyze The Fool's symbols |
| `get_color_meanings` | Color analysis | Red, white, blue in reading |
| `get_numerological_insight` | Number meanings | Significance of 3 |

## Custom Slash Commands

### `/astro-reading`
Provides comprehensive astrological context for the current moment:
- Current moon phase and interpretation
- Active planetary aspects
- Retrograde activity
- Daily cosmic theme
- Integration guidance for readings

### `/symbol-analysis [Card Name]`
Deep symbolic analysis of tarot card imagery:
- Primary symbol meanings
- Color symbolism
- Numerological insights
- Symbolic synthesis
- Interpretive guidance

## Integration with Tarot Readings

### Automatic Context Enhancement

The plugins seamlessly integrate with your tarot reading workflow:

**Before the plugins:**
> "The Tower suggests sudden change and breakthrough."

**With astrological context:**
> "The Tower suggests sudden change and breakthrough. With Mars square
> Uranus active today (exact within 1°), this energy of sudden shifts
> and liberation is amplified in the collective field. The Waning Moon
> in Scorpio supports the release of what no longer serves."

**With symbol analysis:**
> "The lightning striking the crown represents divine intervention
> (sudden revelation, breakthrough, awakening). The falling figures
> symbolize the destruction of false structures and ego constructs.
> The cosmic background suggests this is a fated event aligned with
> higher purpose."

### Example Reading Workflow

1. **Set intention** for the reading
2. **Check astrological context**: `/astro-reading`
3. **Draw cards** using your chosen spread
4. **Analyze symbols** as needed: `/symbol-analysis [Card Name]`
5. **Synthesize** card meanings with cosmic context
6. **Record** the reading with timestamp for future reference

## Technical Details

### Requirements
- Claude Code installed
- Node.js (for running MCP servers)
- npm (for dependency installation)

### Dependencies
- **Ephemeris Server**: `astronomy-engine`, `@modelcontextprotocol/sdk`
- **Symbolism Server**: `@modelcontextprotocol/sdk`

### MCP Server Configuration

Both plugins are configured to run as stdio MCP servers:

```json
{
  "mcpServers": {
    "ephemeris": {
      "command": "node",
      "args": ["server/index.js"]
    },
    "symbolism": {
      "command": "node",
      "args": ["server/index.js"]
    }
  }
}
```

### Data Sources

**Ephemeris Server:**
- Uses Swiss Ephemeris algorithms via `astronomy-engine`
- Accuracy: ±0.1° for planetary positions
- Real-time calculations with <10ms latency

**Symbolism Server:**
- Curated database of traditional tarot symbolism
- Cross-referenced with multiple esoteric traditions
- Extensible JSON format for custom additions

## Extending the Plugins

### Adding Custom Symbols

Edit `symbolism-server/data/symbols.json`:

```json
{
  "animals": {
    "phoenix": {
      "keywords": ["rebirth", "transformation", "immortality"],
      "meanings": {
        "general": "Death and rebirth, rising from ashes",
        "tarot": "Judgment, Death - transformation and renewal",
        "archetypal": "Eternal return, alchemical transformation"
      },
      "cultural_context": "Universal symbol of resurrection"
    }
  }
}
```

### Custom Commands

Add new slash commands in the `commands/` directory of either plugin:

```markdown
---
description: Your custom command description
---

# Command Name

Instructions for Claude on how to execute this command...
```

## Troubleshooting

### Plugins Not Loading

```bash
# Check plugin installation
/plugin

# Verify marketplace is added
/plugin marketplace list

# Check for errors in debug mode
claude --debug
```

### MCP Servers Not Running

```bash
# Check MCP server status
/mcp

# Verify dependencies are installed
cd plugins/tarot-astro-plugins/ephemeris-server
npm install

cd ../symbolism-server
npm install

# Restart Claude Code
```

### Ephemeris Calculations Incorrect

The ephemeris server uses well-tested astronomical algorithms. If you encounter discrepancies:

1. Check that `astronomy-engine` is properly installed
2. Verify your system time is correct
3. Compare with https://www.astro.com/swisseph/ for validation

### Symbol Not Found

If a symbol search returns no results:

1. Try alternate spellings or related keywords
2. Check the category (animals, colors, numbers, etc.)
3. Use `get_category` to browse available symbols
4. Consider adding custom symbols to the database

## Future Enhancements

Planned features for future releases:

- [ ] Birth chart integration (enter birth data for personalized context)
- [ ] Astrological transits to natal planets
- [ ] Expanded symbol database with more traditions
- [ ] Integration with card image analysis (vision AI)
- [ ] Historical ephemeris lookups for past readings
- [ ] Customizable symbol interpretation frameworks
- [ ] Export readings with astrological data

## Contributing

To contribute to these plugins:

1. Fork the repository
2. Create your feature branch
3. Add new symbols, improve algorithms, or enhance functionality
4. Test thoroughly with actual readings
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

**Astronomical Calculations:**
- Swiss Ephemeris via `astronomy-engine`
- JPL Planetary Ephemeris data

**Symbolism Database:**
- Curated from traditional tarot sources
- Rider-Waite-Smith symbolism
- Hermetic and Kabbalistic traditions
- Cross-cultural archetypal research

**Developed for:**
Mystic Tarot - Authentic tarot reading web application

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Consult the documentation
- Test with `claude --debug` for detailed logs

---

**May your readings be illuminated by the stars above and the symbols within.** ✨🌙🔮
