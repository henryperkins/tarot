// Minor Arcana data for Mystic Tarot
// Shape is aligned with MINORS_TOGGLE_PLAN and existing majorArcana.js style.
// - name: "Rank of Suit"
// - suit: "Wands" | "Cups" | "Swords" | "Pentacles"
// - rank: "Ace" | "Two" | ... | "Ten" | "Page" | "Knight" | "Queen" | "King"
// - rankValue: 1–14 (for sequence/suit-run analysis)
// - upright / reversed: concise, RWS-aligned meanings

function makeCard(suit, rank, rankValue, upright, reversed) {
    return {
        name: `${rank} of ${suit}`,
        suit,
        rank,
        rankValue,
        upright,
        reversed
    };
}

export const MINOR_ARCANA = [
    // WANDS (Fire) - inspiration, action, will

    makeCard(
        'Wands',
        'Ace',
        1,
        'Inspiration, new energy, creative spark, potential for bold action',
        'Scattered energy, lack of direction, missed opportunities to act'
    ),
    makeCard(
        'Wands',
        'Two',
        2,
        'Planning, looking ahead, making empowered choices, considering options',
        'Fear of expansion, staying small, over-planning without movement'
    ),
    makeCard(
        'Wands',
        'Three',
        3,
        'Progress, momentum, ventures launching, seeing first results',
        'Delays, limited foresight, frustration waiting for returns'
    ),
    makeCard(
        'Wands',
        'Four',
        4,
        'Celebration, stability, milestone reached, supportive community',
        'Tension at home, instability under the surface, needing true belonging'
    ),
    makeCard(
        'Wands',
        'Five',
        5,
        'Competition, testing ideas, lively conflict, proving yourself',
        'Avoidance of conflict, resentment, unproductive tension'
    ),
    makeCard(
        'Wands',
        'Six',
        6,
        'Recognition, victory, validation, visible progress',
        'Self-doubt, lack of recognition, seeking approval from others'
    ),
    makeCard(
        'Wands',
        'Seven',
        7,
        'Defensiveness, standing your ground, maintaining boundaries',
        'Feeling overwhelmed, burnout, giving up too soon'
    ),
    makeCard(
        'Wands',
        'Eight',
        8,
        'Swift movement, acceleration, messages, rapid developments',
        'Delays, miscommunication, scattered efforts, mixed signals'
    ),
    makeCard(
        'Wands',
        'Nine',
        9,
        'Resilience, perseverance, cautious strength, near completion',
        'Hyper-vigilance, exhaustion, struggling to trust or continue'
    ),
    makeCard(
        'Wands',
        'Ten',
        10,
        'Burden, responsibilities, carrying a heavy load to completion',
        'Overload, unsustainable pressure, needing to delegate or release'
    ),
    makeCard(
        'Wands',
        'Page',
        11,
        'Enthusiasm, creative curiosity, messages of opportunity',
        'Restlessness, immaturity, unfocused inspiration'
    ),
    makeCard(
        'Wands',
        'Knight',
        12,
        'Courage, bold pursuit, adventure, passionate action',
        'Impulsiveness, recklessness, inconsistency, burnout risk'
    ),
    makeCard(
        'Wands',
        'Queen',
        13,
        'Confidence, charisma, leadership through warmth and vision',
        'Jealousy, insecurity, manipulation, shrinking your light'
    ),
    makeCard(
        'Wands',
        'King',
        14,
        'Strategic vision, authority, entrepreneurial fire, leading by example',
        'Domineering, rigid, intolerant, misusing influence'
    ),

    // CUPS (Water) - emotions, relationships, intuition

    makeCard(
        'Cups',
        'Ace',
        1,
        'New feelings, emotional openness, intuition, beginnings in love or healing',
        'Emotional block, numbness, repressed or unexpressed feelings'
    ),
    makeCard(
        'Cups',
        'Two',
        2,
        'Connection, partnership, mutual respect, heartfelt unity',
        'Imbalance, misunderstanding, emotional distance between people'
    ),
    makeCard(
        'Cups',
        'Three',
        3,
        'Friendship, joy, community, shared celebration',
        'Overindulgence, gossip, feeling left out or excluded'
    ),
    makeCard(
        'Cups',
        'Four',
        4,
        'Apathy, contemplation, reevaluating offers, emotional withdrawal',
        'New interest, emotional re-engagement, seeing opportunities again'
    ),
    makeCard(
        'Cups',
        'Five',
        5,
        'Grief, regret, focusing on loss, emotional disappointment',
        'Acceptance, perspective returning, learning from sorrow'
    ),
    makeCard(
        'Cups',
        'Six',
        6,
        'Nostalgia, innocence, kind memories, simple affection',
        'Living in the past, rose-colored views, difficulty moving on'
    ),
    makeCard(
        'Cups',
        'Seven',
        7,
        'Choices, dreams, fantasies, many options, visioning',
        'Confusion, illusion, overwhelm, need for grounded decision'
    ),
    makeCard(
        'Cups',
        'Eight',
        8,
        'Walking away, deeper search, leaving what no longer nourishes',
        'Fear of leaving, stagnation, staying in unfulfilling situations'
    ),
    makeCard(
        'Cups',
        'Nine',
        9,
        'Contentment, emotional satisfaction, wishes fulfilled',
        'Smugness, dissatisfaction, surface-level comfort without depth'
    ),
    makeCard(
        'Cups',
        'Ten',
        10,
        'Emotional fulfillment, harmony, chosen family, stable joy',
        'Disconnection, family tension, ideals of happiness not matching reality'
    ),
    makeCard(
        'Cups',
        'Page',
        11,
        'Gentle curiosity, creative sensitivity, messages from the heart',
        'Emotional immaturity, escapism, ignoring intuitive nudges'
    ),
    makeCard(
        'Cups',
        'Knight',
        12,
        'Romantic pursuit, idealism, following the heart, poetic action',
        'Over-idealization, inconsistency, moodiness, avoidance of reality'
    ),
    makeCard(
        'Cups',
        'Queen',
        13,
        'Compassion, empathy, emotional intelligence, intuition in flow',
        'Emotional overwhelm, martyrdom, blurred boundaries'
    ),
    makeCard(
        'Cups',
        'King',
        14,
        'Emotional mastery, stability, wise counsel, calm depth',
        'Emotional suppression, control, manipulation or detachment'
    ),

    // SWORDS (Air) - mind, truth, conflict, clarity

    makeCard(
        'Swords',
        'Ace',
        1,
        'Clarity, breakthrough, new idea, honest communication',
        'Confusion, misinformation, harsh words, overthinking'
    ),
    makeCard(
        'Swords',
        'Two',
        2,
        'Stalemate, difficult choice, guarded heart, weighing options',
        'Avoidance, indecision, denial of truth, inner tension'
    ),
    makeCard(
        'Swords',
        'Three',
        3,
        'Heartache, painful truth, disappointment, release through honesty',
        'Lingering hurt, suppression, difficulty processing pain'
    ),
    makeCard(
        'Swords',
        'Four',
        4,
        'Rest, retreat, mental recovery, intentional pause',
        'Restlessness, burnout, resisting needed downtime'
    ),
    makeCard(
        'Swords',
        'Five',
        5,
        'Pyrrhic victory, conflict, ego battles, questionable win',
        'Desire to reconcile, walking away, learning from conflict'
    ),
    makeCard(
        'Swords',
        'Six',
        6,
        'Transition, moving on, mental shift toward calmer waters',
        'Difficulty leaving, emotional baggage, stalled transition'
    ),
    makeCard(
        'Swords',
        'Seven',
        7,
        'Strategy, discretion, working quietly, questioning trust',
        'Exposure, consequences, call for transparency and integrity'
    ),
    makeCard(
        'Swords',
        'Eight',
        8,
        'Feeling trapped, limiting beliefs, mental imprisonment',
        'Releasing constraints, seeing options, reclaiming agency'
    ),
    makeCard(
        'Swords',
        'Nine',
        9,
        'Anxiety, worry, sleepless thoughts, mental overwhelm',
        'Recovery from anxiety, gaining perspective, support arriving'
    ),
    makeCard(
        'Swords',
        'Ten',
        10,
        'Ending, rock bottom, harsh conclusion, clearing for renewal',
        'Resistance to ending, lingering pain, slowly rising again'
    ),
    makeCard(
        'Swords',
        'Page',
        11,
        'Curiosity, new ideas, vigilance, honest questions',
        'Rumors, hastiness, mental scatteredness, intrusive thoughts'
    ),
    makeCard(
        'Swords',
        'Knight',
        12,
        'Decisive action, sharp focus, pursuing truth swiftly',
        'Impulsivity, aggression, speaking without care, tunnel vision'
    ),
    makeCard(
        'Swords',
        'Queen',
        13,
        'Clear thinking, boundaries, discernment, direct communication',
        'Coldness, cynicism, cutting words, over-detachment'
    ),
    makeCard(
        'Swords',
        'King',
        14,
        'Authority in truth, rational leadership, strategic intellect',
        'Manipulative logic, rigidity, misusing knowledge or power'
    ),

    // PENTACLES (Earth) - body, work, resources, stability

    makeCard(
        'Pentacles',
        'Ace',
        1,
        'New material opportunity, seed of prosperity, tangible beginning',
        'Blocked opportunity, short-term thinking, hesitating to invest'
    ),
    makeCard(
        'Pentacles',
        'Two',
        2,
        'Balance, juggling priorities, adaptable resource management',
        'Overwhelm, instability, disorganized responsibilities'
    ),
    makeCard(
        'Pentacles',
        'Three',
        3,
        'Collaboration, skill development, building something of quality',
        'Lack of teamwork, misalignment, underappreciated skills'
    ),
    makeCard(
        'Pentacles',
        'Four',
        4,
        'Security, holding on, protecting resources, stability',
        'Fear-based clinging, scarcity mindset, resistance to flow'
    ),
    makeCard(
        'Pentacles',
        'Five',
        5,
        'Hardship, scarcity, feeling left out, material or emotional struggle',
        'Support available, recovery path, shifting from isolation to help'
    ),
    makeCard(
        'Pentacles',
        'Six',
        6,
        'Generosity, reciprocity, fair exchange, support in balance',
        'Strings attached, inequality, imbalance in giving and receiving'
    ),
    makeCard(
        'Pentacles',
        'Seven',
        7,
        'Patience, evaluation, long-term investment, slow growth',
        'Impatience, doubt, misallocation of effort, reconsidering path'
    ),
    makeCard(
        'Pentacles',
        'Eight',
        8,
        'Mastery through practice, craftsmanship, dedicated work',
        'Monotony, overwork, stagnation, lack of intentional growth'
    ),
    makeCard(
        'Pentacles',
        'Nine',
        9,
        'Self-sufficiency, comfort, earned success, enjoying the fruits',
        'Dependence, imposter feelings, not owning your achievements'
    ),
    makeCard(
        'Pentacles',
        'Ten',
        10,
        'Legacy, long-term stability, family, wealth, foundations',
        'Inheritances of pattern, financial tension, misaligned values'
    ),
    makeCard(
        'Pentacles',
        'Page',
        11,
        'Student mindset, new skill, practical opportunity, grounded curiosity',
        'Procrastination, lack of follow-through, missed chances to learn'
    ),
    makeCard(
        'Pentacles',
        'Knight',
        12,
        'Steady progress, responsibility, reliability, slow and sure effort',
        'Stagnation, stubbornness, resistance to adapt'
    ),
    makeCard(
        'Pentacles',
        'Queen',
        13,
        'Nurturing abundance, practicality, resourceful care, body wisdom',
        'Overextension, neglecting self, imbalance between care and depletion'
    ),
    makeCard(
        'Pentacles',
        'King',
        14,
        'Material mastery, stability, stewardship, grounded leadership',
        'Greed, rigidity, over-identification with status or control'
    )
];
