import React, { useMemo } from 'react';
import { Sparkles, RotateCcw, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SPREADS } from '../data/spreads';
import { ReadingGrid } from './ReadingGrid';
import { MarkdownRenderer } from './MarkdownRenderer';
import { HelperToggle } from './HelperToggle';
import { SpreadPatterns } from './SpreadPatterns';
import { PatternHighlightBanner } from './PatternHighlightBanner';
import { VisionValidationPanel } from './VisionValidationPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSaveReading } from '../hooks/useSaveReading';

export function ReadingDisplay({ sectionRef }) {
    const navigate = useNavigate();
    const { saveReading } = useSaveReading();

    // --- Contexts ---
    const {
        // Audio
        ttsState,
        showVoicePrompt,
        setShowVoicePrompt,
        handleNarrationButtonClick,
        handleNarrationStop,
        handleVoicePromptEnable,

        // Tarot State
        selectedSpread,
        reading,
        isShuffling,
        revealedCards,
        setRevealedCards,
        dealIndex,
        setDealIndex,
        sessionSeed,
        userQuestion,
        shuffle,
        dealNext,
        revealCard,
        revealAll,

        // Vision
        visionResults,
        visionConflicts,
        isVisionReady,
        hasVisionData,
        handleVisionResults,
        handleRemoveVisionResult,
        handleClearVisionResults,
        feedbackVisionSummary,

        // Reading Generation & UI
        personalReading,
        isGenerating,
        analyzingText,
        themes,
        readingMeta,
        journalStatus,
        setJournalStatus,
        reflections,
        setReflections,
        lastCardsForFeedback,
        showAllHighlights,
        setShowAllHighlights,
        generatePersonalReading,
        highlightItems
    } = useReading();

    const {
        voiceOn,
        deckStyleId
    } = usePreferences();

    const visionResearchEnabled = import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true';

    // --- Derived State ---
    const isPersonalReadingError = Boolean(personalReading?.isError);
    const fullReadingText = !isPersonalReadingError ? personalReading?.raw || personalReading?.normalized || '' : '';

    // --- Handlers ---
    const handleNarrationWrapper = () => handleNarrationButtonClick(fullReadingText, isPersonalReadingError);
    const handleVoicePromptWrapper = () => handleVoicePromptEnable(fullReadingText);

    return (
        <section ref={sectionRef} id="step-reading" className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]" aria-label="Draw and explore your reading">
            <div className="mb-4 sm:mb-5">
                <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">Reading</p>
                <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">Draw and reveal your cards, explore the spread, and weave your narrative.</p>
            </div>
            {/* Primary CTA */}
            {!reading && (
                <div className="hidden sm:block text-center mb-8 sm:mb-10">
                    <button onClick={shuffle} disabled={isShuffling} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                        <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                        <span>{isShuffling ? 'Shuffling the Cards...' : 'Draw Cards'}</span>
                    </button>
                </div>
            )}

            {visionResearchEnabled && (
                <div className="mb-6">
                    <VisionValidationPanel
                        deckStyle={deckStyleId}
                        onResults={handleVisionResults}
                        onRemoveResult={handleRemoveVisionResult}
                        onClearResults={handleClearVisionResults}
                        conflicts={visionConflicts}
                        results={visionResults}
                    />
                </div>
            )}

            {/* Reading Display */}
            {reading && (
                <div className="space-y-8">
                    {userQuestion && (<div className="text-center"><p className="text-amber-100/80 text-sm italic">Intention: {userQuestion}</p></div>)}
                    <div className="text-center text-amber-200 font-serif text-2xl mb-2">{SPREADS[selectedSpread].name}</div>
                    {reading.length > 1 && (<p className="text-center text-amber-100/85 text-xs-plus sm:text-sm mb-4">Reveal in order for a narrative flow, or follow your intuition and reveal randomly.</p>)}

                    {revealedCards.size < reading.length && (
                        <div className="hidden sm:block text-center">
                            <button type="button" onClick={revealAll} className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base">
                                <Star className="w-4 h-4 sm:w-5 sm:h-5" /><span>Reveal All Cards</span>
                            </button>
                            <p className="text-amber-300/80 text-xs sm:text-sm mt-2 sm:mt-3">{revealedCards.size} of {reading.length} cards revealed</p>
                        </div>
                    )}
                    {revealedCards.size > 0 && (
                        <div className="text-center mt-3 sm:mt-4">
                            <button type="button" onClick={() => { setRevealedCards(new Set()); setDealIndex(0); }} className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-amber-300/50 text-amber-100/80 text-xs sm:text-sm hover:text-amber-50 hover:border-amber-200/70 transition">
                                <span className="hidden xs:inline">Reset reveals (keep this spread)</span><span className="xs:hidden">Reset reveals</span>
                            </button>
                        </div>
                    )}
                    {reading && revealedCards.size < reading.length && (
                        <div className="hidden sm:block text-center">
                            <button onClick={dealNext} className="mt-3 inline-flex items-center justify-center bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/30 transition-all text-sm sm:text-base">
                                <span>Reveal Next Card ({Math.min(dealIndex + 1, reading.length)}/{reading.length})</span>
                            </button>
                        </div>
                    )}

                    <ReadingGrid
                        selectedSpread={selectedSpread}
                        reading={reading}
                        revealedCards={revealedCards}
                        revealCard={revealCard}
                        reflections={reflections}
                        setReflections={setReflections}
                    />

                    {revealedCards.size === reading.length && highlightItems.length > 0 && (
                        <div className="modern-surface p-4 sm:p-6 border border-emerald-400/40 space-y-4">
                            <h3 className="text-base sm:text-lg font-serif text-amber-200 mb-3 flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />Spread Highlights</h3>
                            <div className="sm:hidden space-y-3">
                                {highlightItems.slice(0, showAllHighlights ? highlightItems.length : 3).map(item => (
                                    <div key={item.key} className="flex items-start gap-3">
                                        <div className="text-amber-300 mt-1" aria-hidden="true">{item.icon}</div>
                                        <div className="text-amber-100/85 text-sm leading-snug"><span className="font-semibold text-amber-200">{item.title}</span> {item.text}</div>
                                    </div>
                                ))}
                                {highlightItems.length > 3 && (
                                    <button type="button" onClick={() => setShowAllHighlights(prev => !prev)} className="text-emerald-300 text-sm underline underline-offset-4">{showAllHighlights ? 'Hide extra insights' : 'See all insights'}</button>
                                )}
                            </div>
                            <div className="hidden sm:flex sm:flex-col sm:gap-3">
                                {highlightItems.map(item => (
                                    <div key={item.key} className="flex items-start gap-3">
                                        <div className="text-amber-300 mt-1" aria-hidden="true">{item.icon}</div>
                                        <div className="text-amber-100/85 text-sm leading-snug"><span className="font-semibold text-amber-200">{item.title}</span> {item.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!personalReading && revealedCards.size === reading.length && (
                        <div className="text-center">
                            <button onClick={generatePersonalReading} disabled={isGenerating} className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-emerald-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg">
                                <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                                {isGenerating ? <span className="text-sm sm:text-base">Weaving your personalized reflection from this spread...</span> : <span>Create Personal Narrative</span>}
                            </button>
                            {hasVisionData && !isVisionReady && <p className="mt-3 text-sm text-amber-100/80">⚠️ Vision data has conflicts - research telemetry may be incomplete.</p>}
                            <HelperToggle className="mt-3 max-w-xl mx-auto"><p>Reveal all cards to unlock a tailored reflection that weaves positions, meanings, and your notes into one coherent story.</p></HelperToggle>
                        </div>
                    )}

                    {isGenerating && analyzingText && (
                        <div className="max-w-3xl mx-auto text-center">
                            <div className="ai-panel-modern">
                                <div className="ai-panel-text" aria-live="polite">{analyzingText}</div>
                                <HelperToggle className="mt-3"><p>This reflection is generated from your spread and question to support insight, not to decide for you.</p></HelperToggle>
                            </div>
                        </div>
                    )}

                    {personalReading && !isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length > 0 && (
                        <SpreadPatterns themes={themes} />
                    )}

                    {personalReading && (
                        <div className="bg-gradient-to-r from-slate-900/80 via-slate-950/95 to-slate-900/80 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-emerald-400/40 shadow-2xl shadow-emerald-900/40 max-w-5xl mx-auto">
                            <h3 className="text-xl sm:text-2xl font-serif text-amber-200 mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />Your Personalized Narrative</h3>
                            <HelperToggle className="mt-3 max-w-2xl mx-auto"><p>This narrative braids together your spread positions, card meanings, and reflections into a single through-line. Read slowly, notice what resonates, and treat it as a mirror—not a script.</p></HelperToggle>
                            {userQuestion && (<div className="bg-slate-950/85 rounded-lg p-4 mb-4 border border-emerald-400/40"><p className="text-amber-300/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p></div>)}
                            {readingMeta?.graphContext?.narrativeHighlights && <PatternHighlightBanner patterns={readingMeta.graphContext.narrativeHighlights} />}
                            {personalReading.hasMarkdown ? <MarkdownRenderer content={personalReading.raw} /> : (
                                <div className="text-amber-100 leading-relaxed space-y-2 sm:space-y-3 md:space-y-4 max-w-none mx-auto text-left">
                                    {personalReading.paragraphs && personalReading.paragraphs.length > 0 ? personalReading.paragraphs.map((para, idx) => (<p key={idx} className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose">{para}</p>)) : <p className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose whitespace-pre-line">{personalReading.normalized || personalReading.raw || ''}</p>}
                                </div>
                            )}
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                                {reading && personalReading && !isPersonalReadingError && (
                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                        <button type="button" onClick={handleNarrationWrapper} className="px-3 sm:px-4 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/85 hover:bg-slate-900/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 text-xs sm:text-sm" disabled={!fullReadingText || (ttsState.status === 'loading' && ttsState.status !== 'paused' && ttsState.status !== 'playing')}>
                                            <span className="hidden xs:inline">{ttsState.status === 'loading' ? 'Preparing narration...' : ttsState.status === 'playing' ? 'Pause narration' : ttsState.status === 'paused' ? 'Resume narration' : 'Read this aloud'}</span>
                                            <span className="xs:hidden">{ttsState.status === 'loading' ? 'Loading...' : ttsState.status === 'playing' ? 'Pause' : ttsState.status === 'paused' ? 'Resume' : 'Play'}</span>
                                        </button>
                                        {(voiceOn && fullReadingText && (ttsState.status === 'playing' || ttsState.status === 'paused' || ttsState.status === 'loading')) && (
                                            <button type="button" onClick={handleNarrationStop} className="px-2 sm:px-3 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/70 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm">Stop</button>
                                        )}
                                        <button type="button" onClick={saveReading} className="hidden sm:inline-flex px-3 sm:px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm hover:bg-emerald-500/25 hover:text-emerald-100 transition"><span className="hidden xs:inline">Save this narrative to your journal</span><span className="xs:hidden">Save to journal</span></button>
                                        <button type="button" onClick={() => navigate('/journal')} className="px-3 sm:px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm hover:bg-amber-500/25 hover:text-amber-100 transition">View Journal</button>
                                    </div>
                                )}
                                {showVoicePrompt && (
                                    <div className="text-xs text-amber-100/85 bg-slate-900/70 border border-amber-400/30 rounded-lg px-3 py-2 text-center space-y-2" aria-live="polite">
                                        <p>Voice narration is disabled. Turn it on?</p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <button type="button" onClick={handleVoicePromptWrapper} className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 text-xs">Enable voice & play</button>
                                            <button type="button" onClick={() => setShowVoicePrompt(false)} className="px-3 py-1.5 rounded-full border border-slate-600/50 text-amber-100/80 hover:text-amber-50 text-xs">Maybe later</button>
                                        </div>
                                    </div>
                                )}
                                {journalStatus && <p role="status" aria-live="polite" className={`text-xs text-center max-w-sm ${journalStatus.type === 'success' ? 'text-emerald-200' : 'text-rose-200'}`}>{journalStatus.message}</p>}
                            </div>
                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-amber-500/20 flex flex-col gap-2 sm:gap-3 items-center">
                                <HelperToggle><p className="text-center">This reading considered card combinations, positions, emotional arcs, and your reflections to provide personalized guidance.</p></HelperToggle>
                            </div>
                            <div className="mt-6 w-full max-w-2xl">
                                <FeedbackPanel
                                    requestId={readingMeta.requestId}
                                    spreadKey={readingMeta.spreadKey || selectedSpread}
                                    spreadName={readingMeta.spreadName || SPREADS[selectedSpread]?.name}
                                    deckStyle={readingMeta.deckStyle || deckStyleId}
                                    provider={readingMeta.provider}
                                    userQuestion={readingMeta.userQuestion || userQuestion}
                                    cards={lastCardsForFeedback}
                                    visionSummary={feedbackVisionSummary}
                                />
                            </div>
                        </div>
                    )}

                    {!personalReading && !isGenerating && (
                        <div className="bg-gradient-to-r from-slate-900/80 to-slate-950/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-emerald-400/40 max-w-2xl mx-auto">
                            <h3 className="text-lg sm:text-xl font-serif text-amber-200 mb-2 sm:mb-3 flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />Interpretation Guidance</h3>
                            <HelperToggle className="mt-2">
                                <p>Notice how the cards speak to one another. Consider themes, repetitions, contrasts, and where your attention is drawn. Trust your intuition as much as any description.</p>
                                <p className="mt-2">This reading offers reflective guidance only. It is not a substitute for medical, mental health, legal, financial, or safety advice. If your situation involves health, legal risk, abuse, or crisis, consider reaching out to qualified professionals or trusted support services.</p>
                            </HelperToggle>
                        </div>
                    )}

                    <div className="hidden sm:block text-center mt-6 sm:mt-8">
                        <button onClick={shuffle} disabled={isShuffling} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                            <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                            <span className="hidden xs:inline">{isShuffling ? 'Shuffling the Cards...' : 'Draw New Reading'}</span>
                            <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'New Reading'}</span>
                        </button>
                    </div>
                </div>
            )}

            {!reading && !isShuffling && (
                <div className="text-center py-16 px-4">
                    <p className="text-amber-100/80 text-lg font-serif">Focus on your question, then draw your cards when you're ready.</p>
                </div>
            )}
        </section>
    );
}
