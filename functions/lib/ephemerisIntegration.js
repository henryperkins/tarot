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

const DAY_MS = 24 * 60 * 60 * 1000;

// Only these retrogrades carry advice; the slow outer planets are retrograde for
// months each year, so they are reported as facts without guidance.
const PERSONAL_PLANETS = ['Mercury', 'Venus', 'Mars'];

function getPersonalRetrogrades(retrogrades) {
  return (retrogrades || [])
    .map((r) => r.planet)
    .filter((planet) => PERSONAL_PLANETS.includes(planet));
}

function formatNames(names) {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// astronomy-engine throws plain strings (e.g. "Excessive iteration in Search()")
function describeError(err) {
  return err instanceof Error ? err.message : String(err);
}

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

// Intl.DateTimeFormat is costly to construct; reuse one per timezone and style
const DATE_FORMAT_OPTIONS = {
  calendarDay: { year: 'numeric', month: 'numeric', day: 'numeric' },
  label: { weekday: 'short', month: 'short', day: 'numeric' }
};
const dateFormatterCache = new Map();

function getDateFormatter(timezone, style) {
  const key = `${style}|${timezone}`;
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...DATE_FORMAT_OPTIONS[style] });
    dateFormatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Return a usable IANA timezone, or null when it is missing or unrecognized
 */
function resolveTimezone(timezone) {
  if (!timezone) return null;

  try {
    getDateFormatter(timezone, 'calendarDay');
    return timezone;
  } catch {
    return null;
  }
}

function getCalendarDayIndex(date, timezone) {
  const parts = getDateFormatter(timezone, 'calendarDay').formatToParts(date);
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS;
}

/**
 * Whole calendar days from `fromDate` to `toDate` on the clock in `timezone`,
 * so "today"/"tomorrow" follow the querent's calendar rather than elapsed hours
 */
function getCalendarDayOffset(fromDate, toDate, timezone) {
  return getCalendarDayIndex(toDate, timezone) - getCalendarDayIndex(fromDate, timezone);
}

/**
 * Format an event date as e.g. "Sat, Sep 26" in the given timezone
 */
function formatEventDateLabel(date, timezone) {
  return getDateFormatter(timezone, 'label').format(date);
}

/**
 * Phrase a span of time ("about 14 hours", "about 3 days") without assuming
 * the querent's calendar
 */
function describeSpan(hours) {
  const wholeHours = Math.round(Math.abs(hours));
  if (wholeHours < 1) return 'less than an hour';
  if (wholeHours === 1) return 'about an hour';
  if (wholeHours < 48) return `about ${wholeHours} hours`;
  return `about ${Math.round(Math.abs(hours) / 24)} days`;
}

/**
 * Phrase when a forecast event happens. Calendar words ("tomorrow; Sat, Sep 26")
 * need the querent's timezone; without one, elapsed time is the honest phrasing.
 */
