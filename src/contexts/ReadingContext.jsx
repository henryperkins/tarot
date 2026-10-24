import { emitCueTiming } from '../lib/readingCueTimingProbe.js';
import { createGestureSource, advanceGestureSource } from '../lib/narrativeGestureSource.js';
import { useReadingVisualJob } from '../hooks/useReadingVisualJob.js';
import { sameVisualCueBinding } from '../../shared/contracts/visualCueBinding.js';
import { useAuth } from './AuthContext';
import { patchSavedVisualSnapshot, visualStorageNamespace, writeVisualResume, readVisualResume } from '../lib/readingVisualStorage.js';
import { readingVisualRequestsEnabled } from '../lib/readingGestureSettings.js';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTarotState } from '../hooks/useTarotState';
import { useVisionAnalysis } from '../hooks/useVisionAnalysis';
import { useAudioController } from '../hooks/useAudioController';
import { usePreferences } from './PreferencesContext';
import { safeSessionStorage } from '../lib/preferenceStorage';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { buildPersonalizationRequestPayload } from '../utils/personalizationStorage';
import { formatReading } from '../lib/formatting';
import { createReadingError, formatReadingFailure } from '../lib/readingErrors.js';
import { readReadingJobEvents } from '../lib/readingJobStream.js';
import { buildReadingSnapshot, saveReadingSnapshot } from '../lib/readingSnapshot.js';
import { GUEST_DRAFT_OWNER } from '../lib/questionDraft.js';
import { buildReadingRequestCard } from '../../shared/contracts/readingRequestCards.js';
import { isServerNarrationProvider } from '../../shared/narrationProviders.js';
import { computeRelationships } from '../lib/deck';
import {
    STREAM_NARRATION_MIN_WORDS,
    STREAM_NARRATION_MIN_CHARS,
    STREAM_NARRATION_TARGET_CHARS,
    STREAM_NARRATION_MAX_CHARS,
    findNarrationBreakIndex,
    shouldFlushNarrationBuffer,
    isNarrationPlaybackBusy
} from '../lib/narrationStream.js';

const ReadingContext = createContext(null);

