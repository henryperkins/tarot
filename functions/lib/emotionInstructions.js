/**
 * Emotion-based voice instructions for Azure gpt-4o-mini-tts
 *
 * These instructions are appended to context templates when an emotion
 * is derived from GraphRAG pattern analysis (triads, dyads, journey stages).
 *
 * Adapted from src/data/emotionMapping.js EMOTION_DESCRIPTIONS for TTS use.
 */

export const EMOTION_INSTRUCTIONS = {
  // Triad-derived emotions
  'hopeful-transformative':
    'Infuse your delivery with gentle hope and acknowledgment of change. Convey that while transformation may be difficult, renewal awaits. Pace yourself with compassion, allowing space for the weight of change.',

  'triumphant-revelatory':
    'Speak with quiet triumph and revelation. Carry the energy of breakthrough—not boastful, but genuinely liberated. Allow moments of wonder and relief to color your delivery.',

  'contemplative-mysterious':
    'Speak with deep contemplation and mystery. Your voice should feel like it comes from within a sacred space. Use slow, deliberate pacing with space for the unconscious to breathe. Honor the unknown.',

  'confident-empowering':
    'Speak with grounded confidence and empowerment. Convey mastery and capability. Be clear and assured, but not arrogant—wise authority that uplifts the listener.',

  'warm-reflective':
    'Speak with warmth and gentle reflection. Nurture and invite introspection about values and connections. Be soft, caring, and fully present with the listener.',

  'expansive-triumphant':
    'Speak with expansive energy and celebration. Carry the fullness of achievement—joyful completion, the satisfaction of a journey well-traveled. Be grand but grounded.',

  'grounded-wise':
    'Speak with earthy wisdom and stability. Convey deep knowledge born of experience. Be measured and trustworthy, like a wise elder sharing hard-won understanding.',

  'grounded-authoritative':
    'Speak with grounded authority and structure. Convey leadership and clear direction. Be firm but not harsh—the voice of someone who has earned their position.',

  'accepting-serene':
    'Speak with peaceful acceptance and serenity. Convey surrender to what is, finding peace in the flow of fate. Be calm, centered, and at ease with uncertainty.',

  'accepting-wise':
    'Speak with the wisdom of acceptance. Acknowledge life\'s cycles with equanimity. Be neither resigned nor passive—actively at peace with change.',

  'tender-hopeful':
    'Speak with tender care and gentle hope. Acknowledge fragility while nurturing possibility. Be soft and encouraging, like a hand offered in the dark.',

  'introspective-peaceful':
    'Speak with quiet introspection and inner peace. Come from a place of solitary wisdom, comfortable with silence, at home in the depths.',

  // Journey-derived emotions
  'curious-hopeful':
    'Speak with fresh curiosity and open-hearted hope. Carry the energy of new beginnings—exploratory, encouraging, full of possibility. Be light and inviting.',

  'transformative-deep':
    'Speak with acknowledgment of difficulty and honor for the process. Recognize the weight of transformation while holding space for growth. Be patient, compassionate, and understanding.',

  'profound-transcendent':
    'Speak with deep wisdom and cosmic perspective. Touch the transcendent—be aware of larger patterns, connected to something greater. Be reverent but not distant.',

  // Dyad-derived emotions
  'transformative-profound':
    'Speak with recognition of deep change. Honor the profound nature of transformation. Be serious but not heavy—carry weight with grace.',

  'thoughtful-cautionary':
    'Speak with gentle warning and supportive concern. Be caring but honest about shadows. Not alarming—thoughtfully protective, like a wise friend.',

  'hopeful-inspiring':
    'Speak with hope that inspires action. Lift and motivate. Be encouraging without being saccharine—genuine optimism grounded in possibility.',

  // Suit-derived emotions
  'passionate-inspired':
    'Speak with creative fire and inspired energy. Carry enthusiasm and vision. Be dynamic, alive, and ready to ignite possibility.',

  'determined-fierce':
    'Speak with fierce determination and protective strength. Hold ground with conviction. Be intense but focused—fire that has learned discipline.',

  'accomplished-weary':
    'Speak with the weight of accomplishment. Acknowledge both achievement and exhaustion. Be proud but tired—success that needs rest.',

  'loving-open':
    'Speak with open-hearted love and emotional availability. Flow with connection and warmth. Be tender, receptive, and emotionally generous.',

  'grieving-complex':
    'Speak with acknowledgment of emotional complexity. Hold space for grief, confusion, and mixed feelings. Be compassionate with the messiness of the heart.',

  'fulfilled-wise':
    'Speak with emotional fulfillment and relational wisdom. Carry the satisfaction of authentic connection. Be content, grateful, and emotionally mature.',

  'clear-piercing':
    'Speak with mental clarity and truth-telling directness. Cut through confusion with precision. Be clear, honest, and unafraid of difficult truths.',

  'conflicted-strategic':
    'Speak with acknowledgment of mental conflict and strategic thinking. Navigate complexity without oversimplifying. Be thoughtful, tactical, and aware of tensions.',

  'liberated-dawning':
    'Speak with the freshness of mental liberation. Carry the relief of clarity finally achieved. Be light, free, and awakening from confusion.',

  'grounded-promising':
    'Speak with earthy groundedness and practical promise. Convey solid foundations and real potential. Be steady, reliable, and genuinely encouraging.',

  'resourceful-testing':
    'Speak with practical resourcefulness under pressure. Acknowledge challenges while emphasizing capability. Be steady, problem-solving, and resilient.',

  'abundant-legacy':
    'Speak with the fullness of material and spiritual abundance. Carry generational wisdom and lasting achievement. Be rich, substantial, and enduring.'
};

/**
 * Get emotion instruction text for a given emotion key.
 * Returns null if emotion is not recognized.
 *
 * @param {string} emotion - The emotion key from GraphRAG analysis
 * @returns {string|null} Voice instruction text or null
 */
export function getEmotionInstruction(emotion) {
  if (!emotion || typeof emotion !== 'string') {
    return null;
  }
  return EMOTION_INSTRUCTIONS[emotion] || null;
}
