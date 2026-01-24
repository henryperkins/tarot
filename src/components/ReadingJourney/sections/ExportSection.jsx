/**
 * ExportSection - Export and share functionality.
 *
 * Uses client-side export functions to:
 * - Support guests (no auth required)
 * - Respect active filters and scope selections
 * - Work with local storage entries
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { FilePdf, FileText, FileCsv, Link as LinkIcon, Warning } from '@phosphor-icons/react';
import { exportJournalInsightsToPdf } from '../../../lib/pdfExport';
import {
  exportJournalEntriesToCsv,
  exportJournalEntriesToMarkdown,
  computeJournalStats,
  copyJournalShareSummary,
} from '../../../lib/journalInsights';
import { JournalShareIcon } from '../../JournalIcons';

const OUTLINE_BUTTON_CLASS = `
  flex items-center gap-1.5 px-4 py-2.5 min-h-touch rounded-lg text-sm font-medium
  border border-[color:var(--border-warm-light)] text-[color:var(--text-muted-high)] bg-[color:var(--border-warm-subtle)]
  hover:bg-[color:var(--border-warm-light)] hover:border-[color:var(--border-warm)]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)]
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
`;

const SHARE_EXPIRY_OPTIONS = [
  { value: '', label: 'No expiry' },
  { value: '24', label: '24 hours' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
];

const formatExpiryLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'No expiry';
  if (parsed < 24) return `Expires in ${parsed}h`;
  const days = Math.round(parsed / 24);
  return `Expires in ${days}d`;
};

/**
 * @param {Object} props
 * @param {boolean} props.isAuthenticated - User auth state
 * @param {Function} props.onCreateShareLink - Callback for share links (auth only)
 * @param {Array} props.scopeEntries - Entries matching the current analytics scope
 * @param {Array} props.filteredEntries - Entries matching the active filters
 * @param {Array} props.allEntries - All entries (unfiltered) for "all" scope
 * @param {Object} props.stats - Stats for PDF export
 * @param {Object|null} props.preferenceDrift - Preference drift analysis (optional)
 * @param {string} props.scopeLabel - Human-friendly label for current scope
 * @param {boolean} props.filtersApplied - Whether journal filters are currently active
 */
const LARGE_EXPORT_THRESHOLD = 50; // Warn user before exporting more than this many entries

