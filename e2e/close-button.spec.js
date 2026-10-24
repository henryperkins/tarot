import { test, expect } from './helpers/frontendTest.js';

// Contract for the shared CloseButton primitive: required accessible name,
// 44px target, type="button", decorative icon, and focus return on close.
async function expectCloseContract(button, label) {
  await expect(button).toHaveAttribute('type', 'button');
  await expect(button).toHaveAttribute('aria-label', label);
  const box = await button.boundingBox();
  expect(box, `${label} bounding box`).toBeTruthy();
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  await expect(button.locator('svg').first()).toHaveAttribute('aria-hidden', 'true');
}

test('design-system close specimens honor the contract and show a focus ring', async ({ page }) => {
  await page.goto('/design');
  const dialogClose = page.getByRole('button', { name: 'Close example dialog', exact: true });
  const noticeClose = page.getByRole('button', { name: 'Dismiss example notice', exact: true });
  await expectCloseContract(dialogClose, 'Close example dialog');
  await expectCloseContract(noticeClose, 'Dismiss example notice');

  await dialogClose.focus();
  await page.keyboard.press('Shift');
  const focus = await dialogClose.evaluate(element => ({
    focusVisible: element.matches(':focus-visible'),
    boxShadow: getComputedStyle(element).boxShadow,
  }));
  expect(focus.focusVisible, 'close button must match :focus-visible after keyboard input').toBe(true);
  expect(focus.boxShadow, 'focus ring must render a non-transparent shadow').toMatch(/rgba?\((?!0, 0, 0, 0)/);
});

test('auth dialog close honors the contract and returns focus to its opener', async ({ page }) => {
  await page.route('**/api/subscription', route =>
    route.fulfill({ json: { subscription: { tier: 'free', status: 'active', provider: 'stripe' } } }));
  await page.goto('/account');
  const opener = page.getByRole('button', { name: 'Sign in', exact: true }).filter({ visible: true }).first();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Welcome Back', exact: true })).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
  await expectCloseContract(close, 'Close dialog');
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('coach template close takes initial focus and returns focus to its opener', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto('/');
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Shift+G');
  const coach = page.getByRole('dialog', { name: 'Shape a question with clarity', exact: true });
  await expect(coach).toBeVisible();
  const opener = coach.getByRole('button', { name: 'Templates', exact: true });
  await opener.click();
  const library = page.getByRole('dialog', { name: 'Template library', exact: true });
  await expect(library).toBeVisible();
  const close = library.getByRole('button', { name: 'Close template panel', exact: true });
  await expect(close).toHaveAttribute('data-initial-focus', 'browse');
  await expect(close).toBeFocused();
  await expectCloseContract(close, 'Close template panel');
  await close.click();
  await expect(library).toHaveCount(0);
  await expect(opener).toBeFocused();
});
