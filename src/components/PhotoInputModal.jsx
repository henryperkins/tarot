import { useRef, useCallback } from 'react';
import { Camera, Images, X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';

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
  const handleBackdropClick = useCallback(createBackdropHandler(onCancel), [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-main/90 backdrop-blur-sm animate-fade-in p-3 xs:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-surface rounded-xl shadow-2xl p-5 xs:p-6 w-full max-w-sm animate-pop-in border border-secondary/30 focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-base xs:text-lg font-semibold text-main">
            Add a Photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-main hover:bg-surface-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onTakePhoto}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-white bg-secondary hover:bg-secondary/90 active:bg-secondary/80 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface touch-manipulation"
          >
            <Camera className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Take Photo</span>
          </button>

          <button
            type="button"
            onClick={onChooseFromLibrary}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-white bg-primary hover:bg-primary/90 active:bg-primary/80 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface touch-manipulation"
          >
            <Images className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Choose from Library</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-4 px-4 py-2.5 min-h-[44px] text-muted hover:text-main border border-secondary/30 hover:border-secondary/50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary touch-manipulation"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
