# Knowledge Graph Documentation - Overview

## Purpose

These documents define the data structures and detection logic for the Mystic Tarot Knowledge Graph system. This system detects multi-card archetypal patterns that create synergistic meaning beyond individual card interpretations.

## Documentation Files

### 1. [FOOLS_JOURNEY.md](./FOOLS_JOURNEY.md)
**What It Detects:** Which stage of the Major Arcana journey dominates a spread

**Three Stages:**
- **Initiation (0-7):** Building ego, learning, establishing in the world
- **Integration (8-14):** Shadow work, surrender, transformation
- **Culmination (15-21):** Confronting shadow, revelation, completion

**Reading Significance:** Tells you what developmental chapter the querent is navigating

**Implementation Priority:** Week 1

---

### 2. [ARCHETYPAL_TRIADS.md](./ARCHETYPAL_TRIADS.md)
**What It Detects:** Complete three-card narrative arcs

**Five Core Triads:**
1. **Healing Arc:** Death → Temperance → Star
2. **Liberation Arc:** Devil → Tower → Sun
3. **Inner Work Arc:** Hermit → Hanged Man → Moon
4. **Mastery Arc:** Magician → Chariot → World
5. **Values Arc:** Empress → Lovers → Hierophant

**Reading Significance:** Provides complete transformation narratives when all 3 cards present

**Implementation Priority:** Week 1 (core triads), Week 3 (additional triads)

---

### 3. [ARCHETYPAL_DYADS.md](./ARCHETYPAL_DYADS.md)
**What It Detects:** Powerful two-card synergies

**15 Dyads Across Categories:**
- **Transformation:** Death+Star, Tower+Sun, Hanged Man+Death, Moon+Sun
- **Empowerment:** Fool+Magician, Strength+Justice
- **Wisdom:** Hermit+High Priestess, High Priestess+Hierophant
- **Challenge:** Devil+Lovers, Devil+Tower, Hierophant+Devil
- **Cycles:** Wheel+Judgement
- **Power:** Emperor+Empress
- **Vision:** Star+Judgement, Chariot+World

**Reading Significance:** Highlights meaningful pairings even when full triads aren't present

**Implementation Priority:** Week 3 (extends existing 5 dyads to 15)

---

### 4. [SUIT_PROGRESSIONS.md](./SUIT_PROGRESSIONS.md)
**What It Detects:** Minor Arcana narrative arcs within each suit

**Four Suits × Three Stages:**
- **Wands (Fire):** Ignition → Testing → Culmination (often with burden)
- **Cups (Water):** Emotional Opening → Complexity → Maturity (fulfillment)
- **Swords (Air):** Clarity → Struggle → Crisis & Liberation (dawn after darkness)
- **Pentacles (Earth):** Foundation → Resource Management → Mastery (legacy)

**Reading Significance:** Shows what practical/emotional/mental/material phase the querent is in

**Implementation Priority:** Week 2

---

## How Patterns Work Together

### Priority Hierarchy (Most to Least Significant)

1. **Complete Triads** (all 3 cards present)
   - Highest narrative significance
   - Explicitly name the arc in readings
   - Example: "Death, Temperance, and The Star form The Healing Arc..."

2. **Strong Fool's Journey Stage** (3+ Majors from same stage)
   - High developmental significance
   - Provides life chapter context
   - Example: "Four cards from the Integration stage suggest you're in profound transformation work..."

3. **Strong Suit Progression** (3+ cards from same suit+stage)
   - High practical significance
   - Shows which domain and phase are active
   - Example: "Ace, Two, and Three of Wands show you're in the ignition phase of a creative endeavor..."

4. **High-Significance Dyads**
   - Medium-high significance
   - Mention when relevant to question
   - Example: "Death and The Star suggest transformation clearing into hope..."

5. **Partial Triads** (2 of 3 cards)
   - Supporting significance
   - Brief mention
   - Example: "Death and The Star (from The Healing Arc) suggest transformation and renewal, though Temperance's integrative work may be happening quickly..."

6. **Emerging Progressions / Medium Dyads**
   - Low-medium significance
   - Mention only if space permits

---

## Integration Guidelines

### When to Surface Patterns

**High Priority Situations:**
- Complete triads appear → Name explicitly, 2-3 sentences
- 3+ Majors from same Journey stage → Name stage and developmental context
- 3+ cards from same suit progression stage → Name suit, stage, practical arc

**Medium Priority:**
- 2 Majors from same Journey stage → Brief mention
- High-significance dyads → 1 sentence
- Emerging suit progressions → Brief mention

**Low Priority:**
- Scattered patterns → Don't force it
- Multiple partial patterns → Choose most relevant to question

### Don't Overwhelm

**Maximum per reading:**
- 1-2 complete triads (if present)
- 1 Fool's Journey stage mention
- 1-2 suit progressions
- 1-2 dyads
- **Total: 3-5 pattern mentions maximum**

Prioritize quality over quantity. Choose patterns most relevant to the user's question and spread context.

---

## Narrative Flow

### Where Patterns Fit in Readings

