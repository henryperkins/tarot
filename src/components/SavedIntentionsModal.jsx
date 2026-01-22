import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { AmberStarfield } from './AmberStarfield';
import { SavedIntentionsList } from './SavedIntentionsList.jsx';

export function SavedIntentionsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = 'saved-intentions-modal-title';
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    initialFocusRef: closeButtonRef,
    closeOnEscape: !isConfirmOpen,
    trapFocus: !isConfirmOpen
  });

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-main/80 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
      onClick={createBackdropHandler(onClose)}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal={!isConfirmOpen}
        aria-hidden={isConfirmOpen ? 'true' : undefined}
        aria-labelledby={titleId}
        className="panel-mystic relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] rounded-none sm:rounded-3xl overflow-hidden p-0 focus:outline-none"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <AmberStarfield />

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-main hover:bg-surface-muted/60 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-main touch-manipulation"
          aria-label="Close saved intentions"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 pr-14 sm:pr-16">
          <SavedIntentionsList
            titleId={titleId}
            variant="modal"
            emptyState="message"
            onConfirmOpenChange={setIsConfirmOpen}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
