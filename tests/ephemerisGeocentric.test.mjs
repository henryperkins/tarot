import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentPositions, getRetrogradePlanets } from '../functions/lib/ephemerisWorkers.js';

// Expected values are geocentric apparent ecliptic longitudes (true ecliptic of
// date) from JPL Horizons (observer table, quantity 31, center 500@399), so they
// are independent of astronomy-engine. "direct" is the sign of the Horizons
// longitude change across the surrounding +/-1 day.
const HORIZONS_FIXTURES = [
  {
    label: 'review export timestamp',
    timestamp: '2026-09-23T14:04:00Z',
    bodies: {
      Sun: { longitude: 180.5698, sign: 'Libra', direct: true },
      Moon: { longitude: 322.9838, sign: 'Aquarius', direct: true },
      Mercury: { longitude: 200.3308, sign: 'Libra', direct: true },
      Venus: { longitude: 216.7753, sign: 'Scorpio', direct: true },
      Mars: { longitude: 117.3147, sign: 'Cancer', direct: true },
      Jupiter: { longitude: 138.2272, sign: 'Leo', direct: true },
      Saturn: { longitude: 12.1523, sign: 'Aries', direct: false },
      Uranus: { longitude: 65.6278, sign: 'Gemini', direct: false },
      Neptune: { longitude: 3.0675, sign: 'Aries', direct: false },
      Pluto: { longitude: 303.1863, sign: 'Aquarius', direct: false }
    }
  },
  {
    label: 'Venus retrograde near inferior conjunction',
    timestamp: '2023-08-13T00:00:00Z',
    bodies: {
      Venus: { longitude: 140.7619, sign: 'Leo', direct: false }
    }
  },
  {
    label: 'Mercury retrograde',
    timestamp: '2024-08-20T12:00:00Z',
    bodies: {
      Mercury: { longitude: 145.4057, sign: 'Leo', direct: false }
    }
  }
];

const LONGITUDE_TOLERANCE_DEGREES = 0.05;

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

describe('ephemerisWorkers geocentric positions', () => {
  for (const fixture of HORIZONS_FIXTURES) {
    for (const [name, expected] of Object.entries(fixture.bodies)) {
      it(`places ${name} where Earth sees it (${fixture.label})`, () => {
        const actual = getCurrentPositions(fixture.timestamp).positions[name];

        assert.ok(actual, `${name} position should be calculated`);
        assert.equal(actual.sign, expected.sign);
        assert.ok(
          angularDistance(actual.longitude, expected.longitude) <= LONGITUDE_TOLERANCE_DEGREES,
          `${name} longitude ${actual.longitude} should be within ${LONGITUDE_TOLERANCE_DEGREES}° of ${expected.longitude}`
        );
        assert.equal(actual.isDirect, expected.direct, `${name} direction of motion`);
      });
    }
  }

  it('flips Venus to retrograde at its station, not half a day later', () => {
    // Horizons 3-hourly longitudes peak at 218.4911° (8.49° Scorpio) near
    // 07:15 UT on 2026-10-03, so Venus is direct before and retrograde after.
    assert.equal(getCurrentPositions('2026-10-03T02:00:00Z').positions.Venus.isDirect, true);
    assert.equal(getCurrentPositions('2026-10-03T12:00:00Z').positions.Venus.isDirect, false);
  });

  it('reports the planets that are retrograde as seen from Earth', () => {
    const retrogrades = getRetrogradePlanets('2026-09-23T14:04:00Z');

    assert.deepEqual(
      retrogrades.map((r) => `${r.planet} in ${r.sign}`),
      ['Saturn in Aries', 'Uranus in Gemini', 'Neptune in Aries', 'Pluto in Aquarius']
    );
  });
});
