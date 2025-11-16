/**
 * Position importance weights for narrative emphasis
 * Based on professional reading practice and research recommendations
 */

export const POSITION_WEIGHTS = {
  celtic: {
    0: 1.0,   // Present - anchor card, highest weight
    1: 0.9,   // Challenge - immediate tension
    9: 0.95,  // Outcome - trajectory
    6: 0.85,  // Advice - actionable
    4: 0.75,  // Conscious goal
    5: 0.75,  // Subconscious
    3: 0.7,   // Near future
    8: 0.65,  // Hopes/Fears
    7: 0.6,   // External
    2: 0.6    // Past
  },
  threeCard: {
    1: 1.0,   // Present
    2: 0.9,   // Future
    0: 0.75   // Past
  },
  fiveCard: {
    0: 1.0,   // Core
    1: 0.9,   // Challenge
    4: 0.85,  // Direction
    3: 0.7,   // Support
    2: 0.65   // Hidden
  },
  relationship: {
    0: 0.9,   // You / your energy
    1: 0.9,   // Them / their energy
    2: 1.0    // The connection / shared lesson
  },
  decision: {
    0: 1.0,   // Heart of the decision
    1: 0.8,   // Path A — energy & likely outcome
    2: 0.8,   // Path B — energy & likely outcome
    3: 0.85,  // What clarifies the best path
    4: 0.95   // What to remember about your free will
  }
};

export function getPositionWeight(spreadKey, positionIndex) {
  return POSITION_WEIGHTS[spreadKey]?.[positionIndex] ?? 0.5;
}

export function sortCardsByImportance(cardsInfo, spreadKey) {
  if (!Array.isArray(cardsInfo)) return [];

  return cardsInfo
    .map((card, index) => ({
      ...(card || {}),
      weight: getPositionWeight(spreadKey, index),
      originalIndex: index
    }))
    .sort((a, b) => b.weight - a.weight);
}
