import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyColorScript, COLOR_SCRIPTS, resetColorScript } from '../src/lib/colorScript.js';

function createStyle(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    setProperty(name, value) {
      values.set(name, String(value));
    },
    removeProperty(name) {
      values.delete(name);
    },
    getPropertyValue(name) {
      return values.get(name) || '';
    }
  };
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    [Symbol.iterator]() {
      return values.values();
    }
  };
}

function withMockDocument(initial = {}) {
  const originalDocument = globalThis.document;
  const root = {
    style: createStyle(initial.style || {}),
    classList: createClassList(initial.classes || [])
  };
  globalThis.document = { documentElement: root };

  return {
    root,
    restore() {
      globalThis.document = originalDocument;
    }
  };
}

describe('colorScript lifecycle', () => {
  it('restores previous root vars/classes when an owner resets', () => {
    const { root, restore } = withMockDocument({
      style: { '--phase-color': '#111111' },
      classes: ['color-atmosphere--existing']
    });

    try {
      applyColorScript(COLOR_SCRIPTS.struggle, { owner: 'reader' });
      assert.equal(root.style.getPropertyValue('--phase-color'), COLOR_SCRIPTS.struggle.cssVars['--phase-color']);
      assert.equal(root.classList.contains('color-atmosphere--isolation-depth'), true);

      resetColorScript({ owner: 'reader' });
      assert.equal(root.style.getPropertyValue('--phase-color'), '#111111');
      assert.equal(root.classList.contains('color-atmosphere--existing'), true);
      assert.equal(root.classList.contains('color-atmosphere--isolation-depth'), false);
    } finally {
      resetColorScript({ owner: 'reader' });
      restore();
    }
  });

  it('keeps owner layering stable and restores baseline after last owner resets', () => {
    const { root, restore } = withMockDocument();

    try {
      applyColorScript(COLOR_SCRIPTS.struggle, { owner: 'reader-a' });
      applyColorScript(COLOR_SCRIPTS.revelation, { owner: 'reader-b' });
      assert.equal(root.classList.contains('color-atmosphere--golden-hour-clarity'), true);

      resetColorScript({ owner: 'reader-b' });
      assert.equal(root.classList.contains('color-atmosphere--isolation-depth'), true);
      assert.equal(root.style.getPropertyValue('--phase-color'), COLOR_SCRIPTS.struggle.cssVars['--phase-color']);

      resetColorScript({ owner: 'reader-a' });
      assert.equal(root.classList.contains('color-atmosphere--isolation-depth'), false);
      assert.equal(root.classList.contains('color-atmosphere--golden-hour-clarity'), false);
      assert.equal(root.style.getPropertyValue('--phase-color'), '');
    } finally {
      resetColorScript({ owner: 'reader-a' });
      resetColorScript({ owner: 'reader-b' });
      restore();
    }
  });
});
