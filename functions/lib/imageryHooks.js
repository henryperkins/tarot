import { PIP_NUMEROLOGY, SUIT_THEMES } from './minorMeta.js';

/**
 * Imagery Hooks for Major Arcana
 *
 * Provides visual symbolism and imagery prompts to enrich narrative flow.
 * Each card entry includes:
 * - visual: Key visual elements and symbolism to reference
 * - upright: Imagery interpretation for upright orientation
 * - reversed: Imagery interpretation for reversed orientation
 * - sensory: Sensory language to evoke the card's essence
 *
 * Minor Arcana currently receive suit/rank-aware narrative enrichment via
 * buildMinorSummary() in [`functions/lib/minorMeta.js`](functions/lib/minorMeta.js:1).
 *
 * To reduce Major bias and gently surface Minor context, we add a lightweight
 * imagery layer for Minors focused on:
 * - Court cards: dynamic, character-like imagery prompts
 * - Generic suit-level hooks for pips (Aces–Tens) when needed
 *
 * This uses a conservative, RWS-consistent vocabulary to avoid hallucinations.
 */

export const MINOR_ARCANA_IMAGERY = {
  'Page of Wands': {
    visual: 'Youthful figure holding a sprouting wand in a barren landscape',
    sensory: 'First spark of curiosity, warm breeze of inspiration',
    interpretation: 'Early-stage creative messages, exploring desire with playful courage.'
  },
  'Knight of Wands': {
    visual: 'Rider charging forward on a rearing horse with wand raised',
    sensory: 'Rushing heat, drums of motion, sand kicked up by fast hooves',
    interpretation: 'Bold, impulsive action; pursuing passion quickly and visibly.'
  },
  'Queen of Wands': {
    visual: 'Throne with lions and sunflowers, black cat at her feet',
    sensory: 'Confident warmth, steady firelight, magnetic presence',
    interpretation: 'Confident, charismatic leadership; tending creative fire with assurance.'
  },
  'King of Wands': {
    visual: 'Throne decorated with lions and salamanders, wand flowering',
    sensory: 'Commanding warmth, steady blaze, visionary gaze',
    interpretation: 'Visionary direction and decisive will in creative or entrepreneurial realms.'
  },
  'Page of Cups': {
    visual: 'Youthful figure contemplating a cup with a small fish emerging',
    sensory: 'Soft tide against shore, shy smile, gentle surprise',
    interpretation: 'Tentative emotional openings, messages of the heart, intuitive nudges.'
  },
  'Knight of Cups': {
    visual: 'Armored figure carrying a cup, horse stepping carefully',
    sensory: 'Calm river, invitation in motion, poetic sincerity',
    interpretation: 'Romantic or idealistic pursuit; moving toward emotional or creative offers.'
  },
  'Queen of Cups': {
    visual: 'Throne by the sea, ornate covered cup held with devotion',
    sensory: 'Quiet waves, deep listening, comforting embrace',
    interpretation: 'Emotional depth, empathy, intuitive care; holding space with sensitivity.'
  },
  'King of Cups': {
    visual: 'Throne on the water, waves beneath, cup and scepter balanced',
    sensory: 'Rocking tide, composed breath, storm held kindly',
    interpretation: 'Emotional maturity and steady leadership amid changing feelings.'
  },
  'Page of Swords': {
    visual: 'Youth with raised sword in shifting winds',
    sensory: 'Quick gusts, alert stance, restless thoughts',
    interpretation: 'Curiosity of the mind, questions, watching and learning; messages or ideas emerging.'
  },
  'Knight of Swords': {
    visual: 'Rider charging forward with sword raised, trees bent by wind',
    sensory: 'Cutting wind, urgent hooves, sharp focus',
    interpretation: 'Swift, uncompromising communication or decisions; moving fast on convictions.'
  },
  'Queen of Swords': {
    visual: 'Throne in clear air, sword upright, hand extended',
    sensory: 'Crisp clarity, cool breeze, discerning gaze',
    interpretation: 'Honest insight, boundaries, compassionate but direct truth-telling.'
  },
  'King of Swords': {
    visual: 'Throne high above, sword held with authority',
    sensory: 'Still air before a verdict, precise words, mental order',
    interpretation: 'Strategic thought, clear judgment, accountability through intellect.'
  },
  'Page of Pentacles': {
    visual: 'Youth studying a pentacle in a green field',
    sensory: 'Fresh soil, focused gaze, new sprout',
    interpretation: 'Beginnings in study, work, or health; grounding dreams into first practical steps.'
  },
  'Knight of Pentacles': {
    visual: 'Rider on a still horse, pentacle held steady',
    sensory: 'Slow hoofbeats, patient breath, tilled earth',
    interpretation: 'Steady, methodical progress; diligence, reliability, and follow-through.'
  },
  'Queen of Pentacles': {
    visual: 'Throne amidst vines and wildlife, pentacle cradled',
    sensory: 'Warm hearth, fertile garden, soothing touch',
    interpretation: 'Nurturing practicality; care through tangible support and resourcing.'
  },
  'King of Pentacles': {
    visual: 'Throne adorned with bulls and grapes, city behind',
    sensory: 'Weight of success, rich textures, secure footing',
    interpretation: 'Material mastery; stewardship of resources, legacy, and stability.'
  }
};

