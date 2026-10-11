import { useLayoutEffect } from 'react';
import { NarrativeCardFocusProvider } from './NarrativeCardFocus';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './narrativeFocusContext.js';
export { SpreadCompanion, CardTouchPlate } from './SpreadCompanion';
// eslint-disable-next-line react-refresh/only-export-components -- One gated runtime entry includes its pure Markdown helpers.
export { buildCardLinkCatalog, remarkCardLinks } from '../../../lib/narrativeCardLinks.js';

function PublishFocus({ publish, identity }) {
  const state = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  useLayoutEffect(() => { publish({ state, api, identity }); }, [state, api, identity, publish]);
  return null;
}

// The engine mounts alongside the prose, rather than replacing its ancestry
// when the chunk arrives. Existing text selections and focused DOM survive.
export function FocusEngine({ publish, identity, ...props }) {
  return <NarrativeCardFocusProvider {...props}>
    <PublishFocus publish={publish} identity={identity} />
  </NarrativeCardFocusProvider>;
}
