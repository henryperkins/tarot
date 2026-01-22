import assert from 'assert';
import { describe, it } from 'node:test';
import { estimateTokenCount, truncateSystemPromptSafely } from '../functions/lib/narrative/prompts.js';

describe('Token Budgeting', () => {
  it('estimates tokens for plain text', () => {
    const text = 'This is a simple test string.';
    const tokens = estimateTokenCount(text);
    assert(tokens > 0, 'Token count should be positive');
  });

  it('estimates tokens for emoji-heavy text', () => {
    const text = 'Hello 🌍! This is a test with 😀😂👍 emojis.';
    const tokens = estimateTokenCount(text);
    assert(tokens > estimateTokenCount('Hello world! This is a test without emojis.'));
  });

  it('estimates tokens for markdown-heavy text', () => {
    const text = '# Header\n\n**Bold** *italic* [link](url) ```code```';
    const tokens = estimateTokenCount(text);
    assert(tokens > estimateTokenCount('Header Bold italic link code'));
  });

  it('estimates tokens for Unicode text', () => {
    const text = 'こんにちは世界！这是一个测试。Это тест.';
    const tokens = estimateTokenCount(text);
    assert(tokens > 0);
  });

  it('preserves critical sections during truncation', () => {
    const longText = 'Long intro text\n## ETHICS\nImportant ethics content\n## CORE PRINCIPLES\nCore principles\n## OTHER\nTruncatable content';
    const truncated = truncateSystemPromptSafely(longText, 50);
    assert(truncated.text.includes('ETHICS') && truncated.text.includes('CORE PRINCIPLES'));
    assert(truncated.truncated);
  });

  it('handles multi-pass truncation', () => {
    // Test repeated truncation
    let text = 'A'.repeat(1000);
    text = truncateSystemPromptSafely(text, 200).text;
    text = truncateSystemPromptSafely(text, 100).text;
    assert(estimateTokenCount(text) <= 100);
  });

  it('throws on budget overflow with critical sections', () => {
    const criticalHeavy = '## ETHICS\n' + 'X'.repeat(1000) + '\n## CORE PRINCIPLES\n' + 'Y'.repeat(1000);
    assert.throws(() => truncateSystemPromptSafely(criticalHeavy, 100), /PROMPT_SAFETY_BUDGET_EXCEEDED/);
  });

  it('handles edge cases', () => {
    assert.strictEqual(estimateTokenCount(''), 0);
    assert.strictEqual(estimateTokenCount(null), 0);
    const veryLong = 'A'.repeat(10000);
    const truncated = truncateSystemPromptSafely(veryLong, 100);
    assert(truncated.truncated);
    assert(estimateTokenCount(truncated.text) <= 100);
  });
});