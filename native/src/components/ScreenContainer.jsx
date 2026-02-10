import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScreenContainer({ children, className }) {
  const containerClassName = ['flex-1 bg-main px-5 py-4', className].filter(Boolean).join(' ');

  return (
    <SafeAreaView className={containerClassName}>
      <View className="flex-1">
        {children}
      </View>
    </SafeAreaView>
  );
}
