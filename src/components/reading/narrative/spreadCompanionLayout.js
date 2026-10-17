/** Rail columns for a spread: one for up to three cards, two beyond that. */
export function railColumns(count) {
  return count <= 3 ? 1 : 2;
}
