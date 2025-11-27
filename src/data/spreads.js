export const SPREADS = {
  // One-card: simple, focused, great as daily draw or core theme
  single: {
    name: 'One-Card Insight',
    tag: 'Quick',
    positions: ['Theme / Guidance of the Moment'],
    roleKeys: ['theme'],
    count: 1,
    description: "One card focused on your question's core energy.",
    complexity: { stars: 1, label: 'Easy' },
    preview: {
      src: '/images/spread-art/single.png',
      width: 220,
      height: 108,
      alt: 'Single card centered on a starry field'
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
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/threeCard.png',
      width: 219,
      height: 108,
      alt: 'Three cards aligned for past, present, and future'
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
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/fiveCard.png',
      width: 219,
      height: 108,
      alt: 'Five-card cross layout'
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
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/decision.png',
      width: 220,
      height: 108,
      alt: 'Dual path layout with clarifying center'
    }
  },

  // Relationship: focused dynamic between querent and other
  relationship: {
    name: 'Relationship Snapshot',
    tag: 'Relationship',
    positions: [
      'You / your energy',
      'Them / their energy',
      'The connection / shared lesson'
    ],
    roleKeys: ['you', 'them', 'connection'],
    count: 3,
    description: 'Your energy, their energy, your shared connection.',
    complexity: { stars: 2, label: 'Normal' },
    preview: {
      src: '/images/spread-art/relationship.png',
      width: 220,
      height: 109,
      alt: 'Three-card relationship triangle layout'
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
    complexity: { stars: 3, label: 'Hard' },
    preview: {
      src: '/images/spread-art/celtic.png',
      width: 220,
      height: 109,
      alt: 'Celtic Cross ten-card arrangement'
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
