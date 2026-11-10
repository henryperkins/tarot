import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import postcss from 'postcss';

const stylesheet = postcss.parse(readFileSync(new URL('../src/styles/navigation.css', import.meta.url), 'utf8'));
const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

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

describe('Direction A navigation contract', () => {
  it('keeps one 56px app-bar row with the wordmark visible at 320px', () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      assert.equal(declarationsAt('.site-nav', width)['min-height'], '56px');
      assert.equal(declarationsAt('.site-nav__wordmark', width).display, 'inline');
      assert.equal(declarationsAt('.app-header__inner', width)['max-width'], '64rem');
    }
    assert.equal(declarationsAt('.site-nav__wordmark', 320)['font-size'], '1.0625rem');
  });

  it('uses text destinations with a brass underline and dot, never a filled active pill', () => {
    for (const width of [320, 390, 1024, 1440]) {
      const link = declarationsAt('.site-nav__link', width);
      assert.equal(link['font-size'], '0.875rem');
      assert.equal(link.background, 'transparent');
      assert.ok(parseInt(link['min-height'], 10) >= 44, 'destination targets stay at least 44px');
      const active = declarationsAt(".site-nav__link[aria-current='page']", width);
      assert.equal(active.background, 'transparent');
      assert.equal(active['font-weight'], '600');
      assert.equal(declarationsAt(".site-nav__link[aria-current='page']::after", width).background, 'var(--brand-primary)');
      assert.equal(declarationsAt(".site-nav__link[aria-current='page']::after", width).height, '2px');
      assert.equal(declarationsAt(".site-nav__link[aria-current='page']::before", width).background, 'var(--brand-primary)');
    }
  });

  it('keeps the dock destination row at 56px and hides inactive mounted copies', () => {
    assert.equal(declarationsAt('.destination-nav--dock .site-nav__link', 390)['min-height'], '56px');
    assert.equal(declarationsAt('.destination-group[hidden]', 390).display, 'none');
    assert.match(readFileSync(new URL('../src/styles/navigation.css', import.meta.url), 'utf8'), /\.destination-group\[hidden\] \{ display: none !important; \}/);
    assert.equal(declarationsAt('.step-progress-canvas__button', 390)['min-height'], '44px');
    assert.equal(declarationsAt('.step-progress-canvas__button.is-current', 390)['font-weight'], '600');
  });

  it('preserves visible keyboard focus and at least 44px targets', () => {
    for (const width of [390, 1024, 1440]) {
      for (const selector of ['.site-nav__link', '.guest-account__trigger', '.step-progress-canvas__button', '.canvas-progress__settings']) {
        assert.ok(parseInt(declarationsAt(selector, width)['min-height'], 10) >= 44, `${selector} keeps a 44px target`);
      }
      assert.equal(declarationsAt('.site-nav__link:focus-visible', width).outline, '2px solid var(--focus-ring-color)');
      assert.equal(declarationsAt('.step-progress-canvas__button:focus-visible', width).outline, '2px solid var(--focus-ring-color)');
    }
    assert.equal(declarationsAt('.canvas-progress__settings', 1440).width, '44px');
  });

  it('wires the shared header, dock, quiet variant, and guest settings in source', () => {
    const appHeader = readSource('../src/components/AppHeader.jsx');
    const bottom = readSource('../src/components/AppBottomRegion.jsx');
    const globalNav = readSource('../src/components/GlobalNav.jsx');
    const userMenu = readSource('../src/components/UserMenu.jsx');
    assert.match(appHeader, /destinations = true/);
    assert.match(globalNav, /data-destination-group="header"/);
    assert.match(globalNav, /syncDestinationPlacement/);
    const placement = readSource('../src/lib/destinationPlacement.js');
    assert.match(placement, /setAttribute\('inert'/);
    assert.match(placement, /equivalent.focus/);
    assert.match(bottom, /data-destination-nav|DestinationNav/);
    assert.match(bottom, /--app-bottom-height/);
    assert.match(bottom, /keyboardOffset > 0/);
    assert.match(userMenu, /aria-label="Settings"/);
    assert.match(userMenu, /guest-settings-link/);
    const reset = readSource('../src/pages/ResetPasswordPage.jsx');
    const share = readSource('../src/pages/ShareReading.jsx');
    assert.match(reset, /<AppHeader destinations=\{false\} \/>/);
    assert.match(share, /<AppHeader destinations=\{false\} \/>/);
    assert.match(share, /<AppBottomRegion destinations=\{false\}>/);
  });
});
