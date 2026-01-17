import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { AmberStarfield } from './AmberStarfield';
import { SavedIntentionsList } from './SavedIntentionsList.jsx';

export function SavedIntentionsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = 'saved-intentions-modal-title';

  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    initialFocusRef: closeButtonRef
  });

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
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] rounded-none sm:rounded-3xl overflow-hidden border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)] focus:outline-none"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <AmberStarfield />

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-amber-100/70 hover:text-amber-50 hover:bg-amber-200/10 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 touch-manipulation"
          aria-label="Close saved intentions"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 pr-14 sm:pr-16">
          <SavedIntentionsList titleId={titleId} variant="modal" emptyState="message" />
        </div>
      </div>
    </div>,
    document.body
  );
}
