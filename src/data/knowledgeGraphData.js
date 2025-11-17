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

/**
 * COURT FAMILY PATTERNS
 * Highlights when multiple court cards from the same suit appear, indicating lineage dynamics.
 */
export const COURT_FAMILY_PATTERNS = {
  Wands: {
    element: 'Fire',
    theme: 'Creative lineage and torch-passing leadership',
    duoNarrative:
      'Two Wands court cards show creative mentorship—one figure fuels bold action while another shapes direction.',
    trioNarrative:
      'Three or more Wands courts form a fire council handing the torch responsibly across experience levels.',
    deckNotes: {
      'thoth-a1': 'Princess sparks, Prince mobilizes, Queen magnetizes, Knight broadcasts the final blaze.',
      'marseille-classic': 'Valet and Chevalier labor in the field while Reine and Roi codify how the flame is used.'
    }
  },
  Cups: {
    element: 'Water',
    theme: 'Emotional lineage, family systems, and care work',
    duoNarrative:
      'Two Cups court cards reflect emotional mirroring—caregivers trading notes about vulnerability and trust.',
    trioNarrative:
      'Three or more Cups courts indicate a full healing lineage tending to ancestral feelings and relationship repair.',
    deckNotes: {
      'thoth-a1': 'Princess opens the heart, Prince pursues devotion, Queen holds sanctuary, Knight blesses the waters.',
      'marseille-classic': 'Valet and Chevalier carry news of the heart while Reine and Roi tend the household bonds.'
    }
  },
  Swords: {
    element: 'Air',
    theme: 'Strategic councils, truth-telling, and boundary work',
    duoNarrative:
      'Two Swords court cards expose a critical dialogue where intellect meets decisive motion.',
    trioNarrative:
      'Three or more Swords courts activate a strategic tribunal balancing honesty, critique, and decisive action.',
    deckNotes: {
      'thoth-a1': 'Princess gathers data, Prince advances the plan, Queen shapes discourse, Knight delivers the verdict.',
      'marseille-classic': 'Valet scouts, Chevalier confronts, Reine deliberates, Roi codifies the law.'
    }
  },
  Pentacles: {
    element: 'Earth',
    theme: 'Legacy building, stewardship, and material mentorship',
    duoNarrative:
      'Two Pentacles court cards highlight pragmatic mentorship around resources, body wisdom, or business.',
    trioNarrative:
      'Three or more Pentacles courts reveal a full stewardship lineage tending to land, labor, and legacy.',
    deckNotes: {
      'thoth-a1': 'Princess tends the seed, Prince engineers systems, Queen nourishes, Knight ensures lasting structure.',
      'marseille-classic': 'Valet and Chevalier manage the craft while Reine and Roi formalize the guild legacy.'
    }
  }
};

/**
 * THOTH MINOR ARCANA TITLES
 * Crowley/Harris epithets for pip cards with decan assignments
 */
