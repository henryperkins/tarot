import { useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { FALLBACK_IMAGE, getCardImage, getCanonicalCard } from '../lib/cardLookup';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { useModalA11y } from '../hooks/useModalA11y';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import { useSmallScreen } from '../hooks/useSmallScreen';

function toMillis(ts) {
    if (!ts) return null;
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    // Heuristic: seconds are ~1e9, millis are ~1e12.
    return ts > 1e12 ? ts : ts * 1000;
}

function formatDate(ts) {
    const ms = toMillis(ts);
    if (!ms) return null;
    try {
        return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return null;
    }
}

export function CardModal({
    card,
    isOpen,
    onClose,
    position,
    layoutId,
    // Optional: collection metadata
    stats,
    relatedEntries,
    onOpenEntry,
    onViewAllInJournal,
    // Navigation props
    onNavigate,
    canNavigatePrev,
    canNavigateNext,
    navigationLabel,
}) {
    const modalRef = useRef(null);
    const titleId = `card-modal-title-${layoutId || 'default'}`;
    const descId = `card-modal-desc-${layoutId || 'default'}`;

    // Shared modal accessibility: scroll lock, escape key, focus trap, focus restoration
    useModalA11y(isOpen, {
        onClose,
        containerRef: modalRef,
        scrollLockStrategy: 'fixed', // Prevents iOS bounce
    });

    // Android back button dismisses modal on mobile
    const isSmallScreen = useSmallScreen();
    useAndroidBackGuard(isOpen, {
        onBack: onClose,
        enabled: isSmallScreen,
        guardId: 'cardModal'
    });

    // Swipe gesture tracking for navigation
    const touchStartX = useRef(null);
    const touchStartTime = useRef(null);

    const handleTouchStart = useCallback((event) => {
        touchStartX.current = event.touches[0].clientX;
        touchStartTime.current = Date.now();
    }, []);

    const handleTouchEnd = useCallback((event) => {
        if (touchStartX.current === null || touchStartTime.current === null) return;

        const touchEndX = event.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX.current;
        const elapsed = Date.now() - touchStartTime.current;

        // Reset refs
        touchStartX.current = null;
        touchStartTime.current = null;

        // Check if swipe is valid: >50px horizontal, <300ms
        if (Math.abs(deltaX) > 50 && elapsed < 300) {
            if (deltaX > 0 && canNavigatePrev) {
                onNavigate?.('prev');
            } else if (deltaX < 0 && canNavigateNext) {
                onNavigate?.('next');
            }
        }
    }, [canNavigatePrev, canNavigateNext, onNavigate]);

    // Shared-element animation is only wired for the in-reading flow where:
    // - Card.jsx uses `layoutId={\`card-image-${index}\`}`
    // - ReadingDisplay opens the modal with `layoutId={\`card-${index}\`}`
    // For other callers (e.g. Card Collection gallery), avoid guessing IDs.
    const imageLayoutId = useMemo(() => {
        if (!layoutId || typeof layoutId !== 'string') return undefined;
        const match = layoutId.match(/^card-(\d+)$/);
        if (!match) return undefined;
        return `card-image-${match[1]}`;
    }, [layoutId]);

    const history = useMemo(() => {
        const totalCount = typeof stats?.total_count === 'number' ? stats.total_count : null;
        const firstSeen = formatDate(stats?.first_seen);
        const lastSeen = formatDate(stats?.last_seen);
        const entries = Array.isArray(relatedEntries) ? relatedEntries : [];
        const entryCount = entries.length;
        return { totalCount, firstSeen, lastSeen, entries, entryCount };
    }, [stats, relatedEntries]);

    if (!isOpen || !card) return null;

    const originalCard = getCanonicalCard(card);
    const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;
    const cardImage = getCardImage(card);
    const hasNavigation = canNavigatePrev || canNavigateNext;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-main/90 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            <motion.div
                layoutId={layoutId}
                ref={modalRef}
                className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-surface border border-primary/30 rounded-2xl shadow-2xl shadow-black/50 flex flex-col"
                tabIndex={-1}
                role="document"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{
                    // Safe area padding for notch/Dynamic Island
                    paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right))',
                    paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left))'
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-3 text-accent/70 hover:text-main hover:bg-surface-muted/50 rounded-full transition-colors z-10 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{
                        // Ensure close button respects safe area
                        top: 'max(0.75rem, env(safe-area-inset-top))',
                        right: 'max(0.75rem, env(safe-area-inset-right))'
                    }}
                    aria-label="Close modal"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Navigation bar */}
                {hasNavigation && (
                    <div className="flex items-center justify-between px-6 sm:px-8 pt-2 pb-2 border-b border-primary/10">
                        <button
                            type="button"
                            onClick={() => onNavigate?.('prev')}
                            disabled={!canNavigatePrev}
                            className="flex items-center gap-1.5 text-sm text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-[44px] px-2 -ml-2"
                            aria-label="Previous card"
                        >
                            <CaretLeft className="w-5 h-5" />
                            <span>Prev</span>
                        </button>
                        <span className="text-xs text-muted font-medium">{navigationLabel}</span>
                        <button
                            type="button"
                            onClick={() => onNavigate?.('next')}
                            disabled={!canNavigateNext}
                            className="flex items-center gap-1.5 text-sm text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-[44px] px-2 -mr-2"
                            aria-label="Next card"
                        >
                            <span>Next</span>
                            <CaretRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    <h3 className="text-accent font-serif text-lg sm:text-xl mb-2">{position}</h3>
                    <h2 id={titleId} className="text-2xl sm:text-3xl font-serif text-main mb-6">
                        {card.name} {card.isReversed && <span className="text-primary/60 text-lg align-middle">(Reversed)</span>}
                    </h2>

                    <motion.div
                        layoutId={imageLayoutId}
                        className={`relative w-full max-w-[300px] aspect-[2/3] mb-8 rounded-xl shadow-2xl border-2 border-primary/20 overflow-hidden ${card.isReversed ? 'rotate-180' : ''}`}
                    >
                        <img
                            src={cardImage}
                            alt={card.name}
                            className="block w-full h-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                                event.currentTarget.src = FALLBACK_IMAGE;
                            }}
                        />
                        {/* Interactive symbol overlay - tap symbols to learn meanings */}
                        <InteractiveCardOverlay card={card} />
                    </motion.div>

                    <div className="w-full space-y-6 text-left">
                        <div className="bg-surface-muted/50 rounded-xl p-5 border border-primary/10">
                            <h4 className="text-accent font-semibold mb-2 text-sm uppercase tracking-wider">Meaning</h4>
                            <p id={descId} className="text-main/90 leading-relaxed text-lg">
                                {meaning}
                            </p>
                        </div>

                        {(history.totalCount || history.firstSeen || history.lastSeen || history.entryCount > 0 || onViewAllInJournal) && (
                            <div className="bg-surface-muted/30 rounded-xl p-5 border border-primary/10">
                                <h4 className="text-accent font-semibold mb-3 text-sm uppercase tracking-wider">Your history with this card</h4>

                                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-lg border border-primary/10 bg-surface-muted/40 p-3">
                                        <dt className="text-[11px] uppercase tracking-wider text-muted">Times drawn</dt>
                                        <dd className="mt-1 text-lg font-semibold text-main">
                                            {history.totalCount ?? '—'}
                                        </dd>
                                    </div>
                                    <div className="rounded-lg border border-primary/10 bg-surface-muted/40 p-3">
                                        <dt className="text-[11px] uppercase tracking-wider text-muted">First seen</dt>
                                        <dd className="mt-1 text-sm font-semibold text-main">
                                            {history.firstSeen ?? '—'}
                                        </dd>
                                    </div>
                                    <div className="rounded-lg border border-primary/10 bg-surface-muted/40 p-3">
                                        <dt className="text-[11px] uppercase tracking-wider text-muted">Last seen</dt>
                                        <dd className="mt-1 text-sm font-semibold text-main">
                                            {history.lastSeen ?? '—'}
                                        </dd>
                                    </div>
                                </dl>

                                {(history.entryCount > 0 || onViewAllInJournal) && (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm text-main/80">
                                                Appears in <span className="font-semibold text-main">{history.entryCount}</span> journal entr{history.entryCount === 1 ? 'y' : 'ies'}
                                            </p>
                                            {onViewAllInJournal && (
                                                <button
                                                    type="button"
                                                    onClick={onViewAllInJournal}
                                                    className="text-xs font-semibold text-accent hover:text-main underline underline-offset-4"
                                                >
                                                    View in Journal
                                                </button>
                                            )}
                                        </div>

                                        {history.entryCount > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {history.entries.slice(0, 6).map((entry) => {
                                                    const label = formatDate(entry?.ts) || 'Journal entry';
                                                    const question = (entry?.question || '').trim();
                                                    const spread = (entry?.spread || '').trim();
                                                    const subtitle = [spread, question].filter(Boolean).join(' · ');
                                                    return (
                                                        <button
                                                            key={entry?.id || `${entry?.ts || 'entry'}-${subtitle}`}
                                                            type="button"
                                                            onClick={() => onOpenEntry?.(entry)}
                                                            className="w-full rounded-lg border border-primary/10 bg-surface-muted/40 p-3 text-left hover:bg-surface-muted/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            <div className="flex items-baseline justify-between gap-3">
                                                                <p className="text-sm font-semibold text-main">{label}</p>
                                                                <p className="text-[11px] text-muted">Open</p>
                                                            </div>
                                                            {subtitle && (
                                                                <p className="mt-1 text-xs text-main/75 line-clamp-2">
                                                                    {subtitle}
                                                                </p>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-center">
                            <CardSymbolInsights card={card} position={position} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
