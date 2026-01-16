import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, CaretUp, TextAlignLeft, Sparkle, Stack } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { RitualControls } from './RitualControls';
import { DeckSelector } from './DeckSelector';

// Mobile tab configuration (Audio/Theme settings moved to Account page)
const MOBILE_TABS = [
    { id: 'intention', label: 'Intent', icon: TextAlignLeft },
    { id: 'deck', label: 'Deck', icon: Stack },
    { id: 'ritual', label: 'Ritual', icon: Sparkle }
];

export function ReadingPreparation({
    variant = 'desktop',
    // State & Setters
    userQuestion,
    setUserQuestion,
    placeholderIndex,
    onPlaceholderRefresh,
    onQuestionFocus,
    onQuestionBlur,

    // Coach
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
    deckStyleId,
    onDeckChange,
    initialMobileTab = 'intention',
    sectionRef,
    shouldSkipRitual = false
}) {
    const mobileTabs = shouldSkipRitual
        ? MOBILE_TABS.filter(tab => tab.id !== 'ritual')
        : MOBILE_TABS;
    // Audio/Theme settings moved to Account page - only ritual remains as collapsible section
    const sectionOrder = shouldSkipRitual
        ? []
        : ['ritual'];

    const renderSectionContent = (section) => {
        if (section === 'intention') {
            return (
                <>
                    <QuestionInput
                        userQuestion={userQuestion}
                        setUserQuestion={setUserQuestion}
                        placeholderIndex={placeholderIndex}
                        onPlaceholderRefresh={onPlaceholderRefresh}
                        onFocus={onQuestionFocus}
                        onBlur={onQuestionBlur}
                        onLaunchCoach={onLaunchCoach}
                    />
                </>
            );
        }
        if (section === 'deck') {
            if (typeof onDeckChange !== 'function') {
                return (
                    <p className="text-sm text-muted">
                        Deck selection is unavailable right now.
                    </p>
                );
            }
            return (
                <DeckSelector
                    selectedDeck={deckStyleId}
                    onDeckChange={onDeckChange}
                />
            );
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
    const [activeTabRaw, setActiveTabRaw] = useState(() => {
        const availableTabIds = new Set(mobileTabs.map(tab => tab.id));
        const requested = typeof initialMobileTab === 'string' ? initialMobileTab : 'intention';
        const normalizedRequested = (shouldSkipRitual && requested === 'ritual') ? 'intention' : requested;
        return availableTabIds.has(normalizedRequested) ? normalizedRequested : 'intention';
    });
    const tabRefs = useRef({});

    // Derive the effective active tab - if ritual is skipped and ritual was selected, fall back to intention
    const activeTab = (shouldSkipRitual && activeTabRaw === 'ritual') ? 'intention' : activeTabRaw;

    const handleTabChange = useCallback((tabId) => {
        setActiveTabRaw(tabId);
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
        setActiveTabRaw(nextTabId);
        tabRefs.current[nextTabId]?.focus();
    }, [mobileTabs]);

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

                <div className="rounded-xl border border-secondary/20 bg-surface/40 px-3 py-2 text-[0.7rem] text-muted flex items-center justify-between gap-2">
                    <span>Audio and appearance live in Settings.</span>
                    <Link
                        to="/account#audio"
                        className="text-accent underline underline-offset-2 text-[0.7rem] font-semibold"
                    >
                        Open Settings
                    </Link>
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
                            tab.id === 'deck'
                                ? renderSectionContent(tab.id)
                                : (
                                    <div className="rounded-2xl border border-secondary/20 bg-surface/40 p-4">
                                        {renderSectionContent(tab.id)}
                                    </div>
                                )
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
                            Set your intention, choose your deck, and complete the ritual before drawing.
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-surface/60 px-3 py-1 text-[0.7rem] text-accent backdrop-blur">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-soft animate-pulse" aria-hidden="true" />
                        <span>All-in-one prep</span>
                    </div>
                </header>

                <div className="prepare-summary-chip">
                    <span>{prepareSummaries.intention}</span>
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
                        <strong className="text-accent">Tip:</strong> Complete preparation before drawing to help the AI craft a personalized reading.
                    </p>
                    <p className="text-[0.72rem] leading-relaxed text-muted">
                        Audio and appearance live in{' '}
                        <Link to="/account" className="text-accent underline underline-offset-2 font-semibold">
                            Settings
                        </Link>.
                    </p>
                </div>
            </div>
        </section>
    );
}
