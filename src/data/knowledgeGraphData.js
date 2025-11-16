// src/data/knowledgeGraphData.js
// Knowledge Graph data structures for archetypal pattern detection
// Based on traditional tarot wisdom: Pollack, Greer, Place, Golden Dawn

/**
 * THE FOOL'S JOURNEY
 * Three-act structure dividing the 22 Major Arcana into developmental stages
 * following Joseph Campbell's Hero's Journey and Jungian individuation
 */
export const FOOLS_JOURNEY = {
  initiation: {
    range: [0, 7],
    stage: 'departure',
    theme: 'Innocence, learning, establishing ego and identity',
    lifePhase: 'Childhood through early adulthood',
    psychologicalTask: 'Building ego structure, learning societal roles',
    cards: [
      { num: 0, name: 'The Fool', role: 'Innocent beginning' },
      { num: 1, name: 'The Magician', role: 'Conscious will' },
      { num: 2, name: 'The High Priestess', role: 'Unconscious knowing' },
      { num: 3, name: 'The Empress', role: 'Creative abundance' },
      { num: 4, name: 'The Emperor', role: 'Structure & authority' },
      { num: 5, name: 'The Hierophant', role: 'Tradition & teaching' },
      { num: 6, name: 'The Lovers', role: 'Choice & values' },
      { num: 7, name: 'The Chariot', role: 'Disciplined action' }
    ],
    narrative:
      'The querent is encountering foundational forces, learning who they are and what they value.',
    readingSignificance:
      'Building identity, establishing in the world, learning new skills'
  },

  integration: {
    range: [8, 14],
    stage: 'initiation',
    theme: 'Testing, sacrifice, shadow work, necessary endings',
    lifePhase: 'Midlife transitions',
    psychologicalTask: 'Shadow integration, ego transcendence, finding balance',
    cards: [
      { num: 8, name: 'Strength', role: 'Inner fortitude' },
      { num: 9, name: 'The Hermit', role: 'Solitary wisdom' },
      { num: 10, name: 'Wheel of Fortune', role: 'Cycles & fate' },
      { num: 11, name: 'Justice', role: 'Truth & balance' },
      { num: 12, name: 'The Hanged Man', role: 'Surrender' },
      { num: 13, name: 'Death', role: 'Transformation' },
      { num: 14, name: 'Temperance', role: 'Alchemy' }
    ],
    narrative:
      'The querent faces trials that demand surrender, perspective shifts, and integration of opposites.',
    readingSignificance:
      'Difficult but necessary transition, releasing control, shadow work'
  },

  culmination: {
    range: [15, 21],
    stage: 'return',
    theme: 'Shadow integration, revelation, cosmic consciousness, completion',
    lifePhase: 'Mature adulthood, elder wisdom',
    psychologicalTask:
      'Integration of the Self, transcendence, bringing wisdom to the world',
    cards: [
      { num: 15, name: 'The Devil', role: 'Shadow confrontation' },
      { num: 16, name: 'The Tower', role: 'Necessary destruction' },
      { num: 17, name: 'The Star', role: 'Hope restored' },
      { num: 18, name: 'The Moon', role: 'Illusion & intuition' },
      { num: 19, name: 'The Sun', role: 'Illumination' },
      { num: 20, name: 'Judgement', role: 'Rebirth' },
      { num: 21, name: 'The World', role: 'Integration & wholeness' }
    ],
    narrative:
      'The querent confronts deepest shadow and emerges transformed, integrating all lessons into wholeness.',
    readingSignificance:
      'Soul-level themes, completing cycles, spiritual awakening'
  }
};

/**
 * ARCHETYPAL TRIADS
 * Powerful three-card combinations forming complete narrative arcs
 * Based on sequential logic, thematic resonance, and professional reading practice
 */