export const MINOR_SUIT_IMAGERY = {
  Wands: {
    visual: 'flame, branch, wand, desert heat, campfire glow',
    sensory: 'crackle of fire, rush of momentum, creative spark',
    interpretation: 'Action, will, creativity, desire, initiation.'
  },
  Cups: {
    visual: 'chalice, flowing water, moonlit sea, shared cup',
    sensory: 'cool tides, heart swell, intuitive currents',
    interpretation: 'Emotions, relationships, intuition, care, receptivity.'
  },
  Swords: {
    visual: 'sword, wind, storm clouds, cut of air',
    sensory: 'sharp clarity, mental buzz, cool edge',
    interpretation: 'Mind, truth, decisions, communication, conflict and resolution.'
  },
  Pentacles: {
    visual: 'coin, garden, stone path, roots',
    sensory: 'solid ground, steady heartbeat, tactile focus',
    interpretation: 'Body, work, resources, health, tangible commitments.'
  }
};

const PIP_RANK_VALUES = {
  Ace: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
  Six: 6,
  Seven: 7,
  Eight: 8,
  Nine: 9,
  Ten: 10
};

function buildPipInterpretation(suit, rank) {
  const rankValue = PIP_RANK_VALUES[rank];
  const numerology = rankValue ? PIP_NUMEROLOGY[rankValue] : null;
  const suitTheme = SUIT_THEMES[suit] || `${suit.toLowerCase()} matters`;
  if (!numerology) {
    return `It deepens the ${suit} story through lived experience.`;
  }
  return `It highlights ${numerology} within ${suitTheme}.`;
}

