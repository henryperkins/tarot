// functions/lib/knowledgeBase.js
// Curated, internally-authored tarot wisdom passages for GraphRAG retrieval.
//
// NOTE:
// - This file intentionally avoids verbatim excerpts from copyrighted books.
// - The goal is to provide compact, tradition-aligned prompts that enrich the
//   reading without requiring external text reuse.
//
// Structure:
// - TRIAD_PASSAGES: 3-card arcs keyed by triad id
// - FOOLS_JOURNEY_PASSAGES: 3 developmental stages keyed by stage id
// - DYAD_PASSAGES: 2-card synergies keyed by "<major>-<major>"
// - SUIT_PROGRESSION_PASSAGES: Minor Arcana developmental arcs

/**
 * Curated passages for archetypal triads.
 * Keys MUST align with `ARCHETYPAL_TRIADS` ids in `src/data/knowledgeGraphData.js`.
 */
export const TRIAD_PASSAGES = {
    'death-temperance-star': {
        title: 'The Healing Arc',
        theme: 'Ending → Integration → Renewal',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'A clean ending makes room for repair. Let what is finished be finished (Death), then blend the lesson into your life with patience and care (Temperance). From that integration, hope returns—not as a denial of pain, but as a new, steadier orientation (The Star).',
                tags: ['transformation', 'integration', 'healing', 'hope']
            }
        ]
    },

    'devil-tower-sun': {
        title: 'The Liberation Arc',
        theme: 'Bondage → Rupture → Freedom',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Notice what has you hooked (The Devil). Then tell the truth: the structure can’t hold (The Tower). The breakthrough isn’t just escape—it’s clarity and vitality returning (The Sun). If it feels like chaos, ask what honesty is being restored.',
                tags: ['liberation', 'truth', 'breakthrough', 'clarity']
            }
        ]
    },

    'hermit-hangedman-moon': {
        title: 'The Inner Work Arc',
        theme: 'Solitude → Surrender → Mystery',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Withdraw to listen (The Hermit). Release the need to force an answer (The Hanged Man). Then move through ambiguity with gentleness—dreams, symbols, and intuition are part of the map (The Moon). This arc rewards patience over certainty.',
                tags: ['contemplation', 'surrender', 'intuition', 'mystery']
            }
        ]
    },

    'magician-chariot-world': {
        title: 'The Mastery Arc',
        theme: 'Skill → Directed Action → Complete Achievement',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'You have tools and agency (The Magician). Align competing impulses into one direction (The Chariot). Then complete the cycle: integrate the win, the lesson, and the new identity it created (The World).',
                tags: ['manifestation', 'discipline', 'integration', 'completion']
            }
        ]
    },

    'empress-lovers-hierophant': {
        title: 'The Values & Commitment Arc',
        theme: 'Abundance → Choice → Sacred Structure',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Growth invites choices: create and nourish what matters (The Empress), decide in alignment with your values (The Lovers), then build a container—commitment, practice, or community—to sustain it (The Hierophant).',
                tags: ['values', 'commitment', 'choice', 'stability']
            }
        ]
    },

    // Used by knowledgeGraph partial-triad tests and narrative enrichment.
    'fool-magician-world': {
        title: 'The Complete Manifestation Cycle',
        theme: 'Innocent Beginning → Conscious Skill → Total Integration',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Start with a leap (The Fool), apply skill with attention (The Magician), and close the loop with integration (The World). The question is not only "can this be done?" but "who do you become by doing it?"',
                tags: ['beginnings', 'manifestation', 'completion', 'identity']
            }
        ]
    },

    'empress-emperor-hierophant': {
        title: 'The Authority & Structure Arc',
        theme: 'Nurturing Abundance → Order & Structure → Traditional Wisdom',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Create from love (The Empress), then organize your creation with clear boundaries (The Emperor), and finally codify the lessons so they can be passed on (The Hierophant). This arc builds institutions, families, and lasting legacies.',
                tags: ['structure', 'authority', 'tradition', 'legacy']
            }
        ]
    },

    'wheel-justice-hangedman': {
        title: 'The Karmic Acceptance Arc',
        theme: 'Fate Turns → Truth Demanded → Surrender to Flow',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'When cycles shift beyond your control (Wheel of Fortune), face the reckoning with honesty (Justice), then release attachment to outcome (The Hanged Man). Acceptance is not defeat—it is wisdom that conserves energy for what you can influence.',
                tags: ['karma', 'acceptance', 'surrender', 'truth']
            }
        ]
    },

    'tower-star-moon': {
        title: 'The Post-Crisis Navigation Arc',
        theme: 'Upheaval → Hope Restored → Navigating Uncertainty',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'After structures collapse (The Tower), hope returns as a quiet compass (The Star), but the path forward remains unclear (The Moon). Trust intuition over certainty. Healing is not linear, and the next steps may only reveal themselves one at a time.',
                tags: ['crisis', 'hope', 'intuition', 'healing']
            }
        ]
    },

    'strength-hermit-wheel': {
        title: 'The Inner Mastery Through Solitude Arc',
        theme: 'Taming Inner Beasts → Solitary Wisdom → Accepting Cycles',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Gentle self-mastery (Strength) leads to withdrawal for deeper insight (The Hermit), which prepares you to accept the turning of fate with equanimity (Wheel of Fortune). This is the contemplative path: courage, reflection, and surrender to timing.',
                tags: ['self-mastery', 'solitude', 'wisdom', 'cycles']
            }
        ]
    }
};

