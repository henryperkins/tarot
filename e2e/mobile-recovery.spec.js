import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, QUESTION, startReading } from './helpers/narrativeFixtures.js';

// Phones reload backgrounded tabs, drop connections mid-journey and send Back
// presses that desktop testing rarely meets. These cover the recovery paths of
// the reading journey (2026-10-14 mobile audit).

const SNAPSHOT_KEY = 'tarot:reading-snapshot';
const NOTE = 'A small step is enough.';

async function drawThreeCards(page) {
  await page.getByRole('radio', { name: /Three-Card Story/ }).click();
  await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
  await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
}

function snapshotContains(page, text) {
  return expect.poll(() => page.evaluate(key => sessionStorage.getItem(key) || '', SNAPSHOT_KEY)).toContain(text);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Phone reading recovery — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page, { signedOut: true });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    test('a reload keeps the dealt spread, its reveals and reflections', async ({ page }) => {
      await openSetup(page);
      await drawThreeCards(page);
      await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('button', { name: 'Reveal next: Past', exact: true }).filter({ visible: true }).first().click();
      const detail = page.getByRole('region', { name: 'Selected card meaning' });
      const card = await detail.getByRole('heading', { level: 3 }).textContent();
      await detail.getByLabel('What resonates for you?').fill(NOTE);
      await snapshotContains(page, NOTE);

      await page.reload();
      const table = page.getByRole('region', { name: /layout$/ }).first();
      await expect(table.getByRole('button', { name: /Click to view details/ })).toHaveCount(1);
      await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(2);
      await table.getByRole('button', { name: /in Past position\. Click to view details/ }).click();
      await expect(detail.getByRole('heading', { level: 3 })).toHaveText(card);
      await expect(detail.getByLabel('What resonates for you?')).toHaveValue(NOTE);
      expect(fixture.requests.reading).toHaveLength(0);
    });

    test('a reload keeps a finished reading without requesting it again', async ({ page }) => {
      await startReading(page, fixture);
      await snapshotContains(page, '"narrative":{"raw"');
      await page.reload();
      const ending = fixture.narrative.replace(/[*#_`]/g, '').trim().split(/\s+/).slice(-8).join(' ');
      await expect(page.locator('.narrative-stream')).toContainText(ending);
      expect(fixture.requests.reading).toHaveLength(1);
      expect(fixture.connectionGeneration('reading')).toBe(1);
    });

    test('a reload while the reading is written reattaches to the same job', async ({ page }) => {
      await startReading(page, fixture, { complete: false });
      await expect.poll(() => fixture.connected('reading')).toBe(1);
      await page.reload();
      await expect.poll(() => fixture.connectionGeneration('reading')).toBe(2);
      // Completes over the new connection and checks that no second job started.
      await fixture.completeReading();
    });

    test('closing a sheet leaves no extra Back press behind', async ({ page }) => {
      await openSetup(page);
      await page.goto('/?from=back-test');
      const opener = page.getByRole('button', { name: 'Open reading preparation', exact: true });
      const drawer = page.getByRole('dialog', { name: 'Prepare your reading', exact: true });

      await opener.click();
      await expect(drawer).toBeVisible();
      await page.goBack();
      await expect(drawer).toBeHidden();
      await expect(page).toHaveURL(/from=back-test/);

      await opener.click();
      await expect(drawer).toBeVisible();
      await drawer.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      await expect(drawer).toBeHidden();
      await page.goBack();
      await expect(page).not.toHaveURL(/from=back-test/);
    });
  });
}

test.describe('Phone recovery with a keyboard and a lost connection — Chromium', () => {
  test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let fixture;

  test.beforeEach(async ({ page }) => {
    fixture = await createNarrativeFixture(page, { signedOut: true });
  });

  test.afterEach(async () => {
    await fixture.close();
  });

  test('a reading table that cannot download keeps the app and recovers after Try again', async ({ page }) => {
    // Covers dev modules and production chunks. Chromium only: WebKit's
    // interception keeps a blocked module URL failing across reloads.
    const tableModule = /\/(?:src\/components\/ReadingDisplay\.jsx|assets\/ReadingDisplay-[^/]+\.js)(?:\?|$)/;
    await page.route(tableModule, route => route.abort('internetdisconnected'));
    await openSetup(page);
    await drawThreeCards(page);
    await expect(page.getByRole('heading', { name: 'Your reading table did not load' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tarot reading progress' })).toBeVisible();
    await snapshotContains(page, '"spreadKey":"threeCard"');

    await page.unroute(tableModule);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Try again', exact: true }).click()]);
    await expect(page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: /layout$/ }).first()).toBeVisible();
    expect(fixture.requests.reading).toHaveLength(0);
  });

  test('keyboard focus is never hidden under the header or the action dock', async ({ page }) => {
    await openSetup(page);
    const hidden = [];
    for (let index = 0; index < 40; index += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(async () => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        // Skip links slide in and out on focus; measure once they settle.
        const settling = document.getAnimations().filter(animation => animation.playState === 'running'
          && Number.isFinite(animation.effect?.getComputedTiming().endTime));
        await Promise.all(settling.map(animation => animation.finished.catch(() => {})));
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        // WCAG 2.4.11: part of the focused control must be on top, not covered
        // by the sticky header, the dock or anything else. A visually hidden
        // input counts through the visible control that wraps it.
        const samples = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]];
        const visible = samples.some(([x, y]) => {
          const pointX = bounds.left + bounds.width * x;
          const pointY = bounds.top + bounds.height * y;
          if (pointX < 0 || pointY < 0 || pointX >= innerWidth || pointY >= innerHeight) return false;
          const hit = document.elementFromPoint(pointX, pointY);
          return Boolean(hit) && (hit === element || element.contains(hit) || hit.contains(element));
        });
        return { name: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 40), hidden: !visible };
      });
      if (stop?.hidden) hidden.push(stop.name);
    }
    expect(hidden).toEqual([]);
  });
});
