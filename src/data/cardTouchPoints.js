import { getVectorGestureDetails } from './cardGestureArtwork.js';

/**
 * Hand-placed focal points on the 1909 Rider–Waite–Smith artwork.
 *
 * When a reading describes something drawn on a card ("the lightning", "one
 * pitcher pouring into the pool"), the reading surface casts a soft light on
 * that part of the card. Each point lists the words a reader is likely to use
 * for it, and one or more spots as [x, y, r]: x and r are fractions of the
 * image width, y a fraction of its height.
 *
 * Terms are lowercase. Plurals are derived automatically; prefix a term with
 * "=" to match it exactly as written. `weak` marks a generic point (a figure,
 * a backdrop) that yields when a passage describes more specific details.
 *
 * Kept separate from symbolCoordinates.js: those approximate regions feed the
 * vision pipeline and its training datasets, and must not move with this
 * presentational data.
 */
export const CARD_TOUCH_POINTS = {
  'The Fool': [
    { id: 'sun', terms: ['sun', 'white sun', 'sunlight'], spots: [[0.83, 0.035, 0.1]] },
    { id: 'dog', terms: ['dog', 'white dog', 'little dog', 'hound', 'pup'], spots: [[0.78, 0.705, 0.1]] },
    { id: 'cliff', terms: ['cliff', 'precipice', 'ledge', 'brink', 'cliff edge', 'rocky outcrop'], spots: [[0.33, 0.775, 0.17]] },
    { id: 'white-rose', terms: ['white rose', 'rose', 'flower'], spots: [[0.82, 0.275, 0.055]] },
    { id: 'bundle', terms: ['bundle', 'knapsack', 'satchel', 'sack', 'bag', 'pack'], spots: [[0.665, 0.2, 0.075]] },
    { id: 'staff', terms: ['staff', 'stick', 'pole'], spots: [[0.2, 0.33, 0.05], [0.42, 0.255, 0.05]] },
    { id: 'feather', terms: ['feather', 'plume', 'feathered cap', 'feathered hat', 'red feather'], spots: [[0.57, 0.135, 0.06]] },
    { id: 'mountains', terms: ['mountain', 'peak', 'snowy peak', 'snowcapped peak'], spots: [[0.86, 0.52, 0.1], [0.1, 0.71, 0.08]] },
    { id: 'figure', weak: true, terms: ['figure', 'young man', 'traveler', 'wanderer', 'youth'], spots: [[0.38, 0.42, 0.18]] }
  ],
  'The Magician': [
    { id: 'raised-wand', terms: ['wand', 'raised wand', 'raised arm', 'arm raised', 'upraised arm'], spots: [[0.16, 0.115, 0.075]] },
    { id: 'infinity', terms: ['infinity', 'infinity symbol', 'lemniscate', 'figure eight', 'figure-eight'], spots: [[0.4, 0.19, 0.075]] },
    { id: 'pointing-hand', terms: ['pointing', 'pointing down', 'pointing finger', 'finger', 'points to the ground', 'pointing to the earth'], spots: [[0.75, 0.5, 0.06]] },
    { id: 'table', terms: ['table', 'altar', 'tools', 'four tools', 'workbench'], spots: [[0.3, 0.6, 0.17]] },
    { id: 'cup', terms: ['cup', 'chalice', 'goblet'], spots: [[0.19, 0.52, 0.06]] },
    { id: 'pentacle', terms: ['pentacle', 'coin', 'disk'], spots: [[0.085, 0.575, 0.055]] },
    { id: 'sword', terms: ['sword', 'blade'], spots: [[0.41, 0.57, 0.06]] },
    { id: 'flowers', terms: ['rose', 'lily', 'flower', 'garden', 'garland', 'red roses', 'white lilies'], spots: [[0.5, 0.855, 0.2], [0.8, 0.07, 0.1]] },
    { id: 'figure', weak: true, terms: ['figure', 'robe', 'red robe', 'white tunic', 'headband'], spots: [[0.47, 0.37, 0.17]] }
  ],
  'The High Priestess': [
    { id: 'pillars', terms: ['pillar', 'column', 'black pillar', 'white pillar', 'boaz', 'jachin', '=b and j'], spots: [[0.11, 0.47, 0.11], [0.86, 0.47, 0.1]] },
    { id: 'lunar-crown', terms: ['crown', 'lunar crown', 'horned crown', 'headdress', 'full moon'], spots: [[0.47, 0.265, 0.085]] },
    { id: 'crescent-moon', terms: ['crescent moon', 'crescent', 'moon at her feet', 'moon'], spots: [[0.6, 0.8, 0.1]] },
    { id: 'scroll', terms: ['scroll', 'tora', 'torah'], spots: [[0.44, 0.6, 0.065]] },
    { id: 'veil', terms: ['veil', 'curtain', 'tapestry', 'pomegranate', 'palm'], spots: [[0.3, 0.2, 0.1], [0.64, 0.2, 0.1]] },
    { id: 'cross', terms: ['cross', 'solar cross', 'equal-armed cross'], spots: [[0.47, 0.42, 0.045]] },
    { id: 'figure', weak: true, terms: ['figure', 'woman', 'robe', 'blue robe', 'mantle', 'seated'], spots: [[0.47, 0.55, 0.17]] }
  ],
  'The Empress': [
    { id: 'crown', terms: ['crown', 'crown of stars', 'twelve stars', 'stars', 'starry crown'], spots: [[0.47, 0.13, 0.085]] },
    { id: 'scepter', terms: ['scepter', 'sceptre', 'orb'], spots: [[0.24, 0.165, 0.055]] },
    { id: 'shield', terms: ['shield', 'heart-shaped shield', 'venus symbol', 'venus', 'heart'], spots: [[0.24, 0.635, 0.095]] },
    { id: 'wheat', terms: ['wheat', 'grain', 'corn', 'harvest', 'field', 'crop', 'ripening wheat'], spots: [[0.55, 0.85, 0.25]] },
    { id: 'forest', terms: ['tree', 'forest', 'cypress', 'wood', 'grove'], spots: [[0.82, 0.33, 0.13]] },
    { id: 'waterfall', terms: ['waterfall', 'stream', 'river', 'water'], spots: [[0.93, 0.56, 0.06]] },
    { id: 'cushions', terms: ['cushion', 'throne', 'pillow', 'couch'], spots: [[0.25, 0.47, 0.12]] },
    { id: 'figure', weak: true, terms: ['figure', 'woman', 'gown', 'robe', 'dress', 'pomegranate'], spots: [[0.6, 0.55, 0.18]] }
  ],
  'The Emperor': [
    { id: 'rams-heads', terms: ["ram's head", "=rams' heads", 'ram head', 'ram', "ram's horn"], spots: [[0.15, 0.565, 0.075], [0.8, 0.565, 0.075], [0.2, 0.12, 0.06], [0.8, 0.12, 0.06]] },
    { id: 'ankh', terms: ['ankh', 'scepter', 'sceptre'], spots: [[0.125, 0.29, 0.065], [0.13, 0.43, 0.04]] },
    { id: 'orb', terms: ['orb', 'globe'], spots: [[0.74, 0.47, 0.05]] },
    { id: 'crown', terms: ['crown', 'golden crown'], spots: [[0.47, 0.19, 0.07]] },
    { id: 'beard', terms: ['beard', 'white beard', 'long beard'], spots: [[0.46, 0.3, 0.07]] },
    { id: 'throne', terms: ['throne', 'stone throne', 'stone seat'], spots: [[0.5, 0.11, 0.15], [0.5, 0.86, 0.12]] },
    { id: 'armor', terms: ['armor', 'armour', 'greave', 'armored leg', 'armoured leg'], spots: [[0.53, 0.72, 0.12]] },
    { id: 'mountains', terms: ['mountain', 'barren mountain', 'peak', 'rocky peak'], spots: [[0.07, 0.42, 0.07], [0.9, 0.38, 0.07]] },
    { id: 'figure', weak: true, terms: ['figure', 'robe', 'red robe', 'ruler', 'king', 'old man'], spots: [[0.5, 0.42, 0.18]] }
  ],
  'The Hierophant': [
    { id: 'triple-crown', terms: ['crown', 'triple crown', 'tiara', 'papal crown', 'mitre', 'miter'], spots: [[0.48, 0.14, 0.08]] },
    { id: 'blessing-hand', terms: ['raised hand', 'hand raised', 'blessing', 'benediction', 'two fingers'], spots: [[0.27, 0.165, 0.055]] },
    { id: 'papal-cross', terms: ['staff', 'triple cross', 'papal cross', 'scepter', 'cross'], spots: [[0.77, 0.23, 0.06], [0.74, 0.38, 0.04]] },
    { id: 'keys', terms: ['=keys', 'crossed keys', 'golden keys', 'two keys'], spots: [[0.47, 0.84, 0.065]] },
    { id: 'acolytes', terms: ['acolyte', 'monk', 'follower', 'disciple', 'kneeling figure', 'two figures', 'tonsured'], spots: [[0.15, 0.78, 0.1], [0.83, 0.78, 0.1]] },
    { id: 'pillars', terms: ['pillar', 'column', 'gray pillar', 'grey pillar'], spots: [[0.09, 0.4, 0.08], [0.89, 0.4, 0.08]] },
    { id: 'figure', weak: true, terms: ['figure', 'pope', 'priest', 'robe', 'vestment', 'red robe'], spots: [[0.5, 0.45, 0.17]] }
  ],
  'The Lovers': [
    { id: 'angel', terms: ['angel', 'raphael', 'archangel', 'wing', 'winged figure'], spots: [[0.47, 0.25, 0.15]] },
    { id: 'sun', terms: ['sun', 'blazing sun'], spots: [[0.47, 0.05, 0.12]] },
    { id: 'woman', terms: ['woman', 'eve', 'female figure'], spots: [[0.2, 0.62, 0.12]] },
    { id: 'man', terms: ['man', 'adam', 'male figure'], spots: [[0.73, 0.62, 0.12]] },
    { id: 'couple', terms: ['couple', 'two figures', 'pair', 'lover', 'naked figures', 'nude figures'], spots: [[0.2, 0.62, 0.12], [0.73, 0.62, 0.12]] },
    { id: 'serpent-tree', terms: ['serpent', 'snake', 'tree of knowledge', 'apple', 'apple tree'], spots: [[0.08, 0.56, 0.08]] },
    { id: 'flame-tree', terms: ['tree of life', 'flame', 'flaming tree', 'burning tree'], spots: [[0.9, 0.5, 0.08]] },
    { id: 'mountain', terms: ['mountain', 'peak', 'volcano'], spots: [[0.48, 0.79, 0.12]] },
    { id: 'cloud', terms: ['cloud'], spots: [[0.45, 0.47, 0.12]] }
  ],
  'The Chariot': [
    { id: 'sphinxes', terms: ['sphinx', 'black sphinx', 'white sphinx', 'black and white sphinx'], spots: [[0.22, 0.75, 0.13], [0.72, 0.75, 0.13]] },
    { id: 'charioteer', terms: ['charioteer', 'driver', 'warrior', 'armor', 'armour', 'armored figure', 'figure'], spots: [[0.47, 0.33, 0.15]] },
    { id: 'star-crown', terms: ['crown', 'star crown', 'eight-pointed star', 'laurel'], spots: [[0.47, 0.17, 0.055]] },
    { id: 'canopy', terms: ['canopy', 'starry canopy', 'stars', 'star-spangled canopy'], spots: [[0.5, 0.13, 0.18]] },
    { id: 'wand', terms: ['wand', 'scepter', 'staff', 'rod'], spots: [[0.19, 0.43, 0.05]] },
    { id: 'city', terms: ['city', 'town', 'castle', 'walled city', 'building'], spots: [[0.1, 0.47, 0.08], [0.85, 0.45, 0.08]] },
    { id: 'emblem', terms: ['winged disk', 'winged sun', 'emblem', 'wings', 'shield'], spots: [[0.47, 0.6, 0.065]] },
    { id: 'chariot-body', weak: true, terms: ['chariot', 'cart', 'carriage', 'vehicle'], spots: [[0.5, 0.56, 0.16]] }
  ],
  'Strength': [
    { id: 'lion', terms: ['lion', 'beast', 'mane', 'red lion'], spots: [[0.38, 0.56, 0.12], [0.68, 0.63, 0.15]] },
    { id: 'hands-on-jaw', terms: ['jaw', 'mouth', 'hand', 'gentle touch', 'open hand', "closing the lion's mouth"], spots: [[0.37, 0.49, 0.08]] },
    { id: 'infinity', terms: ['infinity', 'infinity symbol', 'lemniscate', 'figure eight', 'figure-eight'], spots: [[0.15, 0.185, 0.065]] },
    { id: 'garland', terms: ['garland', 'flower', 'wreath', 'chain of flowers', 'rose', 'crown of flowers'], spots: [[0.18, 0.26, 0.07], [0.52, 0.45, 0.07]] },
    { id: 'mountain', terms: ['mountain', 'peak', 'hill'], spots: [[0.12, 0.7, 0.07]] },
    { id: 'woman', weak: true, terms: ['woman', 'maiden', 'figure', 'white robe', 'robe'], spots: [[0.45, 0.35, 0.16]] }
  ],
  'The Hermit': [
    { id: 'lantern', terms: ['lantern', 'lamp', 'six-pointed star', 'star'], spots: [[0.16, 0.22, 0.085]] },
    { id: 'staff', terms: ['staff', 'walking stick', 'stick', 'cane'], spots: [[0.38, 0.35, 0.05], [0.41, 0.58, 0.05], [0.43, 0.8, 0.05]] },
    { id: 'mountain', terms: ['mountain', 'mountaintop', 'peak', 'summit', 'snow', 'snowy peak', 'icy peak'], spots: [[0.3, 0.85, 0.12], [0.72, 0.85, 0.12]] },
    { id: 'beard', terms: ['beard', 'white beard', 'bowed head'], spots: [[0.57, 0.19, 0.065]] },
    { id: 'cloak', weak: true, terms: ['cloak', 'hood', 'hooded figure', 'robe', 'gray cloak', 'grey cloak', 'figure', 'old man'], spots: [[0.62, 0.45, 0.2]] }
  ],
  'Wheel of Fortune': [
    { id: 'wheel', terms: ['wheel', 'great wheel', 'golden wheel', 'rim', 'spoke', 'taro', 'rota'], spots: [[0.475, 0.5, 0.31]] },
    { id: 'sphinx', terms: ['sphinx', 'sword'], spots: [[0.46, 0.19, 0.09]] },
    { id: 'snake', terms: ['snake', 'serpent', 'typhon'], spots: [[0.1, 0.48, 0.05], [0.12, 0.65, 0.05]] },
    { id: 'anubis', terms: ['anubis', 'jackal', 'jackal-headed figure', 'dog-headed figure', 'hermanubis', 'red figure'], spots: [[0.85, 0.6, 0.1]] },
    { id: 'angel', terms: ['angel'], spots: [[0.15, 0.11, 0.1]] },
    { id: 'eagle', terms: ['eagle'], spots: [[0.75, 0.11, 0.1]] },
    { id: 'bull', terms: ['bull', 'ox', 'calf'], spots: [[0.17, 0.83, 0.1]] },
    { id: 'lion', terms: ['lion'], spots: [[0.75, 0.83, 0.1]] },
    { id: 'four-creatures', terms: ['four creatures', 'four winged creatures', 'four figures', 'winged creature', 'evangelist', 'fixed signs', 'reading books'], spots: [[0.15, 0.11, 0.1], [0.75, 0.11, 0.1], [0.17, 0.83, 0.1], [0.75, 0.83, 0.1]] },
    { id: 'clouds', weak: true, terms: ['cloud', 'sky'], spots: [[0.88, 0.3, 0.1], [0.1, 0.3, 0.1]] }
  ],
  'Justice': [
    { id: 'sword', terms: ['sword', 'raised sword', 'upright sword', 'double-edged sword', 'blade'], spots: [[0.15, 0.17, 0.05], [0.15, 0.33, 0.06]] },
    { id: 'scales', terms: ['=scales', 'balance scale', 'pan', 'weighing', 'scales of justice'], spots: [[0.85, 0.58, 0.085]] },
    { id: 'crown', terms: ['crown', 'square jewel'], spots: [[0.47, 0.24, 0.065]] },
    { id: 'pillars', terms: ['pillar', 'column', 'gray pillar', 'grey pillar'], spots: [[0.07, 0.5, 0.07], [0.925, 0.3, 0.06]] },
    { id: 'veil', terms: ['veil', 'curtain', 'purple veil', 'drape'], spots: [[0.47, 0.13, 0.15]] },
    { id: 'foot', terms: ['foot', 'shoe', 'white shoe'], spots: [[0.41, 0.785, 0.045]] },
    { id: 'figure', weak: true, terms: ['figure', 'red robe', 'robe', 'seated figure', 'woman', 'judge'], spots: [[0.47, 0.55, 0.2]] }
  ],
  'The Hanged Man': [
    { id: 'suspended', terms: ['upside down', 'upside-down', 'suspended', 'hanging', 'inverted', 'dangling', 'hanged figure'], spots: [[0.43, 0.5, 0.17]] },
    { id: 'halo', terms: ['halo', 'glowing head', 'radiant head', 'aura', 'nimbus', 'golden halo'], spots: [[0.5, 0.74, 0.09]] },
    { id: 'crossed-leg', terms: ['crossed leg', 'leg', 'bent leg', 'figure four', 'figure-four'], spots: [[0.46, 0.33, 0.12]] },
    { id: 'tied-foot', terms: ['foot', 'rope', 'tied', 'bound foot', 'ankle'], spots: [[0.55, 0.115, 0.06]] },
    { id: 'tree', terms: ['tree', 'tau cross', 't-shaped', 'beam', 'gallows', 'living wood', 'leaves', 'branch'], spots: [[0.22, 0.08, 0.1], [0.78, 0.08, 0.1], [0.46, 0.85, 0.06]] },
    { id: 'figure', weak: true, terms: ['figure', 'man', 'young man'], spots: [[0.43, 0.5, 0.17]] }
  ],
  'Death': [
    { id: 'skeleton', terms: ['skeleton', 'rider', 'armored rider', 'armoured rider', 'knight', 'armor', 'armour', 'skull'], spots: [[0.26, 0.33, 0.14]] },
    { id: 'white-horse', terms: ['white horse', 'horse', 'steed', 'pale horse'], spots: [[0.56, 0.45, 0.19]] },
    { id: 'banner', terms: ['banner', 'flag', 'white rose', 'rose', 'standard', 'black banner'], spots: [[0.66, 0.12, 0.15]] },
    { id: 'rising-sun', terms: ['sun', 'rising sun', 'sunrise', 'two towers', 'tower', 'dawn'], spots: [[0.86, 0.38, 0.08]] },
    { id: 'bishop', terms: ['bishop', 'priest', 'cleric', 'mitre', 'miter', 'pope', 'praying figure'], spots: [[0.8, 0.6, 0.1]] },
    { id: 'fallen-king', terms: ['fallen king', 'king', 'crown', 'fallen figure', 'fallen body'], spots: [[0.25, 0.79, 0.1]] },
    { id: 'child-maiden', terms: ['child', 'maiden', 'young woman', 'kneeling child', 'girl'], spots: [[0.65, 0.8, 0.07], [0.9, 0.78, 0.07]] },
    { id: 'river', terms: ['river', 'boat', 'water'], spots: [[0.15, 0.62, 0.08]] }
  ],
  'Temperance': [
    { id: 'cups', terms: ['cup', 'chalice', 'pouring', 'pours', 'water flowing', 'mixing', 'vessel', 'pour'], spots: [[0.32, 0.5, 0.07], [0.6, 0.38, 0.07], [0.45, 0.44, 0.05]] },
    { id: 'feet', terms: ['foot', 'feet', 'one foot in the water', 'one foot on land', 'foot in the water', "water's edge"], spots: [[0.44, 0.83, 0.06], [0.65, 0.81, 0.06]] },
    { id: 'angel', terms: ['angel', 'archangel', 'michael', 'winged figure', 'wing', 'halo', 'figure'], spots: [[0.47, 0.35, 0.18]] },
    { id: 'pool', terms: ['pool', 'water', 'stream', 'river'], spots: [[0.28, 0.86, 0.15]] },
    { id: 'distant-sun', terms: ['sun', 'rising sun', 'crown', 'golden crown', 'light on the horizon', 'distant sun', 'mountain', 'winding path', 'path to the mountains'], spots: [[0.14, 0.57, 0.08]] },
    { id: 'irises', terms: ['iris', 'yellow flower', 'flower', 'lily'], spots: [[0.75, 0.6, 0.06], [0.68, 0.67, 0.06]] },
    { id: 'triangle', terms: ['triangle', 'square', 'symbol on the chest', 'square and triangle'], spots: [[0.47, 0.29, 0.045]] }
  ],
  'The Devil': [
    { id: 'devil', terms: ['devil', 'baphomet', 'horned figure', 'horn', 'goat', 'goat-headed', 'bat wing', 'wing', 'beast', 'satyr'], spots: [[0.47, 0.3, 0.18]] },
    { id: 'chains', terms: ['chain', 'chained', 'loose chain', 'collar', 'shackle', 'pedestal'], spots: [[0.47, 0.67, 0.14]] },
    { id: 'couple', terms: ['couple', 'two figures', 'man and woman', 'chained figures', 'naked figures', 'pair', 'woman', 'man'], spots: [[0.2, 0.68, 0.1], [0.73, 0.66, 0.1]] },
    { id: 'pentagram', terms: ['pentagram', 'inverted pentagram', 'inverted star', 'star'], spots: [[0.47, 0.09, 0.055]] },
    { id: 'raised-hand', terms: ['raised hand', 'hand raised', 'open palm', 'palm'], spots: [[0.13, 0.24, 0.065]] },
    { id: 'torch', terms: ['torch', 'inverted torch', 'downturned torch'], spots: [[0.88, 0.52, 0.06]] },
    { id: 'tails', terms: ['tail', 'grape', 'flaming tail'], spots: [[0.13, 0.79, 0.05], [0.85, 0.78, 0.05]] }
  ],
  'The Tower': [
    { id: 'lightning', terms: ['lightning', 'lightning bolt', 'bolt of lightning', 'thunderbolt'], spots: [[0.85, 0.08, 0.08], [0.65, 0.135, 0.075]] },
    { id: 'tower', terms: ['tower', 'structure', 'scaffolding', 'stone tower', 'building'], spots: [[0.47, 0.32, 0.12], [0.47, 0.55, 0.12]] },
    { id: 'falling-figures', terms: ['falling figure', 'figure', 'falling', 'people falling', 'falling people', 'tumbling', 'plummeting', 'two figures'], spots: [[0.2, 0.58, 0.12], [0.75, 0.58, 0.11]] },
    { id: 'crown', terms: ['crown', 'falling crown', 'toppled crown'], spots: [[0.25, 0.085, 0.08]] },
    { id: 'flames', terms: ['flame', 'fire', 'burning', 'window', 'blaze'], spots: [[0.42, 0.31, 0.05], [0.53, 0.31, 0.05], [0.62, 0.21, 0.05]] },
    { id: 'sparks', terms: ['spark', 'yod', 'debris', 'falling sparks', 'ember', 'flaming debris'], spots: [[0.1, 0.42, 0.06], [0.88, 0.3, 0.06], [0.82, 0.68, 0.05]] },
    { id: 'rock', weak: true, terms: ['rock', 'crag', 'cliff', 'peak', 'rocky outcrop', 'foundation'], spots: [[0.47, 0.82, 0.18]] },
    { id: 'storm', weak: true, terms: ['cloud', 'storm', 'dark sky', 'night sky'], spots: [[0.15, 0.25, 0.08], [0.8, 0.45, 0.08]] }
  ],
  'The Star': [
    { id: 'great-star', terms: ['large star', 'great star', 'big star', 'eight-pointed star', '=star'], spots: [[0.5, 0.18, 0.18]] },
    { id: 'pitchers', terms: ['pitcher', 'jug', 'vessel', 'pouring', 'pours', 'pour', 'urn', 'ewer'], spots: [[0.23, 0.6, 0.065], [0.85, 0.5, 0.065]] },
    { id: 'pool', terms: ['pool', 'water', 'reservoir', 'pond'], spots: [[0.25, 0.77, 0.18]] },
    { id: 'small-stars', terms: ['smaller star', 'small star', 'seven stars', 'seven smaller stars', 'stars'], spots: [[0.15, 0.09, 0.06], [0.15, 0.2, 0.06], [0.15, 0.4, 0.06], [0.85, 0.09, 0.06], [0.85, 0.21, 0.06], [0.72, 0.31, 0.06]] },
    { id: 'land', terms: ['=the land', 'onto the land', 'ground', 'stream', 'rivulet'], spots: [[0.77, 0.8, 0.12]] },
    { id: 'knee-foot', terms: ['knee', 'foot', 'one foot on the water', 'one knee on land'], spots: [[0.49, 0.71, 0.05], [0.79, 0.66, 0.05]] },
    { id: 'bird', terms: ['bird', 'ibis', 'tree', 'shrub'], spots: [[0.83, 0.28, 0.055], [0.9, 0.37, 0.055]] },
    { id: 'figure', weak: true, terms: ['figure', 'woman', 'maiden', 'kneels', 'kneeling', 'naked figure', 'nude figure'], spots: [[0.6, 0.45, 0.16]] }
  ],
  'The Moon': [
    { id: 'moon', terms: ['moon', 'full moon', 'crescent moon', 'face in the moon', 'moonlight', 'eclipse'], spots: [[0.48, 0.19, 0.22]] },
    { id: 'crayfish', terms: ['crayfish', 'lobster', 'crab', 'crustacean'], spots: [[0.42, 0.8, 0.07]] },
    { id: 'dog', terms: ['dog', 'howling dog', 'domestic dog'], spots: [[0.25, 0.6, 0.1]] },
    { id: 'wolf', terms: ['wolf', 'howling wolf'], spots: [[0.6, 0.6, 0.12]] },
    { id: 'howling', terms: ['howling', 'dog and wolf', 'two animals', 'baying'], spots: [[0.25, 0.6, 0.1], [0.6, 0.6, 0.12]] },
    { id: 'towers', terms: ['tower', 'two towers', 'twin towers'], spots: [[0.1, 0.45, 0.08], [0.87, 0.43, 0.08]] },
    { id: 'path', terms: ['winding path', 'narrow path', 'path', 'path between the towers'], spots: [[0.45, 0.7, 0.06], [0.5, 0.6, 0.05], [0.55, 0.52, 0.05]] },
    { id: 'pool', terms: ['pool', 'water', 'pond', 'lake'], spots: [[0.3, 0.86, 0.1], [0.7, 0.86, 0.1]] },
    { id: 'drops', terms: ['drop', 'dew', 'yod', '=tears', 'falling drops'], spots: [[0.42, 0.45, 0.12]] }
  ],
  'The Sun': [
    { id: 'sun', terms: ['sun', 'radiant sun', 'sun with a face', 'sunlight', 'ray', 'sunbeam'], spots: [[0.48, 0.17, 0.19]] },
    { id: 'child', terms: ['child', 'naked child', 'baby', 'infant', 'toddler', 'boy'], spots: [[0.37, 0.6, 0.12]] },
    { id: 'white-horse', terms: ['white horse', 'horse', 'pony', 'steed'], spots: [[0.73, 0.72, 0.1], [0.42, 0.82, 0.12]] },
    { id: 'banner', terms: ['banner', 'red banner', 'flag'], spots: [[0.85, 0.35, 0.1], [0.85, 0.6, 0.08]] },
    { id: 'sunflowers', terms: ['sunflower'], spots: [[0.22, 0.43, 0.06], [0.36, 0.43, 0.06], [0.92, 0.48, 0.05]] },
    { id: 'feather', terms: ['feather', 'red feather', 'wreath', 'flower crown'], spots: [[0.37, 0.52, 0.045]] },
    { id: 'wall', weak: true, terms: ['wall', 'brick wall', 'garden wall', 'stone wall'], spots: [[0.15, 0.6, 0.08], [0.6, 0.55, 0.07]] }
  ],
  'Judgement': [
    { id: 'trumpet', terms: ['trumpet', 'horn', 'trumpet call', 'clarion', 'blast'], spots: [[0.52, 0.36, 0.06], [0.56, 0.47, 0.065]] },
    { id: 'angel', terms: ['angel', 'gabriel', 'archangel', 'wing', 'winged figure'], spots: [[0.5, 0.18, 0.16]] },
    { id: 'rising-figures', terms: ['rising', 'risen', 'the dead', 'raised arms', 'arms outstretched', 'outstretched arms', 'naked figures', 'family', 'figure', 'man', 'woman', 'child'], spots: [[0.18, 0.66, 0.1], [0.85, 0.63, 0.1], [0.5, 0.77, 0.1], [0.5, 0.6, 0.08]] },
    { id: 'banner', terms: ['banner', 'flag', 'red cross', 'cross'], spots: [[0.3, 0.43, 0.1]] },
    { id: 'coffins', terms: ['coffin', 'tomb', 'grave', 'casket', 'sarcophagus'], spots: [[0.3, 0.86, 0.1], [0.7, 0.86, 0.1]] },
    { id: 'mountains', weak: true, terms: ['mountain', 'snowy peak', 'icy peak', 'sea', 'ocean'], spots: [[0.25, 0.54, 0.08], [0.75, 0.54, 0.08]] }
  ],
  'The World': [
    { id: 'dancer', terms: ['dancer', 'dancing figure', 'dancing', 'floating figure', 'figure', 'woman'], spots: [[0.47, 0.45, 0.15]] },
    { id: 'wreath', terms: ['wreath', 'laurel wreath', 'garland', 'oval wreath', 'laurel', 'ribbon', 'red ribbon'], spots: [[0.13, 0.45, 0.08], [0.82, 0.45, 0.08], [0.46, 0.1, 0.08], [0.46, 0.78, 0.08]] },
    { id: 'wands', terms: ['wand', 'baton', 'two wands', 'rod'], spots: [[0.22, 0.42, 0.055], [0.7, 0.45, 0.055]] },
    { id: 'sash', terms: ['sash', 'scarf', 'veil', 'drape', 'purple sash'], spots: [[0.4, 0.27, 0.06], [0.58, 0.6, 0.06]] },
    { id: 'angel', terms: ['angel', 'human head', "man's face"], spots: [[0.15, 0.06, 0.08]] },
    { id: 'eagle', terms: ['eagle'], spots: [[0.85, 0.06, 0.08]] },
    { id: 'bull', terms: ['bull', 'ox'], spots: [[0.12, 0.78, 0.08]] },
    { id: 'lion', terms: ['lion'], spots: [[0.85, 0.78, 0.09]] },
    { id: 'four-creatures', terms: ['four creatures', 'four figures', 'four corners', 'four heads', 'fixed signs', 'evangelist'], spots: [[0.15, 0.06, 0.08], [0.85, 0.06, 0.08], [0.12, 0.78, 0.08], [0.85, 0.78, 0.09]] }
  ],
  'Ace of Wands': [
    { id: 'wand', terms: ['wand', 'staff', 'branch', 'rod', 'club', 'sprouting wand', 'living wood', 'budding wand'], spots: [[0.43, 0.2, 0.06], [0.42, 0.4, 0.06], [0.41, 0.75, 0.05]] },
    { id: 'hand', terms: ['hand', 'hand from a cloud', 'hand emerging', 'outstretched hand', 'grip', 'fist'], spots: [[0.4, 0.6, 0.12]] },
    { id: 'leaves', terms: ['leaf', 'sprout', 'bud', 'new growth', 'shoot', 'green leaf', 'sprouting'], spots: [[0.38, 0.08, 0.06], [0.3, 0.3, 0.07], [0.52, 0.3, 0.06]] },
    { id: 'cloud', terms: ['cloud'], spots: [[0.72, 0.55, 0.15]] },
    { id: 'castle', terms: ['castle', 'hilltop castle', 'tower', 'hill'], spots: [[0.18, 0.78, 0.07]] },
    { id: 'landscape', weak: true, terms: ['river', 'tree', 'landscape', 'valley'], spots: [[0.75, 0.85, 0.12]] }
  ],
  'Two of Wands': [
    { id: 'globe', terms: ['globe', 'world', 'orb', 'small globe'], spots: [[0.3, 0.41, 0.055]] },
    { id: 'wands', terms: ['wand', 'staff', 'two wands', 'rod'], spots: [[0.2, 0.25, 0.05], [0.2, 0.6, 0.05], [0.77, 0.38, 0.05], [0.77, 0.75, 0.05]] },
    { id: 'battlement', terms: ['battlement', 'parapet', 'castle wall', 'rampart', 'wall', 'castle', 'ledge'], spots: [[0.35, 0.8, 0.1], [0.85, 0.8, 0.08]] },
    { id: 'roses-lilies', terms: ['roses and lilies', 'rose', 'lily', 'emblem', 'cross of roses'], spots: [[0.12, 0.8, 0.07]] },
    { id: 'horizon', terms: ['sea', 'landscape', 'horizon', 'distant hills', 'mountain', 'coast', 'far-off land', 'distant land'], spots: [[0.3, 0.58, 0.1], [0.75, 0.6, 0.12]] },
    { id: 'figure', weak: true, terms: ['figure', 'man', 'merchant', 'lord', 'red cap', 'cloak', 'nobleman'], spots: [[0.55, 0.55, 0.17]] }
  ],
  'Three of Wands': [
    { id: 'sea-ships', terms: ['ship', 'boat', 'sail', 'vessel', 'fleet', 'sea', 'ocean', 'bay', 'golden sea', 'horizon'], spots: [[0.11, 0.82, 0.06], [0.76, 0.8, 0.06]] },
    { id: 'wands', terms: ['wand', 'staff', 'three wands', 'planted wand', 'stave'], spots: [[0.2, 0.35, 0.04], [0.2, 0.7, 0.04], [0.68, 0.35, 0.04], [0.68, 0.75, 0.04], [0.81, 0.3, 0.04], [0.81, 0.65, 0.04]] },
    { id: 'cliff', terms: ['cliff', 'rocky ridge', 'promontory', 'vantage point', 'high ground', 'ridge'], spots: [[0.5, 0.92, 0.15]] },
    { id: 'figure', weak: true, terms: ['figure', 'man', 'merchant', 'back turned', 'from behind', 'cloak', 'robe'], spots: [[0.45, 0.55, 0.18]] }
  ],
  'Four of Wands': [
    { id: 'garland', terms: ['garland', 'wreath', 'canopy', 'chuppah', 'flower', 'festoon', 'arch', 'bower'], spots: [[0.3, 0.3, 0.1], [0.55, 0.32, 0.1], [0.75, 0.3, 0.08]] },
    { id: 'celebrants', terms: ['two figures', 'couple', 'dancer', 'celebrant', 'bouquet', 'raised bouquet', 'women', 'celebrating'], spots: [[0.47, 0.68, 0.07], [0.57, 0.68, 0.07]] },
    { id: 'wands', terms: ['wand', 'four wands', 'staff', 'pole', 'stave'], spots: [[0.17, 0.5, 0.04], [0.3, 0.55, 0.04], [0.7, 0.55, 0.04], [0.83, 0.5, 0.04]] },
    { id: 'castle', terms: ['castle', 'tower', 'manor', 'walls', 'city wall', 'town'], spots: [[0.5, 0.5, 0.08]] },
    { id: 'crowd', terms: ['crowd', 'gathering', 'guests', 'people', 'party', 'revelers'], spots: [[0.18, 0.77, 0.07]] },
    { id: 'bridge', terms: ['bridge'], spots: [[0.85, 0.75, 0.06]] }
  ],
  'Five of Wands': [
    { id: 'youths', terms: ['youth', 'young men', 'five figures', 'boys', 'band of youths', 'fighting', 'skirmish', 'scuffle', 'brawl', 'mock battle', 'sparring', 'figure'], spots: [[0.12, 0.6, 0.08], [0.3, 0.55, 0.08], [0.42, 0.48, 0.07], [0.6, 0.6, 0.08], [0.75, 0.5, 0.08]] },
    { id: 'staves', terms: ['wand', 'staff', 'stave', 'clashing staves', 'crossed staves', 'raised wands', 'stick', 'pole', 'clashing'], spots: [[0.5, 0.38, 0.15], [0.2, 0.2, 0.06], [0.8, 0.2, 0.06]] }
  ],
  'Six of Wands': [
    { id: 'wreath', terms: ['wreath', 'laurel', 'laurel wreath', 'victory wreath', 'crown of laurels'], spots: [[0.6, 0.22, 0.07], [0.44, 0.34, 0.05]] },
    { id: 'rider', terms: ['rider', 'horseman', 'victor', 'hero', 'man on horseback', 'champion', 'figure'], spots: [[0.45, 0.5, 0.15]] },
    { id: 'white-horse', terms: ['white horse', 'horse', 'steed', 'mount', 'caparisoned horse'], spots: [[0.85, 0.58, 0.08], [0.68, 0.72, 0.12]] },
    { id: 'crowd', terms: ['crowd', 'follower', 'supporter', 'people', 'cheering crowd', 'procession', 'onlooker', 'parade'], spots: [[0.1, 0.55, 0.08]] },
    { id: 'wands', terms: ['wand', 'staff', 'six wands', 'raised wands', 'stave'], spots: [[0.12, 0.3, 0.04], [0.22, 0.3, 0.04], [0.5, 0.3, 0.04], [0.67, 0.38, 0.04], [0.82, 0.38, 0.04]] }
  ],
  'Seven of Wands': [
    { id: 'defender', terms: ['figure', 'young man', 'defender', 'defending', 'fighting off', 'holding his ground', 'standing his ground'], spots: [[0.45, 0.45, 0.17]] },
    { id: 'his-wand', terms: ['wand', 'staff', 'raised wand', 'his wand', 'stave'], spots: [[0.3, 0.27, 0.05], [0.5, 0.42, 0.05], [0.75, 0.6, 0.05]] },
    { id: 'six-below', terms: ['six wands', 'attacker', 'opponent', 'challenger', 'wands from below', 'rising wands', 'staves below'], spots: [[0.08, 0.7, 0.05], [0.22, 0.75, 0.05], [0.4, 0.8, 0.05], [0.5, 0.82, 0.05], [0.7, 0.75, 0.05], [0.86, 0.8, 0.05]] },
    { id: 'shoes', terms: ['mismatched shoes', 'shoe', 'boot', 'odd shoes'], spots: [[0.13, 0.9, 0.05], [0.66, 0.88, 0.05]] },
    { id: 'high-ground', weak: true, terms: ['high ground', 'hill', 'cliff', 'ledge', 'vantage point', 'height'], spots: [[0.5, 0.88, 0.15]] }
  ],
  'Eight of Wands': [
    { id: 'flying-wands', terms: ['wand', 'flying wands', 'eight wands', 'staves in flight', 'arrow', 'in flight', 'airborne', 'stave', 'speeding', 'flying'], spots: [[0.3, 0.2, 0.06], [0.6, 0.27, 0.06], [0.3, 0.37, 0.06], [0.6, 0.52, 0.06], [0.35, 0.67, 0.06], [0.75, 0.8, 0.06]] },
    { id: 'landscape', weak: true, terms: ['river', 'hill', 'castle', 'landscape', 'valley', 'countryside'], spots: [[0.18, 0.84, 0.07], [0.5, 0.92, 0.1]] },
    { id: 'sky', weak: true, terms: ['sky', 'clear sky', 'open sky'], spots: [[0.3, 0.06, 0.1]] }
  ],
  'Nine of Wands': [
    { id: 'bandage', terms: ['bandage', 'bandaged head', 'head wound', 'headband', 'wounded head'], spots: [[0.55, 0.28, 0.055]] },
    { id: 'palisade', terms: ['fence', 'palisade', 'barrier', 'row of wands', 'eight wands', 'wall of wands', 'stockade', 'staves behind'], spots: [[0.08, 0.5, 0.05], [0.15, 0.5, 0.05], [0.3, 0.5, 0.05], [0.38, 0.55, 0.05], [0.75, 0.5, 0.05], [0.88, 0.5, 0.05]] },
    { id: 'his-wand', terms: ['wand', 'staff', 'leaning on', 'clutching'], spots: [[0.6, 0.45, 0.05], [0.58, 0.8, 0.04]] },
    { id: 'guard', terms: ['figure', 'man', 'guard', 'wounded', 'weary', 'watchful', 'sentinel', 'tired figure'], spots: [[0.55, 0.55, 0.15]] }
  ],
  'Ten of Wands': [
    { id: 'bundle', terms: ['wand', 'bundle', 'ten wands', 'heavy load', 'load', 'burden', 'armful', 'stave', 'stick'], spots: [[0.55, 0.22, 0.15], [0.65, 0.68, 0.08]] },
    { id: 'bent-figure', terms: ['figure', 'man', 'bent figure', 'hunched', 'bowed', 'stooped', 'struggling', 'carrying', 'laborer', 'bent over'], spots: [[0.5, 0.55, 0.15]] },
    { id: 'town', terms: ['town', 'house', 'village', 'destination', 'building', 'home in the distance'], spots: [[0.85, 0.78, 0.07]] }
  ],
  'Page of Wands': [
    { id: 'wand', terms: ['wand', 'staff', 'sprouting wand', 'stave', 'rod'], spots: [[0.72, 0.15, 0.05], [0.73, 0.45, 0.04], [0.73, 0.75, 0.04]] },
    { id: 'hat', terms: ['hat', 'feather', 'plume', 'red feather', 'cap'], spots: [[0.31, 0.18, 0.07]] },
    { id: 'salamanders', terms: ['salamander', 'lizard', 'tunic'], spots: [[0.45, 0.42, 0.08]] },
    { id: 'desert', terms: ['pyramid', 'desert', 'dune', 'sand', 'barren landscape'], spots: [[0.78, 0.72, 0.08], [0.18, 0.84, 0.1]] },
    { id: 'figure', weak: true, terms: ['figure', 'young man', 'youth', 'messenger'], spots: [[0.48, 0.45, 0.17]] }
  ],
  'Knight of Wands': [
    { id: 'horse', terms: ['horse', 'rearing horse', 'steed', 'chestnut horse', 'mount', 'rearing'], spots: [[0.2, 0.38, 0.09], [0.55, 0.6, 0.15]] },
    { id: 'knight', terms: ['knight', 'rider', 'armor', 'armour', 'helmet', 'warrior'], spots: [[0.62, 0.38, 0.12]] },
    { id: 'wand', terms: ['wand', 'raised wand', 'staff'], spots: [[0.43, 0.15, 0.05], [0.41, 0.3, 0.04]] },
    { id: 'plume', terms: ['plume', 'fiery plume', 'red plume', 'feather', 'crest', 'flame'], spots: [[0.78, 0.18, 0.08]] },
    { id: 'salamanders', terms: ['salamander', 'lizard'], spots: [[0.7, 0.45, 0.08]] },
    { id: 'desert', terms: ['pyramid', 'desert', 'sand'], spots: [[0.18, 0.83, 0.07]] }
  ],
  'Queen of Wands': [
    { id: 'sunflower', terms: ['sunflower', 'flower'], spots: [[0.73, 0.32, 0.07]] },
    { id: 'black-cat', terms: ['cat', 'black cat'], spots: [[0.43, 0.88, 0.06]] },
    { id: 'wand', terms: ['wand', 'staff', 'scepter'], spots: [[0.24, 0.15, 0.05], [0.25, 0.5, 0.04], [0.27, 0.8, 0.04]] },
    { id: 'lions', terms: ['lion', 'lion carving'], spots: [[0.17, 0.62, 0.06], [0.8, 0.62, 0.06], [0.35, 0.08, 0.06], [0.6, 0.08, 0.06]] },
    { id: 'crown', terms: ['crown', 'wreath', 'crown of leaves'], spots: [[0.42, 0.21, 0.05]] },
    { id: 'throne', weak: true, terms: ['throne'], spots: [[0.47, 0.12, 0.17]] },
    { id: 'queen', weak: true, terms: ['queen', 'figure', 'woman', 'robe', 'yellow robe'], spots: [[0.47, 0.5, 0.18]] }
  ],
  'King of Wands': [
    { id: 'wand', terms: ['wand', 'staff', 'scepter', 'flowering wand'], spots: [[0.18, 0.15, 0.05], [0.17, 0.5, 0.04], [0.15, 0.8, 0.04]] },
    { id: 'salamander', terms: ['salamander', 'lizard', 'small lizard'], spots: [[0.68, 0.88, 0.05]] },
    { id: 'crown', terms: ['crown', 'flaming crown', 'fiery crown'], spots: [[0.43, 0.2, 0.06]] },
    { id: 'throne', terms: ['throne', 'lion', 'tapestry', 'emblem', 'throne back'], spots: [[0.72, 0.2, 0.12]] },
    { id: 'king', weak: true, terms: ['king', 'figure', 'man', 'ruler', 'robe', 'red robe'], spots: [[0.5, 0.5, 0.17]] }
  ],
  'Ace of Cups': [
    { id: 'chalice', terms: ['cup', 'chalice', 'grail', 'goblet', 'overflowing cup'], spots: [[0.5, 0.33, 0.12]] },
    { id: 'streams', terms: ['stream', 'streams of water', 'overflowing', 'overflow', 'spilling', 'water', 'droplet', 'drop', 'fountain', 'five streams'], spots: [[0.35, 0.45, 0.05], [0.65, 0.45, 0.05], [0.38, 0.68, 0.05], [0.6, 0.68, 0.05]] },
    { id: 'dove', terms: ['dove', 'white dove', 'bird', 'descending dove'], spots: [[0.5, 0.08, 0.08]] },
    { id: 'wafer', terms: ['wafer', 'host', 'communion wafer', 'cross'], spots: [[0.5, 0.19, 0.045]] },
    { id: 'hand', terms: ['hand', 'hand from a cloud', 'outstretched hand', 'palm', 'open hand', 'offered'], spots: [[0.38, 0.48, 0.1]] },
    { id: 'pond', terms: ['pond', 'lake', 'water lily', 'lily pad', 'lotus', 'pool', 'sea'], spots: [[0.5, 0.86, 0.2]] },
    { id: 'cloud', terms: ['cloud'], spots: [[0.8, 0.45, 0.12]] }
  ],
  'Two of Cups': [
    { id: 'cups', terms: ['cup', 'two cups', 'chalice', 'goblet', 'exchanging cups'], spots: [[0.42, 0.42, 0.06], [0.58, 0.42, 0.06]] },
    { id: 'couple', terms: ['two figures', 'couple', 'pair', 'partners', 'exchanging', 'pledge', 'toast', 'facing each other', 'eye level', 'lover', '=figures'], spots: [[0.3, 0.55, 0.12], [0.75, 0.55, 0.12]] },
    { id: 'lion-head', terms: ['lion', 'lion head', "lion's head", 'winged lion', 'wing', 'chimera'], spots: [[0.5, 0.15, 0.15]] },
    { id: 'caduceus', terms: ['caduceus', 'staff of hermes', 'serpent', 'snake', 'intertwined snakes'], spots: [[0.5, 0.3, 0.06]] },
    { id: 'woman', terms: ['woman', 'maiden', 'laurel wreath', 'wreath'], spots: [[0.3, 0.55, 0.12]] },
    { id: 'man', terms: ['man', 'young man', 'youth', 'garland'], spots: [[0.75, 0.55, 0.12]] },
    { id: 'house', weak: true, terms: ['house', 'hill', 'cottage', 'village'], spots: [[0.62, 0.72, 0.07]] }
  ],
  'Three of Cups': [
    { id: 'raised-cups', terms: ['cup', 'raised cups', 'toast', 'chalice', 'goblet', 'cheers', 'raised'], spots: [[0.3, 0.2, 0.055], [0.48, 0.15, 0.055], [0.62, 0.2, 0.055]] },
    { id: 'dancers', terms: ['women', 'three women', 'dancer', 'friends', 'dancing', 'celebrating', 'sisters', 'maidens', 'figure', 'three figures'], spots: [[0.2, 0.5, 0.12], [0.43, 0.55, 0.14], [0.68, 0.5, 0.12]] },
    { id: 'harvest', terms: ['fruit', 'harvest', 'pumpkin', 'grape', 'gourd', 'flower'], spots: [[0.1, 0.8, 0.07], [0.8, 0.9, 0.07], [0.9, 0.62, 0.05]] }
  ],
  'Four of Cups': [
    { id: 'offered-cup', terms: ['offered cup', 'fourth cup', 'hand from a cloud', 'cloud', 'hand', 'offering', 'proffered cup', 'new cup'], spots: [[0.36, 0.52, 0.08], [0.15, 0.5, 0.07]] },
    { id: 'three-cups', terms: ['three cups', 'cup', 'cups before him', 'row of cups', 'cups on the ground'], spots: [[0.08, 0.86, 0.06], [0.25, 0.86, 0.06], [0.42, 0.86, 0.06]] },
    { id: 'seated-figure', terms: ['figure', 'young man', 'seated figure', 'crossed arms', 'arms crossed', 'folded arms', 'cross-legged', 'sitting', 'brooding', 'sulking'], spots: [[0.67, 0.6, 0.12]] },
    { id: 'tree', terms: ['tree', 'tree trunk', 'shade', 'branch'], spots: [[0.6, 0.25, 0.12]] }
  ],
  'Five of Cups': [
    { id: 'spilled-cups', terms: ['spilled cups', 'overturned cups', 'three cups', 'spilt', 'spilled', 'knocked over', 'fallen cups', 'spilled cup'], spots: [[0.16, 0.82, 0.13]] },
    { id: 'standing-cups', terms: ['two cups', 'standing cups', 'upright cups', 'cups still standing', 'remaining cups', 'two remaining'], spots: [[0.82, 0.74, 0.05], [0.8, 0.87, 0.05]] },
    { id: 'cloaked-figure', terms: ['cloaked figure', 'black cloak', 'cloak', 'mourner', 'grieving', 'head bowed', 'bowed head', 'mourning', 'figure'], spots: [[0.55, 0.55, 0.15]] },
    { id: 'bridge', terms: ['bridge'], spots: [[0.78, 0.66, 0.07]] },
    { id: 'river', terms: ['river', 'stream', 'water'], spots: [[0.22, 0.7, 0.09]] },
    { id: 'castle', terms: ['castle', 'tower', 'house', 'ruin', 'building'], spots: [[0.15, 0.6, 0.07]] }
  ],
  'Six of Cups': [
    { id: 'offered-cup', terms: ['=cup', 'flower-filled cup', 'cup of flowers', 'gift', 'offering', 'handing'], spots: [[0.6, 0.6, 0.075]] },
    { id: 'children', terms: ['child', 'boy', 'girl', 'little one', 'youngster', 'two children'], spots: [[0.42, 0.55, 0.12], [0.8, 0.62, 0.11]] },
    { id: 'cups-row', terms: ['=cups', 'six cups', 'flower', 'white flower', 'star-shaped flower', 'blossom', 'bloom'], spots: [[0.12, 0.88, 0.07], [0.33, 0.88, 0.07], [0.55, 0.88, 0.07], [0.77, 0.88, 0.07]] },
    { id: 'pedestal', terms: ['pedestal', 'stone pillar', 'cup on a pedestal', 'plinth', 'shield', 'saltire'], spots: [[0.2, 0.45, 0.07], [0.2, 0.69, 0.05]] },
    { id: 'guard', terms: ['guard', 'figure walking away', 'walking away', 'sentry'], spots: [[0.06, 0.48, 0.045]] },
    { id: 'courtyard', weak: true, terms: ['courtyard', 'garden', 'cottage', 'house', 'village', 'castle', 'manor', 'old house'], spots: [[0.25, 0.25, 0.1], [0.62, 0.32, 0.1]] }
  ],
  'Seven of Cups': [
    { id: 'head', terms: ['head', 'curly-haired head', 'beautiful face', 'portrait'], spots: [[0.2, 0.15, 0.07]] },
    { id: 'veiled-figure', terms: ['veiled figure', 'shrouded figure', 'glowing figure', 'veil', 'shroud', 'mystery'], spots: [[0.47, 0.17, 0.08]] },
    { id: 'snake', terms: ['snake', 'serpent'], spots: [[0.68, 0.1, 0.06]] },
    { id: 'castle', terms: ['castle', 'tower'], spots: [[0.1, 0.45, 0.06]] },
    { id: 'jewels', terms: ['jewel', 'treasure', 'riches', 'pearl', 'gem'], spots: [[0.38, 0.47, 0.06]] },
    { id: 'wreath', terms: ['wreath', 'laurel wreath', 'victory', 'laurel'], spots: [[0.58, 0.45, 0.06]] },
    { id: 'dragon', terms: ['dragon', 'monster', 'beast'], spots: [[0.8, 0.45, 0.07]] },
    { id: 'skull', terms: ['skull'], spots: [[0.58, 0.53, 0.035]] },
    { id: 'floating-cups', terms: ['seven cups', 'cup', 'floating cups', 'cloud', 'vision', 'option', 'choice', 'fantasy', 'illusion', 'daydream'], spots: [[0.2, 0.25, 0.07], [0.47, 0.3, 0.07], [0.7, 0.2, 0.07], [0.1, 0.58, 0.06], [0.38, 0.58, 0.06], [0.58, 0.6, 0.06]] },
    { id: 'dreamer', terms: ['silhouette', 'shadowy figure', 'dark figure', 'dreamer', 'onlooker', 'gazing', 'figure', 'man'], spots: [[0.25, 0.8, 0.15]] }
  ],
  'Eight of Cups': [
    { id: 'departing-figure', terms: ['walking away', 'leaving', 'departing', 'traveler', 'wanderer', 'red cloak', 'cloaked figure', 'walking', 'staff', 'pilgrim', 'figure'], spots: [[0.72, 0.6, 0.1]] },
    { id: 'stacked-cups', terms: ['eight cups', 'stacked cups', 'cup', 'row of cups', 'cups left behind', 'stack'], spots: [[0.2, 0.88, 0.07], [0.5, 0.88, 0.07], [0.8, 0.88, 0.07], [0.25, 0.72, 0.06], [0.42, 0.72, 0.06], [0.75, 0.72, 0.06]] },
    { id: 'gap', terms: ['gap', 'missing cup', 'empty space'], spots: [[0.58, 0.72, 0.05]] },
    { id: 'moon', terms: ['moon', 'crescent moon', 'eclipse', 'face in the moon', 'night sky', 'moonlight'], spots: [[0.25, 0.27, 0.08]] },
    { id: 'mountains', terms: ['mountain', 'cliff', 'peak', 'rocky cliff', 'hill'], spots: [[0.22, 0.52, 0.08], [0.82, 0.42, 0.08]] },
    { id: 'river', terms: ['river', 'stream', 'water', 'marsh', 'shore'], spots: [[0.3, 0.63, 0.08]] }
  ],
  'Nine of Cups': [
    { id: 'nine-cups', terms: ['nine cups', 'cup', 'row of cups', 'arc of cups', 'shelf', 'display', 'curved table', 'arrayed'], spots: [[0.1, 0.28, 0.06], [0.25, 0.22, 0.06], [0.4, 0.2, 0.06], [0.6, 0.2, 0.06], [0.75, 0.22, 0.06], [0.9, 0.28, 0.06]] },
    { id: 'seated-man', terms: ['man', 'seated figure', 'arms crossed', 'crossed arms', 'folded arms', 'satisfied', 'smug', 'content', 'self-satisfied', 'merchant', 'red hat', 'figure'], spots: [[0.48, 0.58, 0.17]] },
    { id: 'bench', terms: ['bench', 'seat', 'stool'], spots: [[0.27, 0.72, 0.06], [0.7, 0.72, 0.06]] },
    { id: 'drape', weak: true, terms: ['drape', 'blue cloth', 'tablecloth', 'curtain', 'table'], spots: [[0.12, 0.5, 0.08], [0.88, 0.5, 0.08]] }
  ],
  'Ten of Cups': [
    { id: 'rainbow', terms: ['rainbow', 'arc', 'ten cups', 'cups in the sky', 'cup', 'arch'], spots: [[0.15, 0.32, 0.08], [0.35, 0.15, 0.08], [0.55, 0.13, 0.08], [0.75, 0.15, 0.08], [0.88, 0.3, 0.08]] },
    { id: 'couple', terms: ['couple', 'pair', 'man and woman', 'arms raised', 'raised arms', 'embracing', 'two adults', 'parents', 'partners'], spots: [[0.32, 0.6, 0.1], [0.45, 0.62, 0.1]] },
    { id: 'children', terms: ['child', 'dancing children', 'two children', 'playing', 'dancing'], spots: [[0.76, 0.76, 0.08]] },
    { id: 'house', terms: ['house', 'cottage', 'home', 'homestead'], spots: [[0.68, 0.62, 0.06]] },
    { id: 'landscape', weak: true, terms: ['river', 'stream', 'landscape', 'valley', 'tree', 'green hills'], spots: [[0.15, 0.72, 0.08]] }
  ],
  'Page of Cups': [
    { id: 'fish', terms: ['fish', 'little fish', 'fish in the cup', 'surprise'], spots: [[0.27, 0.27, 0.05]] },
    { id: 'cup', terms: ['cup', 'chalice', 'goblet'], spots: [[0.21, 0.37, 0.08]] },
    { id: 'turban', terms: ['turban', 'hat', 'scarf', 'blue hat', 'headscarf'], spots: [[0.45, 0.18, 0.08]] },
    { id: 'sea', terms: ['sea', 'wave', 'ocean', 'water', 'waves behind'], spots: [[0.2, 0.79, 0.1], [0.8, 0.79, 0.1]] },
    { id: 'figure', weak: true, terms: ['figure', 'young man', 'youth', 'tunic', 'flowered tunic', 'lotus tunic'], spots: [[0.5, 0.52, 0.17]] }
  ],
  'Knight of Cups': [
    { id: 'cup', terms: ['cup', 'chalice', 'offered cup', 'goblet', 'offering', 'holding out'], spots: [[0.6, 0.32, 0.07]] },
    { id: 'winged-helmet', terms: ['winged helmet', 'helmet', 'wing', 'hermes'], spots: [[0.38, 0.17, 0.07]] },
    { id: 'white-horse', terms: ['white horse', 'horse', 'steed', 'grey horse', 'gray horse', 'walking horse', 'mount'], spots: [[0.76, 0.6, 0.09], [0.5, 0.58, 0.14]] },
    { id: 'knight', terms: ['knight', 'rider', 'armor', 'armour', 'messenger', 'figure'], spots: [[0.4, 0.4, 0.13]] },
    { id: 'river', terms: ['river', 'stream', 'water', 'brook'], spots: [[0.6, 0.86, 0.1]] },
    { id: 'fish', terms: ['fish'], spots: [[0.38, 0.45, 0.05]] },
    { id: 'cliffs', weak: true, terms: ['cliff', 'mountain', 'hill', 'tree', 'rocky'], spots: [[0.85, 0.75, 0.08]] }
  ],
  'Queen of Cups': [
    { id: 'covered-cup', terms: ['cup', 'chalice', 'goblet', 'vessel', 'lid', 'lidded', 'closed cup', 'covered cup', 'ornate cup', 'reliquary', 'ciborium', 'angel handles'], spots: [[0.32, 0.36, 0.11]] },
    { id: 'crown', terms: ['crown', 'golden crown', 'diadem'], spots: [[0.51, 0.27, 0.08]] },
    { id: 'queen', terms: ['gaze', 'gazing', 'gazes', 'staring', 'contemplating', 'contemplation', 'woman', 'figure', 'white gown', 'gown', 'robe'], spots: [[0.53, 0.35, 0.06], [0.45, 0.56, 0.13]] },
    { id: 'throne', terms: ['throne', 'carved throne', 'carving', 'cherub', 'mermaid', 'merchild', 'undine', 'water nymph', 'shell', 'scallop'], spots: [[0.66, 0.24, 0.1], [0.52, 0.15, 0.05], [0.81, 0.14, 0.05], [0.76, 0.71, 0.06]] },
    { id: 'sea', terms: ['sea', 'ocean', 'water', 'wave', 'tide'], spots: [[0.1, 0.7, 0.09], [0.92, 0.72, 0.05]] },
    { id: 'shore', terms: ['shore', 'shoreline', 'pebble', 'stony shore', '=stones', 'beach', "water's edge", 'edge of the water', 'edge of the sea'], spots: [[0.3, 0.82, 0.09], [0.65, 0.83, 0.09]] }
  ],
  'King of Cups': [
    { id: 'cup', terms: ['cup', 'chalice', 'goblet'], spots: [[0.4, 0.42, 0.075]] },
    { id: 'scepter', terms: ['scepter', 'sceptre', 'staff', 'rod', 'lotus'], spots: [[0.83, 0.41, 0.06]] },
    { id: 'crown', terms: ['crown'], spots: [[0.53, 0.17, 0.08]] },
    { id: 'amulet', terms: ['amulet', 'pendant', 'necklace', 'fish amulet', 'fish pendant', 'fish-shaped'], spots: [[0.52, 0.33, 0.04]] },
    { id: 'throne', terms: ['throne', 'stone block', 'floating throne', 'stone seat'], spots: [[0.5, 0.8, 0.12], [0.25, 0.27, 0.06], [0.77, 0.28, 0.06]] },
    { id: 'sea', terms: ['sea', 'ocean', 'wave', 'water', 'rough sea', 'churning', 'turbulent', 'stormy sea', 'rough water'], spots: [[0.1, 0.74, 0.08], [0.91, 0.73, 0.06], [0.5, 0.86, 0.07]] },
    { id: 'ship', terms: ['ship', 'boat', 'sail', 'sailing'], spots: [[0.91, 0.59, 0.05]] },
    { id: 'dolphin', terms: ['dolphin', 'fish', 'leaping fish', 'sea creature'], spots: [[0.08, 0.62, 0.045]] },
    { id: 'king', weak: true, terms: ['figure', 'robe', 'blue robe', 'cloak'], spots: [[0.53, 0.24, 0.05], [0.53, 0.55, 0.14]] }
  ],
  'Ace of Swords': [
    { id: 'hand', terms: ['hand', 'fist', 'grip', 'gripping', 'grasp', 'grasping', 'hand from the cloud', 'hand emerging'], spots: [[0.46, 0.66, 0.1]] },
    { id: 'cloud', terms: ['cloud'], spots: [[0.15, 0.45, 0.08], [0.17, 0.63, 0.09]] },
    { id: 'sword', terms: ['sword', 'blade', 'upright sword', 'double-edged', 'hilt', 'crossguard', 'point of the sword'], spots: [[0.49, 0.07, 0.04], [0.49, 0.33, 0.05], [0.48, 0.56, 0.09]] },
    { id: 'crown', terms: ['crown', 'golden crown', 'coronet'], spots: [[0.52, 0.12, 0.1]] },
    { id: 'branches', terms: ['olive branch', 'olive', 'palm', 'palm frond', 'laurel', 'wreath', 'branch', 'garland', 'frond'], spots: [[0.33, 0.2, 0.06], [0.67, 0.24, 0.06]] },
    { id: 'yods', terms: ['yod', '=drops', 'golden drops', 'falling drops', 'droplet'], spots: [[0.35, 0.455, 0.06], [0.64, 0.455, 0.06]] },
    { id: 'mountains', terms: ['mountain', 'peak', 'jagged peaks', 'barren', 'landscape below'], spots: [[0.27, 0.84, 0.08], [0.75, 0.84, 0.08]] }
  ],
  'Two of Swords': [
    { id: 'blindfold', terms: ['blindfold', 'blindfolded', 'eyes covered', 'covered eyes', 'cannot see', 'blind'], spots: [[0.49, 0.375, 0.05]] },
    { id: 'crossed-arms', terms: ['crossed arms', 'arms crossed', 'arms folded', 'folded arms', 'across her chest', 'over her heart'], spots: [[0.49, 0.46, 0.08]] },
    { id: 'swords', terms: ['sword', 'two swords', 'crossed swords', 'blade', 'raised swords', 'heavy swords'], spots: [[0.15, 0.22, 0.05], [0.3, 0.35, 0.05], [0.85, 0.22, 0.05], [0.7, 0.35, 0.05]] },
    { id: 'moon', terms: ['moon', 'crescent', 'crescent moon', 'new moon', 'night sky'], spots: [[0.68, 0.16, 0.05]] },
    { id: 'sea', terms: ['sea', 'water', 'ocean', 'wave', 'tide'], spots: [[0.2, 0.7, 0.08], [0.84, 0.66, 0.07]] },
    { id: 'rocks', terms: ['rock', 'rocky', 'island', 'crag', 'jagged rocks', 'rocks in the water'], spots: [[0.15, 0.565, 0.06], [0.81, 0.535, 0.055]] },
    { id: 'bench', terms: ['bench', 'stone bench', 'seat'], spots: [[0.33, 0.68, 0.05], [0.66, 0.68, 0.05]] },
    { id: 'figure', weak: true, terms: ['woman', 'figure', 'white robe', 'seated figure', 'gown'], spots: [[0.5, 0.62, 0.12]] }
  ],
  'Three of Swords': [
    { id: 'heart', terms: ['heart', 'red heart', 'pierced heart', 'broken heart', 'wounded heart', 'heartbreak', 'heartache'], spots: [[0.48, 0.47, 0.2]] },
    { id: 'swords', terms: ['sword', 'three swords', 'blade', 'pierce', 'pierced', 'piercing', 'stab', 'stabbed', 'run through'], spots: [[0.23, 0.2, 0.05], [0.49, 0.15, 0.05], [0.77, 0.2, 0.05], [0.31, 0.72, 0.04], [0.5, 0.8, 0.04], [0.68, 0.72, 0.04]] },
    { id: 'clouds', terms: ['cloud', 'storm cloud', 'grey sky', 'gray sky', 'overcast'], spots: [[0.13, 0.32, 0.08], [0.88, 0.31, 0.08], [0.42, 0.07, 0.09]] },
    { id: 'rain', terms: ['rain', 'rainfall', 'downpour', 'drizzle', 'storm', 'stormy', '=tears', 'weeping', 'rain-streaked'], spots: [[0.15, 0.62, 0.08], [0.85, 0.62, 0.08], [0.3, 0.88, 0.08], [0.7, 0.88, 0.08]] }
  ],
  'Four of Swords': [
    { id: 'window', terms: ['window', 'stained glass', 'stained-glass', 'church window', 'chapel', 'church', 'sanctuary'], spots: [[0.19, 0.16, 0.15]] },
    { id: 'hanging-swords', terms: ['sword', 'three swords', 'hanging swords', 'swords hang', 'swords hanging', 'suspended swords', 'swords on the wall', 'wall', 'pointing down'], spots: [[0.53, 0.13, 0.05], [0.67, 0.13, 0.05], [0.81, 0.13, 0.05], [0.53, 0.38, 0.035], [0.67, 0.38, 0.035], [0.81, 0.38, 0.035]] },
    { id: 'praying-hands', terms: ['prayer', 'praying', 'hands in prayer', 'folded hands', 'hands together', 'palms together', 'hands pressed', 'clasped hands', 'hands clasped', 'devotion'], spots: [[0.585, 0.57, 0.05]] },
    { id: 'effigy', terms: ['knight', 'effigy', 'figure', 'lying', 'reclining', 'resting', 'at rest', 'sleeping', 'asleep', 'repose', 'recumbent', 'armor', 'armour', 'laid out'], spots: [[0.83, 0.64, 0.06], [0.3, 0.64, 0.09], [0.58, 0.65, 0.07]] },
    { id: 'tomb', terms: ['tomb', 'sarcophagus', 'bier', 'coffin', 'crypt', 'catafalque', 'slab', 'stone tomb'], spots: [[0.25, 0.77, 0.1], [0.72, 0.77, 0.1]] },
    { id: 'lower-sword', terms: ['fourth sword', 'single sword', 'lone sword', 'one sword', 'sword beneath', 'sword below', 'sword along', 'carved sword'], spots: [[0.4, 0.875, 0.05], [0.78, 0.86, 0.05]] }
  ],
  'Five of Swords': [
    { id: 'victor', terms: ['smirk', 'smirking', 'grin', 'grinning', 'victor', 'winner', 'gloating', 'gloat', 'triumphant', 'foreground', 'red hair', 'green tunic', '=man', 'glance back', 'glances back', 'looking back', 'over his shoulder'], spots: [[0.57, 0.34, 0.06], [0.65, 0.6, 0.13]] },
    { id: 'gathered-swords', terms: ['sword', 'three swords', 'gathered swords', 'collected swords', 'armful', 'swords in his arms', 'holding swords', 'spoils', 'gathers up', 'collects'], spots: [[0.76, 0.28, 0.045], [0.72, 0.42, 0.045], [0.66, 0.58, 0.06], [0.42, 0.66, 0.05], [0.5, 0.86, 0.04]] },
    { id: 'fallen-swords', terms: ['two swords', 'fallen swords', 'swords on the ground', 'on the ground', 'discarded', 'abandoned swords', 'abandoned', 'dropped swords', 'dropped', 'left behind', 'ground'], spots: [[0.15, 0.94, 0.06], [0.45, 0.9, 0.05]] },
    { id: 'walking-away', terms: ['walking away', 'walk away', 'walks away', 'two figures', '=figures', '=men', 'retreating', 'retreat', 'defeated', 'backs turned', 'turned away', 'head bowed', 'departing', 'loser'], spots: [[0.14, 0.73, 0.08], [0.36, 0.76, 0.05]] },
    { id: 'clouds', weak: true, terms: ['cloud', 'jagged clouds', 'torn clouds', 'wind', 'windswept', 'sky', 'stormy sky', 'storm'], spots: [[0.3, 0.3, 0.09], [0.7, 0.12, 0.09]] },
    { id: 'water', weak: true, terms: ['water', 'sea', 'lake', 'shore', 'shoreline'], spots: [[0.28, 0.7, 0.05], [0.9, 0.73, 0.05]] }
  ],
  'Six of Swords': [
    { id: 'ferryman', terms: ['ferryman', 'boatman', 'man', 'punting', 'punt', 'poling', 'steering', 'rower'], spots: [[0.33, 0.42, 0.06], [0.3, 0.6, 0.09]] },
    { id: 'pole', terms: ['pole', 'punt pole', 'long pole', 'oar', 'staff'], spots: [[0.26, 0.18, 0.04], [0.5, 0.88, 0.04]] },
    { id: 'passengers', terms: ['woman', 'child', 'passenger', 'hooded', 'cloaked', 'huddled', 'shrouded', 'bowed head', 'mother', 'draped figure', 'figures in the boat'], spots: [[0.65, 0.63, 0.09], [0.45, 0.68, 0.06]] },
    { id: 'swords', terms: ['sword', 'six swords', 'swords in the boat', 'upright swords', 'blade', 'cargo', 'baggage', 'burden'], spots: [[0.53, 0.45, 0.045], [0.61, 0.45, 0.045], [0.73, 0.43, 0.045], [0.79, 0.38, 0.045], [0.86, 0.38, 0.045], [0.91, 0.38, 0.045]] },
    { id: 'boat', terms: ['boat', 'ferry', 'vessel', 'skiff', 'barge', 'crossing', 'journey across'], spots: [[0.25, 0.85, 0.08], [0.72, 0.82, 0.09]] },
    { id: 'water', terms: ['water', 'river', 'rough water', 'smooth water', 'calm water', 'wave', 'ripple', 'choppy', 'rough'], spots: [[0.84, 0.93, 0.06], [0.12, 0.95, 0.05]] },
    { id: 'far-shore', terms: ['far shore', 'distant shore', 'other shore', 'opposite shore', 'other side', 'far bank', 'tree', 'horizon', 'destination'], spots: [[0.11, 0.35, 0.06], [0.62, 0.35, 0.05]] }
  ],
  'Seven of Swords': [
    { id: 'thief', terms: ['man', 'figure', 'thief', 'sneaking', 'sneak', 'tiptoe', 'tiptoeing', 'creeping', 'stealing away', 'furtive', 'stealthy', 'glancing back', 'glances back', 'looking back', 'over his shoulder', 'grin', 'smirk', 'red hat', 'fez'], spots: [[0.55, 0.34, 0.06], [0.39, 0.56, 0.12]] },
    { id: 'carried-swords', terms: ['sword', 'five swords', 'armful', 'bundle', 'stolen swords', 'carrying swords', 'carries', 'carrying', 'blade', 'making off'], spots: [[0.32, 0.29, 0.05], [0.72, 0.28, 0.07], [0.45, 0.42, 0.06], [0.17, 0.6, 0.05]] },
    { id: 'left-swords', terms: ['two swords', 'left behind', 'swords left', 'remaining swords', 'stuck in the ground', 'planted', 'two remain', 'remain behind'], spots: [[0.69, 0.44, 0.045], [0.8, 0.42, 0.045], [0.69, 0.68, 0.035], [0.8, 0.68, 0.035]] },
    { id: 'camp', terms: ['camp', 'tent', 'military camp', 'encampment', 'pavilion', 'soldier', 'flag', 'banner', 'army'], spots: [[0.86, 0.72, 0.08], [0.89, 0.6, 0.04], [0.08, 0.69, 0.04]] }
  ],
  'Eight of Swords': [
    { id: 'blindfold', terms: ['blindfold', 'blindfolded', 'eyes covered', 'covered eyes', 'cannot see', "can't see", 'blind'], spots: [[0.365, 0.275, 0.05]] },
    { id: 'bindings', terms: ['binding', 'arms bound', 'bound figure', 'loosely bound', 'is bound', 'bound and blindfolded', 'tied', 'rope', 'cord', 'bandage', 'trapped', 'restrained', 'tethered'], spots: [[0.39, 0.47, 0.11]] },
    { id: 'swords', terms: ['sword', 'eight swords', 'ring of swords', 'fence of swords', 'surrounding swords', 'circle of swords', 'planted swords', 'fence', 'cage', 'prison', 'blade'], spots: [[0.1, 0.44, 0.05], [0.18, 0.34, 0.06], [0.56, 0.33, 0.05], [0.66, 0.32, 0.05], [0.77, 0.31, 0.05], [0.88, 0.33, 0.05]] },
    { id: 'castle', terms: ['castle', 'tower', 'town', 'city', 'distant castle', 'fortress'], spots: [[0.76, 0.49, 0.06]] },
    { id: 'ground', terms: ['water', 'puddle', 'mud', 'muddy', 'marsh', 'marshy', 'pool', 'bog', 'boggy', 'wet ground', 'sodden'], spots: [[0.15, 0.88, 0.08], [0.65, 0.88, 0.08]] },
    { id: 'woman', weak: true, terms: ['woman', 'figure', 'red robe', 'red dress', 'robe'], spots: [[0.41, 0.68, 0.1]] },
    { id: 'cliff', weak: true, terms: ['cliff', 'crag', 'rock', 'rocky'], spots: [[0.68, 0.66, 0.07]] }
  ],
  'Nine of Swords': [
    { id: 'head-in-hands', terms: ['head in hands', 'head in her hands', 'head in his hands', 'head in their hands', 'face in hands', 'face in her hands', 'face in his hands', 'hands over her face', 'hands over his face', 'hands to her face', 'covers her face', 'covers his face', 'covering her face', 'covering his face', 'buried face', 'weeping', 'sobbing', 'despair', 'anguish'], spots: [[0.63, 0.49, 0.06]] },
    { id: 'sleeper', terms: ['figure', 'woman', 'man', 'sitting up', 'sits up', 'bolt upright', 'awake', 'woken', 'wakes', 'waking', 'sleepless', 'nightmare', 'insomnia', 'nightgown', 'nightdress', 'dreamer'], spots: [[0.48, 0.59, 0.1]] },
    { id: 'swords', terms: ['sword', 'nine swords', 'swords on the wall', 'wall of swords', 'hanging swords', 'horizontal swords', 'swords hang', 'blade', 'stacked'], spots: [[0.12, 0.15, 0.05], [0.12, 0.3, 0.05], [0.12, 0.46, 0.05], [0.5, 0.19, 0.05], [0.7, 0.3, 0.05], [0.85, 0.41, 0.05]] },
    { id: 'quilt', terms: ['quilt', 'blanket', 'coverlet', 'bedspread', 'patchwork', 'rose', 'zodiac', 'astrological symbols', 'planetary symbols'], spots: [[0.58, 0.78, 0.1], [0.8, 0.9, 0.08]] },
    { id: 'bed', terms: ['bed', 'bedframe', 'bed frame', 'carved panel', 'carving', 'duel', 'combat', 'engraving', 'mattress', 'pillow'], spots: [[0.18, 0.85, 0.09], [0.18, 0.72, 0.06]] }
  ],
  'Ten of Swords': [
    { id: 'swords', terms: ['sword', 'ten swords', 'swords in his back', 'swords in the back', 'blade', 'pierced', 'impaled', 'stabbed', 'run through', 'pinned'], spots: [[0.1, 0.35, 0.05], [0.27, 0.27, 0.05], [0.41, 0.28, 0.05], [0.59, 0.25, 0.05], [0.73, 0.3, 0.05], [0.85, 0.33, 0.05]] },
    { id: 'figure', terms: ['figure', 'man', 'lying', 'face down', 'face-down', 'prone', 'fallen', 'sprawled', 'corpse'], spots: [[0.6, 0.79, 0.1], [0.82, 0.75, 0.05]] },
    { id: 'hand', terms: ['hand', 'finger', 'gesture', 'blessing', 'benediction', 'two fingers', 'hand raised'], spots: [[0.37, 0.85, 0.05]] },
    { id: 'cloak', terms: ['red cloak', 'cloak', 'red cloth', 'blood', 'red fabric', 'drape'], spots: [[0.2, 0.765, 0.09]] },
    { id: 'dawn', terms: ['dawn', 'sunrise', 'daybreak', 'first light', 'yellow sky', 'golden light', 'horizon', 'light breaking', 'break of day', 'new day', 'golden band', 'brightening'], spots: [[0.15, 0.53, 0.07], [0.88, 0.53, 0.06]] },
    { id: 'sky', weak: true, terms: ['black sky', 'dark sky', 'darkness', 'night sky', 'darkest', 'night'], spots: [[0.25, 0.12, 0.1], [0.75, 0.12, 0.1]] },
    { id: 'water', weak: true, terms: ['water', 'lake', 'calm water', 'still water', 'shore', 'sea', 'mountain', 'hill'], spots: [[0.1, 0.65, 0.05], [0.92, 0.64, 0.04]] }
  ],
  'Page of Swords': [
    { id: 'sword', terms: ['sword', 'raised sword', 'blade', 'upright sword', 'held high', 'hilt', 'brandishing', 'brandishes'], spots: [[0.79, 0.06, 0.04], [0.755, 0.15, 0.045], [0.7, 0.27, 0.06]] },
    { id: 'youth', terms: ['youth', 'young man', 'figure', 'alert', 'vigilant', 'watchful', 'lookout', 'on guard', 'looking over his shoulder', 'glancing', 'glances', 'stance', 'poised', 'tunic'], spots: [[0.46, 0.19, 0.06], [0.5, 0.44, 0.13]] },
    { id: 'wind', terms: ['wind', 'windswept', 'wind-blown', 'windblown', 'gust', 'breeze', 'hair', 'blowing', 'tousled'], spots: [[0.6, 0.17, 0.05]] },
    { id: 'clouds', terms: ['cloud', 'billowing clouds', 'storm clouds', 'cumulus', 'sky'], spots: [[0.3, 0.22, 0.09], [0.83, 0.43, 0.1], [0.2, 0.62, 0.09], [0.72, 0.68, 0.1]] },
    { id: 'birds', terms: ['bird', 'flock', 'birds in flight', 'flying birds'], spots: [[0.3, 0.09, 0.05], [0.45, 0.07, 0.04]] },
    { id: 'ground', weak: true, terms: ['hill', 'hilltop', 'rough ground', 'uneven ground', 'high ground', 'grassy', 'rocky ground', 'terrain', 'landscape'], spots: [[0.35, 0.83, 0.1], [0.75, 0.85, 0.08]] }
  ],
  'Knight of Swords': [
    { id: 'sword', terms: ['sword', 'raised sword', 'blade', 'brandishing', 'brandishes', 'held aloft', 'swinging', 'slashing'], spots: [[0.24, 0.05, 0.04], [0.26, 0.13, 0.045], [0.29, 0.2, 0.05]] },
    { id: 'knight', terms: ['knight', 'rider', 'armor', 'armour', 'helmet', 'visor', 'warrior', 'figure', 'headlong', 'full tilt', 'rushing', 'lunging', 'leaning forward'], spots: [[0.6, 0.24, 0.06], [0.73, 0.42, 0.11]] },
    { id: 'plume', terms: ['plume', 'red plume', 'feather', 'cape', 'red cape', 'streaming', 'flowing cape', 'crest'], spots: [[0.85, 0.16, 0.06], [0.8, 0.255, 0.05]] },
    { id: 'horse', terms: ['horse', 'white horse', 'steed', 'galloping', 'gallop', 'charging', 'full speed', 'mount', 'mane', 'hooves'], spots: [[0.18, 0.46, 0.07], [0.45, 0.62, 0.12]] },
    { id: 'harness', terms: ['butterfly', 'harness', 'bridle', 'tack', 'rein', 'birds on the harness', 'saddle'], spots: [[0.65, 0.55, 0.06]] },
    { id: 'wind', terms: ['wind', 'windswept', 'gale', 'storm', 'stormy', 'bent trees', 'trees bent', 'tree', 'torn clouds', 'cloud', 'sky', 'cypress'], spots: [[0.18, 0.64, 0.07], [0.45, 0.07, 0.06], [0.12, 0.31, 0.06]] }
  ],
  'Queen of Swords': [
    { id: 'sword', terms: ['sword', 'upright sword', 'raised sword', 'blade', 'vertical sword', 'straight sword', 'held upright', 'hilt'], spots: [[0.585, 0.1, 0.04], [0.585, 0.3, 0.045], [0.58, 0.5, 0.06]] },
    { id: 'hand', terms: ['hand', 'open hand', 'raised hand', 'hand raised', 'outstretched hand', 'hand extended', 'palm', 'beckoning', 'gesture'], spots: [[0.7, 0.35, 0.05]] },
    { id: 'crown', terms: ['crown', 'butterfly crown', 'crown of butterflies', 'butterfly'], spots: [[0.31, 0.3, 0.07]] },
    { id: 'queen', terms: ['profile', 'gaze', 'stern', 'woman', 'figure', 'posture', 'tassel', 'cloak', 'robe', 'cloud-patterned cloak'], spots: [[0.365, 0.36, 0.05], [0.47, 0.6, 0.12]] },
    { id: 'throne', terms: ['throne', 'carved throne', 'carving', 'cherub', 'winged head', 'winged face', 'throne arm', 'crescent moon', 'crescent'], spots: [[0.14, 0.42, 0.06], [0.38, 0.65, 0.07], [0.32, 0.83, 0.07]] },
    { id: 'clouds', terms: ['cloud', 'storm clouds', 'gathering clouds', 'cloudbank', 'sky'], spots: [[0.82, 0.58, 0.1], [0.1, 0.63, 0.05]] },
    { id: 'bird', terms: ['bird', 'single bird', 'lone bird', 'solitary bird'], spots: [[0.33, 0.19, 0.04]] }
  ],
  'King of Swords': [
    { id: 'sword', terms: ['sword', 'upright sword', 'blade', 'drawn sword', 'raised sword', 'tilted sword', 'held upright', 'hilt', 'unsheathed'], spots: [[0.265, 0.09, 0.04], [0.31, 0.25, 0.045], [0.37, 0.42, 0.06]] },
    { id: 'crown', terms: ['crown', 'golden crown'], spots: [[0.47, 0.19, 0.07]] },
    { id: 'gaze', terms: ['gaze', 'direct gaze', 'stare', 'staring', 'facing forward', 'facing us', 'faces us', 'looks straight', 'straight ahead', 'stern', 'level gaze', 'head-on', 'frontal'], spots: [[0.47, 0.255, 0.05]] },
    { id: 'throne', terms: ['throne', 'butterfly', 'crescent moon', 'crescent', 'carved throne', 'carving', 'throne back', 'high-backed throne', 'sylph'], spots: [[0.51, 0.09, 0.08], [0.34, 0.17, 0.05], [0.66, 0.17, 0.05]] },
    { id: 'birds', terms: ['bird', 'two birds', 'pair of birds', 'flying birds'], spots: [[0.825, 0.24, 0.04]] },
    { id: 'robe', weak: true, terms: ['robe', 'blue robe', 'cloak', 'figure', 'seated figure', 'sleeves'], spots: [[0.48, 0.6, 0.15]] },
    { id: 'clouds', weak: true, terms: ['cloud', 'sky'], spots: [[0.85, 0.4, 0.08]] },
    { id: 'trees', weak: true, terms: ['tree', 'cypress', 'landscape', 'grass'], spots: [[0.09, 0.71, 0.05], [0.91, 0.7, 0.05]] }
  ],
  'Ace of Pentacles': [
    { id: 'pentacle', terms: ['pentacle', 'coin', 'golden coin', 'gold coin', 'disc', 'disk', 'golden disc', 'pentagram', 'five-pointed star'], spots: [[0.6, 0.31, 0.2]] },
    { id: 'hand', terms: ['hand', 'open hand', 'open palm', 'palm', 'outstretched hand', 'offering', 'held out', 'holds out', 'cupped hand', 'extended hand'], spots: [[0.42, 0.44, 0.07], [0.66, 0.45, 0.08]] },
    { id: 'cloud', terms: ['cloud'], spots: [[0.13, 0.3, 0.08], [0.22, 0.5, 0.09]] },
    { id: 'arch', terms: ['arch', 'archway', 'hedge arch', 'gateway', 'gate', 'opening', 'gap in the hedge', 'doorway', 'mountain', 'distant mountains'], spots: [[0.68, 0.72, 0.07]] },
    { id: 'garden', terms: ['garden', 'lily', 'flower', 'hedge', 'flowering hedge', 'greenery', 'enclosed garden', 'bloom', 'blooming'], spots: [[0.25, 0.76, 0.1], [0.9, 0.77, 0.06]] },
    { id: 'path', terms: ['path', 'pathway', 'road', 'trail', 'walkway', 'way through'], spots: [[0.65, 0.84, 0.05]] }
  ],
  'Two of Pentacles': [
    { id: 'pentacles', terms: ['pentacle', 'coin', 'two coins', 'two pentacles', 'disc', 'juggling', 'juggle', 'juggles', 'balancing', 'balance', 'in each hand', 'both hands'], spots: [[0.15, 0.34, 0.09], [0.77, 0.51, 0.09]] },
    { id: 'lemniscate', terms: ['infinity', 'infinity symbol', 'lemniscate', 'figure eight', 'figure-eight', 'loop', 'ribbon', 'band', 'endless loop', 'cord', 'green band', 'infinite'], spots: [[0.44, 0.45, 0.05], [0.32, 0.31, 0.04], [0.6, 0.42, 0.04]] },
    { id: 'juggler', terms: ['juggler', 'dancer', 'dancing', 'dance', 'young man', 'figure', 'tall hat', 'hat', 'red hat', 'foot', 'one foot', 'on one foot', 'green shoes', 'shoe'], spots: [[0.48, 0.33, 0.05], [0.54, 0.22, 0.05], [0.45, 0.55, 0.11], [0.59, 0.79, 0.04], [0.47, 0.86, 0.045]] },
    { id: 'ships', terms: ['ship', 'boat', 'sail', 'vessel', 'sailing'], spots: [[0.27, 0.755, 0.04], [0.72, 0.715, 0.055]] },
    { id: 'waves', terms: ['wave', 'sea', 'ocean', 'rolling waves', 'high waves', 'choppy', 'swell', 'ups and downs', 'rough seas', 'rising and falling'], spots: [[0.12, 0.775, 0.06], [0.4, 0.78, 0.06], [0.88, 0.775, 0.06]] }
  ],
  'Three of Pentacles': [
    { id: 'pentacles', terms: ['pentacle', 'three pentacles', 'coin', 'disc', 'carved pentacles', 'tracery', 'rose window', 'pentagram'], spots: [[0.47, 0.155, 0.075], [0.375, 0.245, 0.075], [0.58, 0.245, 0.075]] },
    { id: 'arch', terms: ['cathedral', 'church', 'arch', 'gothic arch', 'archway', 'vault', 'vaulted', 'stone arch', 'chapel', 'pillar', 'column', 'architecture', 'stonework', 'monastery', 'abbey'], spots: [[0.2, 0.22, 0.07], [0.78, 0.22, 0.07], [0.48, 0.43, 0.05], [0.47, 0.65, 0.04]] },
    { id: 'mason', terms: ['mason', 'stonemason', 'craftsman', 'craftsperson', 'artisan', 'apprentice', 'worker', 'builder', 'sculptor', 'young man', 'chisel', 'mallet', 'tools'], spots: [[0.17, 0.41, 0.05], [0.19, 0.6, 0.1]] },
    { id: 'bench', terms: ['bench', 'stool', 'scaffold', 'raised bench'], spots: [[0.2, 0.9, 0.08]] },
    { id: 'patrons', terms: ['monk', 'priest', 'hooded figure', 'cloaked figure', 'two figures', '=figures', 'patron', 'nobleman', 'noblewoman', 'architect', 'robed figure', 'observer', 'onlooker', 'jester', 'patterned cloak'], spots: [[0.63, 0.59, 0.05], [0.74, 0.62, 0.05], [0.72, 0.8, 0.09]] },
    { id: 'plans', terms: ['blueprint', 'drawing', 'parchment', 'sketch', 'architectural plans', 'the plans', 'scroll', 'paper', 'design plans'], spots: [[0.52, 0.67, 0.05]] }
  ],
  'Four of Pentacles': [
    { id: 'crown', terms: ['crown', 'pentacle on his head', 'pentacle on his crown', 'on his head', 'atop his head', 'balanced on his head'], spots: [[0.444, 0.327, 0.075], [0.444, 0.39, 0.055]] },
    { id: 'held-pentacle', terms: ['clutching', 'clutches', 'clutched', 'clutch', 'hugging', 'hugs', 'holds tight', 'holding tight', 'arms wrapped', 'grasping', 'gripping', 'tight grip', 'to his chest', 'against his chest', 'chest', 'possessive', 'hoarding', 'hoard', 'holding on', 'hold on', 'hanging on', 'cling', 'clinging'], spots: [[0.472, 0.527, 0.08]] },
    { id: 'feet-pentacles', terms: ['under his feet', 'beneath his feet', 'underfoot', 'foot', 'standing on', 'planted', 'two pentacles beneath'], spots: [[0.293, 0.82, 0.08], [0.569, 0.82, 0.08]] },
    { id: 'pentacles', terms: ['pentacle', 'coin', 'four pentacles', 'four coins', 'disc', 'gold coins'], spots: [[0.444, 0.327, 0.075], [0.472, 0.527, 0.08], [0.293, 0.82, 0.08], [0.569, 0.82, 0.08]] },
    { id: 'figure', terms: ['man', 'figure', 'miser', 'hunched', 'robe', 'cloak', 'red robe', 'dark cloak', 'stare', 'staring', 'guarded', 'rigid'], spots: [[0.444, 0.44, 0.05], [0.47, 0.66, 0.11]] },
    { id: 'city', terms: ['city', 'town', 'building', 'rooftop', 'skyline', 'tower', 'village', 'house'], spots: [[0.13, 0.72, 0.08], [0.82, 0.7, 0.08]] }
  ],
  'Five of Pentacles': [
    { id: 'window', terms: ['window', 'stained glass', 'stained-glass', 'church window', 'lit window', 'glowing window', 'church', 'sanctuary', 'shelter', 'light from the window', 'wall'], spots: [[0.46, 0.2, 0.18]] },
    { id: 'pentacles', terms: ['pentacle', 'coin', 'five pentacles', 'disc', 'pentacles in the window'], spots: [[0.45, 0.1, 0.06], [0.37, 0.19, 0.06], [0.54, 0.19, 0.06], [0.38, 0.29, 0.06], [0.54, 0.29, 0.06]] },
    { id: 'snow', terms: ['snow', 'snowfall', 'falling snow', 'snowstorm', 'blizzard', 'winter', 'cold', 'freezing', 'icy', 'frozen', 'snowy'], spots: [[0.12, 0.3, 0.09], [0.86, 0.3, 0.09], [0.78, 0.84, 0.09]] },
    { id: 'beggar', terms: ['crutch', 'lame', 'limping', 'limp', 'injured', 'bandage', 'bandaged', 'bell', 'leper', 'cripple'], spots: [[0.267, 0.531, 0.05], [0.21, 0.69, 0.1], [0.13, 0.82, 0.045], [0.38, 0.77, 0.045]] },
    { id: 'woman', terms: ['woman', 'shawl', 'hooded', 'huddled', 'wrapped', 'barefoot', 'bare feet', 'rag', 'ragged', 'tattered'], spots: [[0.63, 0.46, 0.05], [0.56, 0.66, 0.11]] },
    { id: 'figures', terms: ['two figures', '=figures', 'beggar', 'destitute', 'outcast', 'trudging', 'walking past', 'passing by', 'pass by', 'struggling figures'], spots: [[0.22, 0.65, 0.12], [0.57, 0.62, 0.12]] }
  ],
  'Six of Pentacles': [
    { id: 'pentacles', terms: ['pentacle', 'coin', 'six pentacles', 'disc'], spots: [[0.15, 0.13, 0.085], [0.47, 0.13, 0.085], [0.8, 0.13, 0.085], [0.145, 0.266, 0.085], [0.8, 0.266, 0.085], [0.145, 0.4, 0.085]] },
    { id: 'merchant', terms: ['merchant', 'benefactor', 'wealthy man', 'rich man', 'man', 'donor', 'giver', 'patron', 'red cloak', 'standing figure'], spots: [[0.535, 0.28, 0.05], [0.51, 0.5, 0.12]] },
    { id: 'scales', terms: ['=scales', 'pair of scales', 'set of scales', 'balance scales', 'balance', 'weighing', 'weighs', 'measuring', 'measured'], spots: [[0.8, 0.44, 0.08]] },
    { id: 'giving', terms: ['falling coins', 'dropping coins', 'coins falling', 'small coins', 'alms', 'giving', 'gives', 'handing out', 'charity', 'donation', 'generosity', 'gift', '=outstretched hand'], spots: [[0.28, 0.55, 0.04], [0.26, 0.62, 0.04]] },
    { id: 'beggars', terms: ['beggar', 'kneeling', 'kneel', 'kneels', 'supplicant', 'two figures', '=figures', 'receiving', 'receiver', 'in need', 'petitioner', 'upturned hands', 'outstretched hands', 'raised hands'], spots: [[0.15, 0.59, 0.05], [0.14, 0.78, 0.08], [0.762, 0.59, 0.05], [0.77, 0.8, 0.09], [0.286, 0.688, 0.035]] },
    { id: 'town', weak: true, terms: ['town', 'castle', 'village', 'building', 'hedge'], spots: [[0.88, 0.65, 0.04], [0.42, 0.74, 0.06]] }
  ],
  'Seven of Pentacles': [
    { id: 'farmer', terms: ['farmer', 'gardener', 'laborer', 'labourer', 'worker', 'young man', 'man', 'figure', 'leaning', 'leans', 'resting', 'pausing', 'pause', 'pauses', 'contemplating', 'gazing', 'looks down', 'surveying', 'surveys'], spots: [[0.51, 0.275, 0.05], [0.64, 0.49, 0.12]] },
    { id: 'hoe', terms: ['hoe', 'staff', 'tool', 'spade', 'rake', 'stick', 'pole', 'leaning on'], spots: [[0.585, 0.335, 0.04], [0.6, 0.6, 0.035], [0.6, 0.85, 0.035]] },
    { id: 'bush-pentacles', terms: ['pentacle', 'coin', 'seven pentacles', 'six pentacles', 'pentacles on the bush', 'fruit', 'ripening', 'ripe'], spots: [[0.164, 0.418, 0.075], [0.3, 0.575, 0.075], [0.164, 0.676, 0.075], [0.415, 0.697, 0.075], [0.37, 0.8, 0.075], [0.14, 0.876, 0.075]] },
    { id: 'seventh-pentacle', terms: ['seventh pentacle', 'single pentacle', 'one pentacle', 'at his feet', 'by his feet', 'on the ground'], spots: [[0.7, 0.889, 0.08]] },
    { id: 'bush', terms: ['bush', 'plant', 'vine', 'shrub', 'foliage', 'leaf', 'crop', 'harvest', 'garden'], spots: [[0.2, 0.45, 0.1], [0.25, 0.75, 0.11]] }
  ],
  'Eight of Pentacles': [
    { id: 'craftsman', terms: ['craftsman', 'craftsperson', 'apprentice', 'artisan', 'young man', 'worker', 'figure', 'bent over'], spots: [[0.478, 0.543, 0.05], [0.38, 0.66, 0.1]] },
    { id: 'tools', terms: ['hammer', 'chisel', 'mallet', 'tool', 'carving', 'carves', 'engraving', 'engraves', 'hammering', 'chiseling', 'chiselling'], spots: [[0.558, 0.6, 0.045], [0.592, 0.712, 0.04]] },
    { id: 'work-pentacle', terms: ['unfinished pentacle', 'pentacle in his lap', 'pentacle he is carving', 'work in progress', 'current pentacle', 'eighth pentacle'], spots: [[0.603, 0.758, 0.07]] },
    { id: 'pentacles', terms: ['pentacle', 'coin', 'eight pentacles', 'finished pentacles', 'row of pentacles', 'column of pentacles', 'on display', 'displayed', 'completed', 'stacked'], spots: [[0.785, 0.118, 0.085], [0.803, 0.248, 0.085], [0.803, 0.392, 0.085], [0.803, 0.516, 0.085], [0.803, 0.66, 0.085], [0.819, 0.843, 0.085]] },
    { id: 'ground-pentacle', terms: ['on the ground', 'at his feet', 'on the floor', 'under the bench', 'beneath the bench', 'fallen pentacle'], spots: [[0.274, 0.915, 0.075]] },
    { id: 'bench', terms: ['bench', 'workbench', 'stool', 'seat', 'workshop'], spots: [[0.25, 0.81, 0.06], [0.72, 0.82, 0.06]] },
    { id: 'town', weak: true, terms: ['town', 'village', 'distant town', 'house', 'city'], spots: [[0.1, 0.72, 0.06]] }
  ],
  'Nine of Pentacles': [
    { id: 'falcon', terms: ['falcon', 'bird', 'hooded falcon', 'hawk', 'bird of prey', 'falconry', 'gloved hand', 'glove', 'perched'], spots: [[0.72, 0.26, 0.06], [0.69, 0.33, 0.035]] },
    { id: 'woman', terms: ['woman', 'lady', 'figure', 'robe', 'gown', 'flowing robe', 'embroidered robe', 'venus symbol', 'red hat', 'hat', 'solitary', 'elegant'], spots: [[0.5, 0.26, 0.05], [0.48, 0.6, 0.14]] },
    { id: 'vines', terms: ['vine', 'grape', 'grapevine', 'vineyard', 'harvest', 'lush', 'garden', 'fruit', 'foliage', 'cluster'], spots: [[0.15, 0.45, 0.1], [0.85, 0.45, 0.1]] },
    { id: 'pentacles', terms: ['pentacle', 'coin', 'nine pentacles', 'disc'], spots: [[0.175, 0.594, 0.07], [0.15, 0.7, 0.1], [0.15, 0.83, 0.1], [0.813, 0.694, 0.07], [0.677, 0.743, 0.07], [0.813, 0.792, 0.07]] },
    { id: 'manor', terms: ['manor', 'house', 'castle', 'home', 'estate', 'building', 'mansion'], spots: [[0.9, 0.34, 0.04]] },
    { id: 'snail', terms: ['snail'], spots: [[0.2, 0.93, 0.03]] },
    { id: 'trees', weak: true, terms: ['tree'], spots: [[0.12, 0.27, 0.06], [0.84, 0.26, 0.06]] }
  ],
  'Ten of Pentacles': [
    { id: 'pentacles', terms: ['pentacle', 'coin', 'ten pentacles', 'disc', 'tree of life', 'sephiroth', 'kabbalistic'], spots: [[0.485, 0.166, 0.085], [0.154, 0.228, 0.085], [0.834, 0.22, 0.085], [0.154, 0.342, 0.085], [0.485, 0.381, 0.085], [0.834, 0.346, 0.085], [0.154, 0.599, 0.085], [0.834, 0.599, 0.085], [0.485, 0.704, 0.085], [0.485, 0.844, 0.085]] },
    { id: 'elder', terms: ['old man', 'elder', 'patriarch', 'grandfather', 'white-haired', 'white hair', 'beard', 'bearded', 'embroidered cloak', 'cloak', 'robe'], spots: [[0.25, 0.525, 0.05], [0.27, 0.65, 0.08]] },
    { id: 'couple', terms: ['couple', 'man and woman', 'husband', 'wife', 'pair', 'lovers', 'partners', 'parents'], spots: [[0.57, 0.46, 0.05], [0.73, 0.46, 0.05], [0.65, 0.58, 0.1]] },
    { id: 'child', terms: ['child', 'little child', 'young child', 'kid', 'girl', 'boy', 'toddler'], spots: [[0.89, 0.68, 0.045]] },
    { id: 'family', terms: ['family', 'three generations', 'generations', 'household', 'family gathered'], spots: [[0.25, 0.525, 0.05], [0.57, 0.46, 0.05], [0.73, 0.46, 0.05], [0.89, 0.68, 0.045]] },
    { id: 'dogs', terms: ['dog', 'hound', 'greyhound', 'white dogs', 'two dogs'], spots: [[0.7, 0.72, 0.06], [0.72, 0.85, 0.07]] },
    { id: 'arch', terms: ['arch', 'archway', 'gateway', 'gate', 'entrance', 'threshold', 'stone arch'], spots: [[0.33, 0.33, 0.05], [0.45, 0.2, 0.05], [0.7, 0.13, 0.05]] },
    { id: 'town', terms: ['tower', 'castle', 'town', 'city', 'building', 'house', 'estate', 'manor', 'home'], spots: [[0.67, 0.33, 0.05], [0.25, 0.22, 0.05]] }
  ],
  'Page of Pentacles': [
    { id: 'pentacle', terms: ['pentacle', 'coin', 'disc', 'held up', 'holding up', 'lifts', 'lifting', 'raised hands', 'both hands', 'cradling', 'cradles'], spots: [[0.63, 0.165, 0.085], [0.64, 0.25, 0.05]] },
    { id: 'gaze', terms: ['gaze', 'gazing', 'staring', 'studying', 'studies', 'examining', 'examines', 'fascinated', 'eyes fixed', 'looking at', 'rapt', 'attentive'], spots: [[0.43, 0.2, 0.05]] },
    { id: 'youth', terms: ['youth', 'young man', 'figure', 'student', 'scholar', 'red hat', 'hat', 'turban', 'chaperon', 'red scarf', 'tunic'], spots: [[0.43, 0.2, 0.05], [0.4, 0.5, 0.13]] },
    { id: 'meadow', terms: ['meadow', 'field', 'flower', 'grass', 'grassy', 'green field', 'wildflower', 'ground'], spots: [[0.3, 0.86, 0.08], [0.6, 0.84, 0.07]] },
    { id: 'furrows', terms: ['plowed field', 'ploughed field', 'furrow', 'tilled', 'farmland', 'cultivated'], spots: [[0.8, 0.82, 0.06]] },
    { id: 'mountain', terms: ['mountain', 'peak', 'hill', 'distant hill'], spots: [[0.74, 0.725, 0.05]] },
    { id: 'trees', weak: true, terms: ['tree', 'grove'], spots: [[0.14, 0.7, 0.06]] }
  ],
  'Knight of Pentacles': [
    { id: 'pentacle', terms: ['pentacle', 'coin', 'disc', 'held out'], spots: [[0.637, 0.268, 0.08]] },
    { id: 'knight', terms: ['knight', 'rider', 'armor', 'armour', 'helmet', 'motionless', 'unmoving', 'stationary', 'standing still', 'gaze', 'gazing', 'contemplating', 'examining', 'studying'], spots: [[0.38, 0.2, 0.06], [0.43, 0.43, 0.1]] },
    { id: 'plume', terms: ['plume', 'green plume', 'sprig', 'oak', 'oak leaves', 'oak leaf', '=leaf', 'greenery'], spots: [[0.21, 0.17, 0.05], [0.853, 0.333, 0.04]] },
    { id: 'horse', terms: ['horse', 'black horse', 'dark horse', 'draft horse', 'draught horse', 'workhorse', 'heavy horse', 'steed', 'mount', 'plow horse', 'plough horse', 'plodding'], spots: [[0.79, 0.4, 0.07], [0.35, 0.52, 0.13], [0.45, 0.8, 0.06]] },
    { id: 'field', terms: ['plowed field', 'ploughed field', 'furrow', 'field', 'tilled field', 'tilled', 'farmland', 'fallow', 'soil', 'landscape'], spots: [[0.15, 0.82, 0.07], [0.82, 0.8, 0.08]] }
  ],
  'Queen of Pentacles': [
    { id: 'pentacle', terms: ['pentacle', 'coin', 'disc', 'in her lap', 'on her lap', 'lap', 'cradling', 'cradles', 'cradled'], spots: [[0.3, 0.445, 0.1]] },
    { id: 'queen', terms: ['woman', 'figure', 'gaze', 'gazing', 'looks down', 'looking down', 'downcast', 'contemplating', 'red robe', 'robe', 'veil', 'green veil'], spots: [[0.38, 0.257, 0.05], [0.37, 0.58, 0.12]] },
    { id: 'crown', terms: ['crown'], spots: [[0.346, 0.205, 0.05]] },
    { id: 'throne', terms: ['throne', 'carved throne', 'carving', 'goat', "goat's head", 'cherub'], spots: [[0.62, 0.22, 0.07], [0.62, 0.36, 0.07], [0.67, 0.64, 0.06]] },
    { id: 'roses', terms: ['rose', 'bower', 'rose bower', 'arbor', 'arbour', 'canopy', 'trellis', 'flowers overhead', 'garland', 'bloom'], spots: [[0.25, 0.06, 0.08], [0.7, 0.05, 0.08], [0.88, 0.3, 0.05]] },
    { id: 'rabbit', terms: ['rabbit', 'hare', 'bunny'], spots: [[0.79, 0.81, 0.045]] },
    { id: 'garden', terms: ['garden', 'flower', 'fertile', 'lush', 'greenery', 'meadow', 'fruit', 'vegetation', 'ground'], spots: [[0.08, 0.62, 0.07], [0.3, 0.8, 0.08]] },
    { id: 'mountains', weak: true, terms: ['mountain', 'distant mountains', 'hill', 'landscape'], spots: [[0.12, 0.47, 0.05]] }
  ],
  'King of Pentacles': [
    { id: 'pentacle', terms: ['pentacle', 'coin', 'disc', 'on his knee', 'resting on his knee'], spots: [[0.671, 0.466, 0.1]] },
    { id: 'scepter', terms: ['scepter', 'sceptre', 'orb', 'golden orb', 'staff', 'rod'], spots: [[0.256, 0.39, 0.045], [0.29, 0.52, 0.03]] },
    { id: 'crown', terms: ['crown', 'wreath', 'crown of leaves', 'floral crown'], spots: [[0.551, 0.194, 0.07]] },
    { id: 'king', terms: ['eyes closed', 'half-closed eyes', 'serene', 'contented', 'satisfied', 'at ease', 'red hood', 'red scarf', 'figure'], spots: [[0.535, 0.264, 0.05]] },
    { id: 'robe', terms: ['robe', 'grape', 'grape-patterned', 'grapes on his robe', 'embroidered', 'cloak', 'vine', 'grapevine', 'vineyard'], spots: [[0.55, 0.6, 0.15], [0.1, 0.45, 0.06]] },
    { id: 'throne', terms: ['throne', 'bull', "bull's head", 'horns', 'carved throne', 'carving'], spots: [[0.28, 0.18, 0.05], [0.76, 0.18, 0.05], [0.2, 0.62, 0.05]] },
    { id: 'castle', terms: ['castle', 'tower', 'fortress', 'estate', 'manor', 'home', 'walls'], spots: [[0.84, 0.32, 0.07]] },
    { id: 'armor', terms: ['armor', 'armour', 'armored foot', 'armoured foot', 'boot', 'foot', 'sabaton'], spots: [[0.75, 0.72, 0.045]] },
    { id: 'garden', terms: ['garden', 'flower', 'lush', 'foliage', 'greenery', 'blossom'], spots: [[0.08, 0.81, 0.05], [0.9, 0.74, 0.05]] }
  ]
};

/** Touch points for a canonical RWS card name, or an empty list. */
export function getCardTouchPoints(canonicalName, { artworkEdition = 'rws-1909-scan' } = {}) {
  if (artworkEdition === 'rws-immanuelle-vector') return getVectorGestureDetails(canonicalName);
  if (artworkEdition !== 'rws-1909-scan') return [];
  return CARD_TOUCH_POINTS[canonicalName] || [];
}
