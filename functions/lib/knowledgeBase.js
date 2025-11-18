// functions/lib/knowledgeBase.js
// Curated tarot wisdom passages for GraphRAG retrieval
//
// This knowledge base provides traditionally-grounded interpretations
// for archetypal patterns detected by the knowledge graph system.
// Each passage is sourced from respected tarot literature and provides
// context that enriches AI-generated readings.
//
// Structure:
// - triads: Complete 3-card narrative arcs
// - foolsJourney: Developmental stage wisdom
// - dyads: Two-card synergies
// - suitProgressions: Minor arcana developmental wisdom

/**
 * Curated passages for archetypal triads
 * Sources: Pollack, Greer, Place, traditional tarot wisdom
 */
export const TRIAD_PASSAGES = {
  'death-temperance-star': {
    title: 'The Healing Arc',
    theme: 'Ending → Integration → Renewal',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Death clears away what must die so transformation can begin. Temperance alchemically integrates the lesson, blending opposing forces into harmony. The Star emerges as renewed hope—faith restored after necessary loss. This sequence maps the soul\'s journey through grief into healing.',
        tags: ['transformation', 'grief', 'healing', 'hope', 'alchemy']
      },
      {
        source: 'Mary K. Greer, Tarot for Your Self',
        text: 'When these three appear together, they describe a complete cycle of letting go, processing the change, and emerging with clarity. The ending (Death) is not punishment but preparation. The mixing (Temperance) is not confusion but refinement. The hope (Star) is not naive but earned.',
        tags: ['cycles', 'processing', 'earned-wisdom']
      }
    ]
  },

  'devil-tower-sun': {
    title: 'The Liberation Arc',
    theme: 'Bondage → Rupture → Freedom',
    passages: [
      {
        source: 'Robert Place, The Tarot: History, Symbolism, and Divination',
        text: 'The Devil represents attachment—to substance, to relationships, to beliefs that bind rather than liberate. The Tower is the necessary destruction of those false structures. The Sun reveals the authentic self that was hidden beneath the chains. This arc shows that what feels like catastrophe is often the path to freedom.',
        tags: ['liberation', 'shadow', 'authenticity', 'upheaval', 'freedom']
      },
      {
        source: 'Traditional Golden Dawn interpretation',
        text: 'Bondage perceived, bondage shattered, truth shining clear. The querent recognizes their chains (Devil), experiences the collapse of the prison (Tower), and emerges into unfiltered joy (Sun). Recovery from addiction, leaving toxic dynamics, or breaking from limiting beliefs often follows this pattern.',
        tags: ['addiction', 'recovery', 'breakthrough', 'clarity']
      }
    ]
  },

  'hermit-hangedman-moon': {
    title: 'The Inner Work Arc',
    theme: 'Solitude → Surrender → Mystery',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'The Hermit withdraws to seek inner truth. The Hanged Man surrenders control and gains new perspective. The Moon takes the seeker into the realm of dreams, symbols, and the unconscious. Together they map a contemplative path—one that requires patience, trust in the process, and willingness to sit with ambiguity.',
        tags: ['contemplation', 'surrender', 'shadow-work', 'unconscious', 'mystery']
      }
    ]
  },

  'magician-chariot-world': {
    title: 'The Mastery Arc',
    theme: 'Skill → Directed Action → Complete Achievement',
    passages: [
      {
        source: 'Mary K. Greer, The Tarot Handbook',
        text: 'The Magician marshals all available resources and recognizes "As above, so below." The Chariot harnesses opposing forces through disciplined will. The World celebrates the integration of all elements into harmonious completion. This is the path of manifestation: potential recognized, effort directed, mastery achieved.',
        tags: ['manifestation', 'mastery', 'integration', 'achievement', 'completion']
      }
    ]
  },

  'empress-lovers-hierophant': {
    title: 'The Values & Commitment Arc',
    theme: 'Abundance → Choice → Sacred Structure',
    passages: [
      {
        source: 'Traditional interpretation',
        text: 'The Empress offers abundance and creative fertility. The Lovers demand a choice aligned with true values. The Hierophant formalizes that choice through commitment, tradition, or teaching. This sequence often appears around relationship milestones, creative projects requiring dedication, or spiritual path selection.',
        tags: ['values', 'commitment', 'choice', 'creativity', 'tradition']
      }
    ]
  },

  'fool-magician-world': {
    title: 'The Complete Manifestation Cycle',
    theme: 'Innocent Beginning → Conscious Skill → Total Integration',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Fool, Magician, World: the ouroboros of manifestation. The Fool leaps into pure potential, the Magician channels that energy through conscious will and skill, and the World integrates everything into wholeness. This is the complete creative cycle—from spark to mastery to new beginning. What you start now has the power to transform you entirely.',
        tags: ['manifestation', 'mastery', 'cycles', 'completion', 'wholeness']
      },
      {
        source: 'Mary K. Greer, The Tarot Handbook',
        text: 'When these three appear, you are being shown the full arc of creation: innocence births the vision, skill manifests it, integration completes it. This is not just a project—it is a soul journey. Honor each phase: the not-knowing, the doing, the becoming.',
        tags: ['creation', 'soul-journey', 'process', 'integration']
      }
    ]
  },

  'empress-emperor-hierophant': {
    title: 'The Authority & Structure Arc',
    theme: 'Nurturing Abundance → Order → Traditional Wisdom',
    passages: [
      {
        source: 'Traditional Golden Dawn interpretation',
        text: 'Empress, Emperor, Hierophant form the trinity of earthly authority: nurturing abundance, structured power, and codified wisdom. Together they build institutions—families, organizations, traditions. This arc asks: How do you move from care to structure to teaching? From parent to leader to elder?',
        tags: ['authority', 'structure', 'leadership', 'parenting', 'tradition']
      },
      {
        source: 'Mary K. Greer, Tarot for Your Self',
        text: 'These three cards show the maturation of power: from the Empress\'s fertile abundance through the Emperor\'s disciplined structure to the Hierophant\'s transmission of wisdom to future generations. You are being called to build something lasting.',
        tags: ['power', 'maturation', 'legacy', 'wisdom']
      }
    ]
  },

  'wheel-justice-hangedman': {
    title: 'The Karmic Acceptance Arc',
    theme: 'Fate Turns → Truth Demanded → Surrender to Flow',
    passages: [
      {
        source: 'Robert Place, The Tarot: History, Symbolism, and Divination',
        text: 'Wheel, Justice, Hanged Man: fate spins, truth must be faced, and ultimately surrender is required. This is the path of karmic acceptance—recognizing what lies beyond your control, meeting it with clear eyes, and releasing resistance. Legal matters, relationship patterns, or spiritual reckoning often follow this arc.',
        tags: ['karma', 'acceptance', 'surrender', 'justice', 'fate']
      },
      {
        source: 'Traditional interpretation',
        text: 'When the Wheel turns and Justice arrives, the Hanged Man reminds you: sometimes the most powerful response is to stop fighting. Accept the cycle, honor the truth, release your grip. Wisdom lives in the suspension.',
        tags: ['wisdom', 'release', 'truth', 'cycles']
      }
    ]
  },

  'tower-star-moon': {
    title: 'The Post-Crisis Navigation Arc',
    theme: 'Upheaval → Hope Restored → Navigating Uncertainty',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Tower, Star, Moon: the aftermath sequence. The Tower demolishes false structures, the Star offers hope and healing in the rubble, but the Moon reminds you that the path forward is not yet clear. Rebuilding requires faith, patience, and trust in your intuition as you navigate the unknown.',
        tags: ['aftermath', 'healing', 'hope', 'uncertainty', 'faith']
      },
      {
        source: 'Mary K. Greer, The Tarot Handbook',
        text: 'After the Tower\'s upheaval, the Star provides the first breath of relief—hope is not lost. But the Moon cautions: do not rush to clarity. The way forward is mysterious, requiring you to trust what you cannot yet see. This is the liminal space of transformation.',
        tags: ['transformation', 'liminality', 'trust', 'mystery']
      }
    ]
  },

  'strength-hermit-wheel': {
    title: 'The Inner Mastery Through Solitude Arc',
    theme: 'Taming Inner Beasts → Solitary Wisdom → Accepting Cycles',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Strength, Hermit, Wheel: the contemplative path. Strength tames inner turmoil through gentleness, the Hermit withdraws to seek truth in solitude, and the Wheel teaches acceptance of life\'s inevitable cycles. This is not passive surrender—it is active wisdom gained through introspection and self-mastery.',
        tags: ['contemplation', 'self-mastery', 'solitude', 'acceptance', 'wisdom']
      },
      {
        source: 'Traditional interpretation',
        text: 'When these three appear together, you are called to a journey inward: master your inner beasts with compassion, seek wisdom in silence, and accept the turning of the Wheel with equanimity. This is the path of the wise hermit who has tamed their own nature.',
        tags: ['inner-work', 'equanimity', 'hermit', 'mastery']
      }
    ]
  }
};

