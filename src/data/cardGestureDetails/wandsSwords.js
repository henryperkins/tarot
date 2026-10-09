/**
 * Upright focal regions inspected against the Immanuelle vector faces.
 * Soft illumination only: these ellipses identify painted details, not exact
 * segmentation boundaries. No figure motion or procedural recipes are added.
 */
function focal(id, terms, x, y, rx, ry, zoom = 1.5, maskSpots = [{ x, y, rx, ry }]) {
  return {
    id, terms, maskSpots, spots: maskSpots.map(spot => [spot.x, spot.y, spot.rx]),
    frame: { x, y, zoom }, traces: []
  };
}

export const WAND_SWORD_ARTWORK = {
  'Two of Wands': [
    focal('globe', ['globe', 'small world'], .365, .367, .085, .06, 2.1),
    focal('distant-water', ['distant sea', 'water beyond the wall'], .16, .565, .12, .05, 1.9)
  ],
  'Three of Wands': [
    focal('ships', ['ships', 'boats'], .51, .818, .37, .055, 1.18, [
      { x: .14, y: .834, rx: .07, ry: .03 },
      { x: .745, y: .798, rx: .055, ry: .03 },
      { x: .867, y: .814, rx: .05, ry: .028 }
    ]),
    focal('three-staffs', ['three staffs', 'three staves'], .52, .50, .36, .39, 1.05, [
      { x: .217, y: .52, rx: .055, ry: .40 },
      { x: .685, y: .56, rx: .055, ry: .36 },
      { x: .80, y: .48, rx: .055, ry: .38 }
    ])
  ],
  'Four of Wands': [
    focal('garland', ['garland', 'hanging flowers'], .51, .265, .34, .095, 1.2),
    focal('celebrants', ['two celebrants', 'raised bouquets'], .51, .665, .17, .15, 1.45)
  ],
  'Six of Wands': [
    focal('laurel-wreath', ['laurel wreath', 'wreath on the staff'], .608, .205, .11, .075, 1.9),
    focal('white-horse', ['white horse', 'horse head'], .805, .60, .115, .125, 1.55)
  ],
  'Seven of Wands': [
    focal('defending-staff', ['diagonal staff', 'held staff'], .51, .435, .34, .29, 1.1, [
      { x: .30, y: .25, rx: .11, ry: .11 },
      { x: .51, y: .43, rx: .12, ry: .12 },
      { x: .75, y: .63, rx: .13, ry: .12 }
    ]),
    focal('high-ground', ['high ground', 'rocky ledge'], .50, .892, .42, .075, 1.15)
  ],
  'Eight of Wands': [
    focal('flying-staffs', ['eight wands', 'diagonal staffs'], .49, .465, .45, .355, 1.0),
    focal('river', ['river', 'water below'], .52, .907, .40, .045, 1.2)
  ],
  'Nine of Wands': [
    focal('head-bandage', ['head bandage', 'bandaged forehead'], .638, .292, .087, .038, 2.1),
    focal('staff-barrier', ['row of staffs', 'eight staffs'], .35, .465, .30, .34, 1.1, [
      { x: .105, y: .445, rx: .034, ry: .36 },
      { x: .183, y: .505, rx: .035, ry: .30 },
      { x: .308, y: .468, rx: .035, ry: .34 },
      { x: .387, y: .497, rx: .037, ry: .31 },
      { x: .502, y: .439, rx: .034, ry: .37 },
      { x: .754, y: .446, rx: .033, ry: .36 },
      { x: .833, y: .486, rx: .033, ry: .32 },
      { x: .897, y: .498, rx: .032, ry: .31 }
    ])
  ],
  'Ten of Wands': [
    focal('bundle', ['bundle of wands', 'ten staffs'], .505, .407, .36, .325, 1.1),
    focal('distant-town', ['distant town', 'buildings ahead'], .825, .752, .095, .075, 1.8)
  ],
  'Page of Wands': [
    focal('upright-staff', ['upright staff', 'sprouting staff'], .693, .415, .055, .36, 1.1),
    focal('hat-feather', ['hat feather', 'red feather'], .381, .156, .063, .075, 2.0)
  ],
  'Knight of Wands': [
    focal('rearing-horse', ['rearing horse', 'raised forelegs'], .272, .525, .245, .19, 1.15),
    focal('helmet-plume', ['helmet plume', 'red plume'], .745, .208, .12, .08, 1.8)
  ],
  'Queen of Wands': [
    focal('sunflower', ['sunflower'], .745, .31, .095, .08, 1.9),
    focal('black-cat', ['black cat'], .412, .79, .08, .087, 1.9)
  ],
  'King of Wands': [
    focal('ground-salamander', ['salamander', 'small lizard'], .724, .847, .13, .032, 1.9),
    focal('held-wand', ['held wand', 'upright wand'], .153, .43, .06, .315, 1.1)
  ],
  'Ace of Swords': [
    focal('crown', ['golden crown', 'crown'], .501, .106, .18, .073, 1.6),
    focal('cloud-hand', ['hand from a cloud', 'emerging hand'], .364, .602, .275, .135, 1.3)
  ],
  'Two of Swords': [
    focal('blindfold', ['blindfold', 'covered eyes'], .484, .381, .074, .028, 2.3),
    focal('crossed-swords', ['crossed swords', 'two raised swords'], .495, .285, .42, .19, 1.05, [
      { x: .17, y: .195, rx: .11, ry: .10 },
      { x: .315, y: .307, rx: .105, ry: .10 },
      { x: .43, y: .412, rx: .09, ry: .085 },
      { x: .815, y: .197, rx: .105, ry: .10 },
      { x: .68, y: .308, rx: .105, ry: .10 },
      { x: .559, y: .415, rx: .085, ry: .08 }
    ])
  ],
  'Three of Swords': [
    focal('pierced-heart', ['red heart', 'pierced heart'], .485, .486, .255, .18, 1.25),
    focal('rain', ['falling rain', 'rain lines'], .49, .58, .42, .27, 1.0, [
      { x: .165, y: .56, rx: .115, ry: .275 },
      { x: .81, y: .57, rx: .105, ry: .27 }
    ])
  ],
  'Four of Swords': [
    focal('praying-hands', ['praying hands', 'joined hands'], .573, .582, .063, .068, 2.0),
    focal('hanging-swords', ['three hanging swords', 'three swords on the wall'], .677, .319, .20, .22, 1.25, [
      { x: .544, y: .321, rx: .045, ry: .225 },
      { x: .679, y: .319, rx: .045, ry: .225 },
      { x: .814, y: .319, rx: .045, ry: .225 }
    ])
  ],
  'Five of Swords': [
    focal('fallen-swords', ['two fallen swords', 'swords on the ground'], .32, .877, .23, .075, 1.35, [
      { x: .257, y: .905, rx: .19, ry: .06 },
      { x: .408, y: .855, rx: .12, ry: .085 }
    ]),
    focal('departing-figures', ['departing figures', 'two figures walking away'], .284, .735, .17, .155, 1.35, [
      { x: .204, y: .714, rx: .105, ry: .155 },
      { x: .391, y: .752, rx: .065, ry: .105 }
    ])
  ],
  'Six of Swords': [
    focal('boat-passengers', ['two passengers', 'seated passengers'], .559, .702, .22, .14, 1.4),
    focal('planted-swords', ['six swords', 'upright swords'], .749, .54, .19, .255, 1.15)
  ],
  'Eight of Swords': [
    focal('blindfold', ['blindfold', 'covered eyes'], .378, .282, .085, .033, 2.2),
    focal('bindings', ['bindings', 'bound arms'], .377, .464, .15, .11, 1.7)
  ],
  'Nine of Swords': [
    focal('sword-row', ['nine swords', 'horizontal swords'], .512, .297, .42, .25, 1.0),
    focal('rose-quilt', ['rose quilt', 'patterned quilt'], .716, .768, .235, .125, 1.35)
  ],
  'Ten of Swords': [
    focal('ten-blades', ['ten swords', 'upright blades'], .49, .48, .405, .275, 1.1),
    focal('bright-horizon', ['bright horizon', 'yellow horizon'], .52, .532, .41, .08, 1.2)
  ],
  'Page of Swords': [
    focal('raised-sword', ['raised sword', 'upright blade'], .713, .186, .072, .20, 1.4),
    focal('birds', ['flock of birds', 'small birds'], .365, .079, .14, .037, 1.9)
  ],
  'Knight of Swords': [
    focal('raised-sword', ['raised sword', 'upraised blade'], .271, .113, .073, .13, 1.6),
    focal('charging-horse', ['charging horse', 'white horse'], .366, .464, .235, .145, 1.3)
  ],
  'Queen of Swords': [
    focal('upright-sword', ['upright sword', 'vertical blade'], .582, .27, .045, .22, 1.3),
    focal('open-hand', ['open hand', 'outstretched hand'], .667, .36, .087, .064, 1.9)
  ],
  'King of Swords': [
    focal('held-sword', ['held sword', 'upright sword'], .298, .24, .075, .21, 1.3),
    focal('throne-carving', ['butterfly carving', 'carved throne'], .486, .135, .185, .105, 1.55)
  ]
};

