/**
 * Upright geometry authored against the actual Immanuelle SVGs, October 9, 2026.
 * Visually inspected: cups 01–12, 14; pentacles 01–02, 04–14. Queen of Cups
 * and Three of Pentacles retain the earlier study's authored treatments.
 * Source: output/reading-motion/assets/rws-immanuelle/{cups,pentacles}-NN.svg;
 * artwork attribution and original hashes remain in that directory's manifest.
 * These soft elliptical regions are static attention cues, not segmentation
 * masks or living-water recipes. No scan coordinates or source SVG paths used.
 */
function anchor(id, terms, regions, frame, match, scene, text) {
  const maskSpots = regions.map(([x, y, rx, ry]) => ({ x, y, rx, ry }));
  return {
    artwork: { id, terms, maskSpots, spots: maskSpots.map(({ x, y, rx }) => [x, y, rx]), frame, traces: [] },
    rule: { id, match, scene },
    text
  };
}

const entries = {
  'Ace of Cups': [
    anchor('overflowing-cup', ['overflowing cup', 'streams of water'],
      [[.50, .405, .19, .22]], { x: .50, y: .405, zoom: 1.35 },
      /\b(?:overflowing cup|streams? of water)\b/giu, /\b(?:hand|cloud|cup|chalice|pour\w*|spill\w*)\b/i,
      'A hand emerging from a cloud holds an overflowing cup above the water.'),
    anchor('descending-dove', ['dove', 'white bird'],
      [[.49, .157, .16, .115]], { x: .49, y: .17, zoom: 2.15 },
      /\b(?:dove|white bird)\b/giu, /\b(?:descend\w*|downward|cup|chalice|wafer|disc)\b/i,
      'A dove descends toward the chalice carrying a small round wafer.')
  ],
  'Two of Cups': [
    anchor('exchanged-cups', ['two cups', 'exchange cups'],
      [[.437, .425, .095, .105], [.59, .425, .095, .105]], { x: .515, y: .425, zoom: 1.70 },
      /\b(?:two cups|exchang\w* (?:their )?cups)\b/giu, /\b(?:figures?|people|hands?|hold\w*|rais\w*|offer\w*)\b/i,
      'The two figures hold two cups between their outstretched hands.'),
    anchor('winged-lion', ['winged lion', "lion's head"],
      [[.51, .168, .38, .105]], { x: .51, y: .18, zoom: 1.30 },
      /\b(?:winged lion|lion['’]s head)\b/giu, /\b(?:above|wings?|red|caduceus|hovers?)\b/i,
      'A red winged lion hovers above the two people and their cups.')
  ],
  'Three of Cups': [
    anchor('raised-goblets', ['raised cups', 'raised goblets', 'three goblets'],
      [[.346, .19, .085, .105], [.495, .15, .085, .105], [.65, .19, .085, .105]], { x: .50, y: .20, zoom: 1.45 },
      /\b(?:raised (?:cups|goblets)|three (?:raised )?goblets)\b/giu, /\b(?:women|figures|hands|aloft|toast\w*)\b/i,
      'Three women bring their raised goblets together in a toast.'),
    anchor('harvest-fruit', ['fruit', 'pumpkin', 'grapes'],
      [[.12, .77, .11, .12], [.82, .871, .10, .075]], { x: .50, y: .79, zoom: 1.08 },
      /\b(?:harvest fruit|pumpkin|grapes)\b/giu, /\b(?:feet|ground|scatter\w*|surround\w*|women|figures)\b/i,
      'A pumpkin and grapes lie on the ground around the dancing figures.')
  ],
  'Four of Cups': [
    anchor('offered-cup', ['offered cup', 'cup from a cloud'],
      [[.387, .495, .13, .135]], { x: .38, y: .495, zoom: 1.75 },
      /\b(?:offered cup|cup from a cloud|cup held out)\b/giu, /\b(?:hand|cloud|figure|tree)\b/i,
      'A hand emerges from a cloud with an offered cup beside the seated figure.'),
    anchor('grounded-cups', ['three cups', 'cups on the ground'],
      [[.105, .846, .075, .105], [.286, .846, .08, .105], [.493, .85, .075, .10]], { x: .30, y: .835, zoom: 1.30 },
      /\b(?:three cups|cups on the ground)\b/giu, /\b(?:stand\w*|ground|grass|feet|before|front)\b/i,
      'Three cups stand on the grass in front of the seated figure.')
  ],
  'Five of Cups': [
    anchor('spilled-cups', ['spilled cups', 'fallen cups', 'three cups'],
      [[.215, .855, .16, .115]], { x: .225, y: .85, zoom: 1.75 },
      /\b(?:spilled cups|fallen cups|three cups)\b/giu, /\b(?:spill\w*|fallen|overturn\w*|ground|lie|lying)\b/i,
      'Three cups lie overturned on the ground, their contents spilled.'),
    anchor('standing-cups', ['two standing cups', 'two cups behind'],
      [[.776, .81, .085, .11], [.814, .884, .08, .105]], { x: .79, y: .835, zoom: 1.55 },
      /\b(?:two (?:standing |upright )?cups|cups behind)\b/giu, /\b(?:behind|upright|stand\w*|cloak|figure)\b/i,
      'Two upright cups stand behind the figure in the black cloak.')
  ],
  'Six of Cups': [
    anchor('flower-offering', ['flower-filled cup', 'cup of flowers'],
      [[.615, .615, .115, .135]], { x: .605, y: .61, zoom: 1.70 },
      /\b(?:flower[- ]filled cup|cup (?:of|filled with) flowers)\b/giu, /\b(?:child|children|offer\w*|hand\w*|giv\w*)\b/i,
      'One child offers the other a flower-filled cup in the courtyard.'),
    anchor('courtyard', ['courtyard', 'stone buildings'],
      [[.31, .335, .245, .16], [.71, .415, .235, .115]], { x: .48, y: .35, zoom: 1.18 },
      /\b(?:courtyard|stone buildings)\b/giu, /\b(?:buildings|houses|walls|tower|roofs|behind)\b/i,
      'Stone buildings and sloping roofs enclose the courtyard behind the children.')
  ],
  'Seven of Cups': [
    anchor('cloud-cups', ['seven cups', 'cups in clouds'],
      [[.48, .38, .41, .315]], { x: .50, y: .37, zoom: 1.05 },
      /\b(?:seven cups|cups (?:in|among|within) (?:the )?clouds)\b/giu, /\b(?:cloud\w*|float\w*|hover\w*|appear\w*)\b/i,
      'Seven cups float among clouds above the dark foreground figure.'),
    anchor('veiled-figure', ['veiled figure', 'shrouded figure', 'covered figure'],
      [[.505, .226, .185, .13]], { x: .505, y: .23, zoom: 1.85 },
      /\b(?:veiled|shrouded|covered) figure\b/giu, /\b(?:cup|central|middle|white|shroud)\b/i,
      'A veiled figure rises from the central cup beneath a white shroud.')
  ],
  'Eight of Cups': [
    anchor('stacked-cups', ['eight cups', 'stacked cups'],
      [[.50, .795, .40, .16]], { x: .50, y: .79, zoom: 1.10 },
      /\b(?:eight cups|stacked cups)\b/giu, /\b(?:foreground|stack\w*|rows?|behind|stand\w*)\b/i,
      'Eight cups stand in two rows in the foreground, left behind by the traveler.'),
    anchor('departing-traveler', ['cloaked traveler', 'red-cloaked figure', 'walking figure'],
      [[.674, .545, .16, .18]], { x: .674, y: .54, zoom: 1.40 },
      /\b(?:cloaked travel(?:er|ler)|red[- ]cloaked figure|walking figure)\b/giu, /\b(?:staff|walk\w*|climb\w*|rocks?|mountains?|away)\b/i,
      'A red-cloaked figure walks away with a staff toward the rocky mountains.')
  ],
  'Nine of Cups': [
    anchor('cup-row', ['nine cups', 'row of cups'],
      [[.50, .26, .415, .11]], { x: .50, y: .26, zoom: 1.10 },
      /\b(?:nine cups|row of cups)\b/giu, /\b(?:behind|arrang\w*|row|shelf|curv\w*|display\w*)\b/i,
      'Nine cups are arranged in a curved row behind the seated man.'),
    anchor('folded-arms', ['folded arms', 'crossed arms'],
      [[.50, .565, .19, .105]], { x: .50, y: .56, zoom: 1.85 },
      /\b(?:folded|crossed) arms\b/giu, /\b(?:man|figure|seated|sits?|chest)\b/i,
      'The seated man rests with folded arms across his chest.')
  ],
  'Ten of Cups': [
    anchor('rainbow-cups', ['rainbow', 'arc of cups'],
      [[.15, .29, .10, .15], [.50, .17, .315, .10], [.85, .29, .10, .15]], { x: .50, y: .235, zoom: 1.05 },
      /\b(?:rainbow|arc of cups)\b/giu, /\b(?:cups|sky|overhead|arch\w*|above)\b/i,
      'A rainbow holding ten cups arches across the sky above the family.'),
    anchor('playing-children', ['children', 'dancing children'],
      [[.747, .77, .14, .11]], { x: .747, y: .76, zoom: 1.80 },
      /\b(?:dancing |playing )?children\b/giu, /\b(?:danc\w*|play\w*|join\w*|hands|beside|foreground)\b/i,
      'Two children dance with joined hands beside the adults.')
  ],
  'Page of Cups': [
    anchor('fish-in-cup', ['fish', 'fish in the cup'],
      [[.247, .273, .075, .065], [.233, .344, .08, .10]], { x: .242, y: .305, zoom: 2.05 },
      /\b(?:fish|fish in the cup)\b/giu, /\b(?:cup|goblet|peek\w*|emerg\w*|look\w*|held)\b/i,
      'A fish peeks from the cup held in the page\'s hand.'),
    anchor('sea-waves', ['waves', 'sea behind'],
      [[.20, .745, .145, .045], [.80, .745, .14, .045]], { x: .50, y: .747, zoom: 1.15 },
      /\b(?:waves|sea behind)\b/giu, /\b(?:sea|behind|blue|shore|horizon)\b/i,
      'Blue waves stretch across the sea behind the standing page.')
  ],
  'Knight of Cups': [
    anchor('held-goblet', ['held cup', 'raised cup', 'golden cup'],
      [[.629, .288, .085, .11]], { x: .629, y: .295, zoom: 1.95 },
      /\b(?:(?:held|raised|golden) cup|holds? (?:a |the )?cup)\b/giu, /\b(?:hand|knight|rider|hold\w*|rais\w*|offer\w*)\b/i,
      'The rider holds a golden cup forward in one hand.'),
    anchor('white-horse', ['white horse', 'horse\'s head'],
      [[.725, .458, .18, .16]], { x: .725, y: .465, zoom: 1.50 },
      /\b(?:white horse|horse['’]s head)\b/giu, /\b(?:head|bow\w*|lower\w*|rid\w*|step\w*|rein\w*)\b/i,
      'The white horse lowers its head beneath the rider\'s reins.')
  ],
  'King of Cups': [
    anchor('held-cup', ['golden cup', 'cup in his hand'],
      [[.37, .45, .105, .105]], { x: .37, y: .45, zoom: 1.85 },
      /\b(?:golden cup|cup in (?:his|one) hand)\b/giu, /\b(?:king|hand|hold\w*|throne|seated)\b/i,
      'The seated king holds a golden cup in his right hand.'),
    anchor('throne-at-sea', ['stone platform', 'throne in the sea'],
      [[.54, .848, .36, .065]], { x: .54, y: .84, zoom: 1.18 },
      /\b(?:stone platform|throne (?:in|amid|on) (?:the )?sea)\b/giu, /\b(?:waves|water|sea|surround\w*)\b/i,
      'Waves surround the stone platform beneath the king\'s throne.')
  ],
  'Ace of Pentacles': [
    anchor('offered-pentacle', ['golden pentacle', 'large pentacle'],
      [[.59, .335, .22, .16]], { x: .59, y: .34, zoom: 1.45 },
      /\b(?:golden|large) pentacle\b/giu, /\b(?:hand|cloud|hold\w*|offer\w*|palm)\b/i,
      'A hand emerging from a cloud presents a large pentacle on its palm.'),
    anchor('garden-arch', ['garden arch', 'hedge arch', 'archway'],
      [[.709, .75, .155, .11]], { x: .709, y: .75, zoom: 1.75 },
      /\b(?:garden arch|hedge arch|archway)\b/giu, /\b(?:garden|hedge|path|flowers|beyond|mountains)\b/i,
      'A path through the garden leads to an archway in the hedge.')
  ],
  'Two of Pentacles': [
    anchor('infinity-loop', ['infinity loop', 'figure-eight ribbon'],
      [[.50, .449, .385, .16]], { x: .50, y: .449, zoom: 1.15 },
      /\b(?:infinity (?:loop|ribbon)|figure[- ]eight (?:loop|ribbon))\b/giu, /\b(?:pentacles|coins|green|join\w*|encircl\w*)\b/i,
      'A green infinity loop joins the two pentacles held by the figure.'),
    anchor('rolling-ships', ['ships', 'boats'],
      [[.266, .751, .07, .065], [.692, .741, .07, .065]], { x: .48, y: .75, zoom: 1.25 },
      /\b(?:ships|boats)\b/giu, /\b(?:waves|sea|behind|roll\w*|sail\w*|rock\w*)\b/i,
      'Two ships ride the rolling waves in the sea behind the figure.')
  ],
  'Four of Pentacles': [
    anchor('clutched-coin', ['clutched pentacle', 'coin against his chest'],
      [[.48, .517, .14, .095]], { x: .49, y: .52, zoom: 1.85 },
      /\b(?:clutched pentacle|(?:coin|pentacle) (?:against|at) (?:his|the) chest)\b/giu, /\b(?:hands|arms|hold\w*|clutch\w*|figure)\b/i,
      'The seated figure holds a coin against his chest with both arms.'),
    anchor('coins-underfoot', ['coins under his feet', 'pentacles beneath his feet'],
      [[.332, .819, .12, .055], [.576, .821, .12, .055]], { x: .455, y: .82, zoom: 1.50 },
      /\b(?:coins|pentacles) (?:under|beneath) (?:his|the|both) feet\b/giu, /\b(?:feet|shoes|rest\w*|stand\w*|press\w*)\b/i,
      'Both shoes rest on pentacles beneath his feet.')
  ],
  'Five of Pentacles': [
    anchor('stained-glass', ['stained-glass window', 'illuminated window'],
      [[.489, .218, .222, .188]], { x: .489, y: .24, zoom: 1.35 },
      /\b(?:stained[- ]glass|illuminated) window\b/giu, /\b(?:pentacles|five|wall|above|snow|glow\w*)\b/i,
      'Five pentacles fill a stained-glass window above the snowy path.'),
    anchor('crutches', ['crutches', 'wooden crutch'],
      [[.226, .738, .08, .195], [.474, .724, .07, .155]], { x: .35, y: .72, zoom: 1.30 },
      /\b(?:crutches|wooden crutch)\b/giu, /\b(?:figure|man|snow|walk\w*|lean\w*|support\w*)\b/i,
      'One figure leans on crutches while walking through the snow.')
  ],
  'Six of Pentacles': [
    anchor('balance-scales', ['scales', 'balance scales'],
      [[.812, .455, .105, .095]], { x: .807, y: .455, zoom: 1.95 },
      /\b(?:balance )?scales\b/giu, /\b(?:hold\w*|hand|hang\w*|merchant|figure)\b/i,
      'The standing merchant holds a small set of scales in one hand.'),
    anchor('giving-hand', ['outstretched hand', 'giving coins'],
      [[.298, .557, .10, .085]], { x: .298, y: .56, zoom: 1.95 },
      /\b(?:outstretched hand|giv\w* coins|dropp\w* coins)\b/giu, /\b(?:kneel\w*|beggar|coins|palm|receiv\w*)\b/i,
      'The merchant drops coins into the kneeling figure\'s outstretched hand.')
  ],
  'Seven of Pentacles': [
    anchor('pentacle-vine', ['pentacle-bearing vine', 'pentacles on the vine'],
      [[.29, .635, .255, .27]], { x: .29, y: .62, zoom: 1.12 },
      /\b(?:pentacle[- ]bearing vine|pentacles (?:on|in|among) (?:the )?(?:vine|foliage|leaves))\b/giu, /\b(?:vine|foliage|leaves|grow\w*|hang\w*|bush)\b/i,
      'Golden pentacles hang among the leaves of the pentacle-bearing vine.'),
    anchor('resting-hoe', ['hoe', 'wooden handle'],
      [[.676, .623, .065, .285]], { x: .665, y: .60, zoom: 1.15 },
      /\b(?:hoe|wooden handle)\b/giu, /\b(?:lean\w*|rest\w*|hands|gardener|figure|tool)\b/i,
      'The gardener rests both hands on the wooden handle of a hoe.')
  ],
  'Eight of Pentacles': [
    anchor('working-tools', ['hammer', 'chisel'],
      [[.574, .623, .10, .10], [.604, .736, .08, .06]], { x: .59, y: .68, zoom: 1.70 },
      /\b(?:hammer|chisel)\b/giu, /\b(?:craft\w*|work\w*|hand|carv\w*|bench|pentacle)\b/i,
      'The craftsman raises a hammer over the pentacle resting on his workbench.'),
    anchor('finished-pentacles', ['finished pentacles', 'row of pentacles'],
      [[.796, .445, .12, .405]], { x: .795, y: .465, zoom: 1.02 },
      /\b(?:finished pentacles|row of pentacles)\b/giu, /\b(?:post|hang\w*|display\w*|vertical|wooden|beside)\b/i,
      'A vertical row of pentacles hangs on the wooden post beside the workbench.')
  ],
  'Nine of Pentacles': [
    anchor('gloved-falcon', ['falcon', 'hooded bird'],
      [[.698, .285, .105, .10]], { x: .698, y: .285, zoom: 1.95 },
      /\b(?:falcon|hooded bird)\b/giu, /\b(?:glove|gloved|hand|perch\w*|wrist|hold\w*)\b/i,
      'A hooded falcon perches on the woman\'s gloved hand.'),
    anchor('grape-vines', ['grapes', 'grapevines'],
      [[.198, .456, .12, .095], [.869, .53, .09, .145]], { x: .55, y: .495, zoom: 1.05 },
      /\b(?:grapes|grapevines)\b/giu, /\b(?:vine\w*|grow\w*|hang\w*|garden|behind|bunch\w*|leaves)\b/i,
      'Bunches of grapes hang from the vines behind the woman in the garden.')
  ],
  'Ten of Pentacles': [
    anchor('stone-arch', ['stone arch', 'archway'],
      [[.67, .254, .27, .12], [.305, .407, .09, .17]], { x: .54, y: .30, zoom: 1.12 },
      /\b(?:stone arch|archway)\b/giu, /\b(?:family|courtyard|buildings|gateway|behind|beneath)\b/i,
      'A stone arch frames the courtyard and the buildings behind the family.'),
    anchor('white-dogs', ['white dogs', 'two dogs'],
      [[.76, .762, .17, .105], [.745, .86, .17, .10]], { x: .75, y: .80, zoom: 1.45 },
      /\b(?:white dogs|two dogs)\b/giu, /\b(?:old|elder|man|feet|pet\w*|foreground|stand\w*)\b/i,
      'Two white dogs stand at the old man\'s feet in the foreground.')
  ],
  'Page of Pentacles': [
    anchor('raised-pentacle', ['raised pentacle', 'held pentacle'],
      [[.649, .168, .10, .075]], { x: .649, y: .19, zoom: 2.00 },
      /\b(?:(?:raised|held) pentacle|pentacle (?:held|raised) (?:in|between|above))\b/giu, /\b(?:hands|page|gaze\w*|hold\w*|aloft)\b/i,
      'The page gazes at the raised pentacle held between both hands.'),
    anchor('distant-mountains', ['distant mountains', 'mountain ridge'],
      [[.81, .724, .13, .06]], { x: .79, y: .73, zoom: 1.75 },
      /\b(?:distant mountains|mountain ridge)\b/giu, /\b(?:horizon|distance|field|behind|beyond|landscape)\b/i,
      'Distant mountains rise beyond the green field at the edge of the horizon.')
  ],
  'Knight of Pentacles': [
    anchor('offered-pentacle', ['held pentacle', 'golden pentacle'],
      [[.63, .25, .105, .075]], { x: .63, y: .25, zoom: 2.00 },
      /\b(?:held|golden) pentacle\b/giu, /\b(?:hand|knight|rider|hold\w*|offer\w*|palm)\b/i,
      'The rider holds a golden pentacle above the horse\'s neck.'),
    anchor('plowed-fields', ['plowed fields', 'ploughed fields', 'furrows'],
      [[.21, .805, .14, .055], [.80, .80, .13, .07]], { x: .50, y: .80, zoom: 1.10 },
      /\b(?:plow(?:ed|ing) fields?|plough(?:ed|ing) fields?|furrows)\b/giu, /\b(?:field\w*|ground|behind|earth|rows|landscape)\b/i,
      'Long furrows run through the plowed fields behind the dark horse.')
  ],
  'Queen of Pentacles': [
    anchor('cradled-pentacle', ['cradled pentacle', 'pentacle in her lap'],
      [[.34, .432, .125, .11]], { x: .34, y: .43, zoom: 1.85 },
      /\b(?:cradled pentacle|pentacle (?:in|on) her lap)\b/giu, /\b(?:queen|hands|hold\w*|cradl\w*|look\w*)\b/i,
      'The queen looks down at the pentacle in her lap, cradled in both hands.'),
    anchor('foreground-rabbit', ['rabbit', 'hare'],
      [[.873, .77, .085, .075]], { x: .84, y: .775, zoom: 1.85 },
      /\b(?:rabbit|hare)\b/giu, /\b(?:foreground|grass|ground|feet|right|corner|hopp\w*)\b/i,
      'A rabbit sits among the grasses in the lower right foreground.')
  ],
  'King of Pentacles': [
    anchor('resting-pentacle', ['golden pentacle', 'pentacle on his knee'],
      [[.657, .483, .105, .10]], { x: .657, y: .485, zoom: 1.90 },
      /\b(?:golden pentacle|pentacle on his knee)\b/giu, /\b(?:king|hand|knee|rest\w*|hold\w*)\b/i,
      'The king rests one hand on the golden pentacle at his knee.'),
    anchor('bull-throne', ['bull heads', 'carved bulls'],
      [[.277, .226, .10, .09], [.715, .226, .10, .09]], { x: .50, y: .23, zoom: 1.20 },
      /\b(?:bull heads|carved bulls|bulls['’]? heads)\b/giu, /\b(?:throne|carv\w*|stone|corners|above|back)\b/i,
      'Carved bull heads mark the upper corners of the king\'s stone throne.')
  ]
};

export const CUP_PENTACLE_ARTWORK = Object.fromEntries(Object.entries(entries).map(([card, details]) => [card, details.map(({ artwork }) => artwork)]));
export const CUP_PENTACLE_RULES = Object.fromEntries(Object.entries(entries).map(([card, details]) => [card, details.map(({ rule }) => rule)]));
/** Authored literal probes for verification; these are not recorded readings. */
export const CUP_PENTACLE_EXAMPLES = Object.entries(entries).flatMap(([card, details]) => details.map(({ artwork, text }) => ({ card, detailId: artwork.id, text })));
