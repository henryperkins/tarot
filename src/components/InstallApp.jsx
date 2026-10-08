import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Export, Plus, X } from '@phosphor-icons/react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { createBackdropHandler, restoreFocusTarget, useModalA11y } from '../hooks/useModalA11y';
import { useToast } from '../contexts/ToastContext';
import { pwaInstallStore, shouldShowPwaInstall } from '../lib/pwaInstall';
import '../styles/pwa-install.css';

function HomeScreenInstructions({ onClose, onLater, onAlreadyAdded, returnFocusRef, fallbackFocusRef, getFallbackFocus, preventFocusScroll }) {
  const containerRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalA11y(true, {
    onClose,
    containerRef,
    initialFocusRef: closeRef,
    returnFocusRef,
    fallbackFocusRef,
    getFallbackFocus,
    fallbackFocusPreventScroll: preventFocusScroll,
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
        <div className="mt-6 flex flex-wrap gap-2 border-t border-secondary/30 pt-4">
          <button
            type="button"
            onClick={onLater}
            className="inline-flex min-h-touch flex-1 items-center justify-center rounded-xl border border-accent/30 bg-surface-muted px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onAlreadyAdded}
            className="inline-flex min-h-touch flex-1 items-center justify-center rounded-xl border border-accent/30 bg-surface-muted px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            Already added
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">Later pauses this reminder for seven days. Already added hides it on this browser.</p>
      </section>
    </div>,
    document.body
  );
}

export function InstallApp({ fallbackFocusRef, getFallbackFocus, preventFocusScroll = false }) {
  const { canPrompt, isIOS, isInstalled, isPrompting, isSnoozed, hasAddedToHomeScreen, error, requestInstall, snoozeGuidance, dismissGuidance } = usePwaInstall();
  const { publish } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const buttonRef = useRef(null);
  const installFocusRef = useRef(null);
  const closeInstructions = useCallback(() => setShowInstructions(false), []);
  const handleGuidanceChoice = action => {
    setShowInstructions(false);
    const { persisted } = action();
    if (persisted) return;
    publish({
      type: 'info',
      title: 'Hidden for this visit',
      description: 'Your browser could not save this choice. The install control may return when you reopen Tableu.'
    });
  };

  // Native prompts consume their button. Restore a keyboard user's place after
  // React removes it, unless they have already focused another control.
  useLayoutEffect(() => {
    if (isPrompting || !installFocusRef.current) return;
    const { ownedFocus } = installFocusRef.current;
    const target = getFallbackFocus?.() || fallbackFocusRef?.current;
    installFocusRef.current = null;
    if (ownedFocus && document.activeElement === document.body && target?.isConnected) {
      restoreFocusTarget(target, { preventScroll: preventFocusScroll });
    }
  }, [canPrompt, isPrompting, isInstalled, error, fallbackFocusRef, getFallbackFocus, preventFocusScroll]);

  const handleInstall = () => {
    if (isIOS) {
      setShowInstructions(true);
      return;
    }
    const button = buttonRef.current;
    installFocusRef.current = {
      ownedFocus: document.activeElement === button
    };
    // requestInstall calls the native prompt before its first await, preserving
    // this click's activation. Publish a transient error only for this request.
    requestInstall().then(() => {
      if (!pwaInstallStore.getSnapshot().error) return;
      publish({
        type: 'error',
        title: 'Installation could not start',
        description: 'You can add Tableu from your browser menu.'
      });
    });
  };

  if (!shouldShowPwaInstall({ isInstalled, isIOS, canPrompt, isPrompting, isSnoozed, hasAddedToHomeScreen })) return null;

  return (
    <>
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
        className="pwa-install-button inline-flex min-h-touch items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-accent disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
          <img src="/icons/icon-maskable-512.png" width="28" height="28" alt="" className="h-7 w-7 rounded-md" />
          <Plus weight="bold" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-primary" />
        </span>
        <span>{isIOS ? 'Home Screen' : 'Install Tableu'}</span>
      </button>
      {showInstructions && (
        <HomeScreenInstructions
          onClose={closeInstructions}
          onLater={() => handleGuidanceChoice(snoozeGuidance)}
          onAlreadyAdded={() => handleGuidanceChoice(dismissGuidance)}
          returnFocusRef={buttonRef}
          fallbackFocusRef={fallbackFocusRef}
          getFallbackFocus={getFallbackFocus}
          preventFocusScroll={preventFocusScroll}
        />
      )}
    </>
  );
}
