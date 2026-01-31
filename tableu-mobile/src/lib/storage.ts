import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  isAvailable: true,
  async getItem(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Silently ignore storage failures
    }
  },
  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Silently ignore storage failures
    }
  },
};
