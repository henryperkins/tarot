import { useId } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { DeckSelector, DeckThumbnail } from './DeckSelector';
import { DECK_OPTIONS } from './deckOptions';

// The ritual is no longer part of preparation: it happens at the reading
// table, on the deck itself, before Deal (scenes/TableDeck).
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

    deckStyleId,
    onDeckChange,
    hasDrawnCards = false,
    sectionRef,
    // Desktop only: 'question' or 'details' (see the desktop render below).
    part = 'question',
    // Desktop 'details': reading options that follow the deck.
    children = null
}) {
    const idBase = useId();
    const canChangeDeck = typeof onDeckChange === 'function';

    if (variant === 'mobile') {
        // The handset drawer holds the deck. The question is written on the
        // page itself (QuickIntentionCard), and the ritual waits at the table.
        return (
            <div className="space-y-4">
                {canChangeDeck ? (
                    <DeckSelector
                        selectedDeck={deckStyleId}
                        onDeckChange={onDeckChange}
                        variant="drawer"
                        hasDrawnCards={hasDrawnCards}
                    />
                ) : (
                    <p className="text-sm text-muted">
                        Deck selection is unavailable right now.
                    </p>
                )}

                {/* A pointer to other settings; the deck comes first so short
                    phones show the choices without scrolling. */}
                <div className="px-1 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
                    <span>Audio and appearance live in Settings.</span>
                    <Link
                        to="/account#audio"
                        className="min-h-touch inline-flex items-center rounded-lg px-2 text-accent underline underline-offset-2 text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        Open Settings
                    </Link>
                </div>
            </div>
        );
    }

    if (part === 'question') {
        return (
            <section
                ref={sectionRef}
                aria-labelledby={`${idBase}-heading`}
                id="step-intention"
                tabIndex={-1}
                className="hidden sm:block prepare-reading-panel animate-fade-in"
            >
                <div className="relative z-10 space-y-4">
                    <header>
                        <h2 id={`${idBase}-heading`} className="font-serif text-xl text-accent">Prepare your reading</h2>
                        <p className="mt-1 text-sm text-muted max-w-2xl">
                            Add an optional question and settle into your reading.
                        </p>
                    </header>
                    <div className="prepare-card">
                        <div className="prepare-card__body">
                            <QuestionInput
                                userQuestion={userQuestion}
                                setUserQuestion={setUserQuestion}
                                onFocus={onQuestionFocus}
                                onBlur={onQuestionBlur}
                                onLaunchCoach={onLaunchCoach}
                            />
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    const chosenDeck = DECK_OPTIONS.find(deck => deck.id === deckStyleId) || DECK_OPTIONS[0];
    const isDeckOpen = Boolean(prepareSectionsOpen?.deck);

    return (
        <section
            aria-labelledby={`${idBase}-details-heading`}
            className="hidden sm:block prepare-details animate-fade-in"
        >
            {/* The deck row explains itself on screen; the heading gives screen
                readers a landmark between the spreads and the draw. */}
            <h2 id={`${idBase}-details-heading`} className="sr-only">Before you draw</h2>
            <div className="relative z-10 space-y-3">
                {canChangeDeck && (
                    <div className={`prepare-card ${isDeckOpen ? 'prepare-card--open' : ''}`}>
                        <button
                            type="button"
                            onClick={() => togglePrepareSection('deck')}
                            className="prepare-card__toggle min-h-touch"
                            aria-expanded={isDeckOpen}
                            aria-controls={`${idBase}-deck`}
                        >
                            <span className="flex min-w-0 items-center gap-4">
                                <DeckThumbnail deckId={chosenDeck?.id} />
                                <span className="min-w-0">
                                    <span className="block font-serif text-accent text-base leading-tight">Deck</span>
                                    <span className="block text-xs text-muted">
                                        {chosenDeck ? `${chosenDeck.label} · ${chosenDeck.subtitle}` : 'Choose a deck'}
                                    </span>
                                </span>
                            </span>
                            {isDeckOpen
                                ? <CaretUp className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
                                : <CaretDown className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />}
                        </button>
                        <div id={`${idBase}-deck`} className="prepare-card__content" hidden={!isDeckOpen}>
                            {isDeckOpen && (
                                <DeckSelector
                                    selectedDeck={deckStyleId}
                                    onDeckChange={onDeckChange}
                                    variant="inline"
                                    hasDrawnCards={hasDrawnCards}
                                />
                            )}
                        </div>
                    </div>
                )}

                {children}

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
