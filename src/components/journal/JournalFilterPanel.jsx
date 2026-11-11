import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { FOCUS_RING_DEFAULT } from '../../styles/focusClasses';

const TIMEFRAMES = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' }
];

function FilterChoices({ label, options, value, onChange, multiple = false }) {
  const groupId = useId();
  if (!options.length) return null;
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-semibold text-main">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map(option => {
          const selected = multiple ? (value || []).includes(option.value) : value === option.value;
          return (
            <label key={option.value}
              className={`flex min-h-touch min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm leading-snug text-main transition-colors focus-within:ring-2 focus-within:ring-(--focus-ring-color) ${selected ? 'border-(--brand-primary) bg-(--ui-selected-bg)' : 'border-(--border-warm-light) hover:border-(--border-warm)'}`}>
              <input type={multiple ? 'checkbox' : 'radio'} name={groupId} value={option.value} checked={selected}
                className="h-4 w-4 shrink-0 accent-(--brand-primary)"
                onChange={() => onChange(multiple
                  ? selected ? value.filter(item => item !== option.value) : [...(value || []), option.value]
                  : option.value)} />
              <span className="min-w-0 wrap-anywhere">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One live filter surface: a desktop popover or a focus-contained phone sheet. */
export function JournalFilterPanel({
  id, isOpen, isCompact, filters, onChange, contexts, spreads, decks,
  onClose, onClear, canClear, triggerRef
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = useId();

  useModalA11y(isOpen && isCompact, {
    onClose,
    containerRef: panelRef,
    initialFocusRef: closeRef,
    returnFocusRef: triggerRef,
    isolateBackground: true,
    backGuardId: 'journal-filters'
  });

  useEffect(() => {
    if (!isOpen || isCompact) return undefined;
    // Non-modal on desktop: tabbing or clicking elsewhere dismisses the panel
    // without stealing focus from the control the reader chose next.
    closeRef.current?.focus({ preventScroll: true });
    const outside = event => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose();
    };
    const escape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen, isCompact, onClose, triggerRef]);

  if (!isOpen) return null;
  const dismiss = () => {
    onClose();
    if (!isCompact) triggerRef.current?.focus({ preventScroll: true });
  };
  const panel = (
    <div ref={panelRef} id={id} role="dialog" aria-modal={isCompact || undefined}
      aria-labelledby={headingId} tabIndex={-1}
      className={`flex min-h-0 flex-col border border-(--border-warm) bg-(--bg-surface) shadow-(--ui-elevated-shadow) ${isCompact
        ? 'relative max-h-[85dvh] w-full rounded-t-3xl'
        : 'absolute right-0 top-full z-50 mt-2 max-h-[min(42rem,75dvh)] w-[min(34rem,calc(100vw-3rem))] rounded-2xl'}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-(--border-warm-light) px-4 py-3 sm:px-5">
        <h3 id={headingId} className="font-serif text-xl text-main">Filter saved readings</h3>
        <button ref={closeRef} type="button" onClick={dismiss} aria-label="Close filters"
          className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-muted hover:text-main ${FOCUS_RING_DEFAULT}`}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        <FilterChoices label="Timeframe" options={TIMEFRAMES} value={filters.timeframe}
          onChange={value => onChange({ ...filters, timeframe: value })} />
        <FilterChoices label="Context" options={contexts} value={filters.contexts} multiple
          onChange={value => onChange({ ...filters, contexts: value })} />
        <FilterChoices label="Spread" options={spreads} value={filters.spreads} multiple
          onChange={value => onChange({ ...filters, spreads: value })} />
        <FilterChoices label="Deck" options={decks} value={filters.decks} multiple
          onChange={value => onChange({ ...filters, decks: value })} />
        <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm text-main">
          <input type="checkbox" checked={filters.onlyReversals}
            onChange={event => onChange({ ...filters, onlyReversals: event.target.checked })}
            className="h-4 w-4 accent-(--brand-primary)" />
          Contains reversed cards
        </label>
      </div>
      <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-(--border-warm-light) px-4 py-3 sm:px-5 ${isCompact ? 'pb-[max(0.75rem,var(--safe-pad-bottom))]' : ''}`}>
        <button type="button" disabled={!canClear} onClick={() => { onClear(); closeRef.current?.focus({ preventScroll: true }); }}
          className={`min-h-touch rounded-xl px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline disabled:opacity-40 ${FOCUS_RING_DEFAULT}`}>Clear filters</button>
        <button type="button" onClick={dismiss}
          className={`min-h-touch rounded-xl bg-(--brand-primary) px-5 py-2 text-sm font-semibold text-(--text-on-brand) ${FOCUS_RING_DEFAULT}`}>Show readings</button>
      </div>
    </div>
  );

  return isCompact ? createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center pt-[max(1rem,var(--safe-pad-top))]">
      <div data-modal-backdrop aria-hidden="true" onClick={dismiss} className="absolute inset-0 bg-main/70 backdrop-blur-sm" />
      {panel}
    </div>, document.body
  ) : panel;
}
