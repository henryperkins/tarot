import { MediaGallery } from '../../MediaGallery';

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
    if (!personalReading || isPersonalReadingError || !canUseMediaGallery) return null;

    return (
        <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-8">
            <MediaGallery
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
