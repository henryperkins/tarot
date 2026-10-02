import { Component, Suspense, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../hooks/useModalA11y';

function DialogLoadState({ title, onClose, returnFocusRef, failed = false }) {
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const titleId = useId();
  useModalA11y(true, {
    onClose,
    containerRef,
    initialFocusRef: headingRef,
    returnFocusRef,
    isolateBackground: true
  });

  return createPortal(
    <div className="fixed inset-0 z-auth flex items-center justify-center overflow-y-auto bg-main/90 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-[color:var(--border-warm)] bg-surface p-6 text-main shadow-2xl"
      >
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="font-serif text-xl outline-none">
          {failed ? `Unable to open ${title}` : `Opening ${title}…`}
        </h2>
        <p role={failed ? 'alert' : 'status'} className="mt-3 text-sm text-muted">
          {failed ? 'Check your connection, then reload this page to try again.' : 'Loading…'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-touch rounded-full border border-[color:var(--border-warm)] px-5 py-2 text-sm font-semibold hover:bg-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

class DialogLoadBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Mount only while open; preserve the opener across loading and the real dialog. */
export function DeferredDialog({ component: Dialog, title, onClose, ...props }) {
  const returnFocusRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const loadStateProps = { title, onClose, returnFocusRef };
  return (
    <DialogLoadBoundary fallback={<DialogLoadState {...loadStateProps} failed />}>
      <Suspense fallback={<DialogLoadState {...loadStateProps} />}>
        <Dialog {...props} onClose={onClose} returnFocusRef={returnFocusRef} />
      </Suspense>
    </DialogLoadBoundary>
  );
}
