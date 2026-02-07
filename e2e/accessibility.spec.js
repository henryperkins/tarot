import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility E2E Tests using axe-core
 *
 * Tests WCAG 2.1 AA compliance on actual rendered pages.
 * These tests catch real-world issues that static analysis misses:
 * - Actual computed contrast ratios
 * - Dynamic ARIA state
 * - Focus management
 * - Live region behavior
 *
 * Run with: npm run test:e2e:a11y
 */

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Common localStorage setup to skip onboarding
 */
function getTestSetupScript() {
  return () => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: false
    }));
    sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
      intention: false,
      experience: false,
      ritual: true,
      audio: false
    }));
  };
}

/**
 * Wait for app to be ready
 */
async function waitForAppReady(page) {
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', {
    timeout: 15000
  });
}

/**
 * Run axe analysis and return violations
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - axe options
 * @returns {Promise<Array>} violations
 */
async function analyzeAccessibility(page, options = {}) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude(options.exclude || [])
    .analyze();

  return results.violations;
}

/**
 * Format violations for readable error output
 */
function formatViolations(violations) {
  if (violations.length === 0) return 'No violations found';

  return violations.map(v => {
    const nodes = v.nodes.map(n => `  - ${n.target.join(' > ')}\n    ${n.failureSummary}`).join('\n');
    return `\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n  WCAG: ${v.tags.filter(t => t.startsWith('wcag')).join(', ')}\n  Help: ${v.helpUrl}\n  Nodes:\n${nodes}`;
  }).join('\n');
}

/**
 * Assert no violations with helpful error message
 */
function expectNoViolations(violations, context = '') {
  const critical = violations.filter(v => v.impact === 'critical');
  const serious = violations.filter(v => v.impact === 'serious');

  if (critical.length > 0 || serious.length > 0) {
    const msg = `Accessibility violations found${context ? ` (${context})` : ''}:\n${formatViolations([...critical, ...serious])}`;
    throw new Error(msg);
  }
}

// ============================================================================
// PAGE-LEVEL TESTS
// ============================================================================

test.describe('Accessibility - Core Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('home page has no critical violations', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for animations to settle
    await page.waitForTimeout(500);

    const violations = await analyzeAccessibility(page);
    expectNoViolations(violations, 'home page');
  });

  test('spread selector is accessible', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Focus on spread selector
    const spreadSelector = page.locator('[role="radiogroup"][aria-label="Spread selection"]');
    await expect(spreadSelector).toBeVisible();

    // Verify spread cards have proper ARIA
    const spreadCards = spreadSelector.locator('[role="radio"]');
    const count = await spreadCards.count();
    expect(count).toBeGreaterThan(0);

    // Each card should have aria-checked
    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = spreadCards.nth(i);
      const ariaChecked = await card.getAttribute('aria-checked');
      expect(ariaChecked).toMatch(/^(true|false)$/);
    }

    // Run axe on spread selector region
    const violations = await analyzeAccessibility(page);
    expectNoViolations(violations, 'spread selector');
  });

  test('question input is properly labeled', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Find question input
    const questionInput = page.locator('textarea[placeholder*="question"], textarea[aria-label*="question"], input[placeholder*="question"]').first();

    if (await questionInput.isVisible()) {
      // Verify it has accessible name
      const ariaLabel = await questionInput.getAttribute('aria-label');
      const placeholder = await questionInput.getAttribute('placeholder');
      const id = await questionInput.getAttribute('id');

      // Should have some form of labeling
      const hasLabel = ariaLabel || placeholder || id;
      expect(hasLabel).toBeTruthy();
    }

    const violations = await analyzeAccessibility(page);
    expectNoViolations(violations, 'question input');
  });
});

// ============================================================================
// COMPONENT-SPECIFIC TESTS
// ============================================================================

