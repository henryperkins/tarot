import { SPREADS } from './spreads';

export const BEGINNER_SPREAD_KEYS = ['single', 'threeCard', 'decision'];

const BEGINNER_SPREAD_META = {
  single: {
    shortName: 'One Card',
    tagline: 'Quick clarity',
    time: '2 min',
    artAlt: 'One-card spread layout',
    education: {
      tagline: 'Perfect for beginners',
      explanation: 'Draw a single card to focus on the core energy of your question. Simple and powerful.'
    }
  },
  threeCard: {
    shortName: 'Three Cards',
    tagline: 'Past / Present / Future',
    time: '5 min',
    artAlt: 'Three-card spread layout',
    education: {
      tagline: 'Tell your story',
      explanation: 'Three cards reveal past influences, present situation, and future possibilities.'
    }
  },
  decision: {
    shortName: 'Decision',
    tagline: 'Compare two paths',
    time: '8 min',
    artAlt: 'Decision spread layout',
    education: {
      tagline: 'Compare your paths',
      explanation: 'When facing a choice, see the energy and outcomes of different options.'
    }
  }
};

export const BEGINNER_SPREADS = BEGINNER_SPREAD_KEYS.map((key) => ({
  key,
  spread: SPREADS[key],
  ...BEGINNER_SPREAD_META[key]
}));
