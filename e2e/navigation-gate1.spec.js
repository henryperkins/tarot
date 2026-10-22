import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation } from './helpers/navigationFixtures.js';
import { writeFile } from 'node:fs/promises';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';
import { devices } from '@playwright/test';

async function hitTarget(locator) {
  return locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1
      && (element === hit || element.contains(hit));
  });
}
async function scrollEnd(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
}

test('regression: primary route frames align on handsets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareNavigation(page);
  const frames = [];
  for (const path of ['/', '/journal', '/account']) {
    await page.goto(path); await settleNavigation(page);
    frames.push(await page.evaluate(() => ({
      brand: document.querySelector('.site-nav__brand').getBoundingClientRect().toJSON(),
      account: document.querySelector('.account-trigger, .guest-signin-button').getBoundingClientRect().toJSON()
    })));
  }
  for (const frame of frames.slice(1)) {
    expect(Math.abs(frame.brand.x - frames[0].brand.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.brand.y - frames[0].brand.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.account.right - frames[0].account.right)).toBeLessThanOrEqual(1);
  }
});

test('regression: completed guest header fits at 320px and retains installation access', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await prepareNavigation(page, { completed: true });
  await page.goto('/'); await settleNavigation(page);
  await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await hitTarget(page.getByRole('link', { name: 'Settings', exact: true }))).toBe(true);
  expect(await hitTarget(page.getByRole('button', { name: 'Sign In', exact: true }))).toBe(true);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
});

test('guest Journal exposes Settings and direct Sign in at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await prepareNavigation(page);
  await page.goto('/journal'); await settleNavigation(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('button', { name: 'Sign In', exact: true }).first()).toBeVisible();
  await page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test.describe('signed-in iOS installation choices', () => {
  const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
  test.use({ userAgent, viewport, deviceScaleFactor, isMobile, hasTouch });
  for (const engine of ['', ' @webkit']) for (const choice of ['Later', 'Already added']) {
    test(`${choice} persists after a pointer choice in the account menu${engine}`, async ({ page }) => {
      await prepareNavigation(page, { pro: true, completed: true });
      await page.goto('/'); await settleNavigation(page);
      const account = page.getByRole('button', { name: 'User menu for Avery', exact: true });
      await account.click();
      await page.getByRole('menu').getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
      const guide = page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true });
      await expect(guide).toBeVisible();
      await guide.getByRole('button', { name: choice, exact: true }).tap();
      await expect.poll(() => page.evaluate(() => {
        const raw = localStorage.getItem('tableu-pwa-install-preferences');
        return raw ? JSON.parse(raw) : null;
      })).toMatchObject(choice === 'Already added' ? { hasAddedToHomeScreen: true } : { hasAddedToHomeScreen: false });
      if (choice === 'Later') {
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tableu-pwa-install-preferences')).snoozedUntil)).toBeGreaterThan(Date.now());
      }
      await expect(guide).toHaveCount(0);
      await expect(account).toBeFocused();
      await page.reload(); await settleNavigation(page); await account.click();
      await expect(page.getByRole('menu').getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
    });
  }
});

