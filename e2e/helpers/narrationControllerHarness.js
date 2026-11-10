import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider } from '../../src/contexts/AuthContext.jsx';
import { PreferencesProvider, usePreferences } from '../../src/contexts/PreferencesContext.jsx';
import { useAudioController } from '../../src/hooks/useAudioController.js';

export function mountNarrationControllerHarness() {
  let controller;
  let preferences;
  function Probe() {
    controller = useAudioController();
    preferences = usePreferences();
    return null;
  }
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  flushSync(() => root.render(React.createElement(AuthProvider, null,
    React.createElement(PreferencesProvider, null, React.createElement(Probe)))));
  return { get controller() { return controller; }, get preferences() { return preferences; }, close() { root.unmount(); element.remove(); } };
}
