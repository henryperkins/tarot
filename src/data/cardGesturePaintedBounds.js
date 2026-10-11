/** Complete source-visible painted targets, independently inspected on the
 * 1086 x 1810 Immanuelle faces. Rectangles include a small paint margin;
 * soft illumination masks and motion recipes remain separately authored.
 */
const sourcePixelBounds = {
  'Ace of Cups': { 'overflowing-cup': [360, 265, 730, 1575] },
  'Ace of Wands': { sprout: [205, 65, 625, 1390] },
  'Eight of Wands': { 'flying-staffs': [61, 182, 1000, 1690] },
  'Five of Pentacles': { 'stained-glass': [244, 25, 854, 878] },
  'Five of Wands': { staffs: [130, 75, 1008, 1235] },
  Judgement: { trumpet: [266, 345, 745, 991] },
  Justice: { 'upright-sword': [88, 42, 282, 768] },
  'King of Swords': { 'held-sword': [250, 102, 476, 928] },
  'King of Wands': { 'held-wand': [95, 174, 282, 1502] },
  'Knight of Cups': { 'white-horse': [48, 633, 1006, 1574] },
  'Knight of Swords': { 'raised-sword': [218, 38, 402, 508], 'charging-horse': [58, 638, 1021, 1594] },
  'Knight of Wands': { 'rearing-horse': [58, 545, 1008, 1595] },
  'Nine of Pentacles': { 'grape-vines': [62, 665, 1005, 1600] },
  'Page of Cups': { 'fish-in-cup': [158, 433, 343, 834] },
  'Page of Wands': { 'upright-staff': [670, 166, 830, 1530] },
  'Queen of Swords': { 'upright-sword': [535, 115, 718, 1025] },
  'Seven of Pentacles': { 'pentacle-vine': [62, 568, 610, 1718] },
  'Six of Cups': { courtyard: [62, 294, 1008, 1145] },
  'Six of Pentacles': { 'giving-hand': [268, 912, 422, 1335] },
  'Six of Wands': { 'white-horse': [53, 826, 1010, 1720] },
  'Ten of Cups': { 'rainbow-cups': [55, 148, 1005, 895] },
  'Ten of Wands': { bundle: [138, 98, 984, 1518] },
  'The Devil': { 'downward-torch': [881, 701, 1034, 1277] },
  'The High Priestess': { pillars: [40, 197, 1040, 1598] },
  'The Sun': { sunflowers: [44, 734, 1040, 1109] },
  'Three of Pentacles': { collaborators: [60, 665, 910, 1725] },
  'Three of Swords': { rain: [75, 415, 995, 1690] },
  'Two of Swords': { 'crossed-swords': [54, 210, 1018, 885] }
};

export const CARD_GESTURE_PAINTED_BOUNDS = Object.freeze(Object.fromEntries(
  Object.entries(sourcePixelBounds).map(([cardName, details]) => [cardName, Object.freeze(Object.fromEntries(
    Object.entries(details).map(([detailId, [left, top, right, bottom]]) => [detailId, Object.freeze({
      left: left / 1086, top: top / 1810, right: right / 1086, bottom: bottom / 1810
    })])
  ))])
));
