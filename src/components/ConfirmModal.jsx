import { useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { Warning, X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';

/**
 * Confirmation Modal
 *
 * Replaces native browser confirm() dialogs with a styled modal
 * that matches the application's design system.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning' // 'warning' | 'danger'
}) {
  const cancelButtonRef = useRef(null);
  const modalRef = useRef(null);

  // Use modal accessibility hook for scroll lock, escape key, and focus restoration
  // trapFocus: false because FocusTrap library handles focus trapping
  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    trapFocus: false,
    initialFocusRef: cancelButtonRef,
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantStyles = {
    warning: 'border-accent/40 bg-surface/95',
    danger: 'border-error/40 bg-surface/95'
  };

  const buttonStyles = {
    warning: 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25',
    danger: 'bg-error/15 border-error/40 text-error hover:bg-error/25'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-main/70 backdrop-blur-sm animate-fade-in p-3 xs:p-4"
      onClick={createBackdropHandler(onClose)}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
      }}
    >
      <FocusTrap
        active={isOpen}
        focusTrapOptions={{
          initialFocus: () => cancelButtonRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: false,
          allowOutsideClick: true,
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className={`relative w-full max-w-md rounded-2xl border ${variantStyles[variant]} shadow-2xl animate-slide-up`}
        >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 xs:top-4 xs:right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-main hover:bg-surface-muted/50 rounded-full transition touch-manipulation"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 xs:p-6">
          <div className="flex items-start gap-3 xs:gap-4 mb-4 pr-8">
            <div className={`p-2 rounded-full shrink-0 ${variant === 'danger' ? 'bg-error/10' : 'bg-accent/10'}`}>
              <Warning className={`w-5 h-5 xs:w-6 xs:h-6 ${variant === 'danger' ? 'text-error' : 'text-accent'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="confirm-modal-title" className="text-lg xs:text-xl font-serif text-main mb-2">
                {title}
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse xs:flex-row gap-2 xs:gap-3 xs:justify-end mt-6">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              className="w-full xs:w-auto px-4 py-2.5 min-h-[44px] rounded-lg border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition text-sm font-medium touch-manipulation"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`w-full xs:w-auto px-4 py-2.5 min-h-[44px] rounded-lg border ${buttonStyles[variant]} transition text-sm font-medium touch-manipulation`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}
