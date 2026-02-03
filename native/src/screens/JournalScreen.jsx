import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { ensureJournalDb, listJournalEntries } from '../lib/journalDb';

const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
};

const buildCardPreview = (cards = []) => {
  const names = cards
    .map((card) => card?.name)
    .filter(Boolean);
  if (names.length === 0) return 'No cards recorded';
  const preview = names.slice(0, 3).join(' · ');
  const extra = names.length > 3 ? ` +${names.length - 3} more` : '';
  return `${preview}${extra}`;
};

const truncateText = (text, maxLength = 160) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

export default function JournalScreen() {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const loadEntries = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const db = await ensureJournalDb();
      const rows = await listJournalEntries(db, 30);
      setEntries(rows);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Unable to load journal entries.');
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const isLoading = status === 'loading';
  const isEmpty = !isLoading && entries.length === 0 && !error;
  const headerLabel = useMemo(() => {
    if (entries.length === 1) return '1 entry';
    return `${entries.length} entries`;
  }, [entries.length]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-gold text-2xl font-semibold">Journal</Text>
            <Text className="text-ink-muted mt-1 text-xs">{headerLabel}</Text>
          </View>
          <Pressable
            onPress={loadEntries}
            className="rounded-full border border-gold/30 px-4 py-2"
          >
            <Text className="text-xs font-semibold text-gold">Refresh</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View className="mt-6 items-center">
            <ActivityIndicator color="#cbb79d" />
          </View>
        ) : null}

        {error ? (
          <View className="mt-6 rounded-2xl border border-error/40 bg-error/10 px-4 py-3">
            <Text className="text-sm text-error">{error}</Text>
          </View>
        ) : null}

        {isEmpty ? (
          <View className="mt-6 rounded-2xl border border-gold/20 bg-surface px-4 py-4">
            <Text className="text-ink text-sm font-semibold">No saved readings yet</Text>
            <Text className="text-ink-muted mt-2 text-xs">
              Save a reading from the Reading tab to start your journal.
            </Text>
          </View>
        ) : null}

        {entries.map((entry) => (
          <View key={entry.id} className="mt-5 rounded-2xl bg-surface p-4">
            <Text className="text-ink text-base font-semibold">
              {entry.question || 'Untitled reading'}
            </Text>
            <Text className="text-ink-muted mt-1 text-xs">
              {entry.spreadName || 'Unknown spread'} · {formatDate(entry.createdAt)}
            </Text>
            <Text className="text-ink-muted mt-3 text-xs">
              {buildCardPreview(entry.cards)}
            </Text>
            {entry.personalReading ? (
              <Text className="text-ink-muted mt-3 text-xs leading-relaxed">
                {truncateText(entry.personalReading)}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
