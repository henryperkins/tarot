import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchEphemerisForecast,
  buildForecastSection,
  formatForecastHighlights,
  fetchEphemerisContext,
  buildAstrologicalWeatherSection,
  getEphemerisSummary
} from '../functions/lib/ephemerisIntegration.js';
import { performSpreadAnalysis, buildEphemerisClientPayload } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { findEphemerisEvents } from '../functions/lib/ephemerisWorkers.js';

// Event times come from JPL Horizons geocentric apparent ecliptic longitudes
// (quantity 31, center 500@399), independent of astronomy-engine:
// - Full Moon: Moon–Sun elongation reaches 180° at ~16:49 UT 2026-09-26, Moon at 3.62° Aries.
// - New Moon: Moon–Sun elongation reaches 0° at ~15:50 UT 2026-10-10, Moon at 17.36° Libra.
// - Venus longitude peaks (station retrograde) near 07:15 UT 2026-10-03 at 8.49° Scorpio.
// - Venus longitude bottoms out (station direct) near 00:28 UT 2026-11-14 at 22.86° Libra.
// - Sun longitude crosses 210° (enters Scorpio) at ~09:38 UT 2026-10-23.
const REVIEW_TIMESTAMP = '2026-09-23T14:04:00Z';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function assertNear(actualIso, expectedIso, toleranceMs, label) {
  const deltaMs = Math.abs(Date.parse(actualIso) - Date.parse(expectedIso));
  assert.ok(
    deltaMs <= toleranceMs,
    `${label}: ${actualIso} should be within ${toleranceMs / MINUTE_MS} min of ${expectedIso}`
  );
}

function eventsOfType(forecast, type) {
  return forecast.events.filter((event) => event.type === type);
}

