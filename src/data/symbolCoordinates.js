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
  },

  // MINOR ARCANA - WANDS (22-31, 74-77)

  // Card 22: Ace of Wands
  // VERIFIED against RWS1909_-_Wands_01.jpeg
  22: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[22].symbols[0], // Hand from cloud
        shape: 'rect',
        x: 200,
        y: 580,
        width: 320,
        height: 200,
        indicatorCx: 320,
        indicatorCy: 680
      },
      {
        symbol: SYMBOL_ANNOTATIONS[22].symbols[1], // Sprouting wand
        shape: 'rect',
        x: 320,
        y: 100,
        width: 120,
        height: 780,
        indicatorCx: 380,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[22].symbols[2], // Rolling hills
        shape: 'rect',
        x: 50,
        y: 1030,
        width: 720,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 1150
      },
      {
        symbol: SYMBOL_ANNOTATIONS[22].symbols[3], // Distant castle
        shape: 'rect',
        x: 60,
        y: 870,
        width: 120,
        height: 130,
        indicatorCx: 120,
        indicatorCy: 935
      }
    ]
  },

  // Card 23: Two of Wands
  // VERIFIED against RWS1909_-_Wands_02.jpeg
  23: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[23].symbols[0], // Figure on battlements
        shape: 'rect',
        x: 280,
        y: 180,
        width: 300,
        height: 700,
        indicatorCx: 430,
        indicatorCy: 480
      },
      {
        symbol: SYMBOL_ANNOTATIONS[23].symbols[1], // Globe in hand
        shape: 'circle',
        cx: 390,
        cy: 520,
        r: 45,
        indicatorCx: 390,
        indicatorCy: 520
      },
      {
        symbol: SYMBOL_ANNOTATIONS[23].symbols[2], // Wands (left wand held, right anchored)
        shape: 'rect',
        x: 100,
        y: 120,
        width: 100,
        height: 750,
        indicatorCx: 150,
        indicatorCy: 450
      }
    ]
  },

  // Card 24: Three of Wands
  // VERIFIED against RWS1909_-_Wands_03.jpeg
  24: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[24].symbols[0], // Cloaked traveler (back to viewer)
        shape: 'rect',
        x: 250,
        y: 200,
        width: 280,
        height: 650,
        indicatorCx: 390,
        indicatorCy: 480
      },
      {
        symbol: SYMBOL_ANNOTATIONS[24].symbols[1], // Three wands (spread left to right)
        shape: 'rect',
        x: 80,
        y: 100,
        width: 580,
        height: 780,
        indicatorCx: 370,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[24].symbols[2], // Horizon/sea below
        shape: 'rect',
        x: 50,
        y: 950,
        width: 720,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1050
      }
    ]
  },

  // Card 25: Four of Wands
  // VERIFIED against RWS1909_-_Wands_04.jpeg
  25: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[25].symbols[0], // Garlanded wands arch (4 wands with garland)
        shape: 'rect',
        x: 100,
        y: 100,
        width: 620,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[25].symbols[1], // Celebrating figures (middle distance)
        shape: 'rect',
        x: 280,
        y: 580,
        width: 260,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 730
      },
      {
        symbol: SYMBOL_ANNOTATIONS[25].symbols[2], // Castle background (CENTER)
        shape: 'rect',
        x: 280,
        y: 450,
        width: 260,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 550
      }
    ]
  },

  // Card 26: Five of Wands
  // VERIFIED against RWS1909_-_Wands_05.jpeg
  26: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[26].symbols[0], // Youths in conflict (5 figures)
        shape: 'rect',
        x: 80,
        y: 180,
        width: 660,
        height: 850,
        indicatorCx: 410,
        indicatorCy: 580
      },
      {
        symbol: SYMBOL_ANNOTATIONS[26].symbols[1], // Brandished wands (5 crossing)
        shape: 'rect',
        x: 100,
        y: 100,
        width: 620,
        height: 600,
        indicatorCx: 410,
        indicatorCy: 380
      }
    ]
  },

  // Card 27: Six of Wands
  // VERIFIED against RWS1909_-_Wands_06.jpeg
  27: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[27].symbols[0], // Laureled rider (center, on white horse)
        shape: 'rect',
        x: 200,
        y: 200,
        width: 400,
        height: 700,
        indicatorCx: 380,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[27].symbols[1], // Victory wand with laurel wreath
        shape: 'rect',
        x: 340,
        y: 100,
        width: 140,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 220
      },
      {
        symbol: SYMBOL_ANNOTATIONS[27].symbols[2], // Onlookers/crowd (left side)
        shape: 'rect',
        x: 50,
        y: 350,
        width: 180,
        height: 450,
        indicatorCx: 140,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[27].symbols[3], // White horse
        shape: 'rect',
        x: 450,
        y: 500,
        width: 300,
        height: 450,
        indicatorCx: 580,
        indicatorCy: 720
      }
    ]
  },

  // Card 28: Seven of Wands
  // VERIFIED against RWS1909_-_Wands_07.jpeg
  28: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[28].symbols[0], // Defender facing viewer (elevated)
        shape: 'rect',
        x: 200,
        y: 150,
        width: 400,
        height: 600,
        indicatorCx: 400,
        indicatorCy: 420
      },
      {
        symbol: SYMBOL_ANNOTATIONS[28].symbols[1], // Defensive wand (held diagonally)
        shape: 'rect',
        x: 180,
        y: 100,
        width: 350,
        height: 400,
        indicatorCx: 320,
        indicatorCy: 280
      },
      {
        symbol: SYMBOL_ANNOTATIONS[28].symbols[2], // Six attacking wands from below
        shape: 'rect',
        x: 80,
        y: 650,
        width: 660,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 870
      }
    ]
  },

  // Card 29: Eight of Wands
  // VERIFIED against RWS1909_-_Wands_08.jpeg
  29: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[29].symbols[0], // Eight wands streaking diagonally
        shape: 'rect',
        x: 80,
        y: 100,
        width: 650,
        height: 750,
        indicatorCx: 410,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[29].symbols[1], // Landscape below (hills, river)
        shape: 'rect',
        x: 50,
        y: 900,
        width: 720,
        height: 280,
        indicatorCx: 410,
        indicatorCy: 1040
      }
    ]
  },

  // Card 30: Nine of Wands
  // VERIFIED against RWS1909_-_Wands_09.jpeg
  30: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[30].symbols[0], // Bandaged sentinel (center)
        shape: 'rect',
        x: 280,
        y: 250,
        width: 280,
        height: 650,
        indicatorCx: 420,
        indicatorCy: 530
      },
      {
        symbol: SYMBOL_ANNOTATIONS[30].symbols[1], // Eight wands as fence (row behind)
        shape: 'rect',
        x: 60,
        y: 100,
        width: 700,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[30].symbols[2], // Gripped wand (ninth)
        shape: 'rect',
        x: 460,
        y: 350,
        width: 100,
        height: 550,
        indicatorCx: 510,
        indicatorCy: 600
      }
    ]
  },

  // Card 31: Ten of Wands
  // VERIFIED against RWS1909_-_Wands_10.jpeg
  31: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[31].symbols[0], // Hunched figure (left side, walking right)
        shape: 'rect',
        x: 120,
        y: 350,
        width: 350,
        height: 600,
        indicatorCx: 295,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[31].symbols[1], // Bundled ten wands (fanned at top)
        shape: 'rect',
        x: 150,
        y: 80,
        width: 550,
        height: 550,
        indicatorCx: 425,
        indicatorCy: 320
      },
      {
        symbol: SYMBOL_ANNOTATIONS[31].symbols[2], // Town ahead (RIGHT side)
        shape: 'rect',
        x: 550,
        y: 750,
        width: 200,
        height: 200,
        indicatorCx: 650,
        indicatorCy: 850
      }
    ]
  },

  // Card 74: Page of Wands
  // VERIFIED against RWS1909_-_Wands_11.jpeg
  74: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[74].symbols[0], // Youth standing (center-left, facing left)
        shape: 'rect',
        x: 180,
        y: 120,
        width: 350,
        height: 750,
        indicatorCx: 355,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[74].symbols[1], // Sprouting wand (right side)
        shape: 'rect',
        x: 450,
        y: 100,
        width: 120,
        height: 700,
        indicatorCx: 510,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[74].symbols[2], // Pyramids (lower RIGHT)
        shape: 'rect',
        x: 500,
        y: 800,
        width: 250,
        height: 180,
        indicatorCx: 625,
        indicatorCy: 890
      },
      {
        symbol: SYMBOL_ANNOTATIONS[74].symbols[3], // Salamanders on tunic
        shape: 'rect',
        x: 280,
        y: 400,
        width: 200,
        height: 280,
        indicatorCx: 380,
        indicatorCy: 540
      },
      {
        symbol: SYMBOL_ANNOTATIONS[74].symbols[4], // Desert landscape
        shape: 'rect',
        x: 50,
        y: 900,
        width: 720,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 1020
      }
    ]
  },

  // Card 75: Knight of Wands
  // VERIFIED against RWS1909_-_Wands_12.jpeg
  75: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[0], // Armored knight (center-right)
        shape: 'rect',
        x: 280,
        y: 80,
        width: 400,
        height: 550,
        indicatorCx: 480,
        indicatorCy: 350
      },
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[1], // Sprouting wand held aloft
        shape: 'rect',
        x: 340,
        y: 60,
        width: 120,
        height: 400,
        indicatorCx: 400,
        indicatorCy: 220
      },
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[2], // Reddish horse rearing (facing left)
        shape: 'rect',
        x: 80,
        y: 350,
        width: 550,
        height: 600,
        indicatorCx: 350,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[3], // Salamanders on armor (yellow pattern)
        shape: 'rect',
        x: 350,
        y: 250,
        width: 220,
        height: 300,
        indicatorCx: 460,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[4], // Pyramids distant (bottom center-left)
        shape: 'rect',
        x: 150,
        y: 920,
        width: 200,
        height: 120,
        indicatorCx: 250,
        indicatorCy: 980
      },
      {
        symbol: SYMBOL_ANNOTATIONS[75].symbols[5], // Red/orange plume (flowing from helmet)
        shape: 'rect',
        x: 500,
        y: 100,
        width: 200,
        height: 200,
        indicatorCx: 600,
        indicatorCy: 200
      }
    ]
  },

  // Card 76: Queen of Wands
  // VERIFIED against RWS1909_-_Wands_13.jpeg
  76: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[0], // Enthroned queen (facing right)
        shape: 'rect',
        x: 180,
        y: 100,
        width: 460,
        height: 750,
        indicatorCx: 410,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[1], // Sprouting wand (LEFT hand, left side)
        shape: 'rect',
        x: 120,
        y: 150,
        width: 130,
        height: 550,
        indicatorCx: 185,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[2], // Sunflower (RIGHT hand, right side)
        shape: 'circle',
        cx: 580,
        cy: 420,
        r: 60,
        indicatorCx: 580,
        indicatorCy: 420
      },
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[3], // Black cat at feet (bottom center)
        shape: 'rect',
        x: 340,
        y: 980,
        width: 140,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 1055
      },
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[4], // Lions on throne (armrests)
        shape: 'rect',
        x: 550,
        y: 600,
        width: 150,
        height: 200,
        indicatorCx: 625,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[76].symbols[5], // Tapestry with lions (behind)
        shape: 'rect',
        x: 300,
        y: 100,
        width: 220,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 200
      }
    ]
  },

  // Card 77: King of Wands
  // VERIFIED against RWS1909_-_Wands_14.jpeg
  77: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[0], // Enthroned king (facing slightly left)
        shape: 'rect',
        x: 150,
        y: 100,
        width: 450,
        height: 750,
        indicatorCx: 375,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[1], // Sprouting wand (left side)
        shape: 'rect',
        x: 100,
        y: 150,
        width: 130,
        height: 550,
        indicatorCx: 165,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[2], // Lions on throne back
        shape: 'rect',
        x: 450,
        y: 150,
        width: 200,
        height: 300,
        indicatorCx: 550,
        indicatorCy: 280
      },
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[3], // Salamanders on throne/robe
        shape: 'rect',
        x: 450,
        y: 450,
        width: 200,
        height: 250,
        indicatorCx: 550,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[4], // Crown on head
        shape: 'circle',
        cx: 360,
        cy: 150,
        r: 50,
        indicatorCx: 360,
        indicatorCy: 150
      },
      {
        symbol: SYMBOL_ANNOTATIONS[77].symbols[5], // Salamander at feet (bottom right)
        shape: 'rect',
        x: 500,
        y: 1000,
        width: 150,
        height: 120,
        indicatorCx: 575,
        indicatorCy: 1060
      }
    ]
  },

  // MINOR ARCANA - CUPS (32-41, 42-45)

  // Card 32: Ace of Cups
  // VERIFIED against RWS1909_-_Cups_01.jpeg
  32: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[32].symbols[0], // Hand from cloud (right side)
        shape: 'rect',
        x: 450,
        y: 380,
        width: 280,
        height: 200,
        indicatorCx: 590,
        indicatorCy: 480
      },
      {
        symbol: SYMBOL_ANNOTATIONS[32].symbols[1], // Chalice (center)
        shape: 'rect',
        x: 280,
        y: 200,
        width: 260,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[32].symbols[2], // Dove descending
        shape: 'rect',
        x: 330,
        y: 100,
        width: 160,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 170
      },
      {
        symbol: SYMBOL_ANNOTATIONS[32].symbols[3], // Overflowing water (five streams)
        shape: 'rect',
        x: 250,
        y: 550,
        width: 320,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 720
      },
      {
        symbol: SYMBOL_ANNOTATIONS[32].symbols[4], // Lotus pond at bottom
        shape: 'rect',
        x: 80,
        y: 950,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1050
      }
    ]
  },

  // Card 33: Two of Cups
  // VERIFIED against RWS1909_-_Cups_02.jpeg
  33: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[33].symbols[0], // Two figures facing each other
        shape: 'rect',
        x: 100,
        y: 200,
        width: 620,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[33].symbols[1], // Cups raised in toast (center)
        shape: 'rect',
        x: 280,
        y: 400,
        width: 260,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[33].symbols[2], // Caduceus above cups
        shape: 'rect',
        x: 320,
        y: 200,
        width: 180,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[33].symbols[3], // Winged lion head
        shape: 'rect',
        x: 280,
        y: 100,
        width: 260,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 170
      }
    ]
  },

  // Card 34: Three of Cups
  // VERIFIED against RWS1909_-_Cups_03.jpeg
  34: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[34].symbols[0], // Three maidens dancing
        shape: 'rect',
        x: 100,
        y: 150,
        width: 620,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[34].symbols[1], // Raised cups in toast
        shape: 'rect',
        x: 150,
        y: 100,
        width: 520,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 220
      },
      {
        symbol: SYMBOL_ANNOTATIONS[34].symbols[2], // Fruits and gourds at feet
        shape: 'rect',
        x: 80,
        y: 900,
        width: 660,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 1020
      },
      {
        symbol: SYMBOL_ANNOTATIONS[34].symbols[3], // Flowing garments
        shape: 'rect',
        x: 200,
        y: 450,
        width: 420,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 650
      }
    ]
  },

  // Card 35: Four of Cups
  // VERIFIED against RWS1909_-_Cups_04.jpeg
  35: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[35].symbols[0], // Seated figure under tree (right side)
        shape: 'rect',
        x: 380,
        y: 300,
        width: 300,
        height: 550,
        indicatorCx: 530,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[35].symbols[1], // Three cups on ground (bottom left)
        shape: 'rect',
        x: 80,
        y: 700,
        width: 350,
        height: 350,
        indicatorCx: 255,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[35].symbols[2], // Hand from cloud offering fourth cup (top left)
        shape: 'rect',
        x: 80,
        y: 280,
        width: 250,
        height: 220,
        indicatorCx: 205,
        indicatorCy: 390
      },
      {
        symbol: SYMBOL_ANNOTATIONS[35].symbols[3], // Crossed arms (contemplation)
        shape: 'rect',
        x: 420,
        y: 450,
        width: 180,
        height: 150,
        indicatorCx: 510,
        indicatorCy: 525
      }
    ]
  },

  // Card 36: Five of Cups
  // VERIFIED against RWS1909_-_Cups_05.jpeg
  36: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[36].symbols[0], // Cloaked figure (center, head bowed)
        shape: 'rect',
        x: 280,
        y: 180,
        width: 280,
        height: 700,
        indicatorCx: 420,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[36].symbols[1], // Three spilled cups (bottom left)
        shape: 'rect',
        x: 80,
        y: 750,
        width: 280,
        height: 280,
        indicatorCx: 220,
        indicatorCy: 890
      },
      {
        symbol: SYMBOL_ANNOTATIONS[36].symbols[2], // Two standing cups (bottom right, behind figure)
        shape: 'rect',
        x: 520,
        y: 780,
        width: 200,
        height: 250,
        indicatorCx: 620,
        indicatorCy: 905
      },
      {
        symbol: SYMBOL_ANNOTATIONS[36].symbols[3], // Bridge in background
        shape: 'rect',
        x: 500,
        y: 550,
        width: 250,
        height: 150,
        indicatorCx: 625,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[36].symbols[4], // Distant castle (left background)
        shape: 'rect',
        x: 80,
        y: 450,
        width: 180,
        height: 180,
        indicatorCx: 170,
        indicatorCy: 540
      }
    ]
  },

  // Card 37: Six of Cups
  // VERIFIED against RWS1909_-_Cups_06.jpeg
  37: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[37].symbols[0], // Children in courtyard
        shape: 'rect',
        x: 200,
        y: 300,
        width: 420,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 530
      },
      {
        symbol: SYMBOL_ANNOTATIONS[37].symbols[1], // Cups with flowers (six total)
        shape: 'rect',
        x: 100,
        y: 700,
        width: 520,
        height: 380,
        indicatorCx: 360,
        indicatorCy: 890
      },
      {
        symbol: SYMBOL_ANNOTATIONS[37].symbols[2], // Older child giving cup
        shape: 'rect',
        x: 200,
        y: 350,
        width: 220,
        height: 400,
        indicatorCx: 310,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[37].symbols[3], // Tower/cottages background
        shape: 'rect',
        x: 80,
        y: 100,
        width: 250,
        height: 350,
        indicatorCx: 205,
        indicatorCy: 270
      }
    ]
  },

  // Card 38: Seven of Cups
  // VERIFIED against RWS1909_-_Cups_07.jpeg
  38: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[0], // Shadowed figure (bottom, silhouette)
        shape: 'rect',
        x: 150,
        y: 700,
        width: 280,
        height: 400,
        indicatorCx: 290,
        indicatorCy: 900
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[1], // Seven cups on clouds (floating)
        shape: 'rect',
        x: 100,
        y: 100,
        width: 620,
        height: 650,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[2], // Castle in cup (middle left)
        shape: 'rect',
        x: 100,
        y: 350,
        width: 150,
        height: 180,
        indicatorCx: 175,
        indicatorCy: 440
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[3], // Jewels in cup (center left)
        shape: 'rect',
        x: 220,
        y: 400,
        width: 150,
        height: 180,
        indicatorCx: 295,
        indicatorCy: 490
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[4], // Laurel wreath in cup (center)
        shape: 'rect',
        x: 340,
        y: 380,
        width: 140,
        height: 160,
        indicatorCx: 410,
        indicatorCy: 460
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[5], // Dragon in cup (right)
        shape: 'rect',
        x: 550,
        y: 350,
        width: 180,
        height: 200,
        indicatorCx: 640,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[38].symbols[6], // Shrouded figure/serpent (cups contain)
        shape: 'rect',
        x: 450,
        y: 500,
        width: 180,
        height: 200,
        indicatorCx: 540,
        indicatorCy: 600
      }
    ]
  },

  // Card 39: Eight of Cups
  // VERIFIED against RWS1909_-_Cups_08.jpeg
  39: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[39].symbols[0], // Figure walking away (center-right)
        shape: 'rect',
        x: 380,
        y: 350,
        width: 250,
        height: 400,
        indicatorCx: 505,
        indicatorCy: 530
      },
      {
        symbol: SYMBOL_ANNOTATIONS[39].symbols[1], // Eight stacked cups (left foreground)
        shape: 'rect',
        x: 100,
        y: 550,
        width: 350,
        height: 500,
        indicatorCx: 275,
        indicatorCy: 800
      },
      {
        symbol: SYMBOL_ANNOTATIONS[39].symbols[2], // Moon/eclipse (top left)
        shape: 'circle',
        cx: 250,
        cy: 180,
        r: 80,
        indicatorCx: 250,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[39].symbols[3], // Mountains in background
        shape: 'rect',
        x: 80,
        y: 280,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 380
      }
    ]
  },

  // Card 40: Nine of Cups
  // VERIFIED against RWS1909_-_Cups_09.jpeg
  40: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[40].symbols[0], // Seated figure (center, satisfied)
        shape: 'rect',
        x: 250,
        y: 400,
        width: 320,
        height: 550,
        indicatorCx: 410,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[40].symbols[1], // Nine cups in arc (on shelf above)
        shape: 'rect',
        x: 100,
        y: 100,
        width: 620,
        height: 280,
        indicatorCx: 410,
        indicatorCy: 230
      },
      {
        symbol: SYMBOL_ANNOTATIONS[40].symbols[2], // Blue draped table/curtain
        shape: 'rect',
        x: 100,
        y: 280,
        width: 620,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 380
      },
      {
        symbol: SYMBOL_ANNOTATIONS[40].symbols[3], // Crossed arms (contentment)
        shape: 'rect',
        x: 300,
        y: 520,
        width: 220,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 595
      }
    ]
  },

  // Card 41: Ten of Cups
  // VERIFIED against RWS1909_-_Cups_10.jpeg
  41: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[41].symbols[0], // Couple with arms raised (left)
        shape: 'rect',
        x: 100,
        y: 350,
        width: 350,
        height: 500,
        indicatorCx: 275,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[41].symbols[1], // Rainbow with ten cups
        shape: 'rect',
        x: 100,
        y: 80,
        width: 620,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 230
      },
      {
        symbol: SYMBOL_ANNOTATIONS[41].symbols[2], // Dancing children (right)
        shape: 'rect',
        x: 450,
        y: 600,
        width: 280,
        height: 300,
        indicatorCx: 590,
        indicatorCy: 750
      },
      {
        symbol: SYMBOL_ANNOTATIONS[41].symbols[3], // Home in background (far right)
        shape: 'rect',
        x: 550,
        y: 450,
        width: 180,
        height: 150,
        indicatorCx: 640,
        indicatorCy: 525
      }
    ]
  },

  // Card 42: Page of Cups
  // VERIFIED against RWS1909_-_Cups_11.jpeg
  42: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[42].symbols[0], // Youth standing (center)
        shape: 'rect',
        x: 200,
        y: 150,
        width: 420,
        height: 750,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[42].symbols[1], // Cup with fish (left hand)
        shape: 'rect',
        x: 120,
        y: 280,
        width: 200,
        height: 250,
        indicatorCx: 220,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[42].symbols[2], // Fish emerging from cup
        shape: 'rect',
        x: 150,
        y: 250,
        width: 120,
        height: 120,
        indicatorCx: 210,
        indicatorCy: 310
      },
      {
        symbol: SYMBOL_ANNOTATIONS[42].symbols[3], // Waves at feet
        shape: 'rect',
        x: 80,
        y: 950,
        width: 660,
        height: 180,
        indicatorCx: 410,
        indicatorCy: 1040
      }
    ]
  },

  // Card 43: Knight of Cups
  // VERIFIED against RWS1909_-_Cups_12.jpeg
  43: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[43].symbols[0], // Knight on horseback (center)
        shape: 'rect',
        x: 150,
        y: 100,
        width: 500,
        height: 650,
        indicatorCx: 400,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[43].symbols[1], // Cup held forward
        shape: 'rect',
        x: 420,
        y: 220,
        width: 180,
        height: 200,
        indicatorCx: 510,
        indicatorCy: 320
      },
      {
        symbol: SYMBOL_ANNOTATIONS[43].symbols[2], // White horse (walking left)
        shape: 'rect',
        x: 150,
        y: 400,
        width: 450,
        height: 500,
        indicatorCx: 375,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[43].symbols[3], // Winged helmet
        shape: 'rect',
        x: 200,
        y: 100,
        width: 180,
        height: 150,
        indicatorCx: 290,
        indicatorCy: 175
      },
      {
        symbol: SYMBOL_ANNOTATIONS[43].symbols[4], // River/cliffs background
        shape: 'rect',
        x: 500,
        y: 600,
        width: 250,
        height: 300,
        indicatorCx: 625,
        indicatorCy: 750
      }
    ]
  },

  // Card 44: Queen of Cups
  // VERIFIED against RWS1909_-_Cups_13.jpeg
  44: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[44].symbols[0], // Enthroned queen (facing left)
        shape: 'rect',
        x: 200,
        y: 100,
        width: 450,
        height: 700,
        indicatorCx: 425,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[44].symbols[1], // Ornate covered cup
        shape: 'rect',
        x: 120,
        y: 280,
        width: 220,
        height: 280,
        indicatorCx: 230,
        indicatorCy: 420
      },
      {
        symbol: SYMBOL_ANNOTATIONS[44].symbols[2], // Throne with cherubs
        shape: 'rect',
        x: 450,
        y: 100,
        width: 250,
        height: 400,
        indicatorCx: 575,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[44].symbols[3], // Water at feet/pebbles
        shape: 'rect',
        x: 80,
        y: 900,
        width: 660,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 1025
      }
    ]
  },

  // Card 45: King of Cups
  // VERIFIED against RWS1909_-_Cups_14.jpeg
  45: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[0], // Enthroned king (on water)
        shape: 'rect',
        x: 180,
        y: 100,
        width: 460,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[1], // Cup in right hand
        shape: 'rect',
        x: 280,
        y: 350,
        width: 150,
        height: 200,
        indicatorCx: 355,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[2], // Scepter in left hand
        shape: 'rect',
        x: 520,
        y: 300,
        width: 120,
        height: 350,
        indicatorCx: 580,
        indicatorCy: 475
      },
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[3], // Fish jumping (left)
        shape: 'rect',
        x: 80,
        y: 700,
        width: 120,
        height: 150,
        indicatorCx: 140,
        indicatorCy: 775
      },
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[4], // Ship (right background)
        shape: 'rect',
        x: 620,
        y: 550,
        width: 130,
        height: 150,
        indicatorCx: 685,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[45].symbols[5], // Water surrounding throne
        shape: 'rect',
        x: 80,
        y: 850,
        width: 660,
        height: 280,
        indicatorCx: 410,
        indicatorCy: 990
      }
    ]
  },

  // MINOR ARCANA - SWORDS (46-55, 56-59)

  // Card 46: Ace of Swords
  // VERIFIED against RWS1909_-_Swords_01.jpeg
  46: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[46].symbols[0], // Hand from cloud (left side)
        shape: 'rect',
        x: 80,
        y: 550,
        width: 300,
        height: 250,
        indicatorCx: 230,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[46].symbols[1], // Upright sword (center)
        shape: 'rect',
        x: 320,
        y: 150,
        width: 180,
        height: 650,
        indicatorCx: 410,
        indicatorCy: 475
      },
      {
        symbol: SYMBOL_ANNOTATIONS[46].symbols[2], // Crown on sword tip
        shape: 'rect',
        x: 280,
        y: 100,
        width: 260,
        height: 180,
        indicatorCx: 410,
        indicatorCy: 190
      },
      {
        symbol: SYMBOL_ANNOTATIONS[46].symbols[3], // Laurel and palm branches
        shape: 'rect',
        x: 200,
        y: 150,
        width: 420,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 275
      },
      {
        symbol: SYMBOL_ANNOTATIONS[46].symbols[4], // Mountains background
        shape: 'rect',
        x: 80,
        y: 950,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1050
      }
    ]
  },

  // Card 47: Two of Swords
  // VERIFIED against RWS1909_-_Swords_02.jpeg
  47: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[47].symbols[0], // Blindfolded figure (center)
        shape: 'rect',
        x: 220,
        y: 200,
        width: 380,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[47].symbols[1], // Crossed swords
        shape: 'rect',
        x: 100,
        y: 150,
        width: 620,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 375
      },
      {
        symbol: SYMBOL_ANNOTATIONS[47].symbols[2], // Crescent moon (top right)
        shape: 'circle',
        cx: 620,
        cy: 180,
        r: 50,
        indicatorCx: 620,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[47].symbols[3], // Rocks in water (background)
        shape: 'rect',
        x: 80,
        y: 600,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[47].symbols[4], // White robe
        shape: 'rect',
        x: 280,
        y: 450,
        width: 260,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 650
      }
    ]
  },

  // Card 48: Three of Swords
  // VERIFIED against RWS1909_-_Swords_03.jpeg
  48: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[48].symbols[0], // Heart (center)
        shape: 'rect',
        x: 220,
        y: 300,
        width: 380,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[48].symbols[1], // Three swords piercing heart
        shape: 'rect',
        x: 150,
        y: 100,
        width: 520,
        height: 600,
        indicatorCx: 410,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[48].symbols[2], // Rain clouds (background)
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[48].symbols[3], // Rain falling
        shape: 'rect',
        x: 150,
        y: 400,
        width: 520,
        height: 600,
        indicatorCx: 410,
        indicatorCy: 700
      }
    ]
  },

  // Card 49: Four of Swords
  // VERIFIED against RWS1909_-_Swords_04.jpeg
  49: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[49].symbols[0], // Effigy lying in repose (center-bottom)
        shape: 'rect',
        x: 100,
        y: 550,
        width: 620,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 725
      },
      {
        symbol: SYMBOL_ANNOTATIONS[49].symbols[1], // Three swords on wall (right)
        shape: 'rect',
        x: 450,
        y: 100,
        width: 280,
        height: 450,
        indicatorCx: 590,
        indicatorCy: 325
      },
      {
        symbol: SYMBOL_ANNOTATIONS[49].symbols[2], // One sword beneath effigy
        shape: 'rect',
        x: 150,
        y: 920,
        width: 520,
        height: 130,
        indicatorCx: 410,
        indicatorCy: 985
      },
      {
        symbol: SYMBOL_ANNOTATIONS[49].symbols[3], // Praying hands on effigy
        shape: 'rect',
        x: 350,
        y: 580,
        width: 150,
        height: 150,
        indicatorCx: 425,
        indicatorCy: 655
      },
      {
        symbol: SYMBOL_ANNOTATIONS[49].symbols[4], // Stained glass window (top left)
        shape: 'rect',
        x: 80,
        y: 100,
        width: 300,
        height: 400,
        indicatorCx: 230,
        indicatorCy: 300
      }
    ]
  },

  // Card 50: Five of Swords
  // VERIFIED against RWS1909_-_Swords_05.jpeg
  50: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[50].symbols[0], // Victor in foreground (right, smirking)
        shape: 'rect',
        x: 350,
        y: 200,
        width: 350,
        height: 700,
        indicatorCx: 525,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[50].symbols[1], // Five swords (3 held, 2 on ground)
        shape: 'rect',
        x: 80,
        y: 700,
        width: 400,
        height: 350,
        indicatorCx: 280,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[50].symbols[2], // Defeated figures (left, walking away)
        shape: 'rect',
        x: 80,
        y: 400,
        width: 280,
        height: 350,
        indicatorCx: 220,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[50].symbols[3], // Turbulent sky
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 250
      }
    ]
  },

  // Card 51: Six of Swords
  // VERIFIED against RWS1909_-_Swords_06.jpeg
  51: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[51].symbols[0], // Boat crossing water
        shape: 'rect',
        x: 80,
        y: 500,
        width: 660,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 750
      },
      {
        symbol: SYMBOL_ANNOTATIONS[51].symbols[1], // Ferryman (left, with pole)
        shape: 'rect',
        x: 80,
        y: 150,
        width: 280,
        height: 600,
        indicatorCx: 220,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[51].symbols[2], // Woman and child (huddled, center-right)
        shape: 'rect',
        x: 300,
        y: 400,
        width: 280,
        height: 400,
        indicatorCx: 440,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[51].symbols[3], // Six swords (standing in boat)
        shape: 'rect',
        x: 420,
        y: 250,
        width: 300,
        height: 450,
        indicatorCx: 570,
        indicatorCy: 475
      },
      {
        symbol: SYMBOL_ANNOTATIONS[51].symbols[4], // Water (rough behind, calm ahead)
        shape: 'rect',
        x: 80,
        y: 850,
        width: 660,
        height: 280,
        indicatorCx: 410,
        indicatorCy: 990
      }
    ]
  },

  // Card 52: Seven of Swords
  // VERIFIED against RWS1909_-_Swords_07.jpeg
  52: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[52].symbols[0], // Sneaking figure (center, tiptoeing)
        shape: 'rect',
        x: 180,
        y: 150,
        width: 400,
        height: 700,
        indicatorCx: 380,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[52].symbols[1], // Five swords (bundled in arms)
        shape: 'rect',
        x: 150,
        y: 200,
        width: 350,
        height: 500,
        indicatorCx: 325,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[52].symbols[2], // Two swords (left behind, right side)
        shape: 'rect',
        x: 550,
        y: 350,
        width: 180,
        height: 400,
        indicatorCx: 640,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[52].symbols[3], // Military camp/tents (background right)
        shape: 'rect',
        x: 500,
        y: 750,
        width: 250,
        height: 250,
        indicatorCx: 625,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[52].symbols[4], // Backwards glance
        shape: 'rect',
        x: 350,
        y: 180,
        width: 150,
        height: 150,
        indicatorCx: 425,
        indicatorCy: 255
      }
    ]
  },

  // Card 53: Eight of Swords
  // VERIFIED against RWS1909_-_Swords_08.jpeg
  53: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[53].symbols[0], // Bound figure (center, blindfolded)
        shape: 'rect',
        x: 250,
        y: 200,
        width: 300,
        height: 700,
        indicatorCx: 400,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[53].symbols[1], // Eight swords (surrounding)
        shape: 'rect',
        x: 80,
        y: 150,
        width: 660,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[53].symbols[2], // Blindfold on figure
        shape: 'rect',
        x: 320,
        y: 280,
        width: 150,
        height: 80,
        indicatorCx: 395,
        indicatorCy: 320
      },
      {
        symbol: SYMBOL_ANNOTATIONS[53].symbols[3], // Castle on hill (background right)
        shape: 'rect',
        x: 500,
        y: 550,
        width: 200,
        height: 200,
        indicatorCx: 600,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[53].symbols[4], // Water/marsh at feet
        shape: 'rect',
        x: 80,
        y: 900,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1000
      }
    ]
  },

  // Card 54: Nine of Swords
  // VERIFIED against RWS1909_-_Swords_09.jpeg
  54: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[54].symbols[0], // Figure in bed (sitting up, grieving)
        shape: 'rect',
        x: 280,
        y: 450,
        width: 320,
        height: 450,
        indicatorCx: 440,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[54].symbols[1], // Nine swords (horizontal on black wall)
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 330
      },
      {
        symbol: SYMBOL_ANNOTATIONS[54].symbols[2], // Hands over face (despair)
        shape: 'rect',
        x: 380,
        y: 500,
        width: 150,
        height: 150,
        indicatorCx: 455,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[54].symbols[3], // Quilt with roses
        shape: 'rect',
        x: 350,
        y: 700,
        width: 350,
        height: 350,
        indicatorCx: 525,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[54].symbols[4], // Carved bed panel (combat scene)
        shape: 'rect',
        x: 80,
        y: 800,
        width: 280,
        height: 250,
        indicatorCx: 220,
        indicatorCy: 925
      }
    ]
  },

  // Card 55: Ten of Swords
  // VERIFIED against RWS1909_-_Swords_10.jpeg
  55: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[55].symbols[0], // Fallen figure (face down)
        shape: 'rect',
        x: 80,
        y: 700,
        width: 660,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 875
      },
      {
        symbol: SYMBOL_ANNOTATIONS[55].symbols[1], // Ten swords in back
        shape: 'rect',
        x: 150,
        y: 200,
        width: 520,
        height: 600,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[55].symbols[2], // Dark sky
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 200
      },
      {
        symbol: SYMBOL_ANNOTATIONS[55].symbols[3], // Yellow dawn on horizon
        shape: 'rect',
        x: 80,
        y: 380,
        width: 660,
        height: 150,
        indicatorCx: 410,
        indicatorCy: 455
      },
      {
        symbol: SYMBOL_ANNOTATIONS[55].symbols[4], // Red cloak/blood
        shape: 'rect',
        x: 100,
        y: 750,
        width: 350,
        height: 200,
        indicatorCx: 275,
        indicatorCy: 850
      }
    ]
  },

  // Card 56: Page of Swords
  // VERIFIED against RWS1909_-_Swords_11.jpeg
  56: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[56].symbols[0], // Youth standing (center)
        shape: 'rect',
        x: 200,
        y: 200,
        width: 420,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 550
      },
      {
        symbol: SYMBOL_ANNOTATIONS[56].symbols[1], // Sword held upright
        shape: 'rect',
        x: 420,
        y: 200,
        width: 180,
        height: 400,
        indicatorCx: 510,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[56].symbols[2], // Wind-blown hair and clouds
        shape: 'rect',
        x: 80,
        y: 400,
        width: 660,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[56].symbols[3], // Birds in sky
        shape: 'rect',
        x: 300,
        y: 100,
        width: 200,
        height: 150,
        indicatorCx: 400,
        indicatorCy: 175
      },
      {
        symbol: SYMBOL_ANNOTATIONS[56].symbols[4], // Rough terrain
        shape: 'rect',
        x: 80,
        y: 900,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 1000
      }
    ]
  },

  // Card 57: Knight of Swords
  // VERIFIED against RWS1909_-_Swords_12.jpeg
  57: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[57].symbols[0], // Knight charging (on white horse)
        shape: 'rect',
        x: 200,
        y: 100,
        width: 500,
        height: 650,
        indicatorCx: 450,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[57].symbols[1], // Sword raised high
        shape: 'rect',
        x: 150,
        y: 80,
        width: 200,
        height: 350,
        indicatorCx: 250,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[57].symbols[2], // White horse galloping
        shape: 'rect',
        x: 100,
        y: 400,
        width: 550,
        height: 500,
        indicatorCx: 375,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[57].symbols[3], // Red plume streaming
        shape: 'rect',
        x: 450,
        y: 150,
        width: 250,
        height: 200,
        indicatorCx: 575,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[57].symbols[4], // Windswept clouds
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 200
      }
    ]
  },

  // Card 58: Queen of Swords
  // VERIFIED against RWS1909_-_Swords_13.jpeg
  58: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[0], // Enthroned queen (facing right)
        shape: 'rect',
        x: 150,
        y: 150,
        width: 450,
        height: 700,
        indicatorCx: 375,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[1], // Sword upright (right hand)
        shape: 'rect',
        x: 400,
        y: 150,
        width: 150,
        height: 500,
        indicatorCx: 475,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[2], // Left hand raised
        shape: 'rect',
        x: 520,
        y: 320,
        width: 150,
        height: 180,
        indicatorCx: 595,
        indicatorCy: 410
      },
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[3], // Throne with cherub carving
        shape: 'rect',
        x: 80,
        y: 500,
        width: 250,
        height: 350,
        indicatorCx: 205,
        indicatorCy: 675
      },
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[4], // Clouds behind
        shape: 'rect',
        x: 400,
        y: 450,
        width: 350,
        height: 300,
        indicatorCx: 575,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[58].symbols[5], // Crown with butterflies
        shape: 'rect',
        x: 280,
        y: 150,
        width: 150,
        height: 120,
        indicatorCx: 355,
        indicatorCy: 210
      }
    ]
  },

  // Card 59: King of Swords
  // VERIFIED against RWS1909_-_Swords_14.jpeg
  59: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[0], // Enthroned king (facing forward)
        shape: 'rect',
        x: 150,
        y: 150,
        width: 520,
        height: 700,
        indicatorCx: 410,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[1], // Sword in right hand (raised)
        shape: 'rect',
        x: 150,
        y: 150,
        width: 200,
        height: 500,
        indicatorCx: 250,
        indicatorCy: 400
      },
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[2], // Throne with butterflies/moths
        shape: 'rect',
        x: 280,
        y: 100,
        width: 260,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[3], // Blue robes
        shape: 'rect',
        x: 250,
        y: 400,
        width: 320,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[4], // Crown
        shape: 'circle',
        cx: 410,
        cy: 180,
        r: 50,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[59].symbols[5], // Clouds and trees
        shape: 'rect',
        x: 80,
        y: 700,
        width: 660,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 875
      }
    ]
  },

  // MINOR ARCANA - PENTACLES (60-73)

  // Card 60: Ace of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_01.jpeg
  60: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[60].symbols[0], // Hand from cloud (left)
        shape: 'rect',
        x: 80,
        y: 280,
        width: 350,
        height: 250,
        indicatorCx: 255,
        indicatorCy: 405
      },
      {
        symbol: SYMBOL_ANNOTATIONS[60].symbols[1], // Pentacle (upper right)
        shape: 'circle',
        cx: 520,
        cy: 320,
        r: 120,
        indicatorCx: 520,
        indicatorCy: 320
      },
      {
        symbol: SYMBOL_ANNOTATIONS[60].symbols[2], // Garden below
        shape: 'rect',
        x: 80,
        y: 750,
        width: 660,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 925
      },
      {
        symbol: SYMBOL_ANNOTATIONS[60].symbols[3], // Archway (hedge)
        shape: 'rect',
        x: 450,
        y: 780,
        width: 200,
        height: 250,
        indicatorCx: 550,
        indicatorCy: 905
      },
      {
        symbol: SYMBOL_ANNOTATIONS[60].symbols[4], // Mountains distant
        shape: 'rect',
        x: 200,
        y: 850,
        width: 200,
        height: 100,
        indicatorCx: 300,
        indicatorCy: 900
      }
    ]
  },

  // Card 61: Two of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_02.jpeg
  61: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[61].symbols[0], // Juggler (center)
        shape: 'rect',
        x: 200,
        y: 150,
        width: 420,
        height: 750,
        indicatorCx: 410,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[61].symbols[1], // Two pentacles in infinity loop
        shape: 'rect',
        x: 150,
        y: 200,
        width: 520,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 425
      },
      {
        symbol: SYMBOL_ANNOTATIONS[61].symbols[2], // Infinity symbol (ribbon)
        shape: 'rect',
        x: 180,
        y: 300,
        width: 460,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[61].symbols[3], // Ships on waves (background)
        shape: 'rect',
        x: 80,
        y: 850,
        width: 660,
        height: 250,
        indicatorCx: 410,
        indicatorCy: 975
      },
      {
        symbol: SYMBOL_ANNOTATIONS[61].symbols[4], // Tall hat
        shape: 'rect',
        x: 340,
        y: 100,
        width: 140,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 200
      }
    ]
  },

  // Card 62: Three of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_03.jpeg
  62: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[62].symbols[0], // Craftsman on bench (left)
        shape: 'rect',
        x: 80,
        y: 500,
        width: 280,
        height: 450,
        indicatorCx: 220,
        indicatorCy: 725
      },
      {
        symbol: SYMBOL_ANNOTATIONS[62].symbols[1], // Architect and monk (right, consulting)
        shape: 'rect',
        x: 400,
        y: 450,
        width: 350,
        height: 500,
        indicatorCx: 575,
        indicatorCy: 700
      },
      {
        symbol: SYMBOL_ANNOTATIONS[62].symbols[2], // Three pentacles in arch (top)
        shape: 'rect',
        x: 200,
        y: 100,
        width: 420,
        height: 350,
        indicatorCx: 410,
        indicatorCy: 275
      },
      {
        symbol: SYMBOL_ANNOTATIONS[62].symbols[3], // Cathedral/Gothic arch
        shape: 'rect',
        x: 100,
        y: 80,
        width: 620,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 330
      }
    ]
  },

  // Card 63: Four of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_04.jpeg
  63: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[63].symbols[0], // Seated figure (center)
        shape: 'rect',
        x: 220,
        y: 250,
        width: 380,
        height: 650,
        indicatorCx: 410,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[63].symbols[1], // Pentacle on crown/head
        shape: 'circle',
        cx: 410,
        cy: 300,
        r: 60,
        indicatorCx: 410,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[63].symbols[2], // Pentacle clasped to chest
        shape: 'circle',
        cx: 410,
        cy: 520,
        r: 70,
        indicatorCx: 410,
        indicatorCy: 520
      },
      {
        symbol: SYMBOL_ANNOTATIONS[63].symbols[3], // Pentacles under feet
        shape: 'rect',
        x: 200,
        y: 850,
        width: 420,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 950
      },
      {
        symbol: SYMBOL_ANNOTATIONS[63].symbols[4], // City background
        shape: 'rect',
        x: 80,
        y: 650,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 750
      }
    ]
  },

  // Card 64: Five of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_05.jpeg
  64: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[64].symbols[0], // Two beggars in snow
        shape: 'rect',
        x: 100,
        y: 550,
        width: 620,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 800
      },
      {
        symbol: SYMBOL_ANNOTATIONS[64].symbols[1], // Five pentacles in stained glass window
        shape: 'rect',
        x: 150,
        y: 80,
        width: 520,
        height: 500,
        indicatorCx: 410,
        indicatorCy: 330
      },
      {
        symbol: SYMBOL_ANNOTATIONS[64].symbols[2], // Snow falling
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 450,
        indicatorCx: 410,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[64].symbols[3], // Church exterior
        shape: 'rect',
        x: 80,
        y: 80,
        width: 150,
        height: 500,
        indicatorCx: 155,
        indicatorCy: 330
      }
    ]
  },

  // Card 65: Six of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_06.jpeg
  65: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[65].symbols[0], // Wealthy merchant (center)
        shape: 'rect',
        x: 250,
        y: 200,
        width: 320,
        height: 650,
        indicatorCx: 410,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[65].symbols[1], // Six pentacles (3 left, 3 right columns)
        shape: 'rect',
        x: 80,
        y: 100,
        width: 660,
        height: 550,
        indicatorCx: 410,
        indicatorCy: 375
      },
      {
        symbol: SYMBOL_ANNOTATIONS[65].symbols[2], // Scales in hand
        shape: 'rect',
        x: 450,
        y: 400,
        width: 200,
        height: 200,
        indicatorCx: 550,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[65].symbols[3], // Kneeling beggars (left and right)
        shape: 'rect',
        x: 80,
        y: 650,
        width: 660,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 850
      }
    ]
  },

  // Card 66: Seven of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_07.jpeg
  66: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[66].symbols[0], // Farmer leaning on hoe (right)
        shape: 'rect',
        x: 400,
        y: 150,
        width: 350,
        height: 750,
        indicatorCx: 575,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[66].symbols[1], // Seven pentacles on vine (left) - 6 on bush, 1 on ground
        shape: 'rect',
        x: 80,
        y: 200,
        width: 380,
        height: 850,
        indicatorCx: 270,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[66].symbols[2], // Hoe/staff
        shape: 'rect',
        x: 420,
        y: 300,
        width: 100,
        height: 600,
        indicatorCx: 470,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[66].symbols[3], // Contemplative pose
        shape: 'rect',
        x: 450,
        y: 200,
        width: 200,
        height: 250,
        indicatorCx: 550,
        indicatorCy: 325
      }
    ]
  },

  // Card 67: Eight of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_08.jpeg
  67: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[67].symbols[0], // Craftsman on bench (left)
        shape: 'rect',
        x: 80,
        y: 350,
        width: 400,
        height: 550,
        indicatorCx: 280,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[67].symbols[1], // Eight pentacles in column (right)
        shape: 'rect',
        x: 500,
        y: 80,
        width: 220,
        height: 950,
        indicatorCx: 610,
        indicatorCy: 555
      },
      {
        symbol: SYMBOL_ANNOTATIONS[67].symbols[2], // Pentacle being worked on
        shape: 'circle',
        cx: 350,
        cy: 680,
        r: 60,
        indicatorCx: 350,
        indicatorCy: 680
      },
      {
        symbol: SYMBOL_ANNOTATIONS[67].symbols[3], // Hammer and chisel
        shape: 'rect',
        x: 200,
        y: 500,
        width: 150,
        height: 150,
        indicatorCx: 275,
        indicatorCy: 575
      },
      {
        symbol: SYMBOL_ANNOTATIONS[67].symbols[4], // Town in distance (left background)
        shape: 'rect',
        x: 80,
        y: 600,
        width: 150,
        height: 150,
        indicatorCx: 155,
        indicatorCy: 675
      }
    ]
  },

  // Card 68: Nine of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_09.jpeg
  68: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[68].symbols[0], // Elegant woman in garden (center)
        shape: 'rect',
        x: 200,
        y: 150,
        width: 420,
        height: 750,
        indicatorCx: 410,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[68].symbols[1], // Falcon on hand (left hand)
        shape: 'rect',
        x: 400,
        y: 200,
        width: 200,
        height: 200,
        indicatorCx: 500,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[68].symbols[2], // Nine pentacles (scattered)
        shape: 'rect',
        x: 80,
        y: 500,
        width: 660,
        height: 550,
        indicatorCx: 410,
        indicatorCy: 775
      },
      {
        symbol: SYMBOL_ANNOTATIONS[68].symbols[3], // Grape vines/vineyard
        shape: 'rect',
        x: 80,
        y: 300,
        width: 200,
        height: 600,
        indicatorCx: 180,
        indicatorCy: 600
      },
      {
        symbol: SYMBOL_ANNOTATIONS[68].symbols[4], // Snail at bottom
        shape: 'rect',
        x: 80,
        y: 950,
        width: 120,
        height: 100,
        indicatorCx: 140,
        indicatorCy: 1000
      }
    ]
  },

  // Card 69: Ten of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_10.jpeg
  69: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[69].symbols[0], // Family scene (old man, couple, child)
        shape: 'rect',
        x: 80,
        y: 400,
        width: 660,
        height: 650,
        indicatorCx: 410,
        indicatorCy: 725
      },
      {
        symbol: SYMBOL_ANNOTATIONS[69].symbols[1], // Ten pentacles (Tree of Life pattern)
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 900,
        indicatorCx: 410,
        indicatorCy: 530
      },
      {
        symbol: SYMBOL_ANNOTATIONS[69].symbols[2], // Archway with towers
        shape: 'rect',
        x: 150,
        y: 80,
        width: 520,
        height: 400,
        indicatorCx: 410,
        indicatorCy: 280
      },
      {
        symbol: SYMBOL_ANNOTATIONS[69].symbols[3], // Old man with dogs (left)
        shape: 'rect',
        x: 80,
        y: 500,
        width: 280,
        height: 550,
        indicatorCx: 220,
        indicatorCy: 775
      },
      {
        symbol: SYMBOL_ANNOTATIONS[69].symbols[4], // Dogs at feet
        shape: 'rect',
        x: 300,
        y: 750,
        width: 200,
        height: 200,
        indicatorCx: 400,
        indicatorCy: 850
      }
    ]
  },

  // Card 70: Page of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_11.jpeg
  70: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[70].symbols[0], // Youth standing (center-left)
        shape: 'rect',
        x: 150,
        y: 150,
        width: 400,
        height: 700,
        indicatorCx: 350,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[70].symbols[1], // Pentacle held up (upper right)
        shape: 'circle',
        cx: 530,
        cy: 280,
        r: 70,
        indicatorCx: 530,
        indicatorCy: 280
      },
      {
        symbol: SYMBOL_ANNOTATIONS[70].symbols[2], // Red cap/hat
        shape: 'rect',
        x: 280,
        y: 150,
        width: 180,
        height: 150,
        indicatorCx: 370,
        indicatorCy: 225
      },
      {
        symbol: SYMBOL_ANNOTATIONS[70].symbols[3], // Mountains in background
        shape: 'rect',
        x: 400,
        y: 700,
        width: 350,
        height: 200,
        indicatorCx: 575,
        indicatorCy: 800
      },
      {
        symbol: SYMBOL_ANNOTATIONS[70].symbols[4], // Trees and field
        shape: 'rect',
        x: 80,
        y: 750,
        width: 300,
        height: 300,
        indicatorCx: 230,
        indicatorCy: 900
      }
    ]
  },

  // Card 71: Knight of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_12.jpeg
  71: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[71].symbols[0], // Knight on dark horse (stationary)
        shape: 'rect',
        x: 100,
        y: 100,
        width: 550,
        height: 700,
        indicatorCx: 375,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[71].symbols[1], // Pentacle held up (right hand)
        shape: 'circle',
        cx: 550,
        cy: 300,
        r: 65,
        indicatorCx: 550,
        indicatorCy: 300
      },
      {
        symbol: SYMBOL_ANNOTATIONS[71].symbols[2], // Dark/black horse
        shape: 'rect',
        x: 100,
        y: 400,
        width: 500,
        height: 500,
        indicatorCx: 350,
        indicatorCy: 650
      },
      {
        symbol: SYMBOL_ANNOTATIONS[71].symbols[3], // Green plume on helmet
        shape: 'rect',
        x: 250,
        y: 100,
        width: 150,
        height: 150,
        indicatorCx: 325,
        indicatorCy: 175
      },
      {
        symbol: SYMBOL_ANNOTATIONS[71].symbols[4], // Plowed field below
        shape: 'rect',
        x: 80,
        y: 850,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 950
      }
    ]
  },

  // Card 72: Queen of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_13.jpeg
  72: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[72].symbols[0], // Queen enthroned (center, facing right)
        shape: 'rect',
        x: 150,
        y: 200,
        width: 450,
        height: 650,
        indicatorCx: 375,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[72].symbols[1], // Pentacle in lap
        shape: 'circle',
        cx: 340,
        cy: 540,
        r: 70,
        indicatorCx: 340,
        indicatorCy: 540
      },
      {
        symbol: SYMBOL_ANNOTATIONS[72].symbols[2], // Ornate throne with goat heads
        shape: 'rect',
        x: 400,
        y: 200,
        width: 280,
        height: 500,
        indicatorCx: 540,
        indicatorCy: 450
      },
      {
        symbol: SYMBOL_ANNOTATIONS[72].symbols[3], // Rose arbor (top and sides)
        shape: 'rect',
        x: 80,
        y: 80,
        width: 660,
        height: 200,
        indicatorCx: 410,
        indicatorCy: 180
      },
      {
        symbol: SYMBOL_ANNOTATIONS[72].symbols[4], // Rabbit at bottom right
        shape: 'rect',
        x: 550,
        y: 900,
        width: 150,
        height: 150,
        indicatorCx: 625,
        indicatorCy: 975
      }
    ]
  },

  // Card 73: King of Pentacles
  // VERIFIED against RWS1909_-_Pentacles_14.jpeg
  73: {
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[0], // King enthroned (center)
        shape: 'rect',
        x: 150,
        y: 150,
        width: 500,
        height: 750,
        indicatorCx: 400,
        indicatorCy: 525
      },
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[1], // Pentacle on lap
        shape: 'circle',
        cx: 500,
        cy: 500,
        r: 75,
        indicatorCx: 500,
        indicatorCy: 500
      },
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[2], // Scepter in left hand
        shape: 'rect',
        x: 200,
        y: 350,
        width: 120,
        height: 250,
        indicatorCx: 260,
        indicatorCy: 475
      },
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[3], // Throne with bull heads
        shape: 'rect',
        x: 80,
        y: 100,
        width: 660,
        height: 300,
        indicatorCx: 410,
        indicatorCy: 250
      },
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[4], // Grape-patterned robe
        shape: 'rect',
        x: 200,
        y: 400,
        width: 400,
        height: 450,
        indicatorCx: 400,
        indicatorCy: 625
      },
      {
        symbol: SYMBOL_ANNOTATIONS[73].symbols[5], // Castle in background (right)
        shape: 'rect',
        x: 600,
        y: 200,
        width: 150,
        height: 300,
        indicatorCx: 675,
        indicatorCy: 350
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
