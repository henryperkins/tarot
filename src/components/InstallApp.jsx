import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Export, Plus, X } from '@phosphor-icons/react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { createBackdropHandler, useModalA11y } from '../hooks/useModalA11y';

const DEFAULT_FOCUS_SELECTOR = '[aria-label="Primary navigation"] button';

function HomeScreenInstructions({ onClose, returnFocusRef, fallbackFocusSelector }) {
  const containerRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalA11y(true, {
    onClose,
    containerRef,
    initialFocusRef: closeRef,
    returnFocusRef,
    fallbackFocusSelector,
    isolateBackground: true
  });

  return createPortal(
    <div
      className="fixed inset-0 z-auth flex items-center justify-center overflow-y-auto bg-main/90 p-4 pt-[max(1rem,var(--safe-pad-top))] pb-[max(1rem,var(--safe-pad-bottom))] pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))]"
      onClick={createBackdropHandler(onClose)}
    >
      <section
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-secondary/40 bg-surface p-4 text-main shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <img src="/icons/icon-maskable-512.png" width="48" height="48" alt="" className="rounded-xl" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close home-screen instructions"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="mt-4 font-serif text-xl text-main">Add Tableu to your Home Screen</h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted">Keep your reading room one tap away on your iPhone or iPad.</p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>Open Tableu in <strong>Safari</strong>.</li>
          <li>Tap <strong>Share</strong> <Export className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />. You may find it under the <strong>More (…)</strong> menu.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
        </ol>
        <p className="mt-5 text-sm leading-relaxed text-muted">If the option is missing, scroll down in the Share menu and choose Edit Actions to add it.</p>
      </section>
    </div>,
    document.body
  );
}

export function InstallApp({ compact = false, fallbackFocusSelector = DEFAULT_FOCUS_SELECTOR }) {
  const { canPrompt, isIOS, isInstalled, isPrompting, error, requestInstall } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);
  const buttonRef = useRef(null);
  const installFocusRef = useRef(null);
  const closeInstructions = useCallback(() => setShowInstructions(false), []);

  // Native prompts consume their button. Restore a keyboard user's place after
  // React removes it, unless they have already focused another control.
  useLayoutEffect(() => {
    if (isPrompting || !installFocusRef.current) return;
    const { ownedFocus } = installFocusRef.current;
    const target = document.querySelector(fallbackFocusSelector) || document.querySelector(DEFAULT_FOCUS_SELECTOR);
    installFocusRef.current = null;
    if (ownedFocus && document.activeElement === document.body && target?.isConnected) {
      target.focus({ preventScroll: true });
    }
  }, [canPrompt, isPrompting, isInstalled, error, fallbackFocusSelector]);

  const handleInstall = () => {
    if (isIOS) {
      setShowInstructions(true);
      return;
    }
    const button = buttonRef.current;
    installFocusRef.current = {
      ownedFocus: document.activeElement === button
    };
    requestInstall();
  };

  if (isInstalled || (!isIOS && !canPrompt && !isPrompting && !error)) return null;

  return (
    <div data-pwa-install-slot={compact || undefined} className={`flex max-w-full flex-wrap items-center gap-2 ${compact ? 'h-11 w-11 shrink-0 self-end' : ''}`}>
      {(isIOS || canPrompt || isPrompting) && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleInstall}
          disabled={isPrompting}
          aria-busy={isPrompting || undefined}
          aria-haspopup={isIOS ? 'dialog' : undefined}
          aria-label={isIOS ? 'Add to Home Screen' : 'Install Tableu'}
          title={isIOS ? 'Add to Home Screen' : 'Install Tableu'}
          data-pwa-install
          className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-main disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main ${compact ? 'h-11 w-11' : 'px-2 py-2 text-sm font-medium'}`}
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
            <svg viewBox="-10 -10 220 270" className="h-6 w-6">
              <use href="#tableu-favicon" />
            </svg>
            <Plus weight="bold" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-primary" />
          </span>
          {!compact && <span>{isIOS ? 'Home Screen' : 'Install Tableu'}</span>}
        </button>
      )}
      {error && <p role="status" className={`text-sm text-muted ${compact ? 'absolute inset-x-4 bottom-full mb-2 ml-auto max-w-xs rounded-lg border border-secondary/40 bg-surface p-3 shadow-lg' : 'max-w-xs'}`}>{error}</p>}
      {showInstructions && <HomeScreenInstructions onClose={closeInstructions} returnFocusRef={buttonRef} fallbackFocusSelector={fallbackFocusSelector} />}
    </div>
  );
}
