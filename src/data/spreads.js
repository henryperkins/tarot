import {
  RELATIONSHIP_SPREAD_POSITIONS,
  RELATIONSHIP_SPREAD_MIN_CARDS,
  RELATIONSHIP_SPREAD_MAX_CARDS
} from '../../shared/contracts/spreadContracts.js';

export const SPREADS = {
  // One-card: simple, focused, great as daily draw or core theme
  single: {
    name: 'One-Card Insight',
    tag: 'Quick',
    positions: ['Theme / Guidance of the Moment'],
    roleKeys: ['theme'],
    count: 1,
    description: "One card focused on your question's core energy.",
    mobileDescription: 'Fast, single-card guidance.',
    complexity: { stars: 1, label: 'Easy' },
    preview: {
      src: '/images/spread-art/single.png',
      width: 640,
      height: 360,
      alt: 'One ivory card with an engraved sunrise on dark reading cloth'
    }
  },

  // Three-card: foundational narrative spread
  threeCard: {
    name: 'Three-Card Story (Past · Present · Future)',
    tag: 'Story',
    positions: [
      'Past — influences that led here',
      'Present — where you stand now',
      'Future — trajectory if nothing shifts'
    ],
    roleKeys: ['past', 'present', 'future'],
    count: 3,
    description: 'Past, present, and future—see how your story moves.',
    mobileDescription: 'Past, present, future in three beats.',
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/threeCard.png',
      width: 640,
      height: 360,
      alt: 'Three ivory cards in a row, depicting an hourglass, a tree, and an open path'
    }
  },

  // Five-card: structured clarity without full deep-dive
  fiveCard: {
    name: 'Five-Card Clarity',
    tag: 'Clarity',
    positions: [
      'Core of the matter',
      'Challenge or tension',
      'Hidden / subconscious influence',
      'Support / helpful energy',
      'Likely direction on current path'
    ],
    roleKeys: ['core', 'challenge', 'subconscious', 'support', 'direction'],
    count: 5,
    description: 'Core tension, support, challenge, and direction.',
    mobileDescription: 'Five cards for depth: core, challenge, hidden, support, direction.',
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/fiveCard.png',
      width: 640,
      height: 360,
      alt: 'Five engraved ivory cards arranged in a cross on dark reading cloth'
    }
  },

  // Decision / two-path: compare options while honoring agency
  decision: {
    name: 'Decision / Two-Path',
    tag: 'Decision',
    positions: [
      'Heart of the decision',
      'Path A — energy & likely outcome',
      'Path B — energy & likely outcome',
      'What clarifies the best path',
      'What to remember about your free will'
    ],
    roleKeys: ['heart', 'pathA', 'pathB', 'clarifier', 'freeWill'],
    count: 5,
    description: 'Compare two paths. Choose with clarity.',
    mobileDescription: 'Weigh two paths with heart, paths A/B, clarity, free will.',
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/decision.png',
      width: 640,
      height: 360,
      alt: 'Five ivory cards showing a central seed, two paths, a lantern, and a bird'
    }
  },

  // Relationship: focused dynamic between querent and other
  relationship: {
    name: 'Relationship Snapshot',
    tag: 'Relationship',
    positions: RELATIONSHIP_SPREAD_POSITIONS,
    roleKeys: ['you', 'them', 'connection', 'dynamics', 'rel_outcome'],
    count: RELATIONSHIP_SPREAD_MIN_CARDS,
    drawCount: RELATIONSHIP_SPREAD_MIN_CARDS,
    maxCards: RELATIONSHIP_SPREAD_MAX_CARDS,
    description: 'You, them, and the bond — with space for clarifying insights.',
    mobileDescription: 'You · them · connection, plus clarifiers as needed.',
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/relationship.png',
      width: 640,
      height: 360,
      alt: 'Three botanical cards in a triangle, with two small dots for optional clarifiers'
    }
  },

  // Celtic Cross: classic full spread for complex questions
  celtic: {
    name: 'Celtic Cross (Classic 10-Card)',
    tag: 'Deep dive',
    positions: [
      'Present — core situation',
      'Challenge — crossing / tension',
      'Past — what lies behind',
      'Near Future — what lies before',
      'Conscious — goals & focus',
      'Subconscious — roots / hidden forces',
      'Self / Advice — how to meet this',
      'External Influences — people & environment',
      'Hopes & Fears — deepest wishes & worries',
      'Outcome — likely path if unchanged'
    ],
    // Canonical position roles aligned with AI Tarot Master guide §10 + Appendix A
    roleKeys: [
      'present',       // 1
      'challenge',     // 2
      'past',          // 3
      'near_future',   // 4
      'conscious',     // 5
      'subconscious',  // 6
      'self_advice',   // 7
      'external',      // 8
      'hopes_fears',   // 9
      'outcome'        // 10
    ],
    count: 10,
    description: 'The classic deep dive—ten cards, full picture.',
    mobileDescription: 'Classic 10-card deep dive.',
    complexity: { stars: 3, label: 'Hard' },
    preview: {
      src: '/images/spread-art/celtic.png',
      width: 640,
      height: 360,
      alt: 'Ten ivory cards in a Celtic Cross, with a crossing pair and a four-card side column'
    }
  }
};

export const DEFAULT_SPREAD_KEY = 'single';

export function normalizeSpreadKey(spreadKey, fallbackKey = DEFAULT_SPREAD_KEY) {
  if (spreadKey && SPREADS[spreadKey]) {
    return spreadKey;
  }
  if (fallbackKey && SPREADS[fallbackKey]) {
    return fallbackKey;
  }
  const [firstKey] = Object.keys(SPREADS);
  return firstKey || '';
}

export function getSpreadInfo(spreadKey, fallbackKey = DEFAULT_SPREAD_KEY) {
  const key = normalizeSpreadKey(spreadKey, fallbackKey);
  return key ? SPREADS[key] : null;
}
