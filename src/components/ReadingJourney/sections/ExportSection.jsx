/**
 * ExportSection - Export and share functionality.
 *
 * Uses client-side export functions to:
 * - Support guests (no auth required)
 * - Respect active filters (exports filtered entries)
 * - Work with local storage entries
 */

import { memo, useEffect, useState } from 'react';
import { FilePdf, FileText, FileCsv, Link as LinkIcon, Warning } from '@phosphor-icons/react';
import { exportJournalInsightsToPdf } from '../../../lib/pdfExport';
import {
  exportJournalEntriesToCsv,
  exportJournalEntriesToMarkdown,
  copyJournalShareSummary,
} from '../../../lib/journalInsights';
import { JournalShareIcon } from '../../JournalIcons';

const OUTLINE_BUTTON_CLASS = `
  flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium
  border border-amber-300/20 text-amber-100/80 bg-amber-200/5
  hover:bg-amber-200/10 hover:border-amber-300/30
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
`;

/**
 * @param {Object} props
 * @param {boolean} props.isAuthenticated - User auth state
 * @param {Function} props.onCreateShareLink - Callback for share links (auth only)
 * @param {Array} props.entries - Entries to export (respects filters)
 * @param {Array} props.allEntries - All entries (unfiltered) for "recent" scope
 * @param {Object} props.stats - Stats for PDF export
 * @param {string} props.scopeLabel - Human-friendly label for current scope
 * @param {boolean} props.filtersActive - Whether filters are currently active
 */
const LARGE_EXPORT_THRESHOLD = 50; // Warn user before exporting more than this many entries

