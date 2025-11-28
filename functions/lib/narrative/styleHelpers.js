const DEFAULT_TONE = 'balanced';
const DEFAULT_FRAME = 'mixed';
const DEFAULT_DEPTH = 'standard';

export const TONE_STYLES = {
  gentle: {
    openingAdjectives: ['nurturing', 'supportive', 'encouraging'],
    challengeFraming: 'growth opportunity',
    closingTone: 'warm reassurance'
  },
  balanced: {
    openingAdjectives: ['thoughtful', 'measured', 'clear'],
    challengeFraming: 'honest acknowledgment',
    closingTone: 'grounded encouragement'
  },
  blunt: {
    openingAdjectives: ['direct', 'straightforward', 'clear-eyed'],
    challengeFraming: 'plain truth',
    closingTone: 'actionable clarity'
  }
};

export const FRAME_VOCABULARY = {
  psychological: ['archetype', 'shadow', 'integration', 'projection', 'individuation'],
  spiritual: ['soul', 'divine', 'sacred', 'cosmic', 'higher self'],
  mixed: ['energy', 'wisdom', 'insight', 'journey', 'growth'],
  playful: ['adventure', 'curious', 'explore', 'discover', 'wonder']
};

const DEPTH_STYLES = {
  short: {
    key: 'short',
    label: 'Quick check-in',
    cardDetail: 'concise',
    cardsHeading: '**Quick Card Highlights**',
    cardsNote: '_Condensed for a fast check-in. Return for a longer dive whenever you want more detail._',
    openingPreface: 'Quick check-in preference noted—here is the distilled throughline.',
    synthesisReminder: 'Because you prefer quick check-ins, focus on the single thread that sparks the most momentum and capture one actionable takeaway before you move on.',
    closingReminder: 'Keep it light; a single intentional step is enough for now.',
    systemGuidance: 'The querent prefers quick check-ins. Keep the reading lean: Opening → Throughline → One actionable Next Step. Limit paragraphs to 2–3 sentences and highlight the clearest immediate leverage point instead of exhaustive card-by-card essays.',
    promptReminder: 'Condensed check-in requested—hit the core tension, the lesson, and one micro action and avoid long digressions.'
  },
  standard: {
    key: 'standard',
    label: 'Balanced depth',
    cardDetail: 'standard',
    cardsHeading: null,
    cardsNote: '',
    openingPreface: '',
    synthesisReminder: '',
    closingReminder: '',
    systemGuidance: '',
    promptReminder: ''
  },
  deep: {
    key: 'deep',
    label: 'Deep dive',
    cardDetail: 'expansive',
    cardsHeading: '**Layered Card Weaving**',
    cardsNote: '_Extra layers included for your deep-dive preference so you can trace every thread._',
    openingPreface: 'Deep-dive preference noted—let’s walk through each layer with care.',
    synthesisReminder: 'Since you prefer deep dives, spend time journaling on the repeating symbols and consider pairing the guidance with ritual or somatic practice.',
    closingReminder: 'Give yourself space to sit with these layers and let them unfold at their own pace.',
    systemGuidance: 'The querent prefers deep dives. Offer a multi-layered narrative that traces positional relationships, elemental dynamics, and symbolism. Include journaling prompts or ritual suggestions when they add clarity.',
    promptReminder: 'Deep dive requested—trace card relationships, elemental/visual textures, and end with reflection or ritual prompts.'
  }
};

export function resolveToneKey(value) {
  return Object.prototype.hasOwnProperty.call(TONE_STYLES, value) ? value : DEFAULT_TONE;
}

export function resolveFrameKey(value) {
  return Object.prototype.hasOwnProperty.call(FRAME_VOCABULARY, value) ? value : DEFAULT_FRAME;
}

function resolveDepthKey(value) {
  return Object.prototype.hasOwnProperty.call(DEPTH_STYLES, value) ? value : DEFAULT_DEPTH;
}

export function getDepthProfile(value) {
  const key = resolveDepthKey(value);
  return DEPTH_STYLES[key] || DEPTH_STYLES[DEFAULT_DEPTH];
}

export function buildNameClause(displayName, position = 'inline') {
  if (typeof displayName !== 'string') return '';
  const trimmed = displayName.trim();
  if (!trimmed) return '';

  switch (position) {
    case 'opening':
      return `${trimmed}, `;
    case 'closing':
      return `, ${trimmed}`;
    case 'inline':
    default:
      return `, ${trimmed},`;
  }
}

export function getToneStyle(toneKey) {
  const key = resolveToneKey(toneKey);
  return TONE_STYLES[key] || TONE_STYLES[DEFAULT_TONE];
}

export function getFrameVocabulary(frameKey) {
  const key = resolveFrameKey(frameKey);
  return FRAME_VOCABULARY[key] || FRAME_VOCABULARY[DEFAULT_FRAME];
}

export function buildPersonalizedClosing(personalization) {
  if (!personalization) return '';
  const vocab = getFrameVocabulary(personalization.spiritualFrame);
  const tone = getToneStyle(personalization.readingTone);
  const closingName = buildNameClause(personalization.displayName, 'closing');
  const anchorWord = vocab[0] || 'wisdom';
  const toneDescriptor = tone.closingTone || 'steady encouragement';
  const depthProfile = getDepthProfile(personalization.preferredSpreadDepth);
  const base = `Remember${closingName || ''} the ${anchorWord} you already carry—let that ${toneDescriptor} shape what unfolds next.`;
  return depthProfile?.closingReminder ? `${base} ${depthProfile.closingReminder}` : base;
}
