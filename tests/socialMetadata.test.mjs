import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { replaceSocialMetadata } from '../functions/lib/socialMetadata.js';

describe('share social metadata replacement', () => {
  const shareMetadata = '<meta property="og:title" content="A &quot;private&quot; reading &amp; reflection"><meta property="og:image" content="https://tarot.lakefrontdev.com/api/share/example/og-image"><meta name="twitter:image" content="https://tarot.lakefrontdev.com/api/share/example/og-image">';

  it('replaces the current app shell defaults with one share preview', () => {
    const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const result = replaceSocialMetadata(shell, shareMetadata);

    assert.equal((result.match(/property="og:image"/g) || []).length, 1);
    assert.equal((result.match(/name="twitter:image"/g) || []).length, 1);
    assert.equal((result.match(/property="og:title"/g) || []).length, 1);
    assert.ok(result.includes(shareMetadata));
    assert.doesNotMatch(result, /tableu-reading-room\.jpg|property="og:image:alt"/);
    assert.match(result, /<meta name="description"/);
    assert.match(result, /<meta name="theme-color"/);
    assert.match(result, /<script src="\/theme-bootstrap\.js"><\/script>/);
    assert.match(result, /<div id="root"><\/div>/);
  });

  it('recognizes social metadata with reordered, single-quoted or unquoted attributes', () => {
    const shell = '<html><HEAD><META content="old > image" PROPERTY = \'OG:image\'><meta content="old" name=twitter:title><meta property="og:image:alt" content="old alt"></HEAD><body>Reading</body></html>';
    const result = replaceSocialMetadata(shell, shareMetadata);

    assert.doesNotMatch(result, /old > image|content="old"|old alt/);
    assert.ok(result.includes(`${shareMetadata}\n  </HEAD>`));
    assert.ok(result.endsWith('<body>Reading</body></html>'));
  });

  it('preserves non-social metadata and attributes that only look like social keys', () => {
    const normalTags = '<meta name="description" content=\'property="og:image"\'><meta name="theme-color" content="#0F0E13"><meta data-name="twitter:title" name="custom" content="Keep this">';
    const result = replaceSocialMetadata(`<head>${normalTags}<meta name="twitter:title" content="Replace this"></head>`, shareMetadata);

    assert.ok(result.includes(normalTags));
    assert.doesNotMatch(result, /Replace this/);
  });

  it('preserves escaped text and replacement-special characters literally', () => {
    const metadata = '<meta property="og:title" content="&lt;reflection&gt; &amp; &quot;care&quot; $& $\' $`">';
    const result = replaceSocialMetadata('<head></head><body>Untouched</body>', metadata);

    assert.equal(result, `<head>${metadata}\n  </head><body>Untouched</body>`);
  });

  it('leaves comments, scripts and body content unchanged', () => {
    const comment = '<!-- <meta property="og:title" content="Comment example"> -->';
    const script = '<script>const example = \'<meta name="twitter:title" content="Script example">\';</script>';
    const body = '<body><template><meta property="og:title" content="Body example"></template></body>';
    const result = replaceSocialMetadata(`<head>${comment}${script}<meta property="og:title" content="Replace this"></head>${body}`, shareMetadata);

    assert.ok(result.includes(comment));
    assert.ok(result.includes(script));
    assert.ok(result.endsWith(body));
    assert.doesNotMatch(result, /Replace this/);
  });

  it('does not alter an asset without a complete head section', () => {
    const html = '<html><body>No metadata target</body></html>';
    assert.equal(replaceSocialMetadata(html, shareMetadata), html);
  });
});
