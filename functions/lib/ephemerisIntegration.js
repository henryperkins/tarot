/**
 * Ephemeris Integration Module
 * Connects real-time astrological data to the tarot narrative builder system.
 *
 * Uses astronomy-engine (pure JavaScript) for Workers-compatible calculations.
 * No native Node.js addons required - works in Cloudflare Workers V8 isolates.
 */

import { getAstroForCard } from './esotericMeta.js';
import * as ephemerisWorkers from './ephemerisWorkers.js';

// Planet name normalization for matching
const PLANET_ALIASES = {
  'Sun': ['Sun', 'Solar'],
  'Moon': ['Moon', 'Luna', 'Lunar', 'The Moon'],
  'Mercury': ['Mercury'],
  'Venus': ['Venus'],
  'Mars': ['Mars'],
  'Jupiter': ['Jupiter'],
  'Saturn': ['Saturn'],
  'Uranus': ['Uranus'],
  'Neptune': ['Neptune'],
  'Pluto': ['Pluto']
};

// Sign name normalization
const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/**
 * Extract planet and sign from a card's astrological correspondence
 * e.g., "Mars in Aries" -> { planet: 'Mars', sign: 'Aries' }
 * e.g., "Mercury" -> { planet: 'Mercury', sign: null }
 * e.g., "Scorpio" -> { planet: null, sign: 'Scorpio' }
 */
function parseAstroLabel(label) {
  if (!label) return { planet: null, sign: null };

  // Check for "Planet in Sign" pattern
  const inMatch = label.match(/^(\w+)\s+in\s+(\w+)/i);
  if (inMatch) {
    return { planet: inMatch[1], sign: inMatch[2] };
  }

  // Check if it's just a planet
  for (const [planet] of Object.entries(PLANET_ALIASES)) {
    if (label.includes(planet)) {
      return { planet, sign: null };
    }
  }

  // Check if it's just a sign
  for (const sign of SIGN_NAMES) {
    if (label.includes(sign)) {
      return { planet: null, sign };
    }
  }

  return { planet: null, sign: null };
}

/**
 * Format a date in the user's local timezone for display
 * @param {Date} date - The date to format
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns {string|null} Formatted local time or null if invalid
 */
function formatLocalTime(date, timezone) {
  if (!timezone) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    return formatter.format(date);
  } catch {
    return null;
  }
}

/**
 * Fetch ephemeris context using Workers-compatible astronomy-engine
 * Pure JavaScript - no native addons, works in V8 isolates
 *
 * @param {string|null} timestamp - ISO timestamp or null for now
 * @param {Object} options - Options including location
 * @param {Object} options.location - Optional location { latitude, longitude, timezone }
 */
export async function fetchEphemerisContext(timestamp = null, options = {}) {
  const { location } = options;

  try {
    const date = timestamp ? new Date(timestamp) : new Date();
    const isoTimestamp = date.toISOString();

    // Use Workers-compatible ephemeris module (astronomy-engine)
    // Note: Astronomical calculations are inherently in UTC;
    // location affects timezone display and local interpretation
    const [positionsPayload, moonPhase, aspects, retrogrades] = await Promise.all([
      Promise.resolve(ephemerisWorkers.getCurrentPositions(isoTimestamp)),
      Promise.resolve(ephemerisWorkers.getMoonPhase(isoTimestamp)),
      Promise.resolve(ephemerisWorkers.getPlanetaryAspects(isoTimestamp, 5)), // 5° orb for tight aspects
      Promise.resolve(ephemerisWorkers.getRetrogradePlanets(isoTimestamp))
    ]);

    // Extract positions from payload
    const planetPositions = positionsPayload?.positions || positionsPayload || null;
    const positionsMeta = positionsPayload?.positions ? {
      timestamp: positionsPayload.timestamp
    } : null;

    // Build location context for prompt building
    // Use explicit null/undefined checks - 0° lat/long are valid coordinates (equator/prime meridian)
    const hasValidLocation = location?.latitude != null && location?.longitude != null;
    const locationContext = hasValidLocation ? {
      timezone: location.timezone || 'UTC',
      localTimeDescription: formatLocalTime(date, location.timezone),
      locationUsed: true
    } : {
      timezone: 'UTC',
      localTimeDescription: null,
      locationUsed: false
    };

    return {
      timestamp: isoTimestamp,
      positions: planetPositions,
      positionsMeta,
      moonPhase,
      aspects,
      retrogrades,
      available: true,
      source: 'astronomy-engine', // Indicates pure JS source
      locationContext
    };
  } catch (err) {
    console.warn('[ephemerisIntegration] Failed to fetch ephemeris data:', err.message);
    return {
      timestamp: new Date().toISOString(),
      positions: null,
      moonPhase: null,
      aspects: null,
      retrogrades: null,
      available: false,
      error: err.message,
      locationContext: { timezone: 'UTC', localTimeDescription: null, locationUsed: false }
    };
  }
}

