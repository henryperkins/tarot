import { ArrowCounterClockwise } from '@phosphor-icons/react';

export function NewReadingSection({
    isShuffling,
    shuffle
}) {
    return (
        <div className="hidden sm:block text-center mt-6 sm:mt-8">
            <button
                onClick={shuffle}
                disabled={isShuffling}
                aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            >
                <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                <span className="hidden xs:inline">{isShuffling ? 'Shuffling the cards...' : 'Draw new reading'}</span>
                <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'Reset spread'}</span>
            </button>
        </div>
    );
}