export const ARCHETYPAL_TRIADS = [
  {
    id: 'death-temperance-star',
    cards: [13, 14, 17],
    names: ['Death', 'Temperance', 'The Star'],
    theme: 'Healing Arc',
    narrative: 'Ending → Alchemical integration → Renewed hope',
    description:
      'The classic healing journey: releasing what must die, integrating the lesson, emerging into restored faith.',
    strength: 'complete',
    contexts: {
      grief: 'Literal healing from loss',
      transition: 'Life changes requiring integration',
      shadow: 'Releasing old patterns, integrating new self'
    },
    partialNarrative: {
      'death-temperance': 'Transformation actively seeking balance',
      'temperance-star': 'Patient integration leading to renewal',
      'death-star':
        'Dramatic shift from ending to rebirth (skipping integration)'
    }
  },

  {
    id: 'devil-tower-sun',
    cards: [15, 16, 19],
    names: ['The Devil', 'The Tower', 'The Sun'],
    theme: 'Liberation Arc',
    narrative: 'Bondage → Rupture → Freedom',
    description:
      'Breaking free: recognizing chains, experiencing collapse, emerging into clarity and joy.',
    strength: 'complete',
    contexts: {
      addiction: 'Recovery from literal or metaphorical bondage',
      relationship: 'Leaving toxic dynamics',
      career: 'Breaking from unfulfilling work',
      spiritual: 'Freedom from limiting beliefs'
    },
    partialNarrative: {
      'devil-tower': 'Attachments meet necessary disruption',
      'tower-sun': 'Upheaval clearing the path to clarity',
      'devil-sun': 'From shadow to light (sudden liberation)'
    }
  },

  {
    id: 'hermit-hangedman-moon',
    cards: [9, 12, 18],
    names: ['The Hermit', 'The Hanged Man', 'The Moon'],
    theme: 'Inner Work Arc',
    narrative: 'Solitude → Surrender → Deep Mystery',
    description:
      'The contemplative path: withdrawing for wisdom, releasing control, diving into unconscious depths.',
    strength: 'complete',
    contexts: {
      spiritual: 'Meditation, dreamwork, shadow integration',
      therapy: 'Deep psychological processing',
      creative: 'Allowing ideas to gestate',
      grief: 'Internal mourning work'
    },
    partialNarrative: {
      'hermit-hangedman': 'Introspection leading to necessary pause',
      'hangedman-moon': 'Suspension opening to shadow realm',
      'hermit-moon': 'Solo journey into the unconscious'
    }
  },

  {
    id: 'magician-chariot-world',
    cards: [1, 7, 21],
    names: ['The Magician', 'The Chariot', 'The World'],
    theme: 'Mastery Arc',
    narrative: 'Skill → Directed action → Complete achievement',
    description:
      'The path of manifestation: marshaling resources, focused willpower, total integration.',
    strength: 'complete',
    contexts: {
      career: 'Professional mastery and achievement',
      creative: 'Completing major projects',
      personal: 'Reaching developmental milestones',
      manifestation: 'Bringing vision into reality'
    },
    partialNarrative: {
      'magician-chariot': 'Potential directed into decisive movement',
      'chariot-world': 'Determined effort reaching culmination',
      'magician-world': 'From first spark to full realization'
    }
  },

  {
    id: 'empress-lovers-hierophant',
    cards: [3, 6, 5],
    names: ['The Empress', 'The Lovers', 'The Hierophant'],
    theme: 'Relationship & Values Arc',
    narrative: 'Abundance → Choice → Commitment',
    description:
      'Examining what you value: abundance opens choices, choices require commitment to tradition or personal truth.',
    strength: 'complete',
    contexts: {
      romantic: 'From attraction to commitment',
      creative: 'From inspiration to disciplined practice',
      spiritual: 'From exploration to choosing a path',
      values: 'Clarifying what merits dedication'
    },
    partialNarrative: {
      'empress-lovers': 'Creative fertility meeting decisive choice',
      'lovers-hierophant': 'Personal values versus collective tradition',
      'empress-hierophant': 'Nurturing energy seeking formal structure'
    }
  }
];

/**
 * ARCHETYPAL DYADS
 * Extended from existing implementation in deck.js:computeRelationships()
 * Powerful two-card combinations creating synergistic meaning
 */