/**
 * Match current transits to drawn cards
 * Returns resonance data for cards with active astrological alignments
 */
export function matchTransitsToCards(cardsInfo, ephemerisContext) {
  if (!ephemerisContext?.available || !cardsInfo?.length) {
    return [];
  }

  const resonances = [];
  const { positions, retrogrades } = ephemerisContext;

  // Build lookup maps
  const retrogradeSet = new Set(
    (retrogrades || []).map(r => r.planet?.toLowerCase())
  );

  const currentPlanetSigns = {};
  if (positions) {
    for (const [planet, data] of Object.entries(positions)) {
      currentPlanetSigns[planet.toLowerCase()] = data.sign;
    }
  }

  for (const cardInfo of cardsInfo) {
    const astro = getAstroForCard(cardInfo);
    if (!astro?.label) continue;

    const { planet, sign } = parseAstroLabel(astro.label);
    const cardName = cardInfo.card || cardInfo.name || 'Unknown';
    const position = cardInfo.position || '';

    // Check for planet retrograde match
    if (planet && retrogradeSet.has(planet.toLowerCase())) {
      const retroData = retrogrades.find(r =>
        r.planet?.toLowerCase() === planet.toLowerCase()
      );

      resonances.push({
        card: cardName,
        position,
        type: 'retrograde',
        planet,
        currentSign: retroData?.sign,
        cardCorrespondence: astro.label,
        interpretation: buildRetrogradeResonance(planet, cardInfo, retroData)
      });
    }

    // Check for planet-sign alignment
    if (planet && currentPlanetSigns[planet.toLowerCase()]) {
      const currentSign = currentPlanetSigns[planet.toLowerCase()];
      const isExactMatch = sign && currentSign.toLowerCase() === sign.toLowerCase();

      if (isExactMatch) {
        resonances.push({
          card: cardName,
          position,
          type: 'exact-transit',
          planet,
          currentSign,
          cardCorrespondence: astro.label,
          interpretation: buildExactTransitResonance(planet, sign, cardInfo)
        });
      } else if (!sign) {
        // Card corresponds to planet, planet is active
        resonances.push({
          card: cardName,
          position,
          type: 'planetary-emphasis',
          planet,
          currentSign,
          cardCorrespondence: astro.label,
          interpretation: buildPlanetaryEmphasis(planet, currentSign, cardInfo)
        });
      }
    }

    // Check for sign emphasis (Sun or other planets in the card's sign)
    if (sign && !planet) {
      const sunSign = currentPlanetSigns['sun'];
      if (sunSign?.toLowerCase() === sign.toLowerCase()) {
        resonances.push({
          card: cardName,
          position,
          type: 'solar-season',
          sign,
          interpretation: `The Sun currently transits ${sign}, amplifying ${cardName}'s themes`
        });
      }
    }
  }

  return resonances;
}

/**
 * Build interpretation text for retrograde resonance
 */
function buildRetrogradeResonance(planet, cardInfo, retroData) {
  const cardName = cardInfo.card || cardInfo.name;
  const isReversed = cardInfo.orientation?.toLowerCase() === 'reversed';

  const retroThemes = {
    Mercury: 'communication, planning, and mental clarity',
    Venus: 'relationships, values, and creative expression',
    Mars: 'action, drive, and assertiveness',
    Jupiter: 'expansion, beliefs, and opportunities',
    Saturn: 'structures, responsibilities, and long-term plans',
    Uranus: 'innovation, freedom, and sudden changes',
    Neptune: 'intuition, dreams, and spiritual matters',
    Pluto: 'transformation, power dynamics, and deep change'
  };

  const theme = retroThemes[planet] || 'its associated themes';

  if (isReversed) {
    return `${planet} retrograde in ${retroData?.sign || 'the heavens'} doubles the reflective quality of ${cardName} reversed—a strong call to review ${theme}`;
  }

  return `${planet} retrograde emphasizes ${cardName}'s invitation to revisit and reconsider ${theme}`;
}

/**
 * Build interpretation text for exact transit match
 */
function buildExactTransitResonance(planet, sign, cardInfo) {
  const cardName = cardInfo.card || cardInfo.name;
  return `${planet} currently transits ${sign}—the exact correspondence of ${cardName}—strengthening this card's influence in your reading`;
}

