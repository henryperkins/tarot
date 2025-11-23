#!/usr/bin/env node

/**
 * Symbolism Reference MCP Server
 * Provides comprehensive symbolism database for tarot interpretation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchSymbols, getSymbol, getCategory, fuzzyMatch, getRelatedSymbols } from './database.js';

const server = new Server(
  {
    name: 'symbolism-server',
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
        name: 'search_symbols',
        description: 'Search for symbols by keyword or name. Returns matching symbols with meanings and interpretations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (symbol name or keyword)',
              required: true,
            },
            category: {
              type: 'string',
              description: 'Optional category filter: animals, colors, numbers, elements, plants, celestial',
              enum: ['animals', 'colors', 'numbers', 'elements', 'plants', 'celestial'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_symbol',
        description: 'Get detailed information about a specific symbol',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Symbol category',
              enum: ['animals', 'colors', 'numbers', 'elements', 'plants', 'celestial'],
              required: true,
            },
            name: {
              type: 'string',
              description: 'Symbol name (e.g., "rose", "red", "7")',
              required: true,
            },
          },
          required: ['category', 'name'],
        },
      },
      {
        name: 'get_category',
        description: 'Get all symbols in a specific category',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category to retrieve',
              enum: ['animals', 'colors', 'numbers', 'elements', 'plants', 'celestial'],
              required: true,
            },
          },
          required: ['category'],
        },
      },
      {
        name: 'get_related_symbols',
        description: 'Get symbols related to a specific theme or archetype',
        inputSchema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: 'Theme to explore (e.g., "transformation", "love", "wisdom")',
              required: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
              default: 10,
            },
          },
          required: ['theme'],
        },
      },
      {
        name: 'interpret_card_symbols',
        description: 'Get interpretation framework for common symbols appearing in a tarot card',
        inputSchema: {
          type: 'object',
          properties: {
            cardName: {
              type: 'string',
              description: 'Name of the tarot card',
              required: true,
            },
            symbols: {
              type: 'array',
              description: 'List of symbols visible in the card',
              items: {
                type: 'string',
              },
              required: true,
            },
          },
          required: ['cardName', 'symbols'],
        },
      },
      {
        name: 'get_color_meanings',
        description: 'Get comprehensive color symbolism and meanings',
        inputSchema: {
          type: 'object',
          properties: {
            colors: {
              type: 'array',
              description: 'List of colors to interpret',
              items: {
                type: 'string',
              },
              required: true,
            },
          },
          required: ['colors'],
        },
      },
      {
        name: 'get_numerological_insight',
        description: 'Get numerological meaning for a number or card position',
        inputSchema: {
          type: 'object',
          properties: {
            number: {
              type: 'string',
              description: 'Number to interpret (0-10)',
              required: true,
            },
          },
          required: ['number'],
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
      case 'search_symbols': {
        if (!args?.query) {
          throw new Error('query is required');
        }
        const results = searchSymbols(args.query, args.category, args.limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_symbol': {
        if (!args?.category || !args?.name) {
          throw new Error('category and name are required');
        }
        const symbol = getSymbol(args.category, args.name);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(symbol, null, 2),
            },
          ],
        };
      }

      case 'get_category': {
        if (!args?.category) {
          throw new Error('category is required');
        }
        const category = getCategory(args.category);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(category, null, 2),
            },
          ],
        };
      }

      case 'get_related_symbols': {
        if (!args?.theme) {
          throw new Error('theme is required');
        }
        const related = getRelatedSymbols(args.theme, args.limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(related, null, 2),
            },
          ],
        };
      }

      case 'interpret_card_symbols': {
        if (!args?.cardName || !args?.symbols) {
          throw new Error('cardName and symbols are required');
        }
        const interpretation = interpretCardSymbols(args.cardName, args.symbols);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(interpretation, null, 2),
            },
          ],
        };
      }

      case 'get_color_meanings': {
        if (!args?.colors) {
          throw new Error('colors is required');
        }
        const colorMeanings = args.colors.map((color) => {
          const colorData = getSymbol('colors', color.toLowerCase());
          return {
            color,
            ...colorData,
          };
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(colorMeanings, null, 2),
            },
          ],
        };
      }

      case 'get_numerological_insight': {
        if (!args?.number) {
          throw new Error('number is required');
        }
        const numData = getSymbol('numbers', args.number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(numData, null, 2),
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

/**
 * Interpret symbols in context of a specific card
 */
function interpretCardSymbols(cardName, symbols) {
  const symbolData = symbols.map((symbolName) => {
    // Try fuzzy matching to find the symbol
    const match = fuzzyMatch(symbolName);
    if (match) {
      return {
        symbol: symbolName,
        category: match.category,
        data: match.data,
      };
    }
    return {
      symbol: symbolName,
      found: false,
    };
  });

  // Generate contextual interpretation
  const interpretation = {
    card: cardName,
    symbols: symbolData,
    synthesis: synthesizeSymbols(cardName, symbolData),
  };

  return interpretation;
}

/**
 * Synthesize multiple symbols into coherent interpretation
 */
function synthesizeSymbols(cardName, symbolData) {
  const themes = [];
  const keywords = [];

  symbolData.forEach((item) => {
    if (item.data && item.data.keywords) {
      keywords.push(...item.data.keywords);
    }
  });

  // Identify common themes
  const themeMap = {};
  keywords.forEach((keyword) => {
    themeMap[keyword] = (themeMap[keyword] || 0) + 1;
  });

  const commonThemes = Object.entries(themeMap)
    .filter(([_, count]) => count > 1)
    .map(([theme, _]) => theme)
    .slice(0, 5);

  return {
    dominantThemes: commonThemes,
    symbolCount: symbolData.length,
    interpretation: `The ${cardName} combines ${symbolData.length} symbolic elements creating a rich tapestry of meaning around themes of: ${commonThemes.join(', ')}.`,
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Symbolism MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
