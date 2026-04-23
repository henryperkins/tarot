# Archetypal Dyads - Data Structure Specification

Type: spec
Status: active reference
Last reviewed: 2026-04-23

## Overview

Archetypal Dyads are powerful two-card combinations that create synergistic meaning beyond their individual interpretations. When these specific pairs appear together in a spread, they tell a recognizable story or highlight a particular dynamic that professional readers consistently observe.

## Current Implementation

The codebase already detects 5 dyads in `src/lib/deck.js:computeRelationships()`:

```javascript
const pairings = [
  { cards: ['The Fool', 'The Magician'], desc: 'New beginnings (Fool) empowered by manifesting ability (Magician).' },
  { cards: ['Death', 'The Star'], desc: 'Transformation (Death) leading to hope and renewal (Star).' },
  { cards: ['The Tower', 'The Sun'], desc: 'Upheaval (Tower) clearing the path to joy and clarity (Sun).' },
  { cards: ['The Devil', 'The Lovers'], desc: 'Attachment patterns (Devil) affecting relationship choices (Lovers).' },
  { cards: ['The Hermit', 'The High Priestess'], desc: 'Deep introspection (Hermit) accessing inner wisdom (High Priestess).' }
];
```

This document extends that foundation with richer metadata and additional dyads.

---

## Design Principles

### What Makes a Valid Dyad

1. **Synergistic Meaning:** The pair together means more than the sum of individual cards
2. **Professional Recognition:** Experienced readers recognize this combination as significant
3. **Clear Dynamic:** The relationship between the cards is intuitive and meaningful
4. **Flexible Context:** Works across different spread positions and question types

### Dyad Categories

**Transformation Dyads:** Cards that mark shift from one state to another
**Amplification Dyads:** Cards that intensify each other's energy
**Tension Dyads:** Cards that create productive friction
**Support Dyads:** Cards that harmonize and strengthen
**Caution Dyads:** Cards that signal challenge or warning

---

## Extended Dyad Library

### **Category: Transformation**

#### 1. Death + The Star ⭐ (Existing)
**Cards:** Death (13) + The Star (17)
**Theme:** Transformation clearing into hope
**Dynamic:** "The ending creates space for renewal"

**Description:**
Death marks a necessary ending—something must be released. The Star is renewed hope, inspiration, and spiritual healing that becomes possible after the release. Together they say: "What you're grieving is making room for something better."

**Reading Context:**
- Grief work that leads to healing
- Career change opening new possibilities
- Relationship ending clearing space for growth
- Shadow work revealing light

**Narrative Template:**
> "Death and The Star together form a powerful dyad: {Death context} is clearing the ground for {Star context} to emerge. The ending isn't empty—it's making space for renewed hope and purpose."

**Significance:** High (transformation + renewal)

---

#### 2. The Tower + The Sun ⭐ (Existing)
**Cards:** The Tower (16) + The Sun (19)
**Theme:** Upheaval revealing clarity
**Dynamic:** "Necessary destruction brings authentic joy"

**Description:**
The Tower's upheaval—sudden, uncomfortable, unavoidable—clears away illusions and false structures. The Sun is the clarity, authenticity, and joy that shine through once the false stuff collapses. Together: "What's falling apart needed to fall apart so truth could emerge."

**Reading Context:**
- Sudden life changes revealing what truly matters
- Illusions shattered, authentic self reclaimed
- Crisis leading to clarity
- Liberation through disruption

**Narrative Template:**
> "The Tower and The Sun create a liberation dyad: {Tower context} is dismantling what was false, allowing {Sun context}—your authentic self and genuine joy—to finally shine without obstruction."

**Significance:** High (crisis + breakthrough)

---

#### 3. The Hanged Man + Death (NEW)
**Cards:** The Hanged Man (12) + Death (13)
**Theme:** Surrender enabling transformation
**Dynamic:** "Letting go makes way for metamorphosis"

**Description:**
The Hanged Man asks you to surrender, pause, release control. Death is the transformation that becomes possible once you stop fighting it. Together: "Your willingness to let go determines how gracefully transformation unfolds."

**Reading Context:**
- Accepting change rather than resisting
- Spiritual surrender preceding rebirth
- Releasing attachment to outcomes
- Trusting the process

**Narrative Template:**
> "The Hanged Man and Death form a surrender-transformation dyad: {Hanged Man context} prepares the way for {Death context}. Your capacity to release control eases the metamorphosis ahead."

