import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';

export function CardModal({ card, isOpen, onClose, position, layoutId }) {
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

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
                className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface border border-primary/30 rounded-2xl shadow-2xl shadow-black/50 flex flex-col"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-accent/70 hover:text-main hover:bg-white/10 rounded-full transition-colors z-10"
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
                        className={`relative w-full max-w-[300px] mb-8 ${card.isReversed ? 'rotate-180' : ''}`}
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
