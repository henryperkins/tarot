/* global process, localStorage, document, getComputedStyle, window, console */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createNarrativeFixture, startReading } from '../../../e2e/helpers/narrativeFixtures.js';

const out = 'output/narrative-remediation/theme';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const reports = process.argv.includes('--resume')
  ? JSON.parse(readFileSync(`${out}/rendered-verification.json`, 'utf8')).filter(result => !(process.argv.includes('--enlarged') && result.enlarge))
  : [];
const cases = [
  { theme: 'light', source: 'reference', width: 1440, height: 1000 },
  { theme: 'dark', source: 'reference', width: 1440, height: 1000 },
  { theme: 'light', source: 'alternate', width: 1440, height: 1000 },
  { theme: 'dark', source: 'alternate', width: 1440, height: 1000 },
  { theme: 'light', source: 'reference', width: 320, height: 740 },
  { theme: 'dark', source: 'reference', width: 390, height: 844 },
  { theme: 'light', source: 'reference', width: 320, height: 740, enlarge: true }
];
try {
  for (const scenario of cases) {
    if (reports.some(result => result.theme === scenario.theme && result.source === scenario.source && result.width === scenario.width && Boolean(result.enlarge) === Boolean(scenario.enlarge))) continue;
    const context = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: scenario.width, height: scenario.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const fonts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (/\.woff2(?:$|\?)/.test(response.url())) fonts.push({ url: response.url(), status: response.status() });
    });
    await page.addInitScript(theme => localStorage.setItem('tarot-theme', theme), scenario.theme);
    const fixture = await createNarrativeFixture(page, { source: scenario.source });
    try {
      await startReading(page, fixture);
      const loadedFonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(font => font.style === 'normal' && font.status === 'loaded').map(font => font.family);
      });
      assert.ok(loadedFonts.includes('Inter Variable'), 'Inter must load before rendering evidence');
      assert.ok(loadedFonts.includes('Source Serif 4 Variable'), 'Source Serif 4 must load before rendering evidence');
      assert.ok(fonts.every(font => font.status >= 200 && font.status < 300));
      if (scenario.enlarge) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const section = page.getByRole('region', { name: 'Reading Inputs Used', exact: true });
      const button = section.getByRole('button', { name: 'Reading Inputs Used', exact: true });
      await section.scrollIntoViewIfNeeded();
      const result = await section.evaluate(node => {
        const rgb = value => value.match(/[\d.]+/g).map(Number);
        const luminance = color => color.slice(0, 3).reduce((sum, value, index) => {
          const v = value / 255;
          return sum + [0.2126, 0.7152, 0.0722][index] * (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        }, 0);
        const contrast = (first, second) => {
          const a = luminance(rgb(first)); const b = luminance(rgb(second));
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        };
        const badges = [...node.querySelectorAll('span:has(> svg)')].map(el => {
          const s = getComputedStyle(el);
          let opacity = 1;
          for (let parent = el; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
          return { text: el.textContent.trim(), foreground: s.color, background: s.backgroundColor, ratio: contrast(s.color, s.backgroundColor), borderRatio: contrast(s.borderTopColor, s.backgroundColor), iconColor: getComputedStyle(el.querySelector('svg')).color, fontSize: parseFloat(s.fontSize), opacity };
        });
        const button = node.querySelector('button');
        const rect = button.getBoundingClientRect();
        return {
          heading: node.querySelector('h2')?.textContent,
          headingContainsButton: button.parentElement.tagName === 'H2',
          targetExists: Boolean(document.getElementById(button.getAttribute('aria-controls'))),
          expanded: button.getAttribute('aria-expanded'),
          buttonRect: { width: rect.width, height: rect.height },
          badges,
          helpSizes: [...node.querySelectorAll('p')].map(el => parseFloat(getComputedStyle(el).fontSize)),
          overflow: [...node.querySelectorAll('p,span,li')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent),
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          frame: getComputedStyle(document.querySelector('.scene-shell--reading .scene-stage__panel')).backgroundImage,
          frameworkOverlay: Boolean(document.querySelector('vite-error-overlay'))
        };
      });
      assert.equal(result.headingContainsButton, true);
      assert.equal(result.targetExists, true);
      assert.equal(result.expanded, 'true');
      assert.ok(result.buttonRect.height >= 44 && result.buttonRect.width >= 44);
      assert.equal(result.badges[0].text, scenario.source === 'alternate' ? '2 used' : '3 used');
      assert.equal(result.badges[1].text, scenario.source === 'alternate' ? '1 requested not used' : '2 requested not used');
      for (const badge of result.badges) {
        assert.ok(badge.ratio >= 4.5, `${scenario.theme} ${badge.text}: ${badge.ratio}`);
        assert.ok(badge.borderRatio >= 3);
        assert.equal(badge.opacity, 1);
        assert.ok(!badge.background.startsWith('rgba'));
        assert.equal(badge.iconColor, badge.foreground);
        assert.ok(badge.fontSize >= 14);
      }
      assert.ok(result.helpSizes.every(size => size >= 14));
      assert.deepEqual(result.overflow, []);
      assert.ok(result.pageWidth <= result.viewportWidth + 1);
      assert.equal(result.frameworkOverlay, false);
      assert.deepEqual(errors, []);
      await button.press('Enter');
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      assert.equal(await section.getByRole('list').count(), 0);
      await button.press('Space');
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      assert.equal(await section.getByRole('list').count(), 1);
      const name = `${scenario.theme}-${scenario.source}-${scenario.width}${scenario.enlarge ? '-200percent' : ''}`;
      await section.screenshot({ path: `${out}/${name}.png` });
      if (scenario.width === 1440 && scenario.source === 'reference') {
        await section.locator('span:has(> svg)').nth(0).screenshot({ path: `${out}/${scenario.theme}-used-badge.png` });
        await section.locator('span:has(> svg)').nth(1).screenshot({ path: `${out}/${scenario.theme}-caution-badge.png` });
      }
      reports.push({ ...scenario, ...result, loadedFonts, fonts, pageErrors: errors, keyboardDisclosure: 'pass' });
      console.log(`${name}: PASS; minimum badge contrast ${Math.min(...result.badges.map(b => b.ratio)).toFixed(2)}:1`);
    } finally {
      await fixture.close();
      await context.close();
    }
  }
} finally {
  writeFileSync(`${out}/rendered-verification.json`, JSON.stringify(reports, null, 2));
  await browser.close();
}
