import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleSession } from '../src/lib/particleLifecycle.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a pending particle load is destroyed before its replacement can own the canvas', async () => {
  const pending = deferred();
  const started = deferred();
  const events = [];
  let calls = 0;
  const element = { isConnected: true };
  const session = createParticleSession(async () => ({
    async load(parameters) {
      assert.equal(parameters.element, element);
      events.push(`load:${parameters.id}`);
      if (++calls === 1) {
        started.resolve();
        await pending.promise;
      }
      return { destroy: () => events.push(`destroy:${parameters.id}`) };
    }
  }));
  const first = session.mount({ id: 'streaming', element, options: {} });
  await started.promise;
  first.dispose();
  const next = session.mount({ id: 'error', element, options: {} });
  assert.equal(calls, 1, 'never start two canvas owners while cleanup is pending');
  pending.resolve();
  await next.ready;
  assert.deepEqual(events, ['load:streaming', 'destroy:streaming', 'load:error']);
  next.dispose();
  next.dispose();
  assert.deepEqual(events, ['load:streaming', 'destroy:streaming', 'load:error', 'destroy:error']);
});

test('unmount during engine initialization never loads into detached DOM', async () => {
  const engineReady = deferred();
  const started = deferred();
  let calls = 0;
  const session = createParticleSession(() => {
    started.resolve();
    return engineReady.promise;
  });
  const element = { isConnected: true };
  const view = session.mount({ id: 'leaving', element, options: {} });
  await started.promise;
  view.dispose();
  element.isConnected = false;
  engineReady.resolve({ load: () => { calls++; } });
  await view.ready;
  assert.equal(calls, 0);
});

test('a failed load does not block a later scene and a detached completion is destroyed', async () => {
  let calls = 0;
  let destroyed = 0;
  const element = { isConnected: true };
  const session = createParticleSession(async () => ({
    async load() {
      if (++calls === 1) throw new Error('particle asset unavailable');
      element.isConnected = false;
      return { destroy: () => destroyed++ };
    }
  }));
  const first = session.mount({ id: 'first', element, options: {} });
  await assert.rejects(first.ready, /asset unavailable/);
  const next = session.mount({ id: 'next', element, options: {} });
  await next.ready;
  next.dispose();
  assert.equal(calls, 2);
  assert.equal(destroyed, 1);
});

test('a container registered before load rejection is cleaned up without touching another owner', async () => {
  const events = [];
  const foreign = { id: Symbol('other-view'), destroy: () => events.push('destroy:foreign') };
  const engine = {
    items: [foreign],
    dom() { return this.items; },
    async load({ id }) {
      const container = {
        id: Symbol(id),
        destroy() {
          events.push(`destroy:${id}`);
          engine.items.splice(engine.items.indexOf(container), 1);
        }
      };
      engine.items.push(container);
      if (id === 'failing-view') throw new Error('particle initialization failed');
      return container;
    }
  };
  const session = createParticleSession(async () => engine);
  const element = { isConnected: true };
  const first = session.mount({ id: 'failing-view', element, options: {} });
  await assert.rejects(first.ready, /initialization failed/);
  assert.deepEqual(events, ['destroy:failing-view']);
  assert.deepEqual(engine.items, [foreign]);
  const next = session.mount({ id: 'next-view', element, options: {} });
  await next.ready;
  next.dispose();
  assert.deepEqual(events, ['destroy:failing-view', 'destroy:next-view']);
  assert.deepEqual(engine.items, [foreign]);
});