export const ARCHETYPAL_DYADS = [
  // Existing dyads (preserve backward compatibility)
  {
    cards: [0, 1],
    names: ['The Fool', 'The Magician'],
    theme: 'Innocent potential meeting conscious skill',
    category: 'empowerment',
    description:
      "Beginner's mind empowered by mastery. Fresh vision with the tools to manifest it.",
    narrative:
      'You have both the fresh perspective of a beginner AND the tools to manifest your vision.',
    significance: 'high'
  },
  {
    cards: [13, 17],
    names: ['Death', 'The Star'],
    theme: 'Transformation clearing into hope',
    category: 'transformation',
    description:
      'Necessary ending creating space for renewal. Grief making room for healing.',
    narrative:
      "What you're releasing is making space for renewed hope and purpose.",
    significance: 'high'
  },
  {
    cards: [16, 19],
    names: ['The Tower', 'The Sun'],
    theme: 'Upheaval revealing clarity',
    category: 'transformation',
    description:
      'Necessary destruction bringing authentic joy. Illusions shattered, truth shining through.',
    narrative:
      "What's falling apart needed to fall apart so truth and joy could emerge.",
    significance: 'high'
  },
  {
    cards: [15, 6],
    names: ['The Devil', 'The Lovers'],
    theme: 'Attachment patterns affecting choice',
    category: 'shadow-challenge',
    description:
      'Shadow bondage influencing values-based decisions. Addiction affecting relationship choices.',
    narrative:
      'Your attachment patterns are affecting your capacity to choose freely and align with true values.',
    significance: 'high'
  },
  {
    cards: [9, 2],
    names: ['The Hermit', 'The High Priestess'],
    theme: 'Solitary wisdom accessing intuition',
    category: 'wisdom-intuition',
    description:
      'Outer withdrawal revealing inner knowing. Solitude allowing the inner voice to be heard.',
    narrative:
      'Solitude creates the quiet space where deep intuitive knowing can finally be heard.',
    significance: 'medium-high'
  },

  // NEW dyads (extending the library)
  {
    cards: [12, 13],
    names: ['The Hanged Man', 'Death'],
    theme: 'Surrender enabling transformation',
    category: 'transformation',
    description:
      'Letting go making way for metamorphosis. Acceptance easing the transition.',
    narrative:
      'Your willingness to release control determines how gracefully transformation unfolds.',
    significance: 'medium-high'
  },
  {
    cards: [8, 11],
    names: ['Strength', 'Justice'],
    theme: 'Compassion balanced with accountability',
    category: 'empowerment',
    description:
      "Gentle power meeting fair judgment. Kindness that doesn't bypass accountability.",
    narrative:
      "Be both kind AND fair. Compassion doesn't mean avoiding responsibility.",
    significance: 'medium'
  },
  {
    cards: [2, 5],
    names: ['The High Priestess', 'The Hierophant'],
    theme: 'Inner knowing versus outer teaching',
    category: 'wisdom-intuition',
    description:
      'Personal intuition meeting traditional wisdom. Inner voice versus received teachings.',
    narrative:
      'Navigate where your inner knowing and traditional wisdom align or diverge.',
    significance: 'medium'
  },
  {
    cards: [18, 19],
    names: ['The Moon', 'The Sun'],
    theme: 'Mystery yielding to illumination',
    category: 'transformation',
    description:
      'Confusion clarifying into truth. Unconscious material becoming conscious.',
    narrative:
      "What's confusing now is in the process of being revealed and clarified.",
    significance: 'medium-high'
  },
  {
    cards: [15, 16],
    names: ['The Devil', 'The Tower'],
    theme: 'Bondage meeting disruption',
    category: 'shadow-challenge',
    description:
      'Attachment being forcefully broken. Liberation through crisis.',
    narrative:
      "The chains are breaking whether you're ready or not. Embrace the liberation.",
    significance: 'high'
  },
  {
    cards: [10, 20],
    names: ['Wheel of Fortune', 'Judgement'],
    theme: 'Fate meeting conscious reckoning',
    category: 'cycles-fate',
    description:
      'Karmic cycle completing, calling for integration and conscious evolution.',
    narrative:
      'A major cycle is completing; integrate the lesson and rise transformed.',
    significance: 'high'
  },
  {
    cards: [4, 3],
    names: ['The Emperor', 'The Empress'],
    theme: 'Structure and abundance in dialogue',
    category: 'power-structure',
    description:
      'Masculine structure meeting feminine flow. Discipline supporting creativity.',
    narrative: 'Honor both structure and flow, discipline and abundance.',
    significance: 'medium'
  },
  {
    cards: [5, 15],
    names: ['The Hierophant', 'The Devil'],
    theme: 'Tradition becoming restriction',
    category: 'shadow-challenge',
    description:
      'When guidance becomes bondage, when tradition restricts rather than liberates.',
    narrative:
      'Discern where traditional wisdom serves you and where it binds you.',
    significance: 'medium'
  },
  {
    cards: [17, 20],
    names: ['The Star', 'Judgement'],
    theme: 'Renewed hope calling forth rebirth',
    category: 'hope-vision',
    description:
      'Hope inspiring transformation. Vision catalyzing conscious evolution.',
    narrative: 'Renewed hope is calling you into a higher version of yourself.',
    significance: 'high'
  },
  {
    cards: [7, 21],
    names: ['The Chariot', 'The World'],
    theme: 'Determined action reaching completion',
    category: 'hope-vision',
    description:
      'Victory approaching culmination. Sustained effort bearing full fruit.',
    narrative:
      'Your focused effort is leading to complete achievement and mastery.',
    significance: 'high'
  }
];

