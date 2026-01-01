export function PersonalizationBanner({ onDismiss, onPersonalize }) {
  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-main">
          <strong>New:</strong> Personalize your readings with tone, style, and focus preferences.
        </p>
        <p className="text-xs text-muted mt-1">
          Skip ritual steps, set your ideal spread depth, and tailor the narrative tone whenever you like.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPersonalize}
          className="btn-primary text-xs sm:text-sm min-h-[44px]"
        >
          Set Preferences
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="btn-secondary text-xs sm:text-sm min-h-[44px]"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
