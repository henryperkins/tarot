import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './narrativeFocusContext.js';

export function GesturePhrase({ node: _node, children, ...props }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const id = props['data-gesture-id'];
  if (!id || !focus?.studyEnabled) return <span {...props}>{children}</span>;
  const association = focus.associations.find((item) => item.id === id);
  // Identity establishes presence automatically; the shelf already offers
  // whole-card inspection without turning every card name into a control.
  if (association?.kind === 'identity') return <span {...props} className="reading-gesture-identity">{children}</span>;
  const held = focus.gestureState.held?.kind === 'association' && focus.gestureState.held.id === id;
  const associated = focus.gestureState.current?.id === id && (held || association?.kind !== 'identity');
  // The visible phrase is the control's accessible name (label in name); a
  // separate card or detail label would replace the prose for screen readers.
  return (
    <span {...props} role="button" tabIndex={0} className="reading-gesture-association" aria-pressed={held}
      data-associated={associated ? 'true' : undefined}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        api.holdAssociation(id);
      }} onKeyDown={(event) => {
        if (event.key === 'Escape') api.releaseAssociation();
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); api.holdAssociation(id); }
      }}>
      {children}
    </span>
  );
}