// Rules identify literal descriptions, not meanings inferred from keywords.
export const WAND_SWORD_RULES = {
  'Two of Wands': [
    { id: 'globe', match: /\b(?:small )?globe\b/giu, scene: /\b(?:holds?|holding|held|hand|figure)\b/i },
    { id: 'distant-water', match: /\b(?:distant sea|water beyond the wall)\b/giu, scene: /\b(?:wall|looks?|visible|painted|beyond)\b/i }
  ],
  'Three of Wands': [
    { id: 'ships', match: /\b(?:ships|boats)\b/giu, scene: /\b(?:sail\w*|water|sea|horizon)\b/i },
    { id: 'three-staffs', match: /\bthree (?:staffs|staves)\b/giu, scene: /\b(?:stand\w*|planted|upright|surround\w*)\b/i }
  ],
  'Four of Wands': [
    { id: 'garland', match: /\b(?:garland|hanging flowers)\b/giu, scene: /\b(?:hang\w*|suspend\w*|strung|between|staffs|staves)\b/i },
    { id: 'celebrants', match: /\b(?:two celebrants|raised bouquets)\b/giu, scene: /\b(?:figures?|hold\w*|rais\w*|flowers?|bouquets?)\b/i }
  ],
  'Six of Wands': [
    { id: 'laurel-wreath', match: /\b(?:laurel wreath|wreath on the staff)\b/giu, scene: /\b(?:staff|wand|mounted|tied|hang\w*)\b/i },
    { id: 'white-horse', match: /\bwhite horse\b/giu, scene: /\b(?:rides?|riding|ridden|mounted|rider|head)\b/i }
  ],
  'Seven of Wands': [
    { id: 'defending-staff', match: /\b(?:diagonal staff|held staff)\b/giu, scene: /\b(?:holds?|holding|held|figure|across)\b/i },
    { id: 'high-ground', match: /\b(?:high ground|rocky ledge)\b/giu, scene: /\b(?:stands?|standing|feet|beneath|figure)\b/i }
  ],
  'Eight of Wands': [
    { id: 'flying-staffs', match: /\b(?:eight wands|diagonal staffs)\b/giu, scene: /\b(?:sky|air|fly\w*|slant\w*)\b/i },
    { id: 'river', match: /\briver\b/giu, scene: /\b(?:landscape|below|winds?|winding|painted|water)\b/i }
  ],
  'Nine of Wands': [
    { id: 'head-bandage', match: /\b(?:head bandage|bandaged forehead)\b/giu, scene: /\b(?:wear\w*|head|forehead|figure|wrapped)\b/i },
    { id: 'staff-barrier', match: /\b(?:row of staffs|eight staffs)\b/giu, scene: /\b(?:behind|planted|stand\w*|upright)\b/i }
  ],
  'Ten of Wands': [
    { id: 'bundle', match: /\b(?:bundle of wands|ten staffs)\b/giu, scene: /\b(?:carr\w*|hold\w*|held|bent|figure)\b/i },
    { id: 'distant-town', match: /\b(?:distant town|buildings ahead)\b/giu, scene: /\b(?:visible|painted|ahead|path|distance)\b/i }
  ],
  'Page of Wands': [
    { id: 'upright-staff', match: /\b(?:upright staff|sprouting staff)\b/giu, scene: /\b(?:holds?|holding|held|examin\w*|hand)\b/i },
    { id: 'hat-feather', match: /\b(?:hat feather|red feather)\b/giu, scene: /\b(?:hat|cap|wear\w*|tucked)\b/i }
  ],
  'Knight of Wands': [
    { id: 'rearing-horse', match: /\b(?:rearing horse|raised forelegs)\b/giu, scene: /\b(?:horse|rides?|rider|hooves|legs)\b/i },
    { id: 'helmet-plume', match: /\b(?:helmet plume|red plume)\b/giu, scene: /\b(?:helmet|head|wear\w*|curves?)\b/i }
  ],
  'Queen of Wands': [
    { id: 'sunflower', match: /\bsunflower\b/giu, scene: /\b(?:holds?|holding|held|hand|petals)\b/i },
    { id: 'black-cat', match: /\bblack cat\b/giu, scene: /\b(?:sits?|seated|feet|throne|front)\b/i }
  ],
  'King of Wands': [
    { id: 'ground-salamander', match: /\b(?:salamander|small lizard)\b/giu, scene: /\b(?:ground|floor|feet|throne|beside)\b/i },
    { id: 'held-wand', match: /\b(?:held wand|upright wand)\b/giu, scene: /\b(?:holds?|holding|held|hand|throne)\b/i }
  ],
  'Ace of Swords': [
    { id: 'crown', match: /\b(?:golden )?crown\b/giu, scene: /\b(?:sword|blade|tip|pierc\w*)\b/i },
    { id: 'cloud-hand', match: /\b(?:hand from a cloud|emerging hand)\b/giu, scene: /\b(?:cloud|hold\w*|grip\w*|sword)\b/i }
  ],
  'Two of Swords': [
    { id: 'blindfold', match: /\bblindfold\b/giu, scene: /\b(?:wear\w*|eyes|face|woman|figure)\b/i },
    { id: 'crossed-swords', match: /\b(?:crossed swords|two raised swords)\b/giu, scene: /\b(?:holds?|holding|held|arms|chest)\b/i }
  ],
  'Three of Swords': [
    { id: 'pierced-heart', match: /\b(?:red heart|pierced heart)\b/giu, scene: /\b(?:swords|blades|pierc\w*)\b/i },
    { id: 'rain', match: /\b(?:falling rain|rain lines)\b/giu, scene: /\b(?:clouds?|streak\w*|sky|background)\b/i }
  ],
  'Four of Swords': [
    { id: 'praying-hands', match: /\b(?:praying hands|joined hands)\b/giu, scene: /\b(?:effigy|figure|tomb|chest|lying)\b/i },
    { id: 'hanging-swords', match: /\b(?:three hanging swords|three swords on the wall)\b/giu, scene: /\b(?:wall|above|tomb|effigy)\b/i }
  ],
  'Five of Swords': [
    { id: 'fallen-swords', match: /\b(?:two fallen swords|swords on the ground)\b/giu, scene: /\b(?:ground|lie|lying|fallen|foreground)\b/i },
    { id: 'departing-figures', match: /\b(?:departing figures|two figures walking away)\b/giu, scene: /\b(?:shore|backs?|walk\w*|turned|distance)\b/i }
  ],
  'Six of Swords': [
    { id: 'boat-passengers', match: /\b(?:two passengers|seated passengers)\b/giu, scene: /\b(?:boat|ferry|sit\w*|seated|cloaked)\b/i },
    { id: 'planted-swords', match: /\b(?:six swords|upright swords)\b/giu, scene: /\b(?:boat|bow|planted|stand\w*)\b/i }
  ],
  'Eight of Swords': [
    { id: 'blindfold', match: /\bblindfold\b/giu, scene: /\b(?:wear\w*|eyes|face|woman|figure)\b/i },
    { id: 'bindings', match: /\b(?:bindings|bound arms)\b/giu, scene: /\b(?:wrap\w*|body|torso|figure|arms)\b/i }
  ],
  'Nine of Swords': [
    { id: 'sword-row', match: /\b(?:nine swords|horizontal swords)\b/giu, scene: /\b(?:wall|hang\w*|above|bed|rows?)\b/i },
    { id: 'rose-quilt', match: /\b(?:rose quilt|patterned quilt)\b/giu, scene: /\b(?:bed|cover\w*|roses?|squares?)\b/i }
  ],
  'Ten of Swords': [
    { id: 'ten-blades', match: /\b(?:ten swords|upright blades)\b/giu, scene: /\b(?:back|body|figure|pierc\w*)\b/i },
    { id: 'bright-horizon', match: /\b(?:bright horizon|yellow horizon)\b/giu, scene: /\b(?:sky|dark|distant|sea|beyond)\b/i }
  ],
  'Page of Swords': [
    { id: 'raised-sword', match: /\b(?:raised sword|upright blade)\b/giu, scene: /\b(?:holds?|holding|held|hands?|figure)\b/i },
    { id: 'birds', match: /\b(?:flock of birds|small birds)\b/giu, scene: /\b(?:sky|above|fly\w*|air)\b/i }
  ],
  'Knight of Swords': [
    { id: 'raised-sword', match: /\b(?:raised sword|upraised blade)\b/giu, scene: /\b(?:holds?|holding|held|hand|rider)\b/i },
    { id: 'charging-horse', match: /\b(?:charging horse|white horse)\b/giu, scene: /\b(?:rides?|riding|rider|mane|head|gallop\w*)\b/i }
  ],
  'Queen of Swords': [
    { id: 'upright-sword', match: /\b(?:upright sword|vertical blade)\b/giu, scene: /\b(?:holds?|holding|held|hand|throne)\b/i },
    { id: 'open-hand', match: /\b(?:open hand|outstretched hand)\b/giu, scene: /\b(?:palm|rais\w*|extends?|extending|figure)\b/i }
  ],
  'King of Swords': [
    { id: 'held-sword', match: /\b(?:held sword|upright sword)\b/giu, scene: /\b(?:holds?|holding|held|hand|throne)\b/i },
    { id: 'throne-carving', match: /\b(?:butterfly carving|carved throne)\b/giu, scene: /\b(?:butterfl\w*|behind|stone|head|backrest)\b/i }
  ]
};

