import { useCallback, useState } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { ConfirmModal } from '../../ConfirmModal';

export function NewReadingSection({
    isShuffling,
    shuffle,
    requiresConfirmation = false
}) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const closeConfirmation = useCallback(() => setIsConfirmOpen(false), []);
    const handleNewReading = () => {
        if (requiresConfirmation) setIsConfirmOpen(true);
        else shuffle();
    };

    return (
        <div className="text-center mt-6 sm:mt-8">
            <button
                type="button"
                onClick={handleNewReading}
                disabled={isShuffling}
                aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
                className="min-h-touch min-w-touch inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted hover:text-main disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary"
            >
                <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                <span>{isShuffling ? 'Shuffling…' : 'New reading'}</span>
            </button>
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={closeConfirmation}
                onConfirm={shuffle}
                title="Start a new reading?"
                message="This reading hasn't been saved to your journal. Starting a new reading will clear it. Keep this reading to save it first."
                confirmText="Start new reading"
                cancelText="Keep reading"
                renderInPortal
            />
        </div>
    );
}
