import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatForecastHighlights } from '../functions/lib/ephemerisIntegration.js';

describe('formatForecastHighlights', () => {
  it('returns empty array when forecast unavailable', () => {
    const result = formatForecastHighlights({ available: false });
    assert.deepStrictEqual(result, []);
  });

  it('limits highlights to maxItems and formats offsets', () => {
    const forecast = {
      available: true,
      events: [
        { description: 'New Moon in Leo', dayOffset: 0 },
        { description: 'Mercury stations direct', dayOffset: 5 },
        { description: 'Full Moon in Aquarius', dayOffset: 14 },
        { description: 'Sun enters Virgo', dayOffset: 23 }
      ],
      currentContext: { retrogrades: [] }
    };

    const result = formatForecastHighlights(forecast, 3);
    assert.strictEqual(result.length, 3);
    assert.ok(result[0].includes('today'));
    assert.ok(result[1].includes('in 5 days'));
  });

  it('adds retrograde context when space remains', () => {
    const forecast = {
      available: true,
      events: [{ description: 'Full Moon in Aries', dayOffset: 2 }],
      currentContext: { retrogrades: [{ planet: 'Mercury' }, { planet: 'Saturn' }] }
    };

    const result = formatForecastHighlights(forecast, 4);
    assert.strictEqual(result.length, 2);
    assert.ok(result[1].includes('Retrogrades'));
  });
});