function ExportSection({
  isAuthenticated,
  onCreateShareLink,
  scopeEntries,
  filteredEntries,
  allEntries,
  stats,
  preferenceDrift,
  scopeLabel = 'Current view',
  filtersApplied = false
}) {
  const defaultScope = useMemo(() => {
    if (filtersApplied) return 'filters';
    return 'all';
  }, [filtersApplied]);

  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [linkCreated, setLinkCreated] = useState(null);
  const [linkCopyStatus, setLinkCopyStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  const [exportScope, setExportScope] = useState(defaultScope);
  const [exportScopeTouched, setExportScopeTouched] = useState(false);
  // Share scope: 'all' (all entries), 'scope' (current analytics scope), 'filters' (journal filters)
  const [shareScope, setShareScope] = useState(defaultScope);
  const [shareScopeTouched, setShareScopeTouched] = useState(false);
  const [shareLimit, setShareLimit] = useState(5);
  const [expiresInHours, setExpiresInHours] = useState('');
  // Confirmation for large exports
  const [pendingLargeExport, setPendingLargeExport] = useState(null);

  const normalizedScopeEntries = useMemo(
    () => Array.isArray(scopeEntries) ? scopeEntries : [],
    [scopeEntries]
  );
  const normalizedFilteredEntries = useMemo(
    () => Array.isArray(filteredEntries) ? filteredEntries : [],
    [filteredEntries]
  );
  const normalizedAllEntries = useMemo(
    () => Array.isArray(allEntries) ? allEntries : [],
    [allEntries]
  );
  const effectiveShareLimit = Number.isFinite(Number(shareLimit)) ? Math.max(1, Math.min(10, Number(shareLimit))) : 5;

  useEffect(() => {
    if (!exportScopeTouched) {
      setExportScope(defaultScope);
    }
  }, [defaultScope, exportScopeTouched]);

  useEffect(() => {
    if (!shareScopeTouched) {
      setShareScope(defaultScope);
    }
  }, [defaultScope, shareScopeTouched]);

  useEffect(() => {
    if (!filtersApplied && exportScope === 'filters') {
      setExportScope(defaultScope);
      setExportScopeTouched(false);
    }
  }, [filtersApplied, exportScope, defaultScope]);

  useEffect(() => {
    if (!filtersApplied && shareScope === 'filters') {
      setShareScope(defaultScope);
      setShareScopeTouched(false);
    }
  }, [filtersApplied, shareScope, defaultScope]);

  const exportEntries = exportScope === 'filters'
    ? normalizedFilteredEntries
    : exportScope === 'scope'
      ? normalizedScopeEntries
      : normalizedAllEntries;
  const hasEntries = exportEntries.length > 0;
  const exportScopeLabel = exportScope === 'filters'
    ? 'Current filters'
    : exportScope === 'scope'
      ? scopeLabel
      : 'All entries';
  const expiryLabel = formatExpiryLabel(expiresInHours);
  const scopeEntryCount = normalizedScopeEntries.length;

  const exportStatsForEntries = useMemo(() => {
    if (exportScope === 'scope') return stats;
    return computeJournalStats(exportEntries) ?? stats;
  }, [exportScope, exportEntries, stats]);

  const shareSourceEntries = useMemo(() => {
    if (shareScope === 'filters') return normalizedFilteredEntries;
    if (shareScope === 'scope') return normalizedScopeEntries;
    return normalizedAllEntries;
  }, [normalizedAllEntries, normalizedFilteredEntries, normalizedScopeEntries, shareScope]);

  const shareEntries = useMemo(
    () => shareSourceEntries.filter((entry) => entry?.id).slice(0, effectiveShareLimit),
    [effectiveShareLimit, shareSourceEntries]
  );

  const shareEntryIds = useMemo(
    () => shareEntries
      .map((entry) => (entry?.id ? String(entry.id) : '').trim())
      .filter(Boolean),
    [shareEntries]
  );

  const shareEntryCount = shareEntryIds.length;
  const shareScopeLabel = shareScope === 'filters'
    ? 'Current filters'
    : shareScope === 'scope'
      ? scopeLabel
      : 'All entries';
  const shareScopeStats = useMemo(() => {
    if (shareScope === 'scope') return stats;
    const computed = computeJournalStats(shareEntries);
    return computed || stats;
  }, [shareEntries, shareScope, stats]);
  const shareSummaryEntryCount = shareEntryCount;
  const shareHasLocalOnlyEntries = isAuthenticated
    && shareSourceEntries.length > 0
    && shareEntryCount === 0;
  const shareUsesServerFallback = shareScope === 'all'
    && shareEntryCount === 0
    && !shareHasLocalOnlyEntries;
  const canCreateShareLink = shareEntryCount > 0 || shareUsesServerFallback;
  const shareDisplayEntryCount = shareUsesServerFallback ? effectiveShareLimit : shareEntryCount;

  const executeExportPdf = (entriesToExport) => {
    try {
      exportJournalInsightsToPdf(exportStatsForEntries, entriesToExport, { scopeLabel: exportScopeLabel });
      setExportStatus({ type: 'success', message: 'PDF download started' });
    } catch (err) {
      console.error('PDF export failed:', err);
      setExportStatus({ type: 'error', message: 'PDF export failed' });
    }
  };

  const handleExportPdf = () => {
    if (!hasEntries) return;

    // For large exports, show confirmation first
    if (exportEntries.length > LARGE_EXPORT_THRESHOLD) {
      setPendingLargeExport({ type: 'pdf', count: exportEntries.length });
      return;
    }

    executeExportPdf(exportEntries);
  };

  const handleConfirmLargeExport = () => {
    if (pendingLargeExport?.type === 'pdf') {
      executeExportPdf(exportEntries);
    }
    setPendingLargeExport(null);
  };

  const handleCancelLargeExport = () => {
    setPendingLargeExport(null);
  };

  const handleExportMarkdown = () => {
    if (!hasEntries) return;
    const result = exportJournalEntriesToMarkdown(exportEntries);
    setExportStatus({
      type: result ? 'success' : 'error',
      message: result ? 'Markdown download started' : 'Export failed',
    });
  };

  const handleExportCsv = () => {
    if (!hasEntries) return;
    const result = exportJournalEntriesToCsv(exportEntries);
    setExportStatus({
      type: result ? 'success' : 'error',
      message: result ? 'CSV download started' : 'Export failed',
    });
  };

  const handleCopySnapshot = async (options = {}) => {
    const snapshotStats = options.statsOverride || stats;
    const snapshotLabel = options.scopeLabelOverride || scopeLabel;
    const snapshotEntryCount = typeof options.entryCountOverride === 'number'
      ? options.entryCountOverride
      : scopeEntryCount;
    const success = await copyJournalShareSummary(snapshotStats, {
      scopeLabel: snapshotLabel,
      entryCount: snapshotEntryCount,
      preferenceDrift,
    });
    if (!options.silent) {
      setShareStatus({
        type: options.type || (success ? 'success' : 'error'),
        message: options.message || (success ? 'Summary copied to clipboard' : 'Unable to copy summary'),
      });
    }
    return success;
  };

  const handleCreateShareLink = async () => {
    if (!onCreateShareLink) {
      // Fallback for guests: copy snapshot summary
      await handleCopySnapshot();
      return;
    }

    const parsedExpiry = Number.parseInt(expiresInHours, 10);
    const effectiveExpiry = Number.isFinite(parsedExpiry) && parsedExpiry > 0
      ? parsedExpiry
      : undefined;

    setIsCreatingLink(true);
    setLinkCopyStatus(null);
    try {
      const result = await onCreateShareLink({
        scope: 'journal',
        entryIds: shareUsesServerFallback ? undefined : shareEntryIds,
        limit: shareScope === 'all' ? effectiveShareLimit : undefined,
        expiresInHours: effectiveExpiry,
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
        const resolvedEntryCount = typeof result?.entryCount === 'number'
          ? result.entryCount
          : shareEntryCount;
        setLinkCreated({
          url: fullUrl || result.url,
          scopeLabel: shareScopeLabel,
          entryCount: resolvedEntryCount,
          expiryLabel,
        });
        const copied = await copyToClipboard(fullUrl || result.url);
        setLinkCopyStatus(
          copied
            ? { type: 'success', message: 'Link copied to clipboard!' }
            : { type: 'info', message: 'Link created — tap to select and copy.' }
        );
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      const snapshotCopied = await handleCopySnapshot({
        silent: true,
        statsOverride: shareScopeStats,
        scopeLabelOverride: shareScopeLabel,
        entryCountOverride: shareSummaryEntryCount,
      });
      setShareStatus({
        type: 'error',
        message: snapshotCopied
          ? 'Link failed — summary copied instead.'
          : 'Link failed and summary could not be copied.',
      });
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
        <p className="text-sm sm:text-xs text-muted mb-2">Export Your Journal</p>
        <div className="mb-3 space-y-2 text-xs text-muted-high">
          <fieldset className="space-y-2">
            <legend className="text-[10px] uppercase tracking-wider text-muted mb-1">Export scope</legend>

            <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${exportScope === 'all' ? 'bg-[color:var(--accent-25)]' : 'hover:bg-[color:var(--border-warm-subtle)]'}`}>
              <input
                type="radio"
                name="exportScope"
                value="all"
                checked={exportScope === 'all'}
                onChange={() => {
                  setExportScope('all');
                  setExportScopeTouched(true);
                }}
                className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
              />
              <div>
                <span className="font-medium">All entries</span>
                <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                  Export {normalizedAllEntries.length} entries
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${filtersApplied ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${exportScope === 'filters' ? 'bg-[color:var(--accent-25)]' : filtersApplied ? 'hover:bg-[color:var(--border-warm-subtle)]' : ''}`}>
              <input
                type="radio"
                name="exportScope"
                value="filters"
                checked={exportScope === 'filters'}
                onChange={() => {
                  setExportScope('filters');
                  setExportScopeTouched(true);
                }}
                disabled={!filtersApplied}
                className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
              />
              <div>
                <span className="font-medium">Current filters</span>
                <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                  {filtersApplied
                    ? `Export ${normalizedFilteredEntries.length} filtered entries`
                    : 'No filters are active'}
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${exportScope === 'scope' ? 'bg-[color:var(--accent-25)]' : 'hover:bg-[color:var(--border-warm-subtle)]'}`}>
              <input
                type="radio"
                name="exportScope"
                value="scope"
                checked={exportScope === 'scope'}
                onChange={() => {
                  setExportScope('scope');
                  setExportScopeTouched(true);
                }}
                className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
              />
              <div>
                <span className="font-medium">Current scope</span>
                <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                  Export {normalizedScopeEntries.length} entries from {scopeLabel}
                </p>
              </div>
            </label>
          </fieldset>

          {filtersApplied && exportScope === 'all' && (
            <div className="flex items-start gap-2 text-[11px] text-muted-high">
              <Warning className="h-3.5 w-3.5 text-[color:var(--brand-primary)] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>Filters are active — exporting all entries ignores filters.</span>
            </div>
          )}
        </div>
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
          <div className="mt-3 rounded-lg border border-[color:var(--border-warm)] bg-[color:var(--accent-25)] p-3">
            <div className="flex items-start gap-2">
              <Warning className="h-4 w-4 text-[color:var(--brand-primary)] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm sm:text-xs text-main font-medium">Large export</p>
                <p className="text-xs sm:text-[11px] text-muted-high mt-1">
                  You&apos;re about to export {pendingLargeExport.count} entries. This may take a moment and use significant memory.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirmLargeExport}
                    className="min-h-touch px-4 py-2.5 rounded text-sm font-medium bg-[color:var(--accent-25)] text-[color:var(--text-main)] hover:bg-[color:var(--accent-45)] transition-colors touch-manipulation"
                  >
                    Continue
                  </button>
                  <button
                    onClick={handleCancelLargeExport}
                    className="min-h-touch px-4 py-2.5 rounded text-sm text-muted hover:text-main transition-colors touch-manipulation"
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
            className={`mt-2 text-sm sm:text-xs ${exportStatus.type === 'success' ? 'text-[color:var(--status-success)]' : 'text-[color:var(--status-error)]'
              }`}
          >
            {exportStatus.message}
          </p>
        )}
        {!hasEntries && (
          <p className="mt-2 text-xs sm:text-[10px] text-muted">
            No entries to export for this scope
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-3 py-2 text-xs sm:text-[11px] text-muted-high">
        Exporting: {exportScopeLabel} · {hasEntries ? exportEntries.length : 0} entr{hasEntries && exportEntries.length === 1 ? 'y' : 'ies'}
      </div>

      {/* Share link (authenticated only) */}
      {isAuthenticated && onCreateShareLink && (
        <div>
          <p className="text-sm sm:text-xs text-muted mb-2">Share Journal Entries</p>

          <div className="mb-3 space-y-3 rounded-lg border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] p-3 text-sm sm:text-[12px] text-muted-high">
            {/* Scope selection */}
            <fieldset className="space-y-2">
              <legend className="text-xs sm:text-[10px] uppercase tracking-wider text-muted mb-1">What to share</legend>

              <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${shareScope === 'all' ? 'bg-[color:var(--accent-25)]' : 'hover:bg-[color:var(--border-warm-subtle)]'}`}>
                <input
                  type="radio"
                  name="shareScope"
                  value="all"
                  checked={shareScope === 'all'}
                  onChange={() => {
                    setShareScope('all');
                    setShareScopeTouched(true);
                  }}
                  className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
                />
                <div>
                  <span className="font-medium">All entries</span>
                  <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                    Share up to {effectiveShareLimit} entries from {normalizedAllEntries.length} total
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${filtersApplied ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${shareScope === 'filters' ? 'bg-[color:var(--accent-25)]' : filtersApplied ? 'hover:bg-[color:var(--border-warm-subtle)]' : ''}`}>
                <input
                  type="radio"
                  name="shareScope"
                  value="filters"
                  checked={shareScope === 'filters'}
                  onChange={() => {
                    setShareScope('filters');
                    setShareScopeTouched(true);
                  }}
                  disabled={!filtersApplied}
                  className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
                />
                <div>
                  <span className="font-medium">Current filters</span>
                  <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                    {filtersApplied
                      ? `Share up to ${effectiveShareLimit} of ${normalizedFilteredEntries.length} filtered entries`
                      : 'No filters are active'}
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${shareScope === 'scope' ? 'bg-[color:var(--accent-25)]' : 'hover:bg-[color:var(--border-warm-subtle)]'}`}>
                <input
                  type="radio"
                  name="shareScope"
                  value="scope"
                  checked={shareScope === 'scope'}
                  onChange={() => {
                    setShareScope('scope');
                    setShareScopeTouched(true);
                  }}
                  className="mt-0.5 h-5 w-5 border-[color:var(--border-warm-light)] bg-transparent text-[color:var(--brand-primary)] focus:ring-[color:var(--accent-45)] focus:ring-offset-0 touch-manipulation"
                />
                <div>
                  <span className="font-medium">Current scope</span>
                  <p className="text-xs sm:text-[11px] text-muted mt-0.5">
                    Share up to {effectiveShareLimit} entries from {scopeLabel}
                  </p>
                </div>
              </label>
            </fieldset>

            {filtersApplied && shareScope === 'all' && (
              <div className="flex items-start gap-2 text-[11px] text-muted-high">
                <Warning className="h-3.5 w-3.5 text-[color:var(--brand-primary)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Filters are active — sharing all entries ignores filters.</span>
              </div>
            )}

            {/* Limit control */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[color:var(--border-warm-subtle)]">
              <label htmlFor="share-limit" className="text-xs sm:text-[11px] text-muted-high">Max entries to share</label>
              <input
                id="share-limit"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                max="10"
                value={effectiveShareLimit}
                onChange={(event) => setShareLimit(event.target.value)}
                className="w-20 min-h-touch rounded border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-3 py-2 text-sm text-[color:var(--text-main)] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)] touch-manipulation"
              />
            </div>

            {/* Expiry control */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[color:var(--border-warm-subtle)]">
              <label htmlFor="share-expiry" className="text-xs sm:text-[11px] text-muted-high">Link expiry</label>
              <select
                id="share-expiry"
                value={expiresInHours}
                onChange={(event) => setExpiresInHours(event.target.value)}
                className="min-h-touch rounded border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-3 py-2 text-sm text-[color:var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)]"
              >
                {SHARE_EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div className="rounded bg-[color:var(--border-warm-subtle)] px-2 py-1.5 text-xs sm:text-[11px] text-muted-high">
              Will share {shareUsesServerFallback ? 'up to ' : ''}
              <span className="font-semibold text-main">{shareDisplayEntryCount}</span> entr{shareDisplayEntryCount === 1 ? 'y' : 'ies'} from {shareScopeLabel} · {expiryLabel}
            </div>
            {!canCreateShareLink && (
              <div className="space-y-1 text-xs sm:text-[11px] text-muted">
                <p>No entries available to share for this scope.</p>
                {shareHasLocalOnlyEntries && (
                  <p>
                    These readings are stored locally only. Save a cloud journal entry to create a share link.
                  </p>
                )}
              </div>
            )}
          </div>

          {linkCreated ? (
            <div className="rounded-lg bg-[color:color-mix(in_srgb,var(--status-success)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--status-success)_24%,transparent)] p-3">
              <p className="text-sm sm:text-xs text-[color:var(--status-success)] mb-2 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                {linkCopyStatus?.message || 'Link ready'}
              </p>
              <p className="text-xs sm:text-[11px] text-muted mb-2">
                Scope: {linkCreated.scopeLabel} · {linkCreated.entryCount} entr{linkCreated.entryCount === 1 ? 'y' : 'ies'} · {linkCreated.expiryLabel}
              </p>
              <input
                type="text"
                value={linkCreated.url}
                readOnly
                className="w-full min-h-touch px-3 py-2 text-sm sm:text-xs bg-transparent text-[color:var(--text-main)] rounded border border-[color:color-mix(in_srgb,var(--status-success)_25%,transparent)] touch-manipulation"
                onClick={(e) => e.target.select()}
                aria-label="Share link - tap to select and copy"
              />
              <button
                onClick={() => setLinkCreated(null)}
                className="mt-2 min-h-touch px-3 py-2 text-sm sm:text-xs text-muted hover:text-[color:var(--status-success)] touch-manipulation"
              >
                Create another
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreateShareLink}
              disabled={isCreatingLink || !canCreateShareLink}
              className={`${OUTLINE_BUTTON_CLASS} ${(isCreatingLink || !canCreateShareLink) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
              {isCreatingLink ? 'Creating...' : 'Create Share Link'}
            </button>
          )}

          <p className="mt-2 text-xs sm:text-[10px] text-muted">
            Share selected readings with a secure link
          </p>
        </div>
      )}

      {/* Snapshot sharing (available to everyone) */}
      <div>
        <p className="text-sm sm:text-xs text-muted mb-2">Share a summary</p>
        <button
          onClick={handleCopySnapshot}
          disabled={!stats}
          className={OUTLINE_BUTTON_CLASS}
          title={stats ? 'Copy a summary to clipboard' : 'No data to share'}
        >
          <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
          Copy summary
        </button>
        {shareStatus && (
          <p
            className={`mt-2 text-xs sm:text-[10px] ${shareStatus.type === 'success' ? 'text-[color:var(--status-success)]' : 'text-[color:var(--status-error)]'
              }`}
          >
            {shareStatus.message}
          </p>
        )}
        {!isAuthenticated && (
          <p className="text-sm sm:text-xs text-muted italic mt-1">
            Sign in to create share links; snapshot copy works for guests
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(ExportSection);
