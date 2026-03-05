import { BookmarkSimple } from '@phosphor-icons/react';

export function NarrationControls({
  controlsModel,
  onNarrate,
  onStopNarration,
  onSaveReading,
  onOpenJournal
}) {
  if (!controlsModel?.show) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onNarrate}
        className="px-3 sm:px-4 py-2 rounded-lg border border-secondary/40 bg-surface/85 hover:bg-surface/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main text-xs sm:text-sm"
        disabled={!controlsModel.canNarrate}
      >
        <span className="hidden xs:inline">{controlsModel.narrationLabel}</span>
        <span className="xs:hidden">{controlsModel.narrationLabelCompact}</span>
      </button>

      {controlsModel.showNarrationStop ? (
        <button
          type="button"
          onClick={onStopNarration}
          className="px-2 sm:px-3 py-2 rounded-lg border border-secondary/40 bg-surface/70 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          Stop
        </button>
      ) : null}

      {controlsModel.showSaveButton ? (
        <button
          type="button"
          onClick={onSaveReading}
          disabled={controlsModel.isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs sm:text-sm font-semibold hover:bg-accent/30 transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkSimple className="w-3.5 h-3.5" weight="fill" />
          <span>{controlsModel.isSaving ? 'Saving...' : 'Save to Journal'}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpenJournal}
        className="px-3 sm:px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs sm:text-sm hover:bg-primary/25 hover:text-primary transition"
      >
        View Journal
      </button>
    </div>
  );
}
