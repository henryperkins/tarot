/**
 * useJournalSharing - Manages share link CRUD operations
 */

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export function useJournalSharing(isAuthenticated, userId = null) {
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareOwner, setShareOwner] = useState({ isAuthenticated, userId });
  const ownerRef = useRef(userId);
  const loadVersionRef = useRef(0);
  useLayoutEffect(() => {
    ownerRef.current = isAuthenticated ? userId : null;
    return () => { ownerRef.current = null; };
  }, [isAuthenticated, userId]);

  if (shareOwner.isAuthenticated !== isAuthenticated || shareOwner.userId !== userId) {
    setShareOwner({ isAuthenticated, userId });
    setShareLinks([]);
    setShareError('');
    setShareLoading(false);
  }

  const fetchShareLinks = useCallback(async (signal) => {
    if (!isAuthenticated || ownerRef.current !== userId) return;
    const loadVersion = ++loadVersionRef.current;
    const isCurrent = () => !signal?.aborted && ownerRef.current === userId && loadVersionRef.current === loadVersion;
    setShareLoading(true);
    setShareError('');
    try {
      const links = [];
      let offset = 0;
      do {
        const response = await fetch(offset ? `/api/share?offset=${offset}` : '/api/share', { credentials: 'include', signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to load share links');
        }
        const payload = await response.json();
        if (!isCurrent()) return;
        links.push(...(Array.isArray(payload.shares) ? payload.shares : []));
        const next = payload.nextOffset;
        if (next == null) break;
        if (!Number.isSafeInteger(next) || next <= offset) throw new Error('Unable to load older share links. Try again.');
        offset = next;
      } while (offset > 0);
      setShareLinks(links);
    } catch (error) {
      if (!isCurrent() || error?.name === 'AbortError') return;
      setShareError(error.message || 'Unable to load share links');
    } finally {
      if (isCurrent()) setShareLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) fetchShareLinks(controller.signal);
    });
    return () => controller.abort();
  }, [isAuthenticated, userId, fetchShareLinks]);

  const createShareLink = useCallback(
    async ({ scope = 'journal', entryId, entryIds, title, limit, expiresInHours } = {}) => {
      if (!isAuthenticated) {
        throw new Error('Sign in to create share links');
      }
      const payload = { scope };
      const parsedLimit = Number.parseInt(limit, 10);
      const sanitizedLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(10, parsedLimit))
        : undefined;
      const parsedExpiry = Number.parseInt(expiresInHours, 10);
      const sanitizedExpiry = Number.isFinite(parsedExpiry) && parsedExpiry > 0
        ? Math.floor(parsedExpiry)
        : undefined;
      const normalizedEntryIds = Array.isArray(entryIds)
        ? entryIds
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
          .slice(0, 10)
        : [];

      if (scope === 'entry') {
        if (entryId) {
          payload.entryIds = [entryId];
        } else if (normalizedEntryIds.length === 1) {
          payload.entryIds = normalizedEntryIds;
        }
      } else if (normalizedEntryIds.length > 0) {
        payload.entryIds = normalizedEntryIds;
      } else if (sanitizedLimit) {
        payload.limit = sanitizedLimit;
      }
      if (title) {
        payload.title = title;
      }
      if (sanitizedExpiry) {
        payload.expiresInHours = sanitizedExpiry;
      }
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to create share link');
      }
      const data = await response.json();
      await fetchShareLinks();
      return data;
    },
    [isAuthenticated, fetchShareLinks]
  );

  const deleteShareLink = useCallback(
    async (shareToken) => {
      if (!isAuthenticated) return;
      const response = await fetch(`/api/share/${shareToken}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to delete share link');
      }
      await fetchShareLinks();
    },
    [isAuthenticated, fetchShareLinks]
  );

  // A blank title restores the link's default name.
  const renameShareLink = useCallback(
    async (shareToken, title) => {
      if (!isAuthenticated || !shareToken) return null;
      const response = await fetch(`/api/share/${encodeURIComponent(shareToken)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: typeof title === 'string' ? title : null })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to rename share link');
      }
      const data = await response.json();
      setShareLinks((previous) => previous.map((link) => (
        link.token === shareToken ? { ...link, title: data.title, hasCustomTitle: Boolean(data.hasCustomTitle) } : link
      )));
      return data;
    },
    [isAuthenticated]
  );

  return {
    shareLinks,
    shareLoading,
    shareError,
    fetchShareLinks,
    createShareLink,
    deleteShareLink,
    renameShareLink
  };
}

export default useJournalSharing;
