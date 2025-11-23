import { motion } from 'framer-motion';

export function DeckPile({ cardsRemaining, onDraw, isShuffling, nextLabel }) {
    if (cardsRemaining <= 0) return null;

    return (
        <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-fade-in relative z-20">
            <motion.button
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95, y: 0 }}
                onClick={onDraw}
                disabled={isShuffling}
                className="group relative w-[clamp(9rem,45vw,10rem)] h-[clamp(13.5rem,67.5vw,15rem)] sm:w-32 sm:h-48 md:w-40 md:h-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
                aria-label={nextLabel ? `Draw card for ${nextLabel}` : "Draw next card"}
            >
                {/* Stack effect layers */}
                <div className="absolute inset-0 bg-surface-muted rounded-2xl border border-primary/40 transform translate-x-2 translate-y-2 rotate-3 opacity-60" />
                <div className="absolute inset-0 bg-surface-muted rounded-2xl border border-primary/40 transform -translate-x-1 translate-y-1 -rotate-2 opacity-80" />

                {/* Top Card */}
                <div className="absolute inset-0 shadow-2xl">
                    <div className="tarot-card-shell w-full h-full">
                        <div className="tarot-card-back">
                            <div className="tarot-card-back-symbol">
                                <div className="tarot-card-back-glyph" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute -bottom-10 left-0 right-0 text-center">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-accent/90 text-xs font-semibold tracking-widest uppercase backdrop-blur-sm group-hover:bg-primary/20 transition-colors">
                        {nextLabel ? `Draw: ${nextLabel}` : 'Tap to Draw'}
                    </span>
                    <p className="text-primary/40 text-xs mt-2 font-medium">
                        {cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''} remaining
                    </p>
                </div>
            </motion.button>
        </div>
    );
}
