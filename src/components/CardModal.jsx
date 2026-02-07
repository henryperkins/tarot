import { useCallback, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { animate, set } from 'animejs';
import { X, CaretLeft, CaretRight, CaretDown, Clock, Sparkle } from '@phosphor-icons/react';
import { FALLBACK_IMAGE, getCardImage, getCanonicalCard } from '../lib/cardLookup';
import { CardSymbolInsights } from './CardSymbolInsights';
import AnimatedReveal from './AnimatedReveal';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { useModalA11y } from '../hooks/useModalA11y';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';

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

/**
 * Collapsible section component for compact modal layout
 */
function CollapsibleSection({ title, icon: Icon, badge, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [isRendered, setIsRendered] = useState(defaultOpen);
    const prefersReducedMotion = useReducedMotion();
    const contentRef = useRef(null);
    const contentId = `collapsible-${title.replace(/\s+/g, '-').toLowerCase()}`;

    useLayoutEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- sync render state for animation coordination
            setIsRendered(true);
        }
    }, [isOpen]);

    useLayoutEffect(() => {
        const node = contentRef.current;
        if (!node || !isRendered) return undefined;

        if (prefersReducedMotion) {
            node.style.height = isOpen ? 'auto' : '0px';
            node.style.opacity = isOpen ? '1' : '0';
            if (!isOpen) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- sync cleanup when animations disabled
                setIsRendered(false);
            }
            return undefined;
        }

        if (isOpen) {
            const targetHeight = node.scrollHeight;
            set(node, { height: 0, opacity: 0 });
            const enterAnim = animate(node, {
                height: [0, targetHeight],
                opacity: [0, 1],
                duration: 200,
                ease: 'outQuad'
            });
            enterAnim
                .then(() => {
                    node.style.height = 'auto';
                })
                .catch(() => {
                    node.style.height = 'auto';
                });
            return () => enterAnim?.pause?.();
        }

        const currentHeight = node.scrollHeight;
        const exitAnim = animate(node, {
            height: [currentHeight, 0],
            opacity: [1, 0],
            duration: 180,
            ease: 'inQuad'
        });
        exitAnim
            .then(() => setIsRendered(false))
            .catch(() => setIsRendered(false));

        return () => exitAnim?.pause?.();
    }, [isOpen, isRendered, prefersReducedMotion]);

    return (
        <div className="border border-primary/10 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors text-left min-h-touch"
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                <span className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {title}
                    {badge && <span className="text-muted font-normal normal-case">({badge})</span>}
                </span>
                <CaretDown
                    className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    style={{ transitionDuration: prefersReducedMotion ? '0ms' : '200ms' }}
                />
            </button>
            {isRendered && (
                <div
                    ref={contentRef}
                    id={contentId}
                    className="overflow-hidden"
                    aria-hidden={!isOpen}
                >
                    <div className="px-3 py-2.5 border-t border-primary/10">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

export function CardModal({
    card,
    isOpen,
    onClose,
    position,
    question,
    userTier = 'free',
    enableCinematic = false,
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
    const overlayRef = useRef(null);
    const closingRef = useRef(false);
    const titleId = `card-modal-title-${layoutId || 'default'}`;
    const descId = `card-modal-desc-${layoutId || 'default'}`;
    const prefersReducedMotion = useReducedMotion();
    const handleClose = useCallback(() => {
        if (closingRef.current) return;
        if (prefersReducedMotion) {
            onClose?.();
            return;
        }
        const modalNode = modalRef.current;
        const overlayNode = overlayRef.current;
        if (!modalNode || !overlayNode) {
            onClose?.();
            return;
        }
        closingRef.current = true;
        const overlayAnim = animate(overlayNode, {
            opacity: [1, 0],
            duration: 180,
            ease: 'inQuad'
        });
        const modalAnim = animate(modalNode, {
            opacity: [1, 0],
            translateY: [0, 8],
            scale: [1, 0.98],
            duration: 200,
            ease: 'inQuad'
        });
        Promise.allSettled([overlayAnim, modalAnim]).then(() => {
            onClose?.();
        });
    }, [onClose, prefersReducedMotion]);

    // Shared modal accessibility: scroll lock, escape key, focus trap, focus restoration
    useModalA11y(isOpen, {
        onClose: handleClose,
        containerRef: modalRef,
        scrollLockStrategy: 'fixed', // Prevents iOS bounce
    });

    // Android back button dismisses modal on mobile
    const isSmallScreen = useSmallScreen();
    useAndroidBackGuard(isOpen, {
        onBack: handleClose,
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

    const hasHistory = history.totalCount || history.firstSeen || history.lastSeen || history.entryCount > 0 || onViewAllInJournal;

    useLayoutEffect(() => {
        if (!isOpen || !card) return undefined;
        const modalNode = modalRef.current;
        const overlayNode = overlayRef.current;
        if (!modalNode || !overlayNode) return undefined;

        if (prefersReducedMotion) {
            set(overlayNode, { opacity: 1 });
            set(modalNode, { opacity: 1, translateY: 0, scale: 1 });
            return undefined;
        }

        set(overlayNode, { opacity: 0 });
        set(modalNode, { opacity: 0, translateY: 8, scale: 0.98 });
        const overlayAnim = animate(overlayNode, {
            opacity: [0, 1],
            duration: 200,
            ease: 'outQuad'
        });
        const modalAnim = animate(modalNode, {
            opacity: [0, 1],
            translateY: [8, 0],
            scale: [0.98, 1],
            duration: 240,
            ease: 'outQuad'
        });

        return () => {
            overlayAnim?.pause?.();
            modalAnim?.pause?.();
        };
    }, [card, isOpen, prefersReducedMotion]);

    if (!isOpen || !card) return null;

    const originalCard = getCanonicalCard(card);
    const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;
    const cardImage = getCardImage(card);
    const hasNavigation = canNavigatePrev || canNavigateNext;
    const resolvedQuestion = (question || '').trim() || 'General guidance';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 px-safe pt-safe pb-safe"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
        >
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-main/85 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            />

            <div
                data-layout-id={layoutId || undefined}
                ref={modalRef}
                className="relative w-full max-w-md max-h-[80dvh] overflow-y-auto bg-surface border border-primary/30 rounded-xl shadow-2xl shadow-black/50 flex flex-col pt-[max(0.75rem,var(--safe-pad-top))] pr-[max(0.75rem,var(--safe-pad-right))] pb-[max(0.75rem,var(--safe-pad-bottom))] pl-[max(0.75rem,var(--safe-pad-left))]"
                tabIndex={-1}
                role="document"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Compact header with integrated navigation and close */}
                <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-primary/10">
                    {hasNavigation ? (
                        <>
                            <button
                                type="button"
                                onClick={() => onNavigate?.('prev')}
                                disabled={!canNavigatePrev}
                                className="flex items-center gap-1 text-xs text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-touch min-w-touch px-1"
                                aria-label="Previous card"
                            >
                                <CaretLeft className="w-4 h-4" />
                                <span className="hidden xs:inline">Prev</span>
                            </button>
                            <span className="text-2xs text-muted font-medium">{navigationLabel}</span>
                            <button
                                type="button"
                                onClick={() => onNavigate?.('next')}
                                disabled={!canNavigateNext}
                                className="flex items-center gap-1 text-xs text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-touch min-w-touch px-1"
                                aria-label="Next card"
                            >
                                <span className="hidden xs:inline">Next</span>
                                <CaretRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <div className="flex-1" />
                    )}
                    <button
                        onClick={handleClose}
                        className="min-h-touch min-w-touch inline-flex items-center justify-center p-1.5 text-accent/70 hover:text-main hover:bg-surface-muted/50 rounded-full transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ml-auto"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Compact horizontal layout: image left, content right */}
                <div className="p-3 flex gap-3">
                    {/* Card image - smaller and on the left */}
                    <div
                        data-layout-id={imageLayoutId || undefined}
                        className={`relative flex-shrink-0 w-20 sm:w-28 aspect-[2/3] rounded-lg shadow-lg border border-primary/20 overflow-hidden ${card.isReversed ? 'rotate-180' : ''}`}
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
                        {/* Interactive symbol overlay - only on larger screens where it's usable */}
                        {!isSmallScreen && <InteractiveCardOverlay card={card} />}
                    </div>

                    {/* Card info - right side */}
                    <div className="flex-1 min-w-0">
                        <p className="text-2xs uppercase tracking-widest text-muted">{position}</p>
                        <h2 id={titleId} className="text-base sm:text-lg font-serif text-main leading-tight">
                            {card.name}
                            {card.isReversed && (
                                <span className="ml-1.5 text-xs text-primary/70 font-normal">(Rev)</span>
                            )}
                        </h2>
                        <p id={descId} className="mt-2 text-sm text-main/90 leading-relaxed">
                            {meaning}
                        </p>
                    </div>
                </div>

                {/* Collapsible sections */}
                <div className="px-3 pb-3 space-y-2">
                    {/* History section - collapsed by default */}
                    {hasHistory && (
                        <CollapsibleSection
                            title="History"
                            icon={Clock}
                            badge={history.totalCount ? `${history.totalCount}x` : null}
                        >
                            <div className="space-y-2.5">
                                {/* Compact stats row */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    {history.totalCount != null && (
                                        <span className="text-muted">
                                            Drawn <span className="font-semibold text-main">{history.totalCount}</span> time{history.totalCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {history.firstSeen && (
                                        <span className="text-muted">
                                            First: <span className="text-main">{history.firstSeen}</span>
                                        </span>
                                    )}
                                    {history.lastSeen && (
                                        <span className="text-muted">
                                            Last: <span className="text-main">{history.lastSeen}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Journal entries */}
                                {(history.entryCount > 0 || onViewAllInJournal) && (
                                    <div className="pt-1 border-t border-primary/10">
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <p className="text-xs text-muted">
                                                In <span className="font-semibold text-main">{history.entryCount}</span> journal entr{history.entryCount === 1 ? 'y' : 'ies'}
                                            </p>
                                            {onViewAllInJournal && (
                                                <button
                                                    type="button"
                                                    onClick={onViewAllInJournal}
                                                    className="text-2xs font-semibold text-accent hover:text-main underline underline-offset-2"
                                                >
                                                    View all
                                                </button>
                                            )}
                                        </div>
                                        {history.entryCount > 0 && (
                                            <div className="space-y-1">
                                                {history.entries.slice(0, 3).map((entry) => {
                                                    const label = formatDate(entry?.ts) || 'Entry';
                                                    const spread = (entry?.spread || '').trim();
                                                    return (
                                                        <button
                                                            key={entry?.id || `${entry?.ts || 'entry'}-${spread}`}
                                                            type="button"
                                                            onClick={() => onOpenEntry?.(entry)}
                                                            className="w-full flex items-center justify-between gap-2 rounded border border-primary/10 bg-surface-muted/30 px-2 py-1.5 text-left hover:bg-surface-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            <span className="text-xs text-main truncate">{label}</span>
                                                            {spread && <span className="text-2xs text-muted truncate">{spread}</span>}
                                                        </button>
                                                    );
                                                })}
                                                {history.entryCount > 3 && (
                                                    <p className="text-2xs text-muted text-center">+{history.entryCount - 3} more</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CollapsibleSection>
                    )}

                    {/* Symbol insights - collapsed by default */}
                    <CollapsibleSection title="Symbols" icon={Sparkle}>
                        <div className="flex justify-center">
                            <CardSymbolInsights card={card} position={position} />
                        </div>
                    </CollapsibleSection>

                    {enableCinematic && (
                        <CollapsibleSection title="Cinematic reveal" icon={Sparkle} defaultOpen={false}>
                            <AnimatedReveal
                                card={card}
                                position={position}
                                question={resolvedQuestion}
                                userTier={userTier}
                                className="mt-1"
                            />
                        </CollapsibleSection>
                    )}
                </div>
            </div>
        </div>
    );
}
