import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { CARD_LOOKUP, FALLBACK_IMAGE, getCardImage, getCanonicalCard } from '../lib/cardLookup';
import { CardSymbolInsights } from './CardSymbolInsights';

const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
    'audio[controls]',
    'video[controls]'
].join(', ');

export function CardModal({ card, isOpen, onClose, position, layoutId }) {
    const modalRef = useRef(null);
    const previousBodyStylesRef = useRef(null);
    const previousFocusRef = useRef(null);
    const scrollYRef = useRef(0);
    const titleId = `card-modal-title-${layoutId || 'default'}`;
    const descId = `card-modal-desc-${layoutId || 'default'}`;

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);

        // Store current focus to restore later
        const activeElement = document.activeElement;
        if (activeElement && activeElement instanceof HTMLElement) {
            previousFocusRef.current = activeElement;
        }

        // Store scroll position and body styles
        scrollYRef.current = window.scrollY;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        previousBodyStylesRef.current = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            paddingRight: document.body.style.paddingRight
        };

        // Lock scroll without causing content shift
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollYRef.current}px`;
        document.body.style.width = '100%';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            window.removeEventListener('keydown', handleEscape);

            // Restore body styles
            if (previousBodyStylesRef.current) {
                const prev = previousBodyStylesRef.current;
                document.body.style.overflow = prev.overflow;
                document.body.style.position = prev.position;
                document.body.style.top = prev.top;
                document.body.style.width = prev.width;
                document.body.style.paddingRight = prev.paddingRight;
            }
            previousBodyStylesRef.current = null;

            // Restore scroll position
            window.scrollTo(0, scrollYRef.current);

            // Restore focus
            if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
                previousFocusRef.current.focus();
            }
            previousFocusRef.current = null;
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !modalRef.current) return undefined;

        const dialogNode = modalRef.current;
        if (typeof dialogNode.focus === 'function') {
            dialogNode.focus({ preventScroll: true });
        }

        const handleKeyDown = event => {
            if (event.key !== 'Tab') return;
            const focusable = dialogNode.querySelectorAll(FOCUSABLE_SELECTORS);
            if (!focusable.length) {
                event.preventDefault();
                dialogNode.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        };

        dialogNode.addEventListener('keydown', handleKeyDown);
        return () => {
            dialogNode.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (!isOpen || !card) return null;

    const originalCard = getCanonicalCard(card);
    const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;
    const cardImage = getCardImage(card);

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
                    className="absolute top-3 right-3 p-3 text-accent/70 hover:text-main hover:bg-white/10 rounded-full transition-colors z-10 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{
                        // Ensure close button respects safe area
                        top: 'max(0.75rem, env(safe-area-inset-top))',
                        right: 'max(0.75rem, env(safe-area-inset-right))'
                    }}
                    aria-label="Close modal"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    <h3 className="text-accent font-serif text-lg sm:text-xl mb-2">{position}</h3>
                    <h2 id={titleId} className="text-2xl sm:text-3xl font-serif text-main mb-6">
                        {card.name} {card.isReversed && <span className="text-primary/60 text-lg align-middle">(Reversed)</span>}
                    </h2>

                    <motion.div
                        layoutId={layoutId ? `card-image-${layoutId.split('-')[1]}` : undefined}
                        className={`relative w-full max-w-[300px] aspect-[2/3] mb-8 ${card.isReversed ? 'rotate-180' : ''}`}
                    >
                        <img
                            src={cardImage}
                            alt={card.name}
                            className="w-full h-auto rounded-xl shadow-2xl border-2 border-primary/20"
                            loading="lazy"
                            onError={(event) => {
                                event.currentTarget.src = FALLBACK_IMAGE;
                            }}
                        />
                    </motion.div>

                    <div className="w-full space-y-6 text-left">
                        <div className="bg-surface-muted/50 rounded-xl p-5 border border-primary/10">
                            <h4 className="text-accent font-semibold mb-2 text-sm uppercase tracking-wider">Meaning</h4>
                            <p id={descId} className="text-main/90 leading-relaxed text-lg">
                                {meaning}
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <CardSymbolInsights card={card} position={position} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
