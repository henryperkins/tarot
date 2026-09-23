/**
 * Workers-Compatible Ephemeris Module
 *
 * Pure JavaScript astronomical calculations using astronomy-engine.
 * This module works in Cloudflare Workers V8 isolates (no native addons).
 *
 * Provides: planetary positions, moon phases, aspects, retrogrades
 */

import * as Astronomy from 'astronomy-engine';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const PLANETS = [
  { name: 'Sun', body: Astronomy.Body.Sun },
  { name: 'Moon', body: Astronomy.Body.Moon },
  { name: 'Mercury', body: Astronomy.Body.Mercury },
  { name: 'Venus', body: Astronomy.Body.Venus },
  { name: 'Mars', body: Astronomy.Body.Mars },
  { name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturn', body: Astronomy.Body.Saturn },
  { name: 'Uranus', body: Astronomy.Body.Uranus },
  { name: 'Neptune', body: Astronomy.Body.Neptune },
  { name: 'Pluto', body: Astronomy.Body.Pluto }
];

// Planets that can go retrograde (not Sun/Moon)
const RETROGRADE_PLANETS = PLANETS.filter(p =>
  !['Sun', 'Moon'].includes(p.name)
);

/**
 * Convert ecliptic longitude to zodiac sign and degree
 */
function longitudeToZodiac(longitude) {
  // Normalize to 0-360
  const normalizedLon = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLon / 30);
  const degree = normalizedLon % 30;

  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree: parseFloat(degree.toFixed(2)),
    longitude: parseFloat(normalizedLon.toFixed(2))
  };
}

/**
 * Get apparent geocentric ecliptic longitude (true equinox of date) for a body.
 * Planets must go through GeoVector: Astronomy.EclipticLongitude is heliocentric,
 * which puts Mercury/Venus in the wrong signs and never shows retrograde motion.
 */
function getLongitudeForBody(body, planetName, time) {
  if (planetName === 'Sun') {
    return Astronomy.SunPosition(time).elon;
  } else if (planetName === 'Moon') {
    return Astronomy.EclipticGeoMoon(time).lon;
  } else {
    return Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true)).elon;
  }
}

/**
 * Geocentric daily motion in degrees/day at an AstroTime.
 * Positive = direct motion, Negative = retrograde
 * The one-day window is centered on `time` so the sign flips at a station,
 * not half a day later.
 */
function getDailyMotion(body, planetName, time) {
  const lonAfter = getLongitudeForBody(body, planetName, time.AddDays(0.5));
  const lonBefore = getLongitudeForBody(body, planetName, time.AddDays(-0.5));

  // Handle wrap-around at 360°
  let speed = lonAfter - lonBefore;
  if (speed > 180) speed -= 360;
  if (speed < -180) speed += 360;

  return speed;
}

/**
 * Calculate daily motion (speed) for a planet
 * Positive = direct motion, Negative = retrograde
 */
function calculateSpeed(body, planetName, date) {
  try {
    return parseFloat(getDailyMotion(body, planetName, Astronomy.MakeTime(date)).toFixed(4));
  } catch {
    return 0;
  }
}

/**
 * Get current planetary positions
 * @param {string|null} dateString - ISO date string or null for now
 * @returns {Object} Positions data
 */
export function getCurrentPositions(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const time = Astronomy.MakeTime(date);
  const positions = {};

  for (const planet of PLANETS) {
    try {
      const longitude = getLongitudeForBody(planet.body, planet.name, time);
      const zodiacInfo = longitudeToZodiac(longitude);
      const speed = calculateSpeed(planet.body, planet.name, date);

      positions[planet.name] = {
        sign: zodiacInfo.sign,
        degree: zodiacInfo.degree,
        longitude: zodiacInfo.longitude,
        speed,
        isDirect: speed >= 0
      };
    } catch (err) {
      console.warn(`[ephemerisWorkers] Error calculating ${planet.name}:`, err.message);
    }
  }

  return {
    timestamp: date.toISOString(),
    positions
  };
}

/**
 * Get moon phase information
 * @param {string|null} dateString - ISO date string or null for now
 * @returns {Object} Moon phase data
 */
