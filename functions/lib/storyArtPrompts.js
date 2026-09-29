// functions/lib/storyArtPrompts.js
// Story-art prompts for FLUX.2 [dev] on Workers AI.
// Diffusion models paint whatever a prompt names: card names, quoted questions
// and "no text" rules come out as lettering or as literal cards. So the prompt
// is a short, positive description of the picture, built only from the curated
// card imagery in this file and generativeVisuals.js. The question only picks a
// theme category; no user text reaches the prompt.

import {
  QUESTION_VISUAL_CUES,
  REVERSAL_TREATMENT,
  getCardVisuals,
  detectQuestionCategory
} from './generativeVisuals.js';

/**
 * Style presets for consistent visual language
 * Each style includes visual medium, materials, lighting, and palette
 */
export const STYLE_PROMPTS = {
  watercolor: {
    medium: 'traditional watercolor painting on textured cold-pressed paper',
    materials: 'transparent washes, wet-on-wet bleeding, visible brushstrokes, paper grain showing through',
    lighting: 'soft diffused natural light, ethereal morning glow',
    palette: 'warm sepia, dusty rose, sage green, amber gold, muted indigo',
    constraints: 'textured brushstrokes, organic color bleeding at edges'
  },
  nouveau: {
    medium: 'Art Nouveau poster illustration in the style of Alphonse Mucha',
    materials: 'smooth gradients, ornate decorative borders, flowing organic linework, gilded metallic accents',
    lighting: 'warm theatrical lighting, soft candlelit ambiance',
    palette: 'deep burgundy, emerald green, burnished gold, ivory cream, peacock blue',
    constraints: 'decorative frame border, flowing hair and fabric, floral motifs'
  },
  minimal: {
    medium: 'minimal ink line illustration on cream paper',
    materials: 'single-weight black ink lines, negative space as design element, sparse detail',
    lighting: 'flat even illumination, no shadows',
    palette: 'black ink on warm cream paper, single amber accent color',
    constraints: 'clean continuous lines, zen aesthetic, maximum simplicity'
  },
  'stained-glass': {
    medium: 'stained glass window artwork',
    materials: 'faceted colored glass sections, bold black lead caming lines, jewel-like translucency',
    lighting: 'backlit cathedral light streaming through, luminous glow',
    palette: 'ruby red, sapphire blue, emerald green, amber gold, amethyst purple',
    constraints: 'geometric sacred patterns, thick black outlines between color sections'
  },
  cosmic: {
    medium: 'ethereal digital art with cosmic atmosphere',
    materials: 'soft nebula clouds, scattered stars, iridescent color gradients, particle effects',
    lighting: 'celestial glow from distant stars, aurora-like light ribbons',
    palette: 'deep indigo, violet, teal, rose gold, silver starlight',
    constraints: 'mystical atmosphere, flowing energy, infinite depth'
  }
};

/**
 * Visual descriptions for Major Arcana
 * Used to guide image generation with specific iconography
 */
