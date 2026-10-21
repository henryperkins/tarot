import { useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Sparkle, X } from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { FOCUS_RING_ACCENT_50, FOCUS_RING_OFFSET_MAIN } from '../../styles/focusClasses';

export const VISUAL_COMPANION_MODAL_TITLE_ID = 'visual-companion-modal-title';
const DESCRIPTION_ID = 'visual-companion-modal-description';

/**
 * Dialog shell for the Visual Companion Studio.
 *
 * The caller mounts the studio on its first explicit open. It then toggles
 * visibility so closing preserves the user's artwork, settings and any manual
 * generation already in progress. Mounting never starts generation by itself.
 */
export function VisualCompanionModal({
  isOpen,
  onClose,
  modeLabel,
  message,
  splitLayout = false,
  nestedOverlayOpen = false,
  children
}) {
  const modalRef = useRef(null);

  // Children render their own dialogs (AnimatedReveal's expanded video,
  // StoryIllustration's upgrade prompt). Yield Escape and the focus trap to them
  // while one is open, the way SavedIntentionsModal yields to its ConfirmModal.
  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    trapFocus: !nestedOverlayOpen,
    closeOnEscape: !nestedOverlayOpen
  });

  if (typeof document === 'undefined') return null;

  // Keep children mounted, but remove the closed studio from layout and focus.
  // WebKit can leave descendant visibility transitions hidden after opening,
  // so toggle display instead of inherited visibility.
  const overlayClasses = clsx(
    'fixed inset-0 z-70 items-stretch sm:items-center justify-center bg-main/80 backdrop-blur-sm',
    'p-0 sm:p-4 px-safe pt-safe pb-safe transition-opacity duration-200',
    isOpen ? 'flex opacity-100 pointer-events-auto' : 'hidden opacity-0 pointer-events-none'
  );

  const panelClasses = clsx(
    'relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] flex-col overflow-hidden',
    'panel-mystic rounded-none sm:rounded-3xl border border-(--border-warm-light) shadow-2xl',
    'p-0! focus:outline-hidden transition duration-200',
    isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'
  );

  return createPortal(
    <div
      className={overlayClasses}
      aria-hidden={!isOpen}
    >
      {/* Pointer shortcut only: Escape and the close button serve everyone else. */}
      <div data-modal-backdrop aria-hidden="true" className="absolute inset-0" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal={!nestedOverlayOpen}
        aria-labelledby={VISUAL_COMPANION_MODAL_TITLE_ID}
        aria-describedby={DESCRIPTION_ID}
        className={panelClasses}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        inert={!isOpen || undefined}
      >
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            'absolute top-[min(.75rem,12px)] right-[min(.75rem,12px)] z-20 p-[min(.5rem,8px)] min-w-touch min-h-touch flex items-center justify-center',
            'text-muted hover:text-main hover:bg-surface-muted/60 rounded-full transition-colors touch-manipulation',
            FOCUS_RING_ACCENT_50,
            FOCUS_RING_OFFSET_MAIN
          )}
          aria-label="Close visual companion studio"
        >
          <X className="h-[min(1.25rem,20px)] w-[min(1.25rem,20px)]" aria-hidden="true" />
        </button>

        <div
          role="region"
          aria-label="Visual companion studio content"
          tabIndex={0}
          className="relative z-10 flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain scroll-pt-[min(3.5rem,56px)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
        >
          <div className="relative min-w-0 wrap-anywhere px-[min(1rem,16px)] sm:px-6 py-[min(1rem,16px)] sm:py-4 pr-[min(3.5rem,56px)] sm:pr-16 border-b border-secondary/25">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2
                id={VISUAL_COMPANION_MODAL_TITLE_ID}
                className="min-w-0 max-w-full text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight"
              >
                <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-secondary" aria-hidden="true" />
                <span className="min-w-0">Visual Companion Studio</span>
              </h2>
              {modeLabel ? (
                <span className="max-w-full rounded-full border border-secondary/40 bg-surface/70 px-3 py-1 text-sm font-semibold uppercase tracking-[0.08em] text-muted">
                  {modeLabel}
                </span>
              ) : null}
            </div>
            <p id={DESCRIPTION_ID} className="wrap-anywhere text-sm text-muted mt-2">{message}</p>
          </div>

          <div
            className={clsx(
              'relative p-[min(1rem,16px)] sm:p-[min(1.5rem,24px)] grid gap-4 content-start',
              splitLayout ? 'lg:grid-cols-2' : ''
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

VisualCompanionModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  modeLabel: PropTypes.string,
  message: PropTypes.string,
  splitLayout: PropTypes.bool,
  nestedOverlayOpen: PropTypes.bool,
  children: PropTypes.node
};

export default VisualCompanionModal;