**Significance:** Medium-High (transition dyad)

---

### **Category: Empowerment**

#### 4. The Fool + The Magician ⭐ (Existing)
**Cards:** The Fool (0) + The Magician (1)
**Theme:** Innocent potential meeting conscious skill
**Dynamic:** "Beginner's mind empowered by mastery"

**Description:**
The Fool is pure potential, innocence, spontaneous trust. The Magician is "as above, so below"—conscious manifestation, skill, resourcefulness. Together: "You have both the fresh perspective of a beginner AND the tools to manifest your vision."

**Reading Context:**
- Starting something new with both innocence and skill
- Combining creativity with technique
- Beginner's luck meeting practiced ability
- Fresh start with resources ready

**Narrative Template:**
> "The Fool and The Magician unite innocence with mastery: {Fool context} brings fresh vision while {Magician context} provides the skill to manifest it. You're both beginner and adept."

**Significance:** High (initiation + manifestation)

---

#### 5. Strength + Justice (NEW)
**Cards:** Strength (8) + Justice (11)
**Theme:** Compassion balanced with accountability
**Dynamic:** "Gentle power meets fair judgment"

**Description:**
Strength is compassionate courage, taming the inner beast with love rather than force. Justice is truth, fairness, accountability. Together: "Be both kind AND fair. Compassion doesn't mean avoiding accountability."

**Reading Context:**
- Difficult conversations requiring both kindness and honesty
- Self-compassion alongside personal responsibility
- Leadership that balances care with clear boundaries
- Forgiveness that doesn't bypass justice

**Narrative Template:**
> "Strength and Justice create a balanced power dyad: {Strength context} ensures compassion while {Justice context} maintains accountability. Neither overwhelms the other; both are required."

**Significance:** Medium (balanced approach)

---

### **Category: Wisdom & Intuition**

#### 6. The Hermit + The High Priestess ⭐ (Existing)
**Cards:** The Hermit (9) + The High Priestess (2)
**Theme:** Solitary wisdom accessing deep intuition
**Dynamic:** "Outer withdrawal revealing inner knowing"

**Description:**
The Hermit withdraws from the world to seek wisdom through reflection and study. The High Priestess is the deep intuitive knowing, the unconscious wisdom that speaks when the mind is quiet. Together: "Solitude allows you to hear the voice within."

**Reading Context:**
- Meditation/contemplative practice
- Trusting intuition over external advice
- Inner guidance through withdrawal
- Shadow work in solitude

**Narrative Template:**
> "The Hermit and The High Priestess form a wisdom dyad: {Hermit context} creates the quiet space where {High Priestess context}—deep intuitive knowing—can finally be heard."

**Significance:** Medium-High (inner wisdom)

---

#### 7. The High Priestess + The Hierophant (NEW)
**Cards:** The High Priestess (2) + The Hierophant (5)
**Theme:** Inner knowing versus outer teaching
**Dynamic:** "Personal intuition meets traditional wisdom"

**Description:**
The High Priestess is inner knowing, mystery, the wisdom that comes from within. The Hierophant is external teaching, tradition, established doctrine. Together: "Which do you trust more—your inner voice or the received wisdom? Can you honor both?"

**Reading Context:**
- Choosing between personal path and traditional expectations
- Integrating intuition with spiritual teachings
- Honoring inner knowing while respecting tradition
- Finding your own way within or beyond formal paths

**Narrative Template:**
> "The High Priestess and The Hierophant create a wisdom-tension dyad: {High Priestess context} speaks from within while {Hierophant context} speaks from tradition. You're navigating where these two sources align or diverge."

**Significance:** Medium (choice between paths)

---

### **Category: Challenge & Shadow**

#### 8. The Devil + The Lovers ⭐ (Existing)
**Cards:** The Devil (15) + The Lovers (6)
**Theme:** Attachment patterns affecting choice
**Dynamic:** "Shadow bondage influencing values alignment"

**Description:**
The Devil is attachment, addiction, unhealthy bondage, shadow. The Lovers is values-based choice, alignment, relationship. Together: "Your attachment patterns (Devil) are affecting the choices you make (Lovers). Can you choose from freedom or are you choosing from bondage?"

**Reading Context:**
- Relationship choices influenced by unhealed wounds
- Codependency versus healthy partnership
- Addiction affecting decision-making
- Shadow work around intimacy

