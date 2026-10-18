import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const personalizationModule = build({
  entryPoints: [fileURLToPath(new URL('../../src/utils/personalization.js', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node'
}).then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`));

// Run the production hook and real pure dependencies with deterministic React
// scheduling and timers. Contexts, storage, audio and haptics stay local.
export async function tarotStateHarness({ owner = 'owner-a', preferences = {}, snapshot = null } = {}) {
  const url = new URL('../../src/hooks/useTarotState.js', import.meta.url);
  const source = await readFile(url, 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const cells = [];
  const pendingEffects = [];
  const timers = new Map();
  let cursor = 0;
  let dirty = false;
  let timerId = 0;
  let authLoading = false;
  let activeOwner = owner;
  const prefs = { includeMinors: false, deckSize: 22, personalization: { showRitualSteps: false, preferredSpreadDepth: 'standard' }, ...preferences };
  const subscription = { canUseSpread: () => true };
  const noop = () => {};
  const effect = (run, deps) => {
    const index = cursor++;
    const previous = cells[index];
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      cells[index] = { deps, cleanup: previous?.cleanup };
      pendingEffects.push(() => {
        cells[index].cleanup?.();
        cells[index].cleanup = run();
      });
    }
  };
  const dependencies = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => {
        const next = typeof value === 'function' ? value(cells[index]) : value;
        if (!Object.is(next, cells[index])) { cells[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return cells[index] ||= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!cells[index] || deps.some((value, i) => !Object.is(value, cells[index].deps[i]))) cells[index] = { callback, deps };
      return cells[index].callback;
    },
    useEffect: effect,
    useLayoutEffect: effect,
    usePreferences: () => prefs,
    useSubscription: () => ({ subscription, loading: false }),
    useAuth: () => ({ user: activeOwner ? { id: activeOwner } : null, loading: authLoading }),
    useHaptic: () => ({ vibrate: noop }),
    playFlip: noop,
    unlockAudio: noop,
    setTimeout(run, delay) { const id = ++timerId; timers.set(id, { run, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: noop
  };
  const removed = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react' || /contexts|useHaptic|\/audio/.test(node.source.value)) continue;
      const relative = node.source.value.endsWith('.js') ? node.source.value : `${node.source.value}.js`;
      const imported = relative.endsWith('/personalization.js') ? await personalizationModule : await import(new URL(relative, url));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
  }
  dependencies.loadReadingSnapshot = () => snapshot;
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useTarotState;`)(...Object.values(dependencies));
  const render = () => {
    let result;
    let iterations = 0;
    do {
      if (++iterations > 20) throw new Error('Hook did not settle');
      cursor = 0; dirty = false;
      result = hook();
      for (const run of pendingEffects.splice(0)) run();
    } while (dirty);
    return result;
  };
  return {
    render,
    preferences: prefs,
    setOwner(next) { activeOwner = next; },
    setAuthLoading(next) { authLoading = next; },
    pendingShuffle() { return [...timers.values()].find(timer => timer.delay === 1200)?.run; },
    unmount() { for (const cell of cells) cell?.cleanup?.(); }
  };
}