export const CARD_VISUALS = {
  0: { // The Fool
    symbols: 'cliff edge, white rose, small dog, sunrise, mountain peaks, knapsack',
    figure: 'youthful figure in colorful clothes stepping forward with joy',
    mood: 'innocent optimism, carefree adventure, new dawn',
    colors: 'bright yellow, sky blue, white, touches of red'
  },
  1: { // The Magician
    symbols: 'infinity symbol, wand raised to sky, table with cup/sword/pentacle/wand, roses and lilies',
    figure: 'confident figure channeling energy between heaven and earth',
    mood: 'focused will, creative power, manifestation',
    colors: 'red and white robes, gold accents, green foliage'
  },
  2: { // High Priestess
    symbols: 'moon crown, pomegranates, blue veil, pillars B and J, scroll (TORA)',
    figure: 'serene seated woman between dark and light pillars',
    mood: 'mystery, intuition, hidden knowledge',
    colors: 'deep blue, silver, white, black'
  },
  3: { // The Empress
    symbols: 'wheat field, waterfall, heart-shaped shield with Venus symbol, crown of stars',
    figure: 'abundant feminine figure seated in nature',
    mood: 'fertility, nurturing, sensual abundance',
    colors: 'rich greens, gold wheat, red roses, cream'
  },
  4: { // The Emperor
    symbols: 'stone throne with ram heads, ankh scepter, orb, mountains',
    figure: 'stern authoritative figure in armor on throne',
    mood: 'structure, authority, protective strength',
    colors: 'deep red, orange, grey stone, gold'
  },
  5: { // The Hierophant
    symbols: 'triple crown, keys crossed, raised hand in blessing, two acolytes',
    figure: 'robed religious figure between pillars',
    mood: 'tradition, spiritual wisdom, teaching',
    colors: 'red robes, gold, grey stone, white'
  },
  6: { // The Lovers
    symbols: 'angel above, tree of knowledge with serpent, tree of life with flames, embracing figures',
    figure: 'two figures beneath an angel, sun radiating above',
    mood: 'choice, union, harmony of opposites',
    colors: 'flesh tones, blue sky, green trees, purple angel wings'
  },
  7: { // The Chariot
    symbols: 'sphinxes (black and white), starry canopy, walled city behind, crescent moons',
    figure: 'armored figure standing in chariot with wand',
    mood: 'determined victory, controlled power, forward momentum',
    colors: 'blue and gold armor, black and white sphinxes, starry sky'
  },
  8: { // Strength
    symbols: 'infinity symbol, lion, chain of flowers, gentle mountains',
    figure: 'serene figure gently closing a lion\'s mouth',
    mood: 'quiet courage, compassionate control, inner power',
    colors: 'white dress, golden lion, green landscape, blue sky'
  },
  9: { // The Hermit
    symbols: 'lantern with six-pointed star, grey cloak, staff, mountain peak',
    figure: 'solitary robed figure holding lantern on mountaintop',
    mood: 'solitary wisdom, inner guidance, contemplation',
    colors: 'grey and blue, golden lantern light, snow'
  },
  10: { // Wheel of Fortune
    symbols: 'wheel with Hebrew letters TARO, sphinx atop, Anubis descending, serpent',
    figure: 'great wheel turning with creatures rising and falling',
    mood: 'cycles of fate, turning point, destiny in motion',
    colors: 'orange, gold, blue, creatures in earth tones'
  },
  11: { // Justice
    symbols: 'scales, upright sword, purple veil, throne',
    figure: 'crowned figure holding sword and scales',
    mood: 'truth, fairness, karmic balance, clarity',
    colors: 'red and green robes, grey pillars, gold crown'
  },
  12: { // The Hanged Man
    symbols: 'T-cross/living wood, bound ankle, free leg crossed, halo',
    figure: 'figure suspended upside-down with peaceful expression',
    mood: 'surrender, new perspective, willing sacrifice',
    colors: 'red pants, blue shirt, golden halo, green leaves'
  },
  13: { // Death
    symbols: 'skeleton knight, white horse, fallen king, bishop praying, child with flowers, rising sun',
    figure: 'armored skeleton on white horse with black banner',
    mood: 'transformation, endings leading to beginnings, inevitable change',
    colors: 'black, white, grey, touches of yellow sunrise'
  },
  14: { // Temperance
    symbols: 'angel pouring water between cups, one foot on land one in water, irises, path to mountains, sun crown',
    figure: 'winged angel in flowing robes performing alchemy',
    mood: 'balance, patience, harmonious blending',
    colors: 'blue water, golden cup, green land, white wings, red-orange triangle'
  },
  15: { // The Devil
    symbols: 'inverted pentagram, bat wings, chains (loose), torch pointing down',
    figure: 'horned figure on pedestal with chained figures below',
    mood: 'shadow self, bondage by choice, facing dark desires',
    colors: 'black, dark red, flesh tones, orange flame'
  },
  16: { // The Tower
    symbols: 'lightning bolt, crown falling, flames, two figures falling, dark clouds',
    figure: 'stone tower struck by lightning with people falling',
    mood: 'sudden revelation, necessary destruction, breaking free',
    colors: 'black sky, orange-yellow flames, grey stone, red lightning'
  },
  17: { // The Star
    symbols: 'eight-pointed stars, ethereal figure pouring water on land and into pool, ibis bird, green landscape',
    figure: 'kneeling figure under starlight pouring water',
    mood: 'hope renewed, healing, spiritual peace',
    colors: 'deep blue night, golden stars, silver water, green land'
  },
  18: { // The Moon
    symbols: 'full moon face, wolf and dog howling, crayfish emerging, path between towers',
    figure: 'mysterious moonlit landscape with creatures',
    mood: 'illusion, fear, the unconscious, intuitive depths',
    colors: 'silver-blue moonlight, dark path, yellow drops'
  },
  19: { // The Sun
    symbols: 'bright sun with face, sunflowers, garden wall, white horse, barefoot child',
    figure: 'joyful child on white horse under brilliant sun',
    mood: 'joy, vitality, success, childlike happiness',
    colors: 'brilliant yellow, orange sunflowers, white horse, blue sky'
  },
  20: { // Judgement
    symbols: 'angel Gabriel with trumpet, rising figures from coffins, mountains, red cross banner',
    figure: 'angel in sky, awakening figures rising in response to trumpet',
    mood: 'awakening, rebirth, answering a calling',
    colors: 'blue angel, grey figures, red banner, golden trumpet'
  },
  21: { // The World
    symbols: 'laurel wreath, dancing figure, four creatures (lion, eagle, bull, angel), wands',
    figure: 'androgynous figure dancing in oval wreath',
    mood: 'completion, wholeness, cosmic fulfillment',
    colors: 'blue sky, green wreath, purple sash, four creatures in corners'
  }
};