export const MINOR_PIP_IMAGERY = {
  'Ace of Wands': {
    visual: 'Hand emerging from a cloud presenting a sprouting wand above rolling hills and a distant castle',
    sensory: 'Pulse of heat in the palm, scent of resin and fresh growth on the wind',
    interpretation: buildPipInterpretation('Wands', 'Ace')
  },
  'Two of Wands': {
    visual: 'Figure standing on castle battlements holding a globe with two wands anchoring the space',
    sensory: 'Cool stone beneath boots, breeze carrying distant possibilities',
    interpretation: buildPipInterpretation('Wands', 'Two')
  },
  'Three of Wands': {
    visual: 'Cloaked traveler watching ships depart from a cliff beside three rooted wands',
    sensory: 'Salt air rising with anticipation, cloak catching a steady breeze',
    interpretation: buildPipInterpretation('Wands', 'Three')
  },
  'Four of Wands': {
    visual: 'Garland-draped wands forming a ceremonial arch as figures celebrate beyond it',
    sensory: 'Laughter and music in warm air, scent of flowers and festivity',
    interpretation: buildPipInterpretation('Wands', 'Four')
  },
  'Five of Wands': {
    visual: 'Band of youths brandishing wands in spirited but chaotic competition',
    sensory: 'Wooden staffs clacking, breathless shouts, crackle of spirited rivalry',
    interpretation: buildPipInterpretation('Wands', 'Five')
  },
  'Six of Wands': {
    visual: 'Laureled rider on horseback raising a wand while onlookers hold theirs aloft',
    sensory: 'Cheer of the crowd, rhythmic hoofbeats, triumph warming the chest',
    interpretation: buildPipInterpretation('Wands', 'Six')
  },
  'Seven of Wands': {
    visual: 'Guardian braced on a hilltop thrusting a wand against unseen challengers below',
    sensory: 'Adrenaline-quickened breath, gritty soil underfoot, resistance humming in muscles',
    interpretation: buildPipInterpretation('Wands', 'Seven')
  },
  'Eight of Wands': {
    visual: 'Eight wands streak diagonally through clear sky above distant meadows',
    sensory: 'Rush of wind, momentum whistling forward, anticipation crackling',
    interpretation: buildPipInterpretation('Wands', 'Eight')
  },
  'Nine of Wands': {
    visual: 'Bandaged sentinel gripping a wand while eight others stand like a fence behind',
    sensory: 'Muscles aching yet alert, heartbeat steadying, smell of earth after effort',
    interpretation: buildPipInterpretation('Wands', 'Nine')
  },
  'Ten of Wands': {
    visual: 'Figure hunched beneath the weight of ten bundled wands trudging toward town',
    sensory: 'Strain in shoulders, labored breath, warmth of duty despite fatigue',
    interpretation: buildPipInterpretation('Wands', 'Ten')
  },
  'Ace of Cups': {
    visual: 'Hand emerging from a cloud presenting an overflowing chalice crowned by a dove',
    sensory: 'Cool overflow cascading, heart swelling with gentle pulse of grace',
    interpretation: buildPipInterpretation('Cups', 'Ace')
  },
  'Two of Cups': {
    visual: 'Two figures exchange cups beneath a caduceus and lion-headed emblem',
    sensory: 'Soft exchange of vows, shared heartbeat, warmth of mutual recognition',
    interpretation: buildPipInterpretation('Cups', 'Two')
  },
  'Three of Cups': {
    visual: 'Three women dance in a circle, cups raised amid harvest bounty',
    sensory: 'Clinking cups, joyful laughter, scent of ripe fruit and flowers',
    interpretation: buildPipInterpretation('Cups', 'Three')
  },
  'Four of Cups': {
    visual: 'Seated figure beneath a tree contemplates three cups as a fourth is offered by a cloud',
    sensory: 'Still air, muted heartbeat, cool bark pressing against the back during contemplation',
    interpretation: buildPipInterpretation('Cups', 'Four')
  },
  'Five of Cups': {
    visual: 'Cloaked figure mourns over three spilled cups while two remain standing near a river',
    sensory: 'Cold mist clinging to skin, heaviness in the chest, distant rush of water not yet heard',
    interpretation: buildPipInterpretation('Cups', 'Five')
  },
  'Six of Cups': {
    visual: 'Child offers a flower-filled cup to another within a sunlit courtyard',
    sensory: 'Sweet scent of blossoms, gentle laughter, nostalgia like warm sunlight',
    interpretation: buildPipInterpretation('Cups', 'Six')
  },
  'Seven of Cups': {
    visual: 'Silhouetted figure gazes at seven floating cups filled with fantastical visions',
    sensory: 'Dreamlike haze, shimmering possibilities, dizzying mix of desire and uncertainty',
    interpretation: buildPipInterpretation('Cups', 'Seven')
  },
  'Eight of Cups': {
    visual: 'Traveler climbs away from stacked cups under moonlit sky and distant mountains',
    sensory: 'Cool night air, crunch of gravel underfoot, pull of inner longing guiding the step',
    interpretation: buildPipInterpretation('Cups', 'Eight')
  },
  'Nine of Cups': {
    visual: 'Content figure sits before a curved display of nine cups like trophies',
    sensory: 'Satiated sigh, velvety richness, quiet confidence settling in the belly',
    interpretation: buildPipInterpretation('Cups', 'Nine')
  },
  'Ten of Cups': {
    visual: 'Family rejoices beneath a rainbow of cups arching over a pastoral home',
    sensory: 'Children laughing, harmonized heartbeat of loved ones, gentle rain-washed breeze',
    interpretation: buildPipInterpretation('Cups', 'Ten')
  },
  'Ace of Swords': {
    visual: 'Hand from a cloud raises a crowned sword above jagged mountains',
    sensory: 'Cool rush of clarity, ozone in the air, mind snapping into focus',
    interpretation: buildPipInterpretation('Swords', 'Ace')
  },
  'Two of Swords': {
    visual: 'Blindfolded figure sits at the shoreline with crossed swords under a moonlit sky',
    sensory: 'Still night breeze, tension in shoulders, quiet of suspended decision',
    interpretation: buildPipInterpretation('Swords', 'Two')
  },
  'Three of Swords': {
    visual: 'Heart pierced by three swords against a storm-laden, rain-filled sky',
    sensory: 'Sharp sting of heartbreak, chill of rain, echo of thunder inside the chest',
    interpretation: buildPipInterpretation('Swords', 'Three')
  },
  'Four of Swords': {
    visual: 'Knight rests on a tomb within a chapel, swords hanging on the wall and one beneath',
    sensory: 'Sacred silence, slow measured breath, cool stone supporting stillness',
    interpretation: buildPipInterpretation('Swords', 'Four')
  },
  'Five of Swords': {
    visual: 'Figure gathers swords with a sly grin as defeated figures walk away along the beach',
    sensory: 'Salt wind whipping, hollow victory buzzing in ears, footsteps receding on wet sand',
    interpretation: buildPipInterpretation('Swords', 'Five')
  },
  'Six of Swords': {
    visual: 'Boat ferries cloaked figures across calm water with swords standing in the bow',
    sensory: 'Gentle rocking of the boat, soft lapping water, muted conversation of transition',
    interpretation: buildPipInterpretation('Swords', 'Six')
  },
  'Seven of Swords': {
    visual: 'Sneaking figure tiptoes from a camp carrying five swords, two left behind',
    sensory: 'Rustle of tents, quickened pulse, careful feet on dewy grass',
    interpretation: buildPipInterpretation('Swords', 'Seven')
  },
  'Eight of Swords': {
    visual: 'Blindfolded figure stands bound amid eight swords planted in soggy ground',
    sensory: 'Damp chill around ankles, breath shallow, mind searching for the gap in confinement',
    interpretation: buildPipInterpretation('Swords', 'Eight')
  },
  'Nine of Swords': {
    visual: 'Person bolts upright in bed with hands covering their face, nine swords etched on the wall',
    sensory: 'Nightmare echo, rapid heartbeat, darkness pressing against awareness',
    interpretation: buildPipInterpretation('Swords', 'Nine')
  },
  'Ten of Swords': {
    visual: 'First light dawns behind a figure lying prone with ten swords in their back',
    sensory: 'Cold shock of finality, stillness before sunrise, awareness of inevitable ending',
    interpretation: buildPipInterpretation('Swords', 'Ten')
  },
  'Ace of Pentacles': {
    visual: 'Hand extends a pentacle from a cloud above a flowering garden and open archway',
    sensory: 'Fresh earth scent, solid weight of opportunity in the palm, promise of growth',
    interpretation: buildPipInterpretation('Pentacles', 'Ace')
  },
  'Two of Pentacles': {
    visual: 'Figure juggles two pentacles linked by an infinity loop with ships pitching on waves behind',
    sensory: 'Playful sway under shifting ground, salty breeze, balancing heartbeat keeping time',
    interpretation: buildPipInterpretation('Pentacles', 'Two')
  },
  'Three of Pentacles': {
    visual: 'Craftsman discusses cathedral plans with monk and noble as pentacles decorate the arch',
    sensory: 'Chisel tapping stone, collaborative murmurs, dust motes lit by stained glass',
    interpretation: buildPipInterpretation('Pentacles', 'Three')
  },
  'Four of Pentacles': {
    visual: 'Figure sits guarding pentacles with a cityscape beyond',
    sensory: 'Grip tightening around coin, sturdy seat beneath, city hum muted by guarded focus',
    interpretation: buildPipInterpretation('Pentacles', 'Four')
  },
  'Five of Pentacles': {
    visual: 'Two figures hobble through snow past a stained-glass window filled with pentacles',
    sensory: 'Biting cold on skin, crunch of snow, faint glow of sanctuary just out of reach',
    interpretation: buildPipInterpretation('Pentacles', 'Five')
  },
  'Six of Pentacles': {
    visual: 'Merchant balances scales while giving coins to two kneeling figures',
    sensory: 'Clink of coins, warm generosity flowing, gratitude mingling with need',
    interpretation: buildPipInterpretation('Pentacles', 'Six')
  },
  'Seven of Pentacles': {
    visual: 'Gardener pauses to assess pentacles growing on a vine by his side',
    sensory: 'Earth under boots, patient breath, smell of greenery in slow maturation',
    interpretation: buildPipInterpretation('Pentacles', 'Seven')
  },
  'Eight of Pentacles': {
    visual: 'Craftsman carves pentacles along a workbench with a town in the distance',
    sensory: 'Steady rhythm of hammer and chisel, focused gaze, calloused hands warm with effort',
    interpretation: buildPipInterpretation('Pentacles', 'Eight')
  },
  'Nine of Pentacles': {
    visual: 'Elegant figure in a vineyard holds a falcon with pentacles arrayed behind',
    sensory: 'Silk brushing skin, bird\'s steady heartbeat, sunlit abundance settling calmly',
    interpretation: buildPipInterpretation('Pentacles', 'Nine')
  },
  'Ten of Pentacles': {
    visual: 'Generational scene beneath an archway adorned with pentacles, dogs at an elder\'s feet',
    sensory: 'Home\'s hearth-warmth, gentle murmur of family, legacy felt in every touch',
    interpretation: buildPipInterpretation('Pentacles', 'Ten')
  }
};