export const THOTH_MINOR_TITLES = {
  'Ace of Wands': { suit: 'Wands', rank: 1, title: 'Root of the Powers of Fire', astrology: 'Pure Fire', description: 'Primordial creative spark—the seed of will and spiritual fire.' },

  'Two of Wands': { suit: 'Wands', rank: 2, title: 'Dominion', astrology: 'Mars in Aries', description: 'Commanding new territory and asserting will with precision.' },
  'Three of Wands': { suit: 'Wands', rank: 3, title: 'Virtue', astrology: 'Sun in Aries', description: 'Radiant integrity that uplifts collaborators and projects.' },
  'Four of Wands': { suit: 'Wands', rank: 4, title: 'Completion', astrology: 'Venus in Aries', description: 'Stabilizing achievements through shared celebration and artistry.' },
  'Five of Wands': { suit: 'Wands', rank: 5, title: 'Strife', astrology: 'Saturn in Leo', description: 'Creative friction forcing refinement of ego and ambition.' },
  'Six of Wands': { suit: 'Wands', rank: 6, title: 'Victory', astrology: 'Jupiter in Leo', description: 'Momentum gathered through wholehearted leadership and recognition.' },
  'Seven of Wands': { suit: 'Wands', rank: 7, title: 'Valour', astrology: 'Mars in Leo', description: 'Courageous stand for truth even when odds are overwhelming.' },
  'Eight of Wands': { suit: 'Wands', rank: 8, title: 'Swiftness', astrology: 'Mercury in Sagittarius', description: 'Rapid downloads, messages, and arrows of intention in flight.' },
  'Nine of Wands': { suit: 'Wands', rank: 9, title: 'Strength', astrology: 'Moon in Sagittarius', description: 'Spiritual stamina—reserves of will gathered through discipline.' },
  'Ten of Wands': { suit: 'Wands', rank: 10, title: 'Oppression', astrology: 'Saturn in Sagittarius', description: 'Burnout warning when passion is trapped in rigid obligation.' },

  'Ace of Cups': { suit: 'Cups', rank: 1, title: 'Root of the Powers of Water', astrology: 'Pure Water', description: 'Source spring of feeling—raw devotion, empathy, and heart-opening.' },

  'Two of Cups': { suit: 'Cups', rank: 2, title: 'Love', astrology: 'Venus in Cancer', description: 'Tender reciprocity and devotion born of emotional safety.' },
  'Three of Cups': { suit: 'Cups', rank: 3, title: 'Abundance', astrology: 'Mercury in Cancer', description: 'Overflow of feeling, creative bonding, communal nourishment.' },
  'Four of Cups': { suit: 'Cups', rank: 4, title: 'Luxury', astrology: 'Moon in Cancer', description: 'Soft indulgence asking for recalibration toward heartfelt purpose.' },
  'Five of Cups': { suit: 'Cups', rank: 5, title: 'Disappointment', astrology: 'Mars in Scorpio', description: 'Emotional expectations dissolving so deeper desire can surface.' },
  'Six of Cups': { suit: 'Cups', rank: 6, title: 'Pleasure', astrology: 'Sun in Scorpio', description: 'Sensual, memory-rich joy that heals through presence and play.' },
  'Seven of Cups': { suit: 'Cups', rank: 7, title: 'Debauch', astrology: 'Venus in Scorpio', description: 'Overindulgence or glamour that muddies intuition and vitality.' },
  'Eight of Cups': { suit: 'Cups', rank: 8, title: 'Indolence', astrology: 'Saturn in Pisces', description: 'Energetic leak—fatigue from clinging to a dream past its ripeness.' },
  'Nine of Cups': { suit: 'Cups', rank: 9, title: 'Happiness', astrology: 'Jupiter in Pisces', description: 'Spiritual contentment, devotion, and gratitude refilling the well.' },
  'Ten of Cups': { suit: 'Cups', rank: 10, title: 'Satiety', astrology: 'Mars in Pisces', description: 'Emotional saturation prompting surrender and compassionate release.' },

  'Ace of Swords': { suit: 'Swords', rank: 1, title: 'Root of the Powers of Air', astrology: 'Pure Air', description: 'First flash of insight—razor-sharp clarity cutting through confusion.' },

  'Two of Swords': { suit: 'Swords', rank: 2, title: 'Peace', astrology: 'Moon in Libra', description: 'Ceasefire energy—mental clarity through balancing opposites.' },
  'Three of Swords': { suit: 'Swords', rank: 3, title: 'Sorrow', astrology: 'Saturn in Libra', description: 'Sacred grief and necessary reckoning with piercing truths.' },
  'Four of Swords': { suit: 'Swords', rank: 4, title: 'Truce', astrology: 'Jupiter in Libra', description: 'Pause and recovery so mind and body can integrate the lesson.' },
  'Five of Swords': { suit: 'Swords', rank: 5, title: 'Defeat', astrology: 'Venus in Aquarius', description: 'Self-sabotage or pride blocks inviting a new mental strategy.' },
  'Six of Swords': { suit: 'Swords', rank: 6, title: 'Science', astrology: 'Mercury in Aquarius', description: 'Elegant solutions and innovation through clear thinking.' },
  'Seven of Swords': { suit: 'Swords', rank: 7, title: 'Futility', astrology: 'Moon in Aquarius', description: 'Fragmented efforts and leaky focus demanding prioritization.' },
  'Eight of Swords': { suit: 'Swords', rank: 8, title: 'Interference', astrology: 'Jupiter in Gemini', description: 'Mental clutter, competing inputs, and crossed signals causing delay.' },
  'Nine of Swords': { suit: 'Swords', rank: 9, title: 'Cruelty', astrology: 'Mars in Gemini', description: 'Inner critic or harsh words—need for compassionate self-dialogue.' },
  'Ten of Swords': { suit: 'Swords', rank: 10, title: 'Ruin', astrology: 'Sun in Gemini', description: 'Mental burnout clearing the slate for radically new paradigms.' },

  'Ace of Pentacles': { suit: 'Pentacles', rank: 1, title: 'Root of the Powers of Earth', astrology: 'Pure Earth', description: 'Seed of manifestation—embodied potential in its most concentrated form.' },

  'Two of Pentacles': { suit: 'Pentacles', rank: 2, title: 'Change', astrology: 'Jupiter in Capricorn', description: 'Dynamic adaptation—turning chaos into rhythm and flow.' },
  'Three of Pentacles': { suit: 'Pentacles', rank: 3, title: 'Works', astrology: 'Mars in Capricorn', description: 'Material mastery through teamwork, craft, and focused effort.' },
  'Four of Pentacles': { suit: 'Pentacles', rank: 4, title: 'Power', astrology: 'Sun in Capricorn', description: 'Stability, infrastructure, and strategic stewardship of resources.' },
  'Five of Pentacles': { suit: 'Pentacles', rank: 5, title: 'Worry', astrology: 'Mercury in Taurus', description: 'Scarcity mindset signalling a need for somatic trust and support.' },
  'Six of Pentacles': { suit: 'Pentacles', rank: 6, title: 'Success', astrology: 'Moon in Taurus', description: 'Tangible wins and steady nourishment—remember generous reciprocity.' },
  'Seven of Pentacles': { suit: 'Pentacles', rank: 7, title: 'Failure', astrology: 'Saturn in Taurus', description: 'Slow harvest prompting patience, pruning, and systems thinking.' },
  'Eight of Pentacles': { suit: 'Pentacles', rank: 8, title: 'Prudence', astrology: 'Sun in Virgo', description: 'Methodical craft, refinement, and devotion to incremental mastery.' },
  'Nine of Pentacles': { suit: 'Pentacles', rank: 9, title: 'Gain', astrology: 'Venus in Virgo', description: 'Self-sufficiency, lush results, and discerning stewardship.' },
  'Ten of Pentacles': { suit: 'Pentacles', rank: 10, title: 'Wealth', astrology: 'Mercury in Virgo', description: 'Legacy resources—build structures that benefit community and lineage.' }
};