function ExportSection({ isAuthenticated, onCreateShareLink, entries, allEntries, stats, scopeLabel = 'Current view', filtersActive = false }) {
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [linkCreated, setLinkCreated] = useState(null);
  const [linkCopyStatus, setLinkCopyStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  // Share scope: 'recent' (most recent N from all), 'filtered' (current filtered view)
  const [shareScope, setShareScope] = useState('recent');
  const [shareLimit, setShareLimit] = useState(5);
  // Confirmation for large exports
  const [pendingLargeExport, setPendingLargeExport] = useState(null);

  const hasEntries = Array.isArray(entries) && entries.length > 0;
  const hasAllEntries = Array.isArray(allEntries) && allEntries.length > 0;
  const effectiveShareLimit = Number.isFinite(Number(shareLimit)) ? Math.max(1, Math.min(10, Number(shareLimit))) : 5;

  // Compute share entry IDs based on selected scope
  const shareEntryIds = (() => {
    const sourceEntries = shareScope === 'filtered' ? entries : allEntries;
    if (!Array.isArray(sourceEntries)) return [];
    return sourceEntries
      .map((entry) => (entry?.id ? String(entry.id) : '').trim())
      .filter(Boolean)
      .slice(0, effectiveShareLimit);
  })();

  const shareEntryCount = shareEntryIds.length;

  const executeExportPdf = (entriesToExport) => {
    try {
      exportJournalInsightsToPdf(stats, entriesToExport, { scopeLabel });
      setExportStatus({ type: 'success', message: 'PDF download started' });
    } catch (err) {
      console.error('PDF export failed:', err);
      setExportStatus({ type: 'error', message: 'PDF export failed' });
    }
  };

  const handleExportPdf = () => {
    if (!hasEntries) return;

    // For large exports, show confirmation first
    if (entries.length > LARGE_EXPORT_THRESHOLD) {
      setPendingLargeExport({ type: 'pdf', count: entries.length });
      return;
    }

    executeExportPdf(entries);
  };

  const handleConfirmLargeExport = () => {
    if (pendingLargeExport?.type === 'pdf') {
      executeExportPdf(entries);
    }
    setPendingLargeExport(null);
  };

  const handleCancelLargeExport = () => {
    setPendingLargeExport(null);
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
    setLinkCopyStatus(null);
    try {
      const result = await onCreateShareLink({
        scope: 'journal',
        entryIds: shareEntryIds,
        limit: shareEntryIds.length ? undefined : effectiveShareLimit,
      });
      if (result?.url) {
        const makeAbsoluteUrl = (value) => {
          if (!value || typeof value !== 'string') return '';
          const trimmed = value.trim();
          if (!trimmed) return '';
          if (/^https?:\/\//i.test(trimmed)) return trimmed;
          if (typeof window === 'undefined') return trimmed;
          const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
          return `${window.location.origin}${path}`;
        };

        const copyToClipboard = async (text) => {
          if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
          if (!text) return false;
          try {
            if (navigator?.clipboard?.writeText) {
              await navigator.clipboard.writeText(text);
              return true;
            }
          } catch (error) {
            console.warn('Clipboard writeText failed:', error);
          }

          // Fallback for older browsers / permission issues
          try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '0';
            textarea.style.left = '0';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
          } catch (error) {
            console.warn('Clipboard fallback copy failed:', error);
            return false;
          }
        };

        const fullUrl = makeAbsoluteUrl(result.url);
        setLinkCreated(fullUrl || result.url);
        const copied = await copyToClipboard(fullUrl || result.url);
        setLinkCopyStatus(
          copied
            ? { type: 'success', message: 'Link copied to clipboard!' }
            : { type: 'info', message: 'Link created — tap to select and copy.' }
        );
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

  // Reset link copy status after brief display
  useEffect(() => {
    if (!linkCopyStatus) return undefined;
    const timer = setTimeout(() => setLinkCopyStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [linkCopyStatus]);

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div>
        <p className="text-sm sm:text-xs text-amber-100/60 mb-2">Export Your Journal</p>
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

        {/* Large export confirmation */}
        {pendingLargeExport && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
            <div className="flex items-start gap-2">
              <Warning className="h-4 w-4 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm sm:text-xs text-amber-100 font-medium">Large export</p>
                <p className="text-xs sm:text-[11px] text-amber-100/70 mt-1">
                  You&apos;re about to export {pendingLargeExport.count} entries. This may take a moment and use significant memory.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirmLargeExport}
                    className="min-h-[44px] px-4 py-2.5 rounded text-sm font-medium bg-amber-300/20 text-amber-100 hover:bg-amber-300/30 transition-colors touch-manipulation"
                  >
                    Continue
                  </button>
                  <button
                    onClick={handleCancelLargeExport}
                    className="min-h-[44px] px-4 py-2.5 rounded text-sm text-amber-100/70 hover:text-amber-100 transition-colors touch-manipulation"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export status feedback */}
        {exportStatus && (
          <p
            className={`mt-2 text-sm sm:text-xs ${exportStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
              }`}
          >
            {exportStatus.message}
          </p>
        )}
        {!hasEntries && (
          <p className="mt-2 text-xs sm:text-[10px] text-amber-100/50">
            No entries to export in the current view
          </p>
        )}
      </div>

      <div className="rounded-lg border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-xs sm:text-[11px] text-amber-100/70">
        Exporting {hasEntries ? entries.length : 0} entr{hasEntries && entries.length === 1 ? 'y' : 'ies'} · Scope: {scopeLabel}
      </div>

      {/* Share link (authenticated only) */}
      {isAuthenticated && onCreateShareLink && (
        <div>
          <p className="text-sm sm:text-xs text-amber-100/60 mb-2">Share Journal Entries</p>

          <div className="mb-3 space-y-3 rounded-lg border border-amber-300/15 bg-amber-200/5 p-3 text-sm sm:text-[12px] text-amber-100/80">
            {/* Scope selection */}
            <fieldset className="space-y-2">
              <legend className="text-xs sm:text-[10px] uppercase tracking-wider text-amber-100/50 mb-1">What to share</legend>

              <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${shareScope === 'recent' ? 'bg-amber-200/10' : 'hover:bg-amber-200/5'}`}>
                <input
                  type="radio"
                  name="shareScope"
                  value="recent"
                  checked={shareScope === 'recent'}
                  onChange={() => setShareScope('recent')}
                  className="mt-0.5 h-5 w-5 border-amber-200/30 bg-transparent text-amber-300 focus:ring-amber-200/40 focus:ring-offset-0 touch-manipulation"
                />
                <div>
                  <span className="font-medium">Most recent readings</span>
                  <p className="text-xs sm:text-[11px] text-amber-100/60 mt-0.5">
                    Share your {effectiveShareLimit} most recent entries ({hasAllEntries ? allEntries.length : 0} total)
                  </p>
                </div>
              </label>

              {filtersActive && (
                <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${shareScope === 'filtered' ? 'bg-amber-200/10' : 'hover:bg-amber-200/5'}`}>
                  <input
                    type="radio"
                    name="shareScope"
                    value="filtered"
                    checked={shareScope === 'filtered'}
                    onChange={() => setShareScope('filtered')}
                    className="mt-0.5 h-5 w-5 border-amber-200/30 bg-transparent text-amber-300 focus:ring-amber-200/40 focus:ring-offset-0 touch-manipulation"
                  />
                  <div>
                    <span className="font-medium">Current filtered view</span>
                    <p className="text-xs sm:text-[11px] text-amber-100/60 mt-0.5">
                      Share entries matching your filters ({hasEntries ? entries.length : 0} entries)
                    </p>
                  </div>
                </label>
              )}
            </fieldset>

            {/* Limit control */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/10">
              <label htmlFor="share-limit" className="text-xs sm:text-[11px] text-amber-100/70">Max entries to share</label>
              <input
                id="share-limit"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                max="10"
                value={effectiveShareLimit}
                onChange={(event) => setShareLimit(event.target.value)}
                className="w-20 min-h-[44px] rounded border border-amber-200/25 bg-amber-200/5 px-3 py-2 text-sm text-amber-50 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 touch-manipulation"
              />
            </div>

            {/* Summary */}
            <div className="rounded bg-amber-200/5 px-2 py-1.5 text-xs sm:text-[11px] text-amber-100/70">
              Will share <span className="font-semibold text-amber-50">{shareEntryCount}</span> entr{shareEntryCount === 1 ? 'y' : 'ies'}
              {shareScope === 'filtered' ? ' from filtered view' : ' (most recent)'}
            </div>
          </div>

          {linkCreated ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-sm sm:text-xs text-emerald-100 mb-2 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                {linkCopyStatus?.message || 'Link ready'}
              </p>
              <input
                type="text"
                value={linkCreated}
                readOnly
                className="w-full min-h-[44px] px-3 py-2 text-sm sm:text-xs bg-transparent text-emerald-100/80 rounded border border-emerald-400/20 touch-manipulation"
                onClick={(e) => e.target.select()}
                aria-label="Share link - tap to select and copy"
              />
              <button
                onClick={() => setLinkCreated(null)}
                className="mt-2 min-h-[44px] px-3 py-2 text-sm sm:text-xs text-emerald-200/70 hover:text-emerald-200 touch-manipulation"
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

          <p className="mt-2 text-xs sm:text-[10px] text-amber-100/50">
            Share your recent readings with a secure link
          </p>
        </div>
      )}

      {/* Snapshot sharing (available to everyone) */}
      <div>
        <p className="text-sm sm:text-xs text-amber-100/60 mb-2">Share a snapshot</p>
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
            className={`mt-2 text-xs sm:text-[10px] ${shareStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
              }`}
          >
            {shareStatus.message}
          </p>
        )}
        {!isAuthenticated && (
          <p className="text-sm sm:text-xs text-amber-100/50 italic mt-1">
            Sign in to create share links; snapshot copy works for guests
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(ExportSection);