test('completed reading revisits show the selected step without losing completion facts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await prepareNavigation(page, { completed: true });
  await page.goto('/'); await settleNavigation(page);
  const progress = page.getByRole('navigation', { name: 'Tarot reading progress' });
  await progress.getByRole('button', { name: 'Step 1: Spread, completed', exact: true }).click();
  await expect(progress.getByRole('button', { name: 'Step 1: Spread', exact: true })).toHaveAttribute('aria-current', 'step');
  await progress.getByRole('button', { name: 'Step 4: Reading', exact: true }).click();
  await expect(progress.getByRole('button', { name: 'Step 4: Reading', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(progress.getByRole('button', { name: 'Step 1: Spread, completed', exact: true })).toBeAttached();
});

test('reading settings isolates chrome and returns focus when handset layout ends', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page);
  await page.goto('/'); await settleNavigation(page);
  await page.locator('[data-app-bottom-region]').getByRole('button', { name: 'Open reading preparation', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-app-header]')).toHaveAttribute('inert', '');
  await expect(page.locator('[data-app-bottom-region]')).toHaveAttribute('inert', '');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reading settings', exact: true })).toBeFocused();
  await expect(page.locator('[data-app-header]')).not.toHaveAttribute('inert', '');
});

test('quiet routes reserve only real contextual actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page);
  for (const path of ['/reset-password?token=synthetic-token', '/verify-email?token=synthetic-token', '/share/navigation-demo']) {
    await page.goto(path); await settleNavigation(page);
    await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
    if (path.startsWith('/reset')) await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    if (!path.startsWith('/share')) {
      expect(await page.locator('[data-app-chrome]').evaluate(e => parseFloat(getComputedStyle(e).getPropertyValue('--app-bottom-height')))).toBe(0);
    } else {
      await expect(page.getByRole('heading', { name: 'A shared reflection' })).toBeVisible();
      const row = page.locator('[data-app-bottom-region]');
      await expect(row.getByRole('link', { name: 'Start Reading', exact: true })).toBeVisible();
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-pad-bottom', '34px'));
      await expect.poll(() => row.evaluate(e => Math.abs(e.getBoundingClientRect().height - parseFloat(getComputedStyle(e.closest('[data-app-chrome]')).getPropertyValue('--app-bottom-height')))) ).toBeLessThanOrEqual(1);
      await scrollEnd(page);
      await expect(page.getByText('Create readings and track your tarot journey', { exact: true })).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(row).toBeHidden();
      await expect(page.locator('.share-desktop-actions')).toBeVisible();
      expect(await page.locator('.share-desktop-actions').evaluate(e => getComputedStyle(e.parentElement.parentElement.parentElement).position)).not.toBe('fixed');
    }
  }
});

for (const engine of ['', ' @webkit']) {
  test(`editable keyboard focus hides destinations while a viewport change alone preserves them${engine}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page, { populated: true });
    await page.goto('/journal'); await settleNavigation(page);
    await page.evaluate(() => {
      window.navigationViewportHeight = innerHeight;
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => window.navigationViewportHeight });
    });
    const changeHeight = height => page.evaluate(value => {
      window.navigationViewportHeight = value;
      visualViewport.dispatchEvent(new Event('resize'));
    }, height);
    const dock = page.locator('[data-destination-group="dock"]');
    const journal = dock.getByRole('link', { name: 'Journal', exact: true });
    await journal.focus();
    await changeHeight(420);
    await expect(dock).toBeVisible();
    await expect(journal).toBeFocused();
    await changeHeight(844); await expect(dock).toBeVisible();
    const search = page.locator('input[type="search"]'); await search.focus();
    await changeHeight(420); await expect(search).toBeFocused(); await expect(dock).toBeHidden();
    await expect.poll(() => search.evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
    await changeHeight(844); await expect(dock).toBeVisible(); await expect(search).toBeFocused();
    await expect.poll(() => search.evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844 - 49);
  });
}

for (const width of [1440, 390]) for (const theme of ['dark', 'light']) for (const pro of [false, true]) {
  for (const state of ['setup', 'completed', 'journal-populated', 'journal-empty', 'account']) {
    test(`visual: ${width} ${theme} ${pro ? 'pro' : 'guest'} ${state}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await prepareNavigation(page, { pro, theme, completed: state === 'completed', populated: state === 'journal-populated' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(state.startsWith('journal') ? '/journal' : state === 'account' ? '/account' : '/');
      await settleNavigation(page);
      if (pro) await expect(page.getByRole('button', { name: 'User menu for Avery', exact: true })).toBeVisible();
      if (state === 'completed') await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
      if (state === 'journal-populated') {
        await expect(page.getByRole('article').first()).toBeAttached();
        await page.locator('section[aria-labelledby^="reading-journey"]').first().waitFor({ state: 'attached' });
      }
      if (state === 'journal-empty') await expect(page.getByText('Journal entry preview', { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => [...document.images].filter(image => {
        const r = image.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
      }).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      await settleNavigation(page);
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const header = document.querySelector('[data-app-header]');
        return { header: box('[data-app-header]'), brand: box('.site-nav__brand'), account: box('.account-trigger, .guest-signin-button'), main: box('main'),
          normalHeight: header.getBoundingClientRect().height - parseFloat(getComputedStyle(header).paddingTop),
          visibleGroups: [...document.querySelectorAll('[data-destination-group]')].filter(e => !e.hidden && !e.inert).length,
          hiddenGroups: [...document.querySelectorAll('[data-destination-group]')].filter(e => e.hidden).map(e => e.inert),
          scrollWidth: document.documentElement.scrollWidth, bottomHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height')) };
      });
      expect(geometry.normalHeight).toBeGreaterThanOrEqual(55); expect(geometry.normalHeight).toBeLessThanOrEqual(57);
      expect(geometry.brand.x).toBeCloseTo(width === 1440 ? 208 : 16, 0);
      expect(geometry.account.right).toBeCloseTo(width - geometry.brand.x, 0);
      expect(geometry.visibleGroups).toBe(1); expect(geometry.hiddenGroups).toEqual([true]);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('visual.png'), fullPage: false, animations: 'disabled' });
      await writeFile(testInfo.outputPath('geometry.json'), JSON.stringify({ width, theme, pro, state, ...geometry }, null, 2));
    });
  }
}

