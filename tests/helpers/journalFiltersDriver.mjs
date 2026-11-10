import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const HOOK_URL = new URL('../../src/hooks/useJournalFilters.js', import.meta.url);

// Spread and deck preview labels are UI assets; keep the real filter defaults
// without loading image modules into Node.
async function importConstants(target, specifiers) {
  const source = await readFile(new URL(target, HOOK_URL), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const ranges = [];
  for (const statement of ast.program.body) {
    if (statement.type === 'ImportDeclaration') ranges.push([statement.start, statement.end]);
    else if (statement.type === 'ExportNamedDeclaration') ranges.push([statement.start, statement.declaration.start]);
  }
  let program = source;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  return new Function('SPREADS', 'DECK_OPTIONS', `${program}; return { ${specifiers.join(',')} };`)({}, []);
}

/**
 * Exercise the actual useJournalFilters body with React scheduling and HTTP
 * substituted. `render(true)` also runs the effects queued by that render.
 */
export async function journalFiltersDriver(entries, {
  owner = 'filters-owner',
  cloud = true,
  completeHistory = false,
  fetchImpl = async () => { throw new Error('Unexpected HTTP request'); }
} = {}) {
  const source = await readFile(HOOK_URL, 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const states = [], refs = [], queues = [], effects = [], layouts = [], cleanups = [];
  let stateIndex = 0, refIndex = 0;
  const dependencies = {
    useMemo: callback => callback(), useCallback: callback => callback, useDeferredValue: value => value,
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], update => queues.push(() => { states[index] = typeof update === 'function' ? update(states[index]) : update; })];
    },
    useEffect: effect => effects.push(effect), useLayoutEffect: effect => layouts.push(effect), fetch: fetchImpl
  };
  const removed = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react') continue;
      const target = node.source.value.endsWith('.js') ? node.source.value : `${node.source.value}.js`;
      const names = node.specifiers.map(specifier => specifier.imported.name);
      const imported = target.endsWith('/journal/constants.js')
        ? await importConstants(target, names)
        : await import(new URL(target, HOOK_URL));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
    else if (node.type === 'ExportDefaultDeclaration') removed.push([node.start, node.end]);
  }
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useJournalFilters;`)(...Object.values(dependencies));
  const options = { isAuthenticated: true, canUseCloudJournal: cloud, userId: owner, completeHistory };
  const render = (runEffects = false) => {
    // Render-phase state adjustments re-render, as React does.
    for (let pass = 0; pass < 5; pass += 1) {
      stateIndex = 0; refIndex = 0;
      const result = hook(entries, options);
      if (!queues.length) {
        if (runEffects) {
          for (const effect of [...layouts.splice(0), ...effects.splice(0)]) {
            const cleanup = effect();
            if (cleanup) cleanups.push(cleanup);
          }
        } else { layouts.length = 0; effects.length = 0; }
        return result;
      }
      layouts.length = 0; effects.length = 0;
      while (queues.length) queues.shift()();
    }
    throw new Error('useJournalFilters kept updating during render');
  };
  return {
    render,
    flush: () => { while (queues.length) queues.shift()(); },
    close: () => cleanups.reverse().forEach(cleanup => cleanup())
  };
}
