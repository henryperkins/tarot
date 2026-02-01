import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Tableau</Text>
        <Text style={styles.subtitle}>Tarot Reading</Text>
        <Text style={styles.description}>
          Mobile app coming soon
        </Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#c9a227',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    color: '#e8d5b7',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
});
