/**
 * Emotion Mapping for GraphRAG patterns
 *
 * Maps detected archetypal patterns (triads, dyads, journey stages, suit progressions)
 * to an emotional tone for the reading. The reading API returns it as
 * `emotionalTone`, and the frontend uses it for the narrative's atmosphere and
 * color script.
 */

/**
 * Maps triad themes (from ARCHETYPAL_TRIADS) to emotional tones
 */
export const TRIAD_EMOTIONS = {
  'Healing Arc': 'hopeful-transformative',
  'Liberation Arc': 'triumphant-revelatory',
  'Inner Work Arc': 'contemplative-mysterious',
  'Mastery Arc': 'confident-empowering',
  'Relationship & Values Arc': 'warm-reflective',
  'Complete Manifestation Cycle': 'expansive-triumphant',
  'Authority & Structure Arc': 'grounded-wise',
  'Karmic Acceptance Arc': 'accepting-serene',
  'Post-Crisis Navigation Arc': 'tender-hopeful',
  'Inner Mastery Through Solitude Arc': 'introspective-peaceful'
};

/**
 * Maps dyad categories (from ARCHETYPAL_DYADS) to emotional tones
 */
export const DYAD_CATEGORY_EMOTIONS = {
  'empowerment': 'confident-empowering',
  'transformation': 'transformative-profound',
  'shadow-challenge': 'thoughtful-cautionary',
  'wisdom-intuition': 'contemplative-mysterious',
  'cycles-fate': 'accepting-wise',
  'power-structure': 'grounded-authoritative',
  'hope-vision': 'hopeful-inspiring'
};

/**
 * Maps Fool's Journey stages (from FOOLS_JOURNEY) to emotional tones
 */
export const JOURNEY_STAGE_EMOTIONS = {
  'initiation': 'curious-hopeful',
  'integration': 'transformative-deep',
  'culmination': 'profound-transcendent'
};

/**
 * Maps suit + progression stage to emotional tones
 */
export const SUIT_EMOTIONS = {
  Wands: {
    beginning: 'passionate-inspired',
    challenge: 'determined-fierce',
    mastery: 'accomplished-weary'
  },
  Cups: {
    beginning: 'loving-open',
    challenge: 'grieving-complex',
    mastery: 'fulfilled-wise'
  },
  Swords: {
    beginning: 'clear-piercing',
    challenge: 'conflicted-strategic',
    mastery: 'liberated-dawning'
  },
  Pentacles: {
    beginning: 'grounded-promising',
    challenge: 'resourceful-testing',
    mastery: 'abundant-legacy'
  }
};

/**
 * Derive dominant emotional tone from GraphRAG pattern analysis
 *
 * Uses weighted scoring to determine the most significant emotional tone
 * based on detected patterns in the reading.
 *
 * Priority weights:
 * - Complete triads: 3 (strongest narrative arc)
 * - Fool's Journey stage: 2 (developmental significance)
 * - High-significance dyads: 2 (powerful card combinations)
 * - Suit progressions: 1 (contextual coloring)
 *
 * @param {Object} themes - The themes object from reading response
 * @returns {Object} { emotion, confidence, sources }
 */
export function deriveEmotionalTone(themes) {
  if (!themes) {
    return { emotion: 'default', confidence: 'low', sources: [] };
  }

  const patterns = themes.knowledgeGraph?.patterns;
  if (!patterns) {
    return { emotion: 'default', confidence: 'low', sources: [] };
  }

  const sources = [];
  const emotionWeights = {};

  // Priority 1: Complete triads (weight: 3)
  if (patterns.triads?.length > 0) {
    const completeTriad = patterns.triads.find(t => t.isComplete);
    if (completeTriad) {
      const emotion = TRIAD_EMOTIONS[completeTriad.theme] || 'transformative-profound';
      emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 3;
      sources.push({ type: 'triad', theme: completeTriad.theme, emotion, weight: 3 });
    } else {
      // Partial triads get weight 1
      const partialTriad = patterns.triads[0];
      if (partialTriad?.theme) {
        const emotion = TRIAD_EMOTIONS[partialTriad.theme] || 'transformative-profound';
        emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 1;
        sources.push({ type: 'partial-triad', theme: partialTriad.theme, emotion, weight: 1 });
      }
    }
  }

  // Priority 2: Fool's Journey stage (weight: 2)
  if (patterns.foolsJourney?.stageKey) {
    const emotion = JOURNEY_STAGE_EMOTIONS[patterns.foolsJourney.stageKey] || 'contemplative-mysterious';
    emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 2;
    sources.push({
      type: 'journey',
      stage: patterns.foolsJourney.stageKey,
      significance: patterns.foolsJourney.significance,
      emotion,
      weight: 2
    });
  }

  // Priority 3: High-significance dyads (weight: 2)
  if (patterns.dyads?.length > 0) {
    const highSigDyad = patterns.dyads.find(d => d.significance === 'high');
    if (highSigDyad?.category) {
      const emotion = DYAD_CATEGORY_EMOTIONS[highSigDyad.category] || 'transformative-profound';
      emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 2;
      sources.push({
        type: 'dyad',
        category: highSigDyad.category,
        theme: highSigDyad.theme,
        emotion,
        weight: 2
      });
    } else {
      // Lower significance dyads get weight 1
      const dyad = patterns.dyads[0];
      if (dyad?.category) {
        const emotion = DYAD_CATEGORY_EMOTIONS[dyad.category] || 'transformative-profound';
        emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 1;
        sources.push({ type: 'dyad', category: dyad.category, emotion, weight: 1 });
      }
    }
  }

  // Priority 4: Suit progressions (weight: 1)
  if (patterns.suitProgressions?.length > 0) {
    const prog = patterns.suitProgressions[0];
    const suitEmotions = SUIT_EMOTIONS[prog.suit];
    if (suitEmotions && prog.stage) {
      const emotion = suitEmotions[prog.stage] || 'grounded-wise';
      emotionWeights[emotion] = (emotionWeights[emotion] || 0) + 1;
      sources.push({
        type: 'suit',
        suit: prog.suit,
        stage: prog.stage,
        emotion,
        weight: 1
      });
    }
  }

  // Find dominant emotion by total weight
  const sortedEmotions = Object.entries(emotionWeights)
    .sort((a, b) => b[1] - a[1]);

  const dominant = sortedEmotions[0];

  if (!dominant) {
    return { emotion: 'default', confidence: 'low', sources: [] };
  }

  // Determine confidence based on total weight
  const totalWeight = dominant[1];
  let confidence;
  if (totalWeight >= 4) {
    confidence = 'high';
  } else if (totalWeight >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    emotion: dominant[0],
    confidence,
    totalWeight,
    sources
  };
}
