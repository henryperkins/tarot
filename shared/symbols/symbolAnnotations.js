// symbolAnnotations.js
// Structured symbol annotations for all 78 RWS cards
// Based on guidetoaitraining.md recommendations (Section 1.5) and imageryHooks.js
// Format per card:
// symbols: array of { object, position, color (optional), meaning }
// dominantColors: array of primary colors with symbolic meanings
// composition: overall layout description
// archetype: core psychological/spiritual archetype

export const SYMBOL_ANNOTATIONS = {
  // MAJOR ARCANA (0-21)
  0: { // The Fool
    symbols: [
      { object: 'sun', position: 'top-left', color: 'yellow', meaning: 'enlightenment, new beginnings' },
      { object: 'dog', position: 'bottom-right', color: 'white', meaning: 'loyalty, instinct, warning' },
      { object: 'cliff', position: 'right-edge', meaning: 'risk, the unknown, leap of faith' },
      { object: 'white rose', position: 'left-hand', color: 'white', meaning: 'purity, innocence' },
      { object: 'bundle', position: 'over-shoulder on stick', color: 'red', meaning: 'subconscious baggage, potential' },
      { object: 'feather', position: 'in hat', color: 'red', meaning: 'air element, freedom' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'optimism, joy' },
      { color: 'white', meaning: 'purity, new starts' },
      { color: 'sky-blue', meaning: 'freedom, possibility' }
    ],
    composition: 'figure-on-precipice',
    archetype: 'Divine Fool / Innocent Wanderer'
  },
  1: { // The Magician
    symbols: [
      { object: 'infinity symbol', position: 'above head', meaning: 'eternal potential, as above so below' },
      { object: 'wand', position: 'right hand raised', color: 'white', meaning: 'willpower, fire element' },
      { object: 'cup', position: 'on table', color: 'silver', meaning: 'emotions, water element' },
      { object: 'sword', position: 'on table', color: 'steel', meaning: 'intellect, air element' },
      { object: 'pentacle', position: 'on table', color: 'gold', meaning: 'materiality, earth element' },
      { object: 'red roses', position: 'garden below', color: 'red', meaning: 'passion, manifestation' },
      { object: 'white lilies', position: 'garden below', color: 'white', meaning: 'purity, spiritual wisdom' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'action, passion' },
      { color: 'white', meaning: 'purity, spirit' },
      { color: 'yellow', meaning: 'intellect, energy' }
    ],
    composition: 'channeling-figure-with-tools',
    archetype: 'Master Manifestor / Divine Channel'
  },
  2: { // The High Priestess
    symbols: [
      { object: 'pillars', position: 'flanking throne', color: 'black and white', meaning: 'duality, balance of opposites' },
      { object: 'lunar crown', position: 'on head', color: 'silver', meaning: 'cycles, intuition, feminine mystery' },
      { object: 'scroll', position: 'in lap', meaning: 'hidden knowledge, TORA (Torah/law)' },
      { object: 'veil', position: 'behind throne', color: 'blue', meaning: 'separation of conscious and subconscious' },
      { object: 'pomegranates', position: 'on veil', color: 'red', meaning: 'fertility, abundance, Persephone myth' },
      { object: 'crescent moon', position: 'at feet', color: 'silver', meaning: 'receptivity, subconscious' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'intuition, mystery' },
      { color: 'white', meaning: 'purity, spirit' },
      { color: 'black', meaning: 'unknown, shadow' }
    ],
    composition: 'veiled-throne-between-pillars',
    archetype: 'Mystic Guardian / Inner Knowing'
  },
  3: { // The Empress
    symbols: [
      { object: 'wheat fields', position: 'foreground', color: 'gold', meaning: 'abundance, fertility' },
      { object: 'waterfall', position: 'background', color: 'blue', meaning: 'emotional flow, creativity' },
      { object: 'Venus symbol', position: 'on shield', color: 'red', meaning: 'feminine energy, love, beauty' },
      { object: 'scepter', position: 'right hand', color: 'gold', meaning: 'authority, creative power' },
      { object: 'stars', position: 'in crown', meaning: 'celestial connection, divine feminine' },
      { object: 'pomegranates', position: 'on gown', color: 'red', meaning: 'fertility, sensuality' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, nature' },
      { color: 'red', meaning: 'passion, vitality' },
      { color: 'gold', meaning: 'abundance, warmth' }
    ],
    composition: 'reclining-in-nature',
    archetype: 'Nurturing Creator / Divine Mother'
  },
  4: { // The Emperor
    symbols: [
      { object: 'ram heads', position: 'on throne armrests', color: 'stone', meaning: 'Aries, leadership, initiation' },
      { object: 'mountains', position: 'background', color: 'red-orange', meaning: 'stability, challenges overcome' },
      { object: 'scepter', position: 'right hand', color: 'gold', meaning: 'authority, control' },
      { object: 'orb', position: 'left hand', color: 'gold', meaning: 'dominion, worldly power' },
      { object: 'armor', position: 'under robes', color: 'steel', meaning: 'protection, structure' },
      { object: 'ankh', position: 'on scepter', meaning: 'life, eternal rule' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'power, action' },
      { color: 'orange', meaning: 'ambition, energy' },
      { color: 'gray', meaning: 'stability, authority' }
    ],
    composition: 'enthroned-over-mountains',
    archetype: 'Divine Father / Structured Leader'
  },
  5: { // The Hierophant
    symbols: [
      { object: 'crossed keys', position: 'at feet', color: 'gold', meaning: 'spiritual authority, access to knowledge' },
      { object: 'two acolytes', position: 'kneeling below', meaning: 'teaching, transmission of wisdom' },
      { object: 'raised hand', position: 'right hand', meaning: 'blessing, divine connection' },
      { object: 'triple cross', position: 'on staff', color: 'gold', meaning: 'papal authority, three realms' },
      { object: 'pillars', position: 'behind throne', color: 'gray', meaning: 'stability, tradition' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'spiritual passion' },
      { color: 'white', meaning: 'purity, wisdom' },
      { color: 'gold', meaning: 'divine authority' }
    ],
    composition: 'seated-teacher-with-students',
    archetype: 'Spiritual Guide / Traditional Wisdom'
  },
  6: { // The Lovers
    symbols: [
      { object: 'angel', position: 'above', color: 'red wings', meaning: 'divine blessing, higher guidance' },
      { object: 'tree of knowledge', position: 'behind woman', color: 'green with serpent', meaning: 'choice, temptation' },
      { object: 'tree of life', position: 'behind man', color: 'green with flames', meaning: 'passion, vitality' },
      { object: 'mountain', position: 'background', color: 'purple', meaning: 'spiritual ascent' },
      { object: 'cloud', position: 'around angel', meaning: 'divine intervention' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, harmony' },
      { color: 'red', meaning: 'passion, union' },
      { color: 'purple', meaning: 'spiritual choice' }
    ],
    composition: 'dual-figures-under-angel',
    archetype: 'Sacred Union / Choice Maker'
  },
  7: { // The Chariot
    symbols: [
      { object: 'sphinxes', position: 'pulling chariot', color: 'black and white', meaning: 'opposing forces, balance' },
      { object: 'starry canopy', position: 'above chariot', color: 'blue', meaning: 'celestial protection' },
      { object: 'city', position: 'background', meaning: 'civilization left behind, journey outward' },
      { object: 'wand', position: 'in hand', color: 'gold', meaning: 'willpower, direction' },
      { object: 'armor', position: 'on figure', color: 'silver with symbols', meaning: 'protection, focus' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'control, intuition' },
      { color: 'black/white', meaning: 'duality, balance' },
      { color: 'gold', meaning: 'victory, will' }
    ],
    composition: 'armored-driver-with-sphinxes',
    archetype: 'Victorious Warrior / Directed Will'
  },
  8: { // Strength
    symbols: [
      { object: 'lion', position: 'below figure', color: 'red', meaning: 'inner beast, passion, courage' },
      { object: 'infinity symbol', position: 'above head', meaning: 'eternal strength, patience' },
      { object: 'flowers', position: 'in hair and around waist', color: 'white', meaning: 'gentleness, purity' },
      { object: 'mountains', position: 'background', color: 'green', meaning: 'overcoming challenges' }
    ],
    dominantColors: [
      { color: 'white', meaning: 'purity, gentleness' },
      { color: 'red', meaning: 'passion, vitality' },
      { color: 'green', meaning: 'growth, nature' }
    ],
    composition: 'gentle-figure-with-lion',
    archetype: 'Compassionate Warrior / Inner Strength'
  },
  9: { // The Hermit
    symbols: [
      { object: 'lantern', position: 'right hand raised', meaning: 'inner light, guidance' },
      { object: 'six-pointed star', position: 'inside lantern', color: 'yellow', meaning: 'wisdom, union of opposites' },
      { object: 'staff', position: 'left hand', color: 'gray', meaning: 'support, journey' },
      { object: 'mountain peak', position: 'standing on', color: 'gray', meaning: 'spiritual height, isolation' },
      { object: 'cloak', position: 'on figure', color: 'gray', meaning: 'withdrawal, introspection' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'neutrality, wisdom' },
      { color: 'yellow', meaning: 'illumination, intellect' },
      { color: 'blue', meaning: 'intuition, depth' }
    ],
    composition: 'solitary-figure-on-peak',
    archetype: 'Wise Seeker / Inner Guide'
  },
  10: { // Wheel of Fortune
    symbols: [
      { object: 'wheel', position: 'center', meaning: 'cycles, change' },
      { object: 'sphinx', position: 'top of wheel', color: 'blue', meaning: 'riddles, mystery' },
      { object: 'snake', position: 'descending left', color: 'green', meaning: 'transformation, descent' },
      { object: 'Anubis', position: 'rising right', color: 'red', meaning: 'rebirth, ascent' },
      { object: 'Hebrew letters', position: 'on wheel', meaning: 'divine name, fate' },
      { object: 'alchemical symbols', position: 'on wheel', meaning: 'elements, transformation' },
      { object: 'four fixed signs', position: 'corners', meaning: 'stability amid change' }
    ],
    dominantColors: [
      { color: 'orange', meaning: 'change, energy' },
      { color: 'blue', meaning: 'mystery, fate' },
      { color: 'yellow', meaning: 'illumination, cycles' }
    ],
    composition: 'turning-wheel-with-figures',
    archetype: 'Cycle Turner / Fate Weaver'
  },
  11: { // Justice
    symbols: [
      { object: 'scales', position: 'left hand', color: 'gold', meaning: 'balance, fairness' },
      { object: 'sword', position: 'right hand', color: 'steel', meaning: 'truth, decision' },
      { object: 'pillars', position: 'flanking throne', color: 'gray', meaning: 'stability, duality' },
      { object: 'purple veil', position: 'behind throne', meaning: 'mystery, higher wisdom' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'action, passion' },
      { color: 'purple', meaning: 'wisdom, royalty' },
      { color: 'gray', meaning: 'neutrality, balance' }
    ],
    composition: 'seated-judge-with-tools',
    archetype: 'Balanced Arbiter / Truth Seeker'
  },
  12: { // The Hanged Man
    symbols: [
      { object: 'tree', position: 'hanging from', color: 'green', meaning: 'living wood, growth through sacrifice' },
      { object: 'halo', position: 'around head', color: 'yellow', meaning: 'enlightenment, divine insight' },
      { object: 'crossed leg', position: 'right leg over left', meaning: 'surrender, new perspective' },
      { object: 'tau cross', position: 'formed by tree', meaning: 'spiritual suspension' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'intuition, surrender' },
      { color: 'yellow', meaning: 'illumination, insight' },
      { color: 'green', meaning: 'growth, nature' }
    ],
    composition: 'inverted-suspension',
    archetype: 'Surrendered Visionary / Sacrificial Seer'
  },
  13: { // Death
    symbols: [
      { object: 'skeleton', position: 'on horse', color: 'black armor', meaning: 'transformation, ending' },
      { object: 'white horse', position: 'mount', meaning: 'purity, forward movement' },
      { object: 'banner', position: 'in hand', color: 'black with white rose', meaning: 'rebirth, mysticism' },
      { object: 'sun', position: 'rising between towers', color: 'gold', meaning: 'new beginnings' },
      { object: 'fallen figures', position: 'on ground', meaning: 'release of old forms' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'ending, mystery' },
      { color: 'white', meaning: 'purity, rebirth' },
      { color: 'gold', meaning: 'dawn, renewal' }
    ],
    composition: 'rider-over-fallen',
    archetype: 'Transformer / Cycle Ender'
  },
  14: { // Temperance
    symbols: [
      { object: 'angel', position: 'center', meaning: 'balance, moderation' },
      { object: 'cups', position: 'pouring between', color: 'gold and silver', meaning: 'alchemical mixing' },
      { object: 'one foot in water', position: 'left foot', meaning: 'subconscious, emotion' },
      { object: 'one foot on land', position: 'right foot', meaning: 'conscious, stability' },
      { object: 'mountain path', position: 'background', meaning: 'journey to enlightenment' },
      { object: 'rising sun', position: 'distant', meaning: 'healing, integration' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'flow, emotion' },
      { color: 'red', meaning: 'action, passion' },
      { color: 'yellow', meaning: 'clarity, healing' }
    ],
    composition: 'pouring-angel-between-elements',
    archetype: 'Alchemical Balancer / Healer'
  },
  15: { // The Devil
    symbols: [
      { object: 'horned figure', position: 'perched on pedestal', meaning: 'shadow self, addiction' },
      { object: 'inverted pentagram', position: 'on forehead', meaning: 'material over spiritual' },
      { object: 'chained figures', position: 'below', meaning: 'bondage, illusion of entrapment' },
      { object: 'tails', position: 'on figures', color: 'grape and flame', meaning: 'base instincts' },
      { object: 'torch', position: 'left hand downward', meaning: 'downward energy, ignorance' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'shadow, bondage' },
      { color: 'red', meaning: 'temptation, passion' },
      { color: 'orange', meaning: 'materialism' }
    ],
    composition: 'perched-devil-with-chained',
    archetype: 'Shadow Binder / Material Tempter'
  },
  16: { // The Tower
    symbols: [
      { object: 'lightning', position: 'striking crown', color: 'white', meaning: 'sudden revelation, destruction' },
      { object: 'tower', position: 'center', color: 'gray', meaning: 'false structures, ego' },
      { object: 'falling figures', position: 'from tower', meaning: 'release, downfall' },
      { object: 'flaming debris', position: 'falling', color: 'yellow', meaning: 'purification by fire' },
      { object: 'gray sky', position: 'background', meaning: 'chaos, upheaval' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'instability' },
      { color: 'yellow', meaning: 'destruction, enlightenment' },
      { color: 'red', meaning: 'crisis, change' }
    ],
    composition: 'struck-tower-with-falling',
    archetype: 'Sudden Upheaval / Ego Destroyer'
  },
  17: { // The Star
    symbols: [
      { object: 'large star', position: 'overhead', color: 'yellow', meaning: 'hope, guidance' },
      { object: 'seven smaller stars', position: 'around large star', meaning: 'chakras, inspiration' },
      { object: 'naked figure', position: 'kneeling', meaning: 'vulnerability, authenticity' },
      { object: 'pitchers', position: 'pouring water', meaning: 'renewal, giving back' },
      { object: 'pool', position: 'left pitcher to', meaning: 'subconscious' },
      { object: 'land', position: 'right pitcher to', meaning: 'conscious manifestation' },
      { object: 'bird in tree', position: 'background', color: 'ibis', meaning: 'thought, wisdom' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'healing, flow' },
      { color: 'yellow', meaning: 'hope, inspiration' },
      { color: 'green', meaning: 'renewal, nature' }
    ],
    composition: 'pouring-figure-under-stars',
    archetype: 'Hope Bringer / Healer'
  },
  18: { // The Moon
    symbols: [
      { object: 'full moon with face', position: 'center sky', meaning: 'illusion, subconscious' },
      { object: 'two towers', position: 'background', color: 'gray', meaning: 'boundaries, duality' },
      { object: 'dog and wolf', position: 'howling at moon', meaning: 'tame and wild instincts' },
      { object: 'crayfish', position: 'emerging from water', meaning: 'deep subconscious' },
      { object: 'winding path', position: 'through scene', meaning: 'journey through uncertainty' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'mystery, intuition' },
      { color: 'yellow', meaning: 'deceptive light' },
      { color: 'gray', meaning: 'uncertainty' }
    ],
    composition: 'path-through-instincts-under-moon',
    archetype: 'Illusion Navigator / Subconscious Explorer'
  },
  19: { // The Sun
    symbols: [
      { object: 'radiant sun with face', position: 'center sky', meaning: 'vitality, clarity' },
      { object: 'naked child', position: 'on white horse', meaning: 'innocence, joy' },
      { object: 'sunflowers', position: 'background wall', color: 'yellow', meaning: 'happiness, growth' },
      { object: 'red banner', position: "in child's hand", meaning: 'vitality, celebration' },
      { object: 'wall', position: 'behind', color: 'gray', meaning: 'boundaries overcome' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'joy, enlightenment' },
      { color: 'red', meaning: 'vitality, energy' },
      { color: 'white', meaning: 'purity, clarity' }
    ],
    composition: 'joyful-rider-under-sun',
    archetype: 'Joyful Illuminator / Vital Force'
  },
  20: { // Judgement
    symbols: [
      { object: 'angel', position: 'in clouds', meaning: 'awakening, rebirth' },
      { object: 'trumpet', position: 'blown by angel', color: 'gold', meaning: 'call to rise' },
      { object: 'rising figures', position: 'from coffins', meaning: 'resurrection, renewal' },
      { object: 'mountains', position: 'background', color: 'gray', meaning: 'obstacles overcome' },
      { object: 'water', position: 'foreground', meaning: 'purification, subconscious' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'transition' },
      { color: 'blue', meaning: 'purification' },
      { color: 'gold', meaning: 'divine call' }
    ],
    composition: 'rising-figures-under-angel',
    archetype: 'Awakener / Transformer'
  },
  21: { // The World
    symbols: [
      { object: 'dancer', position: 'center', meaning: 'completion, integration' },
      { object: 'wreath', position: 'surrounding dancer', color: 'green', meaning: 'victory, wholeness' },
      { object: 'wands', position: 'in hands', color: 'gold', meaning: 'mastery, balance' },
      { object: 'four fixed signs', position: 'corners', meaning: 'elements in harmony' },
      { object: 'red ribbon', position: 'tying wreath', meaning: 'infinity, cycles' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'completion, growth' },
      { color: 'blue', meaning: 'wholeness, spirit' },
      { color: 'red', meaning: 'vitality, celebration' }
    ],
    composition: 'encircled-dancer',
    archetype: 'Cosmic Integrator / Completed Self'
  },

  // MINOR ARCANA - WANDS
  22: { // Ace of Wands
    symbols: [
      { object: 'hand', position: 'emerging from cloud', meaning: 'divine inspiration' },
      { object: 'sprouting wand', position: 'held in hand', color: 'green leaves', meaning: 'creative potential, growth' },
      { object: 'rolling hills', position: 'background', color: 'green', meaning: 'fertile opportunities' },
      { object: 'distant castle', position: 'far background', meaning: 'goals, achievement' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, potential' },
      { color: 'gray', meaning: 'cloud, divine source' }
    ],
    composition: 'hand-presenting-wand',
    archetype: 'Creative Spark'
  },
  23: { // Two of Wands
    symbols: [
      { object: 'figure', position: 'on battlements', meaning: 'planning, vision' },
      { object: 'globe', position: 'in right hand', color: 'blue/red', meaning: 'world of possibilities' },
      { object: 'wands', position: 'one held, one anchored', meaning: 'choice, direction' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'passion, action' },
      { color: 'blue', meaning: 'vision, planning' }
    ],
    composition: 'overlooking-figure-with-globe',
    archetype: 'Visionary Planner'
  },
  24: { // Three of Wands
    symbols: [
      { object: 'cloaked traveler', position: 'on cliff', meaning: 'foresight, exploration' },
      { object: 'three wands', position: 'rooted beside', meaning: 'initial manifestation' },
      { object: 'ships', position: 'on sea below', meaning: 'opportunities arriving' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'optimism, future' },
      { color: 'blue', meaning: 'distance, possibility' }
    ],
    composition: 'watching-traveler-on-cliff',
    archetype: 'Opportunity Seeker'
  },
  25: { // Four of Wands
    symbols: [
      { object: 'garlanded wands', position: 'forming arch', color: 'green/yellow', meaning: 'celebration, homecoming' },
      { object: 'figures', position: 'celebrating beyond', meaning: 'community, joy' },
      { object: 'castle', position: 'background', meaning: 'stability, achievement' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'joy, celebration' },
      { color: 'green', meaning: 'growth, harmony' }
    ],
    composition: 'festive-archway',
    archetype: 'Harmonious Celebrant'
  },
  26: { // Five of Wands
    symbols: [
      { object: 'youths', position: 'in group', meaning: 'competition, diversity' },
      { object: 'wands', position: 'brandished', color: 'wood', meaning: 'conflicting ideas' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'conflict, energy' },
      { color: 'blue', meaning: 'communication' }
    ],
    composition: 'clashing-group',
    archetype: 'Competitive Challenger'
  },
  27: { // Six of Wands
    symbols: [
      { object: 'laureled rider', position: 'on horseback', meaning: 'victory, recognition' },
      { object: 'wand', position: 'raised', color: 'laurel', meaning: 'success' },
      { object: 'onlookers', position: 'surrounding', meaning: 'public acclaim' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'triumph' },
      { color: 'white', meaning: 'purity of achievement' }
    ],
    composition: 'victorious-procession',
    archetype: 'Triumphant Leader'
  },
  28: { // Seven of Wands
    symbols: [
      { object: 'guardian', position: 'on hilltop', meaning: 'defense, advantage' },
      { object: 'wand', position: 'thrusting', meaning: 'assertion' },
      { object: 'challengers', position: 'below (implied)', meaning: 'opposition' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth through challenge' },
      { color: 'red', meaning: 'courage' }
    ],
    composition: 'defending-high-ground',
    archetype: 'Valiant Defender'
  },
  29: { // Eight of Wands
    symbols: [
      { object: 'eight wands', position: 'streaking through sky', meaning: 'swift movement' },
      { object: 'meadows', position: 'below', color: 'green', meaning: 'clear path' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'progress' },
      { color: 'blue', meaning: 'clarity' }
    ],
    composition: 'flying-wands',
    archetype: 'Swift Messenger'
  },
  30: { // Nine of Wands
    symbols: [
      { object: 'bandaged sentinel', position: 'standing', meaning: 'resilience' },
      { object: 'eight wands', position: 'fence behind', meaning: 'boundaries, experience' },
      { object: 'wand', position: 'gripped', meaning: 'readiness' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'vigilance' },
      { color: 'green', meaning: 'healing' }
    ],
    composition: 'wounded-guardian',
    archetype: 'Resilient Protector'
  },
  31: { // Ten of Wands
    symbols: [
      { object: 'figure', position: 'hunched', meaning: 'burden' },
      { object: 'ten wands', position: 'bundled in arms', meaning: 'overcommitment' },
      { object: 'town', position: 'ahead', meaning: 'destination near' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'strain' },
      { color: 'yellow', meaning: 'effort' }
    ],
    composition: 'burdened-traveler',
    archetype: 'Overloaded Carrier'
  },

  // CUPS (32-45)
  32: { // Ace of Cups
    symbols: [
      { object: 'hand', position: 'from cloud', meaning: 'divine offering' },
      { object: 'chalice', position: 'held', color: 'gold', meaning: 'emotional potential' },
      { object: 'dove', position: 'crowning chalice', color: 'white', meaning: 'peace, spirit' },
      { object: 'overflowing water', position: 'from chalice', meaning: 'abundance' },
      { object: 'lotus blossoms', position: 'on water surface', color: 'white', meaning: 'spiritual awakening, purity' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'emotion, flow' },
      { color: 'gold', meaning: 'divine love' },
      { color: 'white', meaning: 'purity, spiritual love' }
    ],
    composition: 'overflowing-chalice',
    archetype: 'Emotional Source'
  },
  33: { // Two of Cups
    symbols: [
      { object: 'two figures', position: 'facing each other', meaning: 'partnership, union' },
      { object: 'cups raised', position: 'in toast', color: 'gold', meaning: 'mutual exchange' },
      { object: 'caduceus', position: 'above cups', meaning: 'healing, balance' },
      { object: 'winged lion', position: 'crowning caduceus', color: 'red', meaning: 'passionate commitment' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'passion, commitment' },
      { color: 'gold', meaning: 'sacred exchange' },
      { color: 'white', meaning: 'purity of connection' }
    ],
    composition: 'mutual-pledge',
    archetype: 'Sacred Partnership'
  },
  34: { // Three of Cups
    symbols: [
      { object: 'three maidens', position: 'in circle', meaning: 'community, celebration' },
      { object: 'raised cups', position: 'in toast', color: 'gold', meaning: 'shared joy' },
      { object: 'fruits and gourds', position: 'at feet', meaning: 'harvest, abundance' },
      { object: 'flowing garments', position: 'on figures', color: 'varied', meaning: 'diversity, harmony' }
    ],
    dominantColors: [
      { color: 'orange', meaning: 'celebration, warmth' },
      { color: 'green', meaning: 'growth, abundance' },
      { color: 'gold', meaning: 'shared prosperity' }
    ],
    composition: 'celebratory-circle',
    archetype: 'Joyful Community'
  },
  35: { // Four of Cups
    symbols: [
      { object: 'seated figure', position: 'under tree', meaning: 'contemplation, withdrawal' },
      { object: 'three cups', position: 'on ground', meaning: 'known options' },
      { object: 'hand from cloud', position: 'offering fourth cup', meaning: 'new possibility' },
      { object: 'crossed arms', position: 'on figure', meaning: 'resistance, introspection' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'stagnation, contemplation' },
      { color: 'gray', meaning: 'apathy, meditation' },
      { color: 'gold', meaning: 'overlooked opportunity' }
    ],
    composition: 'meditative-dissatisfaction',
    archetype: 'Contemplative Refusal'
  },
  36: { // Five of Cups
    symbols: [
      { object: 'cloaked figure', position: 'head bowed', meaning: 'grief, loss' },
      { object: 'three spilled cups', position: 'before figure', color: 'red liquid', meaning: 'what is lost' },
      { object: 'two standing cups', position: 'behind figure', meaning: 'what remains' },
      { object: 'bridge', position: 'background', meaning: 'path forward' },
      { object: 'distant castle', position: 'across water', meaning: 'future hope' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'mourning, sorrow' },
      { color: 'gray', meaning: 'desolation' },
      { color: 'blue', meaning: 'emotional depth' }
    ],
    composition: 'grieving-over-loss',
    archetype: 'Mourning Traveler'
  },
  37: { // Six of Cups
    symbols: [
      { object: 'children', position: 'in courtyard', meaning: 'innocence, nostalgia' },
      { object: 'cups with flowers', position: 'filled with white blooms', meaning: 'sweet memories' },
      { object: 'older child giving', position: 'offering cup', meaning: 'generosity, gift' },
      { object: 'cottages', position: 'background', meaning: 'home, past' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'nostalgia, warmth' },
      { color: 'white', meaning: 'innocence, purity' },
      { color: 'green', meaning: 'growth, simplicity' }
    ],
    composition: 'nostalgic-exchange',
    archetype: 'Innocent Gift-Giver'
  },
  38: { // Seven of Cups
    symbols: [
      { object: 'shadowed figure', position: 'silhouette', meaning: 'confusion, choices' },
      { object: 'seven cups on clouds', position: 'floating', meaning: 'illusions, fantasies' },
      { object: 'castle', position: 'in one cup', meaning: 'ambition' },
      { object: 'jewels', position: 'in one cup', meaning: 'wealth, desire' },
      { object: 'laurel wreath', position: 'in one cup', meaning: 'victory, recognition' },
      { object: 'dragon', position: 'in one cup', meaning: 'fear, challenge' },
      { object: 'shrouded figure', position: 'in one cup', meaning: 'mystery' },
      { object: 'serpent', position: 'in one cup', meaning: 'temptation' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'dreams, illusion' },
      { color: 'gray', meaning: 'confusion, fog' },
      { color: 'gold', meaning: 'desire, fantasy' }
    ],
    composition: 'illusory-choices',
    archetype: 'Bewildered Dreamer'
  },
  39: { // Eight of Cups
    symbols: [
      { object: 'cloaked figure', position: 'walking away', meaning: 'departure, seeking' },
      { object: 'eight stacked cups', position: 'left behind', meaning: 'abandoned past' },
      { object: 'gap in cups', position: 'missing ninth', meaning: 'incompleteness' },
      { object: 'moon', position: 'overhead', color: 'pale', meaning: 'intuition, night journey' },
      { object: 'mountains', position: 'ahead', meaning: 'spiritual quest' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'introspection, journey' },
      { color: 'gray', meaning: 'twilight, transition' },
      { color: 'brown', meaning: 'earthly detachment' }
    ],
    composition: 'departing-seeker',
    archetype: 'Spiritual Wanderer'
  },
  40: { // Nine of Cups
    symbols: [
      { object: 'satisfied figure', position: 'seated, arms crossed', meaning: 'contentment, pride' },
      { object: 'nine cups', position: 'arranged in arc', color: 'gold', meaning: 'wishes fulfilled' },
      { object: 'blue draped table', position: 'beneath cups', meaning: 'emotional abundance' },
      { object: 'smile', position: 'on figure', meaning: 'satisfaction' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'emotional fulfillment' },
      { color: 'red', meaning: 'vitality, pleasure' },
      { color: 'gold', meaning: 'achievement' }
    ],
    composition: 'satisfied-abundance',
    archetype: 'Wish Fulfiller'
  },
  41: { // Ten of Cups
    symbols: [
      { object: 'family', position: 'embracing', meaning: 'love, harmony' },
      { object: 'children playing', position: 'foreground', meaning: 'joy, innocence' },
      { object: 'rainbow', position: 'overhead', meaning: 'blessing, promise' },
      { object: 'ten cups', position: 'in rainbow arc', color: 'gold', meaning: 'complete emotional fulfillment' },
      { object: 'cottage', position: 'background', meaning: 'home, security' },
      { object: 'river', position: 'nearby', meaning: 'flow of life' }
    ],
    dominantColors: [
      { color: 'rainbow', meaning: 'complete spectrum of joy' },
      { color: 'green', meaning: 'peace, nature' },
      { color: 'blue', meaning: 'emotional harmony' }
    ],
    composition: 'blessed-family',
    archetype: 'Harmonious Union'
  },
  42: { // Page of Cups
    symbols: [
      { object: 'youth', position: 'standing', meaning: 'emotional curiosity' },
      { object: 'cup', position: 'held forth', color: 'gold', meaning: 'creative offering' },
      { object: 'fish', position: 'emerging from cup', color: 'blue', meaning: 'unexpected message, intuition' },
      { object: 'blue tunic', position: 'on figure', color: 'flowered', meaning: 'imagination, sensitivity' },
      { object: 'gentle waves', position: 'at feet', meaning: 'emotional fluidity' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'imagination, emotion' },
      { color: 'gold', meaning: 'creative potential' },
      { color: 'turquoise', meaning: 'intuitive messages' }
    ],
    composition: 'curious-messenger',
    archetype: 'Imaginative Messenger'
  },
  43: { // Knight of Cups
    symbols: [
      { object: 'armored knight', position: 'on white horse', meaning: 'romantic quest' },
      { object: 'cup', position: 'offered forward', color: 'gold', meaning: 'emotional offering' },
      { object: 'winged helmet', position: 'on head', meaning: 'inspired thought' },
      { object: 'slow-walking horse', position: 'measured pace', color: 'white', meaning: 'dreaminess, idealism' },
      { object: 'river', position: 'background', meaning: 'emotional journey' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'romance, idealism' },
      { color: 'white', meaning: 'purity of intention' },
      { color: 'silver', meaning: 'reflection, emotion' }
    ],
    composition: 'romantic-quester',
    archetype: 'Romantic Idealist'
  },
  44: { // Queen of Cups
    symbols: [
      { object: 'enthroned queen', position: 'by water', meaning: 'emotional mastery' },
      { object: 'ornate cup', position: 'held carefully', color: 'gold with angels', meaning: 'sacred emotion' },
      { object: 'throne', position: 'on shore', color: 'decorated with sea creatures', meaning: 'subconscious realm' },
      { object: 'water', position: 'at throne base', meaning: 'deep feeling' },
      { object: 'pebbled shore', position: 'foreground', meaning: 'boundary of conscious/unconscious' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'intuition, empathy' },
      { color: 'white', meaning: 'purity of feeling' },
      { color: 'silver', meaning: 'lunar wisdom' }
    ],
    composition: 'contemplative-sovereign',
    archetype: 'Empathic Nurturer'
  },
  45: { // King of Cups
    symbols: [
      { object: 'enthroned king', position: 'on turbulent sea', meaning: 'emotional control' },
      { object: 'cup', position: 'held steady', color: 'gold', meaning: 'mastered emotion' },
      { object: 'fish amulet', position: 'around neck', meaning: 'subconscious awareness' },
      { object: 'ship', position: 'background right', meaning: 'journey through emotion' },
      { object: 'fish leaping', position: 'background left', meaning: 'creative unconscious' },
      { object: 'stone throne', position: 'floating', meaning: 'stability amid flux' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'mastered emotion' },
      { color: 'green', meaning: 'balanced feeling' },
      { color: 'gold', meaning: 'mature wisdom' }
    ],
    composition: 'sovereign-on-waters',
    archetype: 'Balanced Emotional Master'
  },

  // SWORDS (46-59)
  46: { // Ace of Swords
    symbols: [
      { object: 'hand', position: 'from cloud', meaning: 'divine clarity' },
      { object: 'upright sword', position: 'held firm', color: 'steel', meaning: 'truth, mental power' },
      { object: 'crown', position: 'on sword tip', color: 'gold', meaning: 'victory of mind' },
      { object: 'laurel and palm', position: 'on crown', meaning: 'triumph, peace' },
      { object: 'mountains', position: 'background', meaning: 'challenges to overcome' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'clarity, neutrality' },
      { color: 'white', meaning: 'purity of thought' },
      { color: 'gold', meaning: 'crowned truth' }
    ],
    composition: 'triumphant-blade',
    archetype: 'Mental Breakthrough'
  },
  47: { // Two of Swords
    symbols: [
      { object: 'blindfolded figure', position: 'seated', meaning: 'blocked sight, indecision' },
      { object: 'crossed swords', position: 'held in balance', meaning: 'stalemate, equilibrium' },
      { object: 'crescent moon', position: 'overhead', meaning: 'intuition needed' },
      { object: 'rocks in water', position: 'background', meaning: 'hidden obstacles' },
      { object: 'white robe', position: 'on figure', meaning: 'purity, neutrality' }
    ],
    dominantColors: [
      { color: 'white', meaning: 'neutrality, purity' },
      { color: 'blue', meaning: 'calm surface, hidden depth' },
      { color: 'gray', meaning: 'uncertainty' }
    ],
    composition: 'blindfolded-balance',
    archetype: 'Suspended Decision'
  },
  48: { // Three of Swords
    symbols: [
      { object: 'heart', position: 'center', color: 'red', meaning: 'emotional core' },
      { object: 'three swords', position: 'piercing heart', meaning: 'heartbreak, sorrow' },
      { object: 'rain clouds', position: 'background', color: 'gray', meaning: 'grief, tears' },
      { object: 'rain', position: 'falling', meaning: 'cleansing sorrow' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'sorrow, pain' },
      { color: 'red', meaning: 'wounded heart' },
      { color: 'silver', meaning: 'piercing truth' }
    ],
    composition: 'pierced-heart',
    archetype: 'Heartbreak'
  },
  49: { // Four of Swords
    symbols: [
      { object: 'effigy', position: 'lying in repose', meaning: 'rest, meditation' },
      { object: 'three swords', position: 'on wall', meaning: 'suspended conflict' },
      { object: 'one sword', position: 'beneath effigy', meaning: 'retained awareness' },
      { object: 'praying hands', position: 'on effigy', meaning: 'contemplation, prayer' },
      { object: 'stained glass', position: 'window', meaning: 'sanctuary, sacred space' }
    ],
    dominantColors: [
      { color: 'gold', meaning: 'sacred rest' },
      { color: 'blue', meaning: 'peace, meditation' },
      { color: 'gray', meaning: 'stillness' }
    ],
    composition: 'resting-warrior',
    archetype: 'Meditative Retreat'
  },
  50: { // Five of Swords
    symbols: [
      { object: 'victor', position: 'foreground with smirk', meaning: 'hollow victory' },
      { object: 'five swords', position: 'three held, two abandoned', meaning: 'conflict, defeat' },
      { object: 'defeated figures', position: 'walking away', meaning: 'loss, retreat' },
      { object: 'turbulent sky', position: 'background', meaning: 'discord, unrest' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'envy, discord' },
      { color: 'gray', meaning: 'conflict, tension' },
      { color: 'blue', meaning: 'troubled waters' }
    ],
    composition: 'pyrrhic-victory',
    archetype: 'Hollow Victor'
  },
  51: { // Six of Swords
    symbols: [
      { object: 'boat', position: 'crossing water', meaning: 'transition, passage' },
      { object: 'ferryman', position: 'poling boat', meaning: 'guidance through difficulty' },
      { object: 'woman and child', position: 'passengers', meaning: 'vulnerable travelers' },
      { object: 'six swords', position: 'standing in boat', meaning: 'carried troubles' },
      { object: 'rough water', position: 'left behind', meaning: 'past turmoil' },
      { object: 'calm water', position: 'ahead', meaning: 'future peace' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'emotional journey' },
      { color: 'gray', meaning: 'somber passage' },
      { color: 'yellow', meaning: 'hope ahead' }
    ],
    composition: 'crossing-waters',
    archetype: 'Guided Transition'
  },
  52: { // Seven of Swords
    symbols: [
      { object: 'sneaking figure', position: 'tiptoeing away', meaning: 'stealth, evasion' },
      { object: 'five swords', position: 'bundled in arms', meaning: 'theft, strategy' },
      { object: 'two swords', position: 'left behind', meaning: 'incomplete plan' },
      { object: 'military camp', position: 'background', meaning: 'enemy territory' },
      { object: 'backwards glance', position: 'on figure', meaning: 'caution, guilt' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'caution, deception' },
      { color: 'red', meaning: 'danger, urgency' },
      { color: 'orange', meaning: 'cunning' }
    ],
    composition: 'stealthy-escape',
    archetype: 'Cunning Strategist'
  },
  53: { // Eight of Swords
    symbols: [
      { object: 'bound figure', position: 'standing', meaning: 'restriction, helplessness' },
      { object: 'blindfold', position: 'on eyes', meaning: 'self-imposed limitation' },
      { object: 'eight swords', position: 'surrounding loosely', meaning: 'mental prison' },
      { object: 'muddy ground', position: 'at feet', meaning: 'stuck, unclear' },
      { object: 'castle', position: 'distant background', meaning: 'freedom within reach' },
      { object: 'loose bindings', position: 'on figure', meaning: 'escapable situation' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'imprisonment, confusion' },
      { color: 'red', meaning: 'bound energy' },
      { color: 'blue', meaning: 'distant clarity' }
    ],
    composition: 'self-imprisoned',
    archetype: 'Voluntary Captive'
  },
  54: { // Nine of Swords
    symbols: [
      { object: 'figure', position: 'sitting up in bed', meaning: 'waking nightmare' },
      { object: 'hands on face', position: 'gesture of despair', meaning: 'anguish, worry' },
      { object: 'nine swords', position: 'on wall', meaning: 'mental torment' },
      { object: 'quilt', position: 'on bed', color: 'roses and astrological signs', meaning: 'beauty hidden by fear' },
      { object: 'darkness', position: 'background', meaning: 'night fears' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'nightmares, anxiety' },
      { color: 'red', meaning: 'anguish' },
      { color: 'white', meaning: 'stark clarity of fear' }
    ],
    composition: 'anguished-waking',
    archetype: 'Anxious Mind'
  },
  55: { // Ten of Swords
    symbols: [
      { object: 'fallen figure', position: 'face-down', meaning: 'defeat, ending' },
      { object: 'ten swords', position: 'in back', meaning: 'betrayal, rock bottom' },
      { object: 'black sky', position: 'above', meaning: 'darkest hour' },
      { object: 'dawn light', position: 'horizon', color: 'yellow', meaning: 'new beginning coming' },
      { object: 'calm water', position: 'background', meaning: 'peace after storm' },
      { object: 'red cloak', position: 'on figure', meaning: 'life force, drama' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'ending, finality' },
      { color: 'yellow', meaning: 'approaching dawn' },
      { color: 'red', meaning: 'dramatic conclusion' }
    ],
    composition: 'dramatic-ending',
    archetype: 'Complete Defeat / New Dawn'
  },
  56: { // Page of Swords
    symbols: [
      { object: 'youth', position: 'standing alert', meaning: 'mental vigilance' },
      { object: 'sword', position: 'raised defensively', color: 'steel', meaning: 'intellectual readiness' },
      { object: 'turbulent clouds', position: 'background', meaning: 'mental activity' },
      { object: 'birds', position: 'in flight', meaning: 'thoughts, messages' },
      { object: 'uneven ground', position: 'beneath', meaning: 'testing ideas' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth of ideas' },
      { color: 'yellow', meaning: 'mental energy' },
      { color: 'blue', meaning: 'communication' }
    ],
    composition: 'alert-student',
    archetype: 'Curious Investigator'
  },
  57: { // Knight of Swords
    symbols: [
      { object: 'charging knight', position: 'on galloping horse', meaning: 'swift action' },
      { object: 'raised sword', position: 'held high', meaning: 'aggressive intellect' },
      { object: 'white horse', position: 'at full gallop', meaning: 'speed, intensity' },
      { object: 'windswept clouds', position: 'background', meaning: 'mental storm' },
      { object: 'birds', position: 'scattered', meaning: 'disrupted thoughts' },
      { object: 'trees bent', position: 'by wind', meaning: 'force of will' }
    ],
    dominantColors: [
      { color: 'white', meaning: 'clarity, speed' },
      { color: 'blue', meaning: 'intellectual force' },
      { color: 'gray', meaning: 'stormy energy' }
    ],
    composition: 'charging-warrior',
    archetype: 'Forceful Intellect'
  },
  58: { // Queen of Swords
    symbols: [
      { object: 'enthroned queen', position: 'upright', meaning: 'clear judgment' },
      { object: 'upright sword', position: 'in right hand', meaning: 'discernment, truth' },
      { object: 'raised left hand', position: 'beckoning', meaning: 'invitation to honesty' },
      { object: 'butterflies', position: 'on throne', meaning: 'transformation through clarity' },
      { object: 'clouds', position: 'background', meaning: 'mental realm' },
      { object: 'bird', position: 'in sky', meaning: 'freedom of thought' }
    ],
    dominantColors: [
      { color: 'blue', meaning: 'clear thought' },
      { color: 'white', meaning: 'purity of mind' },
      { color: 'gray', meaning: 'objectivity' }
    ],
    composition: 'judicious-sovereign',
    archetype: 'Clear-Minded Judge'
  },
  59: { // King of Swords
    symbols: [
      { object: 'enthroned king', position: 'upright', meaning: 'intellectual authority' },
      { object: 'upright sword', position: 'in right hand', meaning: 'justice, logic' },
      { object: 'butterflies', position: 'on throne', meaning: 'mental transformation' },
      { object: 'crescent moons', position: 'on throne', meaning: 'intuitive intellect' },
      { object: 'trees', position: 'background left', meaning: 'natural wisdom' },
      { object: 'clouds', position: 'background right', meaning: 'realm of ideas' }
    ],
    dominantColors: [
      { color: 'purple', meaning: 'wisdom, authority' },
      { color: 'blue', meaning: 'mental mastery' },
      { color: 'white', meaning: 'objective truth' }
    ],
    composition: 'authoritative-judge',
    archetype: 'Intellectual Master'
  },

  // PENTACLES (60-73)
  60: { // Ace of Pentacles
    symbols: [
      { object: 'hand', position: 'from cloud', meaning: 'divine gift' },
      { object: 'pentacle', position: 'held forth', color: 'gold', meaning: 'material opportunity' },
      { object: 'garden', position: 'below', color: 'lush', meaning: 'fertile ground' },
      { object: 'archway', position: 'background', meaning: 'entrance to manifestation' },
      { object: 'mountains', position: 'distant', meaning: 'long-term goals' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, prosperity' },
      { color: 'gold', meaning: 'wealth, potential' },
      { color: 'white', meaning: 'pure opportunity' }
    ],
    composition: 'offered-abundance',
    archetype: 'Material Seed'
  },
  61: { // Two of Pentacles
    symbols: [
      { object: 'juggler', position: 'in motion', meaning: 'balance, adaptability' },
      { object: 'two pentacles', position: 'in infinity loop', color: 'gold', meaning: 'dynamic balance' },
      { object: 'infinity symbol', position: 'formed by ribbon', meaning: 'endless cycle' },
      { object: 'ships on waves', position: 'background', meaning: 'ups and downs' },
      { object: 'dancing posture', position: 'on figure', meaning: 'graceful adjustment' }
    ],
    dominantColors: [
      { color: 'red', meaning: 'energy, action' },
      { color: 'blue', meaning: 'flow, adaptation' },
      { color: 'gold', meaning: 'value in motion' }
    ],
    composition: 'dynamic-juggling',
    archetype: 'Flexible Balancer'
  },
  62: { // Three of Pentacles
    symbols: [
      { object: 'craftsman', position: 'on bench', meaning: 'skilled work' },
      { object: 'architect and monk', position: 'consulting', meaning: 'collaboration, expertise' },
      { object: 'three pentacles', position: 'in archway', color: 'carved', meaning: 'recognized skill' },
      { object: 'cathedral', position: 'being built', meaning: 'sacred work' },
      { object: 'plans', position: 'held', meaning: 'design, planning' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'stone, foundation' },
      { color: 'gold', meaning: 'valued skill' },
      { color: 'brown', meaning: 'earthly craft' }
    ],
    composition: 'collaborative-craft',
    archetype: 'Master Craftsperson'
  },
  63: { // Four of Pentacles
    symbols: [
      { object: 'seated figure', position: 'on cube', meaning: 'stability, control' },
      { object: 'pentacle on crown', position: 'head', meaning: 'fixation on security' },
      { object: 'pentacle clasped', position: 'to chest', meaning: 'holding tight' },
      { object: 'pentacles under feet', position: 'grounded on', meaning: 'possessiveness' },
      { object: 'city', position: 'background', meaning: 'material world' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'rigidity, control' },
      { color: 'gold', meaning: 'hoarded wealth' },
      { color: 'red', meaning: 'fear of loss' }
    ],
    composition: 'guarded-possession',
    archetype: 'Cautious Hoarder'
  },
  64: { // Five of Pentacles
    symbols: [
      { object: 'two beggars', position: 'in snow', meaning: 'hardship, poverty' },
      { object: 'crutches', position: 'supporting one', meaning: 'injury, need' },
      { object: 'stained glass window', position: 'above', color: 'five pentacles lit', meaning: 'help available' },
      { object: 'church', position: 'beside them', meaning: 'sanctuary ignored' },
      { object: 'snow', position: 'falling', meaning: 'cold, isolation' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'hardship, darkness' },
      { color: 'white', meaning: 'cold, barrenness' },
      { color: 'gold', meaning: 'unnoticed help' }
    ],
    composition: 'passing-sanctuary',
    archetype: 'Suffering Outsider'
  },
  65: { // Six of Pentacles
    symbols: [
      { object: 'merchant', position: 'standing', meaning: 'generosity, power' },
      { object: 'scales', position: 'in left hand', color: 'balanced', meaning: 'fair exchange' },
      { object: 'coins', position: 'given from right hand', meaning: 'charity, sharing' },
      { object: 'two beggars', position: 'kneeling', meaning: 'receiving, dependence' },
      { object: 'six pentacles', position: 'on ground', meaning: 'distributed wealth' }
    ],
    dominantColors: [
      { color: 'purple', meaning: 'wealth, generosity' },
      { color: 'red', meaning: 'action, giving' },
      { color: 'gold', meaning: 'prosperity shared' }
    ],
    composition: 'generous-exchange',
    archetype: 'Benevolent Giver'
  },
  66: { // Seven of Pentacles
    symbols: [
      { object: 'farmer', position: 'leaning on hoe', meaning: 'pause, assessment' },
      { object: 'seven pentacles', position: 'on vine', color: 'growing', meaning: 'investment bearing fruit' },
      { object: 'cultivated plants', position: 'foreground', meaning: 'labor, patience' },
      { object: 'contemplative posture', position: 'on figure', meaning: 'evaluation, waiting' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, patience' },
      { color: 'gold', meaning: 'developing rewards' },
      { color: 'brown', meaning: 'earthly effort' }
    ],
    composition: 'patient-cultivator',
    archetype: 'Patient Investor'
  },
  67: { // Eight of Pentacles
    symbols: [
      { object: 'craftsman', position: 'at bench', meaning: 'dedication, skill' },
      { object: 'hammer and chisel', position: 'in hands', meaning: 'focused work' },
      { object: 'eight pentacles', position: 'six completed, one in progress, one waiting', meaning: 'methodical mastery' },
      { object: 'town', position: 'distant', meaning: 'isolation for focus' },
      { object: 'apron', position: 'on figure', meaning: 'practical work' }
    ],
    dominantColors: [
      { color: 'gray', meaning: 'discipline, craft' },
      { color: 'gold', meaning: 'skill developing' },
      { color: 'red', meaning: 'effort, dedication' }
    ],
    composition: 'devoted-artisan',
    archetype: 'Diligent Apprentice'
  },
  68: { // Nine of Pentacles
    symbols: [
      { object: 'elegant figure', position: 'in garden', meaning: 'self-sufficiency, luxury' },
      { object: 'hooded falcon', position: 'on hand', meaning: 'discipline, self-control' },
      { object: 'nine pentacles', position: 'on grapevines', color: 'abundant', meaning: 'earned prosperity' },
      { object: 'manor', position: 'background', meaning: 'established wealth' },
      { object: 'snail', position: 'at base', meaning: 'slow, steady progress' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'achievement, satisfaction' },
      { color: 'green', meaning: 'abundance, nature' },
      { color: 'gold', meaning: 'refined success' }
    ],
    composition: 'self-sufficient-grace',
    archetype: 'Independent Achiever'
  },
  69: { // Ten of Pentacles
    symbols: [
      { object: 'elder', position: 'seated', meaning: 'legacy, wisdom' },
      { object: 'family', position: 'in courtyard', meaning: 'generations, inheritance' },
      { object: 'child', position: 'with dogs', meaning: 'future, innocence' },
      { object: 'ten pentacles', position: 'in Tree of Life pattern', meaning: 'complete manifestation' },
      { object: 'archway', position: 'entrance', meaning: 'established home' },
      { object: 'coat of arms', position: 'on wall', meaning: 'lineage, tradition' }
    ],
    dominantColors: [
      { color: 'gold', meaning: 'wealth, completion' },
      { color: 'red', meaning: 'vitality, family' },
      { color: 'white', meaning: 'purity of legacy' }
    ],
    composition: 'generational-prosperity',
    archetype: 'Legacy Builder'
  },
  70: { // Page of Pentacles
    symbols: [
      { object: 'youth', position: 'standing in field', meaning: 'practical learning' },
      { object: 'pentacle', position: 'held aloft', color: 'gold', meaning: 'new opportunity' },
      { object: 'flowering field', position: 'surrounding', meaning: 'fertile ground' },
      { object: 'mountains', position: 'distant', meaning: 'future goals' },
      { object: 'absorbed gaze', position: 'on pentacle', meaning: 'focus, study' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'growth, potential' },
      { color: 'gold', meaning: 'opportunity, value' },
      { color: 'brown', meaning: 'grounded learning' }
    ],
    composition: 'studious-youth',
    archetype: 'Eager Student'
  },
  71: { // Knight of Pentacles
    symbols: [
      { object: 'armored knight', position: 'on heavy horse', meaning: 'methodical progress' },
      { object: 'pentacle', position: 'held carefully', color: 'gold', meaning: 'cautious responsibility' },
      { object: 'black horse', position: 'standing still', meaning: 'patience, steadiness' },
      { object: 'plowed field', position: 'background', meaning: 'prepared ground' },
      { object: 'solid posture', position: 'on figure', meaning: 'reliability' }
    ],
    dominantColors: [
      { color: 'black', meaning: 'steadiness, solidity' },
      { color: 'green', meaning: 'practical growth' },
      { color: 'gold', meaning: 'valued work' }
    ],
    composition: 'steady-guardian',
    archetype: 'Reliable Worker'
  },
  72: { // Queen of Pentacles
    symbols: [
      { object: 'enthroned queen', position: 'in nature', meaning: 'nurturing abundance' },
      { object: 'pentacle', position: 'gazed upon in lap', color: 'gold', meaning: 'material wisdom' },
      { object: 'rabbit', position: 'at feet', meaning: 'fertility, prosperity' },
      { object: 'roses', position: 'surrounding throne', color: 'red', meaning: 'beauty, sensuality' },
      { object: 'fruit trees', position: 'background', meaning: 'cultivated abundance' },
      { object: 'goat', position: 'on throne', meaning: 'Capricorn, earthly mastery' }
    ],
    dominantColors: [
      { color: 'green', meaning: 'nature, nurturing' },
      { color: 'red', meaning: 'sensual vitality' },
      { color: 'gold', meaning: 'generous prosperity' }
    ],
    composition: 'nurturing-sovereign',
    archetype: 'Abundant Nurturer'
  },
  73: { // King of Pentacles
    symbols: [
      { object: 'enthroned king', position: 'in castle', meaning: 'mastered wealth' },
      { object: 'pentacle', position: 'in right hand', color: 'gold', meaning: 'material success' },
      { object: 'scepter', position: 'in left hand', meaning: 'authority, control' },
      { object: 'bull', position: 'on throne', meaning: 'Taurus, earthly power' },
      { object: 'grapes', position: 'on robe', meaning: 'abundance, luxury' },
      { object: 'castle', position: 'background', meaning: 'established empire' },
      { object: 'roses', position: 'at base', color: 'blooming', meaning: 'cultivated success' }
    ],
    dominantColors: [
      { color: 'purple', meaning: 'wealth, royalty' },
      { color: 'gold', meaning: 'mastered prosperity' },
      { color: 'green', meaning: 'sustained growth' }
    ],
    composition: 'prosperous-sovereign',
    archetype: 'Material Master'
  },

  // WANDS COURT CARDS (74-77)
  74: { // Page of Wands
    symbols: [
      { object: 'youth', position: 'standing alert', meaning: 'enthusiasm, exploration' },
      { object: 'sprouting wand', position: 'held upright', color: 'green leaves', meaning: 'creative potential' },
      { object: 'pyramids', position: 'background', meaning: 'ancient wisdom, adventure' },
      { object: 'salamanders', position: 'on tunic', color: 'orange', meaning: 'fire element, transformation' },
      { object: 'desert', position: 'surrounding', meaning: 'unexplored territory' }
    ],
    dominantColors: [
      { color: 'orange', meaning: 'creative fire' },
      { color: 'yellow', meaning: 'optimism, exploration' },
      { color: 'green', meaning: 'fresh growth' }
    ],
    composition: 'eager-explorer',
    archetype: 'Enthusiastic Messenger'
  },
  75: { // Knight of Wands
    symbols: [
      { object: 'armored knight', position: 'on rearing horse', meaning: 'passionate action' },
      { object: 'sprouting wand', position: 'held aloft', color: 'green', meaning: 'living energy' },
      { object: 'yellow horse', position: 'mid-leap', meaning: 'enthusiasm, speed' },
      { object: 'salamanders', position: 'on armor', color: 'orange', meaning: 'fire spirit' },
      { object: 'pyramids', position: 'distant', meaning: 'questing spirit' },
      { object: 'plume', position: 'on helmet', color: 'red', meaning: 'bold confidence' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'energy, action' },
      { color: 'red', meaning: 'passion, courage' },
      { color: 'orange', meaning: 'creative fire' }
    ],
    composition: 'charging-adventurer',
    archetype: 'Passionate Adventurer'
  },
  76: { // Queen of Wands
    symbols: [
      { object: 'enthroned queen', position: 'confident', meaning: 'creative leadership' },
      { object: 'sprouting wand', position: 'in right hand', color: 'green', meaning: 'living inspiration' },
      { object: 'sunflower', position: 'in left hand', meaning: 'vitality, warmth' },
      { object: 'black cat', position: 'at feet', meaning: 'independence, intuition' },
      { object: 'lions', position: 'on throne', meaning: 'courage, strength' },
      { object: 'pyramids', position: 'background', meaning: 'enduring power' }
    ],
    dominantColors: [
      { color: 'yellow', meaning: 'warmth, vitality' },
      { color: 'orange', meaning: 'creative fire' },
      { color: 'red', meaning: 'passionate leadership' }
    ],
    composition: 'radiant-sovereign',
    archetype: 'Charismatic Leader'
  },
  77: { // King of Wands
    symbols: [
      { object: 'enthroned king', position: 'commanding', meaning: 'visionary leadership' },
      { object: 'sprouting wand', position: 'held firmly', color: 'green leaves', meaning: 'living vision' },
      { object: 'lions', position: 'on throne and at feet', meaning: 'courage, dominance' },
      { object: 'salamanders', position: 'on robe and throne', color: 'orange', meaning: 'fire mastery' },
      { object: 'crown', position: 'on head', color: 'gold', meaning: 'creative authority' },
      { object: 'salamander biting tail', position: 'at base', meaning: 'self-sustaining energy' }
    ],
    dominantColors: [
      { color: 'orange', meaning: 'creative mastery' },
      { color: 'red', meaning: 'bold leadership' },
      { color: 'gold', meaning: 'visionary authority' }
    ],
    composition: 'commanding-sovereign',
    archetype: 'Visionary Entrepreneur'
  }
};

export function getSymbolAnnotation(cardNumber) {
  return SYMBOL_ANNOTATIONS[cardNumber] || null;
}
