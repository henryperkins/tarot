import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreenContainer({ children }) {
  return (
    <SafeAreaView className="flex-1 bg-main">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        className="px-5 py-6"
      >
        <View className="flex-1">
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