export function ReadingProvider({ children }) {
    const { user, loading: authLoading } = useAuth();
    const visualRequestsEnabled = readingVisualRequestsEnabled();
    const visualNamespace = visualStorageNamespace(user?.id);
    const visualNamespaceRef = useRef(visualNamespace);
    const [visualResume, setVisualResume] = useState(null);
    useEffect(() => { visualNamespaceRef.current = visualNamespace; }, [visualNamespace]);
    // 1. Audio Controller
    const audioController = useAudioController();
    const {
        speak,
        enqueueNarrationChunk,
        finalizeNarrationStream,
        resetNarrationStream,
        isNarrationStreamActive,
        pauseNarrationPlayback,
        resumeNarrationPlayback,
        handleNarrationStop: stopNarration,
        ttsProvider,
        ttsState
    } = audioController;

    // 2. Core Tarot State
    const tarotState = useTarotState(speak);
    const {
        reading,
        drawIncludeMinors,
        drawDeckStyleId,
        readingDeckStyleId: deckStyleId,
        selectedSpread,
        userQuestion,
        revealedCards,
        isSpreadDealt,
        shuffle,
        dealNext: baseDealNext,
        revealCard: baseRevealCard,
        revealAll: baseRevealAll,
        sessionSeed,
        initialSnapshot,
        restoreReady,
        snapshotRevision
    } = tarotState;
    const {
        reversalFramework,
        personalization,
        autoNarrate,
        voiceOn,
        locationEnabled,
        cachedLocation,
        persistLocationToJournal,
        personalizationExplicitFields
    } = usePreferences();

    // 3. Vision Analysis
    const visionAnalysis = useVisionAnalysis(reading, deckStyleId);
    const { visionResults, visionConflicts, resetVisionProof: _resetVisionProof, ensureVisionProof, getVisionConflictsForCards, setVisionConflicts } = visionAnalysis;

    const personalizationForRequest = useMemo(() => {
        if (!personalization || typeof personalization !== 'object') {
            return null;
        }

        return buildPersonalizationRequestPayload(personalization, personalizationExplicitFields);
    }, [personalization, personalizationExplicitFields]);

    // 4. Reading Generation State
    // A finished reading restored after a reload (lib/readingSnapshot) starts
    // complete, exactly as the stream's `done` event leaves it.
    const restoredAnalysis = initialSnapshot?.narrative ? (initialSnapshot.analysis || {}) : null;
    const [personalReading, setPersonalReading] = useState(() => {
        const narrative = initialSnapshot?.narrative;
        if (!narrative) return null;
        const formatted = formatReading(narrative.raw);
        formatted.isError = false;
        formatted.isStreaming = false;
        formatted.isServerStreamed = true;
        formatted.provider = narrative.provider || 'local-composer';
        formatted.requestId = narrative.requestId || null;
        return formatted;
    });
    const [gestureSource, setGestureSource] = useState(() => {
        if (!initialSnapshot?.narrative) return null;
        const meta = restoredAnalysis?.readingMeta || {};
        return createGestureSource({ runId: meta.readingResultId || crypto.randomUUID(),
            raw: initialSnapshot.narrative.raw, status: 'complete',
            sourceRevision: meta.visualBinding?.sourceRevision || 0,
            visualBinding: meta.visualBinding, cueLedger: meta.visualSnapshot, visualJobStatus: meta.visualStatus });
    });
    const gestureSourceRef = useRef(gestureSource);
    const [readingMeta, setReadingMeta] = useState(() => ({
        requestId: null,
        provider: null,
        spreadKey: null,
        spreadName: null,
        deckStyle: null,
        userQuestion: null,
        graphContext: null,
        ephemeris: null,
        sourceUsage: null,
        ...(restoredAnalysis?.readingMeta || {})
    }));
    const updateGestureSource = useCallback((runId, update) => {
        if (!gestureSourceRef.current || gestureSourceRef.current.runId !== runId) return;
        const previous = gestureSourceRef.current;
        const replaced = typeof update.raw === 'string' && !update.raw.startsWith(previous.raw);
        const nextBinding = replaced && previous.visualBinding
            ? { ...previous.visualBinding, sourceRevision: previous.sourceRevision + 1 } : null;
        const suppliedBinding = update.visualBinding?.sourceRevision >= previous.sourceRevision + (replaced ? 1 : 0)
            ? update.visualBinding : null;
        const { visualBinding: _incomingBinding, ...sourceUpdate } = update;
        const authoritativeBinding = suppliedBinding || nextBinding;
        // A controller-established replacement has a new visual epoch. Do not
        // expose fallback turns while the new subscription is still mounting.
        const replacingVisualJob = authoritativeBinding && previous.visualJobStatus
            && !sameVisualCueBinding(authoritativeBinding, previous.visualBinding);
        const next = advanceGestureSource(previous, { ...sourceUpdate,
            ...(replacingVisualJob ? { visualJobStatus: 'pending' } : {}),
            ...(authoritativeBinding ? { visualBinding: authoritativeBinding } : {}) });
        gestureSourceRef.current = next;
        setGestureSource(next);
        if (next.visualBinding && next.sourceRevision !== previous.sourceRevision) {
            setVisualResume(current => current?.readingResultId === runId ? { ...current, visualBinding: next.visualBinding } : current);
            setReadingMeta(current => ({ ...current, visualBinding: next.visualBinding, visualSnapshot: null }));
        }
    }, []);
    const beginGestureSource = useCallback((runId = crypto.randomUUID(), options = {}) => {
        const next = createGestureSource({ runId, ...options });
        gestureSourceRef.current = next;
        setGestureSource(next);
        return runId;
    }, []);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isReadingStreamActive, setIsReadingStreamActive] = useState(false);
    const [narrativePhase, setNarrativePhase] = useState(() => (initialSnapshot?.narrative ? 'complete' : 'idle'));
    const [spreadAnalysis, setSpreadAnalysis] = useState(() => restoredAnalysis?.spreadAnalysis ?? null);
    const [themes, setThemes] = useState(() => restoredAnalysis?.themes ?? null);
    const [emotionalTone, setEmotionalTone] = useState(() => restoredAnalysis?.emotionalTone ?? null);
    const [analysisContext, setAnalysisContext] = useState(() => restoredAnalysis?.analysisContext ?? null);
    const [reasoningSummary, setReasoningSummary] = useState(null);
    const [reasoning, setReasoning] = useState(null);
    const [followUps, setFollowUps] = useState(() => initialSnapshot?.followUp?.turns || []);
    // Composer recovery belongs to the same owner and reading as the snapshot.
    // Include the seed as well as the request ID so drawing again retires drafts
    // before the next narrative has received its request ID.
    const followUpOwner = restoreReady ? tarotState.snapshotOwner : initialSnapshot?.owner ?? tarotState.snapshotOwner;
    const followUpIdentity = JSON.stringify([followUpOwner, readingMeta?.requestId, sessionSeed, readingMeta?.readingId]);
    const [followUpComposer, setFollowUpComposer] = useState(() => ({
        owner: followUpOwner,
        identity: followUpIdentity,
        draft: initialSnapshot?.followUp?.draft || '',
        includeJournal: initialSnapshot?.followUp?.includeJournal ?? true
    }));
    if (followUpComposer.owner !== followUpOwner || followUpComposer.identity !== followUpIdentity) {
        setFollowUpComposer({ owner: followUpOwner, identity: followUpIdentity, draft: '', includeJournal: true });
    }
    const setFollowUpDraft = useCallback(draft => {
        setFollowUpComposer(current => current.owner === followUpOwner && current.identity === followUpIdentity
            ? { ...current, draft } : current);
    }, [followUpOwner, followUpIdentity]);
    const setIncludeJournalContext = useCallback(includeJournal => {
        setFollowUpComposer(current => current.owner === followUpOwner && current.identity === followUpIdentity
            ? { ...current, includeJournal } : current);
    }, [followUpOwner, followUpIdentity]);
    const acceptVisualStatus = useCallback(({ binding, status }) => {
        const current = gestureSourceRef.current;
        if (!current || !sameVisualCueBinding(current.visualBinding, binding)) return;
        updateGestureSource(current.runId, { visualJobStatus: status });
        setReadingMeta(previous => ({ ...previous, visualStatus: status }));
    }, [updateGestureSource]);
    const acceptVisualSnapshot = useCallback(({ binding, cueLedger, status }) => {
        const current = gestureSourceRef.current;
        if (!current || !sameVisualCueBinding(current.visualBinding, binding)) return;
        updateGestureSource(current.runId, { cueLedger, visualJobStatus: status });
        if (gestureSourceRef.current?.cueLedger !== cueLedger) return;
        setReadingMeta(previous => ({ ...previous, readingResultId: binding.readingResultId,
            visualBinding: binding, visualSnapshot: cueLedger, visualStatus: status }));
        patchSavedVisualSnapshot({ namespace: visualNamespaceRef.current, binding, cueLedger, status });
    }, [updateGestureSource]);
    useReadingVisualJob({
        readingResultId: visualResume?.readingResultId,
        visualBinding: visualResume?.visualBinding,
        visualJobToken: visualResume?.visualJobToken,
        raw: gestureSource?.raw || '',
        enabled: visualRequestsEnabled && !authLoading && visualResume?.namespace === visualNamespace,
        onBatch: acceptVisualSnapshot,
        onStatus: acceptVisualStatus
    });

    // 5. UI State
    const [journalStatus, setJournalStatus] = useState(null);
    useEffect(() => {
        if (!visualResume || visualResume.namespace !== visualNamespace || authLoading) return;
        writeVisualResume({ namespace: visualNamespace, binding: visualResume.visualBinding,
            resumeHandle: visualResume });
    }, [visualResume, visualNamespace, authLoading]);
    const restoredVisualAttempt = useRef(false);
    useEffect(() => {
        if (restoredVisualAttempt.current || !restoreReady || authLoading || !initialSnapshot?.narrative) return;
        restoredVisualAttempt.current = true;
        const meta = initialSnapshot.analysis?.readingMeta;
        const owner = initialSnapshot.owner === GUEST_DRAFT_OWNER ? 'anon' : initialSnapshot.owner;
        if (owner !== visualNamespace || !meta?.visualBinding) return;
        const handle = readVisualResume({ namespace: visualNamespace, readingResultId: meta.readingResultId,
            binding: meta.visualBinding });
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the private capability only after authentication validates the snapshot owner
        if (handle) setVisualResume({ ...handle, namespace: visualNamespace });
        else if (['pending', 'running'].includes(meta.visualStatus)) {
            updateGestureSource(meta.readingResultId, { visualJobStatus: 'expired' });
            setReadingMeta(current => ({ ...current, visualStatus: 'expired' }));
        }
    }, [restoreReady, authLoading, initialSnapshot, visualNamespace, updateGestureSource]);

    const [useSavedMemories, setUseSavedMemories] = useState(() => initialSnapshot?.useSavedMemories !== false);
    const [reflections, setReflections] = useState(() => initialSnapshot?.reflections || {});
    const [lastCardsForFeedback, setLastCardsForFeedback] = useState(() => (
        Array.isArray(restoredAnalysis?.lastCardsForFeedback) ? restoredAnalysis.lastCardsForFeedback : []
    ));
    const [showAllHighlights, setShowAllHighlights] = useState(false);
    const [srAnnouncement, setSrAnnouncement] = useState('');

    // Keep the reading recoverable after a reload, a discarded background tab
    // or a sign-in redirect (lib/readingSnapshot). A reading still being
    // written resumes from its job checkpoint instead, so streamed text is not
    // stored until it is complete.
    const {
        snapshotOwner,
        hasUserSelectedSpread,
        dealIndex,
        hasConfirmedSpread,
        hasKnocked,
        knockCount,
        hasCut,
        cutIndex,
        knockTimesRef
    } = tarotState;

    const [appliedSnapshotRevision, setAppliedSnapshotRevision] = useState(0);
    useEffect(() => {
        if (!snapshotRevision) return;
        // The restored reading belonged to another account; drop all of it.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears a snapshot rejected after auth settled
        setPersonalReading(null);
        setNarrativePhase('idle');
        setReadingMeta({});
        setVisualResume(null);
        gestureSourceRef.current = null;
        setGestureSource(null);
        setThemes(null);
        setEmotionalTone(null);
        setSpreadAnalysis(null);
        setAnalysisContext(null);
        setReflections({});
        setUseSavedMemories(true);
        setLastCardsForFeedback([]);
        setFollowUps([]);
        setReasoning(null);
        setReasoningSummary(null);
        setJournalStatus(null);
        setAppliedSnapshotRevision(snapshotRevision);
    }, [snapshotRevision]);

    // While the reading is written, `finishedReading` stays null, so streamed
    // chunks do not rewrite the snapshot; the cards, question and reflections
    // are still saved, which is what reattaching to the job needs.
    const finishedReading = narrativePhase === 'complete' && personalReading
        && !personalReading.isError && !personalReading.isStreaming
        ? personalReading
        : null;
    const pendingSnapshotRef = useRef(null);
    // The account a reading was drawn under. Account changes clear owned
    // readings; a guest's completed reading follows them into a sign-in.
    const readingOwnerRef = useRef(initialSnapshot?.owner ?? null);
    const ownedReadingRef = useRef(reading);
    useEffect(() => {
        if (reading === ownedReadingRef.current) return;
        ownedReadingRef.current = reading;
        readingOwnerRef.current = reading ? snapshotOwner : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the owner is captured when the cards change
    }, [reading]);

    useEffect(() => {
        // Until auth settles, the stored snapshot is the one just restored.
        if (!restoreReady) return undefined;
        const save = () => {
            pendingSnapshotRef.current = null;
            const owner = readingOwnerRef.current;
            if (owner && owner !== snapshotOwner && owner !== GUEST_DRAFT_OWNER) {
                saveReadingSnapshot(null);
                return;
            }
            if (owner === GUEST_DRAFT_OWNER) readingOwnerRef.current = snapshotOwner;
            saveReadingSnapshot(buildReadingSnapshot({
                owner: snapshotOwner,
                spreadKey: selectedSpread,
                hasUserSelectedSpread,
                reading,
                drawIncludeMinors,
                drawDeckStyleId,
                isSpreadDealt,
                revealedCards,
                dealIndex,
                hasConfirmedSpread,
                sessionSeed,
                ritual: { hasKnocked, knockCount, hasCut, cutIndex, knockTimes: knockTimesRef.current },
                question: userQuestion,
                useSavedMemories,
                reflections,
                narrative: finishedReading,
                followUp: { draft: followUpComposer.draft, includeJournal: followUpComposer.includeJournal, turns: followUps },
                analysis: finishedReading
                    ? { themes, emotionalTone, spreadAnalysis, analysisContext, readingMeta, lastCardsForFeedback }
                    : null
            }));
        };
        pendingSnapshotRef.current = save;
        const timer = setTimeout(save, 250);
        return () => clearTimeout(timer);
    }, [
        restoreReady, snapshotOwner, selectedSpread, hasUserSelectedSpread, reading, drawIncludeMinors, drawDeckStyleId, isSpreadDealt, revealedCards,
        dealIndex, hasConfirmedSpread, sessionSeed, hasKnocked, knockCount, hasCut, cutIndex, knockTimesRef,
        userQuestion, useSavedMemories, reflections, finishedReading, themes, emotionalTone, spreadAnalysis, analysisContext,
        readingMeta, lastCardsForFeedback, followUpComposer, followUps
    ]);

    // A reload, a discarded background tab or a sign-in redirect can come
    // within the save delay; write the latest state as the page is hidden.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const flush = () => pendingSnapshotRef.current?.();
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    const visionResearchEnabled = import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true';
    const inFlightReadingRef = useRef(null);
    const readingJobRef = useRef({
        jobId: null,
        jobToken: null,
        cursor: 0,
        readingKey: null
    });
    const cursorPersistRef = useRef({
        lastPersistAt: 0,
        eventCount: 0,
        lastJobId: null
    });
    const cardsInfoRef = useRef([]);
    const narrationBufferRef = useRef('');
    const narrationSuppressedRef = useRef(false);
    const narrationStartedRef = useRef(false);
    const narrationEmotionRef = useRef(null);
    const narrationQueuedCharsRef = useRef(0);
    const narrationFallbackPendingRef = useRef(false);
    const narrationFallbackTextRef = useRef('');
    const narrationInterruptedByUserRef = useRef(false);
    const handleNarrationStop = useCallback(() => {
        narrationInterruptedByUserRef.current = true;
        narrationSuppressedRef.current = true;
        narrationFallbackPendingRef.current = false;
        narrationFallbackTextRef.current = '';
        stopNarration();
    }, [stopNarration]);
    const narrationSettingsRef = useRef({
        autoNarrate,
        voiceOn,
        ttsProvider
    });
    const isTarotRouteRef = useRef(true);

    useEffect(() => () => {
        inFlightReadingRef.current?.controller?.abort();
        inFlightReadingRef.current = null;
    }, []);

    const readingJobStorageKey = 'tarot:reading-job';

    useEffect(() => {
        narrationSettingsRef.current = {
            autoNarrate,
            voiceOn,
            ttsProvider
        };
    }, [autoNarrate, voiceOn, ttsProvider]);

    const persistReadingJob = useCallback((nextState) => {
        safeSessionStorage.setItem(readingJobStorageKey, JSON.stringify(nextState));
    }, []);

    const setReadingJob = useCallback((updates) => {
        const nextState = { ...readingJobRef.current, ...updates };
        readingJobRef.current = nextState;
        persistReadingJob(nextState);
    }, [persistReadingJob]);

    const updateReadingJobCursor = useCallback((eventId, { force = false } = {}) => {
        const currentJobId = readingJobRef.current?.jobId || null;
        if (!currentJobId) return;
        if (cursorPersistRef.current.lastJobId !== currentJobId) {
            cursorPersistRef.current = {
                lastPersistAt: 0,
                eventCount: 0,
                lastJobId: currentJobId
            };
        }
        let nextCursor = readingJobRef.current?.cursor || 0;
        if (Number.isFinite(eventId) && eventId > nextCursor) {
            nextCursor = eventId;
            readingJobRef.current = { ...readingJobRef.current, cursor: nextCursor };
        } else if (!force) {
            return;
        }
        const now = Date.now();
        if (force) {
            cursorPersistRef.current.lastPersistAt = now;
            cursorPersistRef.current.eventCount = 0;
            persistReadingJob(readingJobRef.current);
            return;
        }
        cursorPersistRef.current.eventCount += 1;
        const shouldPersist =
            cursorPersistRef.current.eventCount >= 5 ||
            now - cursorPersistRef.current.lastPersistAt >= 1000;
        if (!shouldPersist) return;
        cursorPersistRef.current.lastPersistAt = now;
        cursorPersistRef.current.eventCount = 0;
        persistReadingJob(readingJobRef.current);
    }, [persistReadingJob]);

    const clearReadingJob = useCallback(() => {
        readingJobRef.current = {
            jobId: null,
            jobToken: null,
            cursor: 0,
            readingKey: null
        };
        cursorPersistRef.current = {
            lastPersistAt: 0,
            eventCount: 0,
            lastJobId: null
        };
        safeSessionStorage.removeItem(readingJobStorageKey);
    }, []);

    const cancelInFlightReading = useCallback(() => {
        narrationFallbackPendingRef.current = false;
        narrationFallbackTextRef.current = '';
        if (inFlightReadingRef.current?.controller) {
            inFlightReadingRef.current.controller.abort();
        }
        inFlightReadingRef.current = null;
        resetNarrationStream();

        const { jobId, jobToken } = readingJobRef.current || {};
        if (jobId && jobToken) {
            fetch(`/api/tarot-reading/jobs/${jobId}/cancel`, {
                method: 'POST',
                headers: { 'X-Job-Token': jobToken }
            }).catch(() => null);
        }

        clearReadingJob();
    }, [clearReadingJob, resetNarrationStream]);

    const lastVisualNamespace = useRef(null);
    useEffect(() => {
        if (authLoading) return;
        const previous = lastVisualNamespace.current;
        lastVisualNamespace.current = visualNamespace;
        if (!previous || previous === visualNamespace) return;
        cancelInFlightReading();
        gestureSourceRef.current = null;
        // An external account change retires the previous user's in-memory reading.
        setVisualResume(null);
        setGestureSource(null);
        const keepGuestReading = previous === 'anon';
        if (keepGuestReading) {
            setPersonalReading(current => current?.isStreaming ? null : current);
            setReadingMeta(current => ({ ...current, readingResultId: null, visualBinding: null,
                visualSnapshot: null, visualStatus: 'idle' }));
        } else {
            setPersonalReading(null);
            setReadingMeta({});
        }
        setIsGenerating(false);
        setIsReadingStreamActive(false);
        setNarrativePhase(current => keepGuestReading && current === 'complete' ? 'complete' : 'idle');
    }, [authLoading, visualNamespace, cancelInFlightReading]);

    const resetStreamingNarration = useCallback(() => {
        narrationBufferRef.current = '';
        narrationSuppressedRef.current = false;
        narrationStartedRef.current = false;
        narrationEmotionRef.current = null;
        narrationQueuedCharsRef.current = 0;
        narrationFallbackPendingRef.current = false;
        narrationFallbackTextRef.current = '';
        narrationInterruptedByUserRef.current = false;
        resetNarrationStream();
    }, [resetNarrationStream]);

    // Reset analysis state when Shuffle is triggered
    const handleShuffle = useCallback(() => {
        cancelInFlightReading();
        setVisualResume(null);
        setReadingMeta(previous => ({ ...previous, readingResultId: null, visualBinding: null, visualSnapshot: null }));
        resetStreamingNarration();
        shuffle(() => {
            setPersonalReading(null);
            setThemes(null);
            setEmotionalTone(null);
            setSpreadAnalysis(null);
            setAnalysisContext(null);
            setReasoningSummary(null);
            setReasoning(null);
            setIsGenerating(false);
            setIsReadingStreamActive(false);
            setNarrativePhase('idle');
            setJournalStatus(null);
            setReflections({});
            if (reading?.length) setUseSavedMemories(true);
            setFollowUps([]);
            cardsInfoRef.current = [];
            visionAnalysis.setVisionResults([]);
            visionAnalysis.setVisionConflicts([]);
            visionAnalysis.resetVisionProof();
            setShowAllHighlights(false);
            setSrAnnouncement('');
        });
    }, [shuffle, visionAnalysis, cancelInFlightReading, resetStreamingNarration, reading]);

    const pauseReadingStream = useCallback((message = 'Finishing your narrative in the background.', { preserveNarration = true } = {}) => {
        setIsReadingStreamActive(false);
        updateGestureSource(gestureSourceRef.current?.runId, { status: 'paused' });
        setSrAnnouncement(message);
        if (preserveNarration) {
            pauseNarrationPlayback();
            return;
        }
        resetNarrationStream();
    }, [pauseNarrationPlayback, resetNarrationStream, updateGestureSource]);

    const flushNarrationBuffer = useCallback((force = false) => {
        const {
            autoNarrate: autoNarrateEnabled,
            voiceOn: voiceEnabled,
            ttsProvider: narrationProvider
        } = narrationSettingsRef.current;
        if (!autoNarrateEnabled || !voiceEnabled || !isServerNarrationProvider(narrationProvider)) {
            narrationSuppressedRef.current = true;
            return;
        }
        if (narrationSuppressedRef.current) return;

        const buffer = narrationBufferRef.current;
        if (!buffer || !buffer.trim()) return;
        const shouldFlush = shouldFlushNarrationBuffer({
            buffer,
            force,
            narrationStarted: narrationStartedRef.current,
            minWords: STREAM_NARRATION_MIN_WORDS,
            minChars: STREAM_NARRATION_MIN_CHARS,
            targetChars: STREAM_NARRATION_TARGET_CHARS,
            maxChars: STREAM_NARRATION_MAX_CHARS
        });
        if (!shouldFlush) return;

        let remaining = buffer;
        while (remaining.trim()) {
            const maxIndex = force ? remaining.length : Math.min(remaining.length, STREAM_NARRATION_MAX_CHARS);
            const canFlushShortOpeningChunk = !force && !narrationStartedRef.current && shouldFlushNarrationBuffer({
                buffer: remaining,
                force: false,
                narrationStarted: false,
                minWords: STREAM_NARRATION_MIN_WORDS,
                minChars: STREAM_NARRATION_MIN_CHARS,
                targetChars: STREAM_NARRATION_TARGET_CHARS,
                maxChars: STREAM_NARRATION_MAX_CHARS
            });
            if (!force && remaining.length < STREAM_NARRATION_TARGET_CHARS && !canFlushShortOpeningChunk) {
                break;
            }
            const cutIndex = findNarrationBreakIndex(remaining, maxIndex, {
                minChars: STREAM_NARRATION_MIN_CHARS
            });
            const chunk = remaining.slice(0, cutIndex).trim();
            remaining = remaining.slice(cutIndex);
            if (chunk) {
                const enqueued = enqueueNarrationChunk(chunk, 'full-reading', narrationEmotionRef.current);
                if (!enqueued) {
                    narrationSuppressedRef.current = true;
                    break;
                }
                narrationQueuedCharsRef.current += chunk.length;
                narrationStartedRef.current = true;
            }
            if (force) {
                continue;
            }
            if (remaining.length < STREAM_NARRATION_TARGET_CHARS) {
                break;
            }
        }

        narrationBufferRef.current = remaining;
    }, [
        enqueueNarrationChunk
    ]);

    const appendNarrationBuffer = useCallback((text) => {
        if (!text) return;
        const {
            autoNarrate: autoNarrateEnabled,
            ttsProvider: narrationProvider
        } = narrationSettingsRef.current;
        const shouldTrackBuffer = autoNarrateEnabled && isServerNarrationProvider(narrationProvider);
        if (!shouldTrackBuffer && narrationSuppressedRef.current) {
            return;
        }
        narrationBufferRef.current = `${narrationBufferRef.current}${text}`;
        if (narrationSuppressedRef.current) return;
        flushNarrationBuffer(false);
    }, [flushNarrationBuffer]);

    const settleNarrationAfterStreamFailure = useCallback(() => {
        // Partial output has not passed the completed reading's screening.
        narrationBufferRef.current = '';
        narrationSuppressedRef.current = true;
        narrationFallbackPendingRef.current = false;
        narrationFallbackTextRef.current = '';
        resetNarrationStream();
    }, [resetNarrationStream]);

    const buildReadingKey = useCallback(() => {
        const count = reading?.length ?? 0;
        const fingerprint = Array.isArray(reading)
            ? reading.map((card) => {
                const name = typeof card?.name === 'string' ? card.name : '';
                const reversed = card?.isReversed ? 'R' : 'U';
                return `${name}:${reversed}`;
            }).join('|')
            : '';
        // Include user inputs so resume is invalidated when question/reflections change
        const questionKey = typeof userQuestion === 'string' ? userQuestion.trim() : '';
        const reflectionsKey = Object.entries(reflections || {})
            .filter(([, v]) => typeof v === 'string' && v.trim())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v.trim()}`)
            .join('|');
        const personalizationKey = personalizationForRequest
            ? JSON.stringify(personalizationForRequest)
            : '';
        return JSON.stringify({
            spreadKey: normalizeSpreadKey(selectedSpread),
            count,
            seed: sessionSeed || null,
            fingerprint: fingerprint || null,
            question: questionKey || null,
            useSavedMemories,
            reflections: reflectionsKey || null,
            personalization: personalizationKey || null
        });
    }, [reading, selectedSpread, sessionSeed, userQuestion, useSavedMemories, reflections, personalizationForRequest]);

    const streamReadingJob = useCallback(async ({ jobId, jobToken, cursor = 0, resume = false }) => {
        if (!jobId || !jobToken) return;

        if (inFlightReadingRef.current?.controller) {
            inFlightReadingRef.current.controller.abort();
        }

        const controller = new AbortController();
        const runId = readingJobRef.current.runId || gestureSourceRef.current?.runId || crypto.randomUUID();
        if (gestureSourceRef.current?.runId !== runId) beginGestureSource(runId, {
            visualBinding: readingJobRef.current.visualBinding,
            sourceRevision: readingJobRef.current.visualBinding?.sourceRevision || 0,
            ...(visualRequestsEnabled && readingJobRef.current.visualBinding ? { visualJobStatus: 'pending' } : {})
        });
        updateGestureSource(runId, { status: 'streaming' });
        inFlightReadingRef.current = { controller, jobId };

        const isActiveRequest = () =>
            !controller.signal.aborted &&
            readingJobRef.current?.jobId === jobId &&
            inFlightReadingRef.current?.controller === controller;

        const safeSpreadKey = normalizeSpreadKey(selectedSpread);
        const spreadInfo = getSpreadInfo(safeSpreadKey);

        setIsReadingStreamActive(true);
        setIsGenerating(true);
        if (!resume) {
            resetStreamingNarration();
        }
        const streamNarrationEnabled = autoNarrate && voiceOn && isServerNarrationProvider(ttsProvider);
        const isTtsBusy = isNarrationPlaybackBusy(ttsState?.status);
        if (!streamNarrationEnabled) {
            narrationSuppressedRef.current = true;
        } else if (!resume) {
            narrationSuppressedRef.current = isTtsBusy && !isNarrationStreamActive();
        } else if (narrationSuppressedRef.current && !narrationInterruptedByUserRef.current) {
            narrationSuppressedRef.current = isTtsBusy && !isNarrationStreamActive();
        }
        if (!narrationSuppressedRef.current) {
            flushNarrationBuffer(false);
        }

        let streamedText = resume
            ? (gestureSourceRef.current?.raw || personalReading?.raw || personalReading?.normalized || '')
            : '';
        let streamMeta = null;
        let streamVisualBinding = readingJobRef.current?.visualBinding || gestureSourceRef.current?.visualBinding;
        let sourceKind = 'append';
        let flushTimer = null;

        try {
            let lastFlush = 0;

            const updateCursor = (eventId) => {
                if (!isActiveRequest()) return;
                updateReadingJobCursor(eventId);
            };

            const flushStreamedText = (force = false) => {
                if (!isActiveRequest()) return;
                const now = Date.now();
                if (!force && now - lastFlush < 120) {
                    if (flushTimer === null) {
                        flushTimer = setTimeout(() => {
                            flushTimer = null;
                            flushStreamedText(true);
                        }, 120 - (now - lastFlush));
                    }
                    return;
                }
                if (flushTimer !== null) {
                    clearTimeout(flushTimer);
                    flushTimer = null;
                }
                lastFlush = now;
                updateGestureSource(runId, { raw: streamedText, kind: sourceKind, status: 'streaming',
                    ...(streamVisualBinding ? { visualBinding: streamVisualBinding } : {}) });
                if (gestureSourceRef.current?.visualBinding) readingJobRef.current.visualBinding = gestureSourceRef.current.visualBinding;
                const formatted = formatReading(streamedText);
                formatted.isError = false;
                formatted.isStreaming = true;
                formatted.isServerStreamed = true;
                if (streamMeta?.provider) {
                    formatted.provider = streamMeta.provider;
                }
                if (streamMeta?.requestId) {
                    formatted.requestId = streamMeta.requestId;
                }
                setPersonalReading(formatted);
            };

            for await (const { event: eventType, data } of readReadingJobEvents({
                jobId,
                jobToken,
                cursor,
                signal: controller.signal,
                onReconnect: () => {
                    if (!isActiveRequest()) return;
                    updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                    if (streamedText) flushStreamedText(true);
                    setSrAnnouncement('Reconnecting to your narrative. Your reading is still being prepared.');
                }
            })) {
                if (!isActiveRequest()) return;
                emitCueTiming('narrative-receipt', { runId,
                    sourceRevision: data?.visualBinding?.sourceRevision ?? streamVisualBinding?.sourceRevision ?? 0,
                    eventId: data?.eventId, eventType,
                    start: eventType === 'delta' ? streamedText.length : 0,
                    end: eventType === 'delta' ? streamedText.length + (data?.text?.length || 0)
                        : typeof data?.fullText === 'string' ? data.fullText.length : streamedText.length,
                    complete: eventType === 'done' });
                updateCursor(data?.eventId);
                if (data?.visualBinding) streamVisualBinding = data.visualBinding;

                if (eventType === 'meta') {
                    streamMeta = data;
                    if (Object.hasOwn(data, 'semanticDocument')) updateGestureSource(runId, { semanticDocument: data.semanticDocument });
                    if (data?.themes !== undefined) {
                        setThemes(data.themes || null);
                    }
                    if (data?.emotionalTone !== undefined) {
                        setEmotionalTone(data.emotionalTone || null);
                        narrationEmotionRef.current = data?.emotionalTone?.emotion || null;
                    }
                    if (data?.spreadAnalysis !== undefined) {
                        setSpreadAnalysis(data.spreadAnalysis || null);
                    }
                    if (data?.context !== undefined) {
                        setAnalysisContext(data.context || null);
                    }
                    if (data?.reasoning !== undefined) {
                        setReasoning(data.reasoning || null);
                    }
                    if (isActiveRequest()) {
                        setReadingMeta(previous => ({
                            ...previous,
                            requestId: data.requestId || null,
                            provider: data.provider || 'local',
                            spreadKey: safeSpreadKey,
                            spreadName: spreadInfo?.name || null,
                            deckStyle: deckStyleId,
                            userQuestion,
                            graphContext: data.themes?.knowledgeGraph || null,
                            ephemeris: data.ephemeris || null,
                            sourceUsage: data.provider === 'safe-fallback' ? null : (data.sourceUsage || null)
                        }));
                    }
                } else if (eventType === 'snapshot') {
                    if (typeof data.fullText === 'string') {
                        streamedText = data.fullText;
                        sourceKind = 'snapshot';
                        if (Object.hasOwn(data, 'semanticDocument')) updateGestureSource(runId, { raw: streamedText, kind: sourceKind, semanticDocument: data.semanticDocument });
                        flushStreamedText(true);
                    }
                } else if (eventType === 'delta') {
                    sourceKind = 'append';
                    streamedText += data.text || '';
                    if (Object.hasOwn(data, 'semanticDocument')) updateGestureSource(runId, { raw: streamedText, kind: sourceKind, semanticDocument: data.semanticDocument });
                    flushStreamedText();
                    appendNarrationBuffer(data.text || '');
                } else if (eventType === 'reasoning') {
                    if (data.text && isActiveRequest()) {
                        if (data.partial) {
                            // Accumulate partial deltas
                            setReasoningSummary((prev) => (prev || '') + data.text);
                        } else {
                            // Final complete summary replaces accumulated
                            setReasoningSummary(data.text);
                        }
                    }
                } else if (eventType === 'done') {
                    const finalRaw = typeof data.fullText === 'string' ? data.fullText : streamedText;
                    const finalText = finalRaw.trim();
                    if (!finalText) {
                        throw new Error('Empty reading returned');
                    }

                    if (!isActiveRequest()) {
                        return;
                    }

                    if (!narrationSuppressedRef.current) {
                        flushNarrationBuffer(true);
                        finalizeNarrationStream();
                    }

                    const narrationSettings = narrationSettingsRef.current;
                    const narrationEligible = narrationSettings.autoNarrate &&
                        narrationSettings.voiceOn &&
                        isServerNarrationProvider(narrationSettings.ttsProvider);
                    if (narrationEligible && !narrationInterruptedByUserRef.current) {
                        const queuedChars = narrationQueuedCharsRef.current;
                        const finalChars = finalText.length;
                        const coverage = finalChars > 0 ? queuedChars / finalChars : 1;
                        if (import.meta.env?.DEV) {
                            console.info('[Narration] Stream queue coverage', {
                                queuedChars,
                                finalChars,
                                coverage: Number(coverage.toFixed(3)),
                                suppressed: narrationSuppressedRef.current,
                                started: narrationStartedRef.current
                            });
                        }
                        if (narrationSuppressedRef.current || coverage < 0.6) {
                            narrationFallbackPendingRef.current = true;
                            narrationFallbackTextRef.current = finalText;
                        } else {
                            narrationFallbackPendingRef.current = false;
                            narrationFallbackTextRef.current = '';
                        }
                    } else {
                        narrationFallbackPendingRef.current = false;
                        narrationFallbackTextRef.current = '';
                    }

                    updateGestureSource(runId, { raw: finalRaw, kind: 'complete', status: 'complete',
                        ...(streamVisualBinding ? { visualBinding: streamVisualBinding } : {}),
                        ...(Object.hasOwn(data, 'semanticDocument') ? { semanticDocument: data.semanticDocument } : {}) });
                    setNarrativePhase('polishing');
                    setSrAnnouncement('Your reading is ready.');

                    const formatted = formatReading(finalRaw);
                    formatted.isError = false;
                    formatted.isStreaming = false;
                    formatted.isServerStreamed = true;
                    formatted.provider = data.provider || streamMeta?.provider || 'local-composer';
                    formatted.requestId = data.requestId || streamMeta?.requestId || null;
                    if (gestureSourceRef.current?.semanticDocument) formatted.semanticDocument = gestureSourceRef.current.semanticDocument;
                    setPersonalReading(formatted);
                    setIsReadingStreamActive(false);
                    setNarrativePhase('complete');
                    setReasoningSummary(null);
                    setReasoning(null);
                    setLastCardsForFeedback(
                        (cardsInfoRef.current || []).map((card) => ({
                            position: card.position,
                            card: card.card,
                            orientation: card.orientation
                        }))
                    );
                    setReadingMeta((prev) => ({
                        ...prev,
                        requestId: formatted.requestId,
                        provider: formatted.provider || prev?.provider || 'local',
                        sourceUsage: formatted.provider === 'safe-fallback' ? null
                            : (Object.hasOwn(data, 'sourceUsage') ? data.sourceUsage : prev.sourceUsage)
                    }));
                    clearReadingJob();
                    setIsGenerating(false);
                } else if (eventType === 'error') {
                    throw createReadingError(data);
                }
            }
        } catch (error) {
            // An older request must never pause or clear a replacement job.
            if (inFlightReadingRef.current?.controller !== controller || readingJobRef.current?.jobId !== jobId) return;
            if (error?.name === 'AbortError') {
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream();
                return;
            }

            const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
            if (isHidden) {
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream();
                return;
            }

            updateGestureSource(runId, { raw: streamedText, status: 'error' });
            settleNarrationAfterStreamFailure();
            const errorMsg =
                typeof error?.message === 'string' && error.message.trim()
                    ? error.message.trim()
                    : 'Unable to generate reading at this time. Please try again in a moment.';
            const formattedError = formatReadingFailure(error);
            setPersonalReading(formattedError);
            setJournalStatus({
                type: 'error',
                message: errorMsg
            });
            setNarrativePhase('error');
            setSrAnnouncement(errorMsg);
            setIsGenerating(false);
            clearReadingJob();
        } finally {
            if (flushTimer !== null) clearTimeout(flushTimer);
            if (inFlightReadingRef.current?.controller === controller) {
                inFlightReadingRef.current = null;
                setIsReadingStreamActive(false);
            }
        }
    }, [
        autoNarrate,
        voiceOn,
        ttsProvider,
        ttsState?.status,
        clearReadingJob,
        beginGestureSource,
        updateGestureSource,
        deckStyleId,
        personalReading,
        pauseReadingStream,
        selectedSpread,
        updateReadingJobCursor,
        userQuestion,
        resetStreamingNarration,
        appendNarrationBuffer,
        flushNarrationBuffer,
        finalizeNarrationStream,
        isNarrationStreamActive,
        settleNarrationAfterStreamFailure,
        visualRequestsEnabled
    ]);

    const resumeReadingStreamIfEligible = useCallback(() => {
        const { jobId, jobToken, cursor } = readingJobRef.current || {};
        if (!jobId || !jobToken) return;
        if (!isTarotRouteRef.current) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (inFlightReadingRef.current?.controller && !inFlightReadingRef.current.controller.signal.aborted) return;
        if (narrativePhase === 'complete' || personalReading?.isError) return;
        if (isServerNarrationProvider(ttsProvider) && ttsState?.status === 'paused') {
            void resumeNarrationPlayback();
        }
        streamReadingJob({ jobId, jobToken, cursor, resume: true });
    }, [
        narrativePhase,
        personalReading,
        streamReadingJob,
        ttsProvider,
        ttsState?.status,
        resumeNarrationPlayback
    ]);

    useEffect(() => {
        const narrationDisabled = !voiceOn || !autoNarrate || !isServerNarrationProvider(ttsProvider);
        if (narrationDisabled) {
            const disabledByUserChoice = !voiceOn || !autoNarrate;
            if (isReadingStreamActive && disabledByUserChoice) {
                narrationInterruptedByUserRef.current = true;
            }
            narrationSuppressedRef.current = true;
            narrationFallbackPendingRef.current = false;
            narrationFallbackTextRef.current = '';
            // This effect disables automatic scheduling. Voice/provider changes
            // already stop playback in the audio controller; manual play stays
            // available when only auto narration is off.
            resetNarrationStream({ preserveAudio: true });
            return;
        }

        if (isReadingStreamActive && narrationSuppressedRef.current) {
            narrationSuppressedRef.current = false;
            flushNarrationBuffer(false);
        }
    }, [voiceOn, autoNarrate, ttsProvider, isReadingStreamActive, resetNarrationStream, flushNarrationBuffer]);

    useEffect(() => {
        if (!narrationFallbackPendingRef.current) return;
        if (!personalReading || personalReading.isStreaming || personalReading.isError) return;
        if (narrationInterruptedByUserRef.current) {
            narrationFallbackPendingRef.current = false;
            narrationFallbackTextRef.current = '';
            return;
        }
        if (!autoNarrate || !voiceOn || !isServerNarrationProvider(ttsProvider)) {
            narrationFallbackPendingRef.current = false;
            narrationFallbackTextRef.current = '';
            return;
        }
        if (isNarrationStreamActive()) return;

        const status = ttsState?.status;
        const isBusy = isNarrationPlaybackBusy(status);
        if (isBusy) {
            narrationFallbackPendingRef.current = false;
            narrationFallbackTextRef.current = '';
            return;
        }
        const fallbackText = narrationFallbackTextRef.current;
        if (!fallbackText) {
            narrationFallbackPendingRef.current = false;
            return;
        }

        narrationFallbackPendingRef.current = false;
        narrationFallbackTextRef.current = '';
        void speak(fallbackText, 'full-reading', narrationEmotionRef.current);
    }, [autoNarrate, voiceOn, ttsProvider, ttsState?.status, isNarrationStreamActive, speak, personalReading]);

    useEffect(() => {
        // Re-renders must not replace a live cursor with an older batched
        // checkpoint. Still resume an aborted reader (including StrictMode's
        // effect cleanup/setup cycle) and invalidate changed reading inputs.
        const activeJob = readingJobRef.current;
        if (activeJob?.jobId) {
            if (activeJob.readingKey && activeJob.readingKey !== buildReadingKey()) {
                cancelInFlightReading();
                setPersonalReading(null);
                setIsGenerating(false);
                setIsReadingStreamActive(false);
                setNarrativePhase('idle');
                return;
            }
            resumeReadingStreamIfEligible();
            return;
        }
        // A checkpoint from before a reload belongs to the restored reading
        // (lib/readingSnapshot); compare keys only once auth and preferences
        // have settled, or a still-loading owner would discard it.
        if (!restoreReady) return;
        const stored = safeSessionStorage.getItem(readingJobStorageKey);
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            if (!parsed?.jobId || !parsed?.jobToken) return;
            if (parsed.namespace && parsed.namespace !== visualNamespaceRef.current) { clearReadingJob(); return; }
            if (parsed.readingKey && parsed.readingKey !== buildReadingKey()) {
                clearReadingJob();
                return;
            }
            // Streamed text is not kept across a reload, so replay the job from
            // its first event rather than from the saved cursor.
            const cursor = 0;
            readingJobRef.current = {
                jobId: parsed.jobId,
                jobToken: parsed.jobToken,
                cursor,
                runId: parsed.runId || crypto.randomUUID(),
                readingResultId: parsed.readingResultId || null,
                visualBinding: parsed.visualBinding || null,
                visualJobToken: parsed.visualJobToken || null,
                visualExpiresAt: parsed.visualExpiresAt || null,
                namespace: parsed.namespace || visualNamespaceRef.current,
                readingKey: parsed.readingKey || null
            };
            // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the identity of the authenticated persisted job before replay
            setReadingMeta(previous => ({ ...previous, readingResultId: parsed.readingResultId || null }));
            if (visualRequestsEnabled && parsed.readingResultId && parsed.visualBinding) {
                setVisualResume({ readingResultId: parsed.readingResultId, visualBinding: parsed.visualBinding,
                    visualJobToken: parsed.visualJobToken, expiresAt: parsed.visualExpiresAt, namespace: visualNamespaceRef.current });
                setReadingMeta(previous => ({ ...previous, readingResultId: parsed.readingResultId, visualBinding: parsed.visualBinding }));
            }
            resumeReadingStreamIfEligible();
        } catch {
            clearReadingJob();
        }
    }, [buildReadingKey, cancelInFlightReading, clearReadingJob, resumeReadingStreamIfEligible, visualRequestsEnabled, restoreReady]);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            const { jobId, jobToken } = readingJobRef.current || {};
            if (!jobId || !jobToken) return;

            if (document.visibilityState === 'hidden') {
                if (inFlightReadingRef.current?.controller) {
                    inFlightReadingRef.current.controller.abort();
                }
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream();
                return;
            }

            if (document.visibilityState === 'visible') {
                resumeReadingStreamIfEligible();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handleVisibilityChange);
        };
    }, [pauseReadingStream, resumeReadingStreamIfEligible, updateReadingJobCursor]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleRouteChange = (event) => {
            const isTarotRoute = event?.detail?.isTarotRoute !== false;
            isTarotRouteRef.current = isTarotRoute;

            const { jobId, jobToken } = readingJobRef.current || {};
            if (!jobId || !jobToken) return;

            if (!isTarotRoute) {
                if (inFlightReadingRef.current?.controller) {
                    inFlightReadingRef.current.controller.abort();
                }
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream('Paused while you browse. Return to continue your narrative.');
                return;
            }

            resumeReadingStreamIfEligible();
        };

        window.addEventListener('tableau:route-change', handleRouteChange);
        return () => {
            window.removeEventListener('tableau:route-change', handleRouteChange);
        };
    }, [pauseReadingStream, resumeReadingStreamIfEligible, updateReadingJobCursor]);

    // Generate Personal Reading Logic
    const generatePersonalReading = useCallback(async () => {
        // Synchronous ref check prevents double-clicks before React can re-render
        if (inFlightReadingRef.current) return;

        if (!reading || reading.length === 0) {
            const errorMsg = 'Please draw your cards before requesting a personalized reading.';
            const formattedError = formatReading(errorMsg);
            formattedError.isError = true;
            formattedError.isStreaming = false;
            formattedError.isServerStreamed = false;
            setPersonalReading(formattedError);
            setJournalStatus({
                type: 'error',
                message: 'Draw and reveal your cards before requesting a personalized narrative.'
            });
            setNarrativePhase('error');
            setSrAnnouncement('Please draw and reveal your cards before requesting a personalized narrative.');
            return;
        }
        if (isGenerating) return;

        cancelInFlightReading();
        resetStreamingNarration();
        let runId = beginGestureSource();
        setVisualResume(null);
        const startController = new AbortController();
        inFlightReadingRef.current = { controller: startController, sessionSeed };

        setIsGenerating(true);
        setIsReadingStreamActive(false);
        setPersonalReading(null);
        setReasoningSummary(null);
        setReasoning(null);
        setJournalStatus(null);
        setNarrativePhase('analyzing');
        setSrAnnouncement('Preparing your personalized reading.');
        setReadingMeta((prev) => ({ ...prev, requestId: null, ephemeris: null, sourceUsage: null,
            readingResultId: null, visualBinding: null, visualSnapshot: null, visualStatus: 'idle' }));
        setLastCardsForFeedback([]);

        try {
            const safeSpreadKey = normalizeSpreadKey(selectedSpread);
            const spreadInfo = getSpreadInfo(safeSpreadKey);
            if (!spreadInfo) {
                throw new Error('Unable to find spread definition.');
            }
            const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

            const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
            const visibleReading = maxCards ? reading.slice(0, maxCards) : reading;
            const cardsInfo = visibleReading.map((card, idx) => {
                const originalCard = allCards.find(item => item.name === card.name) || card;
                const position = spreadInfo.positions[idx] || `Position ${idx + 1}`;

                return buildReadingRequestCard(originalCard, {
                    deckStyle: deckStyleId,
                    position,
                    isReversed: card.isReversed,
                    userReflection: reflections[idx]
                });
            });

            setNarrativePhase('analyzing');
            setSrAnnouncement('Preparing your personalized reading.');

            const shouldAttachVisionProof = visionResearchEnabled && visionResults.length > 0;
            if (shouldAttachVisionProof) {
                const conflicts = getVisionConflictsForCards(cardsInfo, visionResults, deckStyleId);
                setVisionConflicts(conflicts);
                if (conflicts.length > 0) {
                    setJournalStatus({
                        type: 'info',
                        message: 'Research Telemetry: Vision model detected a mismatch between uploaded image and digital card.'
                    });
                }
            } else if (visionConflicts.length > 0) {
                setVisionConflicts([]);
            }

            let proof = null;
            if (shouldAttachVisionProof) {
                try {
                    proof = await ensureVisionProof();
                } catch (proofError) {
                    setJournalStatus({
                        type: 'warning',
                        message: proofError.message || 'Vision verification failed. Skipping research telemetry for this reading.'
                    });
                }
            }

            const payload = {
                spreadInfo: {
                    name: spreadInfo.name,
                    key: safeSpreadKey,
                    deckStyle: deckStyleId
                },
                cardsInfo,
                userQuestion,
                // Card reflections travel on cardsInfo[].userReflection; this field is
                // for notes not tied to a card, which this flow does not collect.
                reflectionsText: '',
                useSavedMemories,
                reversalFrameworkOverride: reversalFramework,
                deckStyle: deckStyleId
            };
            if (proof) {
                payload.visionProof = proof;
            }
            if (personalizationForRequest) {
                payload.personalization = personalizationForRequest;
            }
            // Include location data if enabled and available
            // Use explicit null/undefined checks - 0° lat/long are valid coordinates (equator/prime meridian)
            if (locationEnabled && cachedLocation?.latitude != null && cachedLocation?.longitude != null) {
                payload.location = {
                    latitude: cachedLocation.latitude,
                    longitude: cachedLocation.longitude,
                    timezone: cachedLocation.timezone || null,
                    source: cachedLocation.source || 'browser'
                };
                payload.persistLocationToJournal = Boolean(persistLocationToJournal);
            }
            // Validation is needed only when starting a narrative, not during setup.
            const { safeParseReadingRequest } = await import('../../shared/contracts/readingSchema.js').catch((error) => {
                startController.signal.throwIfAborted();
                throw new Error('Your reading could not start. Check your connection, then reload this page. Your question and cards are saved.', { cause: error });
            });
            startController.signal.throwIfAborted();
            const normalizedPayload = safeParseReadingRequest(payload);
            if (!normalizedPayload.success) {
                const validationMessage = normalizedPayload.error || 'Reading request is missing required details.';
                setIsGenerating(false);
                setNarrativePhase('error');
                setJournalStatus({
                    type: 'error',
                    message: validationMessage
                });
                setSrAnnouncement(`Reading request is invalid: ${validationMessage}`);
                return;
            }

            setNarrativePhase('drafting');
            setSrAnnouncement('Your reading is being prepared.');

            const startResponse = await fetch('/api/tarot-reading/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(visualRequestsEnabled ? { 'X-Reading-Cue-Display': '1' } : {})
                },
                body: JSON.stringify(normalizedPayload.data),
                signal: startController.signal
            });

            if (!startResponse.ok) {
                const errText = await startResponse.text();
                let errPayload = null;
                try {
                    errPayload = errText ? JSON.parse(errText) : null;
                } catch {
                    errPayload = null;
                }

                const serverMessage =
                    typeof errPayload?.error === 'string'
                        ? errPayload.error.trim()
                        : '';

                const fallbackByStatus = {
                    401: 'Please sign in to generate a personal narrative.',
                    403: 'This spread isn’t available on your current plan.',
                    409: 'This request couldn’t be completed. Please refresh and try again.',
                    429: 'You’ve reached your reading limit. Please try again later.'
                };

                const safeServerMessage = serverMessage && serverMessage.length <= 240 ? serverMessage : '';
                const finalMessage =
                    safeServerMessage ||
                    fallbackByStatus[startResponse.status] ||
                    'Unable to generate reading at this time. Please try again in a moment.';

                console.error('Tarot reading job start error:', startResponse.status, errPayload || errText);
                throw createReadingError({ ...errPayload, message: finalMessage });
            }

            const startData = await startResponse.json();
            const jobId = startData?.jobId;
            const jobToken = startData?.jobToken;
            if (!jobId || !jobToken) {
                throw new Error('Unable to start reading at this time. Please try again.');
            }

            const readingKey = buildReadingKey();
            const readingResultId = startData?.readingResultId || null;
            const visualBinding = startData?.visualBinding || null;
            const visualExpiresAt = startData?.visualExpiresAt || null;
            const visualJobToken = visualRequestsEnabled ? startData?.visualJobToken || null : null;
            if (startController.signal.aborted || gestureSourceRef.current?.runId !== runId) return;
            if (visualRequestsEnabled && readingResultId && visualBinding) {
                runId = beginGestureSource(readingResultId, { visualBinding, sourceRevision: visualBinding.sourceRevision, visualJobStatus: 'pending' });
                setVisualResume({ readingResultId, visualBinding, visualJobToken, expiresAt: visualExpiresAt, namespace: visualNamespaceRef.current });
            }

            cardsInfoRef.current = cardsInfo;
            setReadingJob({
                jobId,
                jobToken,
                readingResultId,
                visualBinding,
                visualJobToken,
                visualExpiresAt,
                namespace: visualNamespaceRef.current,
                cursor: 0,
                runId,
                readingKey
            });
            setReadingMeta((prev) => ({
                ...prev,
                readingResultId,
                visualBinding
            }));

            await streamReadingJob({ jobId, jobToken, cursor: 0, resume: false });
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.debug('generatePersonalReading aborted');
                return;
            }
            if (gestureSourceRef.current?.runId !== runId) return;
            updateGestureSource(runId, { status: 'error' });
            console.error('generatePersonalReading error:', error);
            const errorMsg =
                typeof error?.message === 'string' && error.message.trim()
                    ? error.message.trim()
                    : 'Unable to generate reading at this time. Please try again in a moment.';
            const formattedError = formatReadingFailure(error);
            setPersonalReading(formattedError);
            setJournalStatus({
                type: 'error',
                message: errorMsg
            });
            setNarrativePhase('error');
            setSrAnnouncement(errorMsg);
        } finally {
            if (inFlightReadingRef.current?.controller === startController) {
                inFlightReadingRef.current = null;
            }
            if (!readingJobRef.current?.jobId) {
                setIsReadingStreamActive(false);
                setIsGenerating(false);
            }
        }
    }, [
        reading,
        isGenerating,
        selectedSpread,
        userQuestion,
        useSavedMemories,
        reflections,
        sessionSeed,
        deckStyleId,
        reversalFramework,
        visionResearchEnabled,
        visionResults,
        visionConflicts,
        getVisionConflictsForCards,
        setVisionConflicts,
        ensureVisionProof,
        cancelInFlightReading,
        resetStreamingNarration,
        personalizationForRequest,
        locationEnabled,
        cachedLocation,
        persistLocationToJournal,
        buildReadingKey,
        setReadingJob,
        streamReadingJob,
        beginGestureSource,
        updateGestureSource,
        visualRequestsEnabled
    ]);

    // --- Logic: Analysis Highlights ---

    // Symbol annotations are only needed after cards have been drawn. Load
    // them alongside the reading table, leaving setup and returning visits
    // free of the full symbol catalogue.
    const [buildSymbolElementCue, setBuildSymbolElementCue] = useState(null);
    useEffect(() => {
        if (!reading?.length || buildSymbolElementCue) return;
        let active = true;
        import('../lib/symbolElementBridge').then(module => {
            if (active) setBuildSymbolElementCue(() => module.buildSymbolElementCue);
        }).catch(() => {
            // Optional analysis must not prevent the reading from rendering.
        });
        return () => { active = false; };
    }, [reading, buildSymbolElementCue]);

    // Local fallback relationships
    const relationships = useMemo(() => {
        if (!reading) return [];
        const spreadInfo = getSpreadInfo(selectedSpread);
        const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
        const visibleReading = maxCards ? reading.slice(0, maxCards) : reading;
        if (visibleReading.length === 0) return [];
        if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
            return []; // Server analysis takes precedence
        }
        return computeRelationships(visibleReading);
    }, [reading, spreadAnalysis, selectedSpread]);

    // Highlights Memoization
    const derivedHighlights = useMemo(() => {
        if (!reading) return null;
        const spreadInfo = getSpreadInfo(selectedSpread);
        const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
        const visibleCount = maxCards ? Math.min(reading.length, maxCards) : reading.length;
        if (visibleCount === 0 || revealedCards.size !== visibleCount) return null;
        if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
            const notes = [];
            if (themes) {
                if (typeof drawIncludeMinors === 'boolean') {
                    const deckScope = drawIncludeMinors
                        ? 'Full deck (Major + Minor Arcana).'
                        : 'Major Arcana focus (archetypal themes).';
                    notes.push({ key: 'deck-scope', icon: '-', title: 'Deck scope:', text: deckScope });
                }
                // suitFocus covers every repeated suit (including ties); a bare dominantSuit
                // may be a single card, so it never becomes a dominance claim on its own.
                if (themes.suitFocus) {
                    notes.push({ key: 'suit-dominance', icon: '♠', title: 'Suit Focus:', text: themes.suitFocus });
                }
                if (themes.elementalBalance) {
                    notes.push({ key: 'elemental-balance', icon: '⚡', title: 'Elemental Balance:', text: themes.elementalBalance });
                }
                const symbolCue = buildSymbolElementCue?.({ reading, themes, deckStyleId });
                if (symbolCue) {
                    notes.push({ key: 'symbol-cue', icon: '✦', title: 'Symbol Cue:', text: symbolCue.text });
                }
                if (themes.reversalDescription) {
                    notes.push({ key: 'reversal-framework', icon: '⤴', title: 'Reversal Lens:', text: `${themes.reversalDescription.name} — ${themes.reversalDescription.description}` });
                }
            }
            // Track cross-checks separately to limit them (reduces information overload)
            let crossCheckCount = 0;
            const MAX_CROSS_CHECKS = 2;
            const hasAdviceAxis = spreadAnalysis.relationships.some(rel => rel?.type === 'staff-axis' && rel.summary);

            spreadAnalysis.relationships.forEach((rel, index) => {
                if (!rel || !rel.summary) return;
                if (hasAdviceAxis && rel.type === 'cross-check' && rel.key === 'adviceVsOutcome') return;

                // Limit cross-checks to the 2 most important to reduce density
                if (rel.type === 'cross-check') {
                    crossCheckCount++;
                    if (crossCheckCount > MAX_CROSS_CHECKS) return;
                }

                let title = 'Pattern';
                let icon = '•';
                const typeMap = {
                    'sequence': { title: selectedSpread === 'decision' ? 'Decision Guidance' : 'Story Flow', icon: '→' },
                    'connection': { title: 'Shared Connection', icon: '↔' },
                    'guidance': { title: 'Relationship Guidance', icon: '→' },
                    'outcome': { title: 'Possible Outcome', icon: '→' },
                    'elemental-run': { title: 'Elemental Pattern', icon: '⚡' },
                    'elemental': { title: 'Elemental Pattern', icon: '⚡' },
                    'axis': { title: rel.axis || 'Axis Insight', icon: '⇄' },
                    'nucleus': { title: 'Heart of the Matter', icon: '★' },
                    'timeline': { title: 'Timeline', icon: '⏱' },
                    'consciousness-axis': { title: 'Conscious ↔ Subconscious', icon: '☯' },
                    'staff-axis': { title: 'Advice ↔ Outcome', icon: '⚖' },
                    'cross-check': { title: 'Cross-Check', icon: '✦' }
                };
                if (typeMap[rel.type]) {
                    title = typeMap[rel.type].title;
                    icon = typeMap[rel.type].icon;
                }
                notes.push({ key: `rel-${index}-${rel.type || 'rel'}`, icon, title, text: rel.summary });
            });
            // Note: positionNotes are intentionally omitted from UI display.
            // They contain generic reader guidelines (e.g., "Core situation; anchor for nucleus")
            // useful for AI narrative building but not for end-user card-specific insights.
            return notes;
        }
        return null;
    }, [reading, revealedCards, spreadAnalysis, themes, drawIncludeMinors, selectedSpread, deckStyleId, buildSymbolElementCue]);

    const fallbackHighlights = useMemo(() => {
        if (!reading) return [];
        const spreadInfo = getSpreadInfo(selectedSpread);
        const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
        const totalCards = maxCards ? Math.min(reading.length, maxCards) : reading.length;
        if (totalCards === 0 || revealedCards.size !== totalCards) {
            return [];
        }
        const visibleReading = maxCards ? reading.slice(0, maxCards) : reading;
        const items = [];
        if (typeof drawIncludeMinors === 'boolean') {
            items.push({
                key: 'deck-scope',
                icon: '-',
                title: 'Deck scope:',
                text: drawIncludeMinors ? 'Full deck (Major + Minor Arcana).' : 'Major Arcana focus (archetypal themes).'
            });
        }
        const reversedIdx = visibleReading.map((card, index) => (card.isReversed ? index : -1)).filter(index => index >= 0);
        if (reversedIdx.length > 0) {
            const hasCluster = reversedIdx.some((idx, j) => j > 0 && idx === reversedIdx[j - 1] + 1);
            let text = `${reversedIdx.length === 1 ? 'This often points' : 'These often point'} to inner processing, timing delays, or tension in the theme.`;
            if (hasCluster) text += ' Consecutive reversals suggest the theme persists across positions.';
            items.push({ key: 'reversal-summary', icon: '⤴', title: `Reversed card${reversedIdx.length === 1 ? '' : 's'} (${reversedIdx.length}):`, text });
        }
        const relationshipMeta = {
            sequence: { icon: '→', title: 'Sequence:' },
            'reversal-heavy': { icon: '⚠', title: 'Reversal Pattern:' },
            'reversal-moderate': { icon: '•', title: 'Reversal Pattern:' },
            'reversed-court-cluster': { icon: '👑', title: 'Court Dynamics:' },
            'consecutive-reversals': { icon: '↔', title: 'Pattern Flow:' },
            'suit-dominance': { icon: '♠', title: 'Suit Dominance:' },
            'suit-run': { icon: '→', title: 'Suit Run:' },
            'court-cluster': { icon: '👥', title: 'Court Cards:' },
            'court-pair': { icon: '👥', title: 'Court Cards:' },
            'court-suit-focus': { icon: '👥', title: 'Court Cards:' },
            pairing: { icon: '>', title: 'Card Connection:' },
            arc: { icon: '>', title: 'Card Connection:' }
        };
        relationships.forEach((relationship, index) => {
            if (!relationship?.text) return;
            const meta = relationshipMeta[relationship.type] || { icon: '✦', title: 'Pattern:' };
            items.push({ key: `relationship-${relationship.type || 'pattern'}-${index}`, icon: meta.icon, title: meta.title, text: relationship.text });
        });
        return items;
    }, [reading, revealedCards, drawIncludeMinors, relationships, selectedSpread]);

    const highlightItems = useMemo(() => {
        if (Array.isArray(derivedHighlights) && derivedHighlights.length > 0) return derivedHighlights;
        if (Array.isArray(fallbackHighlights) && fallbackHighlights.length > 0) return fallbackHighlights;
        return [];
    }, [derivedHighlights, fallbackHighlights]);

    const describeCardAtIndex = useCallback((index) => {
        const card = reading?.[index];
        if (!card) return null;
        const spreadInfo = getSpreadInfo(selectedSpread);
        const position = spreadInfo?.positions?.[index] || `Card ${index + 1}`;
        // Look up the card's meaning for screen reader synthesis
        const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
        const originalCard = allCards.find(item => item.name === card.name) || card;
        const meaningText = card.isReversed ? originalCard.reversed : originalCard.upright;
        // Extract first clause of meaning for brief synthesis (up to first period or 80 chars)
        let briefMeaning = '';
        if (meaningText) {
            const firstClause = meaningText.split(/[.;!?]/)[0];
            briefMeaning = firstClause.length <= 80 ? firstClause : `${firstClause.slice(0, 77).trimEnd()}...`;
        }
        // Synthesized format: "The Tower reversed. Position: The Challenge. Sudden change and upheaval."
        const orientationLabel = card.isReversed ? ' reversed' : '';
        const synthesized = briefMeaning
            ? `${card.name}${orientationLabel}. Position: ${position}. ${briefMeaning}.`
            : `${card.name}${orientationLabel}. Position: ${position}.`;
        return synthesized;
    }, [reading, selectedSpread]);

    const dealNext = useCallback(() => {
        if (!reading || !isSpreadDealt) return;
        const nextIndex = reading.findIndex((_, index) => !revealedCards.has(index));
        if (nextIndex < 0) return;
        const description = describeCardAtIndex(nextIndex);
        if (description) {
            setSrAnnouncement(`Revealed ${description}.`);
        }
        baseDealNext();
    }, [baseDealNext, describeCardAtIndex, reading, revealedCards, isSpreadDealt]);

    const revealCard = useCallback((index) => {
        if (!reading || !isSpreadDealt || !reading[index] || revealedCards.has(index)) return;
        const description = describeCardAtIndex(index);
        if (description) {
            setSrAnnouncement(`Revealed ${description}.`);
        }
        baseRevealCard(index);
    }, [baseRevealCard, describeCardAtIndex, reading, isSpreadDealt, revealedCards]);

    const revealAll = useCallback(() => {
        if (!reading || !isSpreadDealt || reading.length === 0) return;
        const spreadInfo = getSpreadInfo(selectedSpread);
        const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
        const visibleReading = maxCards ? reading.slice(0, maxCards) : reading;
        if (visibleReading.length === 0) return;
        const descriptions = visibleReading
            .map((_, index) => (!revealedCards.has(index) ? describeCardAtIndex(index) : null))
            .filter(Boolean);

        if (descriptions.length === 1) {
            setSrAnnouncement(`Revealed ${descriptions[0]}.`);
        } else if (descriptions.length > 1) {
            const preview = descriptions.slice(0, 2).join('; ');
            const suffix = descriptions.length > 2 ? '…' : '.';
            setSrAnnouncement(`Revealed ${descriptions.length} cards — ${preview}${suffix}`);
        } else if (revealedCards.size === visibleReading.length) {
            setSrAnnouncement('All cards already revealed.');
        }

        baseRevealAll();
    }, [baseRevealAll, describeCardAtIndex, reading, revealedCards, selectedSpread, isSpreadDealt]);

    const cancelPersonalReading = useCallback((options = {}) => {
        cancelInFlightReading();
        setPersonalReading(null);
        setIsGenerating(false);
        setIsReadingStreamActive(false);
        setNarrativePhase('idle');
        updateGestureSource(gestureSourceRef.current?.runId, { status: 'paused' });
        if (options.announce !== false) setSrAnnouncement('Generation cancelled. Your cards and question are still here.');
    }, [cancelInFlightReading, updateGestureSource]);

    const value = useMemo(() => ({
        ...audioController,
        handleNarrationStop,
        ...tarotState,
        ...visionAnalysis,
        shuffle: handleShuffle,
        dealNext,
        revealCard,
        revealAll,
        personalReading, setPersonalReading, gestureSource,
        isGenerating, setIsGenerating,
        isReadingStreamActive,
        narrativePhase, setNarrativePhase,
        spreadAnalysis, setSpreadAnalysis,
        themes, setThemes,
        emotionalTone, setEmotionalTone,
        analysisContext, setAnalysisContext,
        reasoningSummary, setReasoningSummary,
        reasoning, setReasoning,
        readingMeta, setReadingMeta, visualResume,
        journalStatus, setJournalStatus,
        reflections, setReflections,
        useSavedMemories, setUseSavedMemories,
        followUps, setFollowUps,
        followUpIdentity,
        followUpDraft: followUpComposer.draft, setFollowUpDraft,
        includeJournalContext: followUpComposer.includeJournal, setIncludeJournalContext,
        lastCardsForFeedback, setLastCardsForFeedback,
        showAllHighlights, setShowAllHighlights,
        generatePersonalReading,
        cancelPersonalReading,
        highlightItems,
        srAnnouncement, setSrAnnouncement
    }), [
        audioController,
        handleNarrationStop,
        tarotState,
        visionAnalysis,
        handleShuffle,
        dealNext,
        revealCard,
        revealAll,
        personalReading,
        gestureSource,
        isGenerating,
        isReadingStreamActive,
        narrativePhase,
        spreadAnalysis,
        themes,
        emotionalTone,
        analysisContext,
        reasoningSummary,
        reasoning,
        readingMeta,
        visualResume,
        journalStatus,
        reflections,
        useSavedMemories,
        followUps,
        followUpIdentity, followUpComposer, setFollowUpDraft, setIncludeJournalContext,
        lastCardsForFeedback,
        showAllHighlights,
        generatePersonalReading,
        cancelPersonalReading,
        highlightItems,
        srAnnouncement
    ]);

    return (
        <ReadingContext.Provider value={value}>
            {initialSnapshot && (!restoreReady || appliedSnapshotRevision !== snapshotRevision)
                ? <p role="status" className="p-6 text-main">Restoring your reading…</p>
                : children}
        </ReadingContext.Provider>
    );
}

export function useReading() {
    const context = useContext(ReadingContext);
    if (!context) {
        throw new Error('useReading must be used within a ReadingProvider');
    }
    return context;
}
