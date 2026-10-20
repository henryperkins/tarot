import { useCallback, useMemo, useRef, useState, useLayoutEffect, useId, lazy, Suspense } from 'react';
import { animate } from '../lib/motionAdapter';
import { X, CaretLeft, CaretRight, CaretDown, Clock, Sparkle } from '@phosphor-icons/react';
import { getCardImage, getCanonicalCard } from '../lib/cardLookup';
import { CardSymbolDetails } from './CardSymbolInsights';
import { CardInspectionArtwork } from './CardInspectionArtwork';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { useModalA11y } from '../hooks/useModalA11y';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import '../styles/card-inspector.css';

const AnimatedReveal = lazy(() => import('./AnimatedReveal'));

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
    const contentId = useId();

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
            Object.assign(node.style, { height: '0px', opacity: '0' });
            let sectionActive = true;
            const enterAnim = animate(node, {
                // Keep Motion's final value responsive too: a numeric target
                // would be committed again after our completion callback.
                height: [0, 'auto'],
                opacity: [0, 1],
                duration: 200,
                ease: 'outQuad'
            });
            enterAnim
                .then(() => {
                    if (!sectionActive) return;
                    Object.assign(node.style, { height: 'auto', opacity: '1' });
                    enterAnim.cancel?.();
                })
                .catch(() => {
                    if (sectionActive) Object.assign(node.style, { height: 'auto', opacity: '1' });
                });
            return () => { sectionActive = false; enterAnim.cancel?.(); };
        }

        const currentHeight = node.scrollHeight;
        const exitAnim = animate(node, {
            height: [currentHeight, 0],
            opacity: [1, 0],
            duration: 180,
            ease: 'inQuad'
        });
        let sectionActive = true;
        exitAnim
            .then(() => { if (sectionActive) setIsRendered(false); })
            .catch(() => { if (sectionActive) setIsRendered(false); });

        return () => { sectionActive = false; exitAnim?.cancel?.(); };
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
    artworkMode = 'compact',
    inspectionContext = null,
    returnFocusRef,
    getFallbackFocus,
}) {
    const dialogRef = useRef(null);
    const modalRef = useRef(null);
    const bodyRef = useRef(null);
    const overlayRef = useRef(null);
    const closingRef = useRef(false);
    const titleId = `card-modal-title-${layoutId || 'default'}`;
    const descId = `card-modal-desc-${layoutId || 'default'}`;
    const prefersReducedMotion = useReducedMotion();
    const isModalActiveRef = useRef(true);
    const hasCard = Boolean(card);
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
            if (isModalActiveRef.current) onClose?.();
        });
    }, [onClose, prefersReducedMotion]);

    // Shared modal accessibility: scroll lock, escape key, focus trap, focus
    // restoration, and Back on phones (closes the card instead of the page)
    useModalA11y(isOpen, {
        onClose: handleClose,
        containerRef: dialogRef,
        initialFocusRef: modalRef,
        isolateBackground: true,
        scrollLockStrategy: 'fixed', // Prevents iOS bounce
        returnFocusRef,
        getFallbackFocus,
        fallbackFocusPreventScroll: true,
        // Native Back has already consumed the history entry. Release the
        // dialog in this commit so an exit animation cannot reinsert it.
        onBack: onClose,
        closeOnBack: artworkMode === 'full' ? true : undefined,
        backGuardId: 'cardModal',
    });

    const isSmallScreen = useSmallScreen();

    // Swipe gesture tracking for navigation
    const gestureRef = useRef(null);

    const handleTouchStart = useCallback((event) => {
        gestureRef.current = null;
        if (event.touches.length !== 1 || !event.currentTarget.contains(event.target)
            || event.target.closest('button, a, input, textarea, select, [role="button"]')
            || window.getSelection()?.toString()) return;
        const touch = event.touches[0];
        // Leave the browser's edge gestures alone.
        if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
        gestureRef.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: performance.now() };
    }, []);

    const handleTouchMove = useCallback((event) => {
        const start = gestureRef.current;
        const touch = Array.from(event.touches).find(candidate => candidate.identifier === start?.id);
        if (!start || event.touches.length !== 1 || !touch) {
            gestureRef.current = null;
            return;
        }
        const dx = Math.abs(touch.clientX - start.x);
        const dy = Math.abs(touch.clientY - start.y);
        if (dy > 10 && dy > dx) gestureRef.current = null;
    }, []);

    const handleTouchEnd = useCallback((event) => {
        const start = gestureRef.current;
        gestureRef.current = null;
        if (!start || event.touches.length || window.getSelection()?.toString()) return;
        const touch = Array.from(event.changedTouches).find(candidate => candidate.identifier === start.id);
        if (!touch) return;
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5
            && performance.now() - start.at < 300) {
            if (deltaX > 0 && canNavigatePrev) {
                onNavigate?.('prev');
            } else if (deltaX < 0 && canNavigateNext) {
                onNavigate?.('next');
            }
        }
    }, [canNavigatePrev, canNavigateNext, onNavigate]);

    const cancelTouch = useCallback(() => { gestureRef.current = null; }, []);
    const cardImage = getCardImage(card);
    const cardIdentity = `${layoutId || ''}:${cardImage}:${Boolean(card?.isReversed)}`;
    useLayoutEffect(() => {
        gestureRef.current = null;
        bodyRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [cardIdentity]);

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
        isModalActiveRef.current = true;
        closingRef.current = false;
        if (!isOpen || !hasCard) return undefined;
        const modalNode = modalRef.current;
        const overlayNode = overlayRef.current;
        if (!modalNode || !overlayNode) return undefined;

        if (prefersReducedMotion) {
            overlayNode.style.opacity = '1';
            Object.assign(modalNode.style, { opacity: '1', transform: 'none' });
            return () => { isModalActiveRef.current = false; };
        }

        // Inline defaults remain visible after animation cancellation. Opening
        // belongs to this dialog instance, not to each selected card.
        overlayNode.style.opacity = '1';
        modalNode.style.opacity = '1';
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
            isModalActiveRef.current = false;
            overlayAnim?.cancel?.();
            modalAnim?.cancel?.();
        };
    }, [hasCard, isOpen, prefersReducedMotion]);

    if (!isOpen || !card) return null;

    const originalCard = getCanonicalCard(card);
    const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;
    const cardFrame = card.frame || (cardImage.includes('/marseille/') ? '16 / 31' : cardImage.includes('/thoth/') ? '3 / 5' : '100 / 172');
    const hasNavigation = canNavigatePrev || canNavigateNext;
    const resolvedQuestion = (question || '').trim() || 'General guidance';

    return (
        <div
            ref={dialogRef}
            className="card-inspector-layer fixed inset-0 z-toast"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onTouchStartCapture={event => {
                // A second finger outside the artwork still cancels its swipe.
                if (event.touches.length > 1) cancelTouch();
            }}
            onTouchCancelCapture={cancelTouch}
        >
            <div
                ref={overlayRef}
                data-card-modal-backdrop
                data-modal-backdrop
                className="absolute inset-0 bg-main/85 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            />

            <div
                data-layout-id={layoutId || undefined}
                ref={modalRef}
                className={`card-inspector${artworkMode === 'full' ? ' card-inspector--full' : ''}`}
                tabIndex={-1}
                role="document"
            >
                <header className="card-inspector__header">
                    <div className="card-inspector__identity" aria-live="polite" aria-atomic="true">
                        <h2 id={titleId}>
                            {card.name}{' '}
                            <span className="card-inspector__orientation">{card.isReversed ? 'Reversed' : 'Upright'}</span>
                        </h2>
                        <p>{position}</p>
                    </div>
                    <button type="button" onClick={handleClose} className="card-inspector__return"
                        aria-label={artworkMode === 'full' ? 'Back to reading' : 'Close modal'}>
                        <span>{artworkMode === 'full' ? 'Back to reading' : 'Close'}</span>
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </header>

                <div ref={bodyRef} className="card-inspector__body">
                    {inspectionContext?.phrase ? <blockquote className="card-inspector__phrase">“{inspectionContext.phrase}”</blockquote> : null}
                    <p id={descId} className="card-inspector__meaning">{meaning}</p>
                    <CardInspectionArtwork
                        key={cardIdentity}
                        card={card}
                        frame={cardFrame}
                        full={artworkMode === 'full'}
                        data-layout-id={imageLayoutId || undefined}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={cancelTouch}
                    >
                        {!isSmallScreen && artworkMode !== 'full' && <InteractiveCardOverlay card={card} />}
                    </CardInspectionArtwork>

                {/* Collapsible sections */}
                <div className="card-inspector__sections space-y-3">
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
                                                            className="w-full flex items-center justify-between gap-2 rounded border border-primary/10 bg-surface-muted/30 px-2 py-1.5 text-left hover:bg-surface-muted/50 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
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
                    <CollapsibleSection key={cardIdentity} title="Symbols" icon={Sparkle}>
                        <CardSymbolDetails card={card} />
                    </CollapsibleSection>

                    {enableCinematic && (
                        <CollapsibleSection title="Cinematic reveal" icon={Sparkle} defaultOpen={false}>
                            <Suspense fallback={<div className="rounded-lg border border-primary/20 bg-surface-muted/40 p-3 text-xs text-muted">Loading cinematic module...</div>}>
                                <AnimatedReveal
                                    card={card}
                                    position={position}
                                    question={resolvedQuestion}
                                    userTier={userTier}
                                    className="mt-1"
                                />
                            </Suspense>
                        </CollapsibleSection>
                    )}
                </div>
                </div>
                {(hasNavigation || navigationLabel) && <nav className="card-inspector__navigation" aria-label="Card navigation">
                    <button type="button" onClick={() => onNavigate?.('prev')} disabled={!canNavigatePrev} aria-label="Previous card">
                        <CaretLeft className="w-5 h-5" aria-hidden="true" /><span>Previous</span>
                    </button>
                    <span className="card-inspector__counter">Card {navigationLabel}{artworkMode === 'full' ? ' · Your spread' : ''}</span>
                    <button type="button" onClick={() => onNavigate?.('next')} disabled={!canNavigateNext} aria-label="Next card">
                        <span>Next</span><CaretRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                </nav>}
            </div>
        </div>
    );
}
