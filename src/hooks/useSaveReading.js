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
        readingMeta,
        followUps
    } = useReading();

    const {
        deckStyleId,
        personalization,
        incrementJournalSaveCount,
        cachedLocation,
        persistLocationToJournal,
        locationEnabled
    } = usePreferences();
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
        if (personalReading?.isStreaming) {
            setJournalStatus({ type: 'error', message: 'Please wait for the narrative to finish before saving.' });
            return;
        }
        const spreadInfo = getSpreadInfo(selectedSpread);

        // Ensure context is a string, not an object (graphContext can be an object)
        // Prioritize analysisContext (string) over graphContext (object)
        let contextValue = null;
        if (typeof analysisContext === 'string' && analysisContext) {
            contextValue = analysisContext;
        } else if (typeof readingMeta?.context === 'string' && readingMeta.context) {
            contextValue = readingMeta.context;
        }
        // Don't use graphContext as context - it's an object (knowledgeGraph data)

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
            context: contextValue,
            provider: personalReading?.provider || readingMeta?.provider || 'local',
            sessionSeed,
            deckId: deckStyleId,
            followUps: Array.isArray(followUps) && followUps.length ? followUps : undefined,
            // Request ID for API tracing/correlation
            requestId: readingMeta?.requestId || null,
            // Snapshot of user preferences at the time of the reading (Phase 5.1)
            userPreferences: personalization ? {
                readingTone: personalization.readingTone || 'balanced',
                spiritualFrame: personalization.spiritualFrame || 'mixed',
                tarotExperience: personalization.tarotExperience || 'intermediate',
                // Capture reading depth preference for narrative length consistency
                preferredSpreadDepth: personalization.preferredSpreadDepth || 'standard',
                // Store displayName only if set (avoid null/empty)
                ...(personalization.displayName?.trim() ? { displayName: personalization.displayName.trim() } : {})
            } : null,
            // Location data (only included if enabled and consent given)
            // Use explicit null/undefined checks - 0° lat/long are valid coordinates
            ...(locationEnabled && persistLocationToJournal &&
                cachedLocation?.latitude != null && cachedLocation?.longitude != null ? {
                location: {
                    latitude: cachedLocation.latitude,
                    longitude: cachedLocation.longitude,
                    timezone: cachedLocation.timezone || null
                },
                persistLocationConsent: true
            } : {})
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
                const entryId = result?.entry?.id;
                setJournalStatus({
                    type: 'success',
                    message,
                    action: entryId ? {
                        label: 'View entry',
                        entryId
                    } : null
                });
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
        deckStyleId, personalization, saveEntry, setJournalStatus, incrementJournalSaveCount,
        locationEnabled, cachedLocation, persistLocationToJournal, followUps
    ]);

    return { saveReading, isSaving };
}
