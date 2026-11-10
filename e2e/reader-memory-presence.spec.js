import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

const choice = page => page.getByRole('checkbox', { name: 'Use saved memories in this reading.', exact: true });

for (const platform of ['desktop', 'phone @mobile']) {
  test(`Reader Memory can be excluded before its presence check finishes — ${platform}`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    let release;
    let responded = false;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/memories?limit=1', async route => {
      await gate;
      responded = true;
      await route.fulfill({ json: { memories: [{ id: 'memory-1', text: 'A saved work theme.', category: 'theme' }] } });
    });
    try {
      await openSetup(page);
      await expect(choice(page)).toBeChecked();
      await choice(page).uncheck();
      await startReading(page, fixture, { setup: false, complete: false });
      await expect.poll(() => fixture.requests.reading.length).toBe(1);
      expect(responded).toBe(false);
      expect(fixture.requests.reading[0].useSavedMemories).toBe(false);
    } finally {
      release();
      await fixture.close();
    }
  });

  for (const returnTo of ['page focus', 'setup']) {
    test(`Reader Memory opt-out refreshes after returning to ${returnTo} — ${platform}`, async ({ page }) => {
      const fixture = await createNarrativeFixture(page);
      let memoryAdded = false;
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/memories?limit=1', async route => {
        if (!memoryAdded) return route.fulfill({ json: { memories: [] } });
        await gate;
        await route.fulfill({ json: { memories: [{ id: 'new-memory', text: 'A newly saved work theme.', category: 'theme' }] } });
      });
      try {
        await openSetup(page);
        await expect(choice(page)).toHaveCount(0);
        if (returnTo === 'setup') {
          await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).click();
          await expect(page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true })).toBeVisible();
        }
        // Another tab, or a follow-up while setup was hidden, saved a memory.
        memoryAdded = true;
        if (returnTo === 'page focus') await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        else await page.getByRole('button', { name: /^Step 1: Spread/ }).click();

        // An old empty response cannot hide the choice during revalidation.
        await expect(choice(page)).toBeChecked();
        await choice(page).uncheck();
        release();
        await expect(page.getByRole('link', { name: 'Review Reader Memory' })).toBeVisible();
        await expect(choice(page)).not.toBeChecked();

        if (returnTo === 'page focus') {
          await startReading(page, fixture, { setup: false, complete: false });
        } else {
          await page.getByRole('button', { name: /^Step 4: Reading/ }).click();
          await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).click();
          await page.getByRole('button', { name: 'Reveal remaining cards', exact: true }).filter({ visible: true }).click();
          await page.getByRole('button', { name: 'Interpret cards', exact: true }).filter({ visible: true }).click();
        }
        await expect.poll(() => fixture.requests.reading.length).toBe(1);
        expect(fixture.requests.reading[0].useSavedMemories).toBe(false);
      } finally {
        release();
        await fixture.close();
      }
    });
  }
}

test('Reader Memory choice hides only once an empty memory list is confirmed', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/memories?limit=1', async route => {
    await gate;
    await route.fulfill({ json: { memories: [] } });
  });
  try {
    await openSetup(page);
    await expect(choice(page)).toBeChecked();
    release();
    await expect(choice(page)).toHaveCount(0);
  } finally {
    release();
    await fixture.close();
  }
});

test('Reader Memory opt-out remains available when its presence check fails', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  await page.route('**/api/memories?limit=1', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  try {
    await openSetup(page);
    await expect(choice(page)).toBeChecked();
    await choice(page).uncheck();
    await expect(choice(page)).not.toBeChecked();
  } finally {
    await fixture.close();
  }
});
