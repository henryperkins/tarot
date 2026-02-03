import { Text, View } from 'react-native';
import { usePreferences } from '../contexts/PreferencesContext';
import ReadingGrid from './ReadingGrid';
import SpreadLayout from './SpreadLayout';
import StreamingNarrative from './StreamingNarrative';
import AudioControls from './AudioControls';

export default function ReadingDisplay({
  reading,
  revealedCards,
  onRevealCard,
  narrative,
  isGenerating,
  layout
}) {
  const { voiceOn } = usePreferences();
  const isLocked = reading.length === 0 || revealedCards.size < reading.length;
  const hasLayout = layout?.type === 'grid' && Array.isArray(layout.slots) && layout.slots.length > 0;
  const isNarrationDisabled = isLocked || isGenerating || !voiceOn;

  return (
    <View className="mt-4">
      {hasLayout ? (
        <SpreadLayout
          cards={reading}
          revealedCards={revealedCards}
          onRevealCard={onRevealCard}
          layout={layout}
        />
      ) : (
        <ReadingGrid
          cards={reading}
          revealedCards={revealedCards}
          onRevealCard={onRevealCard}
        />
      )}

      <View className="mt-6 rounded-2xl bg-surface p-4">
        <Text className="text-ink text-base">Narrative</Text>
        <StreamingNarrative text={narrative} isLocked={isLocked} isGenerating={isGenerating} />
        <AudioControls disabled={isNarrationDisabled} text={narrative} />
        {!voiceOn ? (
          <Text className="text-ink-muted text-xs mt-2">
            Voice narration is disabled in settings.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