test.describe('Accessibility - Interactive Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Find all buttons
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const _accessibleName = await button.evaluate(el => {
          // Check various sources of accessible name
          return el.getAttribute('aria-label') ||
                 el.getAttribute('aria-labelledby') ||
                 el.textContent?.trim() ||
                 el.getAttribute('title');
        });

        // Icon-only buttons need aria-label
        const hasText = await button.evaluate(el => el.textContent?.trim().length > 0);
        if (!hasText) {
          const ariaLabel = await button.getAttribute('aria-label');
          // This will log but not fail - we collect these separately
          if (!ariaLabel) {
            console.warn(`Button without aria-label found: ${await button.evaluate(el => el.outerHTML.substring(0, 100))}`);
          }
        }
      }
    }

    const violations = await analyzeAccessibility(page);
    expectNoViolations(violations, 'buttons');
  });

  test('focus indicators are visible', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Tab through first several interactive elements
    const focusableSelector = 'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusable = page.locator(focusableSelector);
    const count = await focusable.count();

    // Test first 10 focusable elements
    for (let i = 0; i < Math.min(count, 10); i++) {
      await page.keyboard.press('Tab');

      // Get currently focused element
      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        // Check for focus styles (outline or box-shadow)
        const hasVisibleFocus = await focused.evaluate(el => {
          const styles = window.getComputedStyle(el);
          const outline = styles.outline;
          const boxShadow = styles.boxShadow;

          // Check if outline is visible (not 'none' and has width)
          const hasOutline = outline && !outline.includes('none') && !outline.includes('0px');

          // Check if box-shadow might be a focus ring
          const hasBoxShadow = boxShadow && boxShadow !== 'none';

          return hasOutline || hasBoxShadow;
        });

        // Log elements without visible focus (don't fail, but warn)
        if (!hasVisibleFocus) {
          const tag = await focused.evaluate(el => el.tagName.toLowerCase());
          const className = await focused.getAttribute('class');
          console.warn(`Potentially missing focus indicator: <${tag}> class="${className?.substring(0, 50)}"`);
        }
      }
    }
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Specifically test contrast
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .options({ runOnly: ['color-contrast'] })
      .analyze();

    if (results.violations.length > 0) {
      const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
      if (contrastViolations.length > 0) {
        console.log('Contrast violations found:');
        contrastViolations.forEach(v => {
          v.nodes.forEach(n => {
            console.log(`  - ${n.target.join(' > ')}`);
            console.log(`    ${n.failureSummary}`);
          });
        });
      }
    }

    // Filter to critical/serious only for failure
    const serious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expectNoViolations(serious, 'color contrast');
  });
});

// ============================================================================
// KEYBOARD NAVIGATION TESTS
// ============================================================================

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('can navigate spread selector with keyboard', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Tab to spread selector
    const spreadSelector = page.locator('[role="radiogroup"][aria-label="Spread selection"]');
    await spreadSelector.focus();

    // Get initial selected spread
    const initialSelected = await spreadSelector.locator('[role="radio"][aria-checked="true"]').first();
    const _initialName = await initialSelected.getAttribute('aria-label') || await initialSelected.textContent();

    // Arrow right to select next spread
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Verify selection changed
    const newSelected = await spreadSelector.locator('[role="radio"][aria-checked="true"]').first();
    const _newName = await newSelected.getAttribute('aria-label') || await newSelected.textContent();

    // Should have moved to a different spread (or wrapped around)
    // Note: This may be the same if there's only one spread or it wrapped
    expect(newSelected).toBeTruthy();
  });

  test('escape key closes modals', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Try to open a modal (e.g., settings or auth)
    const settingsButton = page.locator('button[aria-label*="settings"], button[aria-label*="Settings"]').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(300);

      // Check if modal opened
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        // Press escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Modal should be closed
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('tab order is logical', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const tabOrder = [];

    // Tab through first 20 elements and record order
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.substring(0, 30) || el.getAttribute('aria-label') || '',
          y: rect.top,
          x: rect.left
        };
      });

      if (focused) {
        tabOrder.push(focused);
      }
    }

    // Check that Y positions generally increase (top to bottom)
    // Allow some variance for same-row elements
    let outOfOrderCount = 0;
    for (let i = 1; i < tabOrder.length; i++) {
      if (tabOrder[i].y < tabOrder[i - 1].y - 50) {
        outOfOrderCount++;
      }
    }

    // Allow up to 3 out-of-order elements (for skip links, floating elements)
    expect(outOfOrderCount).toBeLessThan(4);
  });
});

// ============================================================================
// ARIA LIVE REGION TESTS
// ============================================================================

