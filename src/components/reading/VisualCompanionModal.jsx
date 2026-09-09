import { useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Sparkle, X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../../hooks/useModalA11y';
import { FOCUS_RING_ACCENT_50, FOCUS_RING_OFFSET_MAIN } from '../../styles/focusClasses';

export const VISUAL_COMPANION_MODAL_TITLE_ID = 'visual-companion-modal-title';
const DESCRIPTION_ID = 'visual-companion-modal-description';

/**
 * Dialog shell for the Visual Companion Studio.
 *
 * Stays mounted while `shouldShowVisualCompanion` is true and toggles visibility
 * instead of unmounting, the same way FollowUpModal does. That matters here: the
 * studio's children auto-start paid generation on mount, portal the hero
 * background into #app-bg, and poll long-running video jobs with no way to
 * cancel them server-side. Unmounting on close would orphan those jobs and
 * re-trigger generation on every reopen.
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

  // `invisible` (not just opacity-0) is what keeps the closed studio out of the
  // tab order and clear of axe's aria-hidden-focus rule. Transitioning
  // `visibility` alongside opacity defers the flip to the end of the fade.
  const overlayClasses = clsx(
    'fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-main/80 backdrop-blur-sm',
    'p-0 sm:p-4 px-safe pt-safe pb-safe transition-[opacity,visibility] duration-200',
    isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
  );

  const panelClasses = clsx(
    'relative flex w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[min(92vw,56rem)] flex-col overflow-hidden',
    'panel-mystic rounded-none sm:rounded-3xl border border-[color:var(--border-warm-light)] shadow-2xl',
    'p-0 focus:outline-none transition duration-200',
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
            'absolute top-3 right-3 z-20 p-2 min-w-touch min-h-touch flex items-center justify-center',
            'text-muted hover:text-main hover:bg-surface-muted/60 rounded-full transition-colors touch-manipulation',
            FOCUS_RING_ACCENT_50,
            FOCUS_RING_OFFSET_MAIN
          )}
          aria-label="Close visual companion studio"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative z-10 px-4 sm:px-6 py-4 pr-14 sm:pr-16 border-b border-secondary/25">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2
              id={VISUAL_COMPANION_MODAL_TITLE_ID}
              className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight"
            >
              <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" aria-hidden="true" />
              Visual Companion Studio
            </h2>
            {modeLabel ? (
              <span className="rounded-full border border-secondary/40 bg-surface/70 px-3 py-1 text-2xs sm:text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {modeLabel}
              </span>
            ) : null}
          </div>
          <p id={DESCRIPTION_ID} className="text-xs sm:text-sm text-muted mt-2">{message}</p>
        </div>

        <div
          className={clsx(
            'relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 grid gap-4 content-start',
            splitLayout ? 'lg:grid-cols-2' : ''
          )}
        >
          {children}
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
