import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

// Exercise the actual hook body; substitute only React scheduling/auth and HTTP.
export async function journalHookDriver(owner, { cloud = false, hookOptions = {}, fetchImpl = async () => { throw new Error('Unexpected HTTP request'); } } = {}) {
  const url = new URL('../../src/hooks/useJournal.js', import.meta.url);
  const source = await readFile(url, 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const states = [], refs = [], queues = [], effects = [], layouts = [], cleanups = [];
  let stateIndex = 0, refIndex = 0, activeOwner = owner;
  const dependencies = {
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], update => queues.push(() => { states[index] = typeof update === 'function' ? update(states[index]) : update; })];
    },
    useRef: initial => refs[refIndex++] ||= { current: initial },
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect), useLayoutEffect: effect => layouts.push(effect),
    useAuth: () => ({ isAuthenticated: Boolean(activeOwner), user: activeOwner ? { id: activeOwner } : null }),
    useSubscription: () => ({ canUseCloudJournal: cloud }), fetch: fetchImpl
  };
  const removed = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react' || node.source.value.includes('/contexts/')) continue;
      const target = node.source.value.endsWith('.js') ? node.source.value : `${node.source.value}.js`;
      const imported = await import(new URL(target, url));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
  }
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useJournal;`)(...Object.values(dependencies));
  return {
    render() {
      stateIndex = 0; refIndex = 0;
      const result = hook({ autoLoad: false, ...hookOptions });
      for (const effect of [...layouts.splice(0), ...effects.splice(0)]) {
        const cleanup = effect(); if (cleanup) cleanups.push(cleanup);
      }
      return result;
    },
    setOwner: next => { activeOwner = next; },
    flush: () => { while (queues.length) queues.shift()(); },
    close: () => cleanups.reverse().forEach(cleanup => cleanup())
  };
}

export function journalStorageFixture(t) {
  installJournalLocks(t);
  const values = new Map();
  const storage = {
    get length() { return values.size; }, key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)
  };
  for (const [key, value] of [['localStorage', storage], ['window', Object.assign(new EventTarget(), { localStorage: storage })]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
  }
  return { storage, values };
}

// FIFO lock manager substitute; browser E2E covers the native cross-tab API.
export function installJournalLocks(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const pending = new Map();
  const locks = { request(name, _options, operation) {
    const result = (pending.get(name) || Promise.resolve()).then(operation);
    pending.set(name, result.catch(() => {}));
    return result;
  } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; });
  return locks;
}
