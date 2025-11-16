export const SPREADS = {
  // One-card: simple, focused, great as daily draw or core theme
  single: {
    name: 'One-Card Insight',
    tag: 'Quick',
    positions: ['Theme / Guidance of the Moment'],
    count: 1,
    description:
      'A single anchor card capturing the key energy or message surrounding your question or your day.',
    mobileDescription: 'One card to anchor the energy around your question.'
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
    count: 3,
    description:
      'A classic snapshot showing how the situation has unfolded, what is active now, and where it is heading.',
    mobileDescription: 'Past, present, and future snapshots of your story.'
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
    count: 5,
    description:
      'Adds nuance and reflection space while staying approachable for self-readings and beginners.',
    mobileDescription: 'Five cards to surface core tension, support, and likely direction.'
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
    count: 5,
    description:
      'Compares two routes with context and lesson, emphasizing choice over fixed fate.',
    mobileDescription: 'Contrast two paths plus the wisdom that helps you choose.'
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
    count: 3,
    description:
      'Three-card check-in that centers your energy, their energy, and the shared field between you for clear relational guidance.',
    mobileDescription: 'You, them, and the shared connection with grounded guidance.'
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
    count: 10,
    description:
      'A traditional map of the heart of the matter, internal landscape, external forces, and probable outcome, ideal for layered questions.',
    mobileDescription: 'Classic 10-card deep dive for complex, layered questions.'
  }
};