/**
 * Curated passages for Fool's Journey stages.
 * Keys MUST align with stage keys produced by `detectFoolsJourneyStage()`.
 */
export const FOOLS_JOURNEY_PASSAGES = {
    initiation: {
        title: 'Journey Stage: Initiation (0-7)',
        stage: 'departure',
        theme: 'Building Ego & Identity',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'This stage asks: what are you building, and what identity supports it? Learn your tools, define your values, and practice directed action. The goal isn’t perfection; it’s a stable starting point.',
                tags: ['identity', 'values', 'learning', 'agency']
            }
        ]
    },

    integration: {
        title: 'Journey Stage: Integration (8-14)',
        stage: 'initiation',
        theme: 'Shadow Work & Transformation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Here the work turns inward: reality checks, surrender, and transformation. Progress comes from honest reflection, recalibration, and letting go of what can’t continue.',
                tags: ['shadow', 'truth', 'surrender', 'transformation']
            }
        ]
    },

    culmination: {
        title: 'Journey Stage: Culmination (15-21)',
        stage: 'return',
        theme: 'Shadow Integration & Cosmic Consciousness',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'This stage brings pressure and insight: attachments are named, illusions fall, and renewal becomes possible. The invitation is to integrate what you’ve learned and carry it back into the world with humility and joy.',
                tags: ['integration', 'awakening', 'liberation', 'wholeness']
            }
        ]
    }
};

/**
 * Curated passages for high-significance dyads.
 * Keys match the card order from ARCHETYPAL_DYADS (not always ascending).
 */
