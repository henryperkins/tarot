const SUIT_SYNONYMS = {
  Batons: 'Wands',
  Staffs: 'Wands',
  Staves: 'Wands',
  Clubs: 'Wands',
  Coupes: 'Cups',
  Chalices: 'Cups',
  Epees: 'Swords',
  Blades: 'Swords',
  Coins: 'Pentacles',
  Disks: 'Pentacles',
  Discs: 'Pentacles',
  Deniers: 'Pentacles'
};

const RANK_SYNONYMS = {
  Princess: 'Page',
  Prince: 'Knight',
  Valet: 'Page',
  Chevalier: 'Knight',
  Reine: 'Queen',
  Roi: 'King'
};

const SUIT_CONTEXT = {
  Wands: {
    element: 'Fire',
    symbolSingular: 'budding wooden wand',
    symbolPlural: 'flame-etched wands',
    environment: 'desert horizon with pyramids and cloudless sky',
    palette: [
      { color: 'amber', meaning: 'creative ignition' },
      { color: 'saffron', meaning: 'bold confidence' },
      { color: 'sienna', meaning: 'grounded stamina' }
    ],
    suitSymbols: [
      { object: 'sprouting leaves on wands', position: 'around staves', meaning: 'living inspiration taking root' },
      { object: 'pyramids and bare mountains', position: 'distant horizon', meaning: 'long-range quests and tests' }
    ]
  },
  Cups: {
    element: 'Water',
    symbolSingular: 'ornate chalice overflowing with water',
    symbolPlural: 'engraved cups',
    environment: 'lush riverbanks with lotus and reflective pools',
    palette: [
      { color: 'cerulean', meaning: 'emotional clarity' },
      { color: 'seafoam', meaning: 'intuitive gentleness' },
      { color: 'silver', meaning: 'moonlit reflection' }
    ],
    suitSymbols: [
      { object: 'flowing streams', position: 'foreground waters', meaning: 'feelings in motion' },
      { object: 'lotus blossoms', position: 'near chalices', meaning: 'spiritual receptivity' }
    ]
  },
  Swords: {
    element: 'Air',
    symbolSingular: 'steel sword with gleaming edge',
    symbolPlural: 'razor-sharp swords',
    environment: 'wind-swept plains with storm clouds and distant mountains',
    palette: [
      { color: 'ice blue', meaning: 'detached insight' },
      { color: 'slate gray', meaning: 'mental trials' },
      { color: 'white', meaning: 'clarifying truth' }
    ],
    suitSymbols: [
      { object: 'storm clouds', position: 'upper sky', meaning: 'charged mental atmosphere' },
      { object: 'fluttering birds or banners', position: 'mid-air', meaning: 'swift messages and thoughts' }
    ]
  },
  Pentacles: {
    element: 'Earth',
    symbolSingular: 'engraved golden pentacle',
    symbolPlural: 'garden pentacles',
    environment: 'verdant fields, vineyards, and stone gateways',
    palette: [
      { color: 'forest green', meaning: 'steady growth' },
      { color: 'gold', meaning: 'material abundance' },
      { color: 'russet', meaning: 'grounded effort' }
    ],
    suitSymbols: [
      { object: 'cultivated fields', position: 'foreground earth', meaning: 'patient stewardship' },
      { object: 'stone archways', position: 'background structures', meaning: 'legacy and craftsmanship' }
    ]
  }
};