/**
 * SUIT PROGRESSIONS
 * Minor Arcana developmental arcs within each suit (Aces – Tens)
 * Structured in three stages per suit: beginning, challenge, mastery
 */
export const SUIT_PROGRESSIONS = {
  Wands: {
    element: 'Fire',
    domain: 'Creativity, passion, will, enterprise',

    beginning: {
      ranks: [1, 2, 3],
      theme: 'Ignition',
      narrative:
        'Ace: Pure creative spark → Two: Planning & vision → Three: Confident expansion',
      readingSignificance:
        "You're in the ignition phase of a creative or professional endeavor—high enthusiasm, planning, early momentum.",
      cards: [
        { rank: 1, name: 'Ace of Wands', role: 'Inspired beginning' },
        { rank: 2, name: 'Two of Wands', role: 'Strategic planning' },
        { rank: 3, name: 'Three of Wands', role: 'Confident expansion' }
      ]
    },

    challenge: {
      ranks: [4, 5, 6, 7],
      theme: 'Testing the Fire',
      narrative:
        'Four: Celebration → Five: Competition → Six: Victory → Seven: Defensive perseverance',
      readingSignificance:
        "You're in the testing phase—navigating competition, earning recognition, and defending your position.",
      cards: [
        { rank: 4, name: 'Four of Wands', role: 'Joyful milestone' },
        { rank: 5, name: 'Five of Wands', role: 'Conflict & competition' },
        { rank: 6, name: 'Six of Wands', role: 'Public recognition' },
        { rank: 7, name: 'Seven of Wands', role: 'Standing your ground' }
      ]
    },

    mastery: {
      ranks: [8, 9, 10],
      theme: 'Culmination',
      narrative:
        'Eight: Swift momentum → Nine: Guarded resilience → Ten: Overburdened completion',
      readingSignificance:
        "You're in the culmination phase—things moving fast, resilience tested, burden of success felt. Consider delegating or resting after completion.",
      cards: [
        { rank: 8, name: 'Eight of Wands', role: 'Rapid progress' },
        { rank: 9, name: 'Nine of Wands', role: 'Wounded but standing' },
        { rank: 10, name: 'Ten of Wands', role: 'Carrying the full weight' }
      ],
      shadow: 'Culmination often carries burden or burnout'
    }
  },

  Cups: {
    element: 'Water',
    domain: 'Emotions, relationships, intuition, love',

    beginning: {
      ranks: [1, 2, 3],
      theme: 'Emotional Opening',
      narrative:
        'Ace: Overflowing heart → Two: Partnership & reciprocity → Three: Celebration & friendship',
      readingSignificance:
        "You're in the emotional opening phase—love, connection, and celebration are abundant.",
      cards: [
        { rank: 1, name: 'Ace of Cups', role: 'Overflowing heart' },
        { rank: 2, name: 'Two of Cups', role: 'Mutual devotion' },
        { rank: 3, name: 'Three of Cups', role: 'Joyful community' }
      ]
    },

    challenge: {
      ranks: [4, 5, 6, 7],
      theme: 'Emotional Complexity',
      narrative:
        'Four: Apathy → Five: Loss & grief → Six: Nostalgia → Seven: Overwhelming options',
      readingSignificance:
        "You're in the emotional complexity phase—processing disappointment, grief, or confusion about desires. Discernment needed.",
      cards: [
        { rank: 4, name: 'Four of Cups', role: 'Contemplative withdrawal' },
        { rank: 5, name: 'Five of Cups', role: 'Mourning what is lost' },
        { rank: 6, name: 'Six of Cups', role: 'Sweet memory' },
        { rank: 7, name: 'Seven of Cups', role: 'Fantasy & illusion' }
      ]
    },

    mastery: {
      ranks: [8, 9, 10],
      theme: 'Emotional Maturity',
      narrative: 'Eight: Walking away → Nine: Wish fulfillment → Ten: Blessed union',
      readingSignificance:
        "You're in the emotional maturity phase—making conscious choices to release or embrace, finding authentic fulfillment.",
      cards: [
        { rank: 8, name: 'Eight of Cups', role: 'Conscious release' },
        { rank: 9, name: 'Nine of Cups', role: 'Contentment achieved' },
        { rank: 10, name: 'Ten of Cups', role: 'Blessed union' }
      ],
      light: 'Culmination is deeply fulfilling when authentic'
    }
  },

  Swords: {
    element: 'Air',
    domain: 'Thought, communication, truth, conflict',

    beginning: {
      ranks: [1, 2, 3],
      theme: 'Mental Clarity',
      narrative:
        'Ace: Breakthrough insight → Two: Difficult choice → Three: Heartbreak',
      readingSignificance:
        "You're in the mental clarity phase—truth is emerging, choices are hard, and grief may be necessary. Don't bypass the pain.",
      cards: [
        { rank: 1, name: 'Ace of Swords', role: 'Cutting truth' },
        { rank: 2, name: 'Two of Swords', role: 'Stalemate' },
        { rank: 3, name: 'Three of Swords', role: 'Necessary grief' }
      ]
    },

    challenge: {
      ranks: [4, 5, 6, 7],
      theme: 'Mental Struggle',
      narrative:
        'Four: Rest → Five: Hollow victory → Six: Transition → Seven: Strategy',
      readingSignificance:
        "You're in the mental struggle phase—resting, fighting, transitioning, strategizing. Choose peace over hollow victory.",
      cards: [
        { rank: 4, name: 'Four of Swords', role: 'Contemplative pause' },
        { rank: 5, name: 'Five of Swords', role: 'Pyrrhic win' },
        { rank: 6, name: 'Six of Swords', role: 'Moving toward calm' },
        { rank: 7, name: 'Seven of Swords', role: 'Cunning or theft' }
      ]
    },

    mastery: {
      ranks: [8, 9, 10],
      theme: 'Mental Crisis & Liberation',
      narrative:
        'Eight: Self-imprisonment → Nine: Anxiety → Ten: Rock bottom (then dawn)',
      readingSignificance:
        "You're in the mental crisis phase—feeling trapped, anxious, or hitting bottom. But Swords' culmination promises breakthrough after darkness. The dawn is coming.",
      cards: [
        { rank: 8, name: 'Eight of Swords', role: 'Bound by thought' },
        { rank: 9, name: 'Nine of Swords', role: 'Anguish' },
        { rank: 10, name: 'Ten of Swords', role: 'Painful ending, daybreak coming' }
      ],
      shadow: 'Crisis before breakthrough',
      light: 'The worst is over; dawn is promised'
    }
  },

  Pentacles: {
    element: 'Earth',
    domain: 'Material, body, resources, craft, security',

    beginning: {
      ranks: [1, 2, 3],
      theme: 'Material Foundation',
      narrative:
        'Ace: Seed of prosperity → Two: Juggling resources → Three: Skilled collaboration',
      readingSignificance:
        "You're in the material foundation phase—new opportunities, balancing demands, building expertise through collaboration.",
      cards: [
        { rank: 1, name: 'Ace of Pentacles', role: 'Seed of prosperity' },
        { rank: 2, name: 'Two of Pentacles', role: 'Adaptive balance' },
        { rank: 3, name: 'Three of Pentacles', role: 'Recognized expertise' }
      ]
    },

    challenge: {
      ranks: [4, 5, 6, 7],
      theme: 'Resource Management',
      narrative:
        'Four: Holding tight → Five: Hardship → Six: Generosity → Seven: Patient assessment',
      readingSignificance:
        "You're in the resource management phase—navigating scarcity, learning generosity, assessing whether effort is paying off.",
      cards: [
        { rank: 4, name: 'Four of Pentacles', role: 'Security or greed' },
        { rank: 5, name: 'Five of Pentacles', role: 'Material/spiritual poverty' },
        { rank: 6, name: 'Six of Pentacles', role: 'Balanced giving' },
        { rank: 7, name: 'Seven of Pentacles', role: 'Evaluating progress' }
      ]
    },

    mastery: {
      ranks: [8, 9, 10],
      theme: 'Material Mastery',
      narrative:
        'Eight: Diligent craftsmanship → Nine: Self-sufficiency → Ten: Lasting legacy',
      readingSignificance:
        "You're in the material mastery phase—dedicated practice, self-sufficiency achieved, building legacy.",
      cards: [
        { rank: 8, name: 'Eight of Pentacles', role: 'Dedicated practice' },
        { rank: 9, name: 'Nine of Pentacles', role: 'Refined independence' },
        { rank: 10, name: 'Ten of Pentacles', role: 'Generational wealth' }
      ],
      light: 'Stable, lasting prosperity and legacy'
    }
  }
};
