import { NARRATIVE_FOCUS_TARGET_ID, registerNarrativeFocusTarget } from '../../../lib/narrativeFocusTarget';

export function NarrativePanelHeader() {
  return (
    <div className="reading-screen__header">
      <h2 id={NARRATIVE_FOCUS_TARGET_ID} ref={registerNarrativeFocusTarget} tabIndex={-1} data-reading-focus-target className="reading-screen__title">
        Your reading
      </h2>
    </div>
  );
}
