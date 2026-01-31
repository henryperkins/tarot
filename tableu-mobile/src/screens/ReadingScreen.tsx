import { StyleSheet, Text, View } from 'react-native';

export default function ReadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reading</Text>
      <Text style={styles.subtitle}>Card reveal flow will land here next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
});
