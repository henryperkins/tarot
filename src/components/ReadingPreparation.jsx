import { useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { AudioControls } from './AudioControls';
import { ExperienceSettings } from './ExperienceSettings';
import { CoachSuggestion } from './CoachSuggestion';
import { RitualControls } from './RitualControls';

export function ReadingPreparation({
    variant = 'desktop',
    // State & Setters
    userQuestion,
    setUserQuestion,
    placeholderIndex,
    onPlaceholderRefresh,
    setAllowPlaceholderCycle,

    // Coach
    coachRecommendation,
    applyCoachRecommendation,
    dismissCoachRecommendation,
    onLaunchCoach,

    // UI State
    prepareSectionsOpen,
    togglePrepareSection,
    prepareSummaries,
    prepareSectionLabels,

    // Ritual Props
    hasKnocked,
    handleKnock,
    cutIndex,
    setCutIndex,
    hasCut,
    applyCut,
    knockCount,
    onSkipRitual,
    deckAnnouncement,
    sectionRef
}) {
    const renderSectionContent = (section) => {
        if (section === 'intention') {
            return (
                <>
                    <QuestionInput
                        userQuestion={userQuestion}
                        setUserQuestion={setUserQuestion}
                        placeholderIndex={placeholderIndex}
                        onFocus={() => setAllowPlaceholderCycle(false)}
                        onBlur={() => !userQuestion.trim() && setAllowPlaceholderCycle(true)}
                        onPlaceholderRefresh={onPlaceholderRefresh}
                        onLaunchCoach={onLaunchCoach}
                    />
                    <CoachSuggestion
                        recommendation={coachRecommendation}
                        onApply={applyCoachRecommendation}
                        onDismiss={dismissCoachRecommendation}
                        showTitle={false}
                    />
                </>
            );
        }
        if (section === 'audio') {
            return <AudioControls />;
        }
        if (section === 'experience') {
            return <ExperienceSettings />;
        }
        if (section === 'ritual') {
            return (
                <RitualControls
                    hasKnocked={hasKnocked}
                    handleKnock={handleKnock}
                    cutIndex={cutIndex}
                    setCutIndex={setCutIndex}
                    hasCut={hasCut}
                    applyCut={applyCut}
                    knockCount={knockCount}
                    onSkip={onSkipRitual}
                    deckAnnouncement={deckAnnouncement}
                />
            );
        }
        return null;
    };

    // Mobile section state - intention always open, others collapsible
    const [mobileSectionsOpen, setMobileSectionsOpen] = useState({
        intention: true,  // Always expanded on mobile
        audio: false,
        experience: false,
        ritual: true  // Ritual is important, start expanded
    });

    const toggleMobileSection = (section) => {
        setMobileSectionsOpen(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const MOBILE_SECTION_META = {
        intention: { title: 'Intention', description: 'Your guiding question or focus' },
        audio: { title: 'Audio', description: 'Voice narration and ambience' },
        experience: { title: 'Experience', description: 'Theme, deck, and reversal settings' },
        ritual: { title: 'Ritual', description: 'Knock and cut to prepare the deck' }
    };

    if (variant === 'mobile') {
        return (
            <div className="space-y-4">
                {['intention', 'audio', 'experience', 'ritual'].map(section => {
                    const meta = MOBILE_SECTION_META[section];
                    const isOpen = mobileSectionsOpen[section];
                    const isIntention = section === 'intention';

                    return (
                        <section
                            key={section}
                            className="rounded-2xl border border-secondary/20 bg-surface/40 overflow-hidden"
                        >
                            {/* Section header - clickable to toggle except for intention */}
                            <button
                                type="button"
                                onClick={() => !isIntention && toggleMobileSection(section)}
                                disabled={isIntention}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition touch-manipulation ${
                                    isIntention ? 'cursor-default' : 'active:bg-secondary/5'
                                }`}
                                aria-expanded={isOpen}
                                aria-controls={`mobile-section-${section}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-accent">
                                        {meta.title}
                                    </h3>
                                    <p className="text-xs text-muted truncate">
                                        {meta.description}
                                    </p>
                                </div>
                                {!isIntention && (
                                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-surface/60 border border-secondary/20">
                                        {isOpen
                                            ? <CaretUp className="w-4 h-4 text-accent" />
                                            : <CaretDown className="w-4 h-4 text-accent" />
                                        }
                                    </span>
                                )}
                                {isIntention && (
                                    <span className="flex-shrink-0 text-[0.65rem] uppercase tracking-wider text-secondary/70 bg-secondary/10 px-2 py-1 rounded-full">
                                        Always open
                                    </span>
                                )}
                            </button>

                            {/* Section content */}
                            <div
                                id={`mobile-section-${section}`}
                                className={`transition-all duration-200 ${
                                    isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
                                }`}
                            >
                                <div className="px-4 pb-4 pt-1">
                                    {renderSectionContent(section)}
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    }

    return (
        <section
            ref={sectionRef}
            aria-label="Prepare your reading"
            id="step-intention"
            className="hidden sm:block prepare-reading-panel deck-selector-panel animate-fade-in scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]"
        >
            <div className="relative z-10 space-y-5">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-soft">Prepare Your Reading</p>
                        <p className="text-xs text-muted max-w-2xl">
                            Capture an intention, tune experience controls, and complete the ritual setup inside one textured command center.
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-black/30 px-3 py-1 text-[0.7rem] text-accent backdrop-blur">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-soft animate-pulse" aria-hidden="true" />
                        <span>All-in-one prep</span>
                    </div>
                </header>

                <div className="prepare-summary-chip">
                    <span>{prepareSummaries.intention}</span>
                    <span aria-hidden="true">·</span>
                    <span>{prepareSummaries.experience}</span>
                    <span aria-hidden="true">·</span>
                    <span>{prepareSummaries.ritual}</span>
                </div>

                <div className="space-y-4">
                    <div className="prepare-card">
                        <div className="prepare-card__header">
                            <div>
                                <p className="font-serif text-accent text-base leading-tight">Intention</p>
                                <p className="text-xs text-muted">Set your guiding prompt before you draw — always available without expanding a panel.</p>
                            </div>
                            <span className="prepare-card__badge">Inline</span>
                        </div>
                        <div className="prepare-card__body">
                            {renderSectionContent('intention')}
                        </div>
                    </div>

                    {(['audio', 'experience', 'ritual']).map(section => (
                        <div key={section} className={`prepare-card ${prepareSectionsOpen[section] ? 'prepare-card--open' : ''}`}>
                            <button
                                type="button"
                                onClick={() => togglePrepareSection(section)}
                                className="prepare-card__toggle"
                                aria-expanded={prepareSectionsOpen[section]}
                            >
                                <div>
                                    <p className="font-serif text-accent text-base leading-tight">
                                        {prepareSectionLabels[section]?.title || (section === 'audio' ? 'Audio' : section.charAt(0).toUpperCase() + section.slice(1))}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {prepareSummaries[section] || (section === 'audio' ? 'Voice narration and ambience settings' : '')}
                                    </p>
                                </div>
                                {prepareSectionsOpen[section]
                                    ? <CaretUp className="w-4 h-4 text-accent" />
                                    : <CaretDown className="w-4 h-4 text-accent" />}
                            </button>
                            {prepareSectionsOpen[section] && (
                                <div className="prepare-card__content">
                                    {renderSectionContent(section)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="deck-panel-footnote prepare-panel-footnote">
                    <p className="text-[0.72rem] leading-relaxed text-muted">
                        <strong className="text-accent">Tip:</strong> Keep these steps updated before drawing to help the AI align narration tone, audio, and ritual cues.
                    </p>
                </div>
            </div>
        </section>
    );
}
