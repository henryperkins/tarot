import { test, expect } from './helpers/frontendTest.js';

test('spread and deck carousels preserve modified browser shortcuts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto('/');
  const spread = page.getByRole('radiogroup', { name: 'Spread selection', exact: true });
  await expect(spread).toBeVisible();
  await page.getByRole('button', { name: /^Deck\b/ }).click();
  const deck = page.getByRole('radiogroup', { name: 'Choose your deck style', exact: true });
  await expect(deck).toBeVisible();
  for (const group of [spread, deck]) {
    const selected = group.getByRole('radio', { checked: true });
    await selected.focus();
    const observations = await selected.evaluate(element => {
      const results = [];
      for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
          // Synthetic dispatch runs the actual React handler but cannot perform
          // native Back/Forward navigation, keeping this regression on its page.
          const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
          element.dispatchEvent(event);
          results.push({ modifier, key, prevented: event.defaultPrevented, focused: document.activeElement === element });
        }
      }
      return results;
    });
    for (const result of observations) {
      expect(result.prevented, `${result.modifier}+${result.key}`).toBe(false);
      expect(result.focused, `${result.modifier}+${result.key} focus`).toBe(true);
    }
    await expect(selected).toHaveAttribute('aria-checked', 'true');
    // Plain arrow navigation remains available to keyboard readers.
    await page.keyboard.press('ArrowRight');
    await expect(selected).not.toBeFocused();
    await expect(selected).toHaveAttribute('aria-checked', 'true');
  }
});
