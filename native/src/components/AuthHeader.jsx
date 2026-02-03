import { Text, View } from 'react-native';

export default function AuthHeader({ title, subtitle, badge }) {
  return (
    <View className="gap-3">
      {badge ? (
        <View className="self-start rounded-full border border-gold/40 bg-gold/10 px-3 py-1">
          <Text className="text-[11px] uppercase tracking-[2px] text-gold">
            {badge}
          </Text>
        </View>
      ) : null}
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-ink">{title}</Text>
        {subtitle ? <Text className="text-sm text-ink-muted">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
