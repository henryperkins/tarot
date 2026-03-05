import { useCallback, useEffect, useRef, useState } from 'react';

export function useReadingMediaGallery({
    canUseMediaGallery
}) {
    const [mediaItems, setMediaItems] = useState([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaError, setMediaError] = useState(null);
    const mediaRequestTokenRef = useRef(0);

    const loadMediaGallery = useCallback(async () => {
        if (!canUseMediaGallery) {
            setMediaItems([]);
            setMediaLoading(false);
            setMediaError(null);
            return;
        }

        const requestToken = mediaRequestTokenRef.current + 1;
        mediaRequestTokenRef.current = requestToken;
        setMediaLoading(true);
        setMediaError(null);

        try {
            const response = await fetch('/api/media?limit=36', {
                credentials: 'include'
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (requestToken !== mediaRequestTokenRef.current) return;

            if (!response.ok) {
                setMediaError(data?.error || 'Unable to load media gallery.');
                setMediaLoading(false);
                return;
            }

            const nextItems = Array.isArray(data?.media) ? data.media : [];
            setMediaItems(nextItems);
            setMediaError(null);
            setMediaLoading(false);
        } catch (_err) {
            if (requestToken !== mediaRequestTokenRef.current) return;
            setMediaLoading(false);
            setMediaError('Unable to load media gallery.');
        }
    }, [canUseMediaGallery]);

    const persistMediaRecord = useCallback(async ({
        mediaType,
        source,
        storageKey,
        mimeType,
        title,
        question,
        cardName,
        positionLabel,
        styleId,
        formatId,
        bytes,
        metadata
    }) => {
        if (!canUseMediaGallery || !storageKey || !mediaType || !source || !mimeType) return;

        try {
            const response = await fetch('/api/media', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mediaType,
                    source,
                    storageKey,
                    mimeType,
                    title,
                    question,
                    cardName,
                    positionLabel,
                    styleId,
                    formatId,
                    bytes,
                    metadata
                })
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok) {
                setMediaError(data?.error || 'Unable to save generated media.');
                return;
            }

            const next = data?.media;
            if (next?.id) {
                setMediaItems((prev) => {
                    const withoutCurrent = prev.filter((item) => item.id !== next.id);
                    return [next, ...withoutCurrent];
                });
            }
            setMediaError(null);
        } catch (_err) {
            setMediaError('Unable to save generated media.');
        }
    }, [canUseMediaGallery]);

    const deleteMediaById = useCallback(async (id) => {
        if (!canUseMediaGallery || !id) return;

        const response = await fetch(`/api/media?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            throw new Error(data?.error || 'Unable to remove media.');
        }

        setMediaItems((prev) => prev.filter((item) => item.id !== id));
    }, [canUseMediaGallery]);

    useEffect(() => {
        if (!canUseMediaGallery) {
            mediaRequestTokenRef.current += 1;
            return;
        }

        const timerId = window.setTimeout(() => {
            void loadMediaGallery();
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [canUseMediaGallery, loadMediaGallery]);

    return {
        mediaItems: canUseMediaGallery ? mediaItems : [],
        mediaLoading: canUseMediaGallery ? mediaLoading : false,
        mediaError: canUseMediaGallery ? mediaError : null,
        loadMediaGallery,
        persistMediaRecord,
        deleteMediaById
    };
}
