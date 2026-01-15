// tests/promptEngineering.test.mjs
// Tests for prompt engineering helpers

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPII, stripUserContent, buildPromptEngineeringPayload } from '../functions/lib/promptEngineering.js';

describe('redactPII', () => {
  test('redacts display name tokens without overmatching inside other words', () => {
    const text = 'We saw Ana in the analysis today.';
    const result = redactPII(text, { displayName: 'Ana' });

    assert.strictEqual(result, 'We saw [NAME] in the analysis today.');
  });

  test('handles names with diacritics using Unicode-aware boundaries', () => {
    const text = 'Ana María shared feedback about the spread.';
    const result = redactPII(text, { displayName: 'Ana María' });

    assert.strictEqual(result, '[NAME] shared feedback about the spread.');
  });

  test('redacts possessive forms for ASCII and curly apostrophes', () => {
    const text = "Ana's insight and Ana\u2019s path were both logged.";
    const result = redactPII(text, { displayName: 'Ana' });

    assert.strictEqual(result, "[NAME] insight and [NAME] path were both logged.");
  });
});

describe('redactPII - international phone numbers', () => {
  test('redacts UK phone numbers', () => {
    const text = 'Call me at +44 20 7946 0958 tomorrow.';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Call me at [PHONE] tomorrow.');
  });

  test('redacts French phone numbers', () => {
    const text = 'Contact: +33 1 42 68 53 00';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Contact: [PHONE]');
  });

  test('redacts German phone numbers', () => {
    const text = 'Reach me at +49 89 123456 or 089-123456';
    const result = redactPII(text, {});

    assert.ok(!result.includes('123456'), 'German numbers should be redacted');
  });

  test('redacts Japanese phone numbers', () => {
    const text = 'Office: +81-3-1234-5678';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Office: [PHONE]');
  });

  test('redacts Australian phone numbers', () => {
    const text = 'Call +61 2 9876 5432 for support.';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Call [PHONE] for support.');
  });

  test('redacts international format without country code', () => {
    const text = 'My number is 020 7946 0958 in London.';
    const result = redactPII(text, {});

    assert.ok(!result.includes('7946'), 'UK local format should be redacted');
  });

  test('does not false-positive on short digit sequences', () => {
    const text = 'Order #12345 was placed on 2024-01-15.';
    const result = redactPII(text, {});

    assert.ok(result.includes('12345'), 'Short order numbers should remain');
  });

  test('does not false-positive on year ranges', () => {
    const text = 'I worked there from 2018 to 2022.';
    const result = redactPII(text, {});

    assert.ok(result.includes('2018'), 'Years should remain');
    assert.ok(result.includes('2022'), 'Years should remain');
  });
});

