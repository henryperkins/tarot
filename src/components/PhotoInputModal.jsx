import { useRef, useMemo } from 'react';
import { Camera, Images } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { CloseButton } from './CloseButton';

export function PhotoInputModal({ onTakePhoto, onChooseFromLibrary, onCancel }) {
  const modalRef = useRef(null);
  const titleId = 'photo-input-modal-title';

  // Shared modal accessibility: scroll lock, escape key, focus trap, focus restoration
  // This modal is always open when rendered, so isOpen is always true
  useModalA11y(true, {
    onClose: onCancel,
    containerRef: modalRef,
    scrollLockStrategy: 'fixed',
  });

  // Handle backdrop click using shared helper
  // useMemo is appropriate here since createBackdropHandler returns a function
  const handleBackdropClick = useMemo(() => createBackdropHandler(onCancel), [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-main/90 backdrop-blur-sm animate-fade-in p-3 xs:p-4 pt-[max(0.75rem,var(--safe-pad-top))] pb-[max(0.75rem,var(--safe-pad-bottom))] pl-[max(0.75rem,var(--safe-pad-left))] pr-[max(0.75rem,var(--safe-pad-right))]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-surface rounded-xl shadow-2xl p-5 xs:p-6 w-full max-w-sm animate-pop-in border border-secondary/30 focus:outline-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-base xs:text-lg font-semibold text-main">
            Add a Photo
          </h3>
          <CloseButton label="Close" onClick={onCancel} className="-mr-2" />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onTakePhoto}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-cta text-surface bg-secondary hover:bg-secondary/90 active:bg-secondary/80 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface touch-manipulation"
          >
            <Camera className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Take Photo</span>
          </button>

          <button
            type="button"
            onClick={onChooseFromLibrary}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-cta text-surface bg-primary hover:bg-primary/90 active:bg-primary/80 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface touch-manipulation"
          >
            <Images className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Choose from Library</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-4 px-4 py-2.5 min-h-touch text-muted hover:text-main border border-secondary/30 hover:border-secondary/50 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary touch-manipulation"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
