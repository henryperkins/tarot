import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { setCachedNarrative } from '../src/lib/safeStorage.js';
import { persistJournalWithVisualFallback, writeVisualResume } from '../src/lib/readingVisualStorage.js';
import { saveCoachRecommendation } from '../src/lib/journalInsights.js';
import { installJournalLocks } from './helpers/journalHookDriver.mjs';

const ownerKeys = owner => ['tarot_journal', 'tarot_journal_cache', 'tarot_journal_insights',
  'tarot_coach_recommendation', 'tarot_coach_stats_snapshot'].map(prefix => `${prefix}_${owner}`);
const savedValue = owner => JSON.stringify([{ id: `saved-${owner}`, personalReading: `${owner} saved prose and cues`, cards: [] }]);
function storageFixture(t, owner) {
  installJournalLocks(t);
  const values = new Map();
  const storage = { get length() { return values.size; }, key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key) };
  for (const id of [owner, 'other-owner', 'anon']) {
    ownerKeys(id).forEach(key => storage.setItem(key, savedValue(id)));
    storage.setItem(`tarot_visual_resume:user:${encodeURIComponent(id)}:result`, 'private handle');
  }
  storage.setItem('tarot_journal', 'guest prose');
  storage.setItem('tarot_journal_insights', 'legacy guest insights');
  storage.setItem('tarot_visual_resume:anon:result', 'guest handle');
  storage.setItem('journey_narrative_cache', JSON.stringify({ [`${owner}:season`]: { narrative: 'deleted prose' },
    'other-owner:season': { narrative: 'other prose' }, 'anon:season': { narrative: 'guest prose' } }));
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const window = new EventTarget(); window.localStorage = storage;
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
  });
  return { storage, values };
}

// Execute the actual account callback rather than matching implementation text.
// React/router dependencies and the HTTP response are injected at its boundary.
async function deleteAction(dependencies) {
  const source = await readFile(new URL('../src/pages/AccountPage.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let callback;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'handleDeleteAccount') callback = node.init.arguments[0];
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value);
    }
  }
  visit(ast);
  assert.ok(callback, 'account deletion callback exists');
  const names = Object.keys(dependencies);
  return new Function(...names, `return (${source.slice(callback.start, callback.end)});`)(...Object.values(dependencies));
}
async function deletionHelpers() {
  try { return await import('../src/lib/deletedAccountStorage.js'); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('confirmed account deletion purges only its owner before authentication refresh settles', async t => {
  const owner = 'confirmed-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_visual_resume:user:${owner}:entry:replay`, 'private replay handle');
  const helpers = await deletionHelpers();
  let finishAuth;
  const auth = new Promise(resolve => { finishAuth = resolve; });
  let authCalls = 0;
  const notices = [];
  const action = await deleteAction({ deleteLoading: false, user: { id: owner }, setDeleteLoading() {},
    fetch: async () => Response.json({ success: true }),
    logout: async () => { storage.removeItem(`tarot_journal_cache_${owner}`); },
    checkAuth: () => { authCalls++; return auth; }, ...helpers,
    publish: notice => notices.push(notice), navigate() {} });
  const pending = action();
  await tick();
  try {
    for (const key of ownerKeys(owner)) assert.equal(storage.getItem(key), null, `${key} retained deleted prose`);
    assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:result`), null);
    assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:entry:replay`), null);
    assert.equal(storage.getItem('tarot_journal'), 'guest prose');
    for (const key of ownerKeys('other-owner')) assert.equal(storage.getItem(key), savedValue('other-owner'));
    assert.equal(storage.getItem('tarot_visual_resume:anon:result'), 'guest handle');
    assert.deepEqual(JSON.parse(storage.getItem('journey_narrative_cache')), {
      'other-owner:season': { narrative: 'other prose' }, 'anon:season': { narrative: 'guest prose' } });
    assert.equal(authCalls, 1);
    assert.equal(notices.length, 0, 'success waits for client authentication transition');
  } finally { finishAuth(); await pending; }
  assert.equal(notices[0].type, 'success');
});

