/**
 * Upright Immanuelle vector details, visually inspected from the checked-in SVGs.
 * Soft spots locate details; they are not silhouette masks or segmentation.
 * Probe sentences are authored test copy, never recorded personalized readings.
 */
const rows = {
  'The Fool': [
    { id: 'white-dog', terms: ['white dog'], spot: [.80, .735, .13, .11], crop: [.79, .73, 1.55], match: /\b(?:little )?white dog\b/giu, scene: /\b(?:leap\w*|bark\w*|heels?|feet|beside)\b/i, text: 'A little white dog leaps beside the traveler’s heels.' },
    { id: 'cliff-edge', terms: ['cliff edge'], spot: [.46, .815, .31, .10], crop: [.47, .79, 1.12], match: /\b(?:cliff edge|edge of (?:a|the) cliff)\b/giu, scene: /\b(?:stands?|standing|steps?|feet|traveler)\b/i, text: 'The traveler stands at the cliff edge, with one foot close to the drop.' }
  ],
  'The Magician': [
    { id: 'raised-wand', terms: ['raised wand', 'wand held aloft'], spot: [.175, .135, .075, .11], crop: [.175, .15, 1.9], match: /\b(?:raised wand|wand held aloft)\b/giu, scene: /\b(?:hand|holds?|sky|above)\b/i, text: 'His hand holds a raised wand toward the sky.' },
    { id: 'table-tools', terms: ['four tools', 'tools on the table'], spot: [.32, .59, .26, .10], crop: [.32, .58, 1.25], match: /\b(?:four tools|tools on the table)\b/giu, scene: /\b(?:table|cup|sword|pentacle|wand)\b/i, text: 'Four tools rest on the table: a cup, sword, pentacle, and wand.' }
  ],
  'The High Priestess': [
    { id: 'pillars', terms: ['black and white pillars'], spots: [[.135, .50, .105, .35], [.86, .50, .085, .35]], crop: [.50, .49, .78], match: /\b(?:black and white pillars|two pillars)\b/giu, scene: /\b(?:sits?|seated|between|flank\w*)\b/i, text: 'She sits between the black and white pillars.' },
    { id: 'scroll', terms: ['scroll'], spot: [.48, .57, .13, .085], crop: [.48, .57, 1.8], match: /\b(?:partly concealed |partly hidden )?scroll\b/giu, scene: /\b(?:lap|holds?|robe|tora|torah)\b/i, text: 'A partly concealed scroll rests in her lap beneath the robe.' }
  ],
  'The Empress': [
    { id: 'wheat', terms: ['wheat'], spot: [.52, .85, .43, .065], crop: [.52, .84, .98], match: /\b(?:golden |ripening )?wheat\b/giu, scene: /\b(?:grows?|foreground|feet|field|stalks?)\b/i, text: 'Golden wheat grows across the foreground at her feet.' },
    { id: 'venus-shield', terms: ['heart-shaped shield'], spot: [.27, .665, .15, .10], crop: [.27, .66, 1.7], match: /\bheart-shaped shield\b/giu, scene: /\b(?:venus|symbol|throne|beside)\b/i, text: 'A heart-shaped shield beside her throne bears the symbol of Venus.' }
  ],
  'The Emperor': [
    { id: 'ram-throne', terms: ['ram heads'], spots: [[.205, .14, .08, .07], [.81, .14, .075, .065], [.18, .54, .085, .09], [.83, .54, .09, .09]], crop: [.50, .35, .81], match: /\bram(?:[’']s)? heads\b/giu, scene: /\b(?:carved|throne|stone)\b/i, text: 'Ram heads are carved into the stone throne.' },
    { id: 'scepter', terms: ['scepter', 'sceptre'], spot: [.155, .375, .065, .13], crop: [.155, .375, 1.6], match: /\b(?:ankh-shaped )?s[cs]ept(?:er|re)\b/giu, scene: /\b(?:holds?|hand|ankh)\b/i, text: 'One hand holds an ankh-shaped scepter.' }
  ],
  'The Hierophant': [
    { id: 'crossed-keys', terms: ['crossed keys'], spot: [.50, .835, .17, .065], crop: [.50, .83, 1.6], match: /\b(?:crossed keys|two keys)\b/giu, scene: /\b(?:feet|cross\w*|floor|lie|lying)\b/i, text: 'Two crossed keys lie at his feet between the attendants.' },
    { id: 'blessing-hand', terms: ['raised hand'], spot: [.22, .245, .08, .09], crop: [.22, .25, 1.8], match: /\braised hand\b/giu, scene: /\b(?:fingers?|blessing|two)\b/i, text: 'His raised hand extends two fingers in a blessing.' }
  ],
  'The Lovers': [
    { id: 'angel', terms: ['angel'], spot: [.51, .29, .40, .20], crop: [.50, .29, .95], match: /\b(?:winged )?angel\b/giu, scene: /\b(?:above|wings?|arms?|figures?|couple)\b/i, text: 'A winged angel opens both arms above the two figures.' },
    { id: 'mountain', terms: ['mountain'], spot: [.50, .775, .22, .115], crop: [.50, .775, 1.25], match: /\b(?:distant )?mountain\b/giu, scene: /\b(?:rises?|between|figures?|distance)\b/i, text: 'A mountain rises in the distance between the two figures.' }
  ],
  'The Chariot': [
    { id: 'sphinxes', terms: ['sphinxes'], spots: [[.28, .73, .22, .155], [.76, .73, .21, .155]], crop: [.52, .73, .98], match: /\b(?:black and white )?sphinxes\b/giu, scene: /\b(?:sit|rest|front|black|white)\b/i, text: 'Black and white sphinxes sit in front of the chariot.' },
    { id: 'star-canopy', terms: ['starry canopy'], spot: [.505, .13, .29, .095], crop: [.505, .14, 1.12], match: /\b(?:starry canopy|star-covered canopy)\b/giu, scene: /\b(?:above|head|hangs?|charioteer)\b/i, text: 'A starry canopy hangs above the charioteer’s head.' }
  ],
  'Strength': [
    { id: 'lion', terms: ['lion'], spot: [.64, .625, .33, .23], crop: [.63, .625, 1.05], match: /\b(?:red |golden )?lion\b/giu, scene: /\b(?:woman|jaw|mouth|mane|paws?)\b/i, text: 'The woman bends toward the lion, whose mane curves below her hands.' },
    { id: 'gentle-hands', terms: ['hands at its mouth'], spot: [.405, .50, .135, .085], crop: [.405, .50, 1.75], match: /\b(?:hands (?:at|around) (?:its|the lion’s|the lion's) mouth|lion[’']s jaws)\b/giu, scene: /\b(?:woman|rests?|gently|holds?)\b/i, text: 'She gently rests her hands around its mouth.' }
  ],
  'Justice': [
    { id: 'scales', terms: ['scales'], spot: [.85, .525, .13, .14], crop: [.85, .525, 1.5], match: /\b(?:balanced )?scales\b/giu, scene: /\b(?:holds?|hand|hang\w*|pans?)\b/i, text: 'One hand holds the scales, with two pans hanging below.' },
    { id: 'upright-sword', terms: ['upright sword'], spot: [.16, .235, .06, .19], crop: [.16, .235, 1.4], match: /\b(?:upright sword|sword held upright)\b/giu, scene: /\b(?:other|hand|holds?|blade)\b/i, text: 'The other hand holds an upright sword with its blade pointing upward.' }
  ],
  'The Hanged Man': [
    { id: 'halo', terms: ['halo'], spot: [.50, .745, .18, .105], crop: [.50, .74, 1.5], match: /\b(?:golden |bright )?halo\b/giu, scene: /\b(?:head|surrounds?|encircles?)\b/i, text: 'A golden halo surrounds his hanging head.' },
    { id: 'crossed-leg', terms: ['bent leg', 'crossed leg'], spot: [.48, .32, .245, .12], crop: [.48, .32, 1.25], match: /\b(?:bent leg|crossed leg)\b/giu, scene: /\b(?:triangle|forms?|hang\w*|other leg)\b/i, text: 'His bent leg forms a triangle across the other leg.' }
  ],
  'Death': [
    { id: 'white-rose', terms: ['white rose'], spot: [.605, .16, .205, .135], crop: [.60, .17, 1.35], match: /\bwhite rose\b/giu, scene: /\b(?:black|banner|flag|petals?)\b/i, text: 'A white rose appears on the black banner.' },
    { id: 'rising-sun', terms: ['sun between the towers'], spot: [.86, .365, .085, .075], crop: [.85, .36, 2], match: /\bsun (?:rises? )?between (?:the |two )?towers\b/giu, scene: /\b(?:horizon|distance|rises?|towers)\b/i, text: 'In the distance, the sun rises between two towers on the horizon.' }
  ],
  'Temperance': [
    { id: 'cup-stream', terms: ['water between the cups'], spot: [.485, .42, .15, .09], crop: [.485, .42, 1.65], match: /\bwater (?:flows? |passes? )?between (?:the )?(?:two )?cups\b/giu, scene: /\b(?:angel|pours?|flows?|passes?|tilt\w*)\b/i, text: 'The angel pours water between the two cups.' },
    { id: 'two-feet', terms: ['one foot in water'], spots: [[.49, .83, .09, .07], [.635, .79, .10, .06]], crop: [.56, .815, 1.5], match: /\bone foot in (?:the )?water\b/giu, scene: /\b(?:other|land|shore|ground)\b/i, text: 'One foot in water and the other on land place the angel across both surfaces.' }
  ],
  'The Devil': [
    { id: 'loose-chains', terms: ['loose chains'], spot: [.495, .71, .27, .09], crop: [.495, .70, 1.25], match: /\b(?:loose chains|chains around their necks)\b/giu, scene: /\b(?:necks?|figures?|collars?|hang\w*)\b/i, text: 'Loose chains hang around the two figures’ necks.' },
    { id: 'downward-torch', terms: ['downward torch'], spot: [.855, .58, .075, .17], crop: [.85, .58, 1.55], match: /\b(?:downward torch|torch points? downward)\b/giu, scene: /\b(?:holds?|hand|flame|burn\w*)\b/i, text: 'One hand holds a downward torch, with a flame near the figure below.' }
  ],
  'The Tower': [
    { id: 'lightning', terms: ['lightning bolt'], spot: [.785, .125, .16, .115], crop: [.78, .15, 1.4], match: /\b(?:lightning bolt|bolt of lightning)\b/giu, scene: /\b(?:strik\w*|struck|hits?|crown|roof|stone)\b/i, text: 'A lightning bolt strikes the stone roof beside the crown.' },
    { id: 'falling-crown', terms: ['falling crown', 'dislodged crown'], spot: [.27, .105, .13, .085], crop: [.28, .12, 1.75], match: /\b(?:falling crown|dislodged crown|crown falls)\b/giu, scene: /\b(?:top|roof|tower|air|stone)\b/i, text: 'The dislodged crown falls into the air above the tower.' }
  ],
  'The Moon': [
    { id: 'crayfish', terms: ['crayfish', 'crustacean'], spot: [.46, .80, .14, .13], crop: [.46, .80, 1.55], match: /\b(?:crayfish|crustacean)\b/giu, scene: /\b(?:pool|water|emerg\w*|climb\w*)\b/i, text: 'A crayfish emerges from the pool at the bottom of the image.' },
    { id: 'dog-wolf', terms: ['dog and wolf'], spots: [[.315, .65, .17, .14], [.75, .655, .19, .15]], crop: [.53, .65, 1], match: /\b(?:dog and (?:a |the )?wolf|wolf and (?:a |the )?dog)\b/giu, scene: /\b(?:howl\w*|stand|path|moon|heads?)\b/i, text: 'A dog and wolf raise their heads on either side of the path.' }
  ],
  'The Sun': [
    { id: 'white-horse', terms: ['white horse'], spot: [.53, .73, .38, .185], crop: [.53, .72, .98], match: /\bwhite horse\b/giu, scene: /\b(?:child|rides?|riding|sits?|back|mane)\b/i, text: 'A child rides a white horse with a dark mane.' },
    { id: 'sunflowers', terms: ['sunflowers'], spot: [.29, .455, .255, .095], crop: [.30, .465, 1.18], match: /\bsunflowers\b/giu, scene: /\b(?:wall|grow\w*|behind|heads?)\b/i, text: 'Sunflowers grow behind the wall beneath the sun’s rays.' }
  ],
  'Judgement': [
    { id: 'trumpet', terms: ['trumpet'], spot: [.565, .38, .14, .165], crop: [.565, .38, 1.45], match: /\b(?:golden )?trumpet\b/giu, scene: /\b(?:angel|blows?|mouth|banner)\b/i, text: 'An angel blows a trumpet with a small banner hanging from it.' },
    { id: 'raised-arms', terms: ['raised arms'], spot: [.51, .69, .40, .15], crop: [.51, .69, 1], match: /\b(?:raised arms|arms raised)\b/giu, scene: /\b(?:figures?|coffins?|people|rise|rising)\b/i, text: 'The figures rise from their coffins with arms raised.' }
  ],
  'The World': [
    { id: 'wreath', terms: ['green wreath'], spots: [[.15, .47, .075, .32], [.845, .47, .065, .31], [.50, .11, .31, .065], [.50, .80, .32, .08]], crop: [.50, .47, .83], match: /\b(?:green |oval )?wreath\b/giu, scene: /\b(?:surround\w*|dancer|figure|oval|ribbon)\b/i, text: 'An oval wreath surrounds the dancer, with red ribbons at its ends.' },
    { id: 'two-wands', terms: ['two wands'], spots: [[.26, .47, .045, .10], [.745, .42, .05, .085]], crop: [.50, .46, 1.05], match: /\btwo wands\b/giu, scene: /\b(?:holds?|hands?|dancer)\b/i, text: 'The dancer holds two wands, one in each hand.' }
  ]
};

export const MAJOR_ARTWORK = Object.fromEntries(Object.entries(rows).map(([name, details]) => [name, details.map(row => {
  const maskSpots = (row.spots || [row.spot]).map(([x, y, rx, ry]) => ({ x, y, rx, ry }));
  const [x, y, zoom] = row.crop;
  return { id: row.id, terms: row.terms, maskSpots, spots: maskSpots.map(spot => [spot.x, spot.y, spot.rx]), frame: { x, y, zoom }, traces: [] };
})]));
export const MAJOR_RULES = Object.fromEntries(Object.entries(rows).map(([name, details]) => [name, details.map(({ id, match, scene }) => ({ id, match, scene }))]));
export const MAJOR_EXAMPLES = Object.entries(rows).flatMap(([card, details]) => details.map(row => ({ card, detailId: row.id, text: row.text })));
