import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from '@babel/parser';

// Execute the real hook with lifecycle and browser-history boundaries. The
// listener registered first represents BrowserRouter reading location on POP.
async function historyDriver() {
  const source = await readFile(new URL('../src/hooks/useAndroidBackGuard.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const edits = ast.program.body.flatMap(node => node.type === 'ImportDeclaration'
    ? [[node.start, node.end]] : node.type === 'ExportNamedDeclaration' ? [[node.start, node.declaration.start]] : []);
  let program = source;
  for (const [start, end] of edits.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const entries = [
    { url: 'https://example.invalid/pricing', state: { idx: 0, key: 'pricing' } },
    { url: 'https://example.invalid/account#subscription', state: { idx: 1, key: 'account' } }
  ];
  let position = 1;
  let timerId = 0;
  const timers = new Map();
  const frames = [];
  const listeners = [];
  const cleanups = [];
  const routerPops = [];
  const document = { title: 'Account', body: { id: 'body', isConnected: true } };
  const previousFocus = { id: 'subscription-heading', isConnected: true,
    focus() { document.activeElement = this; }, blur() { document.activeElement = document.body; } };
  document.activeElement = previousFocus;
  let scrollX = 0;
  let scrollY = 800;
  const history = {
    get state() { return entries[position].state; },
    pushState(state, unused, url) {
      const next = url == null ? entries[position].url : new URL(url, entries[position].url).href;
      entries.splice(position + 1, entries.length, { url: next, state });
      position += 1;
    },
    replaceState(state, unused, url) {
      entries[position] = { state, url: url == null ? entries[position].url : new URL(url, entries[position].url).href };
    },
    back() {
      position -= 1;
      window.dispatchEvent();
      // Native persisted-user-state restoration follows the POP event.
      document.activeElement = previousFocus;
      scrollY = 800;
    }
  };
  const window = {
    history,
    get location() { return new URL(entries[position].url); },
    get scrollX() { return scrollX; },
    get scrollY() { return scrollY; },
    scrollTo(x, y) { scrollX = x; scrollY = y; },
    addEventListener(type, callback) { if (type === 'popstate') listeners.push({ callback }); },
    dispatchEvent() { for (const { callback } of [...listeners]) callback(); }
  };
  window.addEventListener('popstate', () => routerPops.push({ href: window.location.href, state: history.state }));
  const dependencies = {
    window, document,
    useRef: value => ({ current: value }), useHandsetLayout: () => true,
    useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => frames.push(callback),
    PopStateEvent: class { constructor(type, options) { this.type = type; this.state = options.state; } }
  };
  const useGuard = new Function(...Object.keys(dependencies), `${program}; return useAndroidBackGuard;`)(...Object.values(dependencies));
  useGuard(true, { enabled: true, guardId: 'account-profile', onBack() {} });
  return {
    window, history, routerPops, document,
    close() {
      cleanups.reverse().forEach(cleanup => cleanup());
      while (timers.size) {
        const pending = [...timers.values()];
        timers.clear();
        pending.forEach(callback => callback());
      }
      frames.splice(0).forEach(callback => callback());
    }
  };
}

test('closing a guard synchronizes the latest section and state with earlier router pop listeners', async () => {
  const driver = await historyDriver();
  const guard = driver.history.state.tableuOverlayGuard;
  driver.history.replaceState({ idx: 1, key: 'audio', usr: { source: 'section-jump' }, tableuOverlayGuard: guard }, '', '/account#audio');
  driver.close();
  assert.equal(driver.window.location.hash, '#audio');
  assert.deepEqual(driver.history.state, { idx: 1, key: 'audio', usr: { source: 'section-jump' } });
  assert.equal(driver.routerPops.at(-1).href, 'https://example.invalid/account#audio');
  assert.equal(driver.routerPops.at(-1).state.tableuOverlayGuard, undefined);
  driver.history.back();
  assert.equal(driver.window.location.pathname, '/pricing');
});

test('guard cleanup preserves current focus and scroll after native history restoration', async () => {
  const driver = await historyDriver();
  driver.history.replaceState(driver.history.state, '', '/account#audio');
  driver.document.activeElement = driver.document.body;
  driver.window.scrollTo(0, 250);
  driver.close();
  assert.equal(driver.document.activeElement.id, 'body');
  assert.equal(driver.window.scrollY, 250);
});

test('closing an unchanged overlay removes its entry without leaving an extra Back stop', async () => {
  const driver = await historyDriver();
  driver.close();
  assert.equal(driver.window.location.hash, '#subscription');
  assert.deepEqual(driver.history.state, { idx: 1, key: 'account' });
  driver.history.back();
  assert.equal(driver.window.location.pathname, '/pricing');
});
