// functions/lib/generativeVisuals.js
// Shared visual definitions for generative media (image + video)
// Consolidates Minor Arcana visuals, question metaphors, and reversal treatment

import {
  MINOR_ARCANA_IMAGERY,
  MINOR_PIP_IMAGERY,
  MINOR_SUIT_IMAGERY,
  MAJOR_ARCANA_IMAGERY
} from './imageryHooks.js';

/**
 * Question category to visual metaphor mapping
 * Adds contextual imagery based on question domain
 */
export const QUESTION_VISUAL_CUES = {
  career: {
    cues: 'paths diverging in a professional landscape, tools of craft, doorways to new opportunities, climbing stairs',
    environment: 'workspace with symbolic objects, crossroads, ascending mountain path',
    metaphors: 'seeds becoming harvest, apprentice to master journey, bridge between current and future'
  },
  relationship: {
    cues: 'bridges connecting, hands reaching toward each other, shared vessels, intertwined paths',
    environment: 'garden with two trees, river meeting, shared hearth',
    metaphors: 'two flames becoming one, dance partners, vessels pouring into each other'
  },
  finance: {
    cues: 'scales balancing, treasure revealing itself, seeds growing into abundance, flowing coins',
    environment: 'marketplace, fertile field, treasury with light streaming in',
    metaphors: 'tide rising, tree bearing fruit, mountain of resources'
  },
  spiritual: {
    cues: 'temples and sacred spaces, light rays piercing darkness, sacred geometry unfolding',
    environment: 'mountaintop sanctuary, forest grove with filtered light, starlit void',
    metaphors: 'caterpillar to butterfly, darkness to dawn, seed to flower to seed'
  },
  health: {
    cues: 'healing waters, mending threads, growing plants, clearing storm clouds',
    environment: 'healing spring, garden recovering from winter, body as landscape',
    metaphors: 'wound becoming scar becoming strength, phoenix rising, river clearing'
  },
  decision: {
    cues: 'crossroads lit by different lights, doors with varied symbols, weighing scales',
    environment: 'fork in path with distinct atmospheres, threshold between rooms',
    metaphors: 'coin spinning in air, compass needle settling, key finding lock'
  },
  general: {
    cues: 'universal journey symbols, winding path, horizon with promise',
    environment: 'liminal space between known and unknown, threshold moment',
    metaphors: 'story unfolding page by page, seasons turning, stars aligning'
  }
};

/**
 * Detect question category from question text
 */
export function detectQuestionCategory(question) {
  const q = question.toLowerCase();
  
  // Career/work indicators
  if (/\b(job|career|work|promotion|boss|colleague|business|profession|interview|hired?|fired?|resign|quit|salary|raise)\b/.test(q)) {
    return 'career';
  }
  
  // Relationship indicators
  if (/\b(relationship|partner|boyfriend|girlfriend|spouse|husband|wife|dating|love|marry|marriage|divorce|ex|romantic|friend|family)\b/.test(q)) {
    return 'relationship';
  }
  
  // Finance indicators
  if (/\b(money|finance|invest|debt|loan|mortgage|savings?|wealth|income|expense|afford|budget|profit|loss)\b/.test(q)) {
    return 'finance';
  }
  
  // Spiritual indicators
  if (/\b(spirit|soul|purpose|meaning|path|destiny|karma|meditation|prayer|divine|god|universe|enlighten(?:ment)?|awaken)\b/.test(q)) {
    return 'spiritual';
  }
  
  // Health indicators
  if (/\b(health|heal|sick|illness|disease|doctor|hospital|mental|anxiety|depression|energy|tired|recovery|wellness)\b/.test(q)) {
    return 'health';
  }
  
  // Decision indicators
  if (/\b(should i|decide|choice|option|whether|or not|choose|decision|dilemma)\b/.test(q)) {
    return 'decision';
  }
  
  return 'general';
}

/**
 * Unified reversal treatment specifications
 * Provides consistent visual transformations for reversed cards
 */
