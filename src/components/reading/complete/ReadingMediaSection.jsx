import { useCallback, useState } from 'react';
import { ImagesSquare } from '@phosphor-icons/react';
import { ReadingMediaModal } from '../ReadingMediaModal';
import { OUTLINE_BUTTON_CLASS } from '../../../styles/buttonClasses';

export function ReadingMediaSection({
    personalReading,
    isPersonalReadingError,
    canUseMediaGallery,
    mediaItems,
    mediaTotal,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia
}) {
    const [isOpen, setIsOpen] = useState(false);
    const handleClose = useCallback(() => setIsOpen(false), []);

    if (!personalReading || isPersonalReadingError || !canUseMediaGallery) return null;

    const savedCount = Number.isFinite(Number(mediaTotal)) ? Number(mediaTotal) : 0;
    const countLabel = mediaLoading && savedCount === 0
        ? 'Checking for saved visuals…'
        : `${savedCount} saved ${savedCount === 1 ? 'item' : 'items'}`;

    return (
        <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-8">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-main">
                            <ImagesSquare className="w-4 h-4 text-secondary" aria-hidden="true" />
                            Recent media
                        </h2>
                        {mediaError ? (
                            <p className="text-xs text-error">{mediaError}</p>
                        ) : (
                            <p className="text-xs text-muted">
                                Saved visuals from this reading flow &middot; {countLabel}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        className={`${OUTLINE_BUTTON_CLASS} shrink-0`}
                    >
                        <ImagesSquare className="w-4 h-4" aria-hidden="true" />
                        <span>View recent media</span>
                    </button>
                </div>
            </div>

            <ReadingMediaModal
                isOpen={isOpen}
                onClose={handleClose}
                items={mediaItems}
                totalItems={mediaTotal}
                loading={mediaLoading}
                error={mediaError}
                onRefresh={onRefreshMedia}
                onDelete={onDeleteMedia}
            />
        </div>
    );
}
