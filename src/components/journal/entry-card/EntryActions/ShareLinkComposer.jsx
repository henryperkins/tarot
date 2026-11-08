/**
 * ShareLinkComposer.jsx
 * Publishing a private reading is a decision, not a tap: this panel says what
 * a link shows and how long it stays open before anything is created. It is a
 * region of the open entry under its header (not a card inside it), and the
 * entry returns focus to the share button when it closes.
 */
import { memo, useEffect, useId, useRef, useState } from 'react';
import { Check, CircleNotch } from '@phosphor-icons/react';
import { OUTLINE_BUTTON_CLASS } from '../../../../styles/buttonClasses';
import {
  DEFAULT_SHARE_LINK_EXPIRY_HOURS,
  SHARE_LINK_EXPIRY_OPTIONS
} from '../../../../lib/journal/shareLinkExpiry';
import { styles, cn } from '../EntryCard.primitives';

export const ShareLinkComposer = memo(function ShareLinkComposer({
  id,
  pending = false,
  onCreate,
  onCancel
}) {
  const titleId = useId();
  const descriptionId = useId();
  const radioName = useId();
  const [expiryHours, setExpiryHours] = useState(DEFAULT_SHARE_LINK_EXPIRY_HOURS);
  const groupRef = useRef(null);

  // Opening moves focus to the chosen expiry, so the choice is the first thing heard.
  useEffect(() => {
    groupRef.current?.querySelector('input[type="radio"]:checked')?.focus();
  }, []);

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="relative z-10 border-b border-(--border-warm-subtle) px-[min(1rem,4vw)] pb-4 pt-3 sm:px-5"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <p id={titleId} className="font-serif text-base text-(--text-main)">Share this reading</p>
      <p id={descriptionId} className="mt-1 max-w-[33em] text-sm text-pretty text-(--text-muted-high)">
        Anyone with the link can see the question, the spread and the cards, and leave a note.
        Your reading&apos;s narrative and your reflections stay private.
      </p>

      <fieldset className="mt-3 min-w-0">
        <legend className={styles.sectionLabel}>Link expiry</legend>
        <div ref={groupRef} className="mt-2 flex flex-wrap gap-2">
          {SHARE_LINK_EXPIRY_OPTIONS.map((option) => {
            const checked = expiryHours === option.hours;
            return (
              <label
                key={option.label}
                className={cn(
                  'relative inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition',
                  'has-focus-visible:ring-2 has-focus-visible:ring-(--focus-ring-color)',
                  checked
                    ? 'border-accent bg-accent text-surface'
                    : 'border-(--border-warm-light) bg-(--border-warm-subtle) text-(--text-main) hover:border-(--border-warm)'
                )}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={option.hours ?? 'none'}
                  checked={checked}
                  onChange={() => setExpiryHours(option.hours)}
                  className="sr-only"
                />
                {/* Shape as well as colour marks the choice (forced colours drop fills). */}
                {checked && <Check className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />}
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* aria-disabled, not disabled: the button keeps focus while the link is
            made, so a failure leaves the reader on it, ready to try again. */}
        <button
          type="button"
          aria-disabled={pending || undefined}
          onClick={() => {
            if (!pending) onCreate(expiryHours);
          }}
          className={cn(OUTLINE_BUTTON_CLASS, pending && 'cursor-wait')}
        >
          {pending && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {pending ? 'Creating link…' : 'Create link'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className={cn(styles.actionButton, styles.actionButtonEnabled)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