/**
 * Visual descriptions for Minor Arcana suits
 */
export const SUIT_VISUALS = {
  wands: {
    element: 'fire',
    energy: 'creative passion, action, will',
    palette: 'warm oranges, reds, golden yellows',
    symbols: 'flames, sprouting branches, desert landscape'
  },
  cups: {
    element: 'water',
    energy: 'emotion, intuition, relationships',
    palette: 'cool blues, silvers, sea greens',
    symbols: 'water, reflections, lotus flowers, moonlight'
  },
  swords: {
    element: 'air',
    energy: 'thought, conflict, clarity',
    palette: 'cool greys, steel blue, white clouds',
    symbols: 'wind, clouds, mountains, sharp edges'
  },
  pentacles: {
    element: 'earth',
    energy: 'material world, abundance, craft',
    palette: 'earthy browns, greens, gold coins',
    symbols: 'gardens, coins, fertile earth, crafted objects'
  }
};

const LAYOUTS = {
  triptych: 'A triptych of three tall painted panels side by side, one continuous landscape flowing through all three',
  single: 'Full-bleed artwork filling the whole frame: one unified dreamlike scene in a wide landscape format',
  panoramic: 'Full-bleed artwork filling the whole frame: one sweeping panoramic scene in a wide landscape format',
  vignette: 'Full-bleed artwork filling the whole frame: one intimate scene in a tall portrait format'
};

// More cards than this crowd a single scene.
const MAX_SCENE_CARDS = 5;

// Queen and king imagery names the throne but not who sits on it, and the
// model then paints the suit symbol where the head should be.
const THRONE_FIGURES = { queen: 'A crowned queen', king: 'A crowned king' };

function describeCardImagery(card) {
  const visual = getCardVisuals(card);
  let imagery = (visual.visual || CARD_VISUALS[card.number]?.symbols || visual.symbols || 'an archetypal robed figure')
    .trim()
    .replace(/[.\s]+$/, '');
  const throneFigure = THRONE_FIGURES[String(card.name || '').split(' ')[0].toLowerCase()];
  if (visual.type === 'court' && throneFigure) {
    imagery = imagery.replace(/^Throne\b/, `${throneFigure} on a throne`);
  }
  return card.reversed ? `${imagery}, in ${REVERSAL_TREATMENT.colors}` : imagery;
}

function selectSceneCards(cards, format) {
  if (format === 'vignette') return cards.slice(0, 1);
  if (format === 'triptych') {
    // Beginning, middle and end of longer spreads.
    return cards.length >= 5
      ? [cards[0], cards[Math.floor(cards.length / 2)], cards[cards.length - 1]]
      : cards.slice(0, 3);
  }
  return cards.slice(0, MAX_SCENE_CARDS);
}

/**
 * Build the image prompt for one story illustration.
 * @param {Array<Object>} cards - Sanitized cards ({ name, number, suit, reversed })
 * @param {string} question - Only used to pick a theme category
 * @param {string} style - Key of STYLE_PROMPTS
 * @param {string} format - triptych, single, panoramic or vignette
 * @returns {string}
 */