export const REVERSAL_TREATMENT = {
  // Visual modifications
  colors: 'slightly desaturated, cooler tones, deeper shadows',
  lighting: 'diffused, filtered, coming from below or behind instead of above',
  motion: 'hesitant, slower, pausing mid-action, looking back',
  symbols: 'partially obscured, inverted, reflected in water, seen through veil',
  mood: 'contemplative, internalized, working in shadow, potential not yet manifested',
  
  // Prompt fragments for different contexts
  forImage: 'Energy internalized and working in shadow. Colors muted with deeper shadows, symbols partially veiled or reflected, mood contemplative rather than expressed.',
  forKeyframe: 'Energy contained, not yet released. Figure in moment of pause or reflection, colors cooler and desaturated, light diffused through atmosphere.',
  forVideo: 'Movement hesitant, as if underwater. Energy gathering inward rather than projecting outward. Colors slightly desaturated, shadows deeper, the action feels like a breath held before release.'
};

/**
 * Get visual data for any card (Major or Minor Arcana)
 * Returns unified structure regardless of card type
 */
export function getCardVisuals(card) {
  // Major Arcana: use number directly
  if (typeof card.number === 'number' && card.number >= 0 && card.number <= 21) {
    const major = MAJOR_ARCANA_IMAGERY[card.number] || {};
    return {
      type: 'major',
      visual: major.visual || '',
      sensory: major.sensory || '',
      figure: extractFigure(major.visual),
      symbols: extractSymbols(major.visual),
      mood: card.reversed ? (major.reversed || REVERSAL_TREATMENT.mood) : (major.upright || ''),
      colors: '', // Major arcana imagery doesn't specify colors, use style palette
      element: getMajorElement(card.number)
    };
  }
  
  // Minor Arcana: lookup by full name
  const cardName = card.name;
  
  // Check court cards first
  if (MINOR_ARCANA_IMAGERY[cardName]) {
    const court = MINOR_ARCANA_IMAGERY[cardName];
    const suit = card.suit?.toLowerCase() || extractSuit(cardName);
    const suitInfo = MINOR_SUIT_IMAGERY[capitalize(suit)] || {};
    
    return {
      type: 'court',
      visual: court.visual || '',
      sensory: court.sensory || '',
      figure: extractFigure(court.visual),
      symbols: `${court.visual}, ${suitInfo.visual || ''}`,
      mood: court.interpretation || '',
      colors: '', // Use suit palette
      element: suitToElement(suit),
      suit: suit,
      suitEnergy: suitInfo.interpretation || ''
    };
  }
  
  // Check pip cards
  if (MINOR_PIP_IMAGERY[cardName]) {
    const pip = MINOR_PIP_IMAGERY[cardName];
    const suit = card.suit?.toLowerCase() || extractSuit(cardName);
    const suitInfo = MINOR_SUIT_IMAGERY[capitalize(suit)] || {};
    
    return {
      type: 'pip',
      visual: pip.visual || '',
      sensory: pip.sensory || '',
      figure: extractFigure(pip.visual),
      symbols: pip.visual || '',
      mood: pip.interpretation || '',
      colors: '', // Use suit palette
      element: suitToElement(suit),
      suit: suit,
      suitEnergy: suitInfo.interpretation || '',
      rankValue: card.rankValue || extractRankValue(cardName)
    };
  }
  
  // Fallback for unknown cards
  const suit = card.suit?.toLowerCase() || 'wands';
  const suitInfo = MINOR_SUIT_IMAGERY[capitalize(suit)] || {};
  
  return {
    type: 'unknown',
    visual: suitInfo.visual || 'archetypal symbolic imagery',
    sensory: suitInfo.sensory || '',
    figure: 'symbolic figure embodying this energy',
    symbols: suitInfo.visual || 'archetypal symbols',
    mood: card.meaning || '',
    colors: '',
    element: suitToElement(suit),
    suit: suit,
    suitEnergy: suitInfo.interpretation || ''
  };
}

/**
 * Minor Arcana animation templates by rank type
 * Combined with suit for specific animations
 */
