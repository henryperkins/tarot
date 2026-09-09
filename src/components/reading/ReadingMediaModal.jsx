import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from '@phosphor-icons/react';
import { MediaGallery } from '../MediaGallery';
import { useModalA11y, createBackdropHandler } from '../../hooks/useModalA11y';
import { FOCUS_RING_ACCENT_50, FOCUS_RING_OFFSET_MAIN } from '../../styles/focusClasses';

export const READING_MEDIA_MODAL_TITLE_ID = 'reading-media-modal-title';
const DESCRIPTION_ID = 'reading-media-modal-description';

/**
 * Dialog wrapper for the saved media gallery.
 *
 * Unlike the visual companion, this one mounts on open: the gallery is purely
 * presentational and its fetch lives upstream in useReadingMediaGallery, so
 * nothing is delayed by deferring the render.
 */
export function ReadingMediaModal({
  isOpen,
  onClose,
  items,
  totalItems,
  loading,
  error,
  onRefresh,
  onDelete
}) {
  const modalRef = useRef(null);

  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef
  });

  // Refresh disables itself while loading and Remove unmounts its own row, so
  // the focused control can disappear and drop focus to <body> — outside the
  // container useModalA11y measures its Tab trap against. Pull it back in.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body && modalRef.current) {
          modalRef.current.focus({ preventScroll: true });
        }
      });
    };
    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-main/80 backdrop-blur-sm animate-fade-in p-0 sm:p-4 px-safe pt-safe pb-safe"
      onClick={createBackdropHandler(onClose)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={READING_MEDIA_MODAL_TITLE_ID}
        aria-describedby={DESCRIPTION_ID}
        className="relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] flex-col overflow-hidden panel-mystic rounded-none sm:rounded-3xl border border-[color:var(--border-warm-light)] shadow-2xl p-0 focus:outline-none"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            'absolute top-3 right-3 z-20 p-2 min-w-touch min-h-touch flex items-center justify-center',
            'text-muted hover:text-main hover:bg-surface-muted/60 rounded-full transition-colors touch-manipulation',
            FOCUS_RING_ACCENT_50,
            FOCUS_RING_OFFSET_MAIN
          )}
          aria-label="Close recent media"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative z-10 px-4 sm:px-6 py-4 pr-14 sm:pr-16 border-b border-secondary/25">
          <h2
            id={READING_MEDIA_MODAL_TITLE_ID}
            className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent leading-tight"
          >
            Recent media
          </h2>
          <p id={DESCRIPTION_ID} className="text-xs sm:text-sm text-muted mt-2">
            Saved visuals from this reading flow.
          </p>
        </div>

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <MediaGallery
            variant="modal"
            items={items}
            totalItems={totalItems}
            loading={loading}
            error={error}
            onRefresh={onRefresh}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

ReadingMediaModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  items: PropTypes.array,
  totalItems: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func,
  onDelete: PropTypes.func
};

export default ReadingMediaModal;
