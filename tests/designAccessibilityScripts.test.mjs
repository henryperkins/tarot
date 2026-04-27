import assert from 'assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { getHexToken, loadThemeTokenScopes } from '../scripts/lib/themeTokens.mjs';
import { scanContent } from '../tests/accessibility/wcag-analyzer.mjs';
import { normalizeRoutePath, shouldSkipAuthCheckForPath } from '../src/lib/authRouteUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.resolve(__dirname, '../index.html');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const themeCssPath = path.resolve(__dirname, '../src/styles/theme.css');
const tailwindCssPath = path.resolve(__dirname, '../src/styles/tailwind.css');
const tailwindConfigPath = path.resolve(__dirname, '../tailwind.config.js');

describe('Design accessibility scripts', () => {
  it('loads dark and light theme tokens from theme.css', async () => {
    const scopes = await loadThemeTokenScopes(themeCssPath);

    assert.strictEqual(getHexToken(scopes.dark, 'text-muted'), '#CCC5B9');
    assert.strictEqual(getHexToken(scopes.light, 'text-muted'), '#555555');
    assert.strictEqual(getHexToken(scopes.dark, 'brand-primary'), '#D4B896');
    assert.strictEqual(getHexToken(scopes.light, 'brand-primary'), '#7D623B');
  });

  it('does not flag supported text-xs-plus classes', () => {
    const issues = scanContent('<p className="text-xs-plus text-muted">Hint</p>');
    assert.deepStrictEqual(
      issues.map((issue) => issue.checkName),
      []
    );
  });

  it('ignores dialog backdrops when checking clickable divs', () => {
    const issues = scanContent(`
      <div role="dialog" aria-modal="true" onClick={closeExpanded}>
        <div onClick={(event) => event.stopPropagation()} />
      </div>
    `);

    assert.deepStrictEqual(
      issues.filter((issue) => issue.checkName === 'divAsButton'),
      []
    );
  });

  it('flags clickable divs without keyboard semantics', () => {
    const issues = scanContent('<div onClick={openPanel}>Open</div>');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].checkName, 'divAsButton');
  });

  it('keeps text-2xs aligned to the 11px contract', async () => {
    const tailwindConfigSource = await fs.readFile(tailwindConfigPath, 'utf8');
    assert.match(
      tailwindConfigSource,
      /'2xs': \['0\.6875rem', \{ lineHeight: '1\.4' \}\]/
    );
  });

  it('self-hosts the editorial font stack through shared tokens', async () => {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const indexHtmlSource = await fs.readFile(indexHtmlPath, 'utf8');
    const themeCssSource = await fs.readFile(themeCssPath, 'utf8');
    const tailwindCssSource = await fs.readFile(tailwindCssPath, 'utf8');
    const tailwindConfigSource = await fs.readFile(tailwindConfigPath, 'utf8');

    assert.ok(packageJson.dependencies['@fontsource-variable/inter']);
    assert.ok(packageJson.dependencies['@fontsource-variable/source-serif-4']);
    assert.match(tailwindCssSource, /inter-latin-opsz-normal\.woff2/);
    assert.match(tailwindCssSource, /inter-latin-opsz-italic\.woff2/);
    assert.match(tailwindCssSource, /source-serif-4-latin-opsz-normal\.woff2/);
    assert.match(tailwindCssSource, /source-serif-4-latin-opsz-italic\.woff2/);
    assert.match(tailwindCssSource, /unicode-range:\s*U\+0000-00FF/);
    assert.doesNotMatch(tailwindCssSource, /(?:cyrillic|greek|vietnamese|latin-ext)-opsz/);
    assert.match(themeCssSource, /--font-sans:\s*"Inter Variable"/);
    assert.match(themeCssSource, /--font-serif:\s*"Source Serif 4 Variable"/);
    assert.match(
      tailwindConfigSource,
      /serif:\s*\[\s*'var\(--font-serif,\s*Georgia,\s*"Times New Roman",\s*serif\)',\s*'Georgia',\s*'"Times New Roman"',\s*'serif'\s*\]/
    );
    assert.match(
      tailwindConfigSource,
      /sans:\s*\[\s*'var\(--font-sans,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*system-ui,\s*sans-serif\)',\s*'-apple-system',\s*'BlinkMacSystemFont',\s*'"Segoe UI"',\s*'system-ui',\s*'sans-serif'\s*\]/
    );
    assert.doesNotMatch(indexHtmlSource, /fonts\.(?:googleapis|gstatic)\.com/);
  });

  it('treats /design as an auth-optional review route', () => {
    assert.strictEqual(normalizeRoutePath('/design/'), '/design');
    assert.strictEqual(shouldSkipAuthCheckForPath('/design'), true);
    assert.strictEqual(shouldSkipAuthCheckForPath('/design/'), true);
    assert.strictEqual(shouldSkipAuthCheckForPath('/account'), false);
  });
});
