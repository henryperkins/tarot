# Tarot Astro Plugins

Type: guide
Status: active
Last reviewed: 2026-09-25

Optional Claude Code tools for adding astrological context and symbolism reference to a conversation about tarot.

These plugins are local MCP servers for Claude Code. They are not dependencies of the Tableu Worker, browser bundle, or reading pipeline, and installing them does not automatically enrich application readings.

## Overview

This marketplace provides two optional MCP server plugins that can give Claude Code useful reference material during a user-requested interpretation:

### 📡 Ephemeris Server
Swiss Ephemeris-backed planetary positions, moon phases, aspects, and retrograde tracking. Claude Code can use these results when a user explicitly asks for astrological context.

### 🔮 Symbolism Reference Database
A local symbolism database covering animals, colors, numbers, elements, plants, and celestial bodies. Claude Code can use it to look up interpretations for symbols a user names.

## Quick Start

### Installation

1. **Add the marketplace** to Claude Code from the repository root:

   ```bash
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
- Swiss Ephemeris-backed positions computed locally

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
- 12 animals with curated meanings
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

### Adding Astrological Context in Claude Code

```bash
# Get current cosmic context
/astro-reading

# Then ask Claude to use that context in a tarot interpretation
# The ephemeris tools are used only when Claude Code invokes them
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

**How Claude might use this context:**
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

### Optional Claude Code Usage

The plugins do not run as part of a Tableu reading request. When a user explicitly asks Claude to use an MCP tool, Claude can:

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

## Optional Claude Code Workflows

### User-Requested Context

These examples show a Claude Code conversation in which the user asks Claude to combine tool results. They do not describe a hook or runtime integration in the Tableu application:

**Before requesting tool context:**
> "The Tower suggests sudden change and breakthrough."

**After requesting astrological context:**
> "The Tower suggests sudden change and breakthrough. With Mars square
> Uranus active today (exact within 1°), this energy of sudden shifts
> and liberation is amplified in the collective field. The Waning Moon
> in Scorpio supports the release of what no longer serves."

**After requesting symbol analysis:**
> "The lightning striking the crown represents divine intervention
> (sudden revelation, breakthrough, awakening). The falling figures
> symbolize the destruction of false structures and ego constructs.
> The cosmic background suggests this is a fated event aligned with
> higher purpose."

### Example Claude Code Workflow

1. **Set intention** for the reading
2. **Ask for astrological context**: `/astro-reading`
3. **Draw or name cards** in the conversation
4. **Ask for symbol analysis**: `/symbol-analysis [Card Name]`
5. **Ask Claude to synthesize** the results as part of the conversation
6. **Record** the result if the user wants to keep it

No step in this workflow is performed by the Tableu application unless the application is separately changed to call an MCP client.

## Technical Details

### Requirements
- Claude Code installed
- Node.js and npm for the optional local MCP processes
- Swiss Ephemeris data files for the ephemeris server

These requirements apply to the optional tools, not to running the Tableu application.

### Dependencies
- **Ephemeris Server**: `sweph`, `@modelcontextprotocol/sdk`
- **Symbolism Server**: `@modelcontextprotocol/sdk`

### MCP Server Configuration

Each plugin loads its own adjacent `.mcp.json` file. The configuration uses stdio and resolves the server entry point relative to the installed plugin root; it is not a Tableu application configuration.

`plugins/tarot-astro-plugins/ephemeris-server/.mcp.json` is equivalent to:

```json
{
  "mcpServers": {
    "ephemeris": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.js"]
    }
  }
}
```

`plugins/tarot-astro-plugins/symbolism-server/.mcp.json` is equivalent to:

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

The current ephemeris `.mcp.json` also contains an `EPHEMERIS_API_KEY` environment placeholder, but this local server does not read that variable. Use the ephemeris data-file guidance for `SE_EPHE_PATH`.

### Data Sources

**Ephemeris Server:**
- Uses the `sweph` Node.js bindings with Swiss Ephemeris data files
- Calculates positions locally through the MCP stdio process
- Reports ecliptic longitude and latitude rounded to two decimal places by the server
- Does not advertise a guaranteed arcsecond-level precision; accuracy depends on the Swiss Ephemeris version, data files, and date
- Requires the data files described in `plugins/tarot-astro-plugins/docs/SWISS_EPHEMERIS_DATA.md`

**Symbolism Server:**
- Curated database of traditional tarot symbolism
- Cross-referenced with multiple esoteric traditions
- Extensible JSON format for custom additions

## Extending the Plugins

### Adding Custom Symbols

Edit `plugins/tarot-astro-plugins/symbolism-server/data/symbols.json` from the repository root:

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

1. Check that `sweph` and the Swiss Ephemeris data files are installed correctly; see `plugins/tarot-astro-plugins/docs/SWISS_EPHEMERIS_DATA.md`
2. Verify your system time is correct
3. Compare with a trusted ephemeris source for the date and data-file range

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

The symbolism server is MIT licensed. The ephemeris plugin's own code is MIT except for the Swiss Ephemeris components described in `plugins/tarot-astro-plugins/ephemeris-server/LICENSE`; the `sweph` dependency and its data have separate AGPL-3.0 or professional-license terms. Review that file before redistributing or combining the ephemeris server with proprietary software.

## Credits

**Astronomical Calculations:**
- Swiss Ephemeris via `sweph`
- Swiss Ephemeris data files; consult their license and data-range documentation

**Symbolism Database:**
- Curated from traditional tarot sources
- Rider-Waite-Smith symbolism
- Hermetic and Kabbalistic traditions
- Cross-cultural archetypal research

**Developed for:**
Tableu

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Consult the documentation
- Test with `claude --debug` for detailed logs

---

**May your readings be illuminated by the stars above and the symbols within.** ✨🌙🔮
