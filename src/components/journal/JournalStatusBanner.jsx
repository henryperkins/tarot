/**
 * JournalStatusBanner - Auth/sync status display for the journal
 * Shows different content for authenticated vs non-authenticated users
 */

import { UploadSimple } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { OUTLINE_BUTTON_CLASS } from '../../styles/buttonClasses';
import { AmberStarfield } from '../AmberStarfield';
import { AccountNudge } from '../nudges';
import { JournalRefreshIcon } from '../JournalIcons';

export function JournalStatusBanner({
  isAuthenticated,
  canUseCloudJournal,
  lastSyncAt,
  syncSource,
  journalError,
  loading,
  localStoragePresence,
  localEntryCount = 0,
  onMigrate,
  migrating,
  onImportLegacy,
  importingLegacy,
  onReload,
  shouldShowAccountNudge,
  onDismissNudge,
  onShowAuthModal,
  cardClass
}) {
  const navigate = useNavigate();

  return (
    <>
      {isAuthenticated ? (
        <div className={`mb-6 ${cardClass} p-5`}>
          <AmberStarfield />
          <div className="relative z-10 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="journal-prose text-amber-100/85">
                ✓ Signed in - {canUseCloudJournal ? 'Your journal is synced across devices' : 'Your journal is stored on this device'}
              </p>
              {/* Last sync timestamp for cloud users - show full date and time */}
              {canUseCloudJournal && lastSyncAt && syncSource === 'api' && (
                <span className="text-[11px] text-amber-100/50">
                  Synced {new Date(lastSyncAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
              {/* Cache fallback warning with timestamp and refresh CTA */}
              {canUseCloudJournal && syncSource === 'cache' && (
                <span className="inline-flex items-center gap-2 text-[11px] text-amber-200/70">
                  {lastSyncAt
                    ? `Cached from ${new Date(lastSyncAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    : 'Using cached data'}
                  <button
                    type="button"
                    onClick={() => onReload()}
                    disabled={loading}
                    className="underline hover:text-amber-100 focus-visible:outline-none focus-visible:text-amber-100"
                  >
                    Refresh
                  </button>
                </span>
              )}
            </div>

            {/* Upgrade CTA for users without cloud journal - mention storage limit */}
            {!canUseCloudJournal && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/settings/subscription')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-300/15 hover:border-amber-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                  >
                    Upgrade to Cloud Journal
                  </button>
                  <span className="text-[11px] text-amber-100/50">Sync across devices and keep a cloud backup</span>
                </div>
                <p className="text-[11px] text-amber-100/45">
                  Local entries: {localEntryCount}. Storage depends on your browser.
                </p>
              </div>
            )}

            {/* Sync error with retry */}
            {journalError && canUseCloudJournal && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-amber-200/70">Sync issue</span>
                <button
                  onClick={() => onReload()}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200/25 bg-amber-200/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 disabled:opacity-50"
                >
                  <JournalRefreshIcon className="h-3 w-3" aria-hidden="true" />
                  {loading ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            )}

            {/* Signed-in, no-cloud: offer explicit import from legacy unscoped local journal. */}
            {!canUseCloudJournal && localStoragePresence?.hasLegacy && (
              <div className="space-y-2">
                <p className="text-sm text-amber-100/70">
                  We found local journal entries saved before you signed in.
                  They aren&rsquo;t shown automatically to protect against shared-device mixups.
                </p>
                <button
                  onClick={onImportLegacy}
                  disabled={importingLegacy}
                  className={`${OUTLINE_BUTTON_CLASS} mt-1`}
                >
                  <UploadSimple className="w-4 h-4" />
                  {importingLegacy ? 'Importing...' : 'Import local entries into this account'}
                </button>
              </div>
            )}

            {/* Signed-in, cloud: migrate any local entries (legacy or scoped) into D1. */}
            {canUseCloudJournal && (localStoragePresence?.hasLegacy || localStoragePresence?.hasScoped) && !migrating && (
              <button
                onClick={onMigrate}
                className={`${OUTLINE_BUTTON_CLASS} mt-1`}
              >
                <UploadSimple className="w-4 h-4" />
                Migrate local entries to cloud
              </button>
            )}
            {migrating && (
              <p className="text-sm text-amber-100/70">Migrating...</p>
            )}
          </div>
        </div>
      ) : (
        <div className={`mb-6 ${cardClass} p-5`}>
          <AmberStarfield />
          <div className="relative z-10 space-y-3 text-sm text-amber-100/80 journal-prose">
            <p>Your journal is currently stored locally in this browser only.</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-amber-100/60">
              <span>Local entries: {localEntryCount}</span>
              <span>Storage depends on your browser.</span>
            </div>
            <button
              type="button"
              onClick={() => onShowAuthModal()}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-300/15 hover:border-amber-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
            >
              Sign in to sync
            </button>
            {shouldShowAccountNudge && (
              <div className="mt-1">
                <AccountNudge
                  onCreateAccount={() => onShowAuthModal()}
                  onDismiss={onDismissNudge}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show standalone error only when not handled in the banner (non-cloud authenticated users) */}
      {journalError && !(isAuthenticated && canUseCloudJournal) && (
        <div className="mb-4 rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
          {journalError}
        </div>
      )}
    </>
  );
}

export default JournalStatusBanner;
