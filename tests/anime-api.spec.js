// @ts-check
/* global window */
import { test, expect } from '@playwright/test';

/**
 * Anime.js V4 API Verification Tests
 *
 * These tests verify the actual Anime.js V4 API works as expected
 * before migrating from Framer Motion.
 */

test.describe('Anime.js V4 API Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/anime-v4-api-test.html');
    // Wait for anime.js to load
    await page.waitForFunction(() => typeof /** @type {any} */ (window).anime !== 'undefined', { timeout: 5000 });
  });

  test('Test 1: Basic animate() with transforms', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test1-result)');

    // Wait for result
    await expect(page.locator('#test1-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test1-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 1:', result);
  });

  test('Test 2: CSS filter animation (blur)', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test2-result)');

    // Filter animation takes 1500ms
    await expect(page.locator('#test2-result')).toHaveClass(/success/, { timeout: 8000 });

    const result = await page.locator('#test2-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 2:', result);
  });

  test('Test 3: spring() spring physics', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test3-result)');

    await expect(page.locator('#test3-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test3-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 3:', result);
  });

  test('Test 4: stagger() with from center', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test4-result)');

    await expect(page.locator('#test4-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test4-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 4:', result);
  });

  test('Test 5: createTimeline() sequencing', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test5-result)');

    await expect(page.locator('#test5-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test5-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 5:', result);
  });

  test('Test 6: Promise-based completion', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test6-result)');

    await expect(page.locator('#test6-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test6-result').textContent();
    expect(result).toContain('SUCCESS');
    // Check which completion API works
    console.log('Test 6:', result);
  });

  test('Test 7: Function values for card fan', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test7-result)');

    await expect(page.locator('#test7-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test7-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 7:', result);
  });

  test('Test 8: splitText() text animation', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test8-result)');

    await expect(page.locator('#test8-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test8-result').textContent();
    // May succeed with splitText or fallback - both are acceptable
    expect(result).toMatch(/SUCCESS|worked/);
    console.log('Test 8:', result);
  });

  test('Test 9: set() instant properties', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test9-result)');

    await expect(page.locator('#test9-result')).toHaveClass(/success/, { timeout: 5000 });

    const result = await page.locator('#test9-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 9:', result);
  });

  test('Test 10: Ink-spread card reveal', async ({ page }) => {
    await page.click('button:has-text("Run Test"):near(#test10-result)');

    // This animation has multiple phases
    await expect(page.locator('#test10-result')).toHaveClass(/success/, { timeout: 8000 });

    const result = await page.locator('#test10-result').textContent();
    expect(result).toContain('SUCCESS');
    console.log('Test 10:', result);
  });

  test('Test 11: Playback controls', async ({ page }) => {
    // Start animation
    await page.click('button:has-text("Start"):near(#test11-result)');

    // Wait a bit then pause
    await page.waitForTimeout(500);
    await page.click('button:has-text("Pause"):near(#test11-result)');

    const pausedResult = await page.locator('#test11-result').textContent();
    expect(pausedResult).toContain('Paused');

    // Resume
    await page.click('button:has-text("Play"):near(#test11-result)');
    await page.waitForTimeout(200);

    // Reverse
    await page.click('button:has-text("Reverse"):near(#test11-result)');
    const reversedResult = await page.locator('#test11-result').textContent();
    expect(reversedResult).toContain('Reversed');

    console.log('Test 11: Playback controls work');
  });
});

// Summary test that logs all available exports
test('Log Anime.js V4 exports', async ({ page }) => {
  await page.goto('/tests/anime-v4-api-test.html');
  await page.waitForFunction(() => typeof /** @type {any} */ (window).anime !== 'undefined');

  const exports = await page.evaluate(() => {
    return Object.keys(/** @type {any} */(window).anime).sort();
  });

  console.log('\n========================================');
  console.log('Anime.js V4 Available Exports:');
  console.log('========================================');
  console.log(exports.join('\n'));
  console.log('========================================\n');

  // Verify critical exports exist
  expect(exports).toContain('animate');
  expect(exports).toContain('createTimeline');
  expect(exports).toContain('stagger');
  expect(exports).toContain('set');
  expect(exports).toContain('spring');
});
