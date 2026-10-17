import { createContext, useContext, useState } from 'react';
import { useReadingGestureRuntime } from '../../../hooks/useReadingGestureRuntime.js';
import { FocusStateContext, FocusApiContext } from './narrativeFocusContext.js';

const RuntimeContext = createContext(null);

export function NarrativeGestureGate({ children, ...props }) {
  const enabled = Boolean(props.gestureStudyEnabled);
  const runtime = useReadingGestureRuntime(enabled);
  const [published, publish] = useState(null);
  const identity = props.gestureSource ? `${props.gestureSource.runId}:${props.gestureSource.sourceRevision}` : 'ordinary';
  const current = enabled && published?.identity === identity ? published : null;
  const Engine = runtime?.FocusEngine;
  return <RuntimeContext.Provider value={runtime}>
    <FocusApiContext.Provider value={current?.api || null}>
      <FocusStateContext.Provider value={current?.state || null}>
        {Engine ? <Engine key={identity} {...props} identity={identity} publish={publish} /> : null}
        {children}
      </FocusStateContext.Provider>
    </FocusApiContext.Provider>
  </RuntimeContext.Provider>;
}

export function GatedSpreadCompanion(props) {
  const Component = useContext(RuntimeContext)?.SpreadCompanion;
  return Component ? <Component {...props} /> : null;
}

export function GatedCardTouchPlate(props) {
  const Component = useContext(RuntimeContext)?.CardTouchPlate;
  return Component ? <Component {...props} /> : null;
}