test('rejected account deletion leaves owner prose and capabilities intact', async t => {
  const owner = 'rejected-owner';
  const { storage, values } = storageFixture(t, owner);
  const before = new Map(values);
  const helpers = await deletionHelpers();
  const notices = [];
  const action = await deleteAction({ deleteLoading: false, user: { id: owner }, setDeleteLoading() {},
    fetch: async () => Response.json({ error: 'Rejected' }, { status: 503 }),
    logout: () => assert.fail('refused deletion cannot log out'),
    checkAuth: () => assert.fail('refused deletion cannot refresh authentication'), ...helpers,
    publish: notice => notices.push(notice), navigate: () => assert.fail('refused deletion cannot navigate') });
  await action();
  assert.deepEqual(values, before);
  assert.equal(storage.getItem(`tarot_journal_${owner}`), savedValue(owner));
  assert.equal(notices[0].type, 'error');
});

// The actual hook executes against a small queued state/lifecycle driver. Imported
// storage/source utilities stay real; auth, subscription and HTTP are boundaries.
async function journalDriver(owner, fetchImpl, { canUseCloudJournal = true } = {}) {
  const source = await readFile(new URL('../src/hooks/useJournal.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const states = []; const refs = []; const queues = []; const effects = []; const layouts = []; const cleanups = [];
  let stateIndex = 0; let refIndex = 0;
  let activeOwner = owner;
  const dependencies = {
    useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], update => queues.push(() => { states[index] = typeof update === 'function' ? update(states[index]) : update; })]; },
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback: callback => callback, useEffect: effect => effects.push(effect), useLayoutEffect: effect => layouts.push(effect),
    useAuth: () => ({ isAuthenticated: Boolean(activeOwner), user: activeOwner ? { id: activeOwner } : null }),
    useSubscription: () => ({ canUseCloudJournal }), fetch: fetchImpl
  };
  const removed = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react' || node.source.value.includes('/contexts/')) continue;
      let target = node.source.value;
      if (!target.endsWith('.js')) target += '.js';
      const imported = await import(new URL(target, new URL('../src/hooks/useJournal.js', import.meta.url)));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
  }
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useJournal;`)(...Object.values(dependencies));
  const render = ({ runEffects = true } = {}) => { stateIndex = 0; refIndex = 0; const result = hook({ autoLoad: false });
    if (!runEffects) { layouts.length = 0; effects.length = 0; return result; }
    for (const effect of [...layouts.splice(0), ...effects.splice(0)]) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    return result; };
  return { render, setOwner: next => { activeOwner = next; }, flush: () => { while (queues.length) queues.shift()(); },
    close: () => cleanups.reverse().forEach(cleanup => cleanup()) };
}

test('a journal response already in flight cannot repopulate deleted owner storage', async t => {
  const owner = 'pending-journal-owner';
  const { storage } = storageFixture(t, owner);
  const helpers = await deletionHelpers();
  let respond;
  const driver = await journalDriver(owner, () => new Promise(resolve => { respond = resolve; }));
  t.after(() => driver.close());
  const pending = driver.render().loadEntries();
  (helpers.purgeDeletedAccountStorage || (() => {}))(owner);
  respond(Response.json({ entries: [{ id: 'late-entry', personalReading: 'Deleted owner private prose', cards: [] }] }));
  await pending; driver.flush();
  assert.equal(storage.getItem(`tarot_journal_cache_${owner}`), null, 'late successful GET rewrote deleted prose');
  assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
});

test('a queued journal pagination updater cannot repopulate storage after deletion', async t => {
  const owner = 'queued-journal-owner';
  const { storage } = storageFixture(t, owner);
  const helpers = await deletionHelpers();
  let requests = 0;
  const driver = await journalDriver(owner, async () => Response.json({ entries: [{ id: `entry-${++requests}`,
    personalReading: 'Private queued prose', cards: [] }], pagination: { hasMore: true, nextCursor: 'next', total: 2 } }));
  t.after(() => driver.close());
  await driver.render().loadEntries(); driver.flush();
  await driver.render().loadMoreEntries();
  (helpers.purgeDeletedAccountStorage || (() => {}))(owner);
  driver.flush();
  assert.equal(storage.getItem(`tarot_journal_cache_${owner}`), null, 'queued updater persisted after confirmed deletion');
  assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
});

test('confirmed deletion auth transition preserves guest insights instead of ordinary logout cleanup', async t => {
  const owner = 'auth-transition-owner';
  const { storage } = storageFixture(t, owner);
  // Anonymous loading after auth transition uses the actual local journal.
  storage.setItem('tarot_journal', JSON.stringify([{ id: 'guest-entry', personalReading: 'guest prose', cards: [] }]));
  const helpers = await deletionHelpers();
  const driver = await journalDriver(owner, () => assert.fail('no API request is needed'));
  t.after(() => driver.close());
  driver.render();
  (helpers.purgeDeletedAccountStorage || (() => {}))(owner);
  driver.setOwner(null);
  driver.render();
  assert.equal(storage.getItem('tarot_journal_insights'), 'legacy guest insights');
  await tick(); driver.flush();
  assert.ok(storage.getItem('tarot_journal').includes('guest prose'));
});

test('a deletion marker from another tab fences a late journal response before its storage event', async t => {
  const owner = 'cross-tab-journal-owner';
  const { storage } = storageFixture(t, owner);
  let respond;
  const driver = await journalDriver(owner, () => new Promise(resolve => { respond = resolve; }));
  t.after(() => driver.close());
  const pending = driver.render().loadEntries();
  // Another document's erasure is already durable; notification has not arrived.
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  for (const key of ownerKeys(owner)) storage.removeItem(key);
  respond(Response.json({ entries: [{ id: 'cross-tab-late-entry', personalReading: 'Late deleted prose', cards: [] }] }));
  await pending; driver.flush();
  assert.equal(storage.getItem(`tarot_journal_cache_${owner}`), null);
});

test('late narrative writer refuses a deleted owner without clearing other-owner prose', async t => {
  const owner = 'cross-tab-writer-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  for (const key of ownerKeys(owner)) storage.removeItem(key);
  storage.removeItem(`tarot_visual_resume:user:${owner}:result`);
  storage.setItem('journey_narrative_cache', JSON.stringify({ 'other-owner:season': { narrative: 'other prose' } }));
  setCachedNarrative(owner, 'season', 'Late narrative prose');
  assert.deepEqual(JSON.parse(storage.getItem('journey_narrative_cache')), { 'other-owner:season': { narrative: 'other prose' } });
});

test('late local journal writer refuses a deleted owner', t => {
  const owner = 'cross-tab-local-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  storage.removeItem(`tarot_journal_${owner}`);
  assert.equal(persistJournalWithVisualFallback({ key: `tarot_journal_${owner}`, entries: [{ personalReading: 'late prose' }], storage }).ok, false);
  assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
});

test('late private visual handle writer refuses a deleted owner', t => {
  const owner = 'cross-tab-capability-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  const binding = { readingResultId: 'new-private-result', sourceRevision: 0, spreadHash: 'a'.repeat(64),
    contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  assert.equal(writeVisualResume({ namespace: `user:${owner}`, binding,
    resumeHandle: { visualBinding: binding, visualJobToken: 'new-secret-capability' }, storage }), false);
  assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:new-private-result`), null);
});

