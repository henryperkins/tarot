import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
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
        dealIndex,
        dealNext: baseDealNext,
        revealCard: baseRevealCard,
        revealAll: baseRevealAll,
        sessionSeed
    } = tarotState;
    const { deckStyleId, includeMinors, reversalFramework, personalization } = usePreferences();

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
        const payload = {
            displayName: sanitizedName || undefined,
            readingTone: personalization.readingTone || undefined,
            spiritualFrame: personalization.spiritualFrame || undefined,
            tarotExperience: personalization.tarotExperience || undefined,
            preferredSpreadDepth: personalization.preferredSpreadDepth || undefined
        };
        return Object.values(payload).some((value) => value !== undefined) ? payload : null;
    }, [personalization]);

    // 4. Reading Generation State
    const [personalReading, setPersonalReading] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [narrativePhase, setNarrativePhase] = useState('idle');
    const [spreadAnalysis, setSpreadAnalysis] = useState(null);
    const [themes, setThemes] = useState(null);
    const [emotionalTone, setEmotionalTone] = useState(null);
    const [analysisContext, setAnalysisContext] = useState(null);
    const [readingMeta, setReadingMeta] = useState({
        requestId: null,
        provider: null,
        spreadKey: null,
        spreadName: null,
        deckStyle: null,
        userQuestion: null,
        graphContext: null
    });

    // 5. UI State
    const [journalStatus, setJournalStatus] = useState(null);
    const [reflections, setReflections] = useState({});
    const [lastCardsForFeedback, setLastCardsForFeedback] = useState([]);
    const [showAllHighlights, setShowAllHighlights] = useState(false);
    const [srAnnouncement, setSrAnnouncement] = useState('');

    const visionResearchEnabled = import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true';
    const inFlightReadingRef = useRef(null);

    const cancelInFlightReading = useCallback(() => {
        if (inFlightReadingRef.current?.controller) {
            inFlightReadingRef.current.controller.abort();
        }
        inFlightReadingRef.current = null;
    }, []);

    // Reset analysis state when Shuffle is triggered
    const handleShuffle = useCallback(() => {
        cancelInFlightReading();
        shuffle(() => {
            setPersonalReading(null);
            setThemes(null);
            setEmotionalTone(null);
            setSpreadAnalysis(null);
            setAnalysisContext(null);
            setIsGenerating(false);
            setNarrativePhase('idle');
            setJournalStatus(null);
            setReflections({});
            visionAnalysis.setVisionResults([]);
            visionAnalysis.setVisionConflicts([]);
            visionAnalysis.resetVisionProof();
            setShowAllHighlights(false);
            setSrAnnouncement('');
        });
    }, [shuffle, visionAnalysis, cancelInFlightReading]);

    // Generate Personal Reading Logic
    const generatePersonalReading = useCallback(async () => {
        if (!reading || reading.length === 0) {
            const errorMsg = 'Please draw your cards before requesting a personalized reading.';
            const formattedError = formatReading(errorMsg);
            formattedError.isError = true;
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
        const controller = new AbortController();
        inFlightReadingRef.current = { controller, sessionSeed };

        setIsGenerating(true);
        setPersonalReading(null);
        setJournalStatus(null);
        setNarrativePhase('analyzing');
        setSrAnnouncement('Step 1 of 3: Analyzing your spread, positions, and reflections.');
        setReadingMeta((prev) => ({ ...prev, requestId: null }));
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

            const requestPayload = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: null,
                signal: controller.signal
            };

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

            requestPayload.body = JSON.stringify(normalizedPayload.data);

            setNarrativePhase('drafting');
            setSrAnnouncement('Step 2 of 3: Drafting narrative insights.');

            const response = await fetch('/api/tarot-reading', requestPayload);

            if (!response.ok) {
                const errText = await response.text();
                console.error('Tarot reading API error:', response.status, errText);
                throw new Error('Failed to generate reading');
            }

            const data = await response.json();
            if (!data?.reading || !data.reading.trim()) {
                throw new Error('Empty reading returned');
            }

            if (
                controller.signal.aborted ||
                !inFlightReadingRef.current ||
                inFlightReadingRef.current.controller !== controller
            ) {
                return;
            }

            setNarrativePhase('polishing');
            setSrAnnouncement('Step 3 of 3: Final polishing and assembling your narrative.');

            setThemes(data.themes || null);
            setEmotionalTone(data.emotionalTone || null);
            setSpreadAnalysis(data.spreadAnalysis || null);
            setAnalysisContext(data.context || null);

            const formatted = formatReading(data.reading.trim());
            formatted.isError = false;
            formatted.provider = data.provider || 'local-composer';
            formatted.requestId = data.requestId || null;
            setPersonalReading(formatted);
            setNarrativePhase('complete');
            setLastCardsForFeedback(
                cardsInfo.map((card) => ({
                    position: card.position,
                    card: card.card,
                    orientation: card.orientation
                }))
            );
            setReadingMeta({
                requestId: data.requestId || null,
                provider: data.provider || 'local',
                spreadKey: safeSpreadKey,
                spreadName: spreadInfo.name,
                deckStyle: deckStyleId,
                userQuestion,
                graphContext: data.themes?.knowledgeGraph || null
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.debug('generatePersonalReading aborted');
                return;
            }
            console.error('generatePersonalReading error:', error);
            const errorMsg = 'Unable to generate reading at this time. Please try again in a moment.';
            const formattedError = formatReading(errorMsg);
            formattedError.isError = true;
            setPersonalReading(formattedError);
            setJournalStatus({
                type: 'error',
                message: 'Unable to generate your narrative right now. Please try again shortly.'
            });
            setNarrativePhase('error');
            setSrAnnouncement('Unable to generate your narrative right now.');
        } finally {
            if (inFlightReadingRef.current?.controller === controller) {
                inFlightReadingRef.current = null;
            }
            setIsGenerating(false);
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
        personalizationForRequest
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
        if (!reading || dealIndex >= reading.length) return;
        const description = describeCardAtIndex(dealIndex);
        if (description) {
            setSrAnnouncement(`Revealed ${description}.`);
        }
        baseDealNext();
    }, [baseDealNext, dealIndex, describeCardAtIndex, reading]);

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
        narrativePhase, setNarrativePhase,
        spreadAnalysis, setSpreadAnalysis,
        themes, setThemes,
        emotionalTone, setEmotionalTone,
        analysisContext, setAnalysisContext,
        readingMeta, setReadingMeta,
        journalStatus, setJournalStatus,
        reflections, setReflections,
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
        narrativePhase,
        spreadAnalysis,
        themes,
        emotionalTone,
        analysisContext,
        readingMeta,
        journalStatus,
        reflections,
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
