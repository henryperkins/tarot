import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './narrativeFocusContext.js';

export function GesturePhrase({ node: _node, children, ...props }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const id = props['data-gesture-id'];
  if (!id || !focus?.studyEnabled) return <span {...props}>{children}</span>;
  const association = focus.associations.find((item) => item.id === id);
  if (association?.kind === 'identity' && props['data-gesture-heading'] === 'true') {
    return <span {...props} className="reading-gesture-identity">{children}</span>;
  }
  const target = association?.targets?.length === 1 ? association.targets[0] : null;
  const card = target && focus.cards.find(item => item.occurrenceId === target.occurrenceId);
  const activate = event => {
    if (window.getSelection()?.toString().trim()) return;
    event.currentTarget.focus({ preventScroll: true });
    if (card) {
      // A held cue opens the companion's own mobile dialog. Release it before
      // handing inspection to CardModal so there is only one modal owner.
      api.releaseAssociation();
      api.selectCard(card.index, { gestureId: id, occurrenceId: target.occurrenceId,
        phrase: association.passage?.quote || event.currentTarget.textContent,
        touchIds: target.detailIds || [], triggerElement: event.currentTarget });
    } else api.holdAssociation(id);
  };
  const held = focus.gestureState.held?.kind === 'association' && focus.gestureState.held.id === id;
  const associated = focus.gestureState.current?.id === id && (held || association?.kind !== 'identity');
  // The visible phrase is the control's accessible name (label in name); a
  // separate card or detail label would replace the prose for screen readers.
  return (
    <span {...props} role="button" tabIndex={0} className="reading-gesture-association" aria-pressed={card ? undefined : held}
      aria-haspopup={card ? 'dialog' : undefined}
      data-associated={associated ? 'true' : undefined}
      onClick={activate} onKeyDown={(event) => {
        if (event.key === 'Escape') api.releaseAssociation();
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); }
      }}>
      {children}
    </span>
  );
}