export function buildStoryArtPrompt(cards, question, style, format) {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.watercolor;
  const questionCues = QUESTION_VISUAL_CUES[detectQuestionCategory(question)] || QUESTION_VISUAL_CUES.general;
  const sceneCards = selectSceneCards(cards, format);

  let subject;
  if (format === 'triptych') {
    const panels = ['Left', 'Center', 'Right'];
    subject = sceneCards.map((card, index) => `${panels[index]} panel: ${describeCardImagery(card)}.`).join(' ')
      + ' A ribbon of light flows through all three panels.';
  } else if (format === 'vignette') {
    const { sensory } = getCardVisuals(sceneCards[0]);
    subject = `${describeCardImagery(sceneCards[0])}.${sensory ? ` ${sensory}.` : ''}`;
  } else {
    subject = `Within it: ${sceneCards.map(describeCardImagery).join('; ')}.`;
  }

  return [
    `${styleConfig.medium}, ${styleConfig.materials}.`,
    `${LAYOUTS[format] || LAYOUTS.single}.`,
    subject,
    `The scene suggests ${questionCues.environment}, lit by ${styleConfig.lighting}, with ${questionCues.cues}.`,
    `Colors of ${styleConfig.palette}; ${styleConfig.constraints}. The figures are archetypal, with natural human faces, fully clothed in timeless robes.`
  ].join('\n');
}

/**
 * Build prompt for ambient background generation
 */
export function buildAmbientBackgroundPrompt(cards, style) {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.cosmic;
  
  // Analyze dominant elements
  const elements = cards.map(c => {
    if (c.suit) return SUIT_VISUALS[c.suit.toLowerCase()]?.element;
    // Major arcana element associations
    const majorElements = {
      0: 'air', 1: 'air', 2: 'water', 3: 'earth', 4: 'fire',
      5: 'earth', 6: 'air', 7: 'water', 8: 'fire', 9: 'earth',
      10: 'fire', 11: 'air', 12: 'water', 13: 'water', 14: 'fire',
      15: 'earth', 16: 'fire', 17: 'air', 18: 'water', 19: 'fire',
      20: 'fire', 21: 'earth'
    };
    return majorElements[c.number] || 'ether';
  }).filter(Boolean);

  const dominantElement = elements.length 
    ? elements.sort((a, b) => 
        elements.filter(v => v === b).length - elements.filter(v => v === a).length
      )[0]
    : 'ether';

  const elementalAtmosphere = {
    fire: 'warm glowing embers, dancing flames, sunset colors, volcanic energy',
    water: 'flowing currents, moonlit reflections, deep ocean depths, rain',
    air: 'swirling clouds, wind patterns, mountain peaks, dawn mist',
    earth: 'ancient stones, forest floor, rich soil, crystal formations',
    ether: 'cosmic void, starfield, ethereal mist, aurora borealis'
  };

  return `
Create an abstract atmospheric background for a tarot reading.

DOMINANT ELEMENT: ${dominantElement}
ELEMENTAL MOOD: ${elementalAtmosphere[dominantElement]}

STYLE: ${styleConfig.medium}
MATERIALS: ${styleConfig.materials}
LIGHTING: ${styleConfig.lighting}
COLOR PALETTE: ${styleConfig.palette}

ARTISTIC DIRECTION:
- Create an ABSTRACT ambient background, not figurative
- Soft gradients, particle effects, atmospheric textures
- Should work as a backdrop (important elements at edges, center relatively empty)
- Subtle mystical energy without specific symbols
- Enable TRANSPARENT background where possible

FORMAT: Square (1:1), designed to work behind reading UI
`.trim();
}

/**
 * Extract card number from card data
 */
export function getCardNumber(card) {
  if (typeof card.number === 'number') return card.number;
  // Handle minor arcana
  const rankMap = { ace: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, page: 11, knight: 12, queen: 13, king: 14 };
  const name = card.name.toLowerCase();
  for (const [rank, num] of Object.entries(rankMap)) {
    if (name.includes(rank)) return num;
  }
  return null;
}

export default {
  STYLE_PROMPTS,
  CARD_VISUALS,
  SUIT_VISUALS,
  buildStoryArtPrompt,
  buildAmbientBackgroundPrompt
};
