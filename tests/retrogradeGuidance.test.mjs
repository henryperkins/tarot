import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  buildAstrologicalWeatherSection,
  buildForecastSection,
  generateTimingGuidance
} from '../functions/lib/ephemerisIntegration.js';

// Per JPL Horizons, on 2026-09-23 only Saturn, Uranus, Neptune and Pluto are retrograde;
// on 2026-10-28 Mercury and Venus are retrograde too (alongside Saturn, Uranus, Neptune).
const OUTER_ONLY = '2026-09-23T14:04:00Z';
const MERCURY_VENUS_RETRO = '2026-10-28T12:00:00Z';
const DIRECTIVE = /rather than|\bavoid\b|\bslow down\b|good time to sign/i;

describe('retrograde advice comes only from personal planets, as an invitation', () => {
  it('lists outer-planet retrogrades as facts without advice', async () => {
    const weather = buildAstrologicalWeatherSection(await fetchEphemerisContext(OUTER_ONLY));

    assert.match(weather, /Retrograde Planets\*\* \(4\): Saturn in Aries, Uranus in Gemini, Neptune in Aries, Pluto in Aquarius/);
    assert.doesNotMatch(weather, /Retrogrades suggest|often read as a time to review/);
  });

  it('adds invitational advice when Mercury or Venus is retrograde', async () => {
    const weather = buildAstrologicalWeatherSection(await fetchEphemerisContext(MERCURY_VENUS_RETRO));

    assert.match(weather, /Mercury and Venus retrograde are often read as a time to review/);
    assert.doesNotMatch(weather, DIRECTIVE);
  });

  it('gives a decision reading no retrograde timing advice from outer planets alone', async () => {
    const guidance = generateTimingGuidance(await fetchEphemerisContext(OUTER_ONLY), 'decision') || [];

    assert.ok(!guidance.some((line) => /retrograde/i.test(line)), guidance.join(' | '));
  });

  it('keeps personal-planet timing advice invitational for a decision reading', async () => {
    const guidance = generateTimingGuidance(await fetchEphemerisContext(MERCURY_VENUS_RETRO), 'decision') || [];
    const retrogradeLines = guidance.filter((line) => /retrograde/i.test(line));

    assert.ok(retrogradeLines.some((line) => /Mercury and Venus/.test(line)), guidance.join(' | '));
    assert.ok(retrogradeLines.every((line) => !DIRECTIVE.test(line)), retrogradeLines.join(' | '));
  });

  it('keeps outer-planet stations as dated facts and personal-planet stations as invitations', async () => {
    const forecast = await fetchEphemerisForecast(90, { referenceTime: OUTER_ONLY });
    const pluto = forecast.events.find((event) => event.type === 'station-direct' && event.planet === 'Pluto');
    const mercury = forecast.events.find((event) => event.type === 'station-retrograde' && event.planet === 'Mercury');

    assert.ok(pluto && mercury, 'Scenario precondition: both stations fall in this window');
    assert.equal(pluto.guidance, '');
    assert.match(mercury.guidance, /often read as/i);
    assert.doesNotMatch(buildForecastSection(forecast), DIRECTIVE);
    assert.match(buildForecastSection(forecast), /\*\*Pluto stations direct\*\* \([^)]*\)\n- /, 'No advice line under the Pluto station');
  });
});
