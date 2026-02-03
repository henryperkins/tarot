/**
 * Ritual-themed microcopy for the tarot reading experience.
 * These strings replace generic UI text with language that honors
 * the ritual feel of a tarot reading.
 */

export const MICROCOPY = {
  // Card reveal - action-oriented
  tapToReveal: 'Tap to uncover truth',
  swipeToReveal: 'Swipe to uncover truth',
  revealPosition: (positionName) => `Reveal ${positionName}`,
  summonCard: (positionName) => `Summon card to ${positionName}`,
  awaitingPrevious: (prevPosition) => `Awaiting ${prevPosition}`,

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
  progressLabel: (revealed, total) => `${revealed} of ${total} revealed`,

  // Post-reveal actions
  readFullMeaning: 'Read full meaning',
  viewCompleteReading: 'View Complete Reading',
  allCardsRevealed: 'All cards revealed',

  // Tactile lens
  holdToViewMeanings: 'Hold to view meanings',
  positionMeanings: 'Position meanings',

  // Screen reader announcements
  srRevealed: (cardName, position) => `Revealed ${cardName} in ${position}.`,
  srRevealedAll: (count) => `Revealed ${count} cards.`,
  srAllRevealed: 'All cards already revealed.',
  srSlotLocked: (position) => `${position} is locked. Complete previous positions first.`,
  srLensActive: 'Viewing position meanings. Release to dismiss.'
};

export default MICROCOPY;
