/**
 * Ritual-themed microcopy for the tarot reading experience.
 * These strings replace generic UI text with language that honors
 * the ritual feel of a tarot reading.
 */

export const MICROCOPY = {
  // Card reveal - action-oriented
  tapToReveal: 'Tap to turn',
  swipeToReveal: 'Swipe to turn',
  revealPosition: (positionName) => `Turn ${positionName}`,
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
  cardRevealed: 'Face-up',

  // Spread progress
  positionOf: (current, total) => `Position ${current} of ${total}`,
  progressLabel: (revealed, total) => `${revealed} of ${total} face-up`,

  // Post-reveal actions
  readFullMeaning: 'Read full meaning',
  viewCompleteReading: 'View Complete Reading',
  allCardsRevealed: 'All cards face-up',

  // Tactile lens
  holdToViewMeanings: 'Hold to view meanings',
  positionMeanings: 'Position meanings',

  // Screen reader announcements
  srRevealed: (cardName, position) => `Turned ${cardName} face-up in ${position}.`,
  srRevealedAll: (count) => `Turned ${count} cards face-up.`,
  srAllRevealed: 'All cards are already face-up.',
  srSlotLocked: (position) => `${position} is locked. Complete previous positions first.`,
  srLensActive: 'Viewing position meanings. Release to dismiss.'
};

export default MICROCOPY;