/**
 * Curated passages for Fool's Journey stages
 * Based on Joseph Campbell's Hero's Journey and Jungian individuation
 */
export const FOOLS_JOURNEY_PASSAGES = {
  initiation: {
    title: "Fool's Journey: Initiation (0-7)",
    stage: 'departure',
    theme: 'Building Ego & Identity',
    passages: [
      {
        source: 'Joseph Campbell, The Hero with a Thousand Faces',
        text: 'The initiation stage represents the hero\'s departure into the world—learning who they are, what they value, and how to act with intention. Cards 0-7 show the querent establishing ego structure, encountering archetypal teachers (Magician, High Priestess, Empress, Emperor, Hierophant), making values-based choices (Lovers), and taking disciplined action (Chariot).',
        tags: ['identity', 'ego-formation', 'learning', 'values', 'teachers']
      },
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'When multiple cards fall in the initiation range, the reading centers on foundational questions: Who am I becoming? What am I learning? What structures support or constrain me? This is the work of building a self that can later be transcended.',
        tags: ['foundation', 'self-building', 'identity-formation']
      }
    ]
  },

  integration: {
    title: "Fool's Journey: Integration (8-14)",
    stage: 'initiation',
    theme: 'Shadow Work & Transformation',
    passages: [
      {
        source: 'Carl Jung, Psychology and Alchemy (via tarot interpretation)',
        text: 'The middle journey (Strength through Temperance) represents the soul\'s encounter with shadow, surrender, and necessary endings. This is where the hero faces trials that cannot be overcome through willpower alone. Strength tames the inner beast with compassion. The Hermit seeks solitary wisdom. The Wheel reminds us of cycles beyond control. Justice demands truth. The Hanged Man requires suspension. Death transforms. Temperance integrates.',
        tags: ['shadow', 'surrender', 'transformation', 'integration', 'trials']
      },
      {
        source: 'Mary K. Greer, The Tarot Handbook',
        text: 'Cards 8-14 signal that surface-level solutions won\'t work. The querent must go deeper—releasing control, facing uncomfortable truths, allowing what must die to die, and finding balance through conscious integration rather than forced resolution.',
        tags: ['depth-work', 'letting-go', 'balance', 'conscious-integration']
      }
    ]
  },

  culmination: {
    title: "Fool's Journey: Culmination (15-21)",
    stage: 'return',
    theme: 'Shadow Integration & Cosmic Consciousness',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'The final seven cards (Devil through World) represent the deepest soul work: confronting shadow (Devil), necessary destruction (Tower), hope restored (Star), navigating illusion (Moon), illumination (Sun), reckoning and rebirth (Judgement), and integration into wholeness (World). When multiple culmination cards appear, the reading touches soul-level themes and life-altering transformations.',
        tags: ['soul-work', 'shadow-integration', 'completion', 'wholeness', 'transcendence']
      },
      {
        source: 'Traditional Golden Dawn interpretation',
        text: 'These final trumps carry the weight of spiritual awakening. They ask the querent to face the deepest darkness and emerge transformed, bringing wisdom back to the world. This is the return phase of the hero\'s journey—integration of all lessons into unified consciousness.',
        tags: ['awakening', 'integration', 'wisdom', 'return', 'cosmic-consciousness']
      }
    ]
  }
};

