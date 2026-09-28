import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, CaretUp, Sparkle, Stack } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { RitualControls } from './RitualControls';
import { DeckSelector } from './DeckSelector';

// Mobile tab configuration (Audio/Theme settings moved to Account page).
// The question is written on the page itself (QuickIntentionCard), so the
// drawer no longer carries a second editor for it.
const MOBILE_TABS = [
    { id: 'deck', label: 'Deck', icon: Stack },
    { id: 'ritual', label: 'Ritual', icon: Sparkle }
];

export function ReadingPreparation({
    variant = 'desktop',
    // State & Setters
    userQuestion,
    setUserQuestion,
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
    initialMobileTab = 'deck',
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
        const requested = typeof initialMobileTab === 'string' ? initialMobileTab : 'deck';
        const normalizedRequested = (shouldSkipRitual && requested === 'ritual') ? 'deck' : requested;
        return availableTabIds.has(normalizedRequested) ? normalizedRequested : 'deck';
    });
    const tabRefs = useRef({});

    // Derive the effective active tab - if ritual is skipped and ritual was selected, fall back to deck
    const activeTab = (shouldSkipRitual && activeTabRaw === 'ritual') ? 'deck' : activeTabRaw;

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
        // With the ritual hidden by personalization only Deck remains: no tabs.
        const hasTabs = mobileTabs.length > 1;
        return (
            <div className="space-y-4">
                {/* Segmented tab control */}
                {hasTabs && (
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
                                    flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg min-h-touch
                                    text-xs font-semibold transition-colors touch-manipulation
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
                )}

                <div className="px-1 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
                    <span>Audio and appearance live in Settings.</span>
                    <Link
                        to="/account#audio"
                        className="min-h-touch inline-flex items-center rounded-lg px-2 text-accent underline underline-offset-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        Open Settings
                    </Link>
                </div>

                {/* Tab panel content */}
                    {mobileTabs.map((tab) => (
                        <div
                            key={tab.id}
                            id={`mobile-panel-${tab.id}`}
                            role={hasTabs ? 'tabpanel' : undefined}
                            aria-labelledby={hasTabs ? `mobile-tab-${tab.id}` : undefined}
                            hidden={activeTab !== tab.id}
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
                        <h2 className="font-serif text-xl text-accent">Prepare your reading</h2>
                        <p className="mt-1 text-sm text-muted max-w-2xl">
                            Add an optional question and settle into your reading.
                        </p>
                    </div>
                </header>

                <div className="space-y-4">
                    <div className="prepare-card">
                        <div className="prepare-card__body">
                            {renderSectionContent('intention')}
                        </div>
                    </div>

                    {sectionOrder.map(section => (
                        <div key={section} className={`prepare-card ${prepareSectionsOpen[section] ? 'prepare-card--open' : ''}`}>
                            <button
                                type="button"
                                onClick={() => togglePrepareSection(section)}
                                className="prepare-card__toggle min-h-touch"
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
                    <p className="text-xs leading-relaxed text-muted">
                        Audio and appearance live in{' '}
                        <Link to="/account#audio" className="text-accent underline underline-offset-2 font-semibold">
                            Settings
                        </Link>.
                    </p>
                </div>
            </div>
        </section>
    );
}
