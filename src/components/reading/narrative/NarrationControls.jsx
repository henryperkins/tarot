
export function NarrationControls({
  controlsModel,
  onNarrate,
  onStopNarration
}) {
  if (!controlsModel?.show) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onNarrate}
        className="min-h-touch min-w-touch px-3 sm:px-4 py-2 rounded-lg border border-secondary/40 bg-surface/85 hover:bg-surface/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main text-sm"
        disabled={!controlsModel.canNarrate}
      >
        <span className="hidden xs:inline">{controlsModel.narrationLabel}</span>
        <span className="xs:hidden">{controlsModel.narrationLabelCompact}</span>
      </button>

      {controlsModel.showNarrationStop ? (
        <button
          type="button"
          onClick={onStopNarration}
          className="min-h-touch min-w-touch px-2 sm:px-3 py-2 rounded-lg border border-secondary/40 bg-surface/70 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Stop
        </button>
      ) : null}

    </div>
  );
}
