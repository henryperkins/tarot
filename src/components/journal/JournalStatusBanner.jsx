import { useState, useEffect } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { OUTLINE_BUTTON_CLASS } from '../../styles/buttonClasses';
import { FOCUS_RING_DEFAULT } from '../../styles/focusClasses';

export function JournalStatusBanner({ isAuthenticated, canUseCloudJournal, lastSyncAt, lastLocalSaveAt,
  syncSource, journalError, loading, localStoragePresence, localEntryCount = 0,
  onMigrate, migrating, onImportLegacy, importingLegacy, onReload, onShowAuthModal }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  const cloud = isAuthenticated && canUseCloudJournal;
  const cached = cloud && syncSource === 'cache';
  const local = !cloud || syncSource === 'local';
  const timestamp = cloud ? lastSyncAt : lastLocalSaveAt;
  const elapsed = timestamp ? Math.max(0, Math.round((now - timestamp) / 60000)) : null;
  const timeLabel = elapsed === null ? '' : elapsed < 1 ? ' · just now' : elapsed < 60 ? ` · ${elapsed} min ago` : ` · ${Math.round(elapsed / 60)}h ago`;
  const label = journalError ? 'Journal needs attention' : loading && cloud ? 'Syncing cloud journal'
    : cached ? 'Saved copy · this device' : local ? 'Local only · this browser' : `Synced · cloud${timeLabel}`;
  const hasLegacy = Boolean(localStoragePresence?.hasLegacy);
  const canMigrate = cloud && (hasLegacy || localStoragePresence?.hasScoped);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-muted-high" role="status">{label}{local && !journalError ? timeLabel : ''}</p>
        {local && (
          <details className="relative text-xs text-muted">
            <summary className={`min-h-touch content-center cursor-pointer rounded-lg px-2 ${FOCUS_RING_DEFAULT}`}>Storage and sync</summary>
            <div className="mt-1 mb-3 max-w-xl space-y-2 rounded-xl border border-(--border-warm-light) bg-(--bg-surface) p-4 text-sm text-muted-high">
              <p>Your readings are saved in this browser. Browser storage can be cleared or run out of space.</p>
              {!journalError && <p>Local entries: {localEntryCount}.</p>}
              <p>Cloud sync and backup are available with Tableu Plus or Pro.</p>
              <button type="button" onClick={() => isAuthenticated ? navigate('/pricing') : onShowAuthModal()}
                className={`${OUTLINE_BUTTON_CLASS} text-sm`}>{isAuthenticated ? 'View cloud journal plans' : 'Sign in'}</button>
            </div>
          </details>
        )}
      </div>
      {cached && <div className="rounded-xl border border-warning/30 bg-(--bg-surface) p-3 text-sm text-muted-high">
        <p>Cloud journal could not load. Showing a saved copy from this device.</p>
        <button type="button" onClick={onReload} disabled={loading} className={`${OUTLINE_BUTTON_CLASS} mt-2`}>Reload journal</button>
      </div>}
      {journalError && <p role="alert" className="rounded-xl border border-error/30 bg-(--bg-surface) p-3 text-sm text-error">{journalError}</p>}
      {isAuthenticated && !cloud && hasLegacy && (
        <div className="rounded-xl border border-(--border-warm-light) bg-(--bg-surface) p-4 text-sm text-muted-high space-y-2">
          <p>Readings saved before sign-in are kept separate on shared browsers. Import them only if they belong to you.</p>
          <button type="button" onClick={onImportLegacy} disabled={importingLegacy} className={OUTLINE_BUTTON_CLASS}>
            <UploadSimple className="h-4 w-4" aria-hidden="true" />{importingLegacy ? 'Importing…' : 'Import local entries into this account'}
          </button>
        </div>
      )}
      {canMigrate && <div className="rounded-xl border border-(--border-warm-light) bg-(--bg-surface) p-4 text-sm text-muted-high space-y-2">
        <p>Add this browser&rsquo;s readings to your cloud journal. Local copies stay until every entry is added or already exists.</p>
        <button type="button" onClick={onMigrate} disabled={migrating} className={OUTLINE_BUTTON_CLASS}>
          <UploadSimple className="h-4 w-4" aria-hidden="true" />{migrating ? 'Adding local entries…' : 'Add local entries to cloud journal'}
        </button>
      </div>}
    </div>
  );
}

export default JournalStatusBanner;
