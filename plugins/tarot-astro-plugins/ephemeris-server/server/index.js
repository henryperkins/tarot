#!/usr/bin/env node

/**
 * Ephemeris MCP Server
 * Provides real-time astronomical data for tarot readings
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  getCurrentPositions,
  getMoonPhase,
  getPlanetaryAspects,
  getRetrogradePlanets,
  getEphemerisForReading
} from './ephemeris.js';

const server = new McpServer({
  name: 'ephemeris-server',
  version: '1.0.0',
});

// Define tool: get_current_positions
server.tool(
  'get_current_positions',
  'Get current planetary positions (sign, degree, house)',
  {},
  async () => {
    return {
      content: [{ type: 'text', text: JSON.stringify(getCurrentPositions(), null, 2) }],
    };
  }
);

// Define tool: get_moon_phase
server.tool(
  'get_moon_phase',
  'Get current moon phase, illumination percentage, and sign placement',
  {
    date: { type: 'string', description: 'Optional ISO date string. Defaults to now.' },
  },
  async ({ date }) => {
    return {
      content: [{ type: 'text', text: JSON.stringify(getMoonPhase(date), null, 2) }],
    };
  }
);

// Define tool: get_planetary_aspects
server.tool(
  'get_planetary_aspects',
  'Get active planetary aspects (conjunctions, squares, trines, etc.)',
  {
    date: { type: 'string', description: 'Optional ISO date string. Defaults to now.' },
    orb: { type: 'number', description: 'Orb in degrees (default: 8)' },
  },
  async ({ date, orb }) => {
    return {
      content: [{ type: 'text', text: JSON.stringify(getPlanetaryAspects(date, orb), null, 2) }],
    };
  }
);

// Define tool: get_retrograde_planets
server.tool(
  'get_retrograde_planets',
  'Get list of planets currently in retrograde motion',
  {
    date: { type: 'string', description: 'Optional ISO date string. Defaults to now.' },
  },
  async ({ date }) => {
    return {
      content: [{ type: 'text', text: JSON.stringify(getRetrogradePlanets(date), null, 2) }],
    };
  }
);

// Define tool: get_ephemeris_for_reading
server.tool(
  'get_ephemeris_for_reading',
  'Get complete astrological snapshot for a tarot reading timestamp',
  {
    timestamp: { type: 'string', description: 'ISO timestamp of the reading' },
  },
  async ({ timestamp }) => {
    if (!timestamp) throw new Error('timestamp is required');
    return {
      content: [{ type: 'text', text: JSON.stringify(getEphemerisForReading(timestamp), null, 2) }],
    };
  }
);

// Define tool: get_daily_astrological_weather
server.tool(
  'get_daily_astrological_weather',
  'Get overall astrological "weather" - key transits and themes for the day',
  {
    date: { type: 'string', description: 'Optional ISO date string. Defaults to today.' },
  },
  async ({ date }) => {
    const positions = getCurrentPositions(date);
    const aspects = getPlanetaryAspects(date);
    const moon = getMoonPhase(date);
    const retrogrades = getRetrogradePlanets(date);

    const weather = {
      date: date || new Date().toISOString(),
      moon,
      retrogrades,
      majorAspects: aspects.filter((a) => a.orb < 3),
      keyTransits: identifyKeyTransits(positions, aspects),
      dailyTheme: generateDailyTheme(positions, aspects, moon, retrogrades),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(weather, null, 2) }],
    };
  }
);

// Helper functions
function identifyKeyTransits(positions, aspects) {
  const keyTransits = [];

  aspects.forEach((aspect) => {
    if (aspect.orb < 2 && aspect.type !== 'sextile') {
      keyTransits.push({
        type: 'aspect',
        description: `${aspect.planet1} ${aspect.type} ${aspect.planet2}`,
        significance: aspect.type === 'conjunction' ? 'high' : 'medium',
      });
    }
  });

  Object.entries(positions).forEach(([planet, data]) => {
    if (data.degree < 2) {
      keyTransits.push({
        type: 'ingress',
        description: `${planet} entering ${data.sign}`,
        significance: 'medium',
      });
    }
  });

  return keyTransits;
}

function generateDailyTheme(positions, aspects, moon, retrogrades) {
  const themes = [];

  if (moon.phase === 'New Moon') {
    themes.push('Beginnings, intention-setting, new cycles');
  } else if (moon.phase === 'Full Moon') {
    themes.push('Culmination, revelation, release');
  } else if (moon.phaseName.includes('Waxing')) {
    themes.push('Growth, building, expansion');
  } else {
    themes.push('Release, reflection, integration');
  }

  if (retrogrades.length > 0) {
    themes.push(`Reflection and review (${retrogrades.length} retrograde${retrogrades.length > 1 ? 's' : ''})`);
  }

  const squares = aspects.filter((a) => a.type === 'square' && a.orb < 3);
  const trines = aspects.filter((a) => a.type === 'trine' && a.orb < 3);

  if (squares.length > 0) {
    themes.push('Tension requiring resolution, growth through challenge');
  }
  if (trines.length > 0) {
    themes.push('Flow, ease, natural talents emerging');
  }

  return themes.join('; ');
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ephemeris MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
