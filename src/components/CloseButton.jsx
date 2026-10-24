import { X } from '@phosphor-icons/react';
import { ICON_BUTTON_CLASS } from '../styles/buttonClasses';

const ICON_SIZE_CLASS = {
  md: 'h-5 w-5', // dialogs and sheets
  sm: 'h-4 w-4' // compact panels, notices, nudges and toasts
};

/**
 * Icon-only button that closes a dialog, sheet or panel, or dismisses a notice.
 *
 * The button has no visible text, so `label` is required: it becomes the
 * accessible name. Add placement (absolute offsets, negative margins) through
 * `className`, and pass `ref` when the dialog focuses the button first.
 * `iconClassName` replaces the icon size for chrome that caps its own scale.
 */
export function CloseButton({ label, size = 'md', className = '', iconClassName, ref, ...props }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={className ? `${ICON_BUTTON_CLASS} ${className}` : ICON_BUTTON_CLASS}
      {...props}
    >
      <X className={iconClassName || ICON_SIZE_CLASS[size] || ICON_SIZE_CLASS.md} aria-hidden="true" />
    </button>
  );
}
