/**
 * Ephemeris calculations using Swiss Ephemeris (via sweph)
 * Provides planetary positions, aspects, and lunar data with high precision
 */

import sweph from 'sweph';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import constants from sweph
const {
  SE_SUN,
  SE_MOON,
  SE_MERCURY,
  SE_VENUS,
  SE_MARS,
  SE_JUPITER,
  SE_SATURN,
  SE_URANUS,
  SE_NEPTUNE,
  SE_PLUTO,
  SE_GREG_CAL,
  SEFLG_SWIEPH,
  SEFLG_SPEED
} = sweph.constants;

const PLANETS = [
  { name: 'Sun', id: SE_SUN },
  { name: 'Moon', id: SE_MOON },
  { name: 'Mercury', id: SE_MERCURY },
  { name: 'Venus', id: SE_VENUS },
  { name: 'Mars', id: SE_MARS },
  { name: 'Jupiter', id: SE_JUPITER },
  { name: 'Saturn', id: SE_SATURN },
  { name: 'Uranus', id: SE_URANUS },
  { name: 'Neptune', id: SE_NEPTUNE },
  { name: 'Pluto', id: SE_PLUTO }
];

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Initialize Swiss Ephemeris with data file path
function initSwissEph() {
  const possiblePaths = [
    path.join(__dirname, '..', 'ephe'),
    path.join(__dirname, '..', '..', 'ephe'),
    '/usr/share/swisseph',
    process.env.SE_EPHE_PATH
  ].filter(Boolean);

  for (const ephePath of possiblePaths) {
    try {
      sweph.set_ephe_path(ephePath);
      // Test if path works by trying to calculate Sun position
      const jd = sweph.julday(2024, 1, 1, 12.0, SE_GREG_CAL);
      const result = sweph.calc_ut(jd, SE_SUN, SEFLG_SWIEPH);
      if (!result.error) {
        console.error(`✅ Swiss Ephemeris initialized with path: ${ephePath}`);
        return ephePath;
      }
    } catch {
      continue;
    }
  }

  console.error('⚠️  Warning: Swiss Ephemeris data files not found. Please run: npm run postinstall');
  return null;
}

// Initialize on module load
const EPHE_PATH = initSwissEph();

/**
 * Convert JavaScript Date to Julian Day (UT)
 */
function dateToJulianDay(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // JS months are 0-indexed
  const day = date.getUTCDate();
  const hour = date.getUTCHours() + (date.getUTCMinutes() / 60.0) + (date.getUTCSeconds() / 3600.0);

  return sweph.julday(year, month, day, hour, SE_GREG_CAL);
}

/**
 * Get zodiac sign and degree from ecliptic longitude
 */
