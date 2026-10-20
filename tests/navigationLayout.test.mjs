import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import postcss from 'postcss';

const stylesheet = postcss.parse(readFileSync(new URL('../src/styles/navigation.css', import.meta.url), 'utf8'));

// Inspect only the navigation stylesheet's declarations at the breakpoint.
// Actual browser geometry is covered by responsive-adaptation.spec.js.
function declarationsAt(selector, viewportWidth) {
  const declarations = {};
  stylesheet.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    const media = rule.parent.type === 'atrule' ? rule.parent : null;
    if (media) {
      const minimum = media.params.match(/^\(min-width: (\d+)px\)$/);
      if (!minimum || viewportWidth < Number(minimum[1])) return;
    }
    rule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value; });
  });
  return declarations;
}

describe('desktop navigation scale', () => {
  it('keeps the compact mobile and tablet typography through 1023px', () => {
    for (const width of [320, 390, 640, 768, 1023]) {
      assert.equal(declarationsAt('.site-nav__link', width)['font-size'], '0.875rem');
      assert.equal(declarationsAt('.site-nav__link', width)['min-height'], '44px');
      assert.equal(declarationsAt('.site-nav__wordmark', width)['font-size'], '1rem');
      assert.equal(declarationsAt('.tableu-header .tableu-header__progress button', width)['font-size'], '0.8125rem');
      assert.equal(declarationsAt('.tableu-header__progress nav', width).flex, '1');
      assert.deepEqual(declarationsAt('.site-nav__brand .tableu-logo', width), {});
    }
  });

  it('enlarges the desktop brand, navigation, and step labels starting at 1024px', () => {
    for (const width of [1024, 1440, 1920]) {
      assert.equal(declarationsAt('.site-nav__brand .tableu-logo', width).width, '2.75rem');
      assert.equal(declarationsAt('.site-nav__brand .tableu-logo', width).height, '2.75rem');
      assert.equal(declarationsAt('.site-nav__wordmark', width)['font-size'], '1.375rem');
      assert.equal(declarationsAt('.site-nav__link', width)['font-size'], '1rem');
      assert.equal(declarationsAt('.tableu-header .tableu-header__progress button', width)['font-size'], '1rem');
    }
  });

  it('bounds the desktop header and centers a shrinkable group of reading steps', () => {
    const width = 1440;
    assert.equal(declarationsAt('.site-nav', width)['max-width'], '64rem');
    assert.equal(declarationsAt('.tableu-header__inner', width)['max-width'], '64rem');
    assert.equal(declarationsAt('.tableu-header .tableu-header__progress', width)['justify-content'], 'center');
    assert.equal(declarationsAt('.tableu-header .tableu-header__progress nav', width).flex, '0 1 40rem');
    assert.equal(declarationsAt('.tableu-header__progress nav', width)['min-width'], '0');
    assert.equal(declarationsAt('.site-nav', width)['flex-wrap'], 'wrap');
    assert.equal(declarationsAt('.tableu-header__progress ol', width)['flex-wrap'], 'wrap');
  });

  it('preserves visible keyboard focus, active states, and at least 44px targets', () => {
    for (const width of [390, 1024, 1920]) {
      for (const selector of ['.site-nav__link', '.guest-account__trigger', '.tableu-header .tableu-header__progress button']) {
        assert.ok(parseInt(declarationsAt(selector, width)['min-height'], 10) >= 44);
      }
      assert.equal(declarationsAt('.site-nav__link:focus-visible', width).outline, '2px solid var(--focus-ring-color)');
      assert.equal(declarationsAt('.tableu-header__progress button:focus-visible', width).outline, '2px solid var(--focus-ring-color)');
      assert.equal(declarationsAt(".site-nav__link[aria-current='page']", width).background, 'var(--brand-primary)');
      assert.equal(declarationsAt(".tableu-header .tableu-header__progress [aria-current='step']", width)['font-weight'], '600');
    }
    const settings = declarationsAt('.tableu-header .tableu-header__progress .reading-settings', 1440);
    assert.equal(settings.width, '44px');
    assert.equal(settings['padding-inline'], '0.375rem', 'the fixed-width settings target must leave room for its gear icon');
  });
});
