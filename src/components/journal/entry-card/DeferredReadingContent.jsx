import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

class ReadingContentBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ContentReady({ children, onReady }) {
  useLayoutEffect(onReady, [onReady]);
  return children;
}

function containsSelection(element) {
  const selection = element?.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed) return false;
  // Check the whole range, including selections whose endpoints surround this
  // reading (and backwards or multi-range selections), not just its anchor.
  for (let index = 0; index < selection.rangeCount; index += 1) {
    if (selection.getRangeAt(index).intersectsNode(element)) return true;
  }
  return false;
}

/** Keep the selectable fallback mounted until rich content is ready AND the
 * reader has finished selecting it. Suspense owns only the hidden staging tree. */
export function DeferredReadingContent({ children, fallback }) {
  const fallbackRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showFormatted, setShowFormatted] = useState(false);
  const onReady = useCallback(() => { setReady(true); }, []);
  const onFailure = useCallback(() => { setFailed(true); }, []);

  useEffect(() => {
    if (!ready || failed || showFormatted) return undefined;
    const document = fallbackRef.current?.ownerDocument;
    const promote = () => {
      if (!containsSelection(fallbackRef.current)) setShowFormatted(true);
    };
    document?.addEventListener('selectionchange', promote);
    promote();
    return () => document?.removeEventListener('selectionchange', promote);
  }, [ready, failed, showFormatted]);

  const formatted = showFormatted && !failed;
  return (
    <>
      {failed && (
        <p role="alert" className="mb-3 text-sm leading-relaxed text-(--text-muted)">
          Reading formatting is unavailable. Your saved text is shown below. Reload to try again.
        </p>
      )}
      {!formatted && <div ref={fallbackRef} className="contents">{fallback}</div>}
      <div hidden={!formatted} inert={!formatted || undefined} className={formatted ? 'contents' : 'hidden'}>
        <ReadingContentBoundary onFailure={onFailure}>
          <Suspense fallback={null}><ContentReady onReady={onReady}>{children}</ContentReady></Suspense>
        </ReadingContentBoundary>
      </div>
    </>
  );
}
