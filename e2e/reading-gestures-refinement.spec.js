import { test, expect } from '@playwright/test';

const focusArt = page => page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});

test('held and reduced-motion details remain distinguishable on bright artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__e2e/reading-gestures?associations=dynamic&arrival=complete');
  await page.locator('[data-gesture-id]').filter({ hasText: /^pool$/ }).click();
  const art = focusArt(page);
  await expect(art).toHaveAttribute('data-held', 'true');
  await expect(art.locator('.gesture-art__image')).toHaveCSS('opacity', '1');
  const illuminated = await art.screenshot();
  await art.locator('.gesture-art__light').evaluate(element => { element.style.visibility = 'hidden'; });
  const unaccompanied = await art.screenshot();
  // Compare rendered pixels, rather than accepting a present but invisible mask.
  const difference = await page.evaluate(async ([first, second]) => {
    const pixels = async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const [a, b] = await Promise.all([pixels(first), pixels(second)]);
    const width = Math.round(Math.sqrt(a.length / 4 * 3 / 5));
    const height = a.length / 4 / width;
    const region = (x, y, radius = 3) => {
      const samples = [];
      for (let row = Math.round(y * height) - radius; row <= Math.round(y * height) + radius; row++) {
        for (let column = Math.round(x * width) - radius; column <= Math.round(x * width) + radius; column++) {
          const index = (row * width + column) * 4;
          samples.push((b[index] + b[index + 1] + b[index + 2] - a[index] - a[index + 1] - a[index + 2]) / 3);
        }
      }
      return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    };
    return { mean: a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length,
      surroundDarkening: region(.8, .2), detailDarkening: region(.275, .70) };
  }, [illuminated.toString('base64'), unaccompanied.toString('base64')]);
  // The described pool stays bright while unrelated sky recedes visibly.
  // A whole-image delta alone could pass with a barely perceptible haze.
  expect(difference.mean).toBeGreaterThan(5);
  expect(difference.surroundDarkening).toBeGreaterThan(20);
  expect(Math.abs(difference.detailDarkening)).toBeLessThan(8);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
});

test('phone targets stay usable and both planted swords fit the return frame @mobile', async ({ page }) => {
  for (const height of [667, 568]) {
    await page.setViewportSize({ width: 375, height });
    await page.goto('/__e2e/reading-gestures?associations=authored&study=five-card&arrival=complete');
    await expect(page.locator('[data-gesture-shelf] button:enabled')).toHaveCount(5);
    for (const button of await page.locator('[data-gesture-shelf] button').all()) {
      const target = await button.boundingBox();
      const artwork = await button.locator('.gesture-art').boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(artwork.width).toBe(height < 600 ? 29 : 40);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.locator('[data-gesture-id]').filter({ hasText: 'Write down the two missing swords' }).click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(focusArt(page).locator('[data-reversed]')).toHaveAttribute('data-reversed', 'true');
    const visibleSwords = await page.locator('[data-gesture-window]').evaluate(window => {
      const frame = window.getBoundingClientRect();
      return [...window.querySelectorAll('.gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art__trace')].map(path => {
        const bounds = path.getBBox();
        const transform = path.getScreenCTM();
        return [new DOMPoint(bounds.x, bounds.y), new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height)]
          .map(point => point.matrixTransform(transform))
          .every(point => point.x >= frame.left && point.x <= frame.right && point.y >= frame.top && point.y <= frame.bottom);
      });
    });
    expect(visibleSwords).toEqual([true, true]);
  }
});

test('card names remain prose while the shelf and meaningful details stay keyboard accessible', async ({ page }) => {
  await page.goto('/__e2e/reading-gestures?associations=dynamic&study=five-card&arrival=complete');
  const identities = page.locator('.reading-gesture-identity');
  await expect(identities.first()).toBeVisible();
  expect(await identities.count()).toBeGreaterThan(5);
  for (const identity of await identities.all()) {
    await expect(identity).not.toHaveAttribute('role', 'button');
    await expect(identity).not.toHaveAttribute('tabindex', '0');
    await expect(identity).toHaveCSS('text-decoration-line', 'none');
  }
  const shelf = page.locator('[data-gesture-shelf] button').first();
  await shelf.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
  await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveAttribute('data-details', '');
  const detail = page.locator('[data-gesture-id][role="button"]').filter({ hasText: /sprouting leaves/ }).first();
  await detail.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveAttribute('data-details', 'sprout');
});

test('short phone frames retain the Emperor scepter and Justice scale extents @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, phrase] of [['The Emperor', 'scepter'], ['Justice', 'scales']]) {
    await page.goto(`/__e2e/reading-gestures?study=deck&card=${encodeURIComponent(name)}&arrival=complete`);
    await page.locator('[data-gesture-id][role="button"]').filter({ hasText: phrase }).click();
    const bounds = await focusArt(page).evaluate(art => {
      const frame = art.getBoundingClientRect();
      const spot = art.querySelector('mask ellipse');
      const transform = art.querySelector('.gesture-art__light').getScreenCTM();
      const y = Number(spot.getAttribute('cy')), radius = Number(spot.getAttribute('ry'));
      return [y - radius, y + radius].map(y => new DOMPoint(Number(spot.getAttribute('cx')), y).matrixTransform(transform).y)
        .every(y => y >= frame.top && y <= frame.bottom);
    });
    expect(bounds).toBe(true);
    await expect(page.locator('[data-gesture-window]')).toHaveCSS('height', '72px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  }
});
