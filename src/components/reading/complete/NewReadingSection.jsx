import { ArrowCounterClockwise } from '@phosphor-icons/react';

export function NewReadingSection({
    isShuffling,
    shuffle
}) {
    return (
        <div className="text-center mt-6 sm:mt-8">
            <button
                onClick={shuffle}
                disabled={isShuffling}
                aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
                className="min-h-touch min-w-touch inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted hover:text-main disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
                <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                <span>{isShuffling ? 'Shuffling…' : 'New reading'}</span>
            </button>
        </div>
    );
}