test('regression: skipped ritual is never marked completed after draw', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page);
  await page.goto('/'); await settleNavigation(page);
  await page.getByRole('button', { name: 'Draw cards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Step 4: Reading', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('button', { name: 'Step 3: Ritual (optional), skipped', exact: true })).toBeAttached();
});

test('regression: Pricing upgrade and scrolled Journal controls clear destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page, { populated: true });
  await page.goto('/pricing'); await settleNavigation(page);
  expect(await hitTarget(page.getByRole('button', { name: 'Go Plus', exact: true }))).toBe(true);
  await page.goto('/journal'); await settleNavigation(page); await page.getByRole('article').first().waitFor(); await scrollEnd(page);
  const filters = page.getByRole('button', { name: 'Jump to journal filters' }); await expect(filters).toBeVisible();
  await expect.poll(() => hitTarget(filters)).toBe(true);
  await expect.poll(() => hitTarget(page.locator('[data-destination-nav="dock"] a[href="/journal"]'))).toBe(true);
});

for (const engine of ['', ' @webkit']) {
  test(`regression: breakpoint transfers destination focus in both directions${engine}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page); await page.goto('/journal'); await settleNavigation(page);
    await page.locator('[data-destination-nav="dock"] a[href="/journal"]').focus();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('[data-destination-nav="header"] a[href="/journal"]')).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-destination-nav="dock"] a[href="/journal"]')).toBeFocused();
    await expect(page.locator('[data-destination-group="header"]')).toHaveAttribute('hidden', '');
    await expect(page.locator('[data-destination-group="header"]')).toHaveAttribute('inert', '');
  });

  test(`regression: action fallback recovers after short landscape${engine}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page); await page.goto('/'); await settleNavigation(page);
    const region = page.locator('[data-app-bottom-region]');
    await page.setViewportSize({ width: 700, height: 360 });
    await expect(region).toHaveAttribute('data-actions-in-flow', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(region).toHaveAttribute('data-actions-in-flow', 'false');
    expect(await hitTarget(page.getByRole('button', { name: 'Draw cards', exact: true }))).toBe(true);
  });

  test(`regression: enlarged-text actions recover at the same final viewport${engine}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 }); await prepareNavigation(page, { pro: true });
    await page.goto('/'); await settleNavigation(page);
    await page.evaluate(() => document.documentElement.style.fontSize = '18px');
    await page.locator('#quick-intention').fill('Where can I make space for a quieter pace?');
    await page.locator('#quick-intention').blur();
    const region = page.locator('[data-app-bottom-region]');
    const measure = () => region.evaluate(element => ({
      placement: element.dataset.actionsInFlow,
      width: element.querySelector('[data-app-bottom-actions]').getBoundingClientRect().width,
      height: element.querySelector('[data-app-bottom-actions]').getBoundingClientRect().height,
      bottom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height')),
      overflow: document.documentElement.scrollWidth > innerWidth
    }));
    await page.setViewportSize({ width: 320, height: 600 });
    await expect(region).toHaveAttribute('data-actions-in-flow', 'false');
    const settledClearance = () => region.evaluate(element => Math.abs(
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height')) - element.getBoundingClientRect().height
    ));
    await expect.poll(settledClearance).toBeLessThan(0.5);
    const direct = await measure();
    await page.setViewportSize({ width: 700, height: 360 });
    await expect(region).toHaveAttribute('data-actions-in-flow', 'true');
    await page.setViewportSize({ width: 320, height: 600 });
    await expect(region).toHaveAttribute('data-actions-in-flow', 'false');
    await expect.poll(settledClearance).toBeLessThan(0.5);
    const returned = await measure();
    expect(returned).toEqual(direct);
    expect(returned.overflow).toBe(false);
    expect(await hitTarget(page.getByRole('button', { name: 'Draw cards', exact: true }))).toBe(true);
    await writeFile(testInfo.outputPath('enlarged-text-recovery.json'), JSON.stringify({ direct, returned }, null, 2));
    await page.screenshot({ path: testInfo.outputPath('recovered.png'), animations: 'disabled' });
  });

  test(`regression: Account last action clears a 34px safe area${engine}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page); await page.goto('/account'); await settleNavigation(page);
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-pad-bottom', '34px'));
    await expect.poll(async () => { await scrollEnd(page); return hitTarget(page.getByRole('link', { name: 'Back to reading', exact: true }).last()); }).toBe(true);
  });
}

