import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Exercise the production hook's keyboard handler. DOM measurement effects
// are irrelevant here; refs represent the focusable radios it acts upon.
async function carousel() {
  const source = await readFile(new URL('../src/hooks/useChoiceCarousel.js', import.meta.url), 'utf8');
  const program = source.replace(/^import .*?;\n/, '').replace('export function useChoiceCarousel', 'function useChoiceCarousel');
  const noop = () => {};
  const hook = new Function('useCallback', 'useEffect', 'useLayoutEffect', 'useRef', 'useState', `${program}; return useChoiceCarousel;`)(
    callback => callback, noop, noop, current => ({ current }), initial => [initial, noop]
  );
  const chosen = [];
  const focused = [];
  const result = hook({ keys: ['single', 'threeCard', 'fiveCard'], selectedKey: 'threeCard', onChoose: key => chosen.push(key), prefersReducedMotion: true });
  for (const key of ['single', 'threeCard', 'fiveCard']) {
    result.itemRefs.current[key] = { focus: () => focused.push(key), scrollIntoView: noop };
  }
  const press = (key, modifiers = {}) => {
    let prevented = false;
    result.onItemKeyDown({ key, ...modifiers, preventDefault: () => { prevented = true; } }, 'threeCard');
    return prevented;
  };
  return { chosen, focused, press };
}

test('modified carousel navigation keys leave browser and assistive shortcuts untouched', async () => {
  const { focused, chosen, press } = await carousel();
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      assert.equal(press(key, { [modifier]: true }), false, `${modifier}+${key} must retain its default action`);
    }
  }
  assert.deepEqual(focused, []);
  assert.deepEqual(chosen, []);
});

test('plain carousel keys continue to move focus without changing the choice', async () => {
  const { focused, chosen, press } = await carousel();
  assert.equal(press('ArrowLeft'), true);
  assert.equal(press('End'), true);
  assert.deepEqual(focused, ['single', 'fiveCard']);
  assert.deepEqual(chosen, []);
});

test('plain Enter and Space still choose the focused carousel item', async () => {
  const { focused, chosen, press } = await carousel();
  assert.equal(press('Enter'), true);
  assert.equal(press(' '), true);
  assert.deepEqual(chosen, ['threeCard', 'threeCard']);
  assert.deepEqual(focused, []);
});
