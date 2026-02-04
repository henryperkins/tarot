// functions/lib/videoPrompts.js
// Prompt engineering for Sora-2 animated card reveals
// Based on OpenAI's Sora 2 Prompting Guide best practices:
// - Keep actions simple with clear beats
// - One camera move + one subject action per shot
// - 4-second clips work best for reliability
// - Use image input for visual consistency

import { CARD_VISUALS, SUIT_VISUALS } from './storyArtPrompts.js';
import { VIDEO_STYLE_IDS } from '../../shared/vision/videoStyles.js';
import {
  QUESTION_VISUAL_CUES,
  REVERSAL_TREATMENT,
  getCardVisuals,
  getCardAnimation,
  detectQuestionCategory
} from './generativeVisuals.js';

/**
 * Cinematic style presets for card reveal animations
 */
const VIDEO_STYLE_CONFIG = {
  mystical: {
    style: 'Ethereal fantasy film, shot on digital with soft diffusion filter',
    lighting: 'volumetric light rays through mist, warm golden key with cool rim',
    palette: 'deep indigo, amber gold, soft cream',
    mood: 'mysterious and reverent'
  },
  classic: {
    style: 'Classic Hollywood drama, 35mm film with subtle grain',
    lighting: 'chiaroscuro lighting, single strong source with soft fill',
    palette: 'warm sepia, rich shadows, highlights with slight halation',
    mood: 'timeless and dramatic'
  },
  modern: {
    style: 'Contemporary cinematic, clean digital with shallow depth of field',
    lighting: 'soft natural light with subtle practicals',
    palette: 'muted earth tones with selective color pops',
    mood: 'intimate and contemplative'
  },
  cosmic: {
    style: 'Sci-fi ethereal, digital with lens flares and particle effects',
    lighting: 'bioluminescent glow, aurora-like color shifts',
    palette: 'deep space indigo, violet, teal, rose gold',
    mood: 'transcendent and expansive'
  }
};

const VIDEO_STYLE_KEYS = new Set(VIDEO_STYLE_IDS);

export const VIDEO_STYLES = VIDEO_STYLE_IDS.reduce((acc, id) => {
  if (VIDEO_STYLE_CONFIG[id]) {
    acc[id] = VIDEO_STYLE_CONFIG[id];
  }
  return acc;
}, {});

const missingStyleIds = VIDEO_STYLE_IDS.filter((id) => !VIDEO_STYLE_CONFIG[id]);
const extraStyleIds = Object.keys(VIDEO_STYLE_CONFIG).filter((id) => !VIDEO_STYLE_KEYS.has(id));

if (missingStyleIds.length) {
  console.warn('[videoPrompts] Missing style configs for:', missingStyleIds);
}

if (extraStyleIds.length) {
  console.warn('[videoPrompts] Unlisted style configs:', extraStyleIds);
}

/**
 * Animation actions for Major Arcana reveals
 * Each describes a simple, evocative motion that captures the card's essence
 */
