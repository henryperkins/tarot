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
 * Get longitude for a body at a given time
 * Handles Sun and Moon specially since EclipticLongitude doesn't work for them
 */
function getLongitudeForBody(body, planetName, time) {
  if (planetName === 'Sun') {
    return Astronomy.SunPosition(time).elon;
  } else if (planetName === 'Moon') {
    return Astronomy.EclipticGeoMoon(time).lon;
  } else {
    return Astronomy.EclipticLongitude(body, time);
  }
}

/**
 * Calculate daily motion (speed) for a planet
 * Positive = direct motion, Negative = retrograde
 */
function calculateSpeed(body, planetName, date) {
  const time = Astronomy.MakeTime(date);
  const dayBefore = Astronomy.MakeTime(new Date(date.getTime() - 86400000));

  try {
    const lonNow = getLongitudeForBody(body, planetName, time);
    const lonBefore = getLongitudeForBody(body, planetName, dayBefore);

    // Handle wrap-around at 360°
    let speed = lonNow - lonBefore;
    if (speed > 180) speed -= 360;
    if (speed < -180) speed += 360;

    return parseFloat(speed.toFixed(4));
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
      let longitude;

      if (planet.name === 'Sun') {
        const sunPos = Astronomy.SunPosition(time);
        longitude = sunPos.elon;
      } else if (planet.name === 'Moon') {
        const moonPos = Astronomy.EclipticGeoMoon(time);
        longitude = moonPos.lon;
      } else {
        longitude = Astronomy.EclipticLongitude(planet.body, time);
      }

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

    return {
      timestamp: date.toISOString(),
      phaseName,
      phaseAngle: parseFloat(phaseAngle.toFixed(2)),
      illumination: parseFloat(illumination.toFixed(1)),
      sign: zodiacInfo.sign,
      degree: zodiacInfo.degree,
      isWaxing: phaseAngle < 180,
      interpretation: getMoonPhaseInterpretation(phaseName, zodiacInfo.sign)
    };
  } catch (err) {
    console.error('[ephemerisWorkers] Error calculating moon phase:', err.message);
    throw err;
  }
}

/**
 * Get planetary aspects (angular relationships between planets)
 * @param {string|null} dateString - ISO date string or null for now
 * @param {number} orb - Maximum orb for aspects (default 8°)
 * @returns {Array} List of active aspects
 */
export function getPlanetaryAspects(dateString = null, orb = 8) {
  const date = dateString ? new Date(dateString) : new Date();
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
  const date = dateString ? new Date(dateString) : new Date();
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

  // Moon phase context
  context.push(`Moon: ${moon.phaseName} in ${moon.sign}`);

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
  getEphemerisForReading,
  getDailyAstrologicalWeather
};
