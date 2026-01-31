import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SPREADS } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import type { RootStackParamList } from '../navigation/RootNavigator';

const spreadCount = Object.keys(SPREADS).length;
const totalCards = MAJOR_ARCANA.length + MINOR_ARCANA.length;

type HomeNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tableu Mobile</Text>
      <Text style={styles.subtitle}>Migration in progress</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Spreads</Text>
        <Text style={styles.value}>{spreadCount}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Cards</Text>
        <Text style={styles.value}>{totalCards}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => navigation.navigate('Reading')}>
          <Text style={styles.buttonText}>Go to Reading</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => navigation.navigate('Journal')}>
          <Text style={styles.buttonText}>View Journal</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.buttonText}>Open Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#cbd5f5',
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    marginBottom: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    marginTop: 12,
    gap: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#334155',
  },
  buttonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
