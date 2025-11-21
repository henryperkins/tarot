import { SYMBOL_ANNOTATIONS } from '../../shared/symbols/symbolAnnotations';

/**
 * symbolCoordinates.js
 * SVG coordinate mappings for interactive card symbol tooltips
 *
 * ViewBox: 820 x 1430 (standard RWS card aspect ratio)
 * Coordinates are approximate and based on typical RWS 1909 composition
 *
 * Touch targets are generous (60-100 units) for mobile usability
 *
 * Shape types:
 * - circle: { shape: 'circle', cx, cy, r }
 * - rect: { shape: 'rect', x, y, width, height }
 * - polygon: { shape: 'polygon', points: 'x1,y1 x2,y2 ...' }
 *
 * indicatorCx/Cy: Optional pulsing dot to show interactivity
 */

export const SYMBOL_COORDINATES = {
  // Card 0: The Fool
  0: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[0], // Sun
        shape: 'circle',
        cx: 120,
        cy: 140,
        r: 70,
        indicatorCx: 120,
        indicatorCy: 140
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[1], // Dog
        shape: 'rect',
        x: 520,
        y: 1100,
        width: 150,
        height: 180,
        indicatorCx: 595,
        indicatorCy: 1190
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[2], // Cliff
        shape: 'rect',
        x: 700,
        y: 600,
        width: 100,
        height: 400,
        indicatorCx: 750,
        indicatorCy: 800
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[3], // White rose
        shape: 'circle',
        cx: 200,
        cy: 620,
        r: 50,
        indicatorCx: 200,
        indicatorCy: 620
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[4], // Bundle
        shape: 'circle',
        cx: 250,
        cy: 380,
        r: 60,
        indicatorCx: 250,
        indicatorCy: 380
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[5], // Feather in hat
        shape: 'circle',
        cx: 440,
        cy: 180,
        r: 45,
        indicatorCx: 440,
        indicatorCy: 180
      }
    ]
  },

  // Card 1: The Magician
  1: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[0], // Infinity symbol
        shape: 'circle',
        cx: 410,
        cy: 120,
        r: 55,
        indicatorCx: 410,
        indicatorCy: 120
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[1], // Wand (right hand raised)
        shape: 'rect',
        x: 550,
        y: 320,
        width: 80,
        height: 180,
        indicatorCx: 590,
        indicatorCy: 410
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[2], // Cup on table
        shape: 'circle',
        cx: 220,
        cy: 950,
        r: 60,
        indicatorCx: 220,
        indicatorCy: 950
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[3], // Sword on table
        shape: 'rect',
        x: 360,
        y: 920,
        width: 100,
        height: 80,
        indicatorCx: 410,
        indicatorCy: 960
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[4], // Pentacle on table
        shape: 'circle',
        cx: 600,
        cy: 950,
        r: 60,
        indicatorCx: 600,
        indicatorCy: 950
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[5], // Red roses (garden)
        shape: 'rect',
        x: 150,
        y: 1250,
        width: 200,
        height: 120,
        indicatorCx: 250,
        indicatorCy: 1310
      },
      {
        symbol: SYMBOL_ANNOTATIONS[1].symbols[6], // White lilies (garden)
        shape: 'rect',
        x: 470,
        y: 1250,
        width: 200,
        height: 120,
        indicatorCx: 570,
        indicatorCy: 1310
      }
    ]
  },

  // Card 2: The High Priestess
  2: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[2].symbols[0], // Pillars (B & J)
        shape: 'rect',
        x: 40,
        y: 350,
        width: 740,
        height: 800,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[2].symbols[1], // Lunar crown
        shape: 'circle',
        cx: 410,
        cy: 180,
        r: 80,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[2].symbols[2], // Scroll (Tora)
        shape: 'rect',
        x: 310,
        y: 850,
        width: 200,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 925
      },
      {
        symbol: SYMBOL_ANNOTATIONS[2].symbols[3], // Veil
        shape: 'rect',
        x: 150,
        y: 300,
        width: 520,
        height: 600,
        indicatorCx: 250,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[2].symbols[5], // Crescent moon
        shape: 'circle',
        cx: 200,
        cy: 1250,
        r: 90,
        indicatorCx: 200,
        indicatorCy: 1250
      }
    ]
  },

  // Card 3: The Empress
  3: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[3].symbols[0], // Wheat fields
        shape: 'rect',
        x: 50,
        y: 1100,
        width: 300,
        height: 250,
        indicatorCx: 200,
        indicatorCy: 1225
      },
      {
        symbol: SYMBOL_ANNOTATIONS[3].symbols[2], // Venus shield
        shape: 'circle',
        cx: 650,
        cy: 1100,
        r: 100,
        indicatorCx: 650,
        indicatorCy: 1100
      },
      {
        symbol: SYMBOL_ANNOTATIONS[3].symbols[3], // Scepter
        shape: 'rect',
        x: 580,
        y: 350,
        width: 80,
        height: 400,
        indicatorCx: 620,
        indicatorCy: 450
      }
    ]
  }
};

/**
 * NOTES FOR FUTURE COORDINATE MAPPING:
 *
 * 1. View the actual card image at public/images/cards/RWS1909_-_XX_*.jpeg
 * 2. Use an SVG editor or browser dev tools to measure positions
 * 3. Coordinate system: (0,0) is top-left, (820, 1430) is bottom-right
 * 4. Make touch targets 60-100 units minimum for mobile usability
 * 5. Use indicatorCx/Cy to place pulsing dots at symbol centers
 * 6. Prefer circles for radial/organic symbols, rects for geometric ones
 * 7. Use polygons for complex/irregular shapes (e.g., flowing robes, animals)
 *
 * TESTING COORDINATES:
 * - Open card in browser
 * - Enable overlay by setting feature flag
 * - Adjust coordinates in dev tools until alignment is correct
 * - Fine-tune for all screen sizes (mobile, tablet, desktop)
 */
