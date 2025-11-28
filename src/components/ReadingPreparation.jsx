import { useState, useCallback, useRef, useEffect } from 'react';
import { CaretDown, CaretUp, TextAlignLeft, SpeakerHigh, Palette, Sparkle } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { AudioControls } from './AudioControls';
import { ExperienceSettings } from './ExperienceSettings';
import { CoachSuggestion } from './CoachSuggestion';
import { RitualControls } from './RitualControls';

// Mobile tab configuration
const MOBILE_TABS = [
    { id: 'intention', label: 'Intent', icon: TextAlignLeft },
    { id: 'audio', label: 'Audio', icon: SpeakerHigh },
    { id: 'experience', label: 'Theme', icon: Palette },
    { id: 'ritual', label: 'Ritual', icon: Sparkle }
];

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
    sectionRef,
    shouldSkipRitual = false
}) {
    const mobileTabs = shouldSkipRitual
        ? MOBILE_TABS.filter(tab => tab.id !== 'ritual')
        : MOBILE_TABS;
    const sectionOrder = shouldSkipRitual
        ? ['audio', 'experience']
        : ['audio', 'experience', 'ritual'];

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
            if (shouldSkipRitual) {
                return (
                    <p className="text-sm text-muted">
                        Ritual steps are hidden based on your personalization preferences.
                    </p>
                );
            }
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

    // Mobile tabbed navigation state
    const [activeTab, setActiveTab] = useState('intention');
    const tabRefs = useRef({});

    useEffect(() => {
        if (shouldSkipRitual && activeTab === 'ritual') {
            setActiveTab('intention');
        }
    }, [shouldSkipRitual, activeTab]);

    const handleTabChange = useCallback((tabId) => {
        setActiveTab(tabId);
    }, []);

    // Keyboard navigation for tabs (roving tabindex pattern)
    const handleTabKeyDown = useCallback((event, currentIndex) => {
        const tabIds = mobileTabs.map(t => t.id);
        let nextIndex = currentIndex;

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                nextIndex = currentIndex === 0 ? tabIds.length - 1 : currentIndex - 1;
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextIndex = currentIndex === tabIds.length - 1 ? 0 : currentIndex + 1;
                break;
            case 'Home':
                event.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                event.preventDefault();
                nextIndex = tabIds.length - 1;
                break;
            default:
                return;
        }

        const nextTabId = tabIds[nextIndex];
        setActiveTab(nextTabId);
        tabRefs.current[nextTabId]?.focus();
    }, []);

    if (variant === 'mobile') {
        return (
            <div className="space-y-4">
                {/* Segmented tab control */}
                <div
                    className="flex bg-surface-muted/60 rounded-xl p-1 border border-secondary/20"
                    role="tablist"
                    aria-label="Preparation settings"
                >
                    {mobileTabs.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                ref={(el) => { tabRefs.current[tab.id] = el; }}
                                type="button"
                                role="tab"
                                id={`mobile-tab-${tab.id}`}
                                aria-selected={isActive}
                                aria-controls={`mobile-panel-${tab.id}`}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => handleTabChange(tab.id)}
                                onKeyDown={(e) => handleTabKeyDown(e, index)}
                                className={`
                                    flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg
                                    text-xs font-semibold transition-all touch-manipulation
                                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70
                                    ${isActive
                                        ? 'bg-surface shadow-sm border border-secondary/30 text-accent'
                                        : 'text-muted hover:text-main'
                                    }
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-secondary' : ''}`} weight={isActive ? 'fill' : 'regular'} />
                                <span className="truncate">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab panel content */}
                {mobileTabs.map((tab) => (
                    <div
                        key={tab.id}
                        id={`mobile-panel-${tab.id}`}
                        role="tabpanel"
                        aria-labelledby={`mobile-tab-${tab.id}`}
                        hidden={activeTab !== tab.id}
                        className={activeTab === tab.id ? 'animate-fade-in' : ''}
                    >
                        {activeTab === tab.id && (
                            <div className="rounded-2xl border border-secondary/20 bg-surface/40 p-4">
                                {renderSectionContent(tab.id)}
                            </div>
                        )}
                    </div>
                ))}
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
                    {!shouldSkipRitual && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>{prepareSummaries.ritual}</span>
                        </>
                    )}
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

                    {sectionOrder.map(section => (
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