/**
 * Marseille numerology + pip geometry themes
 */
export const MARSEILLE_NUMERICAL_THEMES = {
  1: { keyword: 'Essence', description: 'Single stem on the central axis—the seed of purpose asking for direction.', geometry: 'Vertical wand/cup anchoring the entire motif.' },
  2: { keyword: 'Duality', description: 'Mirrored forms show dialogue, choice, and polarity seeking harmony.', geometry: 'Paired emblems meeting across a central flower.' },
  3: { keyword: 'Expansion', description: 'Triadic symmetry indicates growth, creativity, and collaborative momentum.', geometry: 'Three-petal arcs forming a triangle of flow.' },
  4: { keyword: 'Structure', description: 'Crossed stems create a stable lattice; emphasizes foundations and boundaries.', geometry: 'Quadrants built from intersecting batons or swords.' },
  5: { keyword: 'Vital Shift', description: 'Center blossom disrupted—tension prompting recalibration and courage.', geometry: 'Central flower pierced or contrasted by the fifth symbol.' },
  6: { keyword: 'Harmony', description: 'Balanced weaving of stems; receptive, beautiful equilibrium of forces.', geometry: 'Hexagonal arrangement framing a radiant center.' },
  7: { keyword: 'Challenge', description: 'Asymmetry appears; invites introspection and faith beyond comfort.', geometry: 'Single emblem misaligned above or below the stable lattice.' },
  8: { keyword: 'Movement', description: 'Loops and crossings accelerate—depicts cycles, diligence, and momentum.', geometry: 'Double loops suggesting infinity symbols within the pip art.' },
  9: { keyword: 'Ripeness', description: 'Dense patternation shows fullness and stewardship of completion.', geometry: 'Three triads stacked, flowers blooming at intersections.' },
10: { keyword: 'Threshold', description: 'Pip forms create portals—culmination transitioning into a new cycle.', geometry: 'Four pairs framing a central staff or sword, indicating closure.' }
};

