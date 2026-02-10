import { Text } from 'react-native';

const NARRATIVE_STATE_COPY = {
  empty: 'Your narrative will appear here once revealed.',
  generating: 'Weaving your narrative...',
  locked: 'Reveal all cards to unlock your narrative.'
};

function resolveNarrativeState({ state, isLocked, isGenerating, text }) {
  if (state && state !== 'ready') return state;
  if (isLocked) return 'locked';
  if (isGenerating) return 'generating';
  if (!(text || '').trim()) return 'empty';
  return 'ready';
}

export default function StreamingNarrative({ text = '', state = 'ready', isLocked = false, isGenerating = false }) {
  const narrativeState = resolveNarrativeState({ state, isLocked, isGenerating, text });
  const narrative = narrativeState === 'ready'
    ? text
    : (NARRATIVE_STATE_COPY[narrativeState] || NARRATIVE_STATE_COPY.empty);

  return (
    <Text className="text-ink-muted text-sm leading-relaxed mt-2">
      {narrative}
    </Text>
  );
}
