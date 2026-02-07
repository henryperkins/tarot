import { BookmarkSimple, ClockCounterClockwise, Sparkle, X } from '@phosphor-icons/react';

export function CoachTemplatePanel({
  isOpen,
  onClose,
  prefersReducedMotion,
  templates,
  newTemplateLabel,
  setNewTemplateLabel,
  templateStatus,
  handleSaveTemplate,
  handleApplyTemplate,
  handleDeleteTemplate,
  questionHistory,
  handleApplyHistoryQuestion,
  maxTemplates,
  getTopicLabel,
  getTimeframeLabel,
  getDepthLabel
}) {
  if (!isOpen) return null;

  return (
    <div
      className={`absolute inset-0 z-40 flex items-stretch bg-surface/70 backdrop-blur-sm ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose?.();
        }
      }}
      aria-label="Close template panel backdrop"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Template library"
        className={`ml-auto h-full w-full sm:w-[26rem] bg-surface border-l border-accent/30 p-5 sm:p-6 overflow-y-auto shadow-[0_0_45px_rgba(0,0,0,0.6)] ${prefersReducedMotion ? '' : 'animate-slide-in-right'}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
              <BookmarkSimple className="h-4 w-4 text-secondary" aria-hidden="true" />
              Template library
            </p>
            <p className="text-sm text-muted">
              Save this configuration or reapply a favorite blend anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-secondary/40 p-1 text-secondary hover:bg-secondary/10"
            aria-label="Close template panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          <section className="space-y-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Save current setup</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newTemplateLabel}
                  onChange={event => setNewTemplateLabel(event.target.value)}
                  placeholder="Template name"
                  aria-label="Template name"
                  className="flex-1 rounded-full border border-accent/20 bg-surface/70 px-3 py-2 text-sm text-main focus:outline-none focus:ring-1 focus:ring-secondary/60"
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-secondary/60 bg-secondary/10 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/20 transition"
                >
                  <Sparkle className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                  Save
                </button>
              </div>
              <p className="text-2xs text-secondary/70">
                {templates.length}/{maxTemplates} templates saved · oldest entry is replaced when you add more than {maxTemplates}.
              </p>
            </div>
            {templateStatus && (
              <p className="text-xs text-secondary/80">{templateStatus}</p>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Saved templates</p>
            {templates.length === 0 ? (
              <p className="text-xs text-muted">
                Nothing saved yet. Create a label above to store this blend for later.
              </p>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3 flex flex-col gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(template)}
                      className="text-left"
                    >
                      <p className="text-sm font-semibold text-main">{template.label}</p>
                      <p className="text-xs text-muted">
                        {[
                          getTopicLabel(template.topic),
                          getTimeframeLabel(template.timeframe),
                          getDepthLabel(template.depth)
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Custom mix'}
                      </p>
                      {template.customFocus && (
                        <p className="mt-1 text-xs text-secondary/80">{template.customFocus}</p>
                      )}
                      {template.savedQuestion && (
                        <p className="mt-2 text-xs text-muted">{template.savedQuestion}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="self-start text-xs text-error hover:text-error/80 underline decoration-dotted"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent/80">
              <ClockCounterClockwise className="h-4 w-4 text-secondary" aria-hidden="true" />
              Recent questions
            </p>
            {questionHistory.length === 0 ? (
              <p className="text-xs text-muted">No recent pulls yet—log a question to see it here.</p>
            ) : (
              <div className="space-y-2">
                {questionHistory.slice(0, 6).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleApplyHistoryQuestion(item)}
                    className="w-full text-left rounded-2xl border border-accent/20 bg-surface-muted/70 px-4 py-2 text-sm text-muted hover:border-secondary/50 transition"
                  >
                    {item.question}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
