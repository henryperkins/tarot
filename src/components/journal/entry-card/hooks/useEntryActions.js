/**
 * useEntryActions.js
 * Custom hook for all entry action handlers (export, copy, share, delete).
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  exportJournalEntriesToCsv,
  exportJournalEntriesToMarkdown,
  copyJournalEntrySummary,
  copyJournalEntriesToClipboard
} from '../../../../lib/journalInsights';

/**
 * Hook providing all action handlers for a journal entry
 */
export function useEntryActions(entry, {
  onDelete,
  onCreateShareLink,
  onDeleteShareLink,
  isAuthenticated,
  showStatus,
  clearStatus,
  canAskFollowUp,
  followUpLimit,
  followUps = []
}) {
  const [pendingAction, setPendingAction] = useState(null);
  const navigate = useNavigate();

  const runAction = useCallback(async (actionKey, task) => {
    setPendingAction(actionKey);
    clearStatus?.();
    try {
      return await task();
    } finally {
      setPendingAction(null);
    }
  }, [clearStatus]);

  const handleExportCsv = useCallback(
    () =>
      runAction('export', async () => {
        const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
        const success = exportJournalEntriesToCsv([entry], filename);
        showStatus?.({
          tone: success ? 'success' : 'error',
          message: success ? `Saved ${filename}` : 'Unable to download this entry right now.'
        });
        return success;
      }),
    [entry, runAction, showStatus]
  );

  const handleExportMarkdown = useCallback(
    () =>
      runAction('export-md', async () => {
        const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.md`;
        const success = exportJournalEntriesToMarkdown([entry], filename);
        showStatus?.({
          tone: success ? 'success' : 'error',
          message: success ? `Saved ${filename}` : 'Unable to download this entry right now.'
        });
        return success;
      }),
    [entry, runAction, showStatus]
  );

  const handleCopyCsv = useCallback(
    () =>
      runAction('copy', async () => {
        const success = await copyJournalEntriesToClipboard([entry]);
        showStatus?.({
          tone: success ? 'success' : 'error',
          message: success
            ? 'Entry CSV copied to your clipboard.'
            : 'Copying was blocked by the browser.'
        });
        return success;
      }),
    [entry, runAction, showStatus]
  );

  const handleShare = useCallback(
    () =>
      runAction('share', async () => {
        if (isAuthenticated && onCreateShareLink) {
          try {
            const data = await onCreateShareLink({ scope: 'entry', entryId: entry.id });
            const shareUrl =
              data?.url && typeof window !== 'undefined'
                ? `${window.location.origin}${data.url}`
                : null;

            if (shareUrl) {
              if (navigator?.clipboard?.writeText) {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showStatus?.({ tone: 'success', message: 'Share link copied (single reading).' });
                  return true;
                } catch (error) {
                  console.warn('Clipboard write failed for entry share', error);
                }
              }
              showStatus?.({ tone: 'info', message: 'Share link ready — copy from your address bar.' });
              return true;
            }
            showStatus?.({ tone: 'error', message: 'Share link created, but the URL is missing.' });
            return false;
          } catch (error) {
            showStatus?.({
              tone: 'error',
              message: error.message || 'Unable to create a share link right now.'
            });
            return false;
          }
        }

        // Fallback: copy summary for non-authenticated users
        const success = await copyJournalEntrySummary(entry);
        showStatus?.({
          tone: success ? 'success' : 'error',
          message: success
            ? 'Summary copied (single reading).'
            : 'Unable to copy this entry right now.'
        });
        return success;
      }),
    [entry, isAuthenticated, onCreateShareLink, runAction, showStatus]
  );

  const handleCopyShareLink = useCallback(
    (token) =>
      runAction('share-link-copy', async () => {
        if (!token) return false;
        if (typeof window === 'undefined') {
          showStatus?.({ tone: 'error', message: 'Copy is unavailable in this environment.' });
          return false;
        }
        const url = `${window.location.origin}/share/${token}`;
        if (navigator?.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(url);
            showStatus?.({ tone: 'success', message: 'Share link copied.' });
            return true;
          } catch (error) {
            console.warn('Clipboard write failed for share link', error);
            showStatus?.({ tone: 'warning', message: 'Copy blocked—open the link and copy manually.' });
            return false;
          }
        }
        showStatus?.({ tone: 'error', message: 'Copy not supported—open the link to share.' });
        return false;
      }),
    [runAction, showStatus]
  );

  const handleDeleteShareLink = useCallback(
    (token) =>
      runAction('share-link-delete', async () => {
        if (!token || !onDeleteShareLink) return false;
        try {
          await onDeleteShareLink(token);
          showStatus?.({ tone: 'success', message: 'Share link removed.' });
          return true;
        } catch (error) {
          showStatus?.({ tone: 'error', message: error?.message || 'Unable to delete share link.' });
          return false;
        }
      }),
    [onDeleteShareLink, runAction, showStatus]
  );

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(entry.id);
    }
  }, [entry.id, onDelete]);

  const handleOpenFollowUp = useCallback(
    (intent = 'continue') => {
      if (intent === 'ask') {
        if (!isAuthenticated) {
          showStatus?.({ tone: 'warning', message: 'Sign in to ask follow-up questions.' });
          return;
        }
        if (!canAskFollowUp) {
          showStatus?.({
            tone: 'warning',
            message: `You have used all ${followUpLimit} follow-up question${followUpLimit === 1 ? '' : 's'} for this reading.`
          });
          return;
        }
      }

      const followUpPayload = {
        id: entry?.id || null,
        question: entry?.question || '',
        cards: Array.isArray(entry?.cards) ? entry.cards : [],
        personalReading: entry?.personalReading || '',
        themes: entry?.themes || null,
        spreadKey: entry?.spreadKey || null,
        spreadName: entry?.spread || entry?.spreadName || null,
        context: entry?.context || null,
        deckId: entry?.deckId || null,
        followUps: followUps.length > 0 ? followUps : [],
        sessionSeed: entry?.sessionSeed || null,
        requestId: entry?.requestId || null
      };

      navigate('/', {
        state: {
          followUpEntry: followUpPayload,
          openFollowUp: true,
          followUpIntent: intent
        }
      });
    },
    [canAskFollowUp, entry, followUpLimit, followUps, isAuthenticated, navigate, showStatus]
  );

  return {
    pendingAction,
    handleExportCsv,
    handleExportMarkdown,
    handleCopyCsv,
    handleShare,
    handleCopyShareLink,
    handleDeleteShareLink,
    handleDelete,
    handleOpenFollowUp
  };
}