const RANK_BLUEPRINTS = {
  Ace: {
    archetype: (ctx) => `${ctx.element} Seed`,
    composition: 'divine-hand presents singular symbol against expansive sky',
    symbolTemplates: [
      { object: 'divine hand emerging from cloud with {symbolSingular}', position: 'center', meaning: `pure ${'{element}'} potential entering the scene` },
      { object: 'crown or laurels hovering', position: 'above symbol', meaning: 'gifted opportunity ready to be claimed' },
      { object: '{environment}', position: 'beneath hand', meaning: 'open landscape waiting for new action' }
    ]
  },
  Two: {
    archetype: (ctx) => `${ctx.element} Duality Gate`,
    composition: 'paired symbols framing a horizon line',
    symbolTemplates: [
      { object: 'two {symbolPlural}', position: 'foreground balancing posture', meaning: 'decision, contrast, or mirrored forces' },
      { object: 'crossed arms or stance', position: 'figure posture', meaning: 'moment of weighing possibilities' },
      { object: '{environment}', position: 'background', meaning: 'context that demands balanced planning' }
    ]
  },
  Three: {
    archetype: (ctx) => `${ctx.element} Expansion Arc`,
    composition: 'triad motif showing momentum or collaboration',
    symbolTemplates: [
      { object: 'three {symbolPlural}', position: 'arranged in progressive line', meaning: 'growth through cooperation and foresight' },
      { object: 'figure observing horizon or architecture', position: 'mid-scene', meaning: 'vision expanding outward' },
      { object: '{environment}', position: 'distance', meaning: 'opportunities launching beyond comfort zone' }
    ]
  },
  Four: {
    archetype: (ctx) => `${ctx.element} Foundation`,
    composition: 'square or pavilion structure implying stability',
    symbolTemplates: [
      { object: 'four {symbolPlural}', position: 'forming square/pillar', meaning: 'structure, ritual, milestone' },
      { object: 'seated or standing figure', position: 'center', meaning: 'holding space, pausing to appreciate' },
      { object: '{environment}', position: 'surroundings', meaning: 'sheltered stage for celebration or rest' }
    ]
  },
  Five: {
    archetype: (ctx) => `${ctx.element} Stress Point`,
    composition: 'dynamic tension with disruption',
    symbolTemplates: [
      { object: 'five {symbolPlural}', position: 'scattered/clashing', meaning: 'conflict, scarcity, or testing ground' },
      { object: 'figures in turmoil or adversity', position: 'foreground action', meaning: 'challenge demanding resilience' },
      { object: '{environment}', position: 'harsh backdrop', meaning: 'conditions that amplify the lesson' }
    ]
  },
  Six: {
    archetype: (ctx) => `${ctx.element} Restoration`,
    composition: 'central exchange or harmonious flow',
    symbolTemplates: [
      { object: 'six {symbolPlural}', position: 'balanced arrangement', meaning: 'reciprocity, healing, generosity' },
      { object: 'giver and receiver figures', position: 'mid-scene', meaning: 'support in motion' },
      { object: '{environment}', position: 'calmer backdrop', meaning: 'peace returning after imbalance' }
    ]
  },
  Seven: {
    archetype: (ctx) => `${ctx.element} Assessment`,
    composition: 'figure pausing amid work or defense',
    symbolTemplates: [
      { object: 'seven {symbolPlural}', position: 'stacked or arrayed', meaning: 'inventory of progress and strategy' },
      { object: 'standing figure evaluating', position: 'foreground', meaning: 'moment to reassess effort or boundaries' },
      { object: '{environment}', position: 'surrounding terrain', meaning: 'field of ongoing labor or opposition' }
    ]
  },
  Eight: {
    archetype: (ctx) => `${ctx.element} Movement`,
    composition: 'strong directional lines showing transition',
    symbolTemplates: [
      { object: 'eight {symbolPlural}', position: 'diagonal or stacked motion', meaning: 'momentum, departure, or quick progress' },
      { object: 'figure in action or exiting scene', position: 'foreground', meaning: 'choice to move toward alignment' },
      { object: '{environment}', position: 'dynamic backdrop', meaning: 'landscape stretching toward next phase' }
    ]
  },
  Nine: {
    archetype: (ctx) => `${ctx.element} Culmination`,
    composition: 'almost-complete structure or solitary focus',
    symbolTemplates: [
      { object: 'nine {symbolPlural}', position: 'framing figure or sanctuary', meaning: 'fruits of labor, boundaries, refinement' },
      { object: 'solitary figure', position: 'center', meaning: 'self-possession, vigilance, or luxury' },
      { object: '{environment}', position: 'contained garden or guarded space', meaning: 'personal domain requiring upkeep' }
    ]
  },
  Ten: {
    archetype: (ctx) => `${ctx.element} Completion`,
    composition: 'full tableau showing legacy or burden release',
    symbolTemplates: [
      { object: 'ten {symbolPlural}', position: 'fully packed scene', meaning: 'culmination, saturation, or heavy load' },
      { object: 'family/figures interacting', position: 'foreground narrative', meaning: 'transfer of lessons across generations' },
      { object: '{environment}', position: 'spanning backdrop', meaning: 'world built by sustained effort' }
    ]
  },
  Page: {
    archetype: (ctx) => `${ctx.element} Messenger`,
    composition: 'youthful figure holding suit emblem',
    symbolTemplates: [
      { object: 'page holding {symbolSingular}', position: 'center posture', meaning: 'student energy, curiosity, news' },
      { object: 'fresh terrain', position: 'surrounding ground', meaning: 'learning field where mistakes are OK' },
      { object: '{environment}', position: 'background', meaning: 'elemental classroom for exploration' }
    ]
  },
  Knight: {
    archetype: (ctx) => `${ctx.element} Quest`,
    composition: 'mounted figure charging or focusing force',
    symbolTemplates: [
      { object: 'knight on steed with {symbolSingular}', position: 'center motion', meaning: 'pursuit, activism, mission' },
      { object: 'steed posture (rearing, pacing, still)', position: 'horse body', meaning: 'style of momentum specific to suit' },
      { object: '{environment}', position: 'terrain ahead', meaning: 'conditions the quest must cross' }
    ]
  },
  Queen: {
    archetype: (ctx) => `${ctx.element} Sovereign`,
    composition: 'throne-scene with rich symbolism',
    symbolTemplates: [
      { object: 'queen enthroned with {symbolSingular}', position: 'center', meaning: 'mature mastery with receptive influence' },
      { object: 'fauna, familiars, or motifs', position: 'at throne base', meaning: 'embodied wisdom of the suit' },
      { object: '{environment}', position: 'court or landscape', meaning: 'domain nurtured through emotional intelligence' }
    ]
  },
  King: {
    archetype: (ctx) => `${ctx.element} Architect`,
    composition: 'commanding figure structuring the realm',
    symbolTemplates: [
      { object: 'king with {symbolSingular}', position: 'center authority', meaning: 'strategic leadership and accountability' },
      { object: 'architectural motifs (pillars, city walls)', position: 'throne backdrop', meaning: 'systems stewarded by the king' },
      { object: '{environment}', position: 'landscape', meaning: 'kingdom shaped by long-term stewardship' }
    ]
  }
};

