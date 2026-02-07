import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const FLIP_DURATION_MS = 420;
const WEB_ASSET_BASE = 'https://tarot.lakefrontdev.com';
const CARD_BACK_URI = `${WEB_ASSET_BASE}/cardback.png`;

const resolveImageUri = (path) => {
  if (!path) return CARD_BACK_URI;
  if (path.startsWith('http')) return path;
  return `${WEB_ASSET_BASE}${path}`;
};

export default function Card({
  card,
  position,
  isRevealed,
  onReveal,
  className
}) {
  const flip = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are designed to be mutated
    flip.value = withTiming(isRevealed ? 1 : 0, {
      duration: FLIP_DURATION_MS,
      easing: Easing.inOut(Easing.ease)
    });
  }, [flip, isRevealed]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flip.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity: flip.value < 0.5 ? 1 : 0
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flip.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity: flip.value >= 0.5 ? 1 : 0
    };
  });

  const label = card?.name || 'Tarot Card';
  const orientation = card?.isReversed ? 'Reversed' : 'Upright';
  const meaning = card?.meaning || (card?.isReversed ? card?.reversed : card?.upright) || 'Meaning placeholder for native card detail.';
  const containerClassName = ['rounded-2xl bg-surface p-4', className].filter(Boolean).join(' ');
  const cardImageUri = resolveImageUri(card?.image);

  return (
    <View className={containerClassName}>
      <Text className="text-ink-muted text-xs uppercase tracking-[0.18em]">{position || 'Position'}</Text>

      <View className="mt-4">
        <View style={styles.frame}>
          <Animated.View style={[styles.face, frontStyle]}>
            <Pressable
              className="flex-1 items-center justify-center rounded-2xl border border-gold/40 bg-main px-4 overflow-hidden"
              onPress={onReveal}
              accessibilityRole="button"
              accessibilityLabel={`Reveal ${label}`}
              disabled={isRevealed}
            >
              <Image source={{ uri: CARD_BACK_URI }} style={styles.backImage} resizeMode="cover" />
              <View style={styles.backOverlay}>
                <Text className="text-gold text-sm font-semibold">Tap to reveal</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.face, backStyle]}>
            <View className="flex-1 rounded-2xl border border-gold/30 bg-surface overflow-hidden">
              <Image
                source={{ uri: cardImageUri }}
                style={[styles.cardImage, card?.isReversed ? styles.reversed : null]}
                resizeMode="cover"
              />
              <View className="px-4 py-3">
                <Text className="text-ink text-base font-semibold text-center">{label}</Text>
                <Text className="text-ink-muted text-xs mt-1 text-center">{orientation}</Text>
                <Text className="text-ink-muted text-xs mt-3 text-center">{meaning}</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 260,
    alignSelf: 'center',
    aspectRatio: 2 / 3
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden'
  },
  backImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16
  },
  backOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.6)'
  },
  cardImage: {
    width: '100%',
    height: '62%'
  },
  reversed: {
    transform: [{ rotate: '180deg' }]
  }
});