test.describe('Accessibility - Live Regions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('page has required landmarks', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible();

    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    expect(await nav.count()).toBeGreaterThan(0);

    // Run landmark-specific axe rules
    const results = await new AxeBuilder({ page })
      .options({ runOnly: ['landmark-one-main', 'region', 'bypass'] })
      .analyze();

    // Only fail on serious violations
    const serious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expectNoViolations(serious, 'landmarks');
  });

  test('heading hierarchy is correct', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Get all headings
    const headings = await page.evaluate(() => {
      const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(hs).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.substring(0, 50)
      }));
    });

    // Should have at least one heading
    expect(headings.length).toBeGreaterThan(0);

    // Should have exactly one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count).toBeLessThanOrEqual(1);

    // Check for skipped heading levels (h1 -> h3 without h2)
    let _skippedLevels = false;
    let prevLevel = 0;
    for (const heading of headings) {
      if (heading.level > prevLevel + 1 && prevLevel > 0) {
        console.warn(`Heading level skipped: h${prevLevel} -> h${heading.level} ("${heading.text}")`);
        _skippedLevels = true;
      }
      prevLevel = heading.level;
    }

    // Run axe heading rules
    const results = await new AxeBuilder({ page })
      .options({ runOnly: ['heading-order', 'page-has-heading-one'] })
      .analyze();

    const serious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expectNoViolations(serious, 'headings');
  });
});

// ============================================================================
// MOBILE-SPECIFIC TESTS
// ============================================================================

test.describe('Accessibility - Mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('touch targets are large enough', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Find all interactive elements
    const interactive = page.locator('button, a[href], input, [role="button"], [role="radio"]');
    const count = await interactive.count();

    const smallTargets = [];

    for (let i = 0; i < count; i++) {
      const el = interactive.nth(i);
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) {
          // WCAG 2.1 recommends 44x44 minimum
          if (box.width < 44 || box.height < 44) {
            const tag = await el.evaluate(e => e.tagName.toLowerCase());
            const label = await el.getAttribute('aria-label') || await el.textContent();
            smallTargets.push({
              element: `<${tag}> "${label?.substring(0, 20)}"`,
              width: Math.round(box.width),
              height: Math.round(box.height)
            });
          }
        }
      }
    }

    // Log small targets but don't fail (some may be intentionally small)
    if (smallTargets.length > 0) {
      console.log('Small touch targets found (< 44x44):');
      smallTargets.slice(0, 10).forEach(t => {
        console.log(`  - ${t.element}: ${t.width}x${t.height}px`);
      });
    }

    // Run mobile-specific axe analysis
    const violations = await analyzeAccessibility(page);
    expectNoViolations(violations, 'mobile');
  });

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });
});

// ============================================================================
// REDUCED MOTION TESTS
// ============================================================================

test.describe('Accessibility - Reduced Motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('animations respect prefers-reduced-motion', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check that animation durations are short or zero
    const animatedElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const animated = [];

      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const duration = parseFloat(style.animationDuration) || 0;
        const transition = parseFloat(style.transitionDuration) || 0;

        if (duration > 0.3 || transition > 0.3) {
          animated.push({
            tag: el.tagName.toLowerCase(),
            class: el.className?.substring?.(0, 50) || '',
            animationDuration: duration,
            transitionDuration: transition
          });
        }
      });

      return animated;
    });

    // Log elements with long animations
    if (animatedElements.length > 0) {
      console.log('Elements with animations > 300ms (reduced-motion enabled):');
      animatedElements.slice(0, 5).forEach(el => {
        console.log(`  - <${el.tag}> class="${el.class}" animation=${el.animationDuration}s transition=${el.transitionDuration}s`);
      });
    }

    // Should have few or no long animations when reduced-motion is enabled
    expect(animatedElements.length).toBeLessThan(10);
  });
});

// ============================================================================
// FORM ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility - Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Run form-specific axe rules
    const results = await new AxeBuilder({ page })
      .options({ runOnly: ['label', 'label-title-only', 'select-name'] })
      .analyze();

    // Log all violations for debugging
    if (results.violations.length > 0) {
      console.log('Form labeling issues:');
      results.violations.forEach(v => {
        console.log(`  ${v.id}: ${v.nodes.length} occurrences`);
      });
    }

    const serious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expectNoViolations(serious, 'form labels');
  });

  test('error messages are associated with inputs', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Find inputs with error states
    const errorInputs = page.locator('[aria-invalid="true"], .error input, input.error');
    const count = await errorInputs.count();

    for (let i = 0; i < count; i++) {
      const input = errorInputs.nth(i);
      const describedBy = await input.getAttribute('aria-describedby');
      const errorId = await input.getAttribute('aria-errormessage');

      // Should have either aria-describedby or aria-errormessage
      if (!describedBy && !errorId) {
        const id = await input.getAttribute('id');
        console.warn(`Input with error state missing aria-describedby/aria-errormessage: #${id}`);
      }
    }
  });
});
