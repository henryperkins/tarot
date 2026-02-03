import { Text, TextInput, View } from 'react-native';

export default function QuestionInput({ value, onChangeText }) {
  return (
    <View className="mt-3">
      <Text className="text-ink-muted text-xs">Your intention</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="What should I focus on?"
        placeholderTextColor="#cbb79d"
        className="mt-2 rounded-xl border border-gold/30 bg-surface-muted px-3 py-3 text-ink"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}