export function getMoonPhase(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const time = Astronomy.MakeTime(date);

  try {
    // MoonPhase returns angle 0-360 where:
    // 0° = New Moon, 90° = First Quarter, 180° = Full Moon, 270° = Last Quarter
    const phaseAngle = Astronomy.MoonPhase(time);

    // Calculate illumination (0-100%)
    const illumination = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2 * 100;

    // Determine phase name
    let phaseName;
    if (phaseAngle < 22.5 || phaseAngle >= 337.5) phaseName = 'New Moon';
    else if (phaseAngle < 67.5) phaseName = 'Waxing Crescent';
    else if (phaseAngle < 112.5) phaseName = 'First Quarter';
    else if (phaseAngle < 157.5) phaseName = 'Waxing Gibbous';
    else if (phaseAngle < 202.5) phaseName = 'Full Moon';
    else if (phaseAngle < 247.5) phaseName = 'Waning Gibbous';
    else if (phaseAngle < 292.5) phaseName = 'Last Quarter';
    else phaseName = 'Waning Crescent';

    // Get Moon's zodiac position
    const moonPos = Astronomy.EclipticGeoMoon(time);
    const zodiacInfo = longitudeToZodiac(moonPos.lon);

    // The New/Full names cover ~3.7-day bands; name the exact lunation inside the
    // band so its sign is not mistaken for wherever the Moon happens to be now.
    const exactLunation = phaseName === 'New Moon' || phaseName === 'Full Moon'
      ? findNearestLunation(phaseName === 'New Moon' ? 0 : 180, time)
      : null;

    return {
      timestamp: date.toISOString(),
      phaseName,
      phaseAngle: parseFloat(phaseAngle.toFixed(2)),
      illumination: parseFloat(illumination.toFixed(1)),
      sign: zodiacInfo.sign,
      degree: zodiacInfo.degree,
      isWaxing: phaseAngle < 180,
      ...(exactLunation ? { exactLunation } : {}),
      interpretation: getMoonPhaseInterpretation(phaseName, exactLunation?.sign ?? zodiacInfo.sign)
    };
  } catch (err) {
    console.error('[ephemerisWorkers] Error calculating moon phase:', err.message);
    throw err;
  }
}

/**
 * Find the exact new (0°) or full (180°) moon nearest to `time`, searching
 * three days either side, with the sign the Moon occupies at that instant.
 */
function findNearestLunation(targetPhase, time) {
  const candidates = [
    Astronomy.SearchMoonPhase(targetPhase, time, 3),
    Astronomy.SearchMoonPhase(targetPhase, time, -3)
  ].filter(Boolean);
  if (candidates.length === 0) return null;

  const nearest = candidates.reduce((best, candidate) =>
    Math.abs(candidate.ut - time.ut) < Math.abs(best.ut - time.ut) ? candidate : best
  );
  const zodiacInfo = longitudeToZodiac(Astronomy.EclipticGeoMoon(nearest).lon);

  return {
    type: targetPhase === 0 ? 'new-moon' : 'full-moon',
    date: nearest.date.toISOString(),
    hoursFromNow: Math.round((nearest.ut - time.ut) * 24 * 10) / 10,
    sign: zodiacInfo.sign,
    degree: zodiacInfo.degree
  };
}

/**
 * Get planetary aspects (angular relationships between planets)
 * @param {string|null} dateString - ISO date string or null for now
 * @param {number} orb - Maximum orb for aspects (default 8°)
 * @returns {Array} List of active aspects
 */
