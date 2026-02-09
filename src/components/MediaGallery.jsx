import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { animate, set, stagger } from '../lib/motionAdapter';
import {
  ArrowsClockwise,
  ArrowsOut,
  BookmarkSimple,
  DownloadSimple,
  ShareNetwork,
  Trash
} from '@phosphor-icons/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useModalA11y } from '../hooks/useModalA11y';

const FAVORITES_STORAGE_KEY = 'tarot_media_gallery_favorites';

function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function readFavoriteIds() {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.trim().length > 0));
  } catch {
    return new Set();
  }
}

function writeFavoriteIds(idsSet) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(idsSet)));
  } catch {
    // no-op if localStorage is unavailable/quota-limited
  }
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

export function MediaGallery({
  items = [],
  loading = false,
  error = null,
  onRefresh,
  onDelete,
  className = ''
}) {
  const prefersReducedMotion = useReducedMotion();
  const galleryRef = useRef(null);
  const lightboxRef = useRef(null);
  const lightboxCloseRef = useRef(null);
  const lightboxTitleId = useId();
  const [lightboxItem, setLightboxItem] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => readFavoriteIds());
  const [shareNotice, setShareNotice] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useModalA11y(!!lightboxItem, {
    onClose: () => setLightboxItem(null),
    containerRef: lightboxRef,
    initialFocusRef: lightboxCloseRef
  });

  const sortedItems = useMemo(() => {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
      const aTime = Number(a?.createdAt || 0);
      const bTime = Number(b?.createdAt || 0);
      return bTime - aTime;
    });
  }, [items]);

  useLayoutEffect(() => {
    if (prefersReducedMotion) return undefined;
    const root = galleryRef.current;
    if (!root) return undefined;
    const nodes = root.querySelectorAll('[data-media-card="true"]');
    if (!nodes.length) return undefined;

    set(nodes, { opacity: 0, translateY: 18, scale: 0.985 });
    const entrance = animate(nodes, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.985, 1],
      duration: 420,
      delay: stagger(55),
      ease: 'outQuad'
    });

    return () => entrance?.pause?.();
  }, [prefersReducedMotion, sortedItems.length]);

  useEffect(() => {
    writeFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    if (!shareNotice) return undefined;
    const timer = window.setTimeout(() => setShareNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  const toggleFavorite = useCallback((id) => {
    if (!id) return;
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!onDelete || !id) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch {
      setShareNotice('Unable to remove media right now.');
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  const handleShare = useCallback(async (item) => {
    if (!item) return;
    let shareUrl = '';
    try {
      shareUrl = new URL(item.contentUrl, window.location.origin).toString();
    } catch {
      setShareNotice('Invalid media URL.');
      return;
    }
    const title = buildMediaTitle(item);

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url: shareUrl
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareNotice('Media link copied to clipboard.');
        return;
      }
      setShareNotice('Sharing is unavailable on this device.');
    } catch {
      setShareNotice('Unable to share right now.');
    }
  }, []);

  const hasItems = sortedItems.length > 0;

  return (
    <section
      ref={galleryRef}
      className={`rounded-2xl border border-secondary/35 bg-surface/90 backdrop-blur-md p-4 sm:p-6 ${className}`}
      aria-label="Generated media gallery"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg sm:text-xl font-serif text-accent">Media Gallery</h3>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Your generated story art and cinematic reveals.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-secondary/35 bg-surface/70 text-xs sm:text-sm text-muted hover:text-main hover:border-secondary/55 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowsClockwise className={`w-4 h-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {shareNotice && (
        <p className="mt-3 text-xs text-accent" role="status" aria-live="polite">
          {shareNotice}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs sm:text-sm text-error">
          {error}
        </p>
      )}

      {!loading && !hasItems && !error && (
        <p className="mt-4 rounded-lg border border-secondary/25 bg-surface/60 px-4 py-4 text-sm text-muted text-center">
          No generated media saved yet.
        </p>
      )}

      {hasItems && (
        <div className="mt-4 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {sortedItems.map((item) => {
            const isFavorite = favoriteIds.has(item.id);
            const title = buildMediaTitle(item);
            const createdLabel = formatTimestamp(item.createdAt);
            const isVideo = item.mediaType === 'video';
            const isDeleting = deletingId === item.id;

            return (
              <article
                key={item.id}
                data-media-card="true"
                className="rounded-xl border border-secondary/25 bg-main/40 overflow-hidden shadow-lg shadow-main/40"
              >
                <button
                  type="button"
                  onClick={() => setLightboxItem(item)}
                  className="w-full relative aspect-[16/10] bg-main/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  aria-label={`Open ${title}`}
                >
                  {isVideo ? (
                    <video
                      src={item.contentUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.contentUrl}
                      alt={title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-main/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                    <span className="text-2xs px-2 py-1 rounded-full bg-surface/80 text-main border border-secondary/35">
                      {isVideo ? 'Video' : 'Image'}
                    </span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface/75 border border-secondary/35 text-main">
                      <ArrowsOut className="w-4 h-4" />
                    </span>
                  </div>
                </button>

                <div className="p-3">
                  <p className="text-sm font-semibold text-main truncate">{title}</p>
                  <p className="text-2xs text-muted mt-1 truncate">
                    {createdLabel}
                    {item.styleId ? ` • ${item.styleId}` : ''}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <a
                      href={item.downloadUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-2xs border border-secondary/30 bg-surface/60 text-main hover:bg-surface transition"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-2xs border border-secondary/30 bg-surface/60 text-main hover:bg-surface transition"
                    >
                      <ShareNetwork className="w-3.5 h-3.5" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-2xs border transition ${
                        isFavorite
                          ? 'border-accent/55 bg-accent/20 text-accent'
                          : 'border-secondary/30 bg-surface/60 text-main hover:bg-surface'
                      }`}
                    >
                      <BookmarkSimple className="w-3.5 h-3.5" weight={isFavorite ? 'fill' : 'regular'} />
                      Save
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-2xs border border-error/40 bg-error/10 text-error hover:bg-error/20 transition disabled:opacity-50"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        {isDeleting ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {lightboxItem && (
        <div
          className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-sm px-4 py-6 sm:p-8"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="w-full h-full max-w-6xl mx-auto flex items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              ref={lightboxRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={lightboxTitleId}
              tabIndex={-1}
              className="relative w-full max-h-full rounded-2xl border border-secondary/35 bg-main/70 p-3 sm:p-4 overflow-hidden"
            >
              <h2 id={lightboxTitleId} className="sr-only">Media lightbox</h2>
              <button
                ref={lightboxCloseRef}
                type="button"
                onClick={() => setLightboxItem(null)}
                className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full border border-secondary/35 bg-surface/80 text-xs text-main hover:bg-surface transition"
              >
                Close
              </button>
              <div className="max-h-[80vh] overflow-auto rounded-xl bg-black/55">
                {lightboxItem.mediaType === 'video' ? (
                  <video
                    src={lightboxItem.contentUrl}
                    controls
                    autoPlay
                    className="w-full h-auto max-h-[78vh]"
                  />
                ) : (
                  <img
                    src={lightboxItem.contentUrl}
                    alt={buildMediaTitle(lightboxItem)}
                    className="w-full h-auto max-h-[78vh] object-contain"
                  />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <a
                  href={lightboxItem.downloadUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-secondary/35 bg-surface/80 text-main hover:bg-surface transition"
                >
                  <DownloadSimple className="w-4 h-4" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleShare(lightboxItem)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-secondary/35 bg-surface/80 text-main hover:bg-surface transition"
                >
                  <ShareNetwork className="w-4 h-4" />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(lightboxItem.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition ${
                    favoriteIds.has(lightboxItem.id)
                      ? 'border-accent/55 bg-accent/20 text-accent'
                      : 'border-secondary/35 bg-surface/80 text-main hover:bg-surface'
                  }`}
                >
                  <BookmarkSimple className="w-4 h-4" weight={favoriteIds.has(lightboxItem.id) ? 'fill' : 'regular'} />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MediaGallery;
