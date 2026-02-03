import { Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';

export default function GalleryScreen() {
  return (
    <ScreenContainer>
      <Text className="text-gold text-2xl font-semibold">Card Gallery</Text>
      <Text className="text-ink-muted mt-2">
        Native image gallery will be implemented after P0.
      </Text>
    </ScreenContainer>
  );
}