describe('fetchEphemerisForecast exact events', () => {
  it('dates the full moon at exact opposition, in the sign the Moon occupies then', async () => {
    const forecast = await fetchEphemerisForecast(14, { referenceTime: REVIEW_TIMESTAMP });
    const fullMoons = eventsOfType(forecast, 'full-moon');

    assert.equal(fullMoons.length, 1);
    assert.equal(fullMoons[0].description, 'Full Moon in Aries');
    assertNear(fullMoons[0].date, '2026-09-26T16:49:00Z', 2 * MINUTE_MS, 'full moon');
    assert.equal(fullMoons[0].dayOffset, 3);
  });

  it('dates the new moon at exact conjunction, in the sign the Moon occupies then', async () => {
    const forecast = await fetchEphemerisForecast(30, { referenceTime: REVIEW_TIMESTAMP });
    const newMoons = eventsOfType(forecast, 'new-moon');

    assert.equal(newMoons.length, 1);
    assert.equal(newMoons[0].description, 'New Moon in Libra');
    assertNear(newMoons[0].date, '2026-10-10T15:50:00Z', 2 * MINUTE_MS, 'new moon');
    assert.equal(newMoons[0].dayOffset, 17);
  });

  it('reports a full moon that is less than a day away', async () => {
    // 12 hours before exact opposition the Moon is already inside the broad
    // "Full Moon" display band, which the old sampler never reported as upcoming.
    const forecast = await fetchEphemerisForecast(14, { referenceTime: '2026-09-26T04:49:00Z' });
    const fullMoons = eventsOfType(forecast, 'full-moon');

    assert.equal(fullMoons.length, 1);
    assert.equal(fullMoons[0].dayOffset, 0);
  });

  it('dates a retrograde station when geocentric motion reverses', async () => {
    const forecast = await fetchEphemerisForecast(14, { referenceTime: REVIEW_TIMESTAMP });
    const station = eventsOfType(forecast, 'station-retrograde').find((event) => event.planet === 'Venus');

    assert.ok(station, 'Venus stations retrograde inside this window');
    assertNear(station.date, '2026-10-03T07:15:00Z', 3 * HOUR_MS, 'Venus station retrograde');
    assert.equal(station.dayOffset, 10);
  });

  it('dates a direct station when geocentric motion reverses', async () => {
    const forecast = await fetchEphemerisForecast(14, { referenceTime: '2026-11-01T00:00:00Z' });
    const station = eventsOfType(forecast, 'station-direct').find((event) => event.planet === 'Venus');

    assert.ok(station, 'Venus stations direct inside this window');
    assertNear(station.date, '2026-11-14T00:28:00Z', 3 * HOUR_MS, 'Venus station direct');
    assert.equal(station.dayOffset, 13);
  });

  it('dates a sun ingress at the exact sign boundary', async () => {
    const forecast = await fetchEphemerisForecast(14, { referenceTime: '2026-10-20T00:00:00Z' });
    const ingresses = eventsOfType(forecast, 'sun-ingress');

    assert.equal(ingresses.length, 1);
    assert.equal(ingresses[0].description, 'Sun enters Scorpio');
    assertNear(ingresses[0].date, '2026-10-23T09:38:00Z', 2 * MINUTE_MS, 'Sun enters Scorpio');
    assert.equal(ingresses[0].dayOffset, 3);
  });

  it("counts days on the querent's calendar when their timezone is known", async () => {
    // 03:00 UT on Sep 26 is still Sep 25 in New York, so the 12:49 EDT full moon is tomorrow there.
    const forecast = await fetchEphemerisForecast(14, {
      referenceTime: '2026-09-26T03:00:00Z',
      timezone: 'America/New_York'
    });

    assert.equal(eventsOfType(forecast, 'full-moon')[0].dayOffset, 1);
    assert.match(buildForecastSection(forecast), /\*\*Full Moon in Aries\*\* \(tomorrow; Sat, Sep 26\)/);
  });

  it('uses elapsed time, not calendar words, when the timezone is unknown', async () => {
    // Without a timezone, "today" or "Sat, Sep 26" would be UTC's calendar, not the querent's.
    const forecast = await fetchEphemerisForecast(14, { referenceTime: '2026-09-26T03:00:00Z' });
    const section = buildForecastSection(forecast);

    assert.match(section, /\*\*Full Moon in Aries\*\* \(in about 14 hours\)/);
    assert.doesNotMatch(section, /\btoday\b|\btomorrow\b|Sat, Sep 26/);
    assert.deepEqual(formatForecastHighlights(forecast, 1), ['Full Moon in Aries (in about 14 hours)']);
  });

  it('treats an unrecognized timezone as unknown', async () => {
    const forecast = await fetchEphemerisForecast(14, {
      referenceTime: '2026-09-26T03:00:00Z',
      timezone: 'Not/A_Zone'
    });

    assert.equal(forecast.available, true);
    assert.match(buildForecastSection(forecast), /\*\*Full Moon in Aries\*\* \(in about 14 hours\)/);
  });

  it('anchors the forecast window and current context to the reference time', async () => {
    const forecast = await fetchEphemerisForecast(14, { referenceTime: REVIEW_TIMESTAMP });

    assert.equal(forecast.startDate, '2026-09-23T14:04:00.000Z');
    assert.equal(forecast.endDate, '2026-10-07T14:04:00.000Z');
    assert.equal(forecast.currentContext.timestamp, '2026-09-23T14:04:00.000Z');
  });

  it('gives the prompt the exact event, its day count, and its local date', async () => {
    const forecast = await fetchEphemerisForecast(14, {
      referenceTime: REVIEW_TIMESTAMP,
      timezone: 'America/New_York'
    });
    const section = buildForecastSection(forecast);

    assert.match(section, /\*\*Full Moon in Aries\*\* \(in 3 days; Sat, Sep 26\)/);
    assert.match(section, /\*\*Venus stations retrograde\*\* \(in 10 days; Sat, Oct 3\)/);
    assert.doesNotMatch(section, /Pisces/);
  });

  it('gives the prompt elapsed days for the review timestamp when no timezone is known', async () => {
    const section = buildForecastSection(await fetchEphemerisForecast(14, { referenceTime: REVIEW_TIMESTAMP }));

    assert.match(section, /\*\*Full Moon in Aries\*\* \(in about 3 days\)/);
    assert.match(section, /\*\*Venus stations retrograde\*\* \(in about 10 days\)/);
  });
});