**Narrative Template:**
> "The Devil and The Lovers form a shadow-choice dyad: {Devil context} reveals attachment patterns that are influencing {Lovers context}—your capacity to choose freely and align with true values."

**Significance:** High (shadow work critical)

---

#### 9. The Moon + The Sun (NEW)
**Cards:** The Moon (18) + The Sun (19)
**Theme:** Mystery yielding to illumination
**Dynamic:** "Confusion clarifying into truth"

**Description:**
The Moon is illusion, confusion, the unconscious, things not yet clear. The Sun is radiant clarity, truth revealed, everything illuminated. Together: "What's confusing now will become clear. The fog is lifting."

**Reading Context:**
- Confusion transitioning to clarity
- Unconscious material becoming conscious
- Deception giving way to truth
- Trust the process of revelation

**Narrative Template:**
> "The Moon and The Sun form a clarity-emergence dyad: {Moon context} holds mystery and confusion, while {Sun context} promises illumination. What's unclear now is in the process of being revealed."

**Significance:** Medium-High (clarity coming)

---

#### 10. The Devil + The Tower (NEW)
**Cards:** The Devil (15) + The Tower (16)
**Theme:** Bondage meeting disruption
**Dynamic:** "What you're attached to is being shaken"

**Description:**
The Devil is what binds you—attachment, addiction, limiting beliefs. The Tower is sudden disruption, collapse, necessary destruction. Together: "The chains are breaking whether you're ready or not. What you've been clinging to is falling apart."

**Reading Context:**
- Forced liberation from addiction
- Toxic patterns being disrupted
- Shadow work initiated by crisis
- Attachment being challenged

**Narrative Template:**
> "The Devil and The Tower create a liberation-through-crisis dyad: {Devil context} shows what you're bound to, while {Tower context} is the disruptive force breaking those chains. Embrace the liberation even if it's uncomfortable."

**Significance:** High (crisis + opportunity)

---

### **Category: Cycles & Fate**

#### 11. Wheel of Fortune + Judgement (NEW)
**Cards:** Wheel of Fortune (10) + Judgement (20)
**Theme:** Fate meeting conscious reckoning
**Dynamic:** "Destiny calling you to account"

**Description:**
The Wheel is cycles, fate, karma, turning points. Judgement is awakening, reckoning, rebirth, the call to rise. Together: "A karmic cycle is completing, and you're being called to integrate the lesson and step into a new chapter consciously."

**Reading Context:**
- Major life cycle completing
- Karmic lesson ready for integration
- Spiritual awakening at turning point
- Conscious evolution

**Narrative Template:**
> "The Wheel of Fortune and Judgement form a karmic-awakening dyad: {Wheel context} marks a turning point where {Judgement context} calls you to integrate the lesson and rise transformed."

**Significance:** High (major transition)

---

### **Category: Power & Structure**

#### 12. The Emperor + The Empress (NEW)
**Cards:** The Emperor (4) + The Empress (3)
**Theme:** Structure and abundance in dialogue
**Dynamic:** "Masculine structure meets feminine flow"

**Description:**
The Emperor is structure, authority, boundaries, discipline, the masculine principle. The Empress is abundance, nurture, creativity, flow, the feminine principle. Together: "Both energies are needed. Can you build structure without rigidity? Flow without chaos?"

**Reading Context:**
- Balancing work and rest
- Integrating discipline with creativity
- Masculine-feminine balance
- Structure supporting growth

**Narrative Template:**
> "The Emperor and The Empress form a balance dyad: {Emperor context} provides structure and boundaries while {Empress context} brings abundance and flow. You're learning to honor both."

**Significance:** Medium (integration)

---

#### 13. The Hierophant + The Devil (NEW)
**Cards:** The Hierophant (5) + The Devil (15)
**Theme:** Tradition becoming restriction
**Dynamic:** "When guidance becomes bondage"

**Description:**
The Hierophant is tradition, teaching, spiritual authority, conformity. The Devil is bondage, restriction, unhealthy attachment. Together: "When does helpful structure become limiting dogma? Are traditions serving you or binding you?"

**Reading Context:**
- Religious trauma or spiritual restriction
- Outgrowing traditional teachings
- Dogma versus personal truth
- Breaking from limiting traditions

**Narrative Template:**
> "The Hierophant and The Devil create a tradition-bondage dyad: {Hierophant context} shows where traditional wisdom may have become {Devil context}—restricting rather than guiding. Discernment is required."

