import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsOut,
  DownloadSimple,
  ImageSquare,
  PlayCircle,
  Trash
} from '@phosphor-icons/react';
import { READING_MEDIA_GALLERY_VISIBLE_LIMIT } from '../lib/mediaGalleryConstants.js';

function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function buildMediaTitle(item) {
  if (item?.title) return item.title;
  if (item?.source === 'card-reveal' && item?.cardName) {
    return `${item.cardName} reveal`;
  }
  if (item?.source === 'story-art') {
    return 'Story illustration';
  }
  return item?.mediaType === 'video' ? 'Generated video' : 'Generated image';
}

function getMediaUrl(item) {
  return item?.contentUrl || item?.downloadUrl || '';
}

export function MediaGallery({
  items = [],
  totalItems = items.length,
  loading = false,
  error = null,
  onRefresh,
  onDelete,
  className = ''
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [localError, setLocalError] = useState('');

  const sortedItems = useMemo(() => {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
      const aTime = Number(a?.createdAt || 0);
      const bTime = Number(b?.createdAt || 0);
      return bTime - aTime;
    });
  }, [items]);

  const visibleItems = useMemo(() => (
    sortedItems.slice(0, READING_MEDIA_GALLERY_VISIBLE_LIMIT)
  ), [sortedItems]);

  const totalItemCount = Number.isFinite(Number(totalItems))
    ? Math.max(visibleItems.length, Number(totalItems))
    : sortedItems.length;
  const hiddenCount = Math.max(0, totalItemCount - visibleItems.length);
  const hasItems = visibleItems.length > 0;

  useEffect(() => {
    if (!error) {
      setLocalError('');
    }
  }, [error, items]);

  const handleRefresh = useCallback(() => {
    setLocalError('');
    onRefresh?.();
  }, [onRefresh]);

  const handleDelete = useCallback(async (id) => {
    if (!onDelete || !id) return;
    setDeletingId(id);
    setLocalError('');
    try {
      await onDelete(id);
    } catch {
      setLocalError('Unable to remove media right now.');
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  const statusMessage = error || localError;

  return (
    <section
      className={`rounded-xl border border-secondary/25 bg-surface/80 p-4 sm:p-5 ${className}`}
      aria-label="Recent generated media"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-serif text-accent">Recent media</h3>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Saved visuals from this reading flow.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-secondary/30 bg-main/35 px-3 py-2 text-xs text-muted transition hover:border-secondary/50 hover:text-main disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            <ArrowsClockwise className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            <span>{loading ? 'Refreshing' : 'Refresh'}</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <p className="mt-3 rounded-lg border border-error/35 bg-error/10 px-3 py-2 text-xs sm:text-sm text-error">
          {statusMessage}
        </p>
      )}

      {!hasItems && !statusMessage && (
        <p className="mt-4 rounded-lg border border-secondary/20 bg-main/25 px-4 py-3 text-sm text-muted">
          {loading ? 'Loading saved media...' : 'No generated media saved yet.'}
        </p>
      )}

      {hasItems && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const title = buildMediaTitle(item);
            const createdLabel = formatTimestamp(item.createdAt);
            const isVideo = item.mediaType === 'video';
            const isDeleting = deletingId === item.id;
            const mediaUrl = getMediaUrl(item);
            const downloadUrl = item.downloadUrl || mediaUrl;

            return (
              <article
                key={item.id}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-secondary/20 bg-main/30 p-2.5"
              >
                <a
                  href={mediaUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-main/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] ${mediaUrl ? '' : 'pointer-events-none opacity-60'}`}
                  aria-label={mediaUrl ? `Open ${title}` : `${title} unavailable`}
                >
                  {mediaUrl ? (
                    isVideo ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <ImageSquare className="h-6 w-6 text-muted" aria-hidden="true" />
                  )}
                  {isVideo && (
                    <span className="absolute inset-0 flex items-center justify-center bg-main/25 text-main">
                      <PlayCircle className="h-6 w-6" aria-hidden="true" />
                    </span>
                  )}
                </a>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-main">{title}</p>
                  <p className="mt-0.5 truncate text-2xs text-muted">
                    {[createdLabel, item.styleId].filter(Boolean).join(' • ') || 'Generated media'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {mediaUrl && (
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-touch items-center gap-1 rounded-md border border-secondary/25 bg-surface/60 px-2.5 py-1.5 text-2xs text-main transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
                      >
                        <ArrowsOut className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                      </a>
                    )}
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex min-h-touch items-center gap-1 rounded-md border border-secondary/25 bg-surface/60 px-2.5 py-1.5 text-2xs text-main transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
                      >
                        <DownloadSimple className="h-3.5 w-3.5" aria-hidden="true" />
                        Download
                      </a>
                    )}
                    {onDelete && item.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="inline-flex min-h-touch items-center justify-center rounded-md border border-error/35 bg-error/10 px-2.5 py-1.5 text-2xs text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
                        aria-label={`Remove ${title}`}
                      >
                        <Trash className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">{isDeleting ? 'Removing' : 'Remove'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-xs text-muted">
          Showing the latest {visibleItems.length}; {hiddenCount} older {hiddenCount === 1 ? 'item stays' : 'items stay'} saved.
        </p>
      )}
    </section>
  );
}

export default MediaGallery;
