export const MOBILE_SETTINGS_DIALOG_ID = 'mobile-settings-drawer';
export const MOBILE_COACH_DIALOG_ID = 'guided-intention-coach';
export const MOBILE_FOLLOWUP_DIALOG_ID = 'mobile-followup-drawer';

export function getActionMode({
  isShuffling,
  reading,
  dealIndex,
  allRevealed,
  needsNarrative,
  hasNarrative,
  isGenerating,
  isError
}) {
  if (isShuffling) return 'shuffling';
  if (!reading) return 'preparation';

  const readingLength = reading.length || 0;
  const dealtCount = Number.isFinite(dealIndex)
    ? Math.min(readingLength, Math.max(0, Math.floor(dealIndex)))
    : readingLength;

  if (dealtCount < readingLength) return 'dealing';
  if (!allRevealed) return 'revealing';
  if (needsNarrative && isGenerating) return 'generating';
  if (needsNarrative && isError) return 'error';
  if (needsNarrative) return 'ready-for-narrative';
  if (hasNarrative) return 'completed';
  return 'completed';
}
