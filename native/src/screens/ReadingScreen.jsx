import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useReading } from '../contexts/ReadingContext';
import ReadingDisplay from '../components/ReadingDisplay';
import ReadingPreparation from '../components/ReadingPreparation';
import SpreadSelector from '../components/SpreadSelector';
import { drawSampleReading } from '../data/cards';
import { getSpreadByKey } from '../data/spreads';
import { SAMPLE_NARRATIVE } from '../data/sampleReading';
import { ensureJournalDb, saveJournalEntry } from '../lib/journalDb';

export default function ReadingScreen() {
  const {
    selectedSpread,
    setSelectedSpread,
    userQuestion,
    reading,
    setReading,
    revealedCards,
    revealCard,
    resetReveals
  } = useReading();
  const spreadRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const allRevealed = reading.length > 0 && revealedCards.size === reading.length;
  const readingSignature = useMemo(
    () => reading.map((card) => `${card.name}-${card.isReversed ? 'r' : 'u'}`).join('|'),
    [reading]
  );

  useEffect(() => {
    if (!selectedSpread) {
      setSelectedSpread('three-card');
    }
  }, [selectedSpread, setSelectedSpread]);

  useEffect(() => {
    const activeSpread = getSpreadByKey(selectedSpread);
    const nextSpreadKey = activeSpread?.key || selectedSpread;
    const cardCount = activeSpread?.cards || 3;
    const positions = activeSpread?.positions;
    const shouldRefresh = reading.length === 0 || spreadRef.current !== nextSpreadKey;

    if (shouldRefresh) {
      setReading(drawSampleReading(cardCount, positions));
      resetReveals();
      spreadRef.current = nextSpreadKey;
    }
  }, [reading.length, resetReveals, selectedSpread, setReading]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset transient save status when reading context changes
    setSaveStatus('idle');
    setSaveError('');
  }, [readingSignature, selectedSpread, userQuestion]);

  const handleSave = async () => {
    if (!allRevealed || saveStatus === 'saving' || saveStatus === 'saved') return;
    setSaveStatus('saving');
    setSaveError('');

    try {
      const db = await ensureJournalDb();
      const activeSpread = getSpreadByKey(selectedSpread);
      await saveJournalEntry(db, {
        question: userQuestion?.trim() || '',
        spreadKey: activeSpread?.key || selectedSpread,
        spreadName: activeSpread?.name || null,
        cards: reading,
        personalReading: SAMPLE_NARRATIVE
      });
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Unable to save this reading.');
    }
  };

  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';
  const buttonDisabled = !allRevealed || isSaving || isSaved;
  const buttonClassName = buttonDisabled ? 'bg-gold/40' : 'bg-gold';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-gold text-2xl font-semibold">Reading</Text>
        <Text className="text-ink-muted mt-1">Native scaffold for the core reading flow.</Text>

        <View className="mt-6 rounded-2xl bg-surface p-4">
          <SpreadSelector
            selectedSpread={selectedSpread}
            onSelectSpread={setSelectedSpread}
          />
        </View>

        <ReadingPreparation />

        <ReadingDisplay
          reading={reading}
          revealedCards={revealedCards}
          onRevealCard={revealCard}
          narrative={SAMPLE_NARRATIVE}
          isGenerating={false}
          layout={getSpreadByKey(selectedSpread)?.layout}
        />

        <View className="mt-4 rounded-2xl bg-surface p-4">
          <Text className="text-ink text-base">Save to journal</Text>
          <Text className="text-ink-muted mt-1 text-xs">
            {allRevealed
              ? 'Capture this reading in your local journal.'
              : 'Reveal all cards to save this reading.'}
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={buttonDisabled}
            className={`mt-4 items-center rounded-xl px-4 py-3 ${buttonClassName}`}
          >
            {isSaving ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text className="text-sm font-semibold text-main">
                {isSaved ? 'Saved' : 'Save reading'}
              </Text>
            )}
          </Pressable>

          {saveStatus === 'error' ? (
            <View className="mt-3 rounded-xl border border-error/40 bg-error/10 px-3 py-2">
              <Text className="text-sm text-error">{saveError}</Text>
            </View>
          ) : null}

          {isSaved ? (
            <Text className="mt-3 text-xs text-success">
              Saved to journal. Visit the Journal tab to review it.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