export function getPlanetaryAspects(dateString = null, orb = 8) {
  const positions = getCurrentPositions(dateString).positions;
  const aspects = [];

  const planetNames = Object.keys(positions);

  // Aspect definitions
  const aspectTypes = [
    { name: 'conjunction', angle: 0, orb, symbol: '☌' },
    { name: 'opposition', angle: 180, orb, symbol: '☍' },
    { name: 'trine', angle: 120, orb, symbol: '△' },
    { name: 'square', angle: 90, orb, symbol: '□' },
    { name: 'sextile', angle: 60, orb: 6, symbol: '⚹' }
  ];

  // Check all planet pairs
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i];
      const planet2 = planetNames[j];

      const lon1 = positions[planet1].longitude;
      const lon2 = positions[planet2].longitude;

      let angle = Math.abs(lon1 - lon2);
      if (angle > 180) angle = 360 - angle;

      // Check against each aspect type
      for (const aspectType of aspectTypes) {
        const diff = Math.abs(angle - aspectType.angle);
        if (diff <= aspectType.orb) {
          aspects.push({
            planet1,
            planet2,
            type: aspectType.name,
            symbol: aspectType.symbol,
            angle: parseFloat(angle.toFixed(2)),
            orb: parseFloat(diff.toFixed(2)),
            applying: isAspectApplying(positions[planet1], positions[planet2]),
            interpretation: getAspectInterpretation(planet1, planet2, aspectType.name)
          });
        }
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

/**
 * Check if an aspect is applying (getting tighter) or separating
 */
function isAspectApplying(pos1, pos2) {
  // If the faster planet is approaching the slower, aspect is applying
  const speedDiff = Math.abs(pos1.speed) - Math.abs(pos2.speed);
  return speedDiff > 0;
}

/**
 * Get planets currently in retrograde
 * @param {string|null} dateString - ISO date string or null for now
 * @returns {Array} List of retrograde planets
 */
export function getRetrogradePlanets(dateString = null) {
  const positions = getCurrentPositions(dateString).positions;
  const retrogrades = [];

  for (const planet of RETROGRADE_PLANETS) {
    const pos = positions[planet.name];
    if (pos && pos.speed < 0) {
      retrogrades.push({
        planet: planet.name,
        sign: pos.sign,
        degree: pos.degree,
        speed: pos.speed,
        interpretation: getRetrogradeInterpretation(planet.name)
      });
    }
  }

  return retrogrades;
}

/**
 * Find dated astrological events between `startDate` and `startDate + days`.
 *
 * Every event is timed by an exact search (lunar phase, solar longitude, or
 * motion reversal) and carries the sign at that instant. Samples only detect
 * that an event happened between two instants; they never supply its date or
 * sign. The broad getMoonPhase() names are display categories, not events.
 *
 * @param {Date} startDate - Window start
 * @param {number} days - Window length in days
 * @param {Object} [options]
 * @param {number} [options.sampleIntervalDays=1] - Detection spacing for stations and ingresses
 * @returns {Array<Object>} Events ({ type, date, sign, degree?, planet? }) sorted by date
 */
export function findEphemerisEvents(startDate, days, { sampleIntervalDays = 1 } = {}) {
  if (!(Number.isFinite(days) && days > 0)) {
    throw new RangeError(`Invalid forecast length: ${days}`);
  }
  if (!(Number.isFinite(sampleIntervalDays) && sampleIntervalDays > 0)) {
    throw new RangeError(`Invalid sample interval: ${sampleIntervalDays}`);
  }
  const startTime = Astronomy.MakeTime(startDate);
  const sampleTimes = getSampleTimes(startTime, days, sampleIntervalDays);

  return [
    ...findLunarPhaseEvents(startTime, startTime.AddDays(days)),
    ...findStations(sampleTimes),
    ...findSunIngresses(sampleTimes)
  ].sort((a, b) => a.date - b.date);
}

function getSampleTimes(startTime, days, intervalDays) {
  const times = [];
  for (let offset = 0; offset < days; offset += intervalDays) {
    times.push(startTime.AddDays(offset));
  }
  times.push(startTime.AddDays(days));
  return times;
}

function findLunarPhaseEvents(startTime, endTime) {
  const events = [];

  // Quarters: 0 = new, 1 = first quarter, 2 = full, 3 = third quarter
  for (
    let quarter = Astronomy.SearchMoonQuarter(startTime);
    quarter.time.ut <= endTime.ut;
    quarter = Astronomy.NextMoonQuarter(quarter)
  ) {
    if (quarter.quarter !== 0 && quarter.quarter !== 2) continue;

    const zodiacInfo = longitudeToZodiac(Astronomy.EclipticGeoMoon(quarter.time).lon);
    events.push({
      type: quarter.quarter === 0 ? 'new-moon' : 'full-moon',
      date: quarter.time.date,
      sign: zodiacInfo.sign,
      degree: zodiacInfo.degree
    });
  }

  return events;
}

function findStations(sampleTimes) {
  const events = [];

  for (const planet of RETROGRADE_PLANETS) {
    const motion = (time) => getDailyMotion(planet.body, planet.name, time);
    let prevTime = sampleTimes[0];
    let prevMotion = motion(prevTime);

    for (const time of sampleTimes.slice(1)) {
      const currMotion = motion(time);
      const goesRetrograde = prevMotion >= 0 && currMotion < 0;
      const goesDirect = prevMotion < 0 && currMotion >= 0;

      if (goesRetrograde || goesDirect) {
        // Search finds ascending zero crossings, so flip motion for a retrograde station.
        const direction = goesRetrograde ? -1 : 1;
        const stationTime = Astronomy.Search(
          (t) => direction * motion(t),
          prevTime,
          time,
          { dt_tolerance_seconds: 60, init_f1: direction * prevMotion, init_f2: direction * currMotion }
        );

        if (stationTime) {
          const zodiacInfo = longitudeToZodiac(getLongitudeForBody(planet.body, planet.name, stationTime));
          events.push({
            type: goesRetrograde ? 'station-retrograde' : 'station-direct',
            planet: planet.name,
            date: stationTime.date,
            sign: zodiacInfo.sign,
            degree: zodiacInfo.degree
          });
        }
      }

      prevTime = time;
      prevMotion = currMotion;
    }
  }

  return events;
}

function findSunIngresses(sampleTimes) {
  const events = [];
  const signIndexAt = (time) => Math.floor(Astronomy.SunPosition(time).elon / 30);
  let prevTime = sampleTimes[0];
  let prevSignIndex = signIndexAt(prevTime);

  for (const time of sampleTimes.slice(1)) {
    const signIndex = signIndexAt(time);

    if (signIndex !== prevSignIndex) {
      const ingressTime = Astronomy.SearchSunLongitude(signIndex * 30, prevTime, time.ut - prevTime.ut);
      if (ingressTime) {
        events.push({
          type: 'sun-ingress',
          date: ingressTime.date,
          sign: ZODIAC_SIGNS[signIndex]
        });
      }
    }

    prevTime = time;
    prevSignIndex = signIndex;
  }

  return events;
}

/**
 * Get complete ephemeris snapshot for a reading
 * @param {string} timestamp - ISO date string
 * @returns {Object} Complete ephemeris data
 */
export function getEphemerisForReading(timestamp) {
  const date = new Date(timestamp);

  return {
    timestamp: date.toISOString(),
    positions: getCurrentPositions(timestamp).positions,
    moon: getMoonPhase(timestamp),
    aspects: getPlanetaryAspects(timestamp),
    retrogrades: getRetrogradePlanets(timestamp),
    readingContext: generateReadingContext(date),
    source: 'astronomy-engine' // Indicates pure JS source
  };
}

/**
 * Generate astrological context summary for a reading
 */
function generateReadingContext(date) {
  const positions = getCurrentPositions(date.toISOString()).positions;
  const moon = getMoonPhase(date.toISOString());
  const aspects = getPlanetaryAspects(date.toISOString());
  const retrogrades = getRetrogradePlanets(date.toISOString());

  const context = [];

  // Moon phase context (a New/Full Moon is named by the sign of the exact lunation)
  context.push(`Moon: ${moon.phaseName} in ${moon.exactLunation?.sign ?? moon.sign}`);

  // Sun sign
  if (positions.Sun) {
    context.push(`Sun: ${positions.Sun.sign}`);
  }

  // Key tight aspects (orb < 3°)
  const tightAspects = aspects.filter(a => a.orb < 3);
  if (tightAspects.length > 0) {
    const aspectList = tightAspects.slice(0, 3)
      .map(a => `${a.planet1} ${a.symbol} ${a.planet2}`)
      .join(', ');
    context.push(`Aspects: ${aspectList}`);
  }

  // Retrogrades
  if (retrogrades.length > 0) {
    context.push(`Rx: ${retrogrades.map(r => r.planet).join(', ')}`);
  }

  return context.join(' | ');
}

/**
 * Interpretation helpers
 */
function getMoonPhaseInterpretation(phaseName, sign) {
  const phaseInterpretations = {
    'New Moon': 'Beginnings, seeds, intentions',
    'Waxing Crescent': 'Initial growth, faith required',
    'First Quarter': 'Action, decision, commitment',
    'Waxing Gibbous': 'Refinement, adjustment, development',
    'Full Moon': 'Culmination, revelation, illumination',
    'Waning Gibbous': 'Gratitude, sharing, dissemination',
    'Last Quarter': 'Re-orientation, release, surrender',
    'Waning Crescent': 'Rest, reflection, transition'
  };

  return `${phaseInterpretations[phaseName] || phaseName} in ${sign}`;
}

function getAspectInterpretation(planet1, planet2, aspectType) {
  const interpretations = {
    conjunction: 'fusion, intensification, new cycle',
    opposition: 'awareness, balance, integration needed',
    trine: 'flow, ease, natural talent',
    square: 'tension, growth catalyst, breakthrough potential',
    sextile: 'opportunity, cooperation, skill development'
  };

  return `${planet1}-${planet2}: ${interpretations[aspectType] || aspectType}`;
}

function getRetrogradeInterpretation(planet) {
  const interpretations = {
    Mercury: 'Review communication, revisit plans, reflect on decisions',
    Venus: 'Reassess relationships, reconsider values, reconnect with past',
    Mars: 'Redirect energy inward, reconsider actions, patience required',
    Jupiter: 'Internal expansion, philosophical review, beliefs examined',
    Saturn: 'Structural review, karmic lessons, responsibility reassessed',
    Uranus: 'Internal revolution, personal awakening, authenticity questioned',
    Neptune: 'Spiritual deepening, illusions dissolving, dreams significant',
    Pluto: 'Deep transformation, power reclaimed, shadow work intensified'
  };

  return interpretations[planet] || 'Reflective, inward-focused energy';
}

/**
 * Get daily astrological weather summary
 * @param {string|null} dateString - ISO date string or null for now
 * @returns {Object} Daily weather summary
 */
export function getDailyAstrologicalWeather(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const positions = getCurrentPositions(dateString);
  const moon = getMoonPhase(dateString);
  const aspects = getPlanetaryAspects(dateString);
  const retrogrades = getRetrogradePlanets(dateString);

  // Identify dominant themes
  const themes = [];

  // Moon phase theme
  if (moon.phaseName.includes('New')) {
    themes.push('beginnings');
  } else if (moon.phaseName.includes('Full')) {
    themes.push('culmination');
  } else if (moon.isWaxing) {
    themes.push('building');
  } else {
    themes.push('releasing');
  }

  // Retrograde themes
  if (retrogrades.some(r => r.planet === 'Mercury')) {
    themes.push('communication review');
  }
  if (retrogrades.length >= 3) {
    themes.push('introspection');
  }

  // Aspect themes
  const squares = aspects.filter(a => a.type === 'square' && a.orb < 3);
  if (squares.length > 0) {
    themes.push('dynamic tension');
  }

  const trines = aspects.filter(a => a.type === 'trine' && a.orb < 3);
  if (trines.length > 0) {
    themes.push('flowing support');
  }

  return {
    date: date.toISOString().split('T')[0],
    moon: {
      phase: moon.phaseName,
      sign: moon.sign,
      illumination: moon.illumination
    },
    sun: positions.positions.Sun,
    retrogradeCount: retrogrades.length,
    retrogradePlanets: retrogrades.map(r => r.planet),
    tightAspects: aspects.filter(a => a.orb < 3).slice(0, 5),
    themes,
    summary: generateReadingContext(date)
  };
}

export default {
  getCurrentPositions,
  getMoonPhase,
  getPlanetaryAspects,
  getRetrogradePlanets,
  findEphemerisEvents,
  getEphemerisForReading,
  getDailyAstrologicalWeather
};
