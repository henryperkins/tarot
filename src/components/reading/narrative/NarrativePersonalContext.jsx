import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useModalA11y } from '../../../hooks/useModalA11y';
import { buildReadingPersonalContext } from '../../../lib/readingPersonalContext.js';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './narrativeFocusContext.js';
import '../../../styles/narrative-card-touch.css';

/** Original inputs remain available independently of any current visual cue. */
export function NarrativePersonalContext({ question = '', reflections = null, cards = [] }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const { user, isAuthenticated } = useAuth();
  const context = useMemo(() => buildReadingPersonalContext({ question, reflections, cards }), [question, reflections, cards]);
  const identity = JSON.stringify([isAuthenticated ? user?.id : null,
    focus?.gestureSource?.runId, focus?.gestureSource?.sourceRevision, context]);
  const [openedIdentity, setOpenedIdentity] = useState(null);
  const active = openedIdentity !== null && openedIdentity === identity;
  const close = useCallback(() => setOpenedIdentity(null), []);
  const openerRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const dialogId = useId();

  // Invalidate on the render that changes source/owner/inputs. Prose arrival
  // does not enter this identity and cannot close the reader's disclosure.
  if (openedIdentity !== null && openedIdentity !== identity) setOpenedIdentity(null);
  useLayoutEffect(() => {
    if (!active || !api) return undefined;
    api.reportInspection({ kind: 'personal-context-dialog', active: true });
    return () => api.reportInspection({ kind: 'personal-context-dialog', active: false });
  }, [active, api]);
  useModalA11y(active, {
    onClose: close,
    containerRef: dialogRef,
    returnFocusRef: openerRef,
    initialFocusSelector: '[data-personal-context-close]',
    scrollLockStrategy: 'simple',
    isolateBackground: true
  });

  return <>
    <button ref={openerRef} type="button" className="reading-personal-context__trigger"
      aria-haspopup="dialog" aria-expanded={active} aria-controls={active ? dialogId : undefined}
      onClick={() => setOpenedIdentity(identity)}>Your question and notes</button>
    {active && typeof document !== 'undefined' ? createPortal(
      <div className="reading-personal-context__overlay">
        <div data-modal-backdrop aria-hidden="true" className="reading-personal-context__backdrop" onClick={close} />
        <section ref={dialogRef} id={dialogId} role="dialog" aria-modal="true" aria-labelledby={titleId}
          className="reading-personal-context__dialog" tabIndex={-1}>
          <div className="reading-personal-context__header">
            <h2 id={titleId}>Your question and notes</h2>
            <button type="button" data-personal-context-close aria-label="Close question and notes"
              className="reading-personal-context__close" onClick={close}>Close</button>
          </div>
          <div className="reading-personal-context__scroll" data-personal-context-scroll
            role="region" aria-label="Original question and notes" tabIndex={0}>
            {context.question ? <section className="reading-personal-context__entry">
              <h3>Your question</h3>
              <p data-personal-context-question>{context.question}</p>
            </section> : null}
            {context.notes.map(note => <section key={note.id} className="reading-personal-context__entry"
              data-spread-index={note.spreadIndex ?? undefined}>
              <h3>{note.label}</h3>
              <p data-personal-context-note>{note.text}</p>
            </section>)}
          </div>
        </section>
      </div>, document.body
    ) : null}
  </>;
}
