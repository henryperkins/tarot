import { useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import FollowUpChat from './FollowUpChat';

export default function FollowUpModal({ isOpen, onClose, isVisible = true, autoFocusInput = true }) {
  const modalRef = useRef(null);
  const titleId = 'follow-up-modal-title';

  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef
  });

  if (!isVisible) return null;
  if (typeof document === 'undefined') return null;

  const overlayClasses = clsx(
    'fixed inset-0 z-[70] flex items-center justify-center bg-main/80 backdrop-blur-sm px-safe pt-safe pb-safe-bottom',
    'transition-opacity duration-200',
    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
  );

  const panelClasses = clsx(
    'relative w-[min(92vw,44rem)] max-h-[85vh] overflow-hidden',
    'panel-mystic rounded-3xl border border-[color:var(--border-warm-light)] shadow-2xl',
    'transition duration-200',
    isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'
  );

  return createPortal(
    <div
      className={overlayClasses}
      aria-hidden={!isOpen}
      onClick={createBackdropHandler(onClose)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClasses}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        inert={!isOpen ? '' : undefined}
      >
        <div className="p-5 sm:p-6">
          <FollowUpChat
            variant="modal"
            isActive={isOpen}
            onClose={onClose}
            titleId={titleId}
            autoFocusInput={autoFocusInput}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
