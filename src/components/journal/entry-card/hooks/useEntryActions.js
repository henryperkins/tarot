/**
 * useEntryActions.js
 * Custom hook for all entry action handlers (export, copy, share, delete).
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  exportJournalEntriesToCsv,
  exportJournalEntriesToMarkdown,
  copyJournalEntrySummary,
  copyJournalEntriesToClipboard
} from '../../../../lib/journalInsights';
import { findReusableShareLink } from '../../../../lib/journal/shareLinkSelection';

function shareUrlFor(token) {
  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
}

/** Network failures read as a connection problem, not as "Failed to fetch". */
function describeShareFailure(error, fallback) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Connect to the internet and try again.";
  }
  if (error instanceof TypeError) return "Couldn't reach Tableu. Check your connection and try again.";
  return error?.message || fallback;
}

async function writeToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard write failed for share link', error);
    }
  }
  // Older mobile browsers without the async clipboard.
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (error) {
    console.warn('Fallback copy failed for share link', error);
    return false;
  }
}

/**
 * Hook providing all action handlers for a journal entry
 */
export function useEntryActions(entry, {
  onDelete,
  onCreateShareLink,
  onDeleteShareLink,
  shareLinks = [],
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

  const reusableShareLink = useMemo(
    () => (isAuthenticated && onCreateShareLink ? findReusableShareLink(shareLinks, entry.id) : null),
    [isAuthenticated, onCreateShareLink, shareLinks, entry.id]
  );

  // Phones offer the share sheet; elsewhere the link goes to the clipboard.
  // Closing the sheet is a choice, so it ends quietly without copying.
  const deliverShareLink = useCallback(async (shareUrl, {
    copiedMessage = 'Share link copied.',
    sharedMessage = 'Share link shared.'
  } = {}) => {
    if (!shareUrl) return false;

    if (navigator?.share) {
      try {
        await navigator.share({ url: shareUrl, title: 'Tarot reading share link' });
        showStatus?.({ tone: 'success', message: sharedMessage });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return false;
        console.warn('Share sheet failed for share link', error);
      }
    }

    if (await writeToClipboard(shareUrl)) {
      showStatus?.({ tone: 'success', message: copiedMessage });
      return true;
    }

    showStatus?.({ tone: 'warning', message: `Couldn't copy the link automatically. Copy it here: ${shareUrl}` });
    return false;
  }, [showStatus]);

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
          if (typeof window === 'undefined') return false;
          // The journal can stay open past a link's expiry without new props.
          const liveShareLink = findReusableShareLink(shareLinks, entry.id);
          if (liveShareLink) {
            return deliverShareLink(shareUrlFor(liveShareLink.token), {
              copiedMessage: 'Copied your existing share link (single reading).',
              sharedMessage: 'Shared your existing link (single reading).'
            });
          }
          try {
            const data = await onCreateShareLink({ scope: 'entry', entryId: entry.id });
            if (!data?.url) {
              showStatus?.({ tone: 'error', message: 'The share link was created, but its address is missing. Find it in Export & Share.' });
              return false;
            }
            return deliverShareLink(`${window.location.origin}${data.url}`, {
              copiedMessage: 'Share link copied (single reading).',
              sharedMessage: 'Share link shared (single reading).'
            });
          } catch (error) {
            showStatus?.({ tone: 'error', message: describeShareFailure(error, 'Unable to create a share link right now.') });
            return false;
          }
        }

        // Signed out or local journal: copy a plain summary instead.
        const success = await copyJournalEntrySummary(entry);
        showStatus?.({
          tone: success ? 'success' : 'error',
          message: success
            ? 'Summary copied (single reading).'
            : 'Unable to copy this entry right now.'
        });
        return success;
      }),
    [deliverShareLink, entry, isAuthenticated, onCreateShareLink, shareLinks, runAction, showStatus]
  );

  const handleCopyShareLink = useCallback(
    (token) =>
      runAction('share-link-copy', async () => {
        if (!token) return false;
        if (typeof window === 'undefined') {
          showStatus?.({ tone: 'error', message: 'Copy is unavailable in this environment.' });
          return false;
        }
        return deliverShareLink(shareUrlFor(token), {
          copiedMessage: 'Share link copied.',
          sharedMessage: 'Share link shared.'
        });
      }),
    [deliverShareLink, runAction, showStatus]
  );

  const handleDeleteShareLink = useCallback(
    (token, title = 'Shared reading') =>
      runAction('share-link-delete', async () => {
        if (!token || !onDeleteShareLink) return false;
        try {
          await onDeleteShareLink(token);
          showStatus?.({ tone: 'success', message: `Deleted “${title}”. It no longer opens.` });
          return true;
        } catch (error) {
          showStatus?.({ tone: 'error', message: describeShareFailure(error, 'Unable to delete this share link right now.') });
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
        requestId: entry?.requestId || null,
        sourceUsage: entry?.sourceUsage || null,
        provider: entry?.provider || null
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
    reusableShareLink,
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