describe('stripUserContent', () => {
  describe('multiline question handling', () => {
    test('strips single-line **Question** format', () => {
      const text = '**Question**: What should I do about my career?\n\n**Cards**:';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('career'), 'Question content should not remain');
    });

    test('strips multiline **Question** format with backstory', () => {
      const text = `**Question**: What should I do about my career?
I have been working at this company for 5 years.
My boss John Smith has been difficult lately.
I'm considering leaving but my salary is $150,000.

**Cards**:`;
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('career'), 'First line should be redacted');
      assert.ok(!result.includes('5 years'), 'Backstory line 1 should be redacted');
      assert.ok(!result.includes('John Smith'), 'PII in backstory should be redacted');
      assert.ok(!result.includes('$150,000'), 'Financial info should be redacted');
      assert.ok(result.includes('**Cards**:'), 'Next section should remain');
    });

    test('strips plain question: format with multiline content', () => {
      const text = `Some intro text.
question: How can I improve my relationship with Sarah?
She has been distant since our argument about money.
We have two children together.

**Thematic Context**:`;
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('Sarah'), 'Name should be redacted');
      assert.ok(!result.includes('money'), 'Content should be redacted');
      assert.ok(!result.includes('children'), 'Personal details should be redacted');
      assert.ok(result.includes('**Thematic Context**:'), 'Next section should remain');
    });
  });

  describe('reflections handling', () => {
    test('strips inline **Querent\'s Reflections** format', () => {
      const text = '**Querent\'s Reflections**: I feel anxious about the Tower card.\n\n**Next**:';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_REFLECTIONS_REDACTED]'), 'Reflections should be redacted');
      assert.ok(!result.includes('anxious'), 'Reflection content should not remain');
    });

    test('strips newline-separated **Querent\'s Reflections** format', () => {
      const text = `**Querent's Reflections**:
I see myself in the Hermit card.
This reminds me of my divorce from Michael.
The isolation period was so difficult.

**Vision Validation**:`;
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_REFLECTIONS_REDACTED]'), 'Reflections should be redacted');
      assert.ok(!result.includes('Hermit'), 'Card reflection should be redacted');
      assert.ok(!result.includes('Michael'), 'PII should be redacted');
      assert.ok(!result.includes('divorce'), 'Personal content should be redacted');
      assert.ok(result.includes('**Vision Validation**:'), 'Next section should remain');
    });

    test('strips *Querent\'s Reflection: "..."* inline format', () => {
      const text = 'Some text *Querent\'s Reflection: "This card reminds me of my mother\'s death"* more text';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_REFLECTION_REDACTED]'), 'Reflection should be redacted');
      assert.ok(!result.includes('mother'), 'Personal content should not remain');
    });

    test('strips inline reflection with smart quotes and nested quotes', () => {
      const text = 'Some text *Querent\u2019s Reflection: \u201cHe said \u2018stay\u2019 and I froze\u201d* more text';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_REFLECTION_REDACTED]'), 'Reflection should be redacted');
      assert.ok(!result.includes('stay'), 'Nested quote content should not remain');
    });
  });

  describe('card label question embedding', () => {
    test('strips question from Outcome position label', () => {
      const text = 'Outcome — likely path for "What should I do about my marriage?" if unchanged (Card 10)';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('marriage'), 'Question content should not remain');
      assert.ok(result.includes('if unchanged'), 'Label suffix should remain');
    });

    test('strips question from Future position label with en-dash', () => {
      const text = 'Future – likely trajectory for "How will my startup perform?" if nothing shifts';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('startup'), 'Question content should not remain');
    });

    test('strips question from Future position label with em-dash', () => {
      const text = 'Future — likely trajectory for "Should I accept the job offer from Google?" if nothing shifts';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('Google'), 'Company name should not remain');
      assert.ok(!result.includes('job offer'), 'Question content should not remain');
    });

    test('strips question from Outcome position label with smart quotes', () => {
      const text = 'Outcome — likely path for \u201cShould I leave this role for something calmer?\u201d if unchanged';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('calmer'), 'Question content should not remain');
    });
  });

  describe('displayName-prefixed questions', () => {
    test('strips personalized question format', () => {
      const text = '**Question**: Sarah, you asked: What should I do about my relationship with Tom?\n\n**Cards**:';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('Tom'), 'Name in question should not remain');
      assert.ok(!result.includes('relationship'), 'Question content should not remain');
    });

    test('strips "you asked:" pattern mid-line', () => {
      const text = 'Name, you asked: How can I heal from my trauma after the accident?\n\nMore content.';
      const result = stripUserContent(text);

      assert.ok(result.includes('[USER_QUESTION_REDACTED]'), 'Question should be redacted');
      assert.ok(!result.includes('trauma'), 'Question content should not remain');
      assert.ok(!result.includes('accident'), 'Personal detail should not remain');
    });
  });

  describe('focus area handling', () => {
    test('strips onboarding focus areas line', () => {
      const text = `**Thematic Context**:
- Focus areas (from onboarding): career clarity, grief support
- Reversal framework: shadow work`;
      const result = stripUserContent(text);

      assert.ok(result.includes('[FOCUS_AREAS_REDACTED]'), 'Focus areas should be redacted');
      assert.ok(!result.includes('grief'), 'Focus area details should not remain');
      assert.ok(result.includes('- Reversal framework'), 'Other thematic lines should remain');
    });
  });

  describe('edge cases', () => {
    test('handles empty string', () => {
      assert.strictEqual(stripUserContent(''), '');
    });

    test('handles null/undefined', () => {
      assert.strictEqual(stripUserContent(null), '');
      assert.strictEqual(stripUserContent(undefined), '');
    });

    test('handles text with no user content', () => {
      const text = '**Cards**: The Fool, The Magician\n\n**Analysis**: These cards suggest...';
      const result = stripUserContent(text);

      assert.strictEqual(result, text, 'Text without user content should remain unchanged');
    });

    test('handles multiple user content sections', () => {
      const text = `**Question**: What about my career?

**Cards**: The Tower

**Querent's Reflections**:
This card scares me.

**Outcome**: Outcome — likely path for "career question" if unchanged`;
      const result = stripUserContent(text);

      // All three user content areas should be redacted
      assert.ok(!result.includes('What about my career'), 'Question should be redacted');
      assert.ok(!result.includes('scares me'), 'Reflection should be redacted');
      assert.ok(!result.includes('career question'), 'Outcome label question should be redacted');
      assert.ok(result.includes('**Cards**: The Tower'), 'Non-user content should remain');
    });
  });
});

describe('buildPromptEngineeringPayload', () => {
  test('redacts echoed third-party names from responses using user question hints', async () => {
    const payload = await buildPromptEngineeringPayload({
      systemPrompt: 'System prompt',
      userPrompt: '**Question**: How can I communicate with Alex more clearly?',
      response: 'Alex may need reassurance before opening up.',
      userQuestion: 'How can I communicate with Alex more clearly?',
      redactionOptions: { displayName: 'Sam' }
    });

    assert.ok(payload.redacted.response.includes('[NAME]'), 'Response should redact hinted name');
    assert.ok(!payload.redacted.response.includes('Alex'), 'Response should not include raw name');
  });
});
