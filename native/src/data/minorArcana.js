// Minor Arcana data for Tableu
// Shape is aligned with MINORS_TOGGLE_PLAN and existing majorArcana.js style.
// - name: "Rank of Suit"
// - suit: "Wands" | "Cups" | "Swords" | "Pentacles"
// - rank: "Ace" | "Two" | ... | "Ten" | "Page" | "Knight" | "Queen" | "King"
// - rankValue: 1-14 (for sequence/suit-run analysis)
// - upright / reversed: concise, RWS-aligned meanings
// - image: path to 1909 Rider-Waite card image (public domain)

function makeCard(suit, rank, rankValue, upright, reversed) {
  // Generate image path based on suit and rankValue
  const paddedRank = String(rankValue).padStart(2, '0');
  const image = `/images/cards/RWS1909_-_${suit}_${paddedRank}.jpeg`;

  return {
    name: `${rank} of ${suit}`,
    suit,
    rank,
    rankValue,
    upright,
    reversed,
    image
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
    'Fear of unknown, playing it safe, staying stuck in comfort zones'
  ),
  makeCard(
    'Wands',
    'Three',
    3,
    'Momentum, expansion, early results, foresight, confidence in direction',
    'Delays, lack of progress, misaligned expectations, setbacks'
  ),
  makeCard(
    'Wands',
    'Four',
    4,
    'Celebration, milestone, harmony at home, foundation for growth',
    'Tension at home, delay in celebrations, instability in foundation'
  ),
  makeCard(
    'Wands',
    'Five',
    5,
    'Healthy competition, creative conflict, diverse viewpoints, testing ideas',
    'Conflict avoidance, internal tension, clashes with no resolution'
  ),
  makeCard(
    'Wands',
    'Six',
    6,
    'Victory, recognition, success in public view, momentum from effort',
    'Self-doubt, delayed success, lack of recognition, private wins'
  ),
  makeCard(
    'Wands',
    'Seven',
    7,
    'Standing your ground, courage, defending your position',
    'Giving up, overwhelmed by pressure, avoiding confrontation'
  ),
  makeCard(
    'Wands',
    'Eight',
    8,
    'Rapid movement, aligned momentum, incoming messages, swift progress',
    'Delays, frustration, miscommunication, scattered energy'
  ),
  makeCard(
    'Wands',
    'Nine',
    9,
    'Resilience, persistence, boundaries, last push before completion',
    'Exhaustion, burnout, defensiveness, feeling worn down'
  ),
  makeCard(
    'Wands',
    'Ten',
    10,
    'Burden, responsibility, heavy load, nearing the finish line',
    'Overwhelm, delegation needed, resisting support, burnout'
  ),
  makeCard(
    'Wands',
    'Page',
    11,
    'Curiosity, exploration, new ideas, energetic beginnings',
    'Lack of direction, hesitation, scattered enthusiasm'
  ),
  makeCard(
    'Wands',
    'Knight',
    12,
    'Bold action, adventure, confidence, taking risks',
    'Impulsiveness, recklessness, haste without preparation'
  ),
  makeCard(
    'Wands',
    'Queen',
    13,
    'Warmth, charisma, creative confidence, leading with heart',
    'Insecurity, jealousy, energy misfires, attention seeking'
  ),
  makeCard(
    'Wands',
    'King',
    14,
    'Vision, leadership, mastery of inspiration, confident direction',
    'Impulsiveness, overbearing leadership, impatience'
  ),

  // CUPS (Water) - emotion, intuition, relationships

  makeCard(
    'Cups',
    'Ace',
    1,
    'New emotional beginning, open heart, intuitive flow, compassion',
    'Emotional blockage, withheld feelings, disconnection from intuition'
  ),
  makeCard(
    'Cups',
    'Two',
    2,
    'Partnership, mutual respect, emotional balance, aligned values',
    'Imbalance, tension, miscommunication, mismatch in values'
  ),
  makeCard(
    'Cups',
    'Three',
    3,
    'Celebration, friendship, collaboration, shared joy',
    'Overindulgence, gossip, tension within a group'
  ),
  makeCard(
    'Cups',
    'Four',
    4,
    'Contemplation, reevaluation, apathy, need for clarity',
    'Renewed interest, seeing possibilities, moving forward'
  ),
  makeCard(
    'Cups',
    'Five',
    5,
    'Loss, grief, regret, focusing on what is missing',
    'Acceptance, healing, shifting focus to what remains'
  ),
  makeCard(
    'Cups',
    'Six',
    6,
    'Nostalgia, memories, emotional sweetness, comfort',
    'Stuck in the past, unrealistic nostalgia, difficulty moving on'
  ),
  makeCard(
    'Cups',
    'Seven',
    7,
    'Choices, imagination, options, need for discernment',
    'Clarity, decision, avoiding illusion, grounded choice'
  ),
  makeCard(
    'Cups',
    'Eight',
    8,
    'Walking away, emotional independence, seeking deeper truth',
    'Avoidance, fear of change, staying despite dissatisfaction'
  ),
  makeCard(
    'Cups',
    'Nine',
    9,
    'Contentment, satisfaction, emotional comfort, wish fulfilled',
    'Overindulgence, dissatisfaction, complacency'
  ),
  makeCard(
    'Cups',
    'Ten',
    10,
    'Harmony, emotional fulfillment, family alignment, lasting joy',
    'Disconnection, tension at home, misaligned expectations'
  ),
  makeCard(
    'Cups',
    'Page',
    11,
    'Curiosity, emotional openness, creative messages, gentle curiosity',
    'Emotional immaturity, insecurity, blocked intuition'
  ),
  makeCard(
    'Cups',
    'Knight',
    12,
    'Romantic pursuit, idealism, following the heart',
    'Moodiness, unrealistic expectations, emotional swings'
  ),
  makeCard(
    'Cups',
    'Queen',
    13,
    'Emotional wisdom, compassion, nurturing, intuitive support',
    'Emotional overwhelm, codependency, insecurity'
  ),
  makeCard(
    'Cups',
    'King',
    14,
    'Emotional mastery, calm leadership, balanced empathy',
    'Emotional suppression, volatility, detachment'
  ),

  // SWORDS (Air) - intellect, truth, clarity

  makeCard(
    'Swords',
    'Ace',
    1,
    'Clarity, truth, breakthrough, mental focus',
    'Confusion, clouded judgement, overthinking'
  ),
  makeCard(
    'Swords',
    'Two',
    2,
    'Indecision, stalemate, need for balance, protecting the heart',
    'Decision made, clarity, releasing avoidance'
  ),
  makeCard(
    'Swords',
    'Three',
    3,
    'Heartbreak, grief, emotional pain, truth revealed',
    'Healing, forgiveness, emotional recovery'
  ),
  makeCard(
    'Swords',
    'Four',
    4,
    'Rest, recovery, contemplation, mental reset',
    'Burnout, restlessness, struggle to pause'
  ),
  makeCard(
    'Swords',
    'Five',
    5,
    'Conflict, tension, hollow victory, misalignment',
    'Reconciliation, compromise, choosing peace'
  ),
  makeCard(
    'Swords',
    'Six',
    6,
    'Transition, healing journey, moving toward calmer waters',
    'Resistance to change, turbulence, unresolved tension'
  ),
  makeCard(
    'Swords',
    'Seven',
    7,
    'Strategy, secrecy, careful planning, independent action',
    'Exposure, dishonesty, need for accountability'
  ),
  makeCard(
    'Swords',
    'Eight',
    8,
    'Restriction, overthinking, feeling trapped, mental blocks',
    'Release, perspective shift, empowerment'
  ),
  makeCard(
    'Swords',
    'Nine',
    9,
    'Anxiety, worry, sleeplessness, inner turmoil',
    'Relief, release, growing optimism'
  ),
  makeCard(
    'Swords',
    'Ten',
    10,
    'Painful ending, surrender, closure, deep release',
    'Recovery, resilience, new dawn'
  ),
  makeCard(
    'Swords',
    'Page',
    11,
    'Curiosity, alertness, new ideas, vigilant perspective',
    'Gossip, scattered thoughts, immaturity'
  ),
  makeCard(
    'Swords',
    'Knight',
    12,
    'Swift action, ambition, decisive movement, assertive clarity',
    'Impulsiveness, aggression, rushing without plan'
  ),
  makeCard(
    'Swords',
    'Queen',
    13,
    'Clear perception, truth, honest communication, sharp insight',
    'Coldness, harsh judgement, dismissiveness'
  ),
  makeCard(
    'Swords',
    'King',
    14,
    'Intellectual authority, truth, leadership through clarity',
    'Rigid thinking, misuse of power, dogmatism'
  ),

  // PENTACLES (Earth) - material, stability, embodiment

  makeCard(
    'Pentacles',
    'Ace',
    1,
    'New financial opportunity, stability, grounded beginnings',
    'Missed chance, insecurity, fear of new path'
  ),
  makeCard(
    'Pentacles',
    'Two',
    2,
    'Balance, adaptability, managing priorities, steady flow',
    'Overwhelm, imbalance, juggling too much'
  ),
  makeCard(
    'Pentacles',
    'Three',
    3,
    'Collaboration, craftsmanship, recognition for work',
    'Lack of teamwork, misaligned expectations, sloppy work'
  ),
  makeCard(
    'Pentacles',
    'Four',
    4,
    'Stability, security, holding on, financial grounding',
    'Greed, fear of loss, rigidity around resources'
  ),
  makeCard(
    'Pentacles',
    'Five',
    5,
    'Hardship, scarcity, feeling left out, material worry',
    'Recovery, support, shift toward abundance'
  ),
  makeCard(
    'Pentacles',
    'Six',
    6,
    'Generosity, balance of giving and receiving, support',
    'Strings attached, imbalance, lack of reciprocity'
  ),
  makeCard(
    'Pentacles',
    'Seven',
    7,
    'Assessment, patience, long-term view, tending the harvest',
    'Impatience, lack of progress, questioning effort'
  ),
  makeCard(
    'Pentacles',
    'Eight',
    8,
    'Skill building, focus, craftsmanship, steady improvement',
    'Burnout, perfectionism, monotony'
  ),
  makeCard(
    'Pentacles',
    'Nine',
    9,
    'Abundance, self-sufficiency, refinement, enjoying rewards',
    'Overindulgence, isolation, misalignment with values'
  ),
  makeCard(
    'Pentacles',
    'Ten',
    10,
    'Legacy, long-term security, family wealth, stability',
    'Financial stress, family tension, lack of continuity'
  ),
  makeCard(
    'Pentacles',
    'Page',
    11,
    'Learning, practical study, grounded ambition, new skills',
    'Lack of progress, distracted focus, unrealistic expectations'
  ),
  makeCard(
    'Pentacles',
    'Knight',
    12,
    'Steady progress, reliability, routine, responsible action',
    'Stagnation, boredom, stubbornness'
  ),
  makeCard(
    'Pentacles',
    'Queen',
    13,
    'Nurturing, resourcefulness, grounded abundance, practicality',
    'Overworking, imbalance, putting others first'
  ),
  makeCard(
    'Pentacles',
    'King',
    14,
    'Leadership, abundance, stability, long-term success',
    'Greed, material obsession, rigidity'
  )
];
