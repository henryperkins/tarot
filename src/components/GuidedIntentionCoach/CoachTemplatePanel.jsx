import { useId, useRef } from 'react';
import { BookmarkSimple, ClockCounterClockwise, Sparkle, X } from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { TEMPLATE_LABEL_MAX_LENGTH } from '../../lib/coachConstants';

export function CoachTemplatePanel({
  isOpen,
  intent = 'browse',
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
  const panelRef = useRef(null);
  const nameInputRef = useRef(null);
  const applyButtonRefs = useRef(new Map());
  const headingId = useId();
  const idPrefix = useId();

  // A layer of its own: it owns Escape and Tab while open, returns focus to
  // whichever control opened it, and hides the coach behind it from assistive
  // tech. The coach already locks page scroll, and that lock is not reentrant.
  useModalA11y(isOpen, {
    onClose,
    containerRef: panelRef,
    lockScroll: false,
    isolateBackground: true,
    initialFocusSelector: intent === 'save' ? '[data-initial-focus="save"]' : '[data-initial-focus="browse"]'
  });

  if (!isOpen) return null;

  const handleRemove = (templateId, index) => {
    // The Remove button leaves with its template; keep focus in the list.
    const remaining = templates.filter(template => template.id !== templateId);
    const nextTemplate = remaining[index] || remaining[index - 1] || null;
    handleDeleteTemplate(templateId);
    requestAnimationFrame(() => {
      const target = nextTemplate ? applyButtonRefs.current.get(nextTemplate.id) : nameInputRef.current;
      target?.focus();
    });
  };

  return (
    <div
      className={`absolute inset-0 z-sticky-elevated flex items-stretch bg-surface/70 backdrop-blur-sm ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={`ml-auto h-full w-full sm:w-[26rem] bg-surface border-l border-accent/30 p-5 sm:p-6 overflow-y-auto overscroll-contain scrollbar-themed shadow-[var(--ui-elevated-shadow)] focus:outline-none ${prefersReducedMotion ? '' : 'animate-slide-in-right'}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 id={headingId} className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
              <BookmarkSimple className="h-4 w-4 text-secondary" aria-hidden="true" />
              Template library
            </h2>
            <p className="text-sm text-muted">
              Save this configuration or reapply a favorite blend anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-initial-focus="browse"
            className="inline-flex items-center justify-center rounded-full border border-secondary/40 p-1 min-h-touch min-w-touch text-secondary hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            aria-label="Close template panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          <section className="space-y-3" aria-labelledby={`${idPrefix}-save`}>
            <div className="flex flex-col gap-2">
              <h3 id={`${idPrefix}-save`} className="text-xs uppercase tracking-[0.3em] text-accent/80">Save current setup</h3>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={event => {
                  event.preventDefault();
                  handleSaveTemplate();
                }}
              >
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newTemplateLabel}
                  onChange={event => setNewTemplateLabel(event.target.value)}
                  placeholder="Template name"
                  aria-label="Template name"
                  maxLength={TEMPLATE_LABEL_MAX_LENGTH}
                  autoComplete="off"
                  enterKeyHint="done"
                  data-initial-focus="save"
                  className="flex-1 min-w-0 rounded-full border border-accent/20 bg-surface/70 px-3 py-2 text-sm text-main caret-accent focus:outline-none focus:ring-1 focus:ring-secondary/60"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-secondary/60 bg-secondary/10 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
                >
                  <Sparkle className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                  Save
                </button>
              </form>
              <p className="text-2xs text-secondary/70">
                {templates.length}/{maxTemplates} templates saved · oldest entry is replaced when you add more than {maxTemplates}.
              </p>
            </div>
            {templateStatus && (
              <p className="text-xs text-secondary/80 break-words">{templateStatus}</p>
            )}
            {/* Always mounted, and off screen so an empty region leaves no gap,
                so screen readers hear each save, update, and removal. */}
            <p className="sr-only" role="status" aria-live="polite">
              {templateStatus}
            </p>
          </section>

          <section className="space-y-3" aria-labelledby={`${idPrefix}-saved`}>
            <h3 id={`${idPrefix}-saved`} className="text-xs uppercase tracking-[0.3em] text-accent/80">Saved templates</h3>
            {templates.length === 0 ? (
              <p className="text-xs text-muted">
                Nothing saved yet. Create a label above to store this blend for later.
              </p>
            ) : (
              <ul className="space-y-3">
                {templates.map((template, index) => {
                  const summaryId = `${idPrefix}-template-${index}-summary`;
                  const summary = [
                    getTopicLabel(template.topic),
                    getTimeframeLabel(template.timeframe),
                    getDepthLabel(template.depth)
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Custom mix';
                  return (
                    <li
                      key={template.id}
                      className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3 flex flex-col gap-2"
                    >
                      <button
                        ref={element => {
                          if (element) applyButtonRefs.current.set(template.id, element);
                          else applyButtonRefs.current.delete(template.id);
                        }}
                        type="button"
                        onClick={() => handleApplyTemplate(template)}
                        aria-label={`Apply template ${template.label}`}
                        aria-describedby={summaryId}
                        className="text-left min-w-0"
                      >
                        <span className="block text-sm font-semibold text-main break-words">{template.label}</span>
                        <span id={summaryId} className="block">
                          <span className="block text-xs text-muted">{summary}</span>
                          {template.customFocus && (
                            <span className="mt-1 block text-xs text-secondary/80 break-words">{template.customFocus}</span>
                          )}
                          {template.savedQuestion && (
                            <span className="mt-2 block text-xs text-muted break-words">{template.savedQuestion}</span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(template.id, index)}
                        aria-label={`Remove template ${template.label}`}
                        className="self-start text-xs text-error hover:text-error/80 underline decoration-dotted"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3" aria-labelledby={`${idPrefix}-recent`}>
            <h3 id={`${idPrefix}-recent`} className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent/80">
              <ClockCounterClockwise className="h-4 w-4 text-secondary" aria-hidden="true" />
              Recent questions
            </h3>
            {questionHistory.length === 0 ? (
              <p className="text-xs text-muted">No recent pulls yet—log a question to see it here.</p>
            ) : (
              <ul className="space-y-2">
                {questionHistory.slice(0, 6).map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleApplyHistoryQuestion(item)}
                      className="w-full text-left rounded-2xl border border-accent/20 bg-surface-muted/70 px-4 py-2 text-sm text-muted hover:border-secondary/50 transition break-words"
                    >
                      {item.question}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