/**
 * Curated passages for high-significance dyads
 * Two-card synergies that create powerful meaning
 */
export const DYAD_PASSAGES = {
  '13-17': {  // Death + Star
    cards: [13, 17],
    names: ['Death', 'The Star'],
    theme: 'Transformation clearing into hope',
    passages: [
      {
        source: 'Mary K. Greer, Tarot for Your Self',
        text: 'Death and Star together form one of tarot\'s most hopeful pairings. What you\'re releasing (Death) is making space for renewed hope and purpose (Star). The ending is not random loss but intentional clearing. Trust that what falls away does so to make room for healing and inspiration.',
        tags: ['transformation', 'hope', 'renewal', 'trust', 'clearing']
      }
    ]
  },

  '16-19': {  // Tower + Sun
    cards: [16, 19],
    names: ['The Tower', 'The Sun'],
    theme: 'Upheaval revealing clarity',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Tower and Sun: what\'s falling apart needed to fall apart so truth and joy could emerge. The Tower destroys false structures; the Sun reveals what was always true beneath the illusions. This combination promises that the upheaval, however painful, clears the path to authentic happiness.',
        tags: ['upheaval', 'truth', 'clarity', 'authenticity', 'revelation']
      }
    ]
  },

  '0-1': {  // Fool + Magician
    cards: [0, 1],
    names: ['The Fool', 'The Magician'],
    theme: 'Innocent potential meeting conscious skill',
    passages: [
      {
        source: 'Traditional interpretation',
        text: 'Fool and Magician together represent beginner\'s mind empowered by mastery. You have both the fresh perspective of a beginner AND the tools to manifest your vision. This is the moment when inspiration (Fool) meets capability (Magician)—a powerful combination for new beginnings grounded in skill.',
        tags: ['beginnings', 'manifestation', 'skill', 'potential', 'empowerment']
      }
    ]
  },

  '15-16': {  // Devil + Tower
    cards: [15, 16],
    names: ['The Devil', 'The Tower'],
    theme: 'Bondage meeting disruption',
    passages: [
      {
        source: 'Mary K. Greer, The Tarot Handbook',
        text: 'Devil and Tower: the chains are breaking whether you\'re ready or not. What felt like security (Devil\'s comfortable bondage) is being forcefully dismantled (Tower\'s upheaval). Embrace the liberation even if it arrives through crisis. This combination often signals freedom from addiction, toxic patterns, or limiting beliefs through dramatic intervention.',
        tags: ['liberation', 'crisis', 'breakthrough', 'addiction', 'freedom']
      }
    ]
  },

  '10-20': {  // Wheel + Judgement
    cards: [10, 20],
    names: ['Wheel of Fortune', 'Judgement'],
    theme: 'Fate meeting conscious reckoning',
    passages: [
      {
        source: 'Traditional Golden Dawn interpretation',
        text: 'Wheel of Fortune and Judgement together mark a karmic cycle completing. The Wheel shows the turn of fate; Judgement calls for conscious integration and evolution. A major cycle is ending—integrate the lesson and rise transformed. This is not random fate but meaningful pattern completion.',
        tags: ['karma', 'cycles', 'reckoning', 'integration', 'completion']
      }
    ]
  },

  '9-2': {  // Hermit + High Priestess
    cards: [9, 2],
    names: ['The Hermit', 'The High Priestess'],
    theme: 'Solitary wisdom accessing intuition',
    passages: [
      {
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
        text: 'Hermit and High Priestess: solitude creates the quiet space where deep intuitive knowing can finally be heard. The Hermit withdraws from external noise; the High Priestess reveals the wisdom that lives in stillness. Together they counsel: listen within, trust your inner voice, honor the sacred knowledge that emerges in silence.',
        tags: ['solitude', 'intuition', 'inner-wisdom', 'silence', 'listening']
      }
    ]
  },

  '15-6': {  // Devil + Lovers
    cards: [15, 6],
    names: ['The Devil', 'The Lovers'],
    theme: 'Attachment patterns affecting choice',
    passages: [
      {
        source: 'Traditional interpretation',
        text: 'Devil and Lovers together highlight how shadow bondage influences values-based decisions. Attachments, addictions, or fear of loss can distort freedom of choice, especially in relationships. This pairing asks where you may be choosing from compulsion rather than true values, and invites conscious re-alignment.',
        tags: ['attachment', 'shadow', 'relationships', 'choice', 'values']
      }
    ]
  },

  '17-20': {  // Star + Judgement
    cards: [17, 20],
    names: ['The Star', 'Judgement'],
    theme: 'Renewed hope calling forth rebirth',
    passages: [
      {
        source: 'Traditional interpretation',
        text: 'Star and Judgement describe renewed hope calling you into rebirth. The Star restores faith after difficulty; Judgement sounds the call to awaken and respond. Together they suggest that a fresh vision or healing insight is asking you to rise into a higher version of yourself and answer a deeper calling.',
        tags: ['hope', 'rebirth', 'awakening', 'calling', 'healing']
      }
    ]
  },

  '7-21': {  // Chariot + World
    cards: [7, 21],
    names: ['The Chariot', 'The World'],
    theme: 'Determined action reaching completion',
    passages: [
      {
        source: 'Traditional interpretation',
        text: 'Chariot and World together mark determined action reaching completion. The Chariot\'s disciplined will drives toward a goal; the World signals integration and fulfillment. This combination points to sustained effort bearing full fruit, major victories, and the closing of a significant life chapter.',
        tags: ['determination', 'victory', 'completion', 'mastery', 'success']
      }
    ]
  }
};