/**
 * Build interpretation for general planetary emphasis
 */
function buildPlanetaryEmphasis(planet, currentSign, cardInfo) {
  const cardName = cardInfo.card || cardInfo.name;
  return `${planet} (ruling ${cardName}) currently moves through ${currentSign}, coloring this card's expression`;
}

/**
 * Build the astrological weather section for the system prompt
 */
export function buildAstrologicalWeatherSection(ephemerisContext) {
  if (!ephemerisContext?.available) {
    return null;
  }

  const lines = ['## CURRENT ASTROLOGICAL CONTEXT'];
  const { moonPhase, retrogrades, aspects, positions, locationContext } = ephemerisContext;

  // Location-aware intro if user provided location
  if (locationContext?.locationUsed && locationContext?.localTimeDescription) {
    lines.push(`*Reading cast for your local time: ${locationContext.localTimeDescription}*`);
    lines.push('');
  }

  // Moon phase
  if (moonPhase) {
    lines.push(`- **Lunar Phase**: ${moonPhase.phaseName} (${moonPhase.illumination}% illumination) in ${moonPhase.sign}`);
    if (moonPhase.interpretation) {
      lines.push(`  - ${moonPhase.interpretation}`);
    }
  }

  // Sun sign (current season)
  if (positions?.Sun) {
    lines.push(`- **Solar Season**: Sun in ${positions.Sun.sign} at ${positions.Sun.degree.toFixed(1)}°`);
  }

  // Retrogrades
  if (retrogrades?.length > 0) {
    const retroList = retrogrades.map(r => `${r.planet} in ${r.sign}`).join(', ');
    lines.push(`- **Retrograde Planets** (${retrogrades.length}): ${retroList}`);
    lines.push('  - Retrogrades suggest review, reflection, and revisiting rather than initiating');
  }

  // Tight aspects (orb < 2°)
  const tightAspects = (aspects || []).filter(a => a.orb < 2);
  if (tightAspects.length > 0) {
    lines.push('- **Active Aspects**:');
    for (const aspect of tightAspects.slice(0, 3)) {
      lines.push(`  - ${aspect.planet1} ${aspect.type} ${aspect.planet2} (${aspect.orb.toFixed(1)}° orb)`);
    }
  }

  lines.push('');
  lines.push('Use this astrological context to enrich timing guidance and thematic resonance, but keep the cards as the primary focus of the reading.');

  return lines.join('\n');
}

/**
 * Build card-specific transit notes for the user prompt
 */
export function buildCardTransitNotes(resonances) {
  if (!resonances?.length) {
    return null;
  }

  const lines = ['**Current Transit Resonances**:'];

  for (const res of resonances) {
    lines.push(`- ${res.card}: ${res.interpretation}`);
  }

  return lines.join('\n');
}

/**
 * Generate timing guidance based on moon phase and retrogrades
 */
export function generateTimingGuidance(ephemerisContext, spreadKey) {
  if (!ephemerisContext?.available) {
    return null;
  }

  const guidance = [];
  const { moonPhase, retrogrades } = ephemerisContext;

  // Moon phase timing
  if (moonPhase) {
    const phase = moonPhase.phaseName?.toLowerCase() || '';

    if (phase.includes('new')) {
      guidance.push('New Moon energy favors setting intentions and beginning inner work');
    } else if (phase.includes('waxing crescent') || phase.includes('waxing gibbous')) {
      guidance.push('Waxing Moon supports building momentum and taking gradual action');
    } else if (phase.includes('full')) {
      guidance.push('Full Moon illuminates what needs to be seen and supports completion');
    } else if (phase.includes('waning')) {
      guidance.push('Waning Moon favors release, reflection, and letting go');
    }
  }

  // Retrograde timing (especially for decision spreads)
  if (retrogrades?.length > 0) {
    const hasCommRetro = retrogrades.some(r =>
      ['Mercury', 'Venus'].includes(r.planet)
    );

    if (spreadKey === 'decision' && hasCommRetro) {
      guidance.push('With communication/relationship planets retrograde, consider gathering more information before finalizing decisions');
    }

    if (retrogrades.length >= 4) {
      guidance.push('Multiple retrogrades suggest this is a time for internal processing rather than external action');
    }
  }

  return guidance.length > 0 ? guidance : null;
}

/**
 * Fetch ephemeris forecast for upcoming days
 * Detects key events: moon phases, retrograde stations, sign ingresses
 *
 * Uses adaptive sampling to balance accuracy with performance:
 * - Short forecasts (≤14 days): daily sampling for moon phase precision
 * - Medium forecasts (15-30 days): every 2 days
 * - Long forecasts (31-90 days): every 3 days
 */