export const MAJOR_ARCANA_IMAGERY = {
  0: { // The Fool
    visual: "Figure at cliff's edge, white rose in hand, small dog at heels, sun rising behind",
    upright: "Notice the Fool's gaze toward the horizon—an invitation to step forward into the unknown with trust.",
    reversed: "The figure hesitates at the precipice; the leap requires more preparation before the jump.",
    sensory: "Air fresh with possibility, ground firm yet temporary, the moment before flight"
  },

  1: { // The Magician
    visual: "Figure with infinity symbol overhead, tools of all suits laid before them, one hand to heaven, one to earth",
    upright: "See the Magician's tools arrayed—all resources are present; what matters now is focused will.",
    reversed: "The tools remain, but the connecting current wavers; redirect scattered energy inward.",
    sensory: "Electric potential humming, channel opening, the sensation of power seeking direction"
  },

  2: { // The High Priestess
    visual: "Seated figure between pillars, lunar crown, scroll of hidden knowledge, veil behind",
    upright: "Picture the veil behind the High Priestess—what's concealed will reveal itself through intuition, not force.",
    reversed: "The veil thickens; secrets remain hidden, requiring deeper stillness to penetrate.",
    sensory: "Moonlit silence, whispered knowing, the weight of unspoken truth"
  },

  3: { // The Empress
    visual: "Reclining figure in nature, wheat fields, waterfall, Venus symbol on heart shield",
    upright: "Observe the Empress amid abundance—creativity flows when you nurture rather than push.",
    reversed: "The garden needs tending; creative blocks signal a call to self-care first.",
    sensory: "Rich earth, lush growth, the warmth of sunlight on skin, generative overflow"
  },

  4: { // The Emperor
    visual: "Enthroned figure, ram's head armrests, mountains behind, scepter and orb in hand",
    upright: "Note the Emperor's mountain throne—stability comes through structure, leadership through clarity.",
    reversed: "The throne feels rigid; authority becomes tyranny when divorced from compassion.",
    sensory: "Stone solidity, weight of responsibility, the sharp edges of order"
  },

  5: { // The Hierophant
    visual: "Seated spiritual figure, crossed keys, two acolytes, raised hand in blessing",
    upright: "See the Hierophant's blessing hand—tradition and teaching offer a path, not a prison.",
    reversed: "The keys turn inward; spiritual authority comes from personal truth, not inherited dogma.",
    sensory: "Incense smoke, ancient words, the resonance of collective wisdom"
  },

  6: { // The Lovers
    visual: "Two figures beneath an angel, tree of knowledge behind one, tree of life behind the other",
    upright: "Picture the angel's blessing above the Lovers—alignment of values creates sacred union.",
    reversed: "The figures turn slightly away; misalignment requires honest examination before harmony.",
    sensory: "Magnetic pull, vulnerability exposed, the tremor of choice that shapes destiny"
  },

  7: { // The Chariot
    visual: "Armored figure in chariot, two sphinxes (black and white) pulling, city behind, starry canopy above",
    upright: "Notice the Chariot's opposing sphinxes—mastery comes through directing contrary forces as one.",
    reversed: "The sphinxes pull in different directions; regain control by clarifying where you're heading.",
    sensory: "Reins taut, momentum building, the tension of harnessed power"
  },

  8: { // Strength
    visual: "Figure gently closing or opening lion's mouth, infinity symbol overhead, flowers in hair",
    upright: "See the gentle hand on the lion's jaw—true strength is compassionate persuasion, not domination.",
    reversed: "The lion stirs restlessly; inner courage must be reclaimed through self-compassion first.",
    sensory: "Soft power, warm courage, the paradox of gentle mastery"
  },

  9: { // The Hermit
    visual: "Cloaked figure on mountain peak, lantern held high containing six-pointed star, staff in other hand",
    upright: "Picture the Hermit's lantern piercing darkness—solitude illuminates what crowds obscure.",
    reversed: "The light dims from isolation; balance solitude with connection to avoid withdrawal.",
    sensory: "Crystalline silence, focused beam in darkness, the cold clarity of altitude"
  },

  10: { // Wheel of Fortune
    visual: "Great wheel turning, sphinx atop, snake descending, Anubis rising, Hebrew letters and alchemical symbols",
    upright: "Observe the ever-turning Wheel—cycles change; what rises must descend, what falls will rise again.",
    reversed: "The Wheel resists its turn; clinging to the current phase delays inevitable transformation.",
    sensory: "Momentum shifting, the vertigo of change, fate's hand at the wheel"
  },

  11: { // Justice
    visual: "Seated figure, scales in one hand, sword in the other, purple veil behind, pillars flanking",
    upright: "Notice Justice's balanced scales—truth seeks equilibrium, consequences align with actions.",
    reversed: "The scales tip unfairly; accountability is blurred, requiring honest self-examination.",
    sensory: "Sharp clarity, the weight of truth, balance achieved through precision"
  },

  12: { // The Hanged Man
    visual: "Figure suspended by one foot from living tree, halo around head, peaceful expression, other leg crossed",
    upright: "See the Hanged Man's serene face—surrender inverts perspective, revealing what striving conceals.",
    reversed: "Suspended still, but struggling against the pause; resistance prolongs the waiting.",
    sensory: "Stillness that speaks, inverted clarity, the paradox of progress through pause"
  },

  13: { // Death
    visual: "Armored skeleton on white horse, banner with five-petaled rose, sun rising between towers",
    upright: "Picture the sun rising behind Death—endings clear ground for what must be born next.",
    reversed: "The transformation stalls; inner metamorphosis proceeds privately before outer change manifests.",
    sensory: "Finality's clean cut, composting decay into fertile ground, the phoenix moment"
  },

  14: { // Temperance
    visual: "Angelic figure pouring water between cups, one foot on land, one in water, mountain and rising sun behind",
    upright: "Notice Temperance's flowing water—balance is active mixing, not static division.",
    reversed: "The flow disrupts; excess or deficiency calls for recalibration and patience.",
    sensory: "Alchemical blending, fluid adjustment, the art of measured integration"
  },

  15: { // The Devil
    visual: "Horned figure, inverted pentagram, chained naked figures with tails, torch, raised hand",
    upright: "See the loose chains on the Devil's captives—bondage is often chosen; freedom requires owning the key you hold.",
    reversed: "The chains loosen; awareness of patterns begins liberation from shadow attachments.",
    sensory: "Seductive weight, the comfort of familiar bindings, sulfur and shadow"
  },

  16: { // The Tower
    visual: "Lightning strikes crown of tower, figures falling, flaming debris, gray sky",
    upright: "Notice the Tower's lightning—sudden upheaval shatters false structures, clearing space for truth.",
    reversed: "The strike lands internally; transformation proceeds through private revelation rather than external crisis.",
    sensory: "Thunderclap revelation, foundations crumbling, the vertigo of necessary collapse"
  },

  17: { // The Star
    visual: "Naked figure kneeling, pouring water into pool and onto land, large star overhead, seven smaller stars, bird in tree",
    upright: "Picture the Star's flowing water—hope replenishes when you pour yourself into purpose and trust.",
    reversed: "The water hesitates; renew faith by reconnecting to what you truly believe in.",
    sensory: "Luminous hope, cool renewal, the quiet return of faith"
  },

  18: { // The Moon
    visual: "Full moon with face, two towers, dog and wolf howling, crayfish emerging from water, winding path",
    upright: "See the Moon's deceptive path—navigate uncertainty by trusting intuition when clarity is absent.",
    reversed: "Illusions begin to thin; repressed emotions surface, bringing difficult clarity.",
    sensory: "Silver ambiguity, shifting shadows, the howl of primal emotion"
  },

  19: { // The Sun
    visual: "Radiant sun with face, naked child on white horse, sunflowers, red banner, wall behind",
    upright: "Notice the child's unguarded joy on the Sun's horse—authenticity shines when pretense falls away.",
    reversed: "The light feels too bright or not quite reaching; reconnect with simple pleasures to restore vitality.",
    sensory: "Radiant warmth, innocent delight, golden clarity without shadow"
  },

  20: { // Judgement
    visual: "Angel blowing trumpet, naked figures rising from coffins with arms outstretched, mountains and water",
    upright: "Picture Judgement's trumpet call—reckoning invites you to rise to your highest calling, absolved and renewed.",
    reversed: "The call sounds, but you hesitate; inner critic delays answering what you know you must do.",
    sensory: "Clarion summons, resurrection pull, the weight lifting from old shame"
  },

  21: { // The World
    visual: "Dancer with wreath, wands in hands, surrounded by wreath, four fixed signs in corners",
    upright: "See the World's dancing figure within the wreath—completion celebrates wholeness before the next cycle begins.",
    reversed: "The dance slows near the end; closure delays, or shortcuts prevent true integration.",
    sensory: "Harmonious culmination, the satisfaction of full circle, seeds of the next beginning"
  }
};

