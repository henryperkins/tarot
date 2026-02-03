import { Pressable, Text, View } from 'react-native';
import { useReading } from '../contexts/ReadingContext';

export default function DeckRitual() {
  const {
    knockCount,
    handleKnock,
    hasCut,
    cutIndex,
    applyCut,
    dealNext,
    shuffleReading,
    skipRitual,
    reading,
    revealedCards,
    isShuffling
  } = useReading();

  const ritualReady = knockCount >= 3 && hasCut;
  const remaining = Math.max(0, reading.length - revealedCards.size);
  const dealDisabled = !ritualReady || remaining === 0;

  return (
    <View className="rounded-2xl bg-surface p-4">
      <Text className="text-ink text-base">Ritual</Text>
      <Text className="text-ink-muted text-xs mt-1">
        Knock three times, cut the deck, then deal.
      </Text>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-ink-muted text-sm">Knocks</Text>
        <Text className="text-ink text-sm">{knockCount}/3</Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-ink-muted text-sm">Cut</Text>
        <Text className="text-ink text-sm">{hasCut ? `Cut ${cutIndex}` : 'Not cut'}</Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Pressable
          onPress={handleKnock}
          disabled={knockCount >= 3}
          className={`rounded-full px-4 py-2 border border-gold/40 ${knockCount >= 3 ? 'opacity-50' : ''}`}
        >
          <Text className="text-gold text-xs font-semibold">Knock</Text>
        </Pressable>
        <Pressable
          onPress={() => applyCut()}
          disabled={hasCut}
          className={`rounded-full px-4 py-2 border border-gold/40 ${hasCut ? 'opacity-50' : ''}`}
        >
          <Text className="text-gold text-xs font-semibold">Cut deck</Text>
        </Pressable>
        <Pressable
          onPress={skipRitual}
          className="rounded-full px-4 py-2 border border-gold/20"
        >
          <Text className="text-ink-muted text-xs font-semibold">Skip</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Pressable
          onPress={dealNext}
          disabled={dealDisabled}
          className={`rounded-full px-4 py-2 ${dealDisabled ? 'bg-surface-muted/70 border border-gold/30' : 'bg-gold'}`}
        >
          <Text className={`text-xs font-semibold ${dealDisabled ? 'text-ink-muted' : 'text-main'}`}>
            {remaining > 0 ? `Deal next (${remaining} left)` : 'All cards dealt'}
          </Text>
        </Pressable>
        <Pressable
          onPress={shuffleReading}
          className="rounded-full px-4 py-2 border border-gold/30"
        >
          <Text className="text-gold text-xs font-semibold">
            {isShuffling ? 'Shuffling...' : 'Shuffle'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
