export const SPREADS = {
  // One-card: simple, focused, great as daily draw or core theme
  single: {
    name: 'One-Card Insight',
    tag: 'Quick',
    positions: ['Theme / Guidance of the Moment'],
    roleKeys: ['theme'],
    count: 1,
    description:
      'Anchor the moment with one clear card that names the energy around your question.',
    mobileDescription: 'One card anchoring the energy around your question.',
    complexity: { stars: 1, label: 'Beginner' },
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
    description:
      'Trace past, present, and future threads so you understand how the story is moving.',
    mobileDescription: 'Past, present, future snapshots to see your story moving.',
    complexity: { stars: 2, label: 'Intermediate' },
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
    description:
      'Surface the core tension, revealing support, challenge, and direction without a full deep dive.',
    mobileDescription: 'Five cards naming tension, support, and next direction.',
    complexity: { stars: 2, label: 'Intermediate' },
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
    description:
      'Compare two paths plus the lesson between them so you can choose with agency.',
    mobileDescription: 'Contrast both paths and the wisdom that clarifies your choice.',
    complexity: { stars: 2, label: 'Intermediate' },
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
    description:
      'Center your energy, their energy, and the shared field for a grounded relationship check-in.',
    mobileDescription: 'You, them, and the shared connection for grounded guidance.',
    complexity: { stars: 2, label: 'Intermediate' },
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
      'Present — core situation (Card 1)',
      'Challenge — crossing / tension (Card 2)',
      'Past — what lies behind (Card 3)',
      'Near Future — what lies before (Card 4)',
      'Conscious — goals & focus (Card 5)',
      'Subconscious — roots / hidden forces (Card 6)',
      'Self / Advice — how to meet this (Card 7)',
      'External Influences — people & environment (Card 8)',
      'Hopes & Fears — deepest wishes & worries (Card 9)',
      'Outcome — likely path if unchanged (Card 10)'
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
    description:
      'Walk the classic ten-card map to read layers of influence, advice, and likely outcome.',
    mobileDescription: 'Classic 10-card deep dive for layered, complex questions.',
    complexity: { stars: 3, label: 'Advanced' },
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
