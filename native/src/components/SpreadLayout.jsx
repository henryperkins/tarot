import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Card } from './Card';

export default function SpreadLayout({ cards, revealedCards, onRevealCard, layout }) {
  const { width } = useWindowDimensions();
  const columns = layout?.columns || 1;
  const slots = layout?.slots || cards.map((_, index) => index);
  const horizontalPadding = 8;
  const cardSpacing = 16;
  const availableWidth = Math.max(0, width - horizontalPadding * 2 - cardSpacing * (columns - 1));
  const itemWidth = columns > 0 ? availableWidth / columns : width;

  const slotItems = useMemo(() => {
    return slots.map((slot, slotIndex) => {
      const columnIndex = slotIndex % columns;
      const marginRight = columnIndex === columns - 1 ? 0 : cardSpacing;
      const containerStyle = {
        width: itemWidth,
        marginRight,
        marginBottom: cardSpacing
      };

      if (slot === null || slot === undefined) {
        return <View key={`slot-${slotIndex}`} style={containerStyle} />;
      }

      const card = cards[slot];
      if (!card) {
        return <View key={`slot-${slotIndex}`} style={containerStyle} />;
      }

      return (
        <View key={`${card.name}-${slot}`} style={containerStyle}>
          <Card
            card={card}
            position={card.position}
            isRevealed={revealedCards.has(slot)}
            onReveal={() => onRevealCard(slot)}
          />
        </View>
      );
    });
  }, [cards, columns, itemWidth, onRevealCard, revealedCards, slots]);

  return (
    <View style={{ paddingHorizontal: horizontalPadding }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {slotItems}
      </View>
    </View>
  );
}