function getLongitudeInfo(longitude) {
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
 * Get current planetary positions
 */
export function getCurrentPositions(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const jd = dateToJulianDay(date);
  const positions = {};

  PLANETS.forEach(planet => {
    try {
      const result = sweph.calc_ut(jd, planet.id, SEFLG_SWIEPH | SEFLG_SPEED);

      if (result.error) {
        console.error(`Error calculating ${planet.name}: ${result.error}`);
        return;
      }

      const longitude = result.data[0]; // Ecliptic longitude
      const latitude = result.data[1];  // Ecliptic latitude
      const speed = result.data[3];     // Daily motion in longitude

      const lonInfo = getLongitudeInfo(longitude);

      positions[planet.name] = {
        sign: lonInfo.sign,
        degree: lonInfo.degree,
        longitude: lonInfo.longitude,
        latitude: parseFloat(latitude.toFixed(2)),
        speed: parseFloat(speed.toFixed(4)),
        isDirect: speed >= 0
      };
    } catch (error) {
      console.error(`Exception calculating ${planet.name}:`, error);
    }
  });

  return {
    timestamp: date.toISOString(),
    julianDay: jd,
    positions
  };
}

/**
 * Get moon phase information
 */
export function getMoonPhase(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const jd = dateToJulianDay(date);

  try {
    // Get Sun and Moon positions
    const sunResult = sweph.calc_ut(jd, SE_SUN, SEFLG_SWIEPH);
    const moonResult = sweph.calc_ut(jd, SE_MOON, SEFLG_SWIEPH);

    if (sunResult.error || moonResult.error) {
      throw new Error(sunResult.error || moonResult.error);
    }

    const sunLon = sunResult.data[0];
    const moonLon = moonResult.data[0];

    // Calculate phase angle (0-360)
    let phaseAngle = moonLon - sunLon;
    if (phaseAngle < 0) phaseAngle += 360;

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

    const moonLonInfo = getLongitudeInfo(moonLon);

    return {
      timestamp: date.toISOString(),
      phaseName,
      phaseAngle: parseFloat(phaseAngle.toFixed(2)),
      illumination: parseFloat(illumination.toFixed(1)),
      sign: moonLonInfo.sign,
      degree: moonLonInfo.degree,
      isWaxing: phaseAngle < 180,
      interpretation: getMoonPhaseInterpretation(phaseName, moonLonInfo.sign)
    };
  } catch (error) {
    console.error('Error calculating moon phase:', error);
    throw error;
  }
}

/**
 * Get planetary aspects
 */
export function getPlanetaryAspects(dateString = null, orb = 8) {
  const _date = dateString ? new Date(dateString) : new Date();
  const positions = getCurrentPositions(dateString).positions;
  const aspects = [];

  const planetNames = Object.keys(positions);

  // Check all planet pairs
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i];
      const planet2 = planetNames[j];

      const lon1 = positions[planet1].longitude;
      const lon2 = positions[planet2].longitude;

      let angle = Math.abs(lon1 - lon2);
      if (angle > 180) angle = 360 - angle;

      // Check for major aspects
      const aspectTypes = [
        { name: 'conjunction', angle: 0, orb },
        { name: 'opposition', angle: 180, orb },
        { name: 'trine', angle: 120, orb },
        { name: 'square', angle: 90, orb },
        { name: 'sextile', angle: 60, orb: 6 }
      ];

      aspectTypes.forEach(aspectType => {
        const diff = Math.abs(angle - aspectType.angle);
        if (diff <= aspectType.orb) {
          aspects.push({
            planet1,
            planet2,
            type: aspectType.name,
            angle: parseFloat(angle.toFixed(2)),
            orb: parseFloat(diff.toFixed(2)),
            applying: isAspectApplying(positions[planet1], positions[planet2], aspectType.angle),
            interpretation: getAspectInterpretation(planet1, planet2, aspectType.name)
          });
        }
      });
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

/**
 * Check if aspect is applying (planets moving together) or separating
 */
function isAspectApplying(planet1Pos, planet2Pos, _targetAngle) {
  // If planet1 is faster and behind, or planet2 is faster and behind, aspect is applying
  const speedDiff = planet1Pos.speed - planet2Pos.speed;
  let lonDiff = planet1Pos.longitude - planet2Pos.longitude;
  if (lonDiff < 0) lonDiff += 360;

  // Simplified check - more complex logic needed for exact determination
  return Math.abs(speedDiff) > 0.01;
}

/**
 * Get planets in retrograde
 */
export function getRetrogradePlanets(dateString = null) {
  const _date = dateString ? new Date(dateString) : new Date();
  const positions = getCurrentPositions(dateString).positions;
  const retrogrades = [];

  // Check Mercury through Pluto (not Sun/Moon)
  const retroPlanets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  retroPlanets.forEach(planetName => {
    const planetPos = positions[planetName];
    if (planetPos && planetPos.speed < 0) {
      retrogrades.push({
        planet: planetName,
        sign: planetPos.sign,
        degree: planetPos.degree,
        speed: planetPos.speed,
        interpretation: getRetrogradeInterpretation(planetName)
      });
    }
  });

  return retrogrades;
}

/**
 * Get complete ephemeris snapshot for a reading
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
    ephemerisPath: EPHE_PATH
  };
}

/**
 * Generate astrological context for a reading
 */
function generateReadingContext(date) {
  const positions = getCurrentPositions(date.toISOString()).positions;
  const moon = getMoonPhase(date.toISOString());
  const aspects = getPlanetaryAspects(date.toISOString());
  const retrogrades = getRetrogradePlanets(date.toISOString());

  const context = [];

  // Moon phase context
  context.push(`Moon in ${moon.sign} (${moon.phaseName})`);

  // Sun sign
  context.push(`Sun in ${positions.Sun.sign}`);

  // Key aspects
  const majorAspects = aspects.filter(a => a.orb < 3);
  if (majorAspects.length > 0) {
    context.push(`Active aspects: ${majorAspects.slice(0, 3).map(a =>
      `${a.planet1}-${a.planet2} ${a.type}`
    ).join(', ')}`);
  }

  // Retrogrades
  if (retrogrades.length > 0) {
    context.push(`Retrograde: ${retrogrades.map(r => r.planet).join(', ')}`);
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
    'Last Quarter': 'Re-orientation, crisis of consciousness',
    'Waning Crescent': 'Release, surrender, transition'
  };

  return `${phaseInterpretations[phaseName]} in ${sign}`;
}

function getAspectInterpretation(planet1, planet2, aspectType) {
  const interpretations = {
    conjunction: 'Fusion, blending, new cycle',
    opposition: 'Awareness, balance, integration',
    trine: 'Flow, ease, natural expression',
    square: 'Tension, growth, breakthrough',
    sextile: 'Opportunity, connection, skill'
  };

  return `${planet1}-${planet2}: ${interpretations[aspectType]}`;
}

function getRetrogradeInterpretation(planet) {
  const interpretations = {
    Mercury: 'Review communication, rethink plans, revisit details',
    Venus: 'Reevaluate relationships, reassess values, rediscover pleasure',
    Mars: 'Redirect energy, reconsider actions, internal drive',
    Jupiter: 'Internal expansion, philosophical review, reassess beliefs',
    Saturn: 'Structural review, karmic rework, authority reassessment',
    Uranus: 'Internal revolution, personal liberation, authentic change',
    Neptune: 'Spiritual deepening, dissolving illusions, inner mysticism',
    Pluto: 'Deep transformation, power reclamation, shadow integration'
  };

  return interpretations[planet] || 'Retrograde energy';
}

// Cleanup function (call when shutting down)
export function closeEphemeris() {
  sweph.close();
}
