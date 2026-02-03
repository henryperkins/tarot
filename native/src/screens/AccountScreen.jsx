import { Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';

export default function AccountScreen() {
  return (
    <ScreenContainer>
      <Text className="text-gold text-2xl font-semibold">Account</Text>
      <Text className="text-ink-muted mt-2">
        Account and settings will be migrated in Phase 4.
      </Text>
    </ScreenContainer>
  );
}
