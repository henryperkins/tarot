import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Card } from './Card';

const getColumnCount = (width) => {
  if (width < 360) return 1;
  if (width < 720) return 2;
  return 3;
};

export default function ReadingGrid({ cards, revealedCards, onRevealCard }) {
  const { width } = useWindowDimensions();
  const columns = useMemo(() => getColumnCount(width), [width]);
  const horizontalPadding = 8;
  const cardSpacing = 16;
  const availableWidth = Math.max(0, width - horizontalPadding * 2 - cardSpacing * (columns - 1));
  const itemWidth = columns > 0 ? availableWidth / columns : width;

  return (
    <View style={{ paddingHorizontal: horizontalPadding }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cards.map((card, index) => {
          const columnIndex = index % columns;
          const marginRight = columnIndex === columns - 1 ? 0 : cardSpacing;

          return (
            <View
              key={`${card.name}-${index}`}
              style={{
                width: itemWidth,
                marginRight,
                marginBottom: cardSpacing
              }}
            >
              <Card
                card={card}
                position={card.position}
                isRevealed={revealedCards.has(index)}
                onReveal={() => onRevealCard(index)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
