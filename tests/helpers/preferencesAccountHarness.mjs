import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

// Run the production provider with deterministic hooks/timers, as the tarot
// state harness does. Only React scheduling, auth and browser/service I/O are
// controlled; account reconciliation and persistence use the real modules.
export async function preferencesAccountHarness({ owner = 'owner-a', values = new Map(), sourceOverride } = {}) {
  const url = new URL('../../src/contexts/PreferencesContext.jsx', import.meta.url);
  const source = sourceOverride ?? await readFile(url, 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const cells = [];
  const effects = [];
  const microtasks = [];
  const timers = new Map();
  const reads = [];
  const writes = [];
  const noop = () => {};
  let cursor = 0;
  let dirty = false;
  let timerId = 0;
  let activeOwner = owner;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const memo = (factory, deps) => {
    const index = cursor++;
    if (!cells[index] || deps.some((dep, i) => !Object.is(dep, cells[index].deps[i]))) cells[index] = { deps, value: factory() };
    return cells[index].value;
  };
  const dependencies = {
    createContext: () => ({}),
    useContext: noop,
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => {
        const next = typeof value === 'function' ? value(cells[index]) : value;
        if (!Object.is(next, cells[index])) { cells[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return cells[index] ||= { current: initial }; },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useEffect(run, deps) {
      const index = cursor++;
      const previous = cells[index];
      if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        cells[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = run(); });
      }
    },
    useAuth: () => ({ user: activeOwner ? { id: activeOwner } : null, loading: false }),
    safeStorage: storage,
    safeSessionStorage: storage,
    migrateLegacyPersonalization: () => null,
    REVERSAL_FRAMEWORK_KEYS: [],
    MAJOR_ARCANA: Array(22),
    getDeckPool: () => Array(78),
    initAudio: noop,
    cleanupAudio: noop,
    stopTTS: noop,
    toggleAmbience: noop,
    normalizeTtsProvider: value => value || 'default',
    fetchAccountPreferences() {
      const request = { ...deferred(), owner: activeOwner };
      reads.push(request);
      return request.promise;
    },
    saveAccountPreferences(payload) {
      const request = { ...deferred(), owner: activeOwner, payload };
      writes.push(request);
      return request.promise;
    },
    queueMicrotask: run => microtasks.push(run),
    setTimeout(run, delay) { const id = ++timerId; timers.set(id, { run, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  };
  const changes = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      changes.push([node.start, node.end, '']);
      if (!/personalizationConstants|accountPreferences|personalizationStorage/.test(node.source.value)) continue;
      const relative = node.source.value.endsWith('.js') ? node.source.value : `${node.source.value}.js`;
      const imported = await import(new URL(relative, url));
      for (const specifier of node.specifiers) if (!(specifier.local.name in dependencies)) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') {
      changes.push([node.start, node.declaration.start, '']);
      if (node.declaration.id.name === 'PreferencesProvider') {
        const result = node.declaration.body.body.findLast(statement => statement.type === 'ReturnStatement');
        changes.push([result.start, result.end, 'return value;']);
      }
    }
  }
  let program = source;
  for (const [start, end, replacement] of changes.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + replacement + program.slice(end);
  const provider = new Function(...Object.keys(dependencies), `${program}; return PreferencesProvider;`)(...Object.values(dependencies));
  const render = () => {
    let state;
    let iterations = 0;
    do {
      if (++iterations > 30) throw new Error('Preferences provider did not settle');
      cursor = 0;
      dirty = false;
      state = provider({ children: null });
      for (const effect of effects.splice(0)) effect();
      for (const microtask of microtasks.splice(0)) microtask();
    } while (dirty);
    return state;
  };
  return {
    render, values, reads, writes,
    setOwner(next) { activeOwner = next; return render(); },
    async settle() { for (let i = 0; i < 4; i++) { await Promise.resolve(); render(); } return render(); },
    flushPush() { for (const [id, timer] of [...timers]) if (timer.delay === 700) { timers.delete(id); timer.run(); } },
    origins(ownerId = owner) { return JSON.parse(values.get(`tarot-personalization:${ownerId}:account-origins`) || '{}'); }
  };
}