1. **Opening:** Question, spread type, context
2. **Thematic Context:** Elemental balance, suit focus, reversal framework
3. **Position-by-Position:** Individual card meanings (MOST IMPORTANT)
4. **Pattern Synthesis:** "Deeper Patterns" section ← **KNOWLEDGE GRAPH GOES HERE**
5. **Final Synthesis:** Actionable guidance, free will reminder

### Pattern Section Template

```markdown
### Deeper Patterns

Beyond the individual positions, your cards reveal larger archetypal movements:

**[Pattern Name]:** [Narrative with card references]

[2nd pattern if relevant]

[Explain how patterns relate to the question]
```

---

## Technical Implementation

### Detection Flow

```javascript
// In spreadAnalysis.js
const patterns = detectAllPatterns(cardsInfo);

if (patterns) {
  themes.knowledgeGraph = {
    patterns,  // Full detection results
    narrativeHighlights: getPriorityPatternNarratives(patterns)  // Top 3-5 for narrative
  };
}
```

### Priority Ranking

```javascript
function getPriorityPatternNarratives(patterns) {
  const narratives = [];

  // Priority 1: Complete triads
  patterns.triads?.filter(t => t.isComplete).forEach(triad => {
    narratives.push({
      priority: 1,
      type: 'complete-triad',
      text: `**${triad.theme}:** ${triad.narrative}`
    });
  });

  // Priority 2: Strong Fool's Journey
  if (patterns.foolsJourney?.significance === 'strong') {
    narratives.push({
      priority: 2,
      type: 'fools-journey',
      text: `**Fool's Journey - ${patterns.foolsJourney.stage}:** ${patterns.foolsJourney.narrative}`
    });
  }

  // Priority 3: Strong suit progressions
  patterns.suitProgressions?.filter(p => p.significance === 'strong-progression').forEach(prog => {
    narratives.push({
      priority: 3,
      type: 'suit-progression',
      text: `**${prog.suit} ${prog.stage}:** ${prog.narrative}`
    });
  });

  // Sort by priority, return top 3-5
  return narratives.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
```

---

## Validation & Quality

### What Makes a Valid Pattern

✅ **Do:**
- Detect patterns that enhance understanding
- Prioritize patterns most relevant to the question
- Integrate patterns organically into narrative
- Limit to 3-5 pattern mentions maximum

❌ **Don't:**
- Force patterns when cards aren't present
- Overwhelm readings with pattern lists
- Let patterns overshadow position meanings
- Invent new patterns without traditional basis

### Testing Checklist

- [ ] Complete triads detect correctly (Death-Temperance-Star)
- [ ] Partial triads acknowledge missing card
- [ ] Fool's Journey stage reflects majority
- [ ] Suit progressions require 2+ cards from stage
- [ ] Priority ranking works correctly
- [ ] Narrative templates are clear and non-mechanical
- [ ] Integration doesn't disrupt existing reading flow
- [ ] Maximum 3-5 pattern mentions enforced

---

## Implementation Phases

### Week 1: Foundation
- Implement FOOLS_JOURNEY
- Implement 5 core ARCHETYPAL_TRIADS
- Basic detection functions
- Unit tests

### Week 2: Expansion
- Implement SUIT_PROGRESSIONS (all 4 suits)
- Integrate into spreadAnalysis.js
- Update prompt building (prompts/ modules via prompts.js barrel)

### Week 3: Enhancement
- Extend ARCHETYPAL_DYADS (5 → 15)
- Add COURT_PATTERNS and NUMERICAL_HARMONICS
- Update spread builders (narrative/spreads/*.js)
- Frontend SpreadPatterns component

### Week 4: Polish & Deploy
- Testing, performance optimization
- Deploy to staging
- Quality validation
- Production deployment

---

## Expected Outcomes

### Before Knowledge Graph
> "The Chariot in your advice position suggests willpower and focused action. The World in your outcome position shows completion and mastery. These cards say you're moving toward success."

### After Knowledge Graph
> "**Mastery Arc:** The Magician, The Chariot, and The World form a complete manifestation triad. You have the skill and resources (Magician), you're applying focused willpower (Chariot), and you're reaching complete achievement (World). This is the full arc from potential to mastery—a powerful affirmation that your sustained effort is culminating in real success."

**Impact:** Readings become more cohesive, archetypal, and profound while remaining grounded in traditional meanings.

---

## References

All four documentation files include comprehensive references to:
- Rachel Pollack (*Seventy-Eight Degrees of Wisdom*)
- Mary K. Greer (*Tarot for Your Self*, *Tarot Constellations*)
- Robert Place (*The Tarot: History, Symbolism, and Divination*)
- Sallie Nichols (*Jung and Tarot*)
- Golden Dawn esoteric correspondences
- Professional reading practice consensus

---

## Questions?

This documentation should provide everything needed to implement the Knowledge Graph system. Each file includes:
- Traditional foundation
- Complete data structure schemas
- Detection logic
- Narrative templates
- Usage guidelines
- Examples

Ready to proceed with implementation?