test('regression: Gallery and shared-reading headers remain pinned', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page, { populated: true });
  for (const path of ['/journal/gallery', '/share/navigation-demo']) {
    await page.goto(path); await settleNavigation(page);
    if (path.includes('/share/')) await expect(page.getByRole('heading', { name: 'A shared reflection' })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await expect.poll(() => page.locator('[data-app-header]').evaluate(e => e.getBoundingClientRect().top)).toBe(0);
  }
});

test('real generating and follow-up labels respect the provisional height budgets', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 700 });
  const fixture = await createNarrativeFixture(page);
  const measurements = [];
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: '## Opening\n\nThe Star makes space for a quieter pace.' });
    const region = page.locator('[data-app-bottom-region]');
    await expect(region.getByRole('button', { name: 'Cancel generation', exact: true })).toBeVisible();
    for (const stage of ['generating', 'follow-up']) {
      if (stage === 'follow-up') {
        await fixture.completeReading();
        await expect(region.getByRole('button', { name: 'Ask about this reading', exact: true })).toBeVisible();
      }
      for (const viewport of [{ width: 320, height: 700 }, { width: 700, height: 360 }]) {
        await page.setViewportSize(viewport); await settleNavigation(page);
        const measurement = await page.evaluate(() => {
          const region = document.querySelector('[data-app-bottom-region]');
          const header = document.querySelector('[data-app-header]');
          const height = element => element.getBoundingClientRect().height;
          const headerHeight = getComputedStyle(header).position === 'sticky' ? height(header) : 0;
          const bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height'));
          const secondary = [...document.querySelectorAll('[data-app-secondary][data-chrome-pinned="true"]')].reduce((sum, e) => sum + height(e), 0);
          return { width: innerWidth, height: innerHeight, header: headerHeight, bottom, secondary,
            actionsInFlow: region.dataset.actionsInFlow, labels: [...region.querySelectorAll('button')].map(b => b.textContent.trim()), scrollWidth: document.documentElement.scrollWidth };
        });
        measurements.push({ stage, ...measurement });
        expect(measurement.bottom).toBeLessThanOrEqual(viewport.height * 0.25 + 1);
        expect(measurement.header + measurement.bottom + measurement.secondary).toBeLessThanOrEqual(viewport.height * (viewport.height < 500 ? 0.25 : 0.4) + 1);
        expect(measurement.scrollWidth).toBeLessThanOrEqual(viewport.width);
        await page.screenshot({ path: testInfo.outputPath(`${stage}-${viewport.width}.png`), animations: 'disabled' });
        if (measurement.actionsInFlow === 'true') {
          // A flow row can intersect the layout viewport while still sitting
          // behind the fixed destinations. Exercise its page-end clearance.
          await scrollEnd(page);
          await settleNavigation(page);
          for (const action of await region.getByRole('button').all()) {
            await expect.poll(() => hitTarget(action), { message: 'Flow actions remain reachable above the dock' }).toBe(true);
          }
          await page.screenshot({ path: testInfo.outputPath(`${stage}-${viewport.width}-actions.png`), animations: 'disabled' });
        }
      }
      await page.setViewportSize({ width: 320, height: 700 });
    }
    await writeFile(testInfo.outputPath('budgets.json'), JSON.stringify(measurements, null, 2));
  } finally { await fixture.close(); }
});