export const MINOR_ANIMATIONS = {
  // Aces: New beginnings, gifts from spirit
  ace: {
    action: 'Hand emerges from cloud, offering the suit symbol, energy radiates outward',
    camera: 'slow push-in from medium to close-up on offering hand',
    beat: 'gift being received, potential awakening',
    startingPose: 'Cloud parting, hand beginning to emerge with suit symbol'
  },
  
  // Twos: Balance, partnership, choice
  two: {
    action: 'Two elements come into balance or dialogue, energy flowing between them',
    camera: 'slow lateral movement showing both elements',
    beat: 'equilibrium finding itself'
  },
  
  // Threes: Growth, collaboration, first fruits
  three: {
    action: 'Third element joins, completing a triangle, celebration or creation begins',
    camera: 'slight crane up as elements unite',
    beat: 'creation manifesting'
  },
  
  // Fours: Stability, foundation, rest
  four: {
    action: 'Structure solidifies, figure settles into stillness, corners anchor',
    camera: 'slow dolly in to stable composition',
    beat: 'foundation setting'
  },
  
  // Fives: Conflict, loss, struggle
  five: {
    action: 'Disruption occurs, elements scatter or clash, tension rises',
    camera: 'handheld slight movement suggesting instability',
    beat: 'challenge arising'
  },
  
  // Sixes: Harmony, generosity, memory
  six: {
    action: 'Exchange occurs, harmony restored, nostalgia or generosity flows',
    camera: 'gentle arc around giving/receiving moment',
    beat: 'balance restored through giving'
  },
  
  // Sevens: Assessment, challenge, inner work
  seven: {
    action: 'Figure pauses to assess, inner contemplation visible, choice looms',
    camera: 'slow push-in to contemplative figure',
    beat: 'evaluation before action'
  },
  
  // Eights: Movement, mastery, speed
  eight: {
    action: 'Rapid motion or transformation, energy accelerating, mastery in action',
    camera: 'tracking movement, sense of speed',
    beat: 'momentum building'
  },
  
  // Nines: Near completion, wisdom, culmination
  nine: {
    action: 'Abundance surrounds, one element missing, wisdom hard-won',
    camera: 'slow pan across accumulated elements',
    beat: 'almost there, final lessons'
  },
  
  // Tens: Completion, excess, cycles ending
  ten: {
    action: 'Cycle completes, fullness achieved or burden carried, transition imminent',
    camera: 'slow dolly out revealing full scope',
    beat: 'ending preparing for new beginning'
  },
  
  // Pages: Messages, youth, potential
  page: {
    action: 'Young figure receives or studies suit symbol, curiosity awakens',
    camera: 'slow push-in to eager face',
    beat: 'discovery, message arriving'
  },
  
  // Knights: Action, quest, movement
  knight: {
    action: 'Mounted figure charges forward, suit energy propelling motion',
    camera: 'tracking alongside rapid movement',
    beat: 'quest in motion'
  },
  
  // Queens: Mastery, nurturing, inward power
  queen: {
    action: 'Seated figure embodies suit element, ruling through understanding',
    camera: 'slow arc around throne, reverent',
    beat: 'mastery through receptivity'
  },
  
  // Kings: Authority, outward power, command
  king: {
    action: 'Enthroned figure commands suit element, directing outward',
    camera: 'low angle slow push-in',
    beat: 'mastery through direction'
  }
};

/**
 * Suit-specific animation modifiers
 */
export const SUIT_ANIMATION_MODIFIERS = {
  wands: {
    motion: 'flames flicker and dance, sparks trail movement, heat shimmer visible',
    atmosphere: 'warm glow, desert or volcanic backdrop, passionate energy',
    soundscape: 'crackling fire, wind carrying embers'
  },
  cups: {
    motion: 'water flows and reflects, emotions ripple outward, tears or joy visible',
    atmosphere: 'moonlit, misty, emotional depth, reflections everywhere',
    soundscape: 'gentle waves, rain, heartbeat rhythm'
  },
  swords: {
    motion: 'wind cuts through scene, thoughts manifest as blades, clarity pierces',
    atmosphere: 'stormy or clear sharp sky, mountain peaks, cold precision',
    soundscape: 'wind howling, blade singing, thunder distant'
  },
  pentacles: {
    motion: 'earth shifts and grows, coins spin slowly, roots spread',
    atmosphere: 'garden, workshop, solid ground, golden afternoon light',
    soundscape: 'birdsong, tools working, earth settling'
  }
};

