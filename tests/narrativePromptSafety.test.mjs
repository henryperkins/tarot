import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizePromptValue } from '../functions/lib/narrative/helpers.js';
import { truncateSystemPromptSafely } from '../functions/lib/narrative/prompts.js';

describe('sanitizePromptValue', () => {
  it('strips template syntax', () => {
    const input = 'Hello {{ name }} and ${user}';
    const output = sanitizePromptValue(input);
    assert.ok(!output.includes('{{'));
    assert.ok(!output.includes('${'));
    assert.ok(output.includes('Hello'));
  });

  it('strips EJS syntax', () => {
    const input = '<% code %> and <%- unsafe %>';
    const output = sanitizePromptValue(input);
    assert.ok(!output.includes('<%'));
    assert.ok(!output.includes('%>'));
  });

  it('strips Jinja syntax', () => {
    const input = '{% if true %} {# comment #}';
    const output = sanitizePromptValue(input);
    assert.ok(!output.includes('{%'));
    assert.ok(!output.includes('%}'));
    assert.ok(!output.includes('{#'));
    assert.ok(!output.includes('#}'));
  });
});

describe('truncateSystemPromptSafely', () => {
  it('returns minimal critical prompt when critical sections exceed budget', () => {
    const largeEthicsSection = 'ETHICS\n' + 'X'.repeat(10000);
    const truncated = truncateSystemPromptSafely(largeEthicsSection, 100);
    assert.ok(truncated.truncated, 'Should report truncation');
    assert.ok(truncated.text.includes('ETHICS'), 'Should preserve ETHICS header');
  });
});