/** Synthetic literal probes for geometry/rule checks; never recorded readings. */
export const WAND_SWORD_EXAMPLES = [
  ['Two of Wands', 'globe', 'The figure holds a small globe in one hand.'],
  ['Two of Wands', 'distant-water', 'The distant sea is visible beyond the stone wall.'],
  ['Three of Wands', 'ships', 'Ships sail across the water below the figure.'],
  ['Three of Wands', 'three-staffs', 'Three staffs stand planted around the figure.'],
  ['Four of Wands', 'garland', 'A garland hangs between the upright staffs.'],
  ['Four of Wands', 'celebrants', 'Two celebrants hold flowers in raised hands.'],
  ['Six of Wands', 'laurel-wreath', 'A laurel wreath is tied near the top of the staff.'],
  ['Six of Wands', 'white-horse', 'The rider is mounted on a white horse.'],
  ['Seven of Wands', 'defending-staff', 'The figure holds a diagonal staff across his body.'],
  ['Seven of Wands', 'high-ground', 'The figure stands on a rocky ledge above the other staffs.'],
  ['Eight of Wands', 'flying-staffs', 'Eight wands slant through the open sky.'],
  ['Eight of Wands', 'river', 'A river winds through the landscape below.'],
  ['Nine of Wands', 'head-bandage', 'The figure wears a head bandage wrapped across the forehead.'],
  ['Nine of Wands', 'staff-barrier', 'A row of staffs stands upright behind the figure.'],
  ['Ten of Wands', 'bundle', 'The bent figure carries a bundle of wands.'],
  ['Ten of Wands', 'distant-town', 'The distant town is visible ahead on the path.'],
  ['Page of Wands', 'upright-staff', 'The figure holds an upright staff and examines its tip.'],
  ['Page of Wands', 'hat-feather', 'A red feather is tucked into the hat.'],
  ['Knight of Wands', 'rearing-horse', 'The rider sits on a rearing horse with raised forelegs.'],
  ['Knight of Wands', 'helmet-plume', 'A red plume curves away from the helmet.'],
  ['Queen of Wands', 'sunflower', 'The seated figure holds a sunflower in one hand.'],
  ['Queen of Wands', 'black-cat', 'A black cat sits in front of the throne.'],
  ['King of Wands', 'ground-salamander', 'A small lizard rests on the ground beside the throne.'],
  ['King of Wands', 'held-wand', 'The figure holds an upright wand in one hand.'],
  ['Ace of Swords', 'crown', 'A golden crown surrounds the tip of the sword.'],
  ['Ace of Swords', 'cloud-hand', 'A hand from a cloud grips the sword.'],
  ['Two of Swords', 'blindfold', 'The seated figure wears a blindfold over her eyes.'],
  ['Two of Swords', 'crossed-swords', 'She holds crossed swords above her chest.'],
  ['Three of Swords', 'pierced-heart', 'Three blades pierce a red heart.'],
  ['Three of Swords', 'rain', 'Falling rain streaks the background beneath the clouds.'],
  ['Four of Swords', 'praying-hands', 'The lying effigy has joined hands above its chest.'],
  ['Four of Swords', 'hanging-swords', 'Three hanging swords appear on the wall above the tomb.'],
  ['Five of Swords', 'fallen-swords', 'Two fallen swords lie on the ground in the foreground.'],
  ['Five of Swords', 'departing-figures', 'Two figures walking away have their backs turned toward the shore.'],
  ['Six of Swords', 'boat-passengers', 'Two passengers sit together in the boat.'],
  ['Six of Swords', 'planted-swords', 'Six swords stand planted in the bow of the boat.'],
  ['Eight of Swords', 'blindfold', 'The standing figure wears a blindfold over her eyes.'],
  ['Eight of Swords', 'bindings', 'Bindings wrap around the figure and pin her arms against her body.'],
  ['Nine of Swords', 'sword-row', 'Nine swords hang in horizontal rows above the bed.'],
  ['Nine of Swords', 'rose-quilt', 'A patterned quilt covers the bed with roses in its squares.'],
  ['Ten of Swords', 'ten-blades', 'Ten swords pierce the back of the prone figure.'],
  ['Ten of Swords', 'bright-horizon', 'A yellow horizon appears beyond the sea beneath the dark sky.'],
  ['Page of Swords', 'raised-sword', 'The figure grips a raised sword in both hands.'],
  ['Page of Swords', 'birds', 'A flock of birds flies in the sky above the figure.'],
  ['Knight of Swords', 'raised-sword', 'The rider holds a raised sword in one hand.'],
  ['Knight of Swords', 'charging-horse', 'The rider leans above the head of a charging horse.'],
  ['Queen of Swords', 'upright-sword', 'The seated figure holds an upright sword in one hand.'],
  ['Queen of Swords', 'open-hand', 'She extends an open hand with the palm raised.'],
  ['King of Swords', 'held-sword', 'The seated figure holds an upright sword in one hand.'],
  ['King of Swords', 'throne-carving', 'A butterfly carving appears on the stone backrest behind his head.']
].map(([card, detailId, description]) => ({ card, detailId, text: `${card}. ${description}` }));
