import { useState, useRef, useCallback } from 'react';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from './useJournal';
import { getSpreadInfo } from '../data/spreads';

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

    const { deckStyleId, personalization, incrementJournalSaveCount } = usePreferences();
    const { saveEntry } = useJournal({ autoLoad: false });

    // Prevent double-saves from rapid clicks or network retries
    const [isSaving, setIsSaving] = useState(false);
    const lastSavedSeedRef = useRef(null);

    const saveReading = useCallback(async function saveReading() {
        // Prevent double-saves
        if (isSaving) {
            return;
        }

        // Skip if this exact reading was already saved (same session seed)
        if (sessionSeed && lastSavedSeedRef.current === sessionSeed) {
            setJournalStatus({ type: 'info', message: 'This reading is already saved to your journal.' });
            return;
        }

        if (!reading) {
            setJournalStatus({ type: 'error', message: 'Draw your cards before saving to the journal.' });
            return;
        }
        if (!personalReading || personalReading.isError) {
            setJournalStatus({ type: 'error', message: 'Generate a personalized narrative before saving to the journal.' });
            return;
        }
        const spreadInfo = getSpreadInfo(selectedSpread);
        const entry = {
            spread: spreadInfo?.name || 'Tarot Spread',
            spreadKey: selectedSpread,
            question: userQuestion || '',
            cards: reading.map((card, index) => ({
                position: spreadInfo?.positions?.[index] || `Position ${index + 1}`,
                name: card.name,
                // Major Arcana have `number` (0-21), Minor Arcana have `rankValue` (1-14)
                number: card.number ?? null,
                suit: card.suit ?? null,
                rank: card.rank ?? null,
                rankValue: card.rankValue ?? null,
                orientation: card.isReversed ? 'Reversed' : 'Upright'
            })),
            personalReading: personalReading?.raw || personalReading?.normalized || '',
            themes: themes || null,
            reflections: reflections || {},
            context: analysisContext || readingMeta?.graphContext || null,
            provider: personalReading?.provider || readingMeta?.provider || 'local',
            sessionSeed,
            deckId: deckStyleId,
            // Snapshot of user preferences at the time of the reading (Phase 5.1)
            userPreferences: personalization ? {
                readingTone: personalization.readingTone || 'balanced',
                spiritualFrame: personalization.spiritualFrame || 'mixed',
                tarotExperience: personalization.tarotExperience || 'intermediate',
                // Capture reading depth preference for narrative length consistency
                preferredSpreadDepth: personalization.preferredSpreadDepth || 'standard',
                // Store displayName only if set (avoid null/empty)
                ...(personalization.displayName?.trim() ? { displayName: personalization.displayName.trim() } : {})
            } : null
        };
        setIsSaving(true);
        try {
            const result = await saveEntry(entry);
            if (result.success) {
                // Track successful save to prevent duplicate saves of same reading
                if (sessionSeed) {
                    lastSavedSeedRef.current = sessionSeed;
                }
                // Increment journal save count for nudge system (only for new saves)
                if (!result.deduplicated) {
                    incrementJournalSaveCount();
                }
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
                const message = result.deduplicated
                    ? 'This reading is already in your journal.'
                    : 'Saved to your journal.';
                setJournalStatus({ type: 'success', message });
            } else {
                setJournalStatus({ type: 'error', message: result.error || 'Unable to save to your journal. Please try again.' });
            }
        } catch (error) {
            console.error('Failed to save tarot reading', error);
            setJournalStatus({ type: 'error', message: 'Unable to save to your journal. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    }, [
        isSaving, sessionSeed, reading, personalReading, selectedSpread,
        userQuestion, themes, reflections, analysisContext, readingMeta,
        deckStyleId, personalization, saveEntry, setJournalStatus, incrementJournalSaveCount
    ]);

    return { saveReading, isSaving };
}
