import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowsOut } from '@phosphor-icons/react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';

export function CardModal({ card, isOpen, onClose, position, layoutId }) {
    const modalRef = useRef(null);
    const previousBodyOverflow = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        const body = document.body;
        if (body) {
            previousBodyOverflow.current = body.style.overflow;
            body.style.overflow = 'hidden';
        }
        const activeElement = document.activeElement;
        if (activeElement && activeElement instanceof HTMLElement) {
            previousFocusRef.current = activeElement;
        }

        return () => {
            window.removeEventListener('keydown', handleEscape);
            if (body) {
                body.style.overflow = previousBodyOverflow.current ?? '';
            }
            previousBodyOverflow.current = null;
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

        const focusableSelectors = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        const handleKeyDown = event => {
            if (event.key !== 'Tab') return;
            const focusable = dialogNode.querySelectorAll(focusableSelectors);
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

    const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
    const originalCard = allCards.find(item => item.name === card.name) || card;
    const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
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
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-3 text-accent/70 hover:text-main hover:bg-white/10 rounded-full transition-colors z-10 touch-manipulation"
                    aria-label="Close modal"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    <h3 className="text-accent font-serif text-lg sm:text-xl mb-2">{position}</h3>
                    <h2 className="text-2xl sm:text-3xl font-serif text-main mb-6">
                        {card.name} {card.isReversed && <span className="text-primary/60 text-lg align-middle">(Reversed)</span>}
                    </h2>

                    <motion.div
                        layoutId={layoutId ? `card-image-${layoutId.split('-')[1]}` : undefined}
                        className={`relative w-full max-w-[300px] aspect-[3/5] mb-8 ${card.isReversed ? 'rotate-180' : ''}`}
                    >
                        <img
                            src={card.image}
                            alt={card.name}
                            className="w-full h-auto rounded-xl shadow-2xl border-2 border-primary/20"
                        />
                    </motion.div>

                    <div className="w-full space-y-6 text-left">
                        <div className="bg-surface-muted/50 rounded-xl p-5 border border-primary/10">
                            <h4 className="text-accent font-semibold mb-2 text-sm uppercase tracking-wider">Meaning</h4>
                            <p className="text-main/90 leading-relaxed text-lg">
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
