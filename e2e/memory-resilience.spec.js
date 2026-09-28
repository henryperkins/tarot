import { test, expect } from '@playwright/test';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

const MEMORY = { id: 'memory-fixture', text: 'A gentle next step 🌿 安心 أمان', category: 'general', source: 'user' };

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Memory resilience — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page);
      await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    function panel(page) {
      return page.getByRole('heading', { name: 'Reader Memory', exact: true }).locator('../..');
    }

    for (const scenario of ['service error', 'offline', 'invalid response']) {
      test(`${scenario} offers recovery without claiming the memory list is empty`, async ({ page }) => {
        let attempts = 0;
        await page.route('**/api/memories**', route => {
          attempts += 1;
          if (attempts > 1) return route.fulfill({ json: { memories: [MEMORY] } });
          if (scenario === 'offline') return route.abort('failed');
          if (scenario === 'invalid response') return route.fulfill({ json: { memories: { invalid: true } } });
          return route.fulfill({ status: 503, body: '<html>Gateway unavailable</html>' });
        });
        await page.goto('/account');
        const memoryPanel = panel(page);
        await expect(memoryPanel.getByRole('alert')).toContainText(/memories.*try again|try again.*memories/i);
        await expect(memoryPanel.getByText('No memories yet', { exact: true })).toHaveCount(0);
        await memoryPanel.getByRole('button', { name: 'Retry loading memories', exact: true }).click();
        await expect(memoryPanel.getByText(MEMORY.text, { exact: true })).toBeVisible();
        await expect(memoryPanel.getByRole('alert')).toHaveCount(0);
        expect(attempts).toBe(2);
      });
    }

    test('a pending save is singular and a non-JSON failure preserves the draft', async ({ page }) => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      let saves = 0;
      await page.route('**/api/memories**', async route => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: { memories: [] } });
        saves += 1;
        await gate;
        await route.fulfill({ status: 502, body: '<html>Bad gateway</html>' });
      });
      try {
        await page.goto('/account');
        const memoryPanel = panel(page);
        await memoryPanel.getByRole('button', { name: 'Add new memory', exact: true }).click();
        const note = memoryPanel.getByLabel('Memory note', { exact: true });
        await note.fill(MEMORY.text);
        await memoryPanel.getByRole('button', { name: 'Add Memory', exact: true }).click();
        await expect(note).toBeDisabled();
        await expect(memoryPanel.getByLabel('Category', { exact: true })).toBeDisabled();
        for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
        expect(saves).toBe(1);
        release();
        await expect(memoryPanel.getByRole('alert')).toContainText(/save.*memory.*try again/i);
        await expect(note).toBeEnabled();
        await expect(note).toHaveValue(MEMORY.text);
        await expect(memoryPanel.getByRole('button', { name: 'Add Memory', exact: true })).toBeEnabled();
      } finally {
        release();
      }
    });

    test('clear-all prevents duplicate requests and keeps confirmation available after a failure', async ({ page }) => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      let deletions = 0;
      await page.route('**/api/memories**', async route => {
        if (route.request().method() !== 'DELETE') return route.fulfill({ json: { memories: [MEMORY] } });
        deletions += 1;
        if (deletions === 1) {
          await gate;
          return route.fulfill({ status: 503, json: { error: 'Storage unavailable' } });
        }
        return route.fulfill({ json: { success: true, deleted: 1 } });
      });
      try {
        await page.goto('/account');
        const memoryPanel = panel(page);
        await memoryPanel.getByRole('button', { name: 'Clear all memories', exact: true }).click();
        await memoryPanel.getByRole('button', { name: 'Yes, delete all', exact: true }).click();
        await expect(memoryPanel.getByRole('button', { name: 'Deleting memories…', exact: true })).toBeDisabled();
        await expect(memoryPanel.getByRole('button', { name: 'Delete memory', exact: true })).toBeDisabled();
        for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
        expect(deletions).toBe(1);
        release();
        await expect(memoryPanel.getByRole('alert')).toContainText(/delete.*memories.*try again/i);
        await expect(memoryPanel.getByText(MEMORY.text, { exact: true })).toBeVisible();
        await memoryPanel.getByRole('button', { name: 'Yes, delete all', exact: true }).click();
        await expect(memoryPanel.getByText('No memories yet', { exact: true })).toBeVisible();
        await expect(memoryPanel.getByRole('status')).toContainText('Memories deleted');
        await expect(memoryPanel.getByRole('button', { name: 'Add new memory', exact: true })).toBeFocused();
        expect(deletions).toBe(2);
      } finally {
        release();
      }
    });

    test('deleting during a refresh prevents stale data from restoring the memory', async ({ page }) => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      let reads = 0;
      let deletions = 0;
      await page.route('**/api/memories**', async route => {
        if (route.request().method() === 'DELETE') {
          deletions += 1;
          return route.fulfill({ json: { success: true } });
        }
        reads += 1;
        if (reads > 1) await gate;
        await route.fulfill({ json: { memories: [MEMORY] } }).catch(() => {});
      });
      try {
        await page.goto('/account');
        const memoryPanel = panel(page);
        await expect(memoryPanel.getByText(MEMORY.text, { exact: true })).toBeVisible();
        await memoryPanel.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect.poll(() => reads).toBe(2);
        const staleReadCancelled = page.waitForEvent('requestfailed', request =>
          request.method() === 'GET' && new URL(request.url()).pathname === '/api/memories');
        await memoryPanel.getByRole('button', { name: 'Delete memory', exact: true }).click();
        release();
        await staleReadCancelled;
        await expect(memoryPanel.getByText('No memories yet', { exact: true })).toBeVisible();
        await expect(memoryPanel.getByRole('status')).toContainText('Memory deleted');
        expect(deletions).toBe(1);
      } finally {
        release();
      }
    });

    test('large mixed-script lists tolerate unknown metadata and fit a narrow screen', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      const memories = Array.from({ length: 100 }, (_, index) => ({
        id: `memory-${index}`,
        text: `${index} أمان 🌿 安心 ${'L'.repeat(170)}`,
        category: 'constructor', source: '__proto__', createdAt: 'invalid-date'
      }));
      await page.route('**/api/memories**', route => route.fulfill({ json: { memories } }));
      await page.goto('/account');
      const memoryPanel = panel(page);
      await expect(memoryPanel.getByText(memories[0].text, { exact: true })).toBeVisible();
      await expect(memoryPanel.getByRole('button', { name: 'Delete memory', exact: true })).toHaveCount(100);
      await expect(memoryPanel.locator('time')).toHaveCount(0);
      await expect(memoryPanel.getByText('Other Insights', { exact: true })).toBeVisible();
      const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
    });

    test('a stalled read times out and can be retried', async ({ page }) => {
      let attempts = 0;
      await page.route('**/api/memories**', route => {
        attempts += 1;
        if (attempts === 1) return;
        return route.fulfill({ json: { memories: [MEMORY] } });
      });
      await page.clock.install();
      await page.goto('/account');
      await expect.poll(() => attempts).toBe(1);
      await page.clock.fastForward(16000);
      const memoryPanel = panel(page);
      await expect(memoryPanel.getByRole('alert')).toContainText(/took too long/i);
      await memoryPanel.getByRole('button', { name: 'Retry loading memories', exact: true }).click();
      await expect(memoryPanel.getByText(MEMORY.text, { exact: true })).toBeVisible();
    });
  });
}