export async function fetchEphemerisForecast(days = 30, _options = {}) {
  try {
    const now = new Date();
    const events = [];

    // Adaptive sampling interval based on forecast length
    const sampleInterval = days <= 14 ? 1 : days <= 30 ? 2 : 3;

    let prevMoonPhase = null;
    let prevPositions = null;
    let prevRetrogrades = null;

    for (let dayOffset = 0; dayOffset <= days; dayOffset += sampleInterval) {
      const sampleDate = new Date(now);
      sampleDate.setDate(sampleDate.getDate() + dayOffset);
      const isoDate = sampleDate.toISOString();

      // Use Workers-compatible ephemeris module
      const positionsPayload = ephemerisWorkers.getCurrentPositions(isoDate);
      const positions = positionsPayload?.positions || positionsPayload || null;
      const moonPhase = ephemerisWorkers.getMoonPhase(isoDate);
      const retrogrades = ephemerisWorkers.getRetrogradePlanets(isoDate);

      // Detect New Moon / Full Moon transitions
      if (prevMoonPhase) {
        const prevPhase = prevMoonPhase.phaseName?.toLowerCase() || '';
        const currPhase = moonPhase.phaseName?.toLowerCase() || '';

        if (currPhase.includes('new moon') && !prevPhase.includes('new moon')) {
          events.push({
            type: 'new-moon',
            date: isoDate,
            dayOffset,
            description: `New Moon in ${moonPhase.sign}`,
            guidance: 'Ideal for setting intentions and beginning new cycles'
          });
        }
        if (currPhase.includes('full moon') && !prevPhase.includes('full moon')) {
          events.push({
            type: 'full-moon',
            date: isoDate,
            dayOffset,
            description: `Full Moon in ${moonPhase.sign}`,
            guidance: 'Time of illumination, culmination, and release'
          });
        }
      }

      // Detect retrograde stations (planet goes direct)
      if (prevRetrogrades && retrogrades) {
        const prevRetroSet = new Set(prevRetrogrades.map(r => r.planet));
        const currRetroSet = new Set(retrogrades.map(r => r.planet));

        // Planet went direct (was retrograde, now isn't)
        for (const planet of prevRetroSet) {
          if (!currRetroSet.has(planet)) {
            events.push({
              type: 'station-direct',
              date: isoDate,
              dayOffset,
              planet,
              description: `${planet} stations direct`,
              guidance: getDirectStationGuidance(planet)
            });
          }
        }

        // Planet went retrograde (wasn't retrograde, now is)
        for (const planet of currRetroSet) {
          if (!prevRetroSet.has(planet)) {
            events.push({
              type: 'station-retrograde',
              date: isoDate,
              dayOffset,
              planet,
              description: `${planet} stations retrograde`,
              guidance: getRetrogradeStationGuidance(planet)
            });
          }
        }
      }

      // Detect Sun sign ingress (season change)
      if (prevPositions?.Sun && positions?.Sun) {
        if (prevPositions.Sun.sign !== positions.Sun.sign) {
          events.push({
            type: 'sun-ingress',
            date: isoDate,
            dayOffset,
            sign: positions.Sun.sign,
            description: `Sun enters ${positions.Sun.sign}`,
            guidance: getSeasonGuidance(positions.Sun.sign)
          });
        }
      }

      prevMoonPhase = moonPhase;
      prevPositions = positions;
      prevRetrogrades = retrogrades;
    }

    // Get current state for context
    const currentContext = await fetchEphemerisContext();

    return {
      available: true,
      forecastDays: days,
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
      events: events.sort((a, b) => a.dayOffset - b.dayOffset),
      currentContext,
      source: 'astronomy-engine'
    };
  } catch (err) {
    console.warn('[ephemerisIntegration] Failed to fetch forecast:', err.message);
    return {
      available: false,
      error: err.message,
      events: []
    };
  }
}

function getDirectStationGuidance(planet) {
  const guidance = {
    Mercury: 'Communication clears, plans can move forward, good time to sign agreements',
    Venus: 'Relationships clarify, creative projects gain momentum',
    Mars: 'Action energy returns, projects stalled can restart',
    Jupiter: 'Expansion resumes, opportunities open up',
    Saturn: 'Structures solidify, responsibilities become clearer',
    Uranus: 'Change accelerates, breakthroughs possible',
    Neptune: 'Clarity emerges from confusion, spiritual insights manifest',
    Pluto: 'Transformation completes a phase, power dynamics shift'
  };
  return guidance[planet] || 'Forward momentum returns';
}