/**
 * Get imagery hook for a specific card
 */
export function getImageryHook(cardNumber, orientation = 'upright') {
  const imagery = MAJOR_ARCANA_IMAGERY[cardNumber];
  if (!imagery) return null;

  const isReversed = orientation.toLowerCase() === 'reversed';

  return {
    visual: imagery.visual,
    interpretation: isReversed ? imagery.reversed : imagery.upright,
    sensory: imagery.sensory
  };
}

/**
 * Check if a card is a Major Arcana (0-21)
 */
export function isMajorArcana(cardNumber) {
  return cardNumber !== undefined && cardNumber >= 0 && cardNumber <= 21;
}

/**
 * Get elemental sensory imagery based on elemental relationship
 * These metaphors help illustrate dignity dynamics
 */
export const ELEMENTAL_SENSORY = {
  'Fire-Air': {
    relationship: 'supportive',
    imagery: "Picture a spark fanned into flame—this illustrates how these energies amplify each other's potential."
  },
  'Air-Fire': {
    relationship: 'supportive',
    imagery: "Like wind feeding flame, these forces work together to accelerate momentum and spread influence."
  },
  'Water-Earth': {
    relationship: 'supportive',
    imagery: "As rain nourishes soil, these energies combine to create fertile ground for growth and manifestation."
  },
  'Earth-Water': {
    relationship: 'supportive',
    imagery: "Like riverbanks shaping the flow, these elements guide and contain each other constructively."
  },
  'Fire-Water': {
    relationship: 'tension',
    imagery: "Steam rises where fire meets water—this friction creates obscuring mist that requires skillful navigation."
  },
  'Water-Fire': {
    relationship: 'tension',
    imagery: "Water and flame struggle for dominance; integration requires honoring both emotional depth and passionate drive."
  },
  'Air-Earth': {
    relationship: 'tension',
    imagery: "Wind scatters earth, earth dampens flight—these forces must be consciously balanced to avoid stagnation or chaos."
  },
  'Earth-Air': {
    relationship: 'tension',
    imagery: "Like dust devils in desert, grounded stability and airy ideals create productive friction when held together."
  },
  'Fire-Fire': {
    relationship: 'amplified',
    imagery: "Flame meeting flame intensifies to wildfire—this doubled energy demands conscious direction to avoid burnout."
  },
  'Water-Water': {
    relationship: 'amplified',
    imagery: "Depths upon depths—emotional currents run strong and deep, potentially overwhelming without grounding."
  },
  'Air-Air': {
    relationship: 'amplified',
    imagery: "Thought spirals into thought—mental energy accelerates, brilliant yet requiring earthing to manifest."
  },
  'Earth-Earth': {
    relationship: 'amplified',
    imagery: "Foundation upon foundation builds bedrock stability, though too much weight may resist necessary change."
  }
};

