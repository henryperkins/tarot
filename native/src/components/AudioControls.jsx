import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Speech from 'expo-speech';

export default function AudioControls({ disabled = false, text = '' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const narrative = useMemo(() => (text || '').trim(), [text]);
  const isDisabled = disabled || !narrative;

  // Stop speech when narrative text changes (cleanup runs on dep change + unmount)
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, [narrative]);

  // Stop speech when controls become disabled
  useEffect(() => {
    if (isDisabled && isPlaying) {
      Speech.stop();
      // onStopped callback from Speech.speak() handles setIsPlaying(false)
    }
  }, [isDisabled, isPlaying]);

  const buttonClassName = isDisabled
    ? 'bg-surface-muted/70 border border-gold/30'
    : 'bg-gold';
  const labelClassName = isDisabled ? 'text-ink-muted' : 'text-main';

  const handlePress = () => {
    if (isDisabled) return;
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
      return;
    }

    Speech.stop();
    setIsPlaying(true);
    Speech.speak(narrative, {
      onDone: () => setIsPlaying(false),
      onStopped: () => setIsPlaying(false),
      onError: () => setIsPlaying(false)
    });
  };

  return (
    <View className="mt-4 flex-row items-center justify-between">
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        className={`rounded-full px-4 py-2 ${buttonClassName}`}
      >
        <Text className={`text-xs font-semibold ${labelClassName}`}>
          {isPlaying ? 'Pause narration' : 'Play narration'}
        </Text>
      </Pressable>
      <Text className="text-ink-muted text-xs">0:00 / 0:00</Text>
    </View>
  );
}
