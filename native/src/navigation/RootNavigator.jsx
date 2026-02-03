import { createStackNavigator } from '@react-navigation/stack';
import MainTabs from './MainTabs';
import ShareReadingScreen from '../screens/ShareReadingScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import OAuthCallbackScreen from '../screens/OAuthCallbackScreen';

const Stack = createStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ShareReading" component={ShareReadingScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </Stack.Navigator>
  );
}
