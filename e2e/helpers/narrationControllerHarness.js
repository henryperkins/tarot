import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider } from '../../src/contexts/AuthContext.jsx';
import { PreferencesProvider } from '../../src/contexts/PreferencesContext.jsx';
import { useAudioController } from '../../src/hooks/useAudioController.js';

export function mountNarrationControllerHarness() {
  let controller;
  function Probe() {
    controller = useAudioController();
    return null;
  }
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  flushSync(() => root.render(React.createElement(AuthProvider, null,
    React.createElement(PreferencesProvider, null, React.createElement(Probe)))));
  return { get controller() { return controller; }, close() { root.unmount(); element.remove(); } };
}