export const CARD_ANIMATIONS = {
  0: { // The Fool
    action: 'Figure steps forward to cliff edge, arms spreading wide, wind catches their cloak',
    camera: 'slow dolly in from medium-wide to medium shot',
    beat: 'confidence building to joyful leap'
  },
  1: { // The Magician
    action: 'Figure raises wand toward sky, energy streams between heaven and earth, objects on table begin to glow',
    camera: 'slow push-in with slight upward tilt',
    beat: 'power gathering and channeling'
  },
  2: { // High Priestess
    action: 'Veiled figure slowly lifts gaze, moonlight intensifies behind her, scroll partially unfurls',
    camera: 'gentle dolly in, eye level',
    beat: 'mystery deepening, secrets hinted'
  },
  3: { // The Empress
    action: 'Figure turns toward camera, flowers bloom around her, golden light warms the scene',
    camera: 'slow arc around subject from profile to three-quarter',
    beat: 'abundance unfolding'
  },
  4: { // The Emperor
    action: 'Armored figure shifts on throne, grips scepter firmly, mountain winds still',
    camera: 'slow push-in from wide to medium, low angle',
    beat: 'authority settling into stillness'
  },
  5: { // The Hierophant
    action: 'Robed figure raises hand in blessing, light streams through stained glass, acolytes bow',
    camera: 'slow dolly in, slightly low angle',
    beat: 'sacred wisdom bestowed'
  },
  6: { // The Lovers
    action: 'Two figures turn toward each other, angel above spreads wings, light intensifies between them',
    camera: 'slow crane up as figures connect',
    beat: 'choice crystallizing into union'
  },
  7: { // The Chariot
    action: 'Armored figure grips reins, sphinxes begin to move forward, starry canopy billows',
    camera: 'tracking shot alongside chariot, low angle',
    beat: 'momentum building to victory'
  },
  8: { // Strength
    action: 'Figure gently closes lion\'s mouth, beast relaxes, flowers bloom along infinity symbol',
    camera: 'slow push-in to hands and lion',
    beat: 'tension releasing into trust'
  },
  9: { // The Hermit
    action: 'Cloaked figure lifts lantern higher, star within brightens, mountain mist parts slightly',
    camera: 'slow push-in, lantern light grows',
    beat: 'illumination piercing darkness'
  },
  10: { // Wheel of Fortune
    action: 'Great wheel begins to turn, creatures rise and fall, clouds swirl around axis',
    camera: 'slow spiral around wheel, settling on sphinx',
    beat: 'fate in motion'
  },
  11: { // Justice
    action: 'Crowned figure adjusts scales to perfect balance, sword glints, veil parts',
    camera: 'slow dolly in, eye level',
    beat: 'truth settling into clarity'
  },
  12: { // The Hanged Man
    action: 'Suspended figure opens eyes, halo brightens, perspective shifts subtly',
    camera: 'slow rotation suggesting perspective change',
    beat: 'surrender becoming insight'
  },
  13: { // Death
    action: 'Skeleton knight on white horse pauses, sun rises behind, flowers bloom in hoofprints',
    camera: 'slow push-in past fallen crown toward sunrise',
    beat: 'ending transforming into dawn'
  },
  14: { // Temperance
    action: 'Angel pours water between cups, liquid glows as it flows, wings spread slightly',
    camera: 'slow arc around angel, focus on flowing water',
    beat: 'elements blending into harmony'
  },
  15: { // The Devil
    action: 'Horned figure\'s torch flickers, chained figures stir, chains revealed as loose',
    camera: 'slow push-in, torch light dancing',
    beat: 'bondage recognized, freedom glimpsed'
  },
  16: { // The Tower
    action: 'Lightning strikes tower crown, stone cracks, figures fall but light breaks through',
    camera: 'dramatic upward tilt as lightning hits',
    beat: 'destruction revealing foundation'
  },
  17: { // The Star
    action: 'Kneeling figure pours water, stars brighten overhead, landscape begins to heal',
    camera: 'slow crane up from water to starfield',
    beat: 'hope restored, healing flows'
  },
  18: { // The Moon
    action: 'Moon\'s face shifts expression, wolves howl, crayfish emerges from pool',
    camera: 'slow dolly through moonlit path',
    beat: 'unconscious stirring to surface'
  },
  19: { // The Sun
    action: 'Child raises arms joyfully, sunflowers turn toward light, white horse prances',
    camera: 'slow push-in with warm light blooming',
    beat: 'pure joy radiating'
  },
  20: { // Judgement
    action: 'Angel\'s trumpet sounds, figures rise from coffins, arms reaching upward',
    camera: 'slow crane up from graves to angel',
    beat: 'awakening to calling'
  },
  21: { // The World
    action: 'Dancing figure completes turn within wreath, four creatures animate in corners',
    camera: 'slow spiral inward to dancing figure',
    beat: 'completion, cosmic dance'
  }
};

/**
 * Build a prompt for animated card reveal video
 * Designed for 4-second Sora-2 clips
 * Supports both Major and Minor Arcana with question context integration
 */
export function buildCardRevealPrompt(card, question, position, style = 'mystical', keyframeDescription = null) {
  const styleConfig = VIDEO_STYLES[style] || VIDEO_STYLES.mystical;
  const visual = getCardVisuals(card);
  const legacyVisual = CARD_VISUALS[card.number] || {};
  const minorAnimation = getCardAnimation(card);
  const animation = CARD_ANIMATIONS[card.number] || minorAnimation || {
    action: 'Figure emerges from shadow into light, energy gathering around them',
    camera: 'slow push-in with soft focus transition',
    beat: 'revelation unfolding'
  };
  
  const suitVisual = card.suit ? SUIT_VISUALS[card.suit.toLowerCase()] : null;
  
  // Detect question category for contextual cues
  const questionCategory = detectQuestionCategory(question);
  const questionCues = QUESTION_VISUAL_CUES[questionCategory] || QUESTION_VISUAL_CUES.general;
  
  // Unified reversal treatment
  const reversedNote = card.reversed 
    ? `REVERSED ENERGY: ${REVERSAL_TREATMENT.forVideo}`
    : '';

  // Build element and suit notes from combined visuals
  const element = visual.element || (suitVisual ? suitVisual.element : null);
  const elementNote = element
    ? `Elemental atmosphere: ${element} energy (${suitVisual?.palette || minorAnimation?.atmosphere || styleConfig.palette})`
    : '';
  
  // Minor arcana specific atmosphere
  const minorAtmosphere = minorAnimation 
    ? `\nSuit atmosphere: ${minorAnimation.atmosphere}\nAmbient soundscape: ${minorAnimation.soundscape}`
    : '';
    
  // Starting state alignment with keyframe
  const startingState = keyframeDescription
    ? `STARTING STATE: ${keyframeDescription}`
    : animation.startingPose
      ? `STARTING STATE: ${animation.startingPose}`
      : 'STARTING STATE: Figure poised at moment of potential, energy gathering';

  // Use combined visual data
  const symbols = visual.symbols || legacyVisual.symbols || 'archetypal mystical imagery';
  const figure = visual.figure || legacyVisual.figure || 'symbolic archetypal figure';
  const mood = visual.mood || legacyVisual.mood || card.meaning;

  return `
Style: ${styleConfig.style}
Lighting: ${styleConfig.lighting}
Palette: ${styleConfig.palette}
Mood: ${styleConfig.mood}
${reversedNote}
${elementNote}
${minorAtmosphere}

A mystical scene capturing the essence of ${card.name} in the context of "${question}".
This card appears in the ${position} position, suggesting ${mood}.

Question theme cues: ${questionCues.cues}
Visual metaphor: ${questionCues.metaphors}

Scene elements: ${symbols}
Central figure: ${figure}
Environment: ${questionCues.environment}

${startingState}

Cinematography:
Camera: ${animation.camera}
Depth of field: shallow, focus on central figure/action
Lighting: ${styleConfig.lighting}

Actions:
- ${animation.action}
- ${animation.beat}

Background Sound:
Soft wind through fabric, faint chime, distant low drone. No dialogue or score.

Constraints:
- No text, words, or labels visible
- No modern objects
- Figures archetypal, not specific individuals
- Single continuous shot, no cuts
`.trim();
}

