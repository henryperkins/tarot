import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useKeyboardOffset, useVisibleViewport } from '../../src/hooks/useKeyboardOffset.js';

const geometry = { height: innerHeight, offsetTop: 0, scale: 1 };
for (const name of Object.keys(geometry)) {
  Object.defineProperty(visualViewport, name, { configurable: true, get: () => geometry[name] });
}

function KeyboardProbe() {
  const offset = useKeyboardOffset();
  return React.createElement('output', { 'data-testid': 'keyboard-offset' }, String(offset));
}

function VisibleProbe() {
  const viewport = useVisibleViewport(true);
  return React.createElement('output', { 'data-testid': 'visible-viewport' }, JSON.stringify(viewport));
}

const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(React.createElement(React.StrictMode, null,
  React.createElement(KeyboardProbe), React.createElement(VisibleProbe))));

window.keyboardViewportTest = {
  change(next, event = 'resize') {
    Object.assign(geometry, next);
    visualViewport.dispatchEvent(new Event(event));
  },
  unmount() { flushSync(() => root.unmount()); }
};
