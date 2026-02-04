// functions/lib/storyArtPrompts.js
// Prompt engineering for GPT-Image-1.5 story illustrations
// Based on OpenAI's gpt-image-1.5 Prompting Guide best practices:
// - Structure: background/scene → subject → key details → constraints
// - Specificity: concrete materials, shapes, textures, visual medium
// - Composition: framing, viewpoint, lighting/mood
// - Constraints: explicit exclusions and invariants
// - No text: avoid text rendering issues by excluding it entirely

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

/**
 * Build a prompt for a single scene illustration
 * Follows GPT-Image-1.5 best practices: scene → subject → details → constraints
 */
export function buildSingleScenePrompt(cards, question, style, narrative) {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.watercolor;
  
  // Detect question category for visual metaphors
  const questionCategory = detectQuestionCategory(question);
  const questionCues = QUESTION_VISUAL_CUES[questionCategory] || QUESTION_VISUAL_CUES.general;
  
  // Build subject descriptions from cards (supports Major and Minor Arcana)
  const subjects = cards.map((card, _i) => {
    const visual = getCardVisuals(card);
    const legacyVisual = CARD_VISUALS[card.number] || {};
    const reversalNote = card.reversed ? REVERSAL_TREATMENT.forImage : 'energy flowing openly';
    const figure = visual.figure || legacyVisual.figure || 'archetypal figure';
    const mood = visual.mood || legacyVisual.mood || card.meaning;
    const suitNote = visual.suit ? ` (${visual.element} energy)` : '';
    return `- ${card.name} in ${card.position} position: ${figure}${suitNote}, mood of ${mood} (${reversalNote})`;
  }).join('\n');

  // Extract key symbols from all cards
  const allSymbols = cards.map(card => {
    const visual = getCardVisuals(card);
    const legacyVisual = CARD_VISUALS[card.number] || {};
    return visual.symbols || legacyVisual.symbols || '';
  }).filter(Boolean).join(', ');
  
  // Optional narrative context integration
  const narrativeNote = narrative 
    ? `\nNARRATIVE CONTEXT: ${narrative.slice(0, 200)}...` 
    : '';

  return `
SCENE/BACKGROUND:
Mystical dreamscape setting that evokes the emotional weight of: "${question}"
${styleConfig.lighting}
Environment cues: ${questionCues.environment}

VISUAL MEDIUM:
${styleConfig.medium}
${styleConfig.materials}

SUBJECTS:
${subjects}

KEY VISUAL ELEMENTS:
Symbolic imagery drawn from: ${allSymbols}
Question-related metaphors: ${questionCues.metaphors}
Allow symbols to merge and flow organically into a unified composition.
${narrativeNote}

COLOR PALETTE:
${styleConfig.palette}

COMPOSITION:
Landscape orientation (16:9 aspect ratio), balanced composition with visual flow from left to right.
Figures should feel archetypal and universal, not specific individuals.
Create emotional resonance with the question's theme through visual metaphor.

CONSTRAINTS:
- No text, words, labels, or writing of any kind
- No literal tarot card imagery or card borders
- No modern objects or anachronistic elements
- ${styleConfig.constraints}
- Unified dreamlike scene blending all card energies
`.trim();
}

/**
 * Build a prompt for triptych (3-panel) illustration
 * Follows GPT-Image-1.5 best practices for multi-panel compositions
 */