/**
 * Get animation data for any card
 */
export function getCardAnimation(card) {
  // Major Arcana: return null, let caller use CARD_ANIMATIONS
  if (typeof card.number === 'number' && card.number >= 0 && card.number <= 21) {
    return null; // Use existing CARD_ANIMATIONS from videoPrompts.js
  }
  
  // Minor Arcana: build from rank and suit
  const rank = card.rank?.toLowerCase() || extractRank(card.name);
  const suit = card.suit?.toLowerCase() || extractSuit(card.name);
  
  const baseAnimation = MINOR_ANIMATIONS[rank] || MINOR_ANIMATIONS.ace;
  const suitMod = SUIT_ANIMATION_MODIFIERS[suit] || SUIT_ANIMATION_MODIFIERS.wands;
  
  // Get card-specific visual from imagery
  const visuals = getCardVisuals(card);
  
  return {
    action: `${baseAnimation.action}. ${suitMod.motion}`,
    camera: baseAnimation.camera,
    beat: baseAnimation.beat,
    startingPose: baseAnimation.startingPose || `Figure positioned for ${baseAnimation.beat}`,
    atmosphere: suitMod.atmosphere,
    soundscape: suitMod.soundscape,
    sceneDescription: visuals.visual
  };
}

// Helper functions

function extractFigure(visualDesc) {
  if (!visualDesc) return 'archetypal figure';
  // Extract figure description from visual
  const figureMatch = visualDesc.match(/(?:figure|person|man|woman|child|knight|queen|king|page|angel|skeleton|traveler|guardian|craftsman|rider)[^,]*/i);
  return figureMatch ? figureMatch[0].trim() : 'archetypal figure';
}

function extractSymbols(visualDesc) {
  if (!visualDesc) return 'archetypal symbols';
  // Visual descriptions are already symbol-rich, return as-is trimmed
  return visualDesc.slice(0, 200);
}

function extractSuit(cardName) {
  const name = cardName.toLowerCase();
  if (name.includes('wand')) return 'wands';
  if (name.includes('cup')) return 'cups';
  if (name.includes('sword')) return 'swords';
  if (name.includes('pentacle') || name.includes('coin')) return 'pentacles';
  return 'wands'; // default
}

function extractRank(cardName) {
  const name = cardName.toLowerCase();
  const ranks = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king'];
  for (const rank of ranks) {
    if (name.includes(rank)) return rank;
  }
  return 'ace';
}

function extractRankValue(cardName) {
  const rank = extractRank(cardName);
  const values = { ace: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, page: 11, knight: 12, queen: 13, king: 14 };
  return values[rank] || 1;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function suitToElement(suit) {
  const map = { wands: 'fire', cups: 'water', swords: 'air', pentacles: 'earth' };
  return map[suit?.toLowerCase()] || 'ether';
}

function getMajorElement(number) {
  const majorElements = {
    0: 'air', 1: 'air', 2: 'water', 3: 'earth', 4: 'fire',
    5: 'earth', 6: 'air', 7: 'water', 8: 'fire', 9: 'earth',
    10: 'fire', 11: 'air', 12: 'water', 13: 'water', 14: 'fire',
    15: 'earth', 16: 'fire', 17: 'air', 18: 'water', 19: 'fire',
    20: 'fire', 21: 'earth'
  };
  return majorElements[number] || 'ether';
}

export default {
  QUESTION_VISUAL_CUES,
  REVERSAL_TREATMENT,
  MINOR_ANIMATIONS,
  SUIT_ANIMATION_MODIFIERS,
  detectQuestionCategory,
  getCardVisuals,
  getCardAnimation
};