const THOTH_MAJOR_TITLES = {
  0: 'The Fool',
  1: 'The Magus',
  2: 'The Priestess',
  3: 'The Empress',
  4: 'The Emperor',
  5: 'The Hierophant',
  6: 'The Lovers',
  7: 'The Chariot',
  8: 'Adjustment',
  9: 'The Hermit',
 10: 'Fortune',
 11: 'Lust',
 12: 'The Hanged Man',
 13: 'Death',
 14: 'Art',
 15: 'The Devil',
 16: 'The Tower',
 17: 'The Star',
 18: 'The Moon',
 19: 'The Sun',
 20: 'The Aeon',
 21: 'The Universe'
};

const MARSEILLE_MAJOR_TITLES = {
  0: 'Le Mat',
  1: 'Le Bateleur',
  2: 'La Papesse',
  3: "L'Imperatrice",
  4: "L'Empereur",
  5: 'Le Pape',
  6: "L'Amoureux",
  7: 'Le Chariot',
  8: 'La Justice',
  9: "L'Hermite",
 10: 'La Roue de Fortune',
 11: 'La Force',
 12: 'Le Pendu',
 13: 'La Mort',
 14: 'Temperance',
 15: 'Le Diable',
 16: 'La Maison Dieu',
 17: "L'Etoile",
 18: 'La Lune',
 19: 'Le Soleil',
 20: 'Le Jugement',
 21: 'Le Monde'
};

export const DECK_STYLE_OVERRIDES = {
  'rws-1909': {
    displayName: 'Rider-Waite-Smith 1909',
    suitAliases: {},
    courtAliases: { Page: 'Page', Knight: 'Knight', Queen: 'Queen', King: 'King' },
    majorAliases: {},
    numerologyThemes: null
  },
  'thoth-a1': {
    displayName: 'Thoth',
    suitAliases: { Pentacles: 'Disks' },
    courtAliases: { Page: 'Princess', Knight: 'Prince', Queen: 'Queen', King: 'Knight' },
    majorAliases: THOTH_MAJOR_TITLES,
    minorTitles: THOTH_MINOR_TITLES,
    courtNotes: 'Princess ignites, Prince mobilizes, Queen magnetizes, Knight radiates the final expression.',
    numerologyThemes: null
  },
  'marseille-classic': {
    displayName: 'Tarot de Marseille',
    suitAliases: { Pentacles: 'Coins', Wands: 'Batons' },
    courtAliases: { Page: 'Valet', Knight: 'Chevalier', Queen: 'Reine', King: 'Roi' },
    majorAliases: MARSEILLE_MAJOR_TITLES,
    numerologyThemes: MARSEILLE_NUMERICAL_THEMES,
    courtNotes: 'Valet carries the message, Chevalier rides into action, Reine and Roi codify the legacy.'
  }
};