function interpolate(template, context) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] || '');
}

export function getMinorSymbolAnnotation(card) {
  if (!card) return null;
  const suitKey = card.suit ? (SUIT_SYNONYMS[card.suit] || card.suit) : null;
  const rankKey = card.rank ? (RANK_SYNONYMS[card.rank] || card.rank) : null;
  if (!suitKey || !rankKey) return null;
  const suitContext = SUIT_CONTEXT[suitKey];
  const rankBlueprint = RANK_BLUEPRINTS[rankKey];
  if (!suitContext || !rankBlueprint) return null;

  const templateContext = {
    element: suitContext.element,
    symbolSingular: suitContext.symbolSingular,
    symbolPlural: suitContext.symbolPlural,
    environment: suitContext.environment
  };

  const rankSymbols = rankBlueprint.symbolTemplates.map((template) => ({
    object: interpolate(template.object, templateContext),
    position: template.position,
    meaning: interpolate(template.meaning, templateContext)
  }));

  const symbols = [...rankSymbols, ...suitContext.suitSymbols].slice(0, 6);
  const dominantColors = suitContext.palette;
  const composition = `${rankBlueprint.composition} within ${suitContext.environment}`;
  const archetype = rankBlueprint.archetype(templateContext);

  return {
    symbols,
    dominantColors,
    composition,
    archetype
  };
}
