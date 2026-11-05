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