export const DYAD_PASSAGES = {
    '13-17': {
        cards: [13, 17],
        names: ['Death', 'The Star'],
        theme: 'Transformation clearing into hope',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Letting go is not the end of the story. When the clearing is honest (Death), the next phase can be gentler and more inspired (The Star). Focus on recovery, replenishment, and a next true step.',
                tags: ['transformation', 'hope', 'recovery']
            }
        ]
    },

    '16-19': {
        cards: [16, 19],
        names: ['The Tower', 'The Sun'],
        theme: 'Upheaval revealing clarity',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'If something breaks, ask what truth it reveals. The Tower strips the false; the Sun restores the simple, bright facts. After the shake-up: simplify, tell the truth, and rebuild from what’s real.',
                tags: ['truth', 'clarity', 'rebuild']
            }
        ]
    },

    '15-6': {
        cards: [15, 6],
        names: ['The Devil', 'The Lovers'],
        theme: 'Attachment patterns affecting choice',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Desire can clarify values, but it can also bind. When attachment tightens (The Devil), choice becomes a test (The Lovers). Name what is hooking you, then choose the path that aligns with your real values.',
                tags: ['attachments', 'choices', 'values', 'freedom']
            }
        ]
    },

    '0-1': {
        cards: [0, 1],
        names: ['The Fool', 'The Magician'],
        theme: 'Potential meeting capability',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Begin with curiosity (The Fool), then act with skill and focus (The Magician). This pairing favors prototypes, experiments, and learning-by-doing—without losing your sense of wonder.',
                tags: ['beginnings', 'skill', 'experimentation']
            }
        ]
    },

    '15-16': {
        cards: [15, 16],
        names: ['The Devil', 'The Tower'],
        theme: 'Bondage meeting disruption',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'When attachment becomes a trap (The Devil), disruption can be mercy (The Tower). Look for the habit, fear, or story that’s losing power—and choose the freer option, even if it’s uncomfortable at first.',
                tags: ['liberation', 'habits', 'breakthrough']
            }
        ]
    },

    '10-20': {
        cards: [10, 20],
        names: ['Wheel of Fortune', 'Judgement'],
        theme: 'Cycle turning into a wake-up call',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'A cycle changes (Wheel) and you’re asked to respond consciously (Judgement). Review what repeats, extract the lesson, and make a deliberate choice that closes the loop.',
                tags: ['cycles', 'karma', 'choice', 'reckoning']
            }
        ]
    },

    '17-20': {
        cards: [17, 20],
        names: ['The Star', 'Judgement'],
        theme: 'Renewed hope calling forth rebirth',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Hope returns as a clear signal (The Star). Judgement asks you to answer it: integrate the lesson, release the old story, and rise into the next version of yourself.',
                tags: ['hope', 'renewal', 'rebirth', 'calling']
            }
        ]
    },

    '7-21': {
        cards: [7, 21],
        names: ['The Chariot', 'The World'],
        theme: 'Determined action reaching completion',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Discipline and focus steer the path (The Chariot). Keep that steady will as you approach completion (The World), so the cycle can close with clarity and celebration.',
                tags: ['discipline', 'completion', 'mastery', 'achievement']
            }
        ]
    },

    '9-2': {
        cards: [9, 2],
        names: ['The Hermit', 'The High Priestess'],
        theme: 'Solitude deepening intuition',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Quiet brings signal. The Hermit reduces noise; the High Priestess increases inner knowing. Favor stillness, journaling, and gentle questions over rushing to conclusions.',
                tags: ['intuition', 'solitude', 'inner-wisdom']
            }
        ]
    }
};

/**
 * Curated passages for suit progressions.
 */
