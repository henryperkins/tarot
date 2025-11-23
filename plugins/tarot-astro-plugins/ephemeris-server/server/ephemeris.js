/**
 * Ephemeris calculations using astronomy-engine
 * Provides planetary positions, aspects, and lunar data
 */

import * as astronomy from 'astronomy-engine';

const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/**
 * Get current planetary positions
 */
export function getCurrentPositions(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const positions = {};

  PLANETS.forEach(planet => {
    try {
      const bodyName = planet === 'Sun' ? 'Sun' : planet;
      const ecliptic = astronomy.Ecliptic(bodyName, date);

      const sign = ZODIAC_SIGNS[Math.floor(ecliptic.elon / 30)];
      const degree = ecliptic.elon % 30;

      positions[planet] = {
        sign,
        degree: parseFloat(degree.toFixed(2)),
        longitude: parseFloat(ecliptic.elon.toFixed(2)),
        latitude: parseFloat(ecliptic.elat.toFixed(2))
      };
    } catch (error) {
      console.error(`Error calculating position for ${planet}:`, error);
    }
  });

  return {
    timestamp: date.toISOString(),
    positions
  };
}

/**
 * Get moon phase information
 */
export function getMoonPhase(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();

  // Get illumination
  const illumination = astronomy.Illumination('Moon', date);

  // Get moon position
  const ecliptic = astronomy.Ecliptic('Moon', date);
  const sign = ZODIAC_SIGNS[Math.floor(ecliptic.elon / 30)];
  const degree = ecliptic.elon % 30;

  // Determine phase name
  const phase = illumination.phase_angle;
  let phaseName;

  if (phase < 22.5) phaseName = 'New Moon';
  else if (phase < 67.5) phaseName = 'Waxing Crescent';
  else if (phase < 112.5) phaseName = 'First Quarter';
  else if (phase < 157.5) phaseName = 'Waxing Gibbous';
  else if (phase < 202.5) phaseName = 'Full Moon';
  else if (phase < 247.5) phaseName = 'Waning Gibbous';
  else if (phase < 292.5) phaseName = 'Last Quarter';
  else if (phase < 337.5) phaseName = 'Waning Crescent';
  else phaseName = 'New Moon';

  return {
    timestamp: date.toISOString(),
    phaseName,
    phaseAngle: parseFloat(phase.toFixed(2)),
    illumination: parseFloat((illumination.phase_fraction * 100).toFixed(1)),
    sign,
    degree: parseFloat(degree.toFixed(2)),
    isWaxing: phase < 180,
    interpretation: getMoonPhaseInterpretation(phaseName, sign)
  };
}

/**
 * Get planetary aspects
 */
export function getPlanetaryAspects(dateString = null, orb = 8) {
  const date = dateString ? new Date(dateString) : new Date();
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
            interpretation: getAspectInterpretation(planet1, planet2, aspectType.name)
          });
        }
      });
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

/**
 * Get planets in retrograde
 */
export function getRetrogradePlanets(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const retrogrades = [];

  // Check Mercury through Pluto (not Sun/Moon)
  const retroPlanets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  retroPlanets.forEach(planet => {
    try {
      // Check velocity by comparing positions over 1 day
      const currentEcliptic = astronomy.Ecliptic(planet, date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextEcliptic = astronomy.Ecliptic(planet, nextDay);

      let movement = nextEcliptic.elon - currentEcliptic.elon;

      // Normalize for 360-degree wraparound
      if (movement > 180) movement -= 360;
      if (movement < -180) movement += 360;

      if (movement < 0) {
        retrogrades.push({
          planet,
          sign: ZODIAC_SIGNS[Math.floor(currentEcliptic.elon / 30)],
          degree: parseFloat((currentEcliptic.elon % 30).toFixed(2)),
          interpretation: getRetrogradeInterpretation(planet)
        });
      }
    } catch (error) {
      console.error(`Error checking retrograde for ${planet}:`, error);
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
    readingContext: generateReadingContext(date)
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
