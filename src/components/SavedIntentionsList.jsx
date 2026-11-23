import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  loadCoachHistory,
  deleteCoachHistoryItem,
  COACH_STORAGE_SYNC_EVENT,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ITEMS
} from '../lib/coachStorage';
import { CoachSuggestion } from './CoachSuggestion';
import { ConfirmModal } from './ConfirmModal';
import { JournalBookmarkIcon } from './JournalIcons';
import { useAuth } from '../contexts/AuthContext';

function getIntentionLabel(item) {
  return item?.question
    ?? item?.customFocus
    ?? item?.spreadName
    ?? 'this intention';
}

function IntentionsHeading({ titleId }) {
  return (
    <div className="mb-4 min-w-0">
      <div className="flex items-center gap-2">
        <JournalBookmarkIcon className="h-5 w-5 shrink-0 text-accent/80" aria-hidden="true" />
        <h2 id={titleId} className="text-xl font-serif text-accent">Saved Intentions</h2>
      </div>
      <p className="mt-2 text-xs text-muted-high">
        On this device · {MAX_HISTORY_ITEMS} most recent
      </p>
    </div>
  );
}

export function SavedIntentionsList({
  titleId,
  variant = 'section',
  emptyState = 'hide',
  onConfirmOpenChange
} = {}) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [prevUserId, setPrevUserId] = useState(userId);
  const [intentions, setIntentions] = useState(() => loadCoachHistory(undefined, userId));
  const [pendingDelete, setPendingDelete] = useState(null);
  const navigate = useNavigate();

  // Reset state when userId changes (React's render-time update pattern)
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setIntentions(loadCoachHistory(undefined, userId));
    setPendingDelete(null);
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const isRelevantKey = (key) => {
      if (!key) return true;
      if (typeof key !== 'string') return false;
      return key.startsWith(HISTORY_STORAGE_KEY);
    };
    const refreshHistory = () => setIntentions(loadCoachHistory(undefined, userId));

    const handleStorage = (event) => {
      if (isRelevantKey(event.key)) {
        refreshHistory();
      }
    };

    const handleCoachSync = (event) => {
      const detailKey = event?.detail?.key;
      if (isRelevantKey(detailKey)) {
        refreshHistory();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    };
  }, [userId]);

  // Restore the parent's accessibility and trap before the nested dialog's
  // deferred focus restoration. A passive effect can run after that timer.
  useLayoutEffect(() => {
    if (onConfirmOpenChange) {
      onConfirmOpenChange(Boolean(pendingDelete));
    }
  }, [pendingDelete, onConfirmOpenChange]);

  const handleDelete = (id) => {
    const result = deleteCoachHistoryItem(id, userId);
    if (result.success) {
      setIntentions(result.history);
    }
  };

  const handleUseIntention = (question) => {
    navigate('/', { state: { initialQuestion: question } });
  };

  const containerClassName = variant === 'modal'
    ? 'min-w-0 animate-fade-in'
    : 'mb-8 min-w-0 animate-fade-in';

  const confirmLabel = pendingDelete ? getIntentionLabel(pendingDelete) : 'this intention';
  const confirmModal = (
    <ConfirmModal
      isOpen={Boolean(pendingDelete)}
      onClose={() => setPendingDelete(null)}
      onConfirm={() => handleDelete(pendingDelete?.id)}
      title="Delete saved intention?"
      message={`Remove this saved intention: ${confirmLabel}. This cannot be undone.`}
      confirmText="Delete"
      cancelText="Keep it"
      variant="danger"
      renderInPortal={variant === 'modal'}
    />
  );

  if (intentions.length === 0) {
    if (emptyState !== 'message') {
      return null; // Don't show section if empty
    }

    return (
      <>
        <div className={containerClassName}>
          <IntentionsHeading titleId={titleId} />
          <p className="text-sm text-muted">
            No saved intentions yet.
          </p>
          <Link
            to="/"
            className="mt-3 inline-flex min-h-touch items-center text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:text-main focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Save one from your question
          </Link>
        </div>
        {confirmModal}
      </>
    );
  }

  return (
    <>
      <div className={containerClassName}>
        <IntentionsHeading titleId={titleId} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intentions.map((item) => (
            <CoachSuggestion
              key={item.id}
              recommendation={item}
              variant="note"
              showTitle={false}
              onApply={() => handleUseIntention(item.question)}
              onDismiss={() => setPendingDelete(item)}
            />
          ))}
        </div>
      </div>
      {confirmModal}
    </>
  );
}
