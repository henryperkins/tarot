import { Text } from 'react-native';

export default function StreamingNarrative({ text, isLocked, isGenerating }) {
  let narrative = text || 'Your narrative will appear here once revealed.';

  if (isGenerating) {
    narrative = 'Weaving your narrative...';
  }

  if (isLocked) {
    narrative = 'Reveal all cards to unlock your narrative.';
  }

  return (
    <Text className="text-ink-muted text-sm leading-relaxed mt-2">
      {narrative}
    </Text>
  );
}
