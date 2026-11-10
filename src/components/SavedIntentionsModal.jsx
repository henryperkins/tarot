import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../hooks/useModalA11y';
import { AmberStarfield } from './AmberStarfield';
import { CloseButton } from './CloseButton';
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
      queueMicrotask(() => {
        setIsConfirmOpen(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-stretch sm:items-center justify-center bg-main/80 backdrop-blur-sm animate-fade-in p-0 sm:p-4 pt-[max(0.75rem,var(--safe-pad-top))] pb-[max(0.75rem,var(--safe-pad-bottom))] pl-[max(0.75rem,var(--safe-pad-left))] pr-[max(0.75rem,var(--safe-pad-right))]"
    >
      {/* Pointer shortcut only: Escape and the close button serve everyone else. */}
      <div data-modal-backdrop aria-hidden="true" className="absolute inset-0" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal={!isConfirmOpen}
        aria-hidden={isConfirmOpen ? 'true' : undefined}
        aria-labelledby={titleId}
        className="panel-mystic relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] rounded-none sm:rounded-3xl overflow-hidden p-0 focus:outline-hidden"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <AmberStarfield />

        <CloseButton
          ref={closeButtonRef}
          label="Close saved intentions"
          onClick={onClose}
          className="absolute top-3 right-3 z-20"
        />

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