function getRetrogradeStationGuidance(planet) {
  const guidance = {
    Mercury: 'Review communications, avoid signing contracts, backup data',
    Venus: 'Reflect on relationships and values, past connections may resurface',
    Mars: 'Slow down, redirect energy inward, avoid forcing action',
    Jupiter: 'Internal growth phase, reassess beliefs and goals',
    Saturn: 'Review commitments and structures, karmic lessons surface',
    Uranus: 'Internal revolution, question assumptions about freedom',
    Neptune: 'Deepen spiritual practice, dreams become significant',
    Pluto: 'Deep psychological work, transform from within'
  };
  return guidance[planet] || 'Time for reflection and review';
}

function getSeasonGuidance(sign) {
  const guidance = {
    Aries: 'Spring energy: initiative, new beginnings, bold action',
    Taurus: 'Grounding time: stability, pleasure, building resources',
    Gemini: 'Communication peak: learning, connections, versatility',
    Cancer: 'Nurturing focus: home, family, emotional security',
    Leo: 'Creative expression: confidence, joy, self-expression',
    Virgo: 'Refinement period: health, service, practical improvements',
    Libra: 'Balance seeking: relationships, harmony, aesthetics',
    Scorpio: 'Depth work: transformation, intimacy, hidden truths',
    Sagittarius: 'Expansion time: adventure, philosophy, higher learning',
    Capricorn: 'Achievement focus: goals, structure, responsibility',
    Aquarius: 'Innovation period: community, ideals, future vision',
    Pisces: 'Spiritual closing: intuition, compassion, release'
  };
  return guidance[sign] || 'New seasonal energy emerging';
}

/**
 * Build forecast section for prompts
 */
export function buildForecastSection(forecast) {
  if (!forecast?.available || !forecast.events?.length) {
    return null;
  }

  const lines = ['## UPCOMING ASTROLOGICAL EVENTS'];
  lines.push(`Forecast period: next ${forecast.forecastDays} days`);
  lines.push('');

  for (const event of forecast.events.slice(0, 6)) {
    const inDays = event.dayOffset === 0 ? 'today' :
                   event.dayOffset === 1 ? 'tomorrow' :
                   `in ${event.dayOffset} days`;
    lines.push(`- **${event.description}** (${inDays})`);
    lines.push(`  - ${event.guidance}`);
  }

  lines.push('');
  lines.push('Use these upcoming events to inform timing guidance in the reading.');

  return lines.join('\n');
}

/**
 * Get a concise ephemeris summary for the reading context line
 */
export function getEphemerisSummary(ephemerisContext) {
  if (!ephemerisContext?.available) {
    return null;
  }

  const parts = [];
  const { moonPhase, retrogrades, positions } = ephemerisContext;

  if (moonPhase) {
    parts.push(`Moon: ${moonPhase.phaseName} in ${moonPhase.sign}`);
  }

  if (positions?.Sun) {
    parts.push(`Sun: ${positions.Sun.sign}`);
  }

  if (retrogrades?.length > 0) {
    parts.push(`${retrogrades.length} retrograde${retrogrades.length > 1 ? 's' : ''}`);
  }

  return parts.join(' | ');
}

/**
 * Build concise highlight strings for medium/long-range intention coaching
 * Keeps to a small number of bullets for prompt+UI use.
 */
export function formatForecastHighlights(forecast, maxItems = 4) {
  if (!forecast?.available) return [];

  const highlights = [];
  const events = Array.isArray(forecast.events) ? forecast.events : [];

  for (const event of events) {
    if (highlights.length >= maxItems) break;

    const inDays = event.dayOffset === 0 ? 'today'
      : event.dayOffset === 1 ? 'in 1 day'
      : `in ${event.dayOffset} days`;

    const desc = event.description || 'Astrological event';
    highlights.push(`${desc} (${inDays})`);
  }

  // Add current retrogrades context if space remains
  if (highlights.length < maxItems && forecast.currentContext?.retrogrades?.length) {
    const retroList = forecast.currentContext.retrogrades
      .map(r => r.planet)
      .filter(Boolean)
      .join(', ');
    if (retroList) {
      highlights.push(`Retrogrades active now: ${retroList}`);
    }
  }

  return highlights;
}

export default {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  matchTransitsToCards,
  buildAstrologicalWeatherSection,
  buildCardTransitNotes,
  buildForecastSection,
  generateTimingGuidance,
  getEphemerisSummary,
  formatForecastHighlights
};