/**
 * Build prompt for GPT-Image-1.5 keyframe (used as Sora input_reference)
 * Creates the opening frame that Sora will animate from
 * Returns both the prompt and a description for video prompt alignment
 */
export function buildKeyframePrompt(card, question, position, style = 'mystical') {
  const styleConfig = VIDEO_STYLES[style] || VIDEO_STYLES.mystical;
  const visual = getCardVisuals(card);
  const legacyVisual = CARD_VISUALS[card.number] || {};
  const minorAnimation = getCardAnimation(card);
  const animation = CARD_ANIMATIONS[card.number] || minorAnimation || {};
  
  // Detect question category for contextual cues
  const questionCategory = detectQuestionCategory(question);
  const questionCues = QUESTION_VISUAL_CUES[questionCategory] || QUESTION_VISUAL_CUES.general;
  
  // Unified reversal treatment
  const reversedNote = card.reversed 
    ? REVERSAL_TREATMENT.forKeyframe
    : 'Energy flowing openly, vibrant presence.';
  
  // Build starting pose description for video prompt alignment
  const startingPose = animation.startingPose 
    || `${visual.figure || legacyVisual.figure || 'Archetypal figure'} poised at the moment before action`;
  
  // Use combined visual data
  const figure = visual.figure || legacyVisual.figure || 'Archetypal figure';
  const symbols = visual.symbols || legacyVisual.symbols || 'symbolic imagery';
  const mood = visual.mood || legacyVisual.mood || card.meaning;
  const colors = legacyVisual.colors || '';
  
  // Minor arcana atmosphere
  const atmosphereNote = minorAnimation
    ? `\nElemental setting: ${minorAnimation.atmosphere}`
    : '';

  const prompt = `
VISUAL MEDIUM:
Cinematic film still, ${styleConfig.style}

COMPOSITION:
${animation.camera?.includes('wide') ? 'Wide shot' : 'Medium shot'} framing with room for lateral movement.
Central figure positioned for action, space for movement.
Environment cues: ${questionCues.environment}

SCENE:
${figure} in a mystical setting.
Key symbols present: ${symbols}${atmosphereNote}

STARTING POSE:
${startingPose}
The figure should feel frozen at a pivotal moment, ready to move.

LIGHTING:
${styleConfig.lighting}

COLOR PALETTE:
${styleConfig.palette}
${colors ? `Card-specific colors: ${colors}` : ''}

MOOD:
${styleConfig.mood}
${reversedNote}
Thematic context: ${questionCues.cues} (${position} position, ${mood})

CONSTRAINTS:
- No text, words, or labels
- No modern objects
- Poised for movement (not static)
- Cinematic depth and atmosphere
- Figure archetypal, not specific individual
`.trim();

  // Return both prompt and description for video alignment
  return {
    prompt,
    startingPoseDescription: startingPose,
    toString() { return prompt; } // Backwards compatibility
  };
}

/**
 * Build storyboard for multi-card reveal sequence
 * Returns array of prompts for each card in order
 * Links keyframe starting pose to video prompt for consistency
 */
export function buildRevealSequence(cards, question, style = 'mystical') {
  return cards.map((card, index) => {
    const keyframe = buildKeyframePrompt(card, question, card.position, style);
    return {
      index,
      card: card.name,
      position: card.position,
      keyframePrompt: keyframe.prompt || keyframe.toString(),
      videoPrompt: buildCardRevealPrompt(card, question, card.position, style, keyframe.startingPoseDescription),
      duration: 4, // seconds
      size: '1280x720' // landscape for cinematic feel
    };
  });
}

/**
 * Sora API configuration defaults
 */
export const SORA_DEFAULTS = {
  model: 'sora-2',
  size: '1280x720',
  seconds: '4'
};

export default {
  VIDEO_STYLES,
  CARD_ANIMATIONS,
  SORA_DEFAULTS,
  buildCardRevealPrompt,
  buildKeyframePrompt,
  buildRevealSequence
};