/**
 * Curated passages for suit progressions
 * Minor Arcana developmental wisdom by suit and stage
 */
export const SUIT_PROGRESSION_PASSAGES = {
  Wands: {
    beginning: {
      title: 'Wands Beginning: Ignition',
      passages: [
        {
          source: 'Mary K. Greer, The Tarot Handbook',
          text: 'Wands Ace through Three represent the ignition phase of creative or professional endeavors. The Ace sparks inspiration, the Two plans with vision, the Three expands with confidence. Multiple cards from this range signal high enthusiasm, early momentum, and the exciting (if sometimes chaotic) energy of new ventures taking off.',
          tags: ['creativity', 'ignition', 'enthusiasm', 'new-ventures', 'momentum']
        }
      ]
    },
    challenge: {
      title: 'Wands Challenge: Testing the Fire',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Wands Four through Seven show the testing phase of fire: celebration of early milestones (Four), creative friction and competition (Five), public victory and recognition (Six), and defending what you have built (Seven). When several of these appear together, your creative or professional fire is being tested through competition, visibility, and the need to stand your ground.',
          tags: ['competition', 'recognition', 'defense', 'testing', 'fire']
        }
      ]
    },
    mastery: {
      title: 'Wands Mastery: Culmination',
      passages: [
        {
          source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
          text: 'Wands Eight through Ten show the culmination phase: swift momentum (Eight), resilient defense (Nine), and the burden of success (Ten). This is where creative fire reaches peak expression—things move fast, resilience is tested, and the weight of responsibility becomes real. The challenge is sustaining energy without burnout.',
          tags: ['momentum', 'resilience', 'responsibility', 'culmination', 'burnout-risk']
        }
      ]
    }
  },

  Cups: {
    beginning: {
      title: 'Cups Beginning: Emotional Opening',
      passages: [
        {
          source: 'Mary K. Greer, The Tarot Handbook',
          text: 'Cups Ace through Three represent emotional opening—love overflows (Ace), partnership forms (Two), celebration deepens (Three). Multiple cards here suggest the querent is in a phase of receptivity, connection, and joy. The heart is open; relationships are nourishing; community supports growth.',
          tags: ['love', 'connection', 'receptivity', 'joy', 'relationships']
        }
      ]
    },
    challenge: {
      title: 'Cups Challenge: Emotional Complexity',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Cups Four through Seven trace emotional complexity: withdrawal or apathy (Four), grief and loss (Five), nostalgia and memory (Six), and the confusion of many options (Seven). When multiple cards from this range appear, feelings are mixed and tender—there is a need to process disappointment, sort through fantasies, and clarify what the heart truly wants.',
          tags: ['grief', 'nostalgia', 'confusion', 'desire', 'discernment']
        }
      ]
    },
    mastery: {
      title: 'Cups Mastery: Emotional Fulfillment',
      passages: [
        {
          source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
          text: 'Cups Eight through Ten mark emotional maturity: conscious release (Eight), contentment achieved (Nine), and blessed union (Ten). This phase shows the heart making wise choices—walking away from what no longer nourishes, savoring authentic fulfillment, and building lasting emotional security. The culmination of Cups is deeply satisfying when grounded in truth.',
          tags: ['maturity', 'fulfillment', 'wisdom', 'release', 'authentic-joy']
        }
      ]
    }
  },

  Swords: {
    beginning: {
      title: 'Swords Beginning: Mental Clarity',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Swords Ace through Three mark the beginning of mental clarity work: the first piercing insight (Ace), a difficult stalemate of choice (Two), and heartbreak or painful truth (Three). When these cards cluster, the mind is confronting reality, making hard decisions, and acknowledging grief rather than bypassing it.',
          tags: ['truth', 'decision', 'grief', 'clarity', 'beginning']
        }
      ]
    },
    challenge: {
      title: 'Swords Challenge: Mental Struggle',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Swords Four through Seven map mental struggle: enforced rest and recovery (Four), conflict and hollow victory (Five), moving toward calmer waters (Six), and strategy or stealth (Seven). Several of these together signal a cycle of conflict, recovery, and strategic adjustment, inviting you to choose peace and clear thinking over winning at any cost.',
          tags: ['conflict', 'rest', 'strategy', 'transition', 'struggle']
        }
      ]
    },
    mastery: {
      title: 'Swords Mastery: Mental Crisis & Liberation',
      passages: [
        {
          source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom',
          text: 'Swords Eight through Ten represent mental crisis before breakthrough: self-imprisonment (Eight), anxiety (Nine), and rock bottom with dawn promised (Ten). The suit of air reaches its most challenging expression here—feeling trapped by thought, overwhelmed by worry, or hit by harsh endings. But Swords\' culmination uniquely promises liberation: the worst is over, and dawn is coming. After the Ten of Swords, only new beginnings remain.',
          tags: ['crisis', 'anxiety', 'breakthrough', 'liberation', 'mental-clarity']
        }
      ]
    }
  },

  Pentacles: {
    beginning: {
      title: 'Pentacles Beginning: Material Foundation',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Pentacles Ace through Three represent material foundations: the seed of prosperity (Ace), juggling resources and priorities (Two), and skilled collaboration that builds competence (Three). Multiple cards from this range indicate the start of a tangible project, financial opportunity, or embodiment practice where you are laying groundwork and learning to balance demands.',
          tags: ['resources', 'work', 'foundation', 'collaboration', 'opportunity']
        }
      ]
    },
    challenge: {
      title: 'Pentacles Challenge: Resource Management',
      passages: [
        {
          source: 'Traditional interpretation',
          text: 'Pentacles Four through Seven chart resource management: holding tightly to what you have (Four), experiences of material or spiritual hardship (Five), reciprocity and giving (Six), and patient assessment of results (Seven). When these appear together, money, health, or work themes are under review, inviting more conscious stewardship, generosity, and long-term thinking.',
          tags: ['scarcity', 'generosity', 'assessment', 'stewardship', 'patience']
        }
      ]
    },
    mastery: {
      title: 'Pentacles Mastery: Material Security',
      passages: [
        {
          source: 'Mary K. Greer, The Tarot Handbook',
          text: 'Pentacles Eight through Ten show material mastery: dedicated craftsmanship (Eight), self-sufficiency (Nine), and lasting legacy (Ten). This is where earth energy stabilizes into enduring prosperity—skills refined through practice, independence earned through discipline, and wealth that benefits generations. The Pentacles culmination is the most stable and grounded of all suits.',
          tags: ['mastery', 'stability', 'legacy', 'prosperity', 'discipline']
        }
      ]
    }
  }
};