function describeEventTiming(event, { tomorrow = 'tomorrow' } = {}) {
  if (!event.dateLabel && Number.isFinite(event.hoursUntil)) {
    return `in ${describeSpan(event.hoursUntil)}`;
  }

  const inDays = event.dayOffset === 0 ? 'today'
    : event.dayOffset === 1 ? tomorrow
    : `in ${event.dayOffset} days`;
  return event.dateLabel ? `${inDays}; ${event.dateLabel}` : inDays;
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
    const message = describeError(err);
    console.warn('[ephemerisIntegration] Failed to fetch ephemeris data:', message);
    return {
      timestamp: new Date().toISOString(),
      positions: null,
      moonPhase: null,
      aspects: null,
      retrogrades: null,
      available: false,
      error: message,
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

  // Moon phase (near a lunation, keep the Moon's current sign apart from the lunation's)
  if (moonPhase) {
    const lunation = moonPhase.exactLunation;
    if (lunation) {
      const lunationName = lunation.type === 'new-moon' ? 'New Moon' : 'Full Moon';
      const timing = lunation.hoursFromNow >= 0
        ? `falls in ${lunation.sign} in ${describeSpan(lunation.hoursFromNow)}`
        : `was in ${lunation.sign} ${describeSpan(lunation.hoursFromNow)} ago`;
      lines.push(`- **Lunar Phase**: ${moonPhase.phaseName} (${moonPhase.illumination}% illumination), Moon now in ${moonPhase.sign}; the exact ${lunationName} ${timing}`);
    } else {
      lines.push(`- **Lunar Phase**: ${moonPhase.phaseName} (${moonPhase.illumination}% illumination) in ${moonPhase.sign}`);
    }
    if (moonPhase.interpretation) {
      lines.push(`  - ${moonPhase.interpretation}`);
    }
  }

  // Sun sign (current season)
  if (positions?.Sun) {
    lines.push(`- **Solar Season**: Sun in ${positions.Sun.sign} at ${positions.Sun.degree.toFixed(1)}°`);
  }

  // Retrogrades: every planet is listed as fact; only personal planets carry advice
  if (retrogrades?.length > 0) {
    const retroList = retrogrades.map(r => `${r.planet} in ${r.sign}`).join(', ');
    lines.push(`- **Retrograde Planets** (${retrogrades.length}): ${retroList}`);
    const personal = getPersonalRetrogrades(retrogrades);
    if (personal.length > 0) {
      lines.push(`  - ${formatNames(personal)} retrograde ${personal.length === 1 ? 'is' : 'are'} often read as a time to review and revisit what is already in motion; an invitation, not a rule`);
    }
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

  // Retrograde timing: only personal planets carry advice, phrased as an invitation
  const personal = getPersonalRetrogrades(retrogrades);
  const communication = personal.filter((planet) => planet !== 'Mars');

  if (spreadKey === 'decision' && communication.length > 0) {
    guidance.push(`${formatNames(communication)} retrograde ${communication.length === 1 ? 'is' : 'are'} often read as a time to double-check information before finalizing decisions; the choice and its timing remain the querent's`);
  }

  if (personal.length >= 2) {
    guidance.push(`With ${formatNames(personal)} retrograde together, this stretch is often read as a time for reflection and revision; an invitation, not a reason to hold back`);
  }

  return guidance.length > 0 ? guidance : null;
}

/**
 * Fetch ephemeris forecast for upcoming days
 * Detects key events: moon phases, retrograde stations, sign ingresses
 *
 * Each event is dated by an exact astronomical search (see
 * findEphemerisEvents). Adaptive sampling only spaces the checks that detect
 * stations and ingresses:
 * - Short forecasts (≤14 days): daily
 * - Medium forecasts (15-30 days): every 2 days
 * - Long forecasts (31-90 days): every 3 days
 *
 * @param {number} days - Forecast length in days
 * @param {Object} [options]
 * @param {string|Date} [options.referenceTime] - Forecast start (defaults to now); pass a
 *   reading's timestamp to reproduce the forecast it received
 * @param {string} [options.timezone] - The querent's IANA timezone. When known, events are
 *   phrased in calendar days with a local date label; otherwise in elapsed time, because
 *   UTC's "today" is not necessarily the querent's
 */
export async function fetchEphemerisForecast(days = 30, options = {}) {
  try {
    const referenceDate = options.referenceTime ? new Date(options.referenceTime) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error(`Invalid forecast reference time: ${options.referenceTime}`);
    }
    const timezone = resolveTimezone(options.timezone); // null when unknown
    const sampleIntervalDays = days <= 14 ? 1 : days <= 30 ? 2 : 3;

    const events = ephemerisWorkers
      .findEphemerisEvents(referenceDate, days, { sampleIntervalDays })
      .map((event) => describeForecastEvent(event, referenceDate, timezone));

    // Get current state for context
    const currentContext = await fetchEphemerisContext(referenceDate.toISOString());

    return {
      available: true,
      forecastDays: days,
      startDate: referenceDate.toISOString(),
      endDate: new Date(referenceDate.getTime() + days * DAY_MS).toISOString(),
      timezone,
      events,
      currentContext,
      source: 'astronomy-engine'
    };
  } catch (err) {
    const message = describeError(err);
    console.warn('[ephemerisIntegration] Failed to fetch forecast:', message);
    return {
      available: false,
      error: message,
      events: []
    };
  }
}

/**
 * Attach prompt-facing text and timing to an exact event. `dayOffset` counts
 * calendar days in the querent's timezone (UTC when unknown); `dateLabel` is
 * only set when that timezone is known.
 */
function describeForecastEvent(event, referenceDate, timezone) {
  const timing = {
    type: event.type,
    date: event.date.toISOString(),
    dayOffset: getCalendarDayOffset(referenceDate, event.date, timezone || 'UTC'),
    hoursUntil: Math.round(((event.date - referenceDate) / (60 * 60 * 1000)) * 10) / 10,
    ...(timezone ? { dateLabel: formatEventDateLabel(event.date, timezone) } : {})
  };

  switch (event.type) {
    case 'new-moon':
      return {
        ...timing,
        description: `New Moon in ${event.sign}`,
        guidance: 'Ideal for setting intentions and beginning new cycles'
      };
    case 'full-moon':
      return {
        ...timing,
        description: `Full Moon in ${event.sign}`,
        guidance: 'Time of illumination, culmination, and release'
      };
    case 'station-direct':
      return {
        ...timing,
        planet: event.planet,
        description: `${event.planet} stations direct`,
        guidance: getDirectStationGuidance(event.planet)
      };
    case 'station-retrograde':
      return {
        ...timing,
        planet: event.planet,
        description: `${event.planet} stations retrograde`,
        guidance: getRetrogradeStationGuidance(event.planet)
      };
    case 'sun-ingress':
      return {
        ...timing,
        sign: event.sign,
        description: `Sun enters ${event.sign}`,
        guidance: getSeasonGuidance(event.sign)
      };
    default:
      return { ...timing, description: 'Astrological event', guidance: '' };
  }
}

// Station guidance exists only for the personal planets and is phrased as a
// traditional reading, not a directive; outer-planet stations stay dated facts.
function getDirectStationGuidance(planet) {
  const guidance = {
    Mercury: 'Often read as communication and plans moving more freely again',
    Venus: 'Often read as relationships and creative work finding clearer footing',
    Mars: 'Often read as momentum returning to efforts that stalled'
  };
  return guidance[planet] || '';
}

function getRetrogradeStationGuidance(planet) {
  const guidance = {
    Mercury: 'Often read as a time to review communications and double-check details',
    Venus: 'Often read as a time to reflect on relationships and values',
    Mars: 'Often read as a time to pace effort and reconsider where energy goes'
  };
  return guidance[planet] || '';
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
    lines.push(`- **${event.description}** (${describeEventTiming(event)})`);
    if (event.guidance) {
      lines.push(`  - ${event.guidance}`);
    }
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
    // A New/Full Moon is named by the sign of the exact lunation
    parts.push(`Moon: ${moonPhase.phaseName} in ${moonPhase.exactLunation?.sign ?? moonPhase.sign}`);
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

    const desc = event.description || 'Astrological event';
    highlights.push(`${desc} (${describeEventTiming(event, { tomorrow: 'in 1 day' })})`);
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
