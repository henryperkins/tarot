import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { buildApiUrl } from '../lib/api';

const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
};

const truncateText = (text, maxLength = 220) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

const formatCardLabel = (card, index) => {
  const name = card?.name || `Card ${index + 1}`;
  const position = card?.position ? `${card.position}: ` : '';
  const orientation = card?.isReversed ? ' (Reversed)' : '';
  return `${position}${name}${orientation}`;
};

export default function ShareReadingScreen() {
  const route = useRoute();
  const token = useMemo(() => {
    const value = route?.params?.token;
    return typeof value === 'string' ? value : '';
  }, [route?.params?.token]);

  const [share, setShare] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const loadShare = useCallback(async () => {
    if (!token) {
      setShare(null);
      setStatus('error');
      setError('This share link is missing a token.');
      return;
    }

    setStatus('loading');
    setError('');
    try {
      const response = await fetch(buildApiUrl(`/api/share/${token}`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load share link.');
      }
      setShare(data);
      setStatus('ready');
    } catch (err) {
      setShare(null);
      setStatus('error');
      setError(err?.message || 'Unable to load share link.');
    }
  }, [token]);

  useEffect(() => {
    loadShare();
  }, [loadShare]);

  const entries = Array.isArray(share?.entries) ? share.entries : [];
  const entryCount = entries.length;
  const headerLabel = entryCount === 1 ? '1 entry' : `${entryCount} entries`;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-gold text-2xl font-semibold">
          {share?.title || 'Shared Reading'}
        </Text>
        <Text className="text-ink-muted mt-1 text-xs">
          {headerLabel} · {formatDate(share?.createdAt)}
        </Text>

        {status === 'loading' ? (
          <View className="mt-6 items-center">
            <ActivityIndicator color="#cbb79d" />
          </View>
        ) : null}

        {error ? (
          <View className="mt-6 rounded-2xl border border-error/40 bg-error/10 px-4 py-3">
            <Text className="text-sm text-error">{error}</Text>
            <Pressable
              onPress={loadShare}
              className="mt-3 items-center rounded-xl border border-gold/30 bg-surface-muted px-4 py-2"
            >
              <Text className="text-xs font-semibold text-ink">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {share?.stats ? (
          <View className="mt-4 flex-row flex-wrap gap-3">
            <Text className="text-xs text-ink-muted">
              {share.stats.totalReadings || 0} readings
            </Text>
            <Text className="text-xs text-ink-muted">
              {share.viewCount || 0} views
            </Text>
            {share.expiresAt ? (
              <Text className="text-xs text-ink-muted">
                Expires {formatDate(share.expiresAt)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {entries.map((entry, index) => (
          <View key={entry.id || `entry-${index}`} className="mt-5 rounded-2xl bg-surface p-4">
            <Text className="text-ink text-base font-semibold">
              {entry.question || `Reading ${index + 1}`}
            </Text>
            <Text className="text-ink-muted mt-1 text-xs">
              {entry.spread || entry.spreadName || 'Unknown spread'} · {formatDate(entry.ts || entry.createdAt)}
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {(entry.cards || []).slice(0, 6).map((card, cardIndex) => (
                <View
                  key={`${card?.name || 'card'}-${cardIndex}`}
                  className="rounded-full border border-gold/20 px-3 py-1"
                >
                  <Text className="text-[11px] text-ink-muted">
                    {formatCardLabel(card, cardIndex)}
                  </Text>
                </View>
              ))}
            </View>

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