test('late coach writer cannot restore deleted owner reflections in its scoped cache', t => {
  const owner = 'cross-tab-coach-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  storage.removeItem(`tarot_coach_recommendation_${owner}`);
  saveCoachRecommendation({ question: 'Private saved reflection', source: 'saved-reading' }, owner);
  assert.equal(storage.getItem(`tarot_coach_recommendation_${owner}`), null);
  saveCoachRecommendation({ question: 'Other owner reflection', source: 'saved-reading' }, 'other-owner');
  assert.equal(JSON.parse(storage.getItem('tarot_coach_recommendation_other-owner')).question, 'Other owner reflection');
});

test('malformed shared narrative cache reports incomplete device cleanup while preserving its bytes', async t => {
  const owner = 'malformed-cache-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem('journey_narrative_cache', 'malformed shared data');
  const helpers = await deletionHelpers();
  const notices = [];
  const action = await deleteAction({ deleteLoading: false, user: { id: owner }, setDeleteLoading() {},
    fetch: async () => Response.json({ success: true }), ...helpers,
    logout: () => assert.fail('deletion cannot erase shared cache through logout'), checkAuth: async () => {},
    publish: notice => notices.push(notice), navigate() {} });
  await action();
  assert.equal(storage.getItem('journey_narrative_cache'), 'malformed shared data');
  assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
  assert.equal(notices[0].type, 'success', 'server deletion still succeeded');
  assert.match(notices[0].description, /browser could not remove all saved reading data/);
});

