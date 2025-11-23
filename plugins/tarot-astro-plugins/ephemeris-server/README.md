# Ephemeris MCP Server

Real-time astronomical data for tarot readings. Provides planetary positions, moon phases, aspects, and astrological context.

## Features

- **Planetary Positions**: Current position of all planets by sign and degree
- **Moon Phases**: Detailed lunar data including phase, illumination, and interpretation
- **Planetary Aspects**: Detection of conjunctions, oppositions, squares, trines, and sextiles
- **Retrograde Detection**: Identifies planets in retrograde motion
- **Reading Snapshots**: Complete astrological context for any timestamp
- **Daily Weather**: Overview of key astrological themes and transits

## Installation

```bash
cd ephemeris-server
npm install
```

## Usage

This MCP server is automatically configured when the plugin is installed. Claude Code will have access to these tools:

### Available Tools

#### `get_current_positions()`
Returns current planetary positions for all planets.

**Example response:**
```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "positions": {
    "Sun": {
      "sign": "Aquarius",
      "degree": 3.45,
      "longitude": 303.45,
      "latitude": 0.0
    },
    "Moon": {
      "sign": "Pisces",
      "degree": 12.78,
      "longitude": 342.78,
      "latitude": 5.13
    }
    // ... all planets
  }
}
```

#### `get_moon_phase(date?)`
Get moon phase information for a specific date.

**Parameters:**
- `date` (optional): ISO date string

**Example response:**
```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "phaseName": "Waxing Gibbous",
  "phaseAngle": 142.5,
  "illumination": 87.3,
  "sign": "Pisces",
  "degree": 12.78,
  "isWaxing": true,
  "interpretation": "Refinement, adjustment, development in Pisces"
}
```

#### `get_planetary_aspects(date?, orb?)`
Get active planetary aspects.

**Parameters:**
- `date` (optional): ISO date string
- `orb` (optional): Orb in degrees (default: 8)

**Example response:**
```json
[
  {
    "planet1": "Sun",
    "planet2": "Mars",
    "type": "square",
    "angle": 89.2,
    "orb": 0.8,
    "interpretation": "Sun-Mars: Tension, growth, breakthrough"
  }
]
```

#### `get_retrograde_planets(date?)`
Get planets currently in retrograde.

**Example response:**
```json
[
  {
    "planet": "Mercury",
    "sign": "Capricorn",
    "degree": 15.23,
    "interpretation": "Review communication, rethink plans, revisit details"
  }
]
```

#### `get_ephemeris_for_reading(timestamp)`
Complete astrological snapshot for a reading.

**Parameters:**
- `timestamp` (required): ISO timestamp of the reading

**Example response:**
```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "positions": { /* all planetary positions */ },
  "moon": { /* moon phase data */ },
  "aspects": [ /* all aspects */ ],
  "retrogrades": [ /* retrograde planets */ ],
  "readingContext": "Moon in Pisces (Waxing Gibbous) | Sun in Aquarius | Active aspects: Sun-Mars square | Retrograde: Mercury"
}
```

#### `get_daily_astrological_weather(date?)`
Overview of daily astrological themes.

**Example response:**
```json
{
  "date": "2025-01-23T00:00:00.000Z",
  "moon": { /* moon data */ },
  "retrogrades": [ /* retrograde planets */ ],
  "majorAspects": [ /* tight aspects */ ],
  "keyTransits": [
    {
      "type": "aspect",
      "description": "Sun square Mars",
      "significance": "medium"
    }
  ],
  "dailyTheme": "Growth, building, expansion; Reflection and review (1 retrograde); Tension requiring resolution, growth through challenge"
}
```

## Integration with Tarot Readings

### Automatic Context
When enabled, this plugin adds astrological context to every reading:

```javascript
// In your reading function
const astroContext = await getEphemerisForReading(readingTimestamp);

// Include in narrative generation
const prompt = `
Reading performed at: ${astroContext.readingContext}

Moon phase: ${astroContext.moon.phaseName} in ${astroContext.moon.sign}
- ${astroContext.moon.interpretation}

Active planetary energies:
${astroContext.aspects.slice(0, 3).map(a => `- ${a.interpretation}`).join('\n')}

Consider these cosmic influences when interpreting the cards...
`;
```

### Example Reading Enhancement

**Without astrological context:**
> "The Tower suggests sudden change and breakthrough."

**With astrological context:**
> "The Tower suggests sudden change and breakthrough. With Mars square Uranus active today (exact within 1°), this energy of sudden shifts and liberation is amplified in the collective field. The Waning Moon in Scorpio supports the release of what no longer serves."

## Astrological Interpretation Guide

### Moon Phases
- **New Moon**: Planting seeds, setting intentions, new beginnings
- **Waxing Crescent**: Faith, initial growth, following impulses
- **First Quarter**: Action, decisions, overcoming obstacles
- **Waxing Gibbous**: Refinement, development, trust the process
- **Full Moon**: Culmination, revelation, maximum illumination
- **Waning Gibbous**: Sharing, gratitude, teaching
- **Last Quarter**: Re-evaluation, release, letting go
- **Waning Crescent**: Surrender, rest, preparation for renewal

### Major Aspects
- **Conjunction (0°)**: Fusion, new cycles, concentrated energy
- **Opposition (180°)**: Awareness, balance, integration of opposites
- **Trine (120°)**: Flow, ease, natural talents, harmony
- **Square (90°)**: Tension, growth, necessary challenges
- **Sextile (60°)**: Opportunities, connections, skillful expression

### Retrograde Themes
Retrograde periods invite internal processing and review in the planet's domain:
- **Mercury Rx**: Communication, technology, plans, details
- **Venus Rx**: Relationships, values, aesthetics, self-worth
- **Mars Rx**: Action, desire, energy, assertion
- **Jupiter Rx**: Beliefs, growth, philosophy, meaning
- **Saturn Rx**: Structure, responsibility, authority, karma
- **Uranus Rx**: Change, freedom, authenticity, revolution
- **Neptune Rx**: Spirituality, illusions, dreams, boundaries
- **Pluto Rx**: Power, transformation, shadow work, control

## Technical Details

### Dependencies
- `astronomy-engine`: High-precision astronomical calculations
- `@modelcontextprotocol/sdk`: MCP server framework

### Accuracy
Uses Swiss Ephemeris algorithms via astronomy-engine for accurate planetary positions (precision: ±0.1°).

### Performance
All calculations are performed in real-time with minimal latency (<10ms per query).

## License

MIT