describe('performSpreadAnalysis astrology timing', () => {
  it("computes transits and the forecast for the reading's reference time and timezone", async () => {
    const analysis = await performSpreadAnalysis(
      { key: 'threeCard', name: 'Three-Card Story' },
      [
        { card: 'Death', number: 13, position: 'Past', orientation: 'Upright' },
        { card: 'Temperance', number: 14, position: 'Present', orientation: 'Upright' },
        { card: 'The Star', number: 17, position: 'Future', orientation: 'Upright' }
      ],
      {
        userQuestion: 'What should I focus on this week?',
        referenceTime: '2026-09-26T03:00:00Z',
        location: { latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' }
      },
      'astro-reference-time-test',
      {}
    );

    assert.equal(analysis.ephemerisContext.timestamp, '2026-09-26T03:00:00.000Z');
    assert.equal(analysis.ephemerisForecast.startDate, '2026-09-26T03:00:00.000Z');
    const fullMoon = analysis.ephemerisForecast.events.find((event) => event.type === 'full-moon');
    assert.equal(fullMoon.dayOffset, 1, 'It is still Sep 25 in New York, so the full moon is tomorrow');
  });
});

describe('current lunar phase near an exact lunation', () => {
  it('names the coming lunation by the sign it falls in, not where the Moon is now', async () => {
    // 36 h before the Sep 26 full moon (3.62° Aries per Horizons) the Moon is still in Pisces.
    const context = await fetchEphemerisContext('2026-09-25T04:49:00Z');
    const weather = buildAstrologicalWeatherSection(context);

    assert.equal(context.moonPhase.sign, 'Pisces', 'Scenario precondition: the Moon is in Pisces now');
    assert.match(weather, /Moon now in Pisces; the exact Full Moon falls in Aries in about 36 hours/);
    assert.doesNotMatch(weather, /illumination\) in Pisces|illumination in Pisces/);
    assert.equal(getEphemerisSummary(context).split(' | ')[0], 'Moon: Full Moon in Aries');
  });

  it('reports a lunation that already passed in the sign it happened in', async () => {
    // 36 h after the Oct 10 new moon (17.36° Libra per Horizons) the Moon has moved into Scorpio.
    const context = await fetchEphemerisContext('2026-10-12T03:50:00Z');

    assert.equal(context.moonPhase.sign, 'Scorpio', 'Scenario precondition: the Moon is in Scorpio now');
    assert.match(
      buildAstrologicalWeatherSection(context),
      /Moon now in Scorpio; the exact New Moon was in Libra about 36 hours ago/
    );
  });

  it('gives the client the lunation sign and exact time', async () => {
    const payload = buildEphemerisClientPayload(await fetchEphemerisContext('2026-09-25T04:49:00Z'));

    assert.equal(payload.moonPhase.exactLunation.sign, 'Aries');
    assertNear(payload.moonPhase.exactLunation.date, '2026-09-26T16:49:00Z', 2 * MINUTE_MS, 'exact full moon');
  });

  it('adds no lunation to phases between new and full', async () => {
    const context = await fetchEphemerisContext('2026-09-30T12:00:00Z');

    assert.equal(context.moonPhase.phaseName, 'Waning Gibbous', 'Scenario precondition');
    assert.equal(context.moonPhase.exactLunation, undefined);
    assert.match(buildAstrologicalWeatherSection(context), /\*\*Lunar Phase\*\*: Waning Gibbous \([\d.]+% illumination\) in \w+\n/);
  });
});

describe('forecast input validation', () => {
  it('rejects a non-positive sampling interval instead of looping forever', () => {
    assert.throws(
      () => findEphemerisEvents(new Date(REVIEW_TIMESTAMP), 14, { sampleIntervalDays: 0 }),
      RangeError
    );
  });

  it('reports a readable error for an invalid forecast length', async () => {
    const forecast = await fetchEphemerisForecast(Number.NaN, { referenceTime: REVIEW_TIMESTAMP });

    assert.equal(forecast.available, false);
    assert.match(String(forecast.error), /forecast length/i);
  });
});
