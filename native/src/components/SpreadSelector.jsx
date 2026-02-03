import { FlatList, Pressable, Text, View } from 'react-native';
import { SPREADS } from '../data/spreads';

export default function SpreadSelector({ selectedSpread, onSelectSpread }) {
  const selected = SPREADS.find((spread) => spread.key === selectedSpread);

  return (
    <View>
      <Text className="text-ink text-base">Spread selection</Text>
      <Text className="text-ink-muted text-xs mt-1">
        Selected: {selected ? selected.name : 'None'}
      </Text>

      <FlatList
        data={SPREADS}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
        renderItem={({ item }) => {
          const isSelected = item.key === selectedSpread;
          const containerClassName = isSelected
            ? 'rounded-2xl border border-gold/70 bg-surface-muted px-4 py-3'
            : 'rounded-2xl border border-gold/30 bg-surface px-4 py-3';
          const titleClassName = isSelected ? 'text-gold text-sm font-semibold' : 'text-ink text-sm font-semibold';

          return (
            <Pressable
              className={containerClassName}
              onPress={() => onSelectSpread(item.key)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.name} spread`}
            >
              <Text className={titleClassName}>{item.name}</Text>
              <Text className="text-ink-muted text-xs mt-1">{item.description}</Text>
              <Text className="text-ink-muted text-[11px] mt-2">{item.cards} cards</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