**Significance:** Medium (caution/shadow)

---

### **Category: Hope & Vision**

#### 14. The Star + Judgement (NEW)
**Cards:** The Star (17) + Judgement (20)
**Theme:** Renewed hope calling forth rebirth
**Dynamic:** "Hope inspiring transformation"

**Description:**
The Star is hope restored, inspiration, spiritual healing, vision. Judgement is rebirth, awakening, the call to rise. Together: "Renewed hope is calling you into a higher version of yourself. The vision is catalyzing transformation."

**Reading Context:**
- Hope after darkness inspiring renewal
- Vision leading to conscious evolution
- Healing enabling rebirth
- Inspiration catalyzing change

**Narrative Template:**
> "The Star and Judgement form a rebirth dyad: {Star context} renews hope and vision, which in turn calls forth {Judgement context}—conscious rebirth into a new chapter."

**Significance:** High (positive transformation)

---

#### 15. The Chariot + The World (NEW)
**Cards:** The Chariot (7) + The World (21)
**Theme:** Determined action reaching completion
**Dynamic:** "Victory approaching culmination"

**Description:**
The Chariot is willpower, disciplined action, moving forward with focus. The World is completion, mastery, achievement, integration. Together: "Your focused effort is paying off. Victory is not just near—it's about to become complete mastery."

**Reading Context:**
- Projects nearing completion
- Goals within reach
- Sustained effort bearing fruit
- Success and integration

**Narrative Template:**
> "The Chariot and The World form a victory-completion dyad: {Chariot context} shows determined effort that is leading to {World context}—complete achievement and integration."

**Significance:** High (success imminent)

---

## Data Structure Schema

