// Heuristic: decide when astrological context is relevant enough to surface
// in the reading prompts. Uses card anchors + spread/graph signals + user intent
// + real-time ephemeris data to avoid spraying astro notes when the spread is
// more practical/grounded.
export function shouldIncludeAstroInsights(cardsInfo = [], themes = {}, userQuestion = '', ephemerisContext = null) {
  const names = (Array.isArray(cardsInfo) ? cardsInfo : [])
    .map((c) => (c?.card || '').toLowerCase());

  // Cards that strongly imply celestial / timing context
  const astroAnchors = ['the sun', 'the moon', 'the star', 'wheel of fortune', 'judgement', 'temperance', 'the world'];
  const hasAnchor = names.some((n) => astroAnchors.some((anchor) => n.includes(anchor)));

  // Dense Major presence keeps astro relevant
  const majorHeavy = typeof themes?.majorRatio === 'number' && themes.majorRatio >= 0.5;

  // GraphRAG combos (triads / Fool's Journey) are archetypal and pair well with astro timing
  const graphKeys = themes?.knowledgeGraph?.graphKeys || {};
  const hasGraphCombos = Boolean((graphKeys.completeTriadIds?.length || 0) > 0 || graphKeys.foolsJourneyStageKey);

  // Timing profile hints at longer arcs (chapter/seasonal) where astro adds value.
  // `themes.timingProfile` is typically a string from `functions/lib/pacingHeuristics.js`
  // (e.g. 'near-term-tilt' | 'developing-arc' | 'longer-arc-tilt'), but we also
  // support legacy object forms like `{ type: 'seasonal' }`.
  const timingProfile = themes?.timingProfile;
  const timingType = typeof timingProfile === 'string'
    ? timingProfile
    : timingProfile?.type;
  const timingSuggestsAstro = [
    'developing-arc',
    'longer-arc-tilt',
    // legacy-ish types
    'seasonal',
    'long',
    'medium'
  ].includes(timingType);

  // User intent: explicit astro/time keywords force opt-in
  const intent = (userQuestion || '').toLowerCase();
  const astroKeywords = [
    'astrology', 'planet', 'planets', 'transit', 'transits', 'retrograde', 'mercury retrograde',
    'eclipse', 'moon', 'full moon', 'new moon', 'lunar', 'solar return', 'horoscope',
    'zodiac', 'sign', 'season', 'equinox', 'solstice'
  ];
  const intentAstro = astroKeywords.some((kw) => intent.includes(kw));

  // Moon phase weighting: New Moon and Full Moon are pivotal moments that
  // amplify archetypal themes in readings. These phases have strong traditional
  // associations with beginnings/intentions (New) and culmination/revelation (Full).
  const moonPhase = ephemerisContext?.moonPhase?.phaseName || '';
  const isPivotalMoonPhase = moonPhase === 'New Moon' || moonPhase === 'Full Moon';
  // Quarter moons also carry significance (action/release points)
  const isQuarterMoon = moonPhase === 'First Quarter' || moonPhase === 'Last Quarter';

  // Card-moon resonance: The Moon card during actual moon phases creates strong sync
  const hasMoonCard = names.some((n) => n.includes('the moon'));
  const moonCardResonance = hasMoonCard && (isPivotalMoonPhase || isQuarterMoon);

  let score = 0;
  if (hasAnchor) score += 2;          // Strong signal
  if (majorHeavy) score += 1;
  if (hasGraphCombos) score += 1;
  if (timingSuggestsAstro) score += 1;
  if (intentAstro) score += 3;        // Strong override from user intent
  if (isPivotalMoonPhase) score += 2; // New/Full moon boost
  if (isQuarterMoon) score += 1;      // Quarter moon minor boost
  if (moonCardResonance) score += 1;  // The Moon card + actual moon phase sync

  // Require at least two signals, or a single strong anchor, to include astro
  return score >= 2;
}

