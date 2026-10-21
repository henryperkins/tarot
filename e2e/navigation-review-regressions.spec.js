import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation, expectCanvasProgressGeometry, DEMO_READING } from './helpers/navigationFixtures.js';
import { createNarrativeFixture, startReading, openReadingSupport } from './helpers/narrativeFixtures.js';

for (const width of [320, 390]) for (const completed of [false, true]) for (const theme of ['dark', 'light']) {
  test(`enlarged canvas progress labels stay inside independent targets: ${width}px ${completed ? 'completed' : 'setup'} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await prepareNavigation(page, { completed, theme });
    await page.goto('/');
    await settleNavigation(page);
    const sizes = [];
    for (const percent of [100, 200, 100]) {
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, percent);
      await settleNavigation(page);
      const geometry = await expectCanvasProgressGeometry(page);
      sizes.push({ percent, geometry });
      const progress = page.getByRole('navigation', { name: 'Tarot reading progress', exact: true });
      const buttons = progress.getByRole('button');
      await expect(buttons).toHaveCount(4);
      await expect(progress.locator('[aria-current="step"]')).toHaveCount(1);
      if (completed) {
        await expect(buttons.nth(0)).toHaveAccessibleName('Step 1: Spread, completed');
        await expect(buttons.nth(1)).toHaveAccessibleName('Step 2: Intent (question), completed');
        await expect(buttons.nth(2)).toHaveAccessibleName('Step 3: Ritual (optional), skipped');
        await expect(buttons.nth(2).locator('.step-progress-canvas__skipped')).toBeVisible();
        await expect(buttons.nth(3)).toHaveAttribute('aria-current', 'step');
      } else {
        await expect(progress.locator('[data-step-state="upcoming"]')).not.toHaveCount(0);
        await expect(progress.locator('[data-step-state="completed"]')).toHaveCount(0);
        await expect(buttons.nth(2)).toHaveAccessibleName('Step 3: Ritual (optional), skipped');
      }
      await buttons.first().focus();
      for (let i = 0; i < 4; i++) {
        await expect(buttons.nth(i)).toBeFocused();
        await expect(buttons.nth(i)).toBeInViewport({ ratio: 1 });
        await expect(buttons.nth(i)).toHaveCSS('outline-style', 'solid');
        await page.keyboard.press('Tab');
      }
      await expect(page.locator('.canvas-progress__settings')).toBeFocused();
      if (percent === 200) await page.screenshot({ path: testInfo.outputPath('enlarged-progress.png'), animations: 'disabled' });
    }
    const normal = sizes[0].geometry.slice(0, 4).map(target => target.box);
    expect(Math.min(...normal.map(box => box.bottom)) - Math.max(...normal.map(box => box.top)),
      'All four normal targets must share one horizontal row, including the taller skipped annotation').toBeGreaterThan(0);
    // Browser scroll anchoring may move the whole canvas as text shrinks.
    // Compare its layout and label offsets independently of document scrolling.
    const relativeGeometry = targets => targets.map(target => ({
      name: target.name,
      left: target.box.left, top: target.box.top - targets[0].box.top,
      width: target.box.width, height: target.box.height,
      labels: target.labels.map(label => ({ text: label.text,
        left: label.box.left - target.box.left, top: label.box.top - target.box.top,
        width: label.box.width, height: label.box.height }))
    }));
    expect(relativeGeometry(sizes[2].geometry)).toEqual(relativeGeometry(sizes[0].geometry));
    await testInfo.attach('progress-geometry', { body: JSON.stringify(sizes), contentType: 'application/json' });
  });
}

async function expectVisiblePageFocus(page) {
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    const box = active?.getBoundingClientRect();
    return Boolean(active && active !== document.body && !active.closest('[hidden], [inert], [aria-hidden="true"]')
      && box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight);
  })).toBe(true);
}

async function expectPreparationReleased(page) {
  await expect(page.locator('[data-reading-settings-drawer]')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Skip ritual confirmation', includeHidden: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.tableuOverlayGuard))).toBe(false);
  await expect.poll(() => page.evaluate(() => !document.body.style.overflow && !document.body.style.position
    && !document.querySelector('main')?.closest('[inert], [aria-hidden="true"]'))).toBe(true);
  await expectVisiblePageFocus(page);
}

test.describe('drawer preparation lifetime @mobile', () => {
  for (const close of ['Escape', 'close button', 'Done', 'backdrop', 'Back', 'desktop transition']) {
    test(`closing preparation clears its descendant ritual confirmation guard: ${close}`, async ({ page }) => {
      await prepareNavigation(page, { completed: true, rituals: true });
      await page.goto('/journal');
      await settleNavigation(page);
      await page.locator('[data-destination-group="dock"]').getByRole('link', { name: 'Reading', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('.narrative-stream')).toContainText('The Star invites a gentler pace.');
      const entry = await page.evaluate(() => ({ idx: history.state.idx, key: history.state.key }));
      await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
      const drawer = page.locator('[data-reading-settings-drawer]');
      await drawer.getByRole('tab', { name: 'Ritual', exact: true }).click();
      await drawer.getByRole('button', { name: 'Skip', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: 'Skip ritual confirmation', exact: true });
      await expect(confirmation).toBeAttached();
      await expect.poll(() => page.evaluate(() => Boolean(history.state?.tableuOverlayGuard))).toBe(true);
      if (close === 'Escape') await page.keyboard.press('Escape');
      else if (close === 'close button') await drawer.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      else if (close === 'Done') await drawer.getByRole('button', { name: 'Done', exact: true }).click();
      else if (close === 'backdrop') await drawer.locator('[data-modal-backdrop]').click({ position: { x: 4, y: 4 } });
      else if (close === 'desktop transition') await page.setViewportSize({ width: 1440, height: 1000 });
      else {
        await page.goBack();
        await expect(confirmation).toHaveCount(0);
        await expect(drawer).toBeVisible();
        await expect.poll(() => page.evaluate(() => Boolean(history.state?.tableuOverlayGuard))).toBe(true);
        await page.goBack();
      }
      await expectPreparationReleased(page);
      expect(await page.evaluate(() => ({ idx: history.state.idx, key: history.state.key }))).toEqual(entry);
      await page.goBack();
      await expect(page).toHaveURL(/\/journal$/);
      await page.goForward();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('dialog', { name: 'Skip ritual confirmation', includeHidden: true })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => Boolean(history.state?.tableuOverlayGuard))).toBe(false);
    });
  }

  for (const phase of ['setup', 'pending', 'completed']) {
    test(`Ritual progress opens preparation on the requested tab: ${phase}`, async ({ page }) => {
      await prepareNavigation(page, { completed: phase === 'completed', rituals: true });
      const fixture = phase === 'pending' ? await createNarrativeFixture(page, { signedOut: true }) : null;
      const cancellations = [];
      page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/cancel')) cancellations.push(request.url()); });
      try {
        if (fixture) await startReading(page, fixture, { complete: false });
        else await page.goto('/');
        await settleNavigation(page);
        const ritual = page.getByRole('navigation', { name: 'Tarot reading progress', exact: true }).getByRole('button', { name: /^Step 3: Ritual/ });
        const drawer = page.locator('[data-reading-settings-drawer]');
        for (let attempt = 0; attempt < 2; attempt++) {
          await ritual.click();
          await expect(drawer.getByRole('tab', { name: 'Ritual', exact: true })).toHaveAttribute('aria-selected', 'true');
          await expect(drawer.getByRole('tab', { name: 'Deck', exact: true })).toHaveAttribute('aria-selected', 'false');
          await drawer.getByRole('tab', { name: 'Deck', exact: true }).click();
          await drawer.getByRole('button', { name: 'Done', exact: true }).click();
          await expectPreparationReleased(page);
        }
        // Change deck explicitly requests Deck. Revisit Intent to expose that
        // existing opener during pending/completed cinematic reading phases.
        await page.getByRole('button', { name: /^Step 2: Intent/ }).click();
        await page.getByRole('button', { name: 'Change deck', exact: true }).click();
        await expect(drawer.getByRole('tab', { name: 'Deck', exact: true })).toHaveAttribute('aria-selected', 'true');
        await drawer.getByRole('button', { name: 'Done', exact: true }).click();
        await expectPreparationReleased(page);
        if (phase !== 'setup') await page.getByRole('button', { name: /^Step 4: Read/ }).click();
        if (fixture) {
          expect(fixture.requests.reading).toHaveLength(1);
          expect(cancellations).toEqual([]);
          await expect(page.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Cancel generation', exact: true })).toBeEnabled();
          await fixture.completeReading();
          expect(fixture.requests.reading).toHaveLength(1);
        } else if (phase === 'completed') {
          await expect(page.locator('.narrative-stream')).toContainText('The Star invites a gentler pace.');
          expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot')).question)).toBe(DEMO_READING.question);
        }
      } finally { await fixture?.close(); }
    });
  }

  test('closing preparation preserves question, selected deck, knocks and cut', async ({ page }) => {
    await prepareNavigation(page, { rituals: true });
    await page.goto('/');
    await settleNavigation(page);
    await page.locator('#quick-intention').fill('How can I protect a quiet morning?');
    await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
    const drawer = page.locator('[data-reading-settings-drawer]');
    const deck = drawer.getByRole('radio', { name: /Thoth/ });
    await deck.click();
    await expect(deck).toHaveAttribute('aria-checked', 'true');
    await drawer.getByRole('tab', { name: 'Ritual', exact: true }).click();
    for (let i = 1; i <= 3; i++) await drawer.getByRole('button', { name: `Knock ${i} of 3`, exact: true }).click();
    await drawer.getByRole('slider', { name: 'Cut position', exact: true }).fill('7');
    await drawer.getByRole('button', { name: 'Confirm cut at position 7', exact: true }).click();
    await drawer.getByRole('button', { name: 'Done', exact: true }).click();
    await expectPreparationReleased(page);
    await expect(page.locator('#quick-intention')).toHaveValue('How can I protect a quiet morning?');
    await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
    await expect(deck).toHaveAttribute('aria-checked', 'true');
    await drawer.getByRole('tab', { name: 'Ritual', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Deck cleared with 3 knocks', exact: true })).toBeVisible();
    await expect(drawer.getByRole('slider', { name: 'Cut position', exact: true })).toHaveValue('7');
    await expect(drawer.getByRole('button', { name: 'Update cut at position 7', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await drawer.getByRole('button', { name: 'Done', exact: true }).click();
    await expectPreparationReleased(page);
  });

  test('Ritual progress falls back to Deck when rituals are disabled', async ({ page }) => {
    await prepareNavigation(page, { completed: true });
    await page.goto('/');
    await settleNavigation(page);
    await page.getByRole('button', { name: /^Step 3: Ritual/ }).click();
    const drawer = page.locator('[data-reading-settings-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('tab')).toHaveCount(0);
    await expect(drawer.getByRole('radiogroup', { name: 'Choose your deck style' })).toBeVisible();
  });
});

test.describe('landscape chrome measurement', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('natural fixed-size measurement preserves flow scroll positions', async ({ page }, testInfo) => {
    await prepareNavigation(page); await page.goto('/'); await settleNavigation(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const actions = page.locator('[data-app-bottom-actions]');
    const draw = actions.getByRole('button', { name: 'Draw cards', exact: true });
    await draw.locator('span').evaluate(element => { element.textContent = 'Draw cards for your daily reflection'; });
    await actions.getByRole('button', { name: 'Open guided intention coach', exact: true }).locator('span')
      .evaluate(element => { element.textContent = 'Guided intention coaching'; });
    await expect(page.locator('[data-app-bottom-region]')).toHaveAttribute('data-actions-in-flow', 'true');
    await settleNavigation(page); await draw.focus(); await settleNavigation(page);
    const before = await draw.evaluate(button => {
      const group = button.parentElement;
      group.scrollLeft = group.scrollWidth;
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      return { x: group.scrollLeft, y: scrollY };
    });
    expect(before.x).toBeGreaterThan(50);
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-pad-top', '12px'));
    await settleNavigation(page);
    const after = await draw.evaluate(button => ({ x: button.parentElement.scrollLeft, y: scrollY,
      button: button.getBoundingClientRect().toJSON(), group: button.parentElement.getBoundingClientRect().toJSON() }));
    await testInfo.attach('scroll-positions', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeGreaterThanOrEqual(before.y - 1);
    expect(after.button.right).toBeLessThanOrEqual(after.group.right);
  });

  test('shared header keeps 56px plus the safe area in short landscape', async ({ page }) => {
    await prepareNavigation(page);
    for (const path of ['/', '/journal', '/account']) {
      await page.goto(path); await settleNavigation(page);
      for (const top of [0, 12]) {
        await page.evaluate(value => document.documentElement.style.setProperty('--safe-pad-top', `${value}px`), top);
        await expect.poll(() => page.locator('[data-app-header]').evaluate(element => element.getBoundingClientRect().height)).toBe(56 + top);
      }
    }
  });
});

test('a dock resize keeps a partially visible focused input above chrome', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareNavigation(page, { populated: true });
  await page.goto('/journal');
  // Its delayed panel sits above the search field. Establish the loaded layout
  // before deliberately clipping the focused input for this resize regression.
  await page.getByRole('button', { name: 'See Full Journey', exact: false }).waitFor({ state: 'attached' });
  await settleNavigation(page);
  const search = page.locator('input[type="search"]');
  await search.focus(); await settleNavigation(page);
  const before = await search.evaluate(element => {
    scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 15, behavior: 'instant' });
    const bounds = element.getBoundingClientRect().toJSON();
    document.documentElement.style.setProperty('--safe-pad-bottom', '34px');
    return { bounds, height: innerHeight };
  });
  expect(before.bounds.top).toBeLessThan(before.height);
  expect(before.bounds.bottom).toBeGreaterThan(before.height);
  await expect.poll(() => search.evaluate(element => element.getBoundingClientRect().bottom
    - (innerHeight - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height')) - 16))).toBeLessThanOrEqual(1);
  await expect(search).toBeFocused();
});

test('a dock resize preserves deliberate scrolling away from a focused page input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareNavigation(page, { populated: true });
  await page.goto('/journal');
  await page.getByRole('button', { name: 'See Full Journey', exact: false }).waitFor({ state: 'attached' });
  await settleNavigation(page);
  const search = page.locator('input[type="search"]');
  await search.focus(); await settleNavigation(page);
  const before = await page.evaluate(() => {
    scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    return scrollY;
  });
  expect(before).toBeGreaterThan(500);
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-pad-bottom', '34px'));
  await expect.poll(() => page.locator('[data-destination-group="dock"]').evaluate(e => parseFloat(getComputedStyle(e).paddingBottom))).toBe(34);
  await settleNavigation(page);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before - 1);
  await expect(search).toBeFocused();
});

test('reading wayfinding stays stable at the final section and canvas Settings remains clickable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await openReadingSupport(page);
    const panel = page.locator('.spread-patterns-panel');
    const insights = panel.getByRole('button', { name: /^Spread Insights/ });
    if (await insights.count() && await insights.getAttribute('aria-expanded') === 'false') await insights.click();
    const details = panel.getByRole('button', { name: /^More spread details/ });
    if (await details.count() && await details.getAttribute('aria-expanded') === 'false') await details.click();
    await page.getByRole('button', { name: 'Reading settings', exact: true }).click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { name: 'Account & Settings', exact: true })).toBeVisible();
  } finally { await fixture.close(); }
});

test('Gallery desktop controls pin below the shared header and recover after height fallback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepareNavigation(page, { pro: true, populated: true });
  await page.goto('/journal/gallery'); await settleNavigation(page);
  const toolbar = page.locator('.gallery-toolbar');
  await expect(toolbar).toHaveCSS('position', 'sticky');
  await page.evaluate(() => scrollTo({ top: 800, behavior: 'instant' }));
  await expect.poll(() => toolbar.evaluate(element => element.getBoundingClientRect().top)).toBe(56);
  for (const viewport of [{ width: 1023, height: 1000 }, { width: 1440, height: 699 }]) {
    await page.setViewportSize(viewport);
    await expect(toolbar).toHaveCSS('position', 'relative');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(toolbar).toHaveCSS('position', 'sticky');
  await expect.poll(() => toolbar.evaluate(element => element.getBoundingClientRect().top)).toBe(56);
  await toolbar.getByRole('combobox', { name: 'Filter by suit', exact: true }).selectOption('major');
  await toolbar.getByRole('button', { name: 'Found', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: 'Found', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('shared-reading contextual links hand keyboard focus over in both responsive directions', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 }); await prepareNavigation(page);
  await page.goto('/share/navigation-demo'); await settleNavigation(page);
  await expect(page.getByRole('heading', { name: 'A shared reflection', exact: true })).toBeVisible();
  const mobile = page.locator('[data-app-bottom-actions]');
  const desktop = page.locator('.share-desktop-actions');
  for (const name of ['Start Reading', 'Sign In']) {
    await mobile.getByRole('link', { name, exact: true }).focus();
    await page.setViewportSize({ width: 769, height: 1000 });
    const desktopLink = desktop.getByRole('link', { name, exact: true });
    await expect(desktopLink).toBeFocused();
    await expect(desktopLink).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 768, height: 1000 });
    const mobileLink = mobile.getByRole('link', { name, exact: true });
    await expect(mobileLink).toBeFocused();
    await expect(mobileLink).toBeInViewport({ ratio: 1 });
    await expect(desktop).toHaveAttribute('hidden', '');
    await expect(desktop).toHaveAttribute('inert', '');
    await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
  }
});

for (const completed of [false, true]) test(`a ${completed ? 'completed' : 'setup'} reading action without a desktop copy hands focus to the canvas`, async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 }); await prepareNavigation(page, { completed, pro: true });
  await page.goto('/'); await settleNavigation(page);
  const settings = page.locator('[data-app-bottom-actions]').getByRole('button', { name: completed ? 'Ask about this reading' : 'Open reading preparation', exact: true });
  await settings.focus(); await expect(settings).toBeFocused();
  await page.setViewportSize({ width: 769, height: 1000 });
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    const bounds = active?.getBoundingClientRect();
    return Boolean(active?.matches('main h1, main h2, #main-content') && !active.closest('[hidden], [inert]')
      && bounds.height > 0 && bounds.top >= 0 && bounds.top < innerHeight && bounds.bottom > 0);
  })).toBe(true);
  await expect(page.locator('[data-app-bottom-region]')).toBeHidden();
});
