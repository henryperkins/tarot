/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTarotState } from '../hooks/useTarotState';
import { useVisionAnalysis } from '../hooks/useVisionAnalysis';
import { useAudioController } from '../hooks/useAudioController';
import { usePreferences } from './PreferencesContext';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { formatReading } from '../lib/formatting';
import { canonicalCardKey, canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { computeRelationships } from '../lib/deck';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';

const ReadingContext = createContext(null);

export function ReadingProvider({ children }) {
    // 1. Audio Controller
    const audioController = useAudioController();
    const { speak } = audioController;

    // 2. Core Tarot State
    const tarotState = useTarotState(speak);
    const {
        reading,
        selectedSpread,
        userQuestion,
        revealedCards,
        shuffle,
        dealNext: baseDealNext,
        revealCard: baseRevealCard,
        revealAll: baseRevealAll,
        sessionSeed
    } = tarotState;
    const {
        deckStyleId,
        includeMinors,
        reversalFramework,
        personalization,
        locationEnabled,
        cachedLocation,
        persistLocationToJournal
    } = usePreferences();

    // 3. Vision Analysis
    const visionAnalysis = useVisionAnalysis(reading);
    const { visionResults, visionConflicts, resetVisionProof: _resetVisionProof, ensureVisionProof, getVisionConflictsForCards, setVisionConflicts } = visionAnalysis;

    const personalizationForRequest = useMemo(() => {
        if (!personalization || typeof personalization !== 'object') {
            return null;
        }
        const sanitizedName =
            typeof personalization.displayName === 'string'
                ? personalization.displayName.trim()
                : '';

        const focusAreas = Array.isArray(personalization.focusAreas)
            ? personalization.focusAreas
                .map((area) => (typeof area === 'string' ? area.trim() : ''))
                .filter((area) => area.length > 0)
            : [];

        const payload = {
            displayName: sanitizedName || undefined,
            readingTone: personalization.readingTone || undefined,
            spiritualFrame: personalization.spiritualFrame || undefined,
            tarotExperience: personalization.tarotExperience || undefined,
            preferredSpreadDepth: personalization.preferredSpreadDepth || undefined,
            focusAreas: focusAreas.length ? focusAreas : undefined
        };

        return Object.values(payload).some((value) => value !== undefined) ? payload : null;
    }, [personalization]);

    // 4. Reading Generation State
    const [personalReading, setPersonalReading] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isReadingStreamActive, setIsReadingStreamActive] = useState(false);
    const [narrativePhase, setNarrativePhase] = useState('idle');
    const [spreadAnalysis, setSpreadAnalysis] = useState(null);
    const [themes, setThemes] = useState(null);
    const [emotionalTone, setEmotionalTone] = useState(null);
    const [analysisContext, setAnalysisContext] = useState(null);
    const [reasoningSummary, setReasoningSummary] = useState(null);
    const [followUps, setFollowUps] = useState([]);
    const [readingMeta, setReadingMeta] = useState({
        requestId: null,
        provider: null,
        spreadKey: null,
        spreadName: null,
        deckStyle: null,
        userQuestion: null,
        graphContext: null,
        ephemeris: null
    });

    // 5. UI State
    const [journalStatus, setJournalStatus] = useState(null);
    const [reflections, setReflections] = useState({});
    const [lastCardsForFeedback, setLastCardsForFeedback] = useState([]);
    const [showAllHighlights, setShowAllHighlights] = useState(false);
    const [srAnnouncement, setSrAnnouncement] = useState('');

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

    const readingJobStorageKey = 'tarot:reading-job';

    const persistReadingJob = useCallback((nextState) => {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        try {
            window.sessionStorage.setItem(readingJobStorageKey, JSON.stringify(nextState));
        } catch {
            // Ignore storage failures (private mode, quota, etc.)
        }
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
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        try {
            window.sessionStorage.removeItem(readingJobStorageKey);
        } catch {
            // Ignore storage failures.
        }
    }, []);

    const cancelInFlightReading = useCallback(() => {
        if (inFlightReadingRef.current?.controller) {
            inFlightReadingRef.current.controller.abort();
        }
        inFlightReadingRef.current = null;

        const { jobId, jobToken } = readingJobRef.current || {};
        if (jobId && jobToken) {
            fetch(`/api/tarot-reading/jobs/${jobId}/cancel`, {
                method: 'POST',
                headers: { 'X-Job-Token': jobToken }
            }).catch(() => null);
        }

        clearReadingJob();
    }, [clearReadingJob]);

    // Reset analysis state when Shuffle is triggered
    const handleShuffle = useCallback(() => {
        cancelInFlightReading();
        shuffle(() => {
            setPersonalReading(null);
            setThemes(null);
            setEmotionalTone(null);
            setSpreadAnalysis(null);
            setAnalysisContext(null);
            setReasoningSummary(null);
            setIsGenerating(false);
            setIsReadingStreamActive(false);
            setNarrativePhase('idle');
            setJournalStatus(null);
            setReflections({});
            setFollowUps([]);
            cardsInfoRef.current = [];
            visionAnalysis.setVisionResults([]);
            visionAnalysis.setVisionConflicts([]);
            visionAnalysis.resetVisionProof();
            setShowAllHighlights(false);
            setSrAnnouncement('');
        });
    }, [shuffle, visionAnalysis, cancelInFlightReading]);

    const pauseReadingStream = useCallback((message = 'Finishing your narrative in the background.') => {
        setIsReadingStreamActive(false);
        setSrAnnouncement(message);
    }, []);

    const buildReadingKey = useCallback(() => {
        const count = reading?.length ?? 0;
        const fingerprint = Array.isArray(reading)
            ? reading.map((card) => {
                const name = typeof card?.name === 'string' ? card.name : '';
                const reversed = card?.isReversed ? 'R' : 'U';
                return `${name}:${reversed}`;
            }).join('|')
            : '';
        return JSON.stringify({
            spreadKey: normalizeSpreadKey(selectedSpread),
            count,
            seed: sessionSeed || null,
            fingerprint: fingerprint || null
        });
    }, [reading, selectedSpread, sessionSeed]);

    const streamReadingJob = useCallback(async ({ jobId, jobToken, cursor = 0, resume = false }) => {
        if (!jobId || !jobToken) return;

        if (inFlightReadingRef.current?.controller) {
            inFlightReadingRef.current.controller.abort();
        }

        const controller = new AbortController();
        inFlightReadingRef.current = { controller, jobId };

        const isActiveRequest = () =>
            !controller.signal.aborted &&
            readingJobRef.current?.jobId === jobId &&
            inFlightReadingRef.current?.controller === controller;

        const safeSpreadKey = normalizeSpreadKey(selectedSpread);
        const spreadInfo = getSpreadInfo(safeSpreadKey);

        setIsReadingStreamActive(true);
        setIsGenerating(true);

        try {
            const response = await fetch(`/api/tarot-reading/jobs/${jobId}/stream?cursor=${cursor}`, {
                headers: {
                    'Accept': 'text/event-stream',
                    'X-Job-Token': jobToken
                },
                signal: controller.signal
            });

            const contentType = response.headers.get('content-type') || '';
            const isSSE = contentType.includes('text/event-stream');

            if (!response.ok || !isSSE) {
                const errText = await response.text();
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
                    403: 'This request couldn’t be resumed. Please try again.',
                    404: 'This request couldn’t be resumed. Please try again.',
                    409: 'This request couldn’t be completed. Please refresh and try again.',
                    410: 'This request expired. Please generate a new narrative.',
                    429: 'You’ve reached your reading limit. Please try again later.'
                };

                const safeServerMessage = serverMessage && serverMessage.length <= 240 ? serverMessage : '';
                const finalMessage =
                    safeServerMessage ||
                    fallbackByStatus[response.status] ||
                    'Unable to generate reading at this time. Please try again in a moment.';

                throw new Error(finalMessage);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Streaming response missing body.');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let streamedText = resume
                ? (personalReading?.raw || personalReading?.normalized || '')
                : '';
            let doneReceived = false;
            let streamMeta = null;
            let lastFlush = 0;

            const updateCursor = (eventId) => {
                if (!isActiveRequest()) return;
                updateReadingJobCursor(eventId);
            };

            const flushStreamedText = (force = false) => {
                if (!isActiveRequest()) return;
                const now = Date.now();
                if (!force && now - lastFlush < 120) {
                    return;
                }
                lastFlush = now;
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (controller.signal.aborted) {
                    reader.cancel().catch(() => null);
                    return;
                }

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const eventBlock of events) {
                    if (!eventBlock.trim()) continue;

                    const lines = eventBlock.split('\n');
                    let eventType = '';
                    let eventData = '';

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventType = line.slice(6).trim();
                        } else if (line.startsWith('data:')) {
                            eventData = line.slice(5).trim();
                        }
                    }

                    if (!eventType || !eventData) continue;

                    try {
                        const data = JSON.parse(eventData);
                        updateCursor(data?.eventId);

                        if (eventType === 'meta') {
                            streamMeta = data;
                            if (data?.themes !== undefined) {
                                setThemes(data.themes || null);
                            }
                            if (data?.emotionalTone !== undefined) {
                                setEmotionalTone(data.emotionalTone || null);
                            }
                            if (data?.spreadAnalysis !== undefined) {
                                setSpreadAnalysis(data.spreadAnalysis || null);
                            }
                            if (data?.context !== undefined) {
                                setAnalysisContext(data.context || null);
                            }
                            if (isActiveRequest()) {
                                setReadingMeta({
                                    requestId: data.requestId || null,
                                    provider: data.provider || 'local',
                                    spreadKey: safeSpreadKey,
                                    spreadName: spreadInfo?.name || null,
                                    deckStyle: deckStyleId,
                                    userQuestion,
                                    graphContext: data.themes?.knowledgeGraph || null,
                                    ephemeris: data.ephemeris || null
                                });
                            }
                        } else if (eventType === 'delta') {
                            streamedText += data.text || '';
                            flushStreamedText();
                        } else if (eventType === 'reasoning') {
                            if (data.text && isActiveRequest()) {
                                setReasoningSummary(data.text);
                            }
                        } else if (eventType === 'done') {
                            doneReceived = true;
                            const finalText = (data.fullText || streamedText || '').trim();
                            if (!finalText) {
                                throw new Error('Empty reading returned');
                            }

                            if (!isActiveRequest()) {
                                return;
                            }

                            setNarrativePhase('polishing');
                            setSrAnnouncement('Step 3 of 3: Final polishing and assembling your narrative.');

                            const formatted = formatReading(finalText);
                            formatted.isError = false;
                            formatted.isStreaming = false;
                            formatted.isServerStreamed = true;
                            formatted.provider = data.provider || streamMeta?.provider || 'local-composer';
                            formatted.requestId = data.requestId || streamMeta?.requestId || null;
                            setPersonalReading(formatted);
                            setIsReadingStreamActive(false);
                            setNarrativePhase('complete');
                            setReasoningSummary(null);
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
                                provider: formatted.provider || prev?.provider || 'local'
                            }));
                            clearReadingJob();
                            setIsGenerating(false);
                        } else if (eventType === 'error') {
                            throw new Error(data.message || 'Streaming error occurred');
                        }
                    } catch (parseError) {
                        if (parseError.message && !parseError.message.includes('JSON')) {
                            throw parseError;
                        }
                        console.warn('Failed to parse SSE event:', eventData);
                    }
                }
            }

            if (!doneReceived && isActiveRequest()) {
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream();
            }
        } catch (error) {
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

            const errorMsg =
                typeof error?.message === 'string' && error.message.trim()
                    ? error.message.trim()
                    : 'Unable to generate reading at this time. Please try again in a moment.';
            const formattedError = formatReading(errorMsg);
            formattedError.isError = true;
            formattedError.isStreaming = false;
            formattedError.isServerStreamed = false;
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
            if (inFlightReadingRef.current?.controller === controller) {
                inFlightReadingRef.current = null;
                setIsReadingStreamActive(false);
            }
        }
    }, [
        clearReadingJob,
        deckStyleId,
        personalReading,
        pauseReadingStream,
        selectedSpread,
        updateReadingJobCursor,
        userQuestion
    ]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        const stored = window.sessionStorage.getItem(readingJobStorageKey);
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            if (!parsed?.jobId || !parsed?.jobToken) return;
            if (parsed.readingKey && parsed.readingKey !== buildReadingKey()) {
                clearReadingJob();
                return;
            }
            const parsedCursor = Number.parseInt(parsed.cursor, 10);
            const cursor = Number.isFinite(parsedCursor) ? parsedCursor : 0;
            readingJobRef.current = {
                jobId: parsed.jobId,
                jobToken: parsed.jobToken,
                cursor,
                readingKey: parsed.readingKey || null
            };
            if (!isReadingStreamActive && narrativePhase !== 'complete' && !personalReading?.isError) {
                streamReadingJob({
                    jobId: parsed.jobId,
                    jobToken: parsed.jobToken,
                    cursor,
                    resume: true
                });
            }
        } catch {
            clearReadingJob();
        }
    }, [buildReadingKey, clearReadingJob, isReadingStreamActive, narrativePhase, personalReading, streamReadingJob]);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            const { jobId, jobToken, cursor } = readingJobRef.current || {};
            if (!jobId || !jobToken) return;

            if (document.visibilityState === 'hidden') {
                if (inFlightReadingRef.current?.controller) {
                    inFlightReadingRef.current.controller.abort();
                }
                updateReadingJobCursor(readingJobRef.current?.cursor || 0, { force: true });
                pauseReadingStream();
                return;
            }

            if (document.visibilityState === 'visible' && !isReadingStreamActive && narrativePhase !== 'complete' && !personalReading?.isError) {
                streamReadingJob({ jobId, jobToken, cursor, resume: true });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handleVisibilityChange);
        };
    }, [isReadingStreamActive, narrativePhase, pauseReadingStream, personalReading, streamReadingJob, updateReadingJobCursor]);

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
        const startController = new AbortController();
        inFlightReadingRef.current = { controller: startController, sessionSeed };

        setIsGenerating(true);
        setIsReadingStreamActive(false);
        setPersonalReading(null);
        setJournalStatus(null);
        setNarrativePhase('analyzing');
        setSrAnnouncement('Step 1 of 3: Analyzing your spread, positions, and reflections.');
        setReadingMeta((prev) => ({ ...prev, requestId: null, ephemeris: null }));
        setLastCardsForFeedback([]);

        try {
            const safeSpreadKey = normalizeSpreadKey(selectedSpread);
            const spreadInfo = getSpreadInfo(safeSpreadKey);
            if (!spreadInfo) {
                throw new Error('Unable to find spread definition.');
            }
            const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

            const cardsInfo = reading.map((card, idx) => {
                const originalCard = allCards.find(item => item.name === card.name) || card;
                const meaningText = card.isReversed ? originalCard.reversed : originalCard.upright;
                const position = spreadInfo.positions[idx] || `Position ${idx + 1}`;

                const suit = originalCard.suit || null;
                const rank = originalCard.rank || null;
                const rankValue =
                    typeof originalCard.rankValue === 'number' ? originalCard.rankValue : null;
                const canonicalName = canonicalizeCardName(originalCard.name, deckStyleId) || originalCard.name;
                const canonicalKey = canonicalCardKey(canonicalName || originalCard.name, deckStyleId);

                return {
                    position,
                    card: card.name,
                    canonicalName,
                    canonicalKey,
                    aliases: Array.isArray(originalCard.aliases) ? originalCard.aliases : [],
                    orientation: card.isReversed ? 'Reversed' : 'Upright',
                    meaning: meaningText,
                    number: card.number,
                    suit,
                    rank,
                    rankValue,
                    userReflection: (reflections[idx] || '').trim() || null
                };
            });

            const reflectionsText = Object.entries(reflections)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([index, text]) => {
                    if (typeof text !== 'string' || !text.trim()) return '';
                    const idx = Number(index);
                    const position = cardsInfo[idx]?.position || `Position ${idx + 1}`;
                    return `${position}: ${text.trim()}`;
                })
                .filter(Boolean)
                .join('\n');

            setNarrativePhase('analyzing');
            setSrAnnouncement('Step 1 of 3: Analyzing spread for your narrative.');

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
                reflectionsText,
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
            const normalizedPayload = safeParseReadingRequest(payload);
            if (!normalizedPayload.success) {
                setIsGenerating(false);
                setNarrativePhase('error');
                setJournalStatus({
                    type: 'error',
                    message: normalizedPayload.error || 'Reading request is missing required details.'
                });
                setSrAnnouncement('Reading request is missing required details for narrative generation.');
                return;
            }

            setNarrativePhase('drafting');
            setSrAnnouncement('Step 2 of 3: Drafting narrative insights.');

            const startResponse = await fetch('/api/tarot-reading/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
                throw new Error(finalMessage);
            }

            const startData = await startResponse.json();
            const jobId = startData?.jobId;
            const jobToken = startData?.jobToken;
            if (!jobId || !jobToken) {
                throw new Error('Unable to start reading at this time. Please try again.');
            }

            const readingKey = buildReadingKey();

            cardsInfoRef.current = cardsInfo;
            setReadingJob({
                jobId,
                jobToken,
                cursor: 0,
                readingKey
            });

            await streamReadingJob({ jobId, jobToken, cursor: 0, resume: false });
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.debug('generatePersonalReading aborted');
                return;
            }
            console.error('generatePersonalReading error:', error);
            const errorMsg =
                typeof error?.message === 'string' && error.message.trim()
                    ? error.message.trim()
                    : 'Unable to generate reading at this time. Please try again in a moment.';
            const formattedError = formatReading(errorMsg);
            formattedError.isError = true;
            formattedError.isStreaming = false;
            formattedError.isServerStreamed = false;
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
        personalizationForRequest,
        locationEnabled,
        cachedLocation,
        persistLocationToJournal,
        buildReadingKey,
        setReadingJob,
        streamReadingJob
    ]);

    // --- Logic: Analysis Highlights ---

    // Local fallback relationships
    const relationships = useMemo(() => {
        if (!reading || !reading.length) return [];
        if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
            return []; // Server analysis takes precedence
        }
        return computeRelationships(reading || []);
    }, [reading, spreadAnalysis]);

    // Highlights Memoization
    const derivedHighlights = useMemo(() => {
        if (!reading || revealedCards.size !== (reading?.length || 0)) return null;
        if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
            const notes = [];
            if (themes) {
                const deckScope = includeMinors
                    ? 'Full deck (Major + Minor Arcana).'
                    : 'Major Arcana focus (archetypal themes).';
                notes.push({ key: 'deck-scope', icon: '-', title: 'Deck scope:', text: deckScope });
                if (themes.dominantSuit || themes.suitFocus) {
                    notes.push({ key: 'suit-dominance', icon: '♠', title: 'Suit Dominance:', text: themes.suitFocus || `A strong presence of ${themes.dominantSuit} suggests this suit's themes are central to your situation.` });
                }
                if (themes.elementalBalance) {
                    notes.push({ key: 'elemental-balance', icon: '⚡', title: 'Elemental Balance:', text: themes.elementalBalance });
                }
                if (themes.reversalDescription) {
                    notes.push({ key: 'reversal-framework', icon: '⤴', title: 'Reversal Lens:', text: `${themes.reversalDescription.name} — ${themes.reversalDescription.description}` });
                }
            }
            // Track cross-checks separately to limit them (reduces information overload)
            let crossCheckCount = 0;
            const MAX_CROSS_CHECKS = 2;

            spreadAnalysis.relationships.forEach((rel, index) => {
                if (!rel || !rel.summary) return;

                // Limit cross-checks to the 2 most important to reduce density
                if (rel.type === 'cross-check') {
                    crossCheckCount++;
                    if (crossCheckCount > MAX_CROSS_CHECKS) return;
                }

                let title = 'Pattern';
                let icon = '•';
                const typeMap = {
                    'sequence': { title: 'Story Flow', icon: '→' },
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
    }, [reading, revealedCards, spreadAnalysis, themes, includeMinors]);

    const fallbackHighlights = useMemo(() => {
        const totalCards = reading?.length ?? 0;
        if (!reading || totalCards === 0 || revealedCards.size !== totalCards) {
            return [];
        }
        const items = [];
        items.push({
            key: 'deck-scope',
            icon: '-',
            title: 'Deck scope:',
            text: includeMinors ? 'Full deck (Major + Minor Arcana).' : 'Major Arcana focus (archetypal themes).'
        });
        const reversedIdx = reading.map((card, index) => (card.isReversed ? index : -1)).filter(index => index >= 0);
        if (reversedIdx.length > 0) {
            const hasCluster = reversedIdx.some((idx, j) => j > 0 && idx === reversedIdx[j - 1] + 1);
            let text = `These often point to inner processing, timing delays, or tension in the theme.`;
            if (hasCluster) text += ' Consecutive reversals suggest the theme persists across positions.';
            items.push({ key: 'reversal-summary', icon: '⤴', title: `Reversed cards (${reversedIdx.length}):`, text });
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
    }, [reading, revealedCards, includeMinors, relationships]);

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
        return `${position}: ${card.name}${card.isReversed ? ' reversed' : ''}`;
    }, [reading, selectedSpread]);

    const dealNext = useCallback(() => {
        if (!reading) return;
        const nextIndex = reading.findIndex((_, index) => !revealedCards.has(index));
        if (nextIndex < 0) return;
        const description = describeCardAtIndex(nextIndex);
        if (description) {
            setSrAnnouncement(`Revealed ${description}.`);
        }
        baseDealNext();
    }, [baseDealNext, describeCardAtIndex, reading, revealedCards]);

    const revealCard = useCallback((index) => {
        if (!reading || !reading[index]) return;
        const description = describeCardAtIndex(index);
        if (description) {
            setSrAnnouncement(`Revealed ${description}.`);
        }
        baseRevealCard(index);
    }, [baseRevealCard, describeCardAtIndex, reading]);

    const revealAll = useCallback(() => {
        if (!reading || reading.length === 0) return;
        const descriptions = reading
            .map((_, index) => (!revealedCards.has(index) ? describeCardAtIndex(index) : null))
            .filter(Boolean);

        if (descriptions.length === 1) {
            setSrAnnouncement(`Revealed ${descriptions[0]}.`);
        } else if (descriptions.length > 1) {
            const preview = descriptions.slice(0, 2).join('; ');
            const suffix = descriptions.length > 2 ? '…' : '.';
            setSrAnnouncement(`Revealed ${descriptions.length} cards — ${preview}${suffix}`);
        } else if (revealedCards.size === reading.length) {
            setSrAnnouncement('All cards already revealed.');
        }

        baseRevealAll();
    }, [baseRevealAll, describeCardAtIndex, reading, revealedCards]);

    const value = useMemo(() => ({
        ...audioController,
        ...tarotState,
        ...visionAnalysis,
        shuffle: handleShuffle,
        dealNext,
        revealCard,
        revealAll,
        personalReading, setPersonalReading,
        isGenerating, setIsGenerating,
        isReadingStreamActive,
        narrativePhase, setNarrativePhase,
        spreadAnalysis, setSpreadAnalysis,
        themes, setThemes,
        emotionalTone, setEmotionalTone,
        analysisContext, setAnalysisContext,
        reasoningSummary, setReasoningSummary,
        readingMeta, setReadingMeta,
        journalStatus, setJournalStatus,
        reflections, setReflections,
        followUps, setFollowUps,
        lastCardsForFeedback, setLastCardsForFeedback,
        showAllHighlights, setShowAllHighlights,
        generatePersonalReading,
        highlightItems,
        srAnnouncement, setSrAnnouncement
    }), [
        audioController,
        tarotState,
        visionAnalysis,
        handleShuffle,
        dealNext,
        revealCard,
        revealAll,
        personalReading,
        isGenerating,
        isReadingStreamActive,
        narrativePhase,
        spreadAnalysis,
        themes,
        emotionalTone,
        analysisContext,
        reasoningSummary,
        readingMeta,
        journalStatus,
        reflections,
        followUps,
        lastCardsForFeedback,
        showAllHighlights,
        generatePersonalReading,
        highlightItems,
        srAnnouncement
    ]);

    return (
        <ReadingContext.Provider value={value}>
            {children}
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
