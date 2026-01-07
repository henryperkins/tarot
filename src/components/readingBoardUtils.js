export function getPositionLabel(spreadInfo, index) {
  const raw = spreadInfo?.positions?.[index];
  if (!raw) return `Position ${index + 1}`;
  return raw.split(' \u2014 ')[0].trim();
}

export function getNextUnrevealedIndex(reading, revealedCards) {
  if (!Array.isArray(reading)) return -1;
  return reading.findIndex((_, index) => !revealedCards.has(index));
}
