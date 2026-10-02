import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

function bootstrap(storage) {
  const classes = new Set(['light-mode', 'unrelated']);
  const meta = [{ content: '#0F0E13' }, { content: '#FAFAFA' }];
  const context = {
    document: {
      documentElement: {
        classList: {
          remove: name => classes.delete(name),
          toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        }
      },
      querySelectorAll: () => meta.map(node => ({
        setAttribute: (name, value) => { node[name] = value; }
      }))
    }
  };
  Object.defineProperty(context, 'localStorage', { get: storage });
  runInNewContext(readFileSync(new URL('../public/theme-bootstrap.js', import.meta.url), 'utf8'), context);
  return { classes, colors: meta.map(node => node.content) };
}

for (const saved of ['light', 'dark', null, 'invalid']) {
  test(`theme bootstrap resolves ${JSON.stringify(saved)} before application startup`, () => {
    const result = bootstrap(() => ({ getItem: () => saved }));
    assert.equal(result.classes.has('light'), saved === 'light');
    assert.equal(result.classes.has('light-mode'), false);
    assert.equal(result.classes.has('unrelated'), true);
    assert.deepEqual(result.colors, Array(2).fill(saved === 'light' ? '#FAFAFA' : '#0F0E13'));
  });
}

test('theme bootstrap uses dark when the storage getter is blocked', () => {
  const result = bootstrap(() => { throw new Error('Storage blocked'); });
  assert.equal(result.classes.has('light'), false);
  assert.deepEqual(result.colors, ['#0F0E13', '#0F0E13']);
});

test('theme bootstrap uses dark when reading storage fails', () => {
  const result = bootstrap(() => ({ getItem: () => { throw new Error('Storage unavailable'); } }));
  assert.equal(result.classes.has('light'), false);
  assert.deepEqual(result.colors, ['#0F0E13', '#0F0E13']);
});
