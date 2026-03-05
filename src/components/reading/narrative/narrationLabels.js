export function getNarrationLabels(narrationState) {
  if (narrationState === 'loading') {
    return { full: 'Preparing narration...', compact: 'Loading...' };
  }
  if (narrationState === 'playing') {
    return { full: 'Pause narration', compact: 'Pause' };
  }
  if (narrationState === 'paused') {
    return { full: 'Resume narration', compact: 'Resume' };
  }
  return { full: 'Read this aloud', compact: 'Play' };
}
