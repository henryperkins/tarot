---
description: Add comprehensive astrological context to a tarot reading
---

# Astrological Reading Context

When invoked, gather comprehensive astrological context for the current or specified reading.

## Instructions

1. **Get current ephemeris data** using `get_current_positions` and `get_daily_astrological_weather`

2. **Identify key cosmic themes:**
   - Current moon phase and its meaning for the reading
   - Active planetary aspects and their influence
   - Any retrograde planets and what they suggest for reflection
   - The overall "astrological weather" of the day

3. **Present context to the user in this format:**

```
🌙 Astrological Context for Your Reading

**Moon Phase:** [Phase Name] in [Sign]
[Moon phase interpretation]

**Planetary Highlights:**
- [Key aspect or transit 1]
- [Key aspect or transit 2]
- [Key aspect or transit 3]

**Retrograde Activity:**
[List any retrograde planets and their significance for the reading]

**Daily Cosmic Theme:**
[Overall astrological weather and what it suggests for the reading]

**Integration with Your Cards:**
Consider how these cosmic currents might be reflected in or amplified by the cards drawn. The celestial energies don't determine the reading, but they can provide valuable context for the timing and themes emerging in your spread.
```

4. **Be ready to:**
   - Explain any astrological terms in accessible language
   - Draw connections between planetary energies and card meanings
   - Avoid deterministic language - frame as context, not cause

## Example

User: "/astro-reading"

Response:
```
🌙 Astrological Context for Your Reading

**Moon Phase:** Waxing Gibbous in Pisces (87% illuminated)
The moon is building toward fullness while moving through intuitive Pisces, suggesting a time of refinement and emotional deepening. Trust what's emerging from your inner world as you approach the culmination of this lunar cycle.

**Planetary Highlights:**
- Sun square Mars (orb: 0.8°) - Dynamic tension between will and action, catalyzing breakthroughs
- Venus trine Jupiter (orb: 2.3°) - Expansive love energy, optimism in relationships
- Mercury in Capricorn - Practical, grounded communication and planning

**Retrograde Activity:**
No planets currently retrograde - forward momentum available in all areas.

**Daily Cosmic Theme:**
Growth, building, expansion; Tension requiring resolution, growth through challenge; Flow, ease, natural talents emerging

**Integration with Your Cards:**
With Mars and the Sun in dynamic square, themes of action, courage, or constructive conflict in your cards may be especially relevant. The waxing moon in Pisces invites you to trust your intuition as you interpret the imagery and symbols before you.
```

## Important Notes

- Always use the MCP tools to get real, current data - never make up astrological positions
- Keep language accessible and avoid overwhelming jargon
- Frame astrology as context and timing, not deterministic prediction
- Connect cosmic energies to card meanings where natural, but don't force connections
- Remember: the cards respond to the question and querent, astrology provides backdrop
