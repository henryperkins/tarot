/**
 * Emotion Mapping for GraphRAG-based TTS
 *
 * Maps detected archetypal patterns (triads, dyads, journey stages, suit progressions)
 * to emotional tones for Hume TTS acting instructions.
 *
 * Used by both frontend (audioHume.js) and backend (tts-hume.js).
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
 * Maps emotional tones to Hume acting instructions (voice descriptions)
 * These descriptions guide how the TTS voice should express the emotion.
 */
export const EMOTION_DESCRIPTIONS = {
  // Triad-derived emotions
  'hopeful-transformative':
    'Speak with gentle hope and acknowledgment of change. Your voice should convey that while transformation may be difficult, renewal awaits. Pace yourself with compassion, allowing space for the weight of change.',

  'triumphant-revelatory':
    'Speak with quiet triumph and revelation. Your voice carries the energy of breakthrough—not boastful, but genuinely liberated. Allow moments of wonder and relief to color your delivery.',

  'contemplative-mysterious':
    'Speak with deep contemplation and mystery. Your voice should feel like it comes from within a sacred space. Slow, deliberate pacing with space for the unconscious to breathe. Honor the unknown.',

  'confident-empowering':
    'Speak with grounded confidence and empowerment. Your voice conveys mastery and capability. Clear, assured, but not arrogant—wise authority that uplifts the listener.',

  'warm-reflective':
    'Speak with warmth and gentle reflection. Your voice nurtures and invites introspection about values and connections. Soft, caring, fully present with the listener.',

  'expansive-triumphant':
    'Speak with expansive energy and celebration. Your voice carries the fullness of achievement—joyful completion, the satisfaction of a journey well-traveled. Grand but grounded.',

  'grounded-wise':
    'Speak with earthy wisdom and stability. Your voice conveys deep knowledge born of experience. Measured, trustworthy, like a wise elder sharing hard-won understanding.',

  'grounded-authoritative':
    'Speak with grounded authority and structure. Your voice conveys leadership and clear direction. Firm but not harsh—the voice of someone who has earned their position.',

  'accepting-serene':
    'Speak with peaceful acceptance and serenity. Your voice conveys surrender to what is, finding peace in the flow of fate. Calm, centered, at ease with uncertainty.',

  'accepting-wise':
    'Speak with the wisdom of acceptance. Your voice acknowledges life\'s cycles with equanimity. Neither resigned nor passive—actively at peace with change.',

  'tender-hopeful':
    'Speak with tender care and gentle hope. Your voice acknowledges fragility while nurturing possibility. Soft, encouraging, like a hand offered in the dark.',

  'introspective-peaceful':
    'Speak with quiet introspection and inner peace. Your voice comes from a place of solitary wisdom, comfortable with silence, at home in the depths.',

  // Journey-derived emotions
  'curious-hopeful':
    'Speak with fresh curiosity and open-hearted hope. Your voice carries the energy of new beginnings—exploratory, encouraging, full of possibility. Light and inviting.',

  'transformative-deep':
    'Speak with acknowledgment of difficulty and honor for the process. Your voice recognizes the weight of transformation while holding space for growth. Patient, compassionate, understanding.',

  'profound-transcendent':
    'Speak with deep wisdom and cosmic perspective. Your voice touches the transcendent—aware of larger patterns, connected to something greater. Reverent but not distant.',

  // Dyad-derived emotions
  'transformative-profound':
    'Speak with recognition of deep change. Your voice honors the profound nature of transformation. Serious but not heavy—carrying weight with grace.',

  'thoughtful-cautionary':
    'Speak with gentle warning and supportive concern. Your voice is caring but honest about shadows. Not alarming—thoughtfully protective, like a wise friend.',

  'hopeful-inspiring':
    'Speak with hope that inspires action. Your voice lifts and motivates. Encouraging without being saccharine—genuine optimism grounded in possibility.',

  // Suit-derived emotions
  'passionate-inspired':
    'Speak with creative fire and inspired energy. Your voice carries enthusiasm and vision. Dynamic, alive, ready to ignite possibility.',

  'determined-fierce':
    'Speak with fierce determination and protective strength. Your voice holds ground with conviction. Intense but focused—fire that has learned discipline.',

  'accomplished-weary':
    'Speak with the weight of accomplishment. Your voice acknowledges both achievement and exhaustion. Proud but tired—success that needs rest.',

  'loving-open':
    'Speak with open-hearted love and emotional availability. Your voice flows with connection and warmth. Tender, receptive, emotionally generous.',

  'grieving-complex':
    'Speak with acknowledgment of emotional complexity. Your voice holds space for grief, confusion, and mixed feelings. Compassionate with the messiness of the heart.',

  'fulfilled-wise':
    'Speak with emotional fulfillment and relational wisdom. Your voice carries the satisfaction of authentic connection. Content, grateful, emotionally mature.',

  'clear-piercing':
    'Speak with mental clarity and truth-telling directness. Your voice cuts through confusion with precision. Clear, honest, unafraid of difficult truths.',

  'conflicted-strategic':
    'Speak with acknowledgment of mental conflict and strategic thinking. Your voice navigates complexity without oversimplifying. Thoughtful, tactical, aware of tensions.',

  'liberated-dawning':
    'Speak with the freshness of mental liberation. Your voice carries the relief of clarity finally achieved. Light, free, awakening from confusion.',

  'grounded-promising':
    'Speak with earthy groundedness and practical promise. Your voice conveys solid foundations and real potential. Steady, reliable, genuinely encouraging.',

  'resourceful-testing':
    'Speak with practical resourcefulness under pressure. Your voice acknowledges challenges while emphasizing capability. Steady, problem-solving, resilient.',

  'abundant-legacy':
    'Speak with the fullness of material and spiritual abundance. Your voice carries generational wisdom and lasting achievement. Rich, substantial, enduring.',

  // Default fallback
  'default':
    'Speak as a wise, compassionate tarot reader. Use a thoughtful, contemplative tone with natural pauses for reflection. Your voice should feel like a trusted guide—warm, insightful, and present.'
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

/**
 * Get Hume acting instructions for a given emotion
 *
 * @param {string} emotion - The emotion key
 * @returns {string} The voice description/acting instructions
 */
export function getActingInstructions(emotion) {
  return EMOTION_DESCRIPTIONS[emotion] || EMOTION_DESCRIPTIONS['default'];
}
