import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from './useJournal';
import { getSpreadInfo } from '../data/spreads';
import { sanitizeSourceUsage } from '../../shared/readingSourceUsage';
import { publicVisualSnapshot } from '../lib/readingVisualStorage.js';

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
        followUps,
        visualResume
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

    const { user, isAuthenticated } = useAuth();
    const { canUseCloudJournal } = useSubscription();
    // Include original content as well as seed: regenerating within a spread is
    // a new save target, and an account change must never inherit Saved state.
    const readingKey = JSON.stringify([readingMeta?.readingResultId || null, sessionSeed, selectedSpread, deckStyleId, userQuestion,
        personalReading?.raw || personalReading?.normalized || '', reflections,
        reading?.map(card => [card.name, card.isReversed]),
        isAuthenticated ? user?.id : 'guest', Boolean(isAuthenticated && canUseCloudJournal)]);
    const [statesByKey, setStatesByKey] = useState(() => new Map());
    const setSaveState = useCallback(state => {
        setStatesByKey(previous => new Map(previous).set(state.readingKey, state));
    }, []);
    const saveState = statesByKey.get(readingKey) || { readingKey, status: 'idle', entryId: null, error: null };
    const isSaving = saveState.status === 'saving';
    const inFlight = useRef(new Set());
    const savedEntries = useRef(new Map());
    const currentKey = useRef(readingKey);
    useLayoutEffect(() => { currentKey.current = readingKey; }, [readingKey]);

    const saveReading = useCallback(async function saveReading() {
        if (inFlight.current.has(readingKey)) return;
        if (savedEntries.current.has(readingKey)) {
            setSaveState({ readingKey, status: 'saved', entryId: savedEntries.current.get(readingKey), error: null });
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
            readingResultId: readingMeta?.readingResultId || null,
            visualBinding: readingMeta?.visualBinding || null,
            visual: publicVisualSnapshot({ binding: readingMeta?.visualBinding,
                cueLedger: readingMeta?.visualSnapshot, status: readingMeta?.visualStatus || 'pending',
                raw: personalReading?.raw || personalReading?.normalized || '' }),
            deckId: deckStyleId,
            followUps: Array.isArray(followUps) && followUps.length ? followUps : undefined,
            // Request ID for API tracing/correlation
            requestId: readingMeta?.requestId || null,
            sourceUsage: (personalReading?.provider || readingMeta?.provider) === 'safe-fallback'
                ? null : sanitizeSourceUsage(readingMeta?.sourceUsage),
            // Snapshot of user preferences at the time of the reading (Phase 5.1)
            userPreferences: personalization ? {
                readingTone: personalization.readingTone || 'balanced',
                spiritualFrame: personalization.spiritualFrame || 'mixed',
                tarotExperience: personalization.tarotExperience || 'intermediate',
                // Capture reading depth preference for narrative length consistency
                preferredSpreadDepth: personalization.preferredSpreadDepth || 'standard',
                focusAreas: Array.isArray(personalization.focusAreas)
                    ? personalization.focusAreas.filter((area) => typeof area === 'string' && area.trim().length > 0)
                    : [],
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
        inFlight.current.add(readingKey);
        setSaveState({ readingKey, status: 'saving', entryId: null, error: null });
        try {
            const result = await saveEntry(entry, { visualResume });
            if (result.success) {
                const savedId = result?.entry?.id || null;
                if (!savedId) console.warn('Journal save succeeded without an entry ID; exact-entry navigation is unavailable.');
                savedEntries.current.set(readingKey, savedId);
                setSaveState({ readingKey, status: 'saved', entryId: savedId, error: null });
                // Retain the result for its owner even while another reading or
                // account is active. Only the active owner receives the notice.
                if (currentKey.current !== readingKey) return;
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
                setSaveState({ readingKey, status: 'error', entryId: null, error: result.error || 'Unable to save to your journal.' });
            }
        } catch (error) {
            console.error('Failed to save tarot reading', error);
            setSaveState({ readingKey, status: 'error', entryId: null, error: 'Unable to save to your journal.' });
        } finally {
            inFlight.current.delete(readingKey);
        }
    }, [
        readingKey, sessionSeed, reading, personalReading, selectedSpread,
        userQuestion, themes, reflections, analysisContext, readingMeta,
        deckStyleId, personalization, saveEntry, setJournalStatus, incrementJournalSaveCount,
        locationEnabled, cachedLocation, persistLocationToJournal, followUps, setSaveState, visualResume
    ]);

    return { saveReading, isSaving, saveState, savedEntryId: saveState.status === 'saved' ? saveState.entryId : null };
}