export function buildTriptychPrompt(cards, question, style) {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.watercolor;
  
  // Detect question category for visual metaphors
  const questionCategory = detectQuestionCategory(question);
  const questionCues = QUESTION_VISUAL_CUES[questionCategory] || QUESTION_VISUAL_CUES.general;
  
  // For 3-card spreads, map directly; for others, select key cards
  let panelCards;
  if (cards.length === 3) {
    panelCards = cards;
  } else if (cards.length >= 5) {
    // Use first, middle, last for arc
    panelCards = [cards[0], cards[Math.floor(cards.length / 2)], cards[cards.length - 1]];
  } else {
    panelCards = cards.slice(0, 3);
  }

  const panelLabels = ['LEFT PANEL (Beginning)', 'CENTER PANEL (Present)', 'RIGHT PANEL (Outcome)'];
  const panels = panelCards.map((card, i) => {
    const visual = getCardVisuals(card);
    const legacyVisual = CARD_VISUALS[card.number] || {};
    const reversalNote = card.reversed ? `(${REVERSAL_TREATMENT.forImage})` : '';
    const symbols = visual.symbols || legacyVisual.symbols || 'archetypal imagery';
    const figure = visual.figure || legacyVisual.figure || 'symbolic figure embodying this energy';
    const mood = visual.mood || legacyVisual.mood || card.meaning;
    const colors = legacyVisual.colors || 'drawn from main palette';
    const suitNote = visual.suit ? `\n- Elemental energy: ${visual.element} (${visual.suitEnergy || ''})` : '';
    
    return `
${panelLabels[i]} - ${card.name} ${reversalNote}
- Position meaning: ${card.position}
- Key symbols: ${symbols}
- Figure: ${figure}${suitNote}
- Mood: ${mood}
- Panel colors: ${colors}`;
  }).join('\n');

  return `
VISUAL MEDIUM:
${styleConfig.medium}
${styleConfig.materials}

COMPOSITION:
A TRIPTYCH—three connected vertical panels side-by-side forming one landscape image.
Each panel captures one card's essence while visual motifs flow across all three.

SCENE CONTEXT:
A visual journey responding to the question: "${question}"
${styleConfig.lighting}
Environment cues: ${questionCues.environment}
Journey metaphor: ${questionCues.metaphors}

THE THREE PANELS:
${panels}

COLOR PALETTE:
${styleConfig.palette}
Colors should subtly shift across panels—cooler on left, warmer on right—showing transformation.

VISUAL CONTINUITY:
- Include a connecting element flowing through all panels (a river, path, light ray, or vine)
- Recurring symbolic motifs that transform from panel to panel
- Consistent horizon line and perspective across all three
- Style remains unified; mood evolves left to right

CONSTRAINTS:
- No text, words, labels, or writing of any kind
- No literal tarot card imagery or card borders
- No modern objects
- ${styleConfig.constraints}
- Three distinct but clearly connected panels
- Each panel must be visually complete on its own
`.trim();
}

/**
 * Build a prompt for individual card vignette
 */
export function buildCardVignettePrompt(card, question, position, style) {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.watercolor;
  const visual = getCardVisuals(card);
  const legacyVisual = CARD_VISUALS[card.number] || {};
  const suitVisual = card.suit ? SUIT_VISUALS[card.suit.toLowerCase()] : null;
  
  // Detect question category for contextual cues
  const questionCategory = detectQuestionCategory(question);
  const questionCues = QUESTION_VISUAL_CUES[questionCategory] || QUESTION_VISUAL_CUES.general;
  
  // Unified reversal treatment
  const orientationNote = card.reversed 
    ? REVERSAL_TREATMENT.forImage
    : 'The energy flows openly. Full expression of the archetype.';

  // Build suit/element note from either new or legacy visuals
  const element = visual.element || (suitVisual ? suitVisual.element : null);
  const suitNote = element 
    ? `\nELEMENTAL ENERGY: ${element} - ${visual.suitEnergy || suitVisual?.energy || ''}
\nSUIT SYMBOLS: ${suitVisual?.symbols || visual.symbols || ''}`
    : '';
  
  // Use combined visual data
  const symbols = visual.symbols || legacyVisual.symbols || 'archetypal imagery';
  const figure = visual.figure || legacyVisual.figure || 'symbolic figure';
  const mood = visual.mood || legacyVisual.mood || card.meaning;
  const colors = legacyVisual.colors || styleConfig.palette;

  return `
Create an artistic vignette for this tarot card in context.

STYLE: ${styleConfig.medium}
MATERIALS: ${styleConfig.materials}
LIGHTING: ${styleConfig.lighting}

THE CARD: ${card.name}
POSITION IN SPREAD: ${position}
QUESTION CONTEXT: "${question}"
QUESTION THEME CUES: ${questionCues.cues}
${orientationNote}

VISUAL ELEMENTS:
Symbols: ${symbols}
Figure: ${figure}
Mood: ${mood}
Colors: ${colors}
${suitNote}

ARTISTIC DIRECTION:
- Capture the card's essence through symbolic visual metaphor
- Contextualize for the question and position meaning
- Environment cues: ${questionCues.environment}
- Focus on emotional truth rather than literal card reproduction
- Use the position (${position}) to inform the narrative role
- No text or labels
- Create a moment frozen in time, rich with symbolic meaning

FORMAT: Portrait orientation (9:16 aspect ratio)
`.trim();
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
  buildSingleScenePrompt,
  buildTriptychPrompt,
  buildCardVignettePrompt,
  buildAmbientBackgroundPrompt
};