test('unavailable local storage reports incomplete cleanup without undoing server deletion', async t => {
  const owner = 'unavailable-storage-owner';
  storageFixture(t, owner);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
  const helpers = await deletionHelpers();
  const notices = [];
  const action = await deleteAction({ deleteLoading: false, user: { id: owner }, setDeleteLoading() {},
    fetch: async () => Response.json({ success: true }), ...helpers,
    logout: () => assert.fail('ordinary logout is not deletion cleanup'), checkAuth: async () => {},
    publish: notice => notices.push(notice), navigate() {} });
  await action();
  assert.equal(notices[0].type, 'success');
  assert.match(notices[0].description, /browser could not remove all saved reading data/);
});

test('native storage deletion notification invalidates subscribers and unsubscribe stops observation', async t => {
  const owner = 'notified-owner';
  const { storage } = storageFixture(t, owner);
  const helpers = await deletionHelpers();
  const notified = [];
  const stop = helpers.subscribeToDeletedAccounts(id => notified.push(id));
  const notify = () => {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: `tarot_deleted_account:${owner}` }, newValue: { value: '1' }, storageArea: { value: storage } });
    globalThis.window.dispatchEvent(event);
  };
  t.after(stop);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  notify();
  assert.deepEqual(notified, [owner]);
  stop(); notify();
  assert.deepEqual(notified, [owner]);
});

test('another owner can persist a narrative without restoring deleted prose from a stale shared copy', t => {
  const owner = 'stale-shared-copy-owner';
  const { storage } = storageFixture(t, owner);
  storage.setItem(`tarot_deleted_account:${owner}`, '1');
  setCachedNarrative('other-owner', 'new-season', 'New other-owner prose');
  const cache = JSON.parse(storage.getItem('journey_narrative_cache'));
  assert.equal(cache[`${owner}:season`], undefined);
  assert.equal(cache['other-owner:new-season'].narrative, 'New other-owner prose');
  assert.equal(cache['anon:season'].narrative, 'guest prose');
});

test('deletion of another owner does not suppress an active journal response', async t => {
  const owner = 'surviving-journal-owner';
  const { storage } = storageFixture(t, owner);
  const helpers = await deletionHelpers();
  let respond;
  const driver = await journalDriver(owner, () => new Promise(resolve => { respond = resolve; }));
  t.after(() => driver.close());
  const pending = driver.render().loadEntries();
  helpers.purgeDeletedAccountStorage('different-owner');
  respond(Response.json({ entries: [{ id: 'surviving-entry', personalReading: 'Surviving owner prose', cards: [] }] }));
  await pending; driver.flush();
  assert.equal(JSON.parse(storage.getItem(`tarot_journal_cache_${owner}`))[0].personalReading, 'Surviving owner prose');
});

