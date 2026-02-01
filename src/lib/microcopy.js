/**
 * Ritual-themed microcopy for the tarot reading experience.
 * These strings replace generic UI text with language that honors
 * the ritual feel of a tarot reading.
 */

export const MICROCOPY = {
  // Card reveal
  tapToReveal: 'Tap to uncover truth',
  swipeToReveal: 'Swipe to uncover truth',

  // Loading states
  awaitingCard: 'Awaiting the cards...',
  analyzingSpread: 'Reading the patterns...',
  draftingNarrative: 'Weaving your narrative...',
  polishingReading: 'Final reflections...',

  // Reflection prompts
  reflectionPlaceholder: 'Your thoughts and feelings... (optional)',
  addReflection: 'Add a reflection',
  editReflection: 'Edit reflection',
  whatResonates: 'What resonates for you?',

  // Connection states
  connectionLost: 'The connection wavers... trying again.',
  retrying: 'Reconnecting to the reading...',

  // Card states
  cardReady: 'Ready',
  cardRevealed: 'Revealed',

  // Spread progress
  positionOf: (current, total) => `Position ${current} of ${total}`,

  // Screen reader announcements
  srRevealed: (cardName, position) => `Revealed ${cardName} in ${position}.`,
  srRevealedAll: (count) => `Revealed ${count} cards.`,
  srAllRevealed: 'All cards already revealed.'
};

export default MICROCOPY;