export const SUIT_PROGRESSION_PASSAGES = {
    Wands: {
        beginning: {
            title: 'Wands Beginning: Ignition',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Wands energy is spark and momentum. Start small, move fast, and protect your enthusiasm with simple structure so inspiration can become something real.',
                    tags: ['creativity', 'momentum', 'beginnings']
                }
            ]
        },
        challenge: {
            title: 'Wands Challenge: Testing the Fire',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Wands can feel like heat: competition, visibility, and friction. Choose your battles, refine your message, and keep the flame aimed at what matters most.',
                    tags: ['competition', 'focus', 'pressure']
                }
            ]
        },
        mastery: {
            title: 'Wands Mastery: Culmination',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Wands moves quickly, but it can burn out. Sustain the pace through boundaries, delegation, and rest. The goal is durable impact, not constant intensity.',
                    tags: ['burnout', 'responsibility', 'sustainability']
                }
            ]
        }
    },

    Cups: {
        beginning: {
            title: 'Cups Beginning: Emotional Opening',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Cups opens the heart: connection, receptivity, and shared joy. Let support in and notice what feels nourishing.',
                    tags: ['connection', 'love', 'receptivity']
                }
            ]
        },
        challenge: {
            title: 'Cups Challenge: Emotional Complexity',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Cups asks for discernment: mixed feelings, grief, nostalgia, and tempting fantasies. Name the emotion, then choose what’s true rather than what’s merely soothing.',
                    tags: ['discernment', 'grief', 'clarity']
                }
            ]
        },
        mastery: {
            title: 'Cups Mastery: Emotional Fulfillment',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Cups is emotional maturity: choosing what nourishes, releasing what doesn’t, and building secure joy. Satisfaction grows when boundaries and love cooperate.',
                    tags: ['maturity', 'fulfillment', 'boundaries']
                }
            ]
        }
    },

    Swords: {
        beginning: {
            title: 'Swords Beginning: Mental Clarity',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Swords brings insight and tough decisions. Let clarity be compassionate: tell the truth without turning it into self-attack.',
                    tags: ['truth', 'decision', 'clarity']
                }
            ]
        },
        challenge: {
            title: 'Swords Challenge: Mental Struggle',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Swords highlights conflict and strategy. Choose peace when possible, rest when needed, and don’t confuse “winning” with “being well.”',
                    tags: ['conflict', 'rest', 'strategy']
                }
            ]
        },
        mastery: {
            title: 'Swords Mastery: Crisis & Release',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Swords can feel like rock bottom—then release. When the mind is loud, simplify: breathe, ground, ask for help, and let the next right action be small.',
                    tags: ['anxiety', 'release', 'support']
                }
            ]
        }
    },

    Pentacles: {
        beginning: {
            title: 'Pentacles Beginning: Material Foundation',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Pentacles is the seed of tangible change: skill-building, budgeting, and steady practice. Small consistent steps matter more than big gestures.',
                    tags: ['foundation', 'practice', 'resources']
                }
            ]
        },
        challenge: {
            title: 'Pentacles Challenge: Resource Management',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Pentacles asks you to steward what you have—time, money, health, attention. Tightness loosens when you plan, share wisely, and think long-term.',
                    tags: ['stewardship', 'planning', 'patience']
                }
            ]
        },
        mastery: {
            title: 'Pentacles Mastery: Material Security',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Pentacles is durable security: craft, independence, and legacy. Build what lasts by tending details and honoring sustainable rhythms.',
                    tags: ['stability', 'legacy', 'craft']
                }
            ]
        }
    }
};

/**
 * Get all passages for a specific pattern.
 * @param {'triad'|'fools-journey'|'dyad'|'suit-progression'} patternType
 * @param {string} patternId
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
            const [suit, stage] = String(patternId || '').split(':');
            return SUIT_PROGRESSION_PASSAGES[suit]?.[stage] || null;
        }
        default:
            return null;
    }
}

/**
 * Get high-level stats for telemetry/tests.
 */
export function getKnowledgeBaseStats() {
    const suitProgressionsCount = Object.keys(SUIT_PROGRESSION_PASSAGES).reduce(
        (sum, suit) => sum + Object.keys(SUIT_PROGRESSION_PASSAGES[suit]).length,
        0
    );

    const totalPassages = [
        ...Object.values(TRIAD_PASSAGES),
        ...Object.values(FOOLS_JOURNEY_PASSAGES),
        ...Object.values(DYAD_PASSAGES),
        ...Object.values(SUIT_PROGRESSION_PASSAGES).flatMap((suit) => Object.values(suit))
    ].reduce((sum, entry) => sum + (entry.passages?.length || 0), 0);

    return {
        triads: Object.keys(TRIAD_PASSAGES).length,
        foolsJourneyStages: Object.keys(FOOLS_JOURNEY_PASSAGES).length,
        dyads: Object.keys(DYAD_PASSAGES).length,
        suitProgressions: suitProgressionsCount,
        totalPassages
    };
}
