/**
 * ExportSection - Export and share functionality.
 *
 * Uses client-side export functions to:
 * - Support guests (no auth required)
 * - Respect active filters (exports filtered entries)
 * - Work with local storage entries
 */

import { memo, useEffect, useState } from 'react';
import { FilePdf, FileText, FileCsv, Link as LinkIcon } from '@phosphor-icons/react';
import { exportJournalInsightsToPdf } from '../../../lib/pdfExport';
import {
  exportJournalEntriesToCsv,
  exportJournalEntriesToMarkdown,
  copyJournalShareSummary,
} from '../../../lib/journalInsights';
import { JournalShareIcon } from '../../JournalIcons';

const OUTLINE_BUTTON_CLASS = `
  flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
  border border-amber-300/20 text-amber-100/80 bg-amber-200/5
  hover:bg-amber-200/10 hover:border-amber-300/30
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
`;

/**
 * @param {Object} props
 * @param {boolean} props.isAuthenticated - User auth state
 * @param {Function} props.onCreateShareLink - Callback for share links (auth only)
 * @param {Array} props.entries - Entries to export (respects filters)
 * @param {Object} props.stats - Stats for PDF export
 * @param {string} props.scopeLabel - Human-friendly label for current scope
 */
function ExportSection({ isAuthenticated, onCreateShareLink, entries, stats, scopeLabel = 'Current view' }) {
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [linkCreated, setLinkCreated] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  const [useScopedEntries, setUseScopedEntries] = useState(true);
  const [shareLimit, setShareLimit] = useState(() => Math.min(5, Math.max(1, (entries?.length || 5))));

  const hasEntries = Array.isArray(entries) && entries.length > 0;
  const scopedEntryIds = Array.isArray(entries)
    ? entries
      .map((entry) => (entry?.id ? String(entry.id) : '').trim())
      .filter(Boolean)
    : [];
  const effectiveShareLimit = Number.isFinite(Number(shareLimit)) ? Math.max(1, Math.min(10, Number(shareLimit))) : 5;
  const scopedShareIds = useScopedEntries && scopedEntryIds.length > 0
    ? scopedEntryIds.slice(0, Math.min(effectiveShareLimit, scopedEntryIds.length))
    : [];

  useEffect(() => {
    const nextDefault = Math.min(5, Math.max(1, entries?.length || 5));
    setShareLimit((prev) => {
      const numeric = Number(prev);
      if (!Number.isFinite(numeric)) return nextDefault;
      return Math.min(Math.max(numeric, 1), 10);
    });
  }, [entries?.length]);

  const handleExportPdf = () => {
    if (!hasEntries) return;
    try {
      exportJournalInsightsToPdf(stats, entries, { scopeLabel });
      setExportStatus({ type: 'success', message: 'PDF download started' });
    } catch (err) {
      console.error('PDF export failed:', err);
      setExportStatus({ type: 'error', message: 'PDF export failed' });
    }
  };

  const handleExportMarkdown = () => {
    if (!hasEntries) return;
    const result = exportJournalEntriesToMarkdown(entries);
    setExportStatus({
      type: result ? 'success' : 'error',
      message: result ? 'Markdown download started' : 'Export failed',
    });
  };

  const handleExportCsv = () => {
    if (!hasEntries) return;
    const result = exportJournalEntriesToCsv(entries);
    setExportStatus({
      type: result ? 'success' : 'error',
      message: result ? 'CSV download started' : 'Export failed',
    });
  };

  const handleCopySnapshot = async () => {
    const success = await copyJournalShareSummary(stats, {
      scopeLabel,
      entryCount: hasEntries ? entries.length : 0,
    });
    setShareStatus({
      type: success ? 'success' : 'error',
      message: success ? 'Snapshot copied to clipboard' : 'Unable to copy snapshot',
    });
    return success;
  };

  const handleCreateShareLink = async () => {
    if (!onCreateShareLink) {
      // Fallback for guests: copy snapshot summary
      await handleCopySnapshot();
      return;
    }

    setIsCreatingLink(true);
    try {
      const result = await onCreateShareLink({
        scope: 'journal',
        entryIds: scopedShareIds,
        limit: scopedShareIds.length ? undefined : effectiveShareLimit,
      });
      if (result?.url) {
        setLinkCreated(result.url);
        // Copy to clipboard
        await navigator.clipboard?.writeText(result.url);
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      await handleCopySnapshot();
    } finally {
      setIsCreatingLink(false);
    }
  };

  // Reset export status after brief display; cleans up pending timeout on unmount
  useEffect(() => {
    if (!exportStatus) return undefined;
    const timer = setTimeout(() => setExportStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [exportStatus]);

  // Reset share status after brief display
  useEffect(() => {
    if (!shareStatus) return undefined;
    const timer = setTimeout(() => setShareStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div>
        <p className="text-xs text-amber-100/60 mb-2">Export Your Journal</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportPdf}
            disabled={!hasEntries}
            className={OUTLINE_BUTTON_CLASS}
            title={hasEntries ? 'Export as PDF' : 'No entries to export'}
          >
            <FilePdf className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={handleExportMarkdown}
            disabled={!hasEntries}
            className={OUTLINE_BUTTON_CLASS}
            title={hasEntries ? 'Export as Markdown' : 'No entries to export'}
          >
            <FileText className="h-4 w-4" />
            Markdown
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!hasEntries}
            className={OUTLINE_BUTTON_CLASS}
            title={hasEntries ? 'Export as CSV' : 'No entries to export'}
          >
            <FileCsv className="h-4 w-4" />
            CSV
          </button>
        </div>
        {/* Export status feedback */}
        {exportStatus && (
          <p
            className={`mt-2 text-xs ${
              exportStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {exportStatus.message}
          </p>
        )}
        {!hasEntries && (
          <p className="mt-2 text-[10px] text-amber-100/50">
            No entries to export in the current view
          </p>
        )}
      </div>

      <div className="rounded-lg border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-[11px] text-amber-100/70">
        Exporting {hasEntries ? entries.length : 0} entr{hasEntries && entries.length === 1 ? 'y' : 'ies'} · Scope: {scopeLabel}
      </div>

      {/* Share link (authenticated only) */}
      {isAuthenticated && onCreateShareLink && (
        <div>
          <p className="text-xs text-amber-100/60 mb-2">Share a Reading</p>

          <div className="mb-3 space-y-2 rounded-lg border border-amber-300/15 bg-amber-200/5 p-3 text-[12px] text-amber-100/80">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-amber-200/30 bg-transparent text-amber-300 focus:ring-amber-200/40 focus:ring-offset-0"
                  checked={useScopedEntries}
                  onChange={(event) => setUseScopedEntries(event.target.checked)}
                />
                Use current filters ({hasEntries ? entries.length : 0})
              </label>
              <label className="flex items-center gap-1 text-[11px] text-amber-100/70">
                Limit
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={effectiveShareLimit}
                  onChange={(event) => setShareLimit(event.target.value)}
                  className="w-16 rounded border border-amber-200/25 bg-amber-200/5 px-2 py-1 text-xs text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                />
              </label>
            </div>
            <p className="text-[11px] text-amber-100/60">
              {useScopedEntries && scopedShareIds.length > 0
                ? `Will include ${scopedShareIds.length} entr${scopedShareIds.length === 1 ? 'y' : 'ies'} from this view`
                : 'Shares the most recent readings (up to limit)'}
            </p>
            <p className="text-[11px] text-amber-100/60">Scope: {scopeLabel}</p>
          </div>

          {linkCreated ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-xs text-emerald-100 mb-2 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                Link copied to clipboard!
              </p>
              <input
                type="text"
                value={linkCreated}
                readOnly
                className="w-full text-xs bg-transparent text-emerald-100/80 truncate"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => setLinkCreated(null)}
                className="mt-2 text-xs text-emerald-200/70 hover:text-emerald-200"
              >
                Create another
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreateShareLink}
              disabled={isCreatingLink}
              className={`${OUTLINE_BUTTON_CLASS} ${isCreatingLink ? 'opacity-50 cursor-wait' : ''}`}
            >
              <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
              {isCreatingLink ? 'Creating...' : 'Create Share Link'}
            </button>
          )}

          <p className="mt-2 text-[10px] text-amber-100/50">
            Share your recent readings with a secure link
          </p>
        </div>
      )}

      {/* Snapshot sharing (available to everyone) */}
      <div>
        <p className="text-xs text-amber-100/60 mb-2">Share a snapshot</p>
        <button
          onClick={handleCopySnapshot}
          disabled={!stats}
          className={OUTLINE_BUTTON_CLASS}
          title={stats ? 'Copy a summary to clipboard' : 'No data to share'}
        >
          <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
          Copy snapshot
        </button>
        {shareStatus && (
          <p
            className={`mt-2 text-[10px] ${
              shareStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {shareStatus.message}
          </p>
        )}
        {!isAuthenticated && (
          <p className="text-xs text-amber-100/50 italic mt-1">
            Sign in to create share links; snapshot copy works for guests
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(ExportSection);
