const assetRoot = '/assets/rws-immanuelle/';

export const ARTWORK = {
  ace: {
    name: 'Ace of Wands',
    position: 'Core',
    image: `${assetRoot}wands-01.svg`,
    width: 1086,
    height: 1810,
    reversed: false,
    alt: 'Ace of Wands, upright. A hand reaches from a cloud holding a leafy wand, with a small castle beyond the hills.'
  },
  swords: {
    name: 'Seven of Swords',
    position: 'Challenge',
    image: `${assetRoot}swords-07.svg`,
    width: 1086,
    height: 1810,
    reversed: true,
    alt: 'Seven of Swords, reversed. A figure carries five swords away from camp while two swords remain planted behind.'
  },
  queen: {
    name: 'Queen of Cups',
    position: 'Hidden influence',
    image: `${assetRoot}cups-13.svg`,
    width: 1086,
    height: 1810,
    reversed: false,
    alt: 'Queen of Cups, upright. The seated Queen looks toward an ornate covered cup at the edge of the sea.'
  },
  pentacles: {
    name: 'Three of Pentacles',
    position: 'Support',
    image: `${assetRoot}pentacles-03.svg`,
    width: 1086,
    height: 1810,
    reversed: false,
    alt: 'Three of Pentacles, upright. A craftsman and two other people discuss a plan beneath the arches of a cathedral.'
  },
  wheel: {
    name: 'Wheel of Fortune',
    position: 'Direction',
    image: `${assetRoot}major-10-wheel-of-fortune.svg`,
    width: 1086,
    height: 1810,
    reversed: true,
    alt: 'Wheel of Fortune, reversed. A great wheel is accompanied by a sphinx, a descending snake, and a rising Anubis.'
  }
};

// Coordinates describe the rendered 1086 × 1810 image, before reversal. Source
// SVG viewBoxes differ between cards. These are deliberately soft associations,
// not claims that the mask follows an exact artwork silhouette.
export const DETAILS = {
  sprout: {
    card: 'ace', x: .408, y: .34, rx: .17, ry: .30,
    frame: { x: .40, y: .30, zoom: 1.35 },
    spots: [
      { x: .408, y: .36, rx: .080, ry: .31 },
      { x: .369, y: .10, rx: .13, ry: .09 },
      { x: .355, y: .25, rx: .12, ry: .10 }
    ],
    traces: [
      'M443 1270 C442 1120 443 985 444 850 S447 585 449 465 S449 285 451 230'
    ]
  },
  castle: {
    card: 'ace', x: .200, y: .721, rx: .075, ry: .072,
    frame: { x: .20, y: .72, zoom: 1.65 }
  },
  carried: {
    card: 'swords', x: .465, y: .434, rx: .255, ry: .235,
    frame: { x: .45, y: .43, zoom: 1.15 }
  },
  'two-swords': {
    card: 'swords', x: .748, y: .601, rx: .13, ry: .24,
    frame: { x: .748, y: .601, zoom: 1.30 },
    spots: [
      { x: .696, y: .601, rx: .061, ry: .24 },
      { x: .800, y: .587, rx: .061, ry: .24 }
    ],
    traces: [
      'M758 1442 L760 888',
      'M867 1437 L868 843'
    ]
  },
  cup: {
    card: 'queen', x: .334, y: .372, rx: .14, ry: .145,
    frame: { x: .34, y: .38, zoom: 1.40 }
  },
  collaborators: {
    card: 'pentacles', x: .53, y: .54, rx: .39, ry: .24,
    frame: { x: .53, y: .53, zoom: 1.12 },
    spots: [
      { x: .52, y: .49, rx: .38, ry: .20 },
      { x: .541, y: .602, rx: .18, ry: .13 }
    ]
  },
  wheel: {
    card: 'wheel', x: .484, y: .506, rx: .31, ry: .193,
    frame: { x: .484, y: .506, zoom: 1.12 },
    traces: ['M700 1063 A229 231 0 0 1 639 1114']
  }
};

const svgNamespace = 'http://www.w3.org/2000/svg';
const percent = value => `${(value * 100).toFixed(2)}%`;

function softMask(spot) {
  return `radial-gradient(ellipse ${percent(spot.rx)} ${percent(spot.ry)} at ${percent(spot.x)} ${percent(spot.y)}, #000 0%, rgb(0 0 0 / .92) 28%, rgb(0 0 0 / .55) 58%, transparent 100%)`;
}

function imageLayer(artwork, className, decorative) {
  const image = document.createElement('img');
  image.className = className;
  image.src = artwork.image;
  image.width = artwork.width;
  image.height = artwork.height;
  image.alt = decorative ? '' : artwork.alt;
  image.decoding = 'async';
  image.draggable = false;
  if (decorative) image.setAttribute('aria-hidden', 'true');
  return image;
}

export function createArtwork(cardId, detail = null) {
  const artwork = ARTWORK[cardId];
  if (!artwork) throw new RangeError(`Unknown artwork card: ${cardId}`);

  const plane = document.createElement('span');
  plane.className = `fd-plane${artwork.reversed ? ' is-reversed' : ''}`;
  plane.dataset.card = cardId;
  plane.append(imageLayer(artwork, 'fd-base', false));

  const detailIds = detail == null ? [] : Array.isArray(detail) ? detail : [detail];
  const associations = [...new Set(detailIds)]
    .map(id => DETAILS[id])
    .filter(association => association?.card === cardId);
  if (!associations.length) return plane;

  const light = imageLayer(artwork, 'fd-light', true);
  const spots = associations.flatMap(association => association.spots || [association]);
  const mask = spots.map(softMask).join(', ');
  light.style.maskImage = mask;
  light.style.webkitMaskImage = mask;
  light.style.maskRepeat = 'no-repeat';
  light.style.webkitMaskRepeat = 'no-repeat';
  plane.append(light);

  const traces = associations.flatMap(association => association.traces || []);
  if (traces.length) {
    const trace = document.createElementNS(svgNamespace, 'svg');
    trace.setAttribute('class', 'fd-trace');
    trace.setAttribute('viewBox', '0 0 1086 1810');
    trace.setAttribute('aria-hidden', 'true');
    trace.setAttribute('focusable', 'false');
    for (const d of traces) {
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('class', 'fd-trace-path');
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-dasharray', '1');
      path.setAttribute('stroke-dashoffset', '1');
      trace.append(path);
    }
    plane.append(trace);
  }
  return plane;
}
