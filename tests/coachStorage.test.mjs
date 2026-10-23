import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as coachStorage from '../src/lib/coachStorage.js';
import {
  HISTORY_STORAGE_KEY,
  deleteCoachTemplate,
  loadCoachHistory,
  loadCoachTemplates,
  recordCoachQuestion,
  saveCoachTemplate,
  undoCoachTemplateSave
} from '../src/lib/coachStorage.js';

describe('coach storage persistence', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let storage;
  let events;

  beforeEach(() => {
    const values = new Map();
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    };
    events = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage, dispatchEvent: event => events.push(event.type) }
    });
  });

  afterEach(() => {
    for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalStorage], ['navigator', originalNavigator]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  it('reports success after a question can be loaded from its owner history', () => {
    const question = 'What can I learn from this change?';
    const result = recordCoachQuestion(question, undefined, 'reader-1');

    assert.equal(result.success, true);
    assert.equal(loadCoachHistory(undefined, 'reader-1')[0].question, question);
    assert.deepEqual(loadCoachHistory(undefined, 'reader-2'), []);
    assert.deepEqual(events, ['coach-storage-sync']);
  });

  it('reports a full storage failure and preserves the existing history', () => {
    const existing = [{ id: 'earlier-question', question: 'What is changing?', createdAt: 1 }];
    storage.setItem(`${HISTORY_STORAGE_KEY}_anon`, JSON.stringify(existing));
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };

    const result = recordCoachQuestion('How can I respond with care?');

    assert.equal(result.success, false);
    assert.match(result.error, /storage/i);
    assert.deepEqual(result.history, existing);
    assert.deepEqual(loadCoachHistory(), existing);
    assert.deepEqual(events, []);
  });

  it('does not report success when storage silently drops a write', () => {
    storage.setItem = () => {};

    const result = recordCoachQuestion('How can I make space for rest?');

    assert.equal(result.success, false);
    assert.deepEqual(loadCoachHistory(), []);
    assert.deepEqual(events, []);
  });

  it('identifies the oldest template displaced by a ninth save and retains exact recovery snapshots', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      id: `original-${8 - index}`,
      label: `Saved question ${8 - index}`,
      savedQuestion: `What can help with concern ${8 - index}?`,
      updatedAt: 100 - index
    }));
    storage.setItem('tarot_coach_templates_reader-1', JSON.stringify(existing));

    const result = saveCoachTemplate({
      label: 'Ninth question',
      topic: 'growth',
      timeframe: 'present',
      depth: 'gentle',
      savedQuestion: 'How can I care for myself?'
    }, 'reader-1');

    assert.equal(result.success, true);
    assert.equal(result.templates.length, 8);
    assert.deepEqual(result.replacedTemplate, existing[7]);
    assert.deepEqual(result.undoToken?.before, existing);
    assert.deepEqual(result.undoToken?.after, result.templates);
    assert.deepEqual(loadCoachTemplates('reader-1'), result.templates);
    assert.deepEqual(loadCoachTemplates('reader-2'), []);
  });

  it('identifies a same-name replacement without discarding another template at capacity', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      id: `original-${index}`,
      label: index === 3 ? 'Career concern' : `Other question ${index}`,
      savedQuestion: index === 3 ? 'What can help me understand my career self-doubt?' : `What is changing in situation ${index}?`,
      updatedAt: index + 1
    }));
    storage.setItem('tarot_coach_templates_anon', JSON.stringify(existing));

    const result = saveCoachTemplate({ label: '  CAREER CONCERN  ', savedQuestion: 'What choices can I make in my career?' });

    assert.equal(result.success, true);
    assert.deepEqual(result.replacedTemplate, existing[3]);
    assert.deepEqual(result.templates.slice(1), existing.filter(entry => entry.id !== 'original-3'));
    assert.deepEqual(result.undoToken?.before, existing);
  });

  it('returns no replacement or undo token when saving into available capacity', () => {
    const result = saveCoachTemplate({ label: 'My question', savedQuestion: 'What can I learn?' });

    assert.equal(result.success, true);
    assert.equal(result.replacedTemplate, null);
    assert.equal(result.undoToken, null);
  });

  it('undoes a ninth save with the exact original template order, IDs, times, and questions', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      id: `original-${index}`,
      label: `Question ${index}`,
      savedQuestion: `What can I learn about situation ${index}?`,
      updatedAt: index + 10
    }));
    storage.setItem('tarot_coach_templates_reader-1', JSON.stringify(existing));
    const save = saveCoachTemplate({ label: 'New question', savedQuestion: 'What might support me?' }, 'reader-1');

    const undo = undoCoachTemplateSave(save.undoToken, 'reader-1');

    assert.equal(undo.success, true);
    assert.deepEqual(undo.templates, existing);
    assert.deepEqual(loadCoachTemplates('reader-1'), existing);
    assert.deepEqual(events, ['coach-storage-sync', 'coach-storage-sync']);
  });

  it('undoes a same-name replacement without creating a new ID or timestamp', () => {
    const existing = [{
      id: 'career-original',
      label: 'Career',
      savedQuestion: 'What can help me work with self-doubt in my career?',
      customFocus: 'A promotion conversation',
      updatedAt: 17
    }];
    storage.setItem('tarot_coach_templates_anon', JSON.stringify(existing));
    const save = saveCoachTemplate({ label: 'career', savedQuestion: 'How can I prepare for my next career choice?' });

    const undo = undoCoachTemplateSave(save.undoToken);

    assert.equal(undo.success, true);
    assert.deepEqual(loadCoachTemplates(), existing);
  });

  for (const change of ['save', 'remove']) {
    it(`refuses undo after another template ${change} without discarding the newer storage state`, () => {
      saveCoachTemplate({ label: 'Original', savedQuestion: 'What can I learn?' });
      const replacement = saveCoachTemplate({ label: 'Original', savedQuestion: 'What choice is available?' });
      if (change === 'save') {
        saveCoachTemplate({ label: 'Newer', savedQuestion: 'How can I respond?' });
      } else {
        deleteCoachTemplate(replacement.template.id);
      }
      const current = loadCoachTemplates();
      events.length = 0;

      const undo = undoCoachTemplateSave(replacement.undoToken);

      assert.equal(undo.success, false);
      assert.match(undo.error, /changed|newer/i);
      assert.deepEqual(undo.templates, current);
      assert.deepEqual(loadCoachTemplates(), current);
      assert.deepEqual(events, []);
    });
  }

  it('refuses another owner\'s undo token even when both owners have the same current templates', () => {
    saveCoachTemplate({ label: 'Original', savedQuestion: 'What can I learn?' }, 'reader-1');
    const replacement = saveCoachTemplate({ label: 'Original', savedQuestion: 'What choice is available?' }, 'reader-1');
    storage.setItem('tarot_coach_templates_reader-2', JSON.stringify(loadCoachTemplates('reader-1')));
    const ownerTwoBefore = loadCoachTemplates('reader-2');

    const undo = undoCoachTemplateSave(replacement.undoToken, 'reader-2');

    assert.equal(undo.success, false);
    assert.deepEqual(loadCoachTemplates('reader-2'), ownerTwoBefore);
    assert.deepEqual(loadCoachTemplates('reader-1'), replacement.undoToken.after);
  });

  it('rejects missing, fabricated, and modified undo tokens without changing templates', () => {
    saveCoachTemplate({ label: 'Original', savedQuestion: 'What can I learn?' });
    const replacement = saveCoachTemplate({ label: 'Original', savedQuestion: 'What choice is available?' });
    const current = loadCoachTemplates();
    const copiedToken = JSON.parse(JSON.stringify(replacement.undoToken));
    replacement.undoToken.before[0].savedQuestion = 'Altered recovery text';

    for (const token of [null, {}, copiedToken, replacement.undoToken]) {
      const undo = undoCoachTemplateSave(token);
      assert.equal(undo.success, false);
      assert.match(undo.error, /undo|restore/i);
      assert.deepEqual(loadCoachTemplates(), current);
    }
  });

  for (const failure of ['throw', 'drop']) {
    it(`reports failed undo when storage writes ${failure} and leaves the current templates intact`, () => {
      saveCoachTemplate({ label: 'Original', savedQuestion: 'What can I learn?' });
      const replacement = saveCoachTemplate({ label: 'Original', savedQuestion: 'What choice is available?' });
      const current = loadCoachTemplates();
      storage.setItem = () => {
        if (failure === 'throw') throw new DOMException('Storage is full', 'QuotaExceededError');
      };
      events.length = 0;

      const undo = undoCoachTemplateSave(replacement.undoToken);

      assert.equal(undo.success, false);
      assert.match(undo.error, /storage/i);
      assert.deepEqual(undo.templates, current);
      assert.deepEqual(loadCoachTemplates(), current);
      assert.deepEqual(events, []);
    });
  }

  it('returns no replacement recovery metadata when the replacement was not persisted', () => {
    const existing = [{ id: 'original', label: 'Career', savedQuestion: 'What can I learn?', updatedAt: 1 }];
    storage.setItem('tarot_coach_templates_anon', JSON.stringify(existing));
    storage.setItem = () => {};

    const result = saveCoachTemplate({ label: 'Career', savedQuestion: 'What choice is available?' });

    assert.equal(result.success, false);
    assert.equal(result.undoToken, undefined);
    assert.equal(result.replacedTemplate, undefined);
    assert.deepEqual(loadCoachTemplates(), existing);
    assert.deepEqual(events, []);
  });

  it('reports a failed save even when the previous storage value matches the attempted write', (context) => {
    const existing = {
      id: 'original', label: 'Career', topic: 'career', timeframe: 'present', depth: 'gentle',
      customFocus: '', useCreative: false, savedQuestion: 'What can I learn?', updatedAt: 17
    };
    storage.setItem('tarot_coach_templates_anon', JSON.stringify([existing]));
    context.mock.method(Date, 'now', () => 17);
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };

    const result = saveCoachTemplate(existing);

    assert.equal(result.success, false);
    assert.match(result.error, /storage/i);
    assert.deepEqual(loadCoachTemplates(), [existing]);
    assert.deepEqual(events, []);
  });

  it('serializes a concurrent save behind Undo and retains the later save', async () => {
    assert.equal(typeof coachStorage.runCoachTemplateMutation, 'function');
    const requests = [];
    const queues = new Map();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request(name, options, operation) {
        requests.push({ name, mode: options.mode });
        const previous = queues.get(name) || Promise.resolve();
        const result = previous.then(operation);
        queues.set(name, result.then(() => {}, () => {}));
        return result;
      } } }
    });
    saveCoachTemplate({ label: 'Original', savedQuestion: 'What can I learn?' }, 'reader-1');
    const replacement = saveCoachTemplate({ label: 'Original', savedQuestion: 'What choice is available?' }, 'reader-1');
    let releaseUndo;
    const undoGate = new Promise(resolve => { releaseUndo = resolve; });
    let markUndoEntered;
    const undoEntered = new Promise(resolve => { markUndoEntered = resolve; });
    let laterSaveEntered = false;

    const undo = coachStorage.runCoachTemplateMutation('reader-1', async () => {
      markUndoEntered();
      assert.deepEqual(loadCoachTemplates('reader-1'), replacement.undoToken.after);
      // A different tab may request its write while this critical section is
      // between reading the current list and restoring the recovery snapshot.
      await undoGate;
      return undoCoachTemplateSave(replacement.undoToken, 'reader-1');
    });
    await undoEntered;
    const laterSave = coachStorage.runCoachTemplateMutation('reader-1', () => {
      laterSaveEntered = true;
      return saveCoachTemplate({ label: 'From another tab', savedQuestion: 'How can I respond?' }, 'reader-1');
    });
    await Promise.resolve();
    assert.equal(laterSaveEntered, false);
    releaseUndo();

    assert.equal((await undo).success, true);
    assert.equal((await laterSave).success, true);
    assert.deepEqual(loadCoachTemplates('reader-1').map(item => item.label), ['From another tab', 'Original']);
    assert.equal(loadCoachTemplates('reader-1')[1].savedQuestion, 'What can I learn?');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].name, requests[1].name);
    assert.ok(requests.every(request => request.mode === 'exclusive'));
  });

  it('uses distinct lock scopes for anonymous and signed-in template owners', async () => {
    assert.equal(typeof coachStorage.runCoachTemplateMutation, 'function');
    const names = [];
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request(name, options, operation) {
        names.push(name);
        return Promise.resolve(operation());
      } } }
    });

    for (const owner of [null, 'reader-1', 'reader-2', 'reader-1']) {
      const result = await coachStorage.runCoachTemplateMutation(owner, () => ({ success: true }));
      assert.equal(result.success, true);
    }

    assert.equal(new Set(names.slice(0, 3)).size, 3);
    assert.equal(names[1], names[3]);
  });

  it('does not invoke template mutations when Web Locks are unavailable', async () => {
    assert.equal(typeof coachStorage.runCoachTemplateMutation, 'function');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    let mutated = false;

    const result = await coachStorage.runCoachTemplateMutation('reader-1', () => {
      mutated = true;
      return saveCoachTemplate({ label: 'Must not save', savedQuestion: 'What is changing?' }, 'reader-1');
    });

    assert.equal(result.success, false);
    assert.match(result.error, /templates|template/i);
    assert.equal(mutated, false);
    assert.deepEqual(loadCoachTemplates('reader-1'), []);
    assert.deepEqual(events, []);
  });

  it('reports lock acquisition failure without invoking the template mutation', async () => {
    assert.equal(typeof coachStorage.runCoachTemplateMutation, 'function');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: () => Promise.reject(new DOMException('Lock access denied', 'SecurityError')) } }
    });
    let mutated = false;

    const result = await coachStorage.runCoachTemplateMutation('reader-1', () => { mutated = true; });

    assert.equal(result.success, false);
    assert.match(result.error, /templates|template/i);
    assert.equal(mutated, false);
    assert.deepEqual(events, []);
  });

  it('retains persistence failure inside a serialized template mutation', async () => {
    assert.equal(typeof coachStorage.runCoachTemplateMutation, 'function');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: (name, options, operation) => Promise.resolve(operation()) } }
    });
    storage.setItem = () => {};

    const result = await coachStorage.runCoachTemplateMutation('reader-1', () =>
      saveCoachTemplate({ label: 'Not retained', savedQuestion: 'What can I learn?' }, 'reader-1'));

    assert.equal(result.success, false);
    assert.deepEqual(loadCoachTemplates('reader-1'), []);
    assert.deepEqual(events, []);
  });
});