test('a failed key removal reports incomplete cleanup and continues erasing the remaining owner keys', async t => {
  const owner = 'partial-storage-owner';
  const { storage } = storageFixture(t, owner);
  const remove = storage.removeItem;
  storage.removeItem = key => {
    if (key === `tarot_journal_${owner}`) throw new Error('Removal denied');
    remove(key);
  };
  const helpers = await deletionHelpers();
  assert.equal(helpers.purgeDeletedAccountStorage(owner).purged, false);
  assert.equal(storage.getItem(`tarot_journal_${owner}`), savedValue(owner));
  for (const key of ownerKeys(owner).slice(1)) assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem('tarot_journal'), 'guest prose');
});

test('a stale free-account import cannot consume guest prose after owner deletion', async t => {
  const owner = 'deleted-import-owner';
  const { storage } = storageFixture(t, owner);
  const guest = JSON.stringify([{ id: 'guest-import', personalReading: 'Guest import prose', cards: [] }]);
  storage.setItem('tarot_journal', guest);
  const helpers = await deletionHelpers();
  const driver = await journalDriver(owner, () => assert.fail('local import cannot dispatch HTTP'), { canUseCloudJournal: false });
  t.after(() => driver.close());
  const { importLegacyLocalEntries } = driver.render();
  helpers.purgeDeletedAccountStorage(owner);
  const result = await importLegacyLocalEntries(); driver.flush();
  assert.equal(result.success, false);
  assert.match(result.error, /account changed/i);
  assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
  assert.equal(storage.getItem('tarot_journal'), guest);
});

for (const stage of ['existing GET', 'final POST']) {
  test(`a cloud migration settling after owner deletion at ${stage} preserves guest prose`, async t => {
    const owner = `deleted-migration-${stage}`;
    const { storage } = storageFixture(t, owner);
    const entry = { id: 'guest-migration', sessionSeed: 'guest-seed', personalReading: 'Guest migration prose', cards: [] };
    const guest = JSON.stringify([entry]);
    storage.setItem('tarot_journal', guest);
    storage.removeItem(`tarot_journal_${owner}`);
    const helpers = await deletionHelpers();
    let respond;
    let requests = 0;
    const driver = await journalDriver(owner, async (_url, options) => {
      requests++;
      if (stage === 'final POST' && !options?.method) return Response.json({ entries: [] });
      return new Promise(resolve => { respond = resolve; });
    });
    t.after(() => driver.close());
    const pending = driver.render().migrateToCloud();
    await tick();
    helpers.purgeDeletedAccountStorage(owner);
    respond(stage === 'existing GET' ? Response.json({ entries: [entry] }) : Response.json({ success: true }));
    const result = await pending; driver.flush();
    assert.equal(result.success, false);
    assert.match(result.error, /account changed/i);
    assert.equal(storage.getItem('tarot_journal'), guest);
    assert.equal(storage.getItem(`tarot_journal_${owner}`), null);
    assert.equal(requests, stage === 'existing GET' ? 1 : 2, 'stale migration stops before further requests');
  });
}

test('a pending migration cannot consume guest prose after an ordinary account switch', async t => {
  const owner = 'switched-migration-owner';
  const { storage } = storageFixture(t, owner);
  const entry = { id: 'guest-switch', sessionSeed: 'guest-switch-seed', personalReading: 'Guest switch prose', cards: [] };
  const guest = JSON.stringify([entry]);
  storage.setItem('tarot_journal', guest);
  storage.removeItem(`tarot_journal_${owner}`);
  let respond;
  let requests = 0;
  const driver = await journalDriver(owner, () => ++requests === 1
    ? new Promise(resolve => { respond = resolve; }) : Response.json({ entries: [] }));
  t.after(() => driver.close());
  const pending = driver.render().migrateToCloud();
  driver.setOwner('next-owner'); driver.render();
  respond(Response.json({ entries: [entry] }));
  const result = await pending;
  assert.equal(result.success, false);
  assert.equal(storage.getItem('tarot_journal'), guest);
});
