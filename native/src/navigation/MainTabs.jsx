import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ReadingScreen from '../screens/ReadingScreen';
import JournalScreen from '../screens/JournalScreen';
import GalleryScreen from '../screens/GalleryScreen';
import AccountScreen from '../screens/AccountScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2b2c4a'
        },
        tabBarActiveTintColor: '#c9a227',
        tabBarInactiveTintColor: '#cbb79d'
      }}
    >
      <Tab.Screen name="Reading" component={ReadingScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Gallery" component={GalleryScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
