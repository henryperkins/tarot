#!/usr/bin/env node

/**
 * Ephemeris MCP Server
 * Provides real-time astronomical data for tarot readings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getCurrentPositions,
  getMoonPhase,
  getPlanetaryAspects,
  getRetrogradePlanets,
  getEphemerisForReading
} from './ephemeris.js';

const server = new Server(
  {
    name: 'ephemeris-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_current_positions',
        description: 'Get current planetary positions (sign, degree, house)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_moon_phase',
        description: 'Get current moon phase, illumination percentage, and sign placement',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Optional ISO date string. Defaults to now.',
            },
          },
        },
      },
      {
        name: 'get_planetary_aspects',
        description: 'Get active planetary aspects (conjunctions, squares, trines, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Optional ISO date string. Defaults to now.',
            },
            orb: {
              type: 'number',
              description: 'Orb in degrees (default: 8)',
              default: 8,
            },
          },
        },
      },
      {
        name: 'get_retrograde_planets',
        description: 'Get list of planets currently in retrograde motion',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Optional ISO date string. Defaults to now.',
            },
          },
        },
      },
      {
        name: 'get_ephemeris_for_reading',
        description: 'Get complete astrological snapshot for a tarot reading timestamp',
        inputSchema: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              description: 'ISO timestamp of the reading',
              required: true,
            },
          },
          required: ['timestamp'],
        },
      },
      {
        name: 'get_daily_astrological_weather',
        description: 'Get overall astrological "weather" - key transits and themes for the day',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Optional ISO date string. Defaults to today.',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_current_positions':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(getCurrentPositions(), null, 2),
            },
          ],
        };

      case 'get_moon_phase':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(getMoonPhase(args?.date), null, 2),
            },
          ],
        };

      case 'get_planetary_aspects':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                getPlanetaryAspects(args?.date, args?.orb),
                null,
                2
              ),
            },
          ],
        };

      case 'get_retrograde_planets':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(getRetrogradePlanets(args?.date), null, 2),
            },
          ],
        };

      case 'get_ephemeris_for_reading':
        if (!args?.timestamp) {
          throw new Error('timestamp is required');
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                getEphemerisForReading(args.timestamp),
                null,
                2
              ),
            },
          ],
        };

      case 'get_daily_astrological_weather': {
        const positions = getCurrentPositions(args?.date);
        const aspects = getPlanetaryAspects(args?.date);
        const moon = getMoonPhase(args?.date);
        const retrogrades = getRetrogradePlanets(args?.date);

        const weather = {
          date: args?.date || new Date().toISOString(),
          moon,
          retrogrades,
          majorAspects: aspects.filter((a) => a.orb < 3),
          keyTransits: identifyKeyTransits(positions, aspects),
          dailyTheme: generateDailyTheme(positions, aspects, moon, retrogrades),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(weather, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Helper functions
function identifyKeyTransits(positions, aspects) {
  const keyTransits = [];

  // Look for significant aspects
  aspects.forEach((aspect) => {
    if (aspect.orb < 2 && aspect.type !== 'sextile') {
      keyTransits.push({
        type: 'aspect',
        description: `${aspect.planet1} ${aspect.type} ${aspect.planet2}`,
        significance: aspect.type === 'conjunction' ? 'high' : 'medium',
      });
    }
  });

  // Check for sign changes (planets at 0-2 degrees)
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

  // Moon phase influence
  if (moon.phase === 'New Moon') {
    themes.push('Beginnings, intention-setting, new cycles');
  } else if (moon.phase === 'Full Moon') {
    themes.push('Culmination, revelation, release');
  } else if (moon.phaseName.includes('Waxing')) {
    themes.push('Growth, building, expansion');
  } else {
    themes.push('Release, reflection, integration');
  }

  // Retrograde influence
  if (retrogrades.length > 0) {
    themes.push(`Reflection and review (${retrogrades.length} retrograde${retrogrades.length > 1 ? 's' : ''})`);
  }

  // Major aspects
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
