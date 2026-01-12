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
  },

  // Card 4: The Emperor
  4: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[4].symbols[0], // Ram heads
        shape: 'rect',
        x: 80,
        y: 180,
        width: 160,
        height: 140,
        indicatorCx: 160,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[4].symbols[1], // Mountains
        shape: 'rect',
        x: 600,
        y: 150,
        width: 180,
        height: 300,
        indicatorCx: 690,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[4].symbols[2], // Scepter (ankh)
        shape: 'rect',
        x: 100,
        y: 380,
        width: 100,
        height: 280,
        indicatorCx: 150,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[4].symbols[3], // Orb
        shape: 'circle',
        cx: 620,
        cy: 620,
        r: 55,
        indicatorCx: 620,
        indicatorCy: 620
      },
      {
        symbol: SYMBOL_ANNOTATIONS[4].symbols[4], // Armor
        shape: 'rect',
        x: 300,
        y: 500,
        width: 220,
        height: 180,
        indicatorCx: 410,
        indicatorCy: 590
      }
    ]
  },

  // Card 5: The Hierophant
  5: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[5].symbols[0], // Crossed keys
        shape: 'rect',
        x: 320,
        y: 1150,
        width: 180,
        height: 120,
        indicatorCx: 410,
        indicatorCy: 1210
      },
      {
        symbol: SYMBOL_ANNOTATIONS[5].symbols[1], // Two acolytes
        shape: 'rect',
        x: 120,
        y: 950,
        width: 580,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1050
      },
      {
        symbol: SYMBOL_ANNOTATIONS[5].symbols[2], // Raised hand (blessing)
        shape: 'circle',
        cx: 280,
        cy: 420,
        r: 70,
        indicatorCx: 280,
        indicatorCy: 420
      },
      {
        symbol: SYMBOL_ANNOTATIONS[5].symbols[3], // Triple cross (staff)
        shape: 'rect',
        x: 520,
        y: 200,
        width: 100,
        height: 350,
        indicatorCx: 570,
        indicatorCy: 320
      },
      {
        symbol: SYMBOL_ANNOTATIONS[5].symbols[4], // Pillars
        shape: 'rect',
        x: 50,
        y: 100,
        width: 720,
        height: 400,
        indicatorCx: 150,
        indicatorCy: 250
      }
    ]
  },

  // Card 6: The Lovers
  6: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[6].symbols[0], // Angel
        shape: 'rect',
        x: 250,
        y: 80,
        width: 320,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[6].symbols[1], // Tree of knowledge (with serpent)
        shape: 'rect',
        x: 40,
        y: 500,
        width: 180,
        height: 500,
        indicatorCx: 130,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[6].symbols[2], // Tree of life (flames)
        shape: 'rect',
        x: 600,
        y: 500,
        width: 180,
        height: 500,
        indicatorCx: 690,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[6].symbols[3], // Mountain
        shape: 'rect',
        x: 320,
        y: 900,
        width: 180,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1000
      },
      {
        symbol: SYMBOL_ANNOTATIONS[6].symbols[4], // Cloud
        shape: 'rect',
        x: 200,
        y: 420,
        width: 420,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 495
      }
    ]
  },

  // Card 7: The Chariot
  7: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[7].symbols[0], // Sphinxes
        shape: 'rect',
        x: 100,
        y: 1000,
        width: 620,
        height: 280,
        indicatorCx: 410,
        indicatorCy: 1140
      },
      {
        symbol: SYMBOL_ANNOTATIONS[7].symbols[1], // Starry canopy
        shape: 'rect',
        x: 150,
        y: 100,
        width: 520,
        height: 220,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[7].symbols[2], // City (background)
        shape: 'rect',
        x: 40,
        y: 380,
        width: 180,
        height: 200,
        indicatorCx: 130,
        indicatorCy: 480
      },
      {
        symbol: SYMBOL_ANNOTATIONS[7].symbols[4], // Armor with symbols
        shape: 'rect',
        x: 280,
        y: 350,
        width: 260,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 500
      }
    ]
  },

  // Card 8: Strength
  8: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[8].symbols[0], // Lion
        shape: 'rect',
        x: 250,
        y: 650,
        width: 350,
        height: 400,
        indicatorCx: 425,
        indicatorCy: 850
      },
      {
        symbol: SYMBOL_ANNOTATIONS[8].symbols[1], // Infinity symbol
        shape: 'circle',
        cx: 340,
        cy: 180,
        r: 50,
        indicatorCx: 340,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[8].symbols[2], // Flowers (in hair/garland)
        shape: 'rect',
        x: 280,
        y: 200,
        width: 200,
        height: 150,
        indicatorCx: 380,
        indicatorCy: 275
      },
      {
        symbol: SYMBOL_ANNOTATIONS[8].symbols[3], // Mountains
        shape: 'rect',
        x: 40,
        y: 900,
        width: 200,
        height: 180,
        indicatorCx: 140,
        indicatorCy: 990
      }
    ]
  },

  // Card 9: The Hermit
  9: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[9].symbols[0], // Lantern
        shape: 'rect',
        x: 120,
        y: 180,
        width: 150,
        height: 200,
        indicatorCx: 195,
        indicatorCy: 280
      },
      {
        symbol: SYMBOL_ANNOTATIONS[9].symbols[1], // Six-pointed star (in lantern)
        shape: 'circle',
        cx: 195,
        cy: 260,
        r: 45,
        indicatorCx: 195,
        indicatorCy: 260
      },
      {
        symbol: SYMBOL_ANNOTATIONS[9].symbols[2], // Staff
        shape: 'rect',
        x: 350,
        y: 200,
        width: 80,
        height: 700,
        indicatorCx: 390,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[9].symbols[3], // Mountain peak
        shape: 'rect',
        x: 100,
        y: 1050,
        width: 620,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1150
      },
      {
        symbol: SYMBOL_ANNOTATIONS[9].symbols[4], // Cloak
        shape: 'rect',
        x: 280,
        y: 300,
        width: 250,
        height: 600,
        indicatorCx: 405,
        indicatorCy: 600
      }
    ]
  },

  // Card 10: Wheel of Fortune
  10: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[10].symbols[0], // Wheel
        shape: 'circle',
        cx: 410,
        cy: 650,
        r: 220,
        indicatorCx: 410,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[10].symbols[1], // Sphinx
        shape: 'rect',
        x: 300,
        y: 300,
        width: 220,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[10].symbols[2], // Snake (descending)
        shape: 'rect',
        x: 180,
        y: 550,
        width: 120,
        height: 250,
        indicatorCx: 240,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[10].symbols[3], // Anubis (rising)
        shape: 'rect',
        x: 520,
        y: 550,
        width: 140,
        height: 250,
        indicatorCx: 590,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[10].symbols[6], // Four fixed signs (corners)
        shape: 'rect',
        x: 40,
        y: 100,
        width: 200,
        height: 200,
        indicatorCx: 140,
        indicatorCy: 200
      }
    ]
  },

  // Card 11: Justice
  11: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[11].symbols[0], // Scales
        shape: 'rect',
        x: 550,
        y: 400,
        width: 180,
        height: 250,
        indicatorCx: 640,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[11].symbols[1], // Sword
        shape: 'rect',
        x: 100,
        y: 250,
        width: 120,
        height: 400,
        indicatorCx: 160,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[11].symbols[2], // Pillars
        shape: 'rect',
        x: 40,
        y: 150,
        width: 100,
        height: 700,
        indicatorCx: 90,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[11].symbols[3], // Purple veil
        shape: 'rect',
        x: 150,
        y: 150,
        width: 520,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 350
      }
    ]
  },

  // Card 12: The Hanged Man
  12: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[12].symbols[0], // Tree (living wood)
        shape: 'rect',
        x: 150,
        y: 80,
        width: 520,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 150
      },
      {
        symbol: SYMBOL_ANNOTATIONS[12].symbols[1], // Halo
        shape: 'circle',
        cx: 410,
        cy: 920,
        r: 80,
        indicatorCx: 410,
        indicatorCy: 920
      },
      {
        symbol: SYMBOL_ANNOTATIONS[12].symbols[2], // Crossed leg
        shape: 'rect',
        x: 300,
        y: 300,
        width: 220,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 425
      },
      {
        symbol: SYMBOL_ANNOTATIONS[12].symbols[3], // Tau cross (tree shape)
        shape: 'rect',
        x: 350,
        y: 100,
        width: 120,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 175
      }
    ]
  },

  // Card 13: Death
  13: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[13].symbols[0], // Skeleton rider
        shape: 'rect',
        x: 80,
        y: 150,
        width: 350,
        height: 550,
        indicatorCx: 255,
        indicatorCy: 425
      },
      {
        symbol: SYMBOL_ANNOTATIONS[13].symbols[1], // White horse
        shape: 'rect',
        x: 200,
        y: 400,
        width: 350,
        height: 450,
        indicatorCx: 375,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[13].symbols[2], // Banner (white rose)
        shape: 'rect',
        x: 480,
        y: 80,
        width: 200,
        height: 280,
        indicatorCx: 580,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[13].symbols[3], // Sun rising
        shape: 'rect',
        x: 600,
        y: 350,
        width: 180,
        height: 200,
        indicatorCx: 690,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[13].symbols[4], // Fallen figures
        shape: 'rect',
        x: 40,
        y: 850,
        width: 300,
        height: 300,
        indicatorCx: 190,
        indicatorCy: 1000
      }
    ]
  },

  // Card 14: Temperance
  14: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[0], // Angel
        shape: 'rect',
        x: 200,
        y: 100,
        width: 420,
        height: 550,
        indicatorCx: 410,
        indicatorCy: 350
      },
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[1], // Cups (pouring)
        shape: 'rect',
        x: 250,
        y: 450,
        width: 320,
        height: 180,
        indicatorCx: 410,
        indicatorCy: 540
      },
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[2], // One foot in water
        shape: 'rect',
        x: 200,
        y: 1000,
        width: 200,
        height: 200,
        indicatorCx: 300,
        indicatorCy: 1100
      },
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[3], // One foot on land
        shape: 'rect',
        x: 420,
        y: 950,
        width: 200,
        height: 200,
        indicatorCx: 520,
        indicatorCy: 1050
      },
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[4], // Mountain path
        shape: 'rect',
        x: 50,
        y: 700,
        width: 200,
        height: 250,
        indicatorCx: 150,
        indicatorCy: 825
      },
      {
        symbol: SYMBOL_ANNOTATIONS[14].symbols[5], // Rising sun
        shape: 'circle',
        cx: 130,
        cy: 800,
        r: 60,
        indicatorCx: 130,
        indicatorCy: 800
      }
    ]
  },

  // Card 15: The Devil
  15: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[15].symbols[0], // Horned figure
        shape: 'rect',
        x: 200,
        y: 100,
        width: 420,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 350
      },
      {
        symbol: SYMBOL_ANNOTATIONS[15].symbols[1], // Inverted pentagram
        shape: 'circle',
        cx: 410,
        cy: 120,
        r: 60,
        indicatorCx: 410,
        indicatorCy: 120
      },
      {
        symbol: SYMBOL_ANNOTATIONS[15].symbols[2], // Chained figures
        shape: 'rect',
        x: 150,
        y: 750,
        width: 520,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 950
      },
      {
        symbol: SYMBOL_ANNOTATIONS[15].symbols[3], // Tails (grape and flame)
        shape: 'rect',
        x: 100,
        y: 950,
        width: 150,
        height: 200,
        indicatorCx: 175,
        indicatorCy: 1050
      },
      {
        symbol: SYMBOL_ANNOTATIONS[15].symbols[4], // Torch (downward)
        shape: 'rect',
        x: 580,
        y: 800,
        width: 120,
        height: 250,
        indicatorCx: 640,
        indicatorCy: 925
      }
    ]
  },

  // Card 16: The Tower
  16: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[16].symbols[0], // Lightning
        shape: 'rect',
        x: 450,
        y: 80,
        width: 200,
        height: 300,
        indicatorCx: 550,
        indicatorCy: 200
      },
      {
        symbol: SYMBOL_ANNOTATIONS[16].symbols[1], // Tower
        shape: 'rect',
        x: 280,
        y: 200,
        width: 260,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[16].symbols[2], // Falling figures
        shape: 'rect',
        x: 80,
        y: 350,
        width: 200,
        height: 350,
        indicatorCx: 180,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[16].symbols[3], // Flaming debris
        shape: 'rect',
        x: 50,
        y: 500,
        width: 150,
        height: 200,
        indicatorCx: 125,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[16].symbols[4], // Crown (knocked off)
        shape: 'circle',
        cx: 250,
        cy: 150,
        r: 70,
        indicatorCx: 250,
        indicatorCy: 150
      }
    ]
  },

  // Card 17: The Star
  17: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[0], // Large star
        shape: 'circle',
        cx: 410,
        cy: 180,
        r: 100,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[1], // Seven smaller stars
        shape: 'rect',
        x: 150,
        y: 100,
        width: 520,
        height: 200,
        indicatorCx: 250,
        indicatorCy: 150
      },
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[2], // Naked figure
        shape: 'rect',
        x: 200,
        y: 400,
        width: 350,
        height: 500,
        indicatorCx: 375,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[3], // Pitchers (pouring water)
        shape: 'rect',
        x: 150,
        y: 600,
        width: 180,
        height: 200,
        indicatorCx: 240,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[4], // Pool
        shape: 'rect',
        x: 100,
        y: 850,
        width: 350,
        height: 250,
        indicatorCx: 275,
        indicatorCy: 975
      },
      {
        symbol: SYMBOL_ANNOTATIONS[17].symbols[6], // Bird in tree
        shape: 'rect',
        x: 620,
        y: 450,
        width: 150,
        height: 200,
        indicatorCx: 695,
        indicatorCy: 550
      }
    ]
  },

  // Card 18: The Moon
  18: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[18].symbols[0], // Full moon with face
        shape: 'circle',
        cx: 410,
        cy: 220,
        r: 130,
        indicatorCx: 410,
        indicatorCy: 220
      },
      {
        symbol: SYMBOL_ANNOTATIONS[18].symbols[1], // Two towers
        shape: 'rect',
        x: 50,
        y: 400,
        width: 150,
        height: 250,
        indicatorCx: 125,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[18].symbols[2], // Dog and wolf
        shape: 'rect',
        x: 150,
        y: 600,
        width: 520,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 750
      },
      {
        symbol: SYMBOL_ANNOTATIONS[18].symbols[3], // Crayfish
        shape: 'rect',
        x: 300,
        y: 950,
        width: 220,
        height: 180,
        indicatorCx: 410,
        indicatorCy: 1040
      },
      {
        symbol: SYMBOL_ANNOTATIONS[18].symbols[4], // Winding path
        shape: 'rect',
        x: 350,
        y: 500,
        width: 120,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 700
      }
    ]
  },

  // Card 19: The Sun
  19: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[19].symbols[0], // Radiant sun with face
        shape: 'circle',
        cx: 410,
        cy: 200,
        r: 150,
        indicatorCx: 410,
        indicatorCy: 200
      },
      {
        symbol: SYMBOL_ANNOTATIONS[19].symbols[1], // Naked child on horse
        shape: 'rect',
        x: 200,
        y: 650,
        width: 350,
        height: 400,
        indicatorCx: 375,
        indicatorCy: 850
      },
      {
        symbol: SYMBOL_ANNOTATIONS[19].symbols[2], // Sunflowers
        shape: 'rect',
        x: 50,
        y: 550,
        width: 200,
        height: 250,
        indicatorCx: 150,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[19].symbols[3], // Red banner
        shape: 'rect',
        x: 500,
        y: 500,
        width: 250,
        height: 400,
        indicatorCx: 625,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[19].symbols[4], // Wall
        shape: 'rect',
        x: 50,
        y: 750,
        width: 720,
        height: 100,
        indicatorCx: 410,
        indicatorCy: 800
      }
    ]
  },

  // Card 20: Judgement
  20: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[20].symbols[0], // Angel
        shape: 'rect',
        x: 200,
        y: 80,
        width: 420,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[20].symbols[1], // Trumpet
        shape: 'rect',
        x: 300,
        y: 300,
        width: 220,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[20].symbols[2], // Rising figures
        shape: 'rect',
        x: 100,
        y: 650,
        width: 620,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[20].symbols[3], // Mountains
        shape: 'rect',
        x: 550,
        y: 500,
        width: 220,
        height: 200,
        indicatorCx: 660,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[20].symbols[4], // Water
        shape: 'rect',
        x: 100,
        y: 1000,
        width: 620,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 1075
      }
    ]
  },

  // Card 21: The World
  21: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[21].symbols[0], // Dancer
        shape: 'rect',
        x: 250,
        y: 300,
        width: 320,
        height: 600,
        indicatorCx: 410,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[21].symbols[1], // Wreath
        shape: 'circle',
        cx: 410,
        cy: 650,
        r: 280,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[21].symbols[2], // Wands (in hands)
        shape: 'rect',
        x: 200,
        y: 450,
        width: 100,
        height: 200,
        indicatorCx: 250,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[21].symbols[3], // Four fixed signs (corners)
        shape: 'rect',
        x: 40,
        y: 80,
        width: 180,
        height: 180,
        indicatorCx: 130,
        indicatorCy: 170
      },
      {
        symbol: SYMBOL_ANNOTATIONS[21].symbols[4], // Red ribbon
        shape: 'rect',
        x: 350,
        y: 100,
        width: 120,
        height: 100,
        indicatorCx: 410,
        indicatorCy: 150
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