/**
 * Get sensory imagery for elemental relationship
 */
export function getElementalImagery(element1, element2) {
  if (!element1 || !element2) return null;

  const key = `${element1}-${element2}`;
  return ELEMENTAL_SENSORY[key] || null;
}

/**
 * Lightweight Minor Arcana imagery hook.
 *
 * Accepts either:
 * - a full card object: { card, suit, rank, orientation }
 * - or compatible fields via input
 *
 * Returns a conservative imagery descriptor or null if no suitable hook exists.
 */
export function getMinorImageryHook(input) {
  if (!input) return null;

  const {
    card,
    suit,
    rank,
    orientation = 'Upright'
  } = input;

  const name = card || (rank && suit ? `${rank} of ${suit}` : null);
  const isReversed = String(orientation).toLowerCase() === 'reversed';
  const isCourt = ['Page', 'Knight', 'Queen', 'King'].includes(rank);

  // Prefer specific court card hooks
  if (name && MINOR_ARCANA_IMAGERY[name]) {
    const entry = MINOR_ARCANA_IMAGERY[name];
    return {
      visual: entry.visual,
      sensory: entry.sensory,
      interpretation:
        entry.interpretation +
        (isReversed
          ? ' Read this as energy turned inward, delayed, or asking for recalibration.'
          : '')
    };
  }

  if (!isCourt && name && MINOR_PIP_IMAGERY[name]) {
    const pipEntry = MINOR_PIP_IMAGERY[name];
    return {
      visual: pipEntry.visual,
      sensory: pipEntry.sensory,
      interpretation:
        pipEntry.interpretation +
        (isReversed
          ? ' When reversed, notice where this flow turns inward or requests recalibration.'
          : '')
    };
  }

  // Fallback: suit-level hook (for pips and any unlisted minors)
  if (suit && MINOR_SUIT_IMAGERY[suit]) {
    const suitHook = MINOR_SUIT_IMAGERY[suit];
    return {
      visual: suitHook.visual,
      sensory: suitHook.sensory,
      interpretation: suitHook.interpretation
    };
  }

  return null;
}
