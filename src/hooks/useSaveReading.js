import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from './useJournal';
import { SPREADS } from '../data/spreads';

export function useSaveReading() {
    const {
        reading,
        personalReading,
        themes,
        reflections,
        analysisContext,
        sessionSeed,
        userQuestion,
        selectedSpread,
        setJournalStatus,
        readingMeta
    } = useReading();

    const { deckStyleId } = usePreferences();
    const { saveEntry } = useJournal({ autoLoad: false });

    async function saveReading() {
        if (!reading) {
            setJournalStatus({ type: 'error', message: 'Draw your cards before saving to the journal.' });
            return;
        }
        if (!personalReading || personalReading.isError) {
            setJournalStatus({ type: 'error', message: 'Generate a personalized narrative before saving to the journal.' });
            return;
        }
        const entry = {
            spread: SPREADS[selectedSpread].name,
            spreadKey: selectedSpread,
            question: userQuestion || '',
            cards: reading.map((card, index) => ({
                position: SPREADS[selectedSpread].positions[index] || `Position ${index + 1}`,
                name: card.name,
                number: card.number,
                orientation: card.isReversed ? 'Reversed' : 'Upright'
            })),
            personalReading: personalReading?.raw || personalReading?.normalized || '',
            themes: themes || null,
            reflections: reflections || {},
            context: analysisContext || readingMeta?.graphContext || null,
            provider: personalReading?.provider || 'local',
            sessionSeed,
            deckId: deckStyleId
        };
        try {
            const result = await saveEntry(entry);
            if (result.success) {
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
                setJournalStatus({ type: 'success', message: 'Saved to your journal.' });
            } else {
                setJournalStatus({ type: 'error', message: result.error || 'Unable to save to your journal. Please try again.' });
            }
        } catch (error) {
            console.error('Failed to save tarot reading', error);
            setJournalStatus({ type: 'error', message: 'Unable to save to your journal. Please try again.' });
        }
    }

    return { saveReading };
}