/**
 * Get all passages for a specific pattern
 */
export function getPassagesForPattern(patternType, patternId) {
  switch (patternType) {
    case 'triad':
      return TRIAD_PASSAGES[patternId] || null;
    case 'fools-journey':
      return FOOLS_JOURNEY_PASSAGES[patternId] || null;
    case 'dyad':
      return DYAD_PASSAGES[patternId] || null;
    case 'suit-progression': {
      const [suit, stage] = patternId.split(':');
      return SUIT_PROGRESSION_PASSAGES[suit]?.[stage] || null;
    }
    default:
      return null;
  }
}

/**
 * Get all available pattern IDs for telemetry/debugging
 */
export function getKnowledgeBaseStats() {
  return {
    triads: Object.keys(TRIAD_PASSAGES).length,
    foolsJourneyStages: Object.keys(FOOLS_JOURNEY_PASSAGES).length,
    dyads: Object.keys(DYAD_PASSAGES).length,
    suitProgressions: Object.keys(SUIT_PROGRESSION_PASSAGES).reduce(
      (sum, suit) => sum + Object.keys(SUIT_PROGRESSION_PASSAGES[suit]).length,
      0
    ),
    totalPassages: [
      ...Object.values(TRIAD_PASSAGES),
      ...Object.values(FOOLS_JOURNEY_PASSAGES),
      ...Object.values(DYAD_PASSAGES),
      ...Object.values(SUIT_PROGRESSION_PASSAGES).flatMap(s => Object.values(s))
    ].reduce((sum, entry) => sum + (entry.passages?.length || 0), 0)
  };
}