```javascript
export const ARCHETYPAL_DYADS = [
  // Existing dyads (preserve backward compatibility)
  {
    cards: [0, 1],
    names: ['The Fool', 'The Magician'],
    theme: 'Innocent potential meeting conscious skill',
    category: 'empowerment',
    description: 'Beginner\'s mind empowered by mastery. Fresh vision with the tools to manifest it.',
    narrative: 'You have both the fresh perspective of a beginner AND the tools to manifest your vision.',
    significance: 'high'
  },
  {
    cards: [13, 17],
    names: ['Death', 'The Star'],
    theme: 'Transformation clearing into hope',
    category: 'transformation',
    description: 'Necessary ending creating space for renewal. Grief making room for healing.',
    narrative: 'What you\'re releasing is making space for renewed hope and purpose.',
    significance: 'high'
  },
  {
    cards: [16, 19],
    names: ['The Tower', 'The Sun'],
    theme: 'Upheaval revealing clarity',
    category: 'transformation',
    description: 'Necessary destruction bringing authentic joy. Illusions shattered, truth shining through.',
    narrative: 'What\'s falling apart needed to fall apart so truth and joy could emerge.',
    significance: 'high'
  },
  {
    cards: [15, 6],
    names: ['The Devil', 'The Lovers'],
    theme: 'Attachment patterns affecting choice',
    category: 'shadow-challenge',
    description: 'Shadow bondage influencing values-based decisions. Addiction affecting relationship choices.',
    narrative: 'Your attachment patterns are affecting your capacity to choose freely and align with true values.',
    significance: 'high'
  },
  {
    cards: [9, 2],
    names: ['The Hermit', 'The High Priestess'],
    theme: 'Solitary wisdom accessing intuition',
    category: 'wisdom-intuition',
    description: 'Outer withdrawal revealing inner knowing. Solitude allowing the inner voice to be heard.',
    narrative: 'Solitude creates the quiet space where deep intuitive knowing can finally be heard.',
    significance: 'medium-high'
  },

  // NEW dyads (extending the library)
  {
    cards: [12, 13],
    names: ['The Hanged Man', 'Death'],
    theme: 'Surrender enabling transformation',
    category: 'transformation',
    description: 'Letting go making way for metamorphosis. Acceptance easing the transition.',
    narrative: 'Your willingness to release control determines how gracefully transformation unfolds.',
    significance: 'medium-high'
  },
  {
    cards: [8, 11],
    names: ['Strength', 'Justice'],
    theme: 'Compassion balanced with accountability',
    category: 'empowerment',
    description: 'Gentle power meeting fair judgment. Kindness that doesn\'t bypass accountability.',
    narrative: 'Be both kind AND fair. Compassion doesn\'t mean avoiding responsibility.',
    significance: 'medium'
  },
  {
    cards: [2, 5],
    names: ['The High Priestess', 'The Hierophant'],
    theme: 'Inner knowing versus outer teaching',
    category: 'wisdom-intuition',
    description: 'Personal intuition meeting traditional wisdom. Inner voice versus received teachings.',
    narrative: 'Navigate where your inner knowing and traditional wisdom align or diverge.',
    significance: 'medium'
  },
  {
    cards: [18, 19],
    names: ['The Moon', 'The Sun'],
    theme: 'Mystery yielding to illumination',
    category: 'transformation',
    description: 'Confusion clarifying into truth. Unconscious material becoming conscious.',
    narrative: 'What\'s confusing now is in the process of being revealed and clarified.',
    significance: 'medium-high'
  },
  {
    cards: [15, 16],
    names: ['The Devil', 'The Tower'],
    theme: 'Bondage meeting disruption',
    category: 'shadow-challenge',
    description: 'Attachment being forcefully broken. Liberation through crisis.',
    narrative: 'The chains are breaking whether you\'re ready or not. Embrace the liberation.',
    significance: 'high'
  },
  {
    cards: [10, 20],
    names: ['Wheel of Fortune', 'Judgement'],
    theme: 'Fate meeting conscious reckoning',
    category: 'cycles-fate',
    description: 'Karmic cycle completing, calling for integration and conscious evolution.',
    narrative: 'A major cycle is completing; integrate the lesson and rise transformed.',
    significance: 'high'
  },
  {
    cards: [4, 3],
    names: ['The Emperor', 'The Empress'],
    theme: 'Structure and abundance in dialogue',
    category: 'power-structure',
    description: 'Masculine structure meeting feminine flow. Discipline supporting creativity.',
    narrative: 'Honor both structure and flow, discipline and abundance.',
    significance: 'medium'
  },
  {
    cards: [5, 15],
    names: ['The Hierophant', 'The Devil'],
    theme: 'Tradition becoming restriction',
    category: 'shadow-challenge',
    description: 'When guidance becomes bondage, when tradition restricts rather than liberates.',
    narrative: 'Discern where traditional wisdom serves you and where it binds you.',
    significance: 'medium'
  },
  {
    cards: [17, 20],
    names: ['The Star', 'Judgement'],
    theme: 'Renewed hope calling forth rebirth',
    category: 'hope-vision',
    description: 'Hope inspiring transformation. Vision catalyzing conscious evolution.',
    narrative: 'Renewed hope is calling you into a higher version of yourself.',
    significance: 'high'
  },
  {
    cards: [7, 21],
    names: ['The Chariot', 'The World'],
    theme: 'Determined action reaching completion',
    category: 'hope-vision',
    description: 'Victory approaching culmination. Sustained effort bearing full fruit.',
    narrative: 'Your focused effort is leading to complete achievement and mastery.',
    significance: 'high'
  }
];
```

## Detection Logic

```javascript
function detectArchetypalDyads(cards) {
  const numbers = cards
    .filter(c => c.number >= 0 && c.number <= 21)
    .map(c => c.number);

  const detected = [];

  ARCHETYPAL_DYADS.forEach(dyad => {
    if (dyad.cards.every(num => numbers.includes(num))) {
      detected.push({
        cards: dyad.cards,
        names: dyad.names,
        theme: dyad.theme,
        category: dyad.category,
        description: dyad.description,
        narrative: dyad.narrative,
        significance: dyad.significance
      });
    }
  });

  return detected;
}
```

## Usage Guidelines

### Priority in Readings

1. **Complete Triads** (highest)
2. **High-significance dyads** (Death+Star, Tower+Sun, Fool+Magician, Devil+Lovers)
3. **Medium-high dyads**
4. **Medium dyads** (mention if space permits)

### Narrative Integration

**Strong Dyad (high significance):**
> "{Card1} and {Card2} create a powerful {category} dyad: {narrative template with card contexts}."

**Supporting Dyad (medium significance):**
> "Note also {Card1} and {Card2}: {brief narrative}."

### Don't Overwhelm

- Maximum 2-3 dyad mentions per reading
- Prioritize complete triads over dyads
- Choose dyads most relevant to the question

---

## References

- Greer, Mary K. *Tarot Constellations*. New Page Books, 2008.
- Fairfield, Gail. *Choice Centered Tarot*. Red Wheel/Weiser, 1997.
- Professional reader practice (common combinations)
