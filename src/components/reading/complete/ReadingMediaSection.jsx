import { MediaGallery } from '../../MediaGallery';

export function ReadingMediaSection({
    personalReading,
    canUseMediaGallery,
    mediaItems,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia
}) {
    if (!personalReading || !canUseMediaGallery) return null;

    return (
        <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-8">
            <MediaGallery
                items={mediaItems}
                loading={mediaLoading}
                error={mediaError}
                onRefresh={onRefreshMedia}
                onDelete={onDeleteMedia}
            />
        </div>
    );
}
