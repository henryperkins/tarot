#!/usr/bin/env node

/**
 * Symbolism Reference MCP Server
 * Provides comprehensive symbolism database for tarot interpretation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { searchSymbols, getSymbol, getCategory, fuzzyMatch, getRelatedSymbols } from './database.js';

const server = new McpServer({
  name: 'symbolism-server',
  version: '1.0.0',
});

// Define tool: search_symbols
server.tool(
  'search_symbols',
  'Search for symbols by keyword or name. Returns matching symbols with meanings and interpretations.',
  {
    query: { type: 'string', description: 'Search query (symbol name or keyword)' },
    category: { type: 'string', description: 'Optional category filter: animals, colors, numbers, elements, plants, celestial' },
    limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
  },
  async ({ query, category, limit }) => {
    if (!query) throw new Error('query is required');
    const results = searchSymbols(query, category, limit);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

// Define tool: get_symbol
server.tool(
  'get_symbol',
  'Get detailed information about a specific symbol',
  {
    category: { type: 'string', description: 'Symbol category' },
    name: { type: 'string', description: 'Symbol name (e.g., "rose", "red", "7")' },
  },
  async ({ category, name }) => {
    if (!category || !name) throw new Error('category and name are required');
    const symbol = getSymbol(category, name);
    return { content: [{ type: 'text', text: JSON.stringify(symbol, null, 2) }] };
  }
);

// Define tool: get_category
server.tool(
  'get_category',
  'Get all symbols in a specific category',
  {
    category: { type: 'string', description: 'Category to retrieve' },
  },
  async ({ category }) => {
    if (!category) throw new Error('category is required');
    const categoryData = getCategory(category);
    return { content: [{ type: 'text', text: JSON.stringify(categoryData, null, 2) }] };
  }
);

// Define tool: get_related_symbols
server.tool(
  'get_related_symbols',
  'Get symbols related to a specific theme or archetype',
  {
    theme: { type: 'string', description: 'Theme to explore (e.g., "transformation", "love", "wisdom")' },
    limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
  },
  async ({ theme, limit }) => {
    if (!theme) throw new Error('theme is required');
    const related = getRelatedSymbols(theme, limit);
    return { content: [{ type: 'text', text: JSON.stringify(related, null, 2) }] };
  }
);

// Define tool: interpret_card_symbols
server.tool(
  'interpret_card_symbols',
  'Get interpretation framework for common symbols appearing in a tarot card',
  {
    cardName: { type: 'string', description: 'Name of the tarot card' },
    symbols: { type: 'array', description: 'List of symbols visible in the card' },
  },
  async ({ cardName, symbols }) => {
    if (!cardName || !symbols) throw new Error('cardName and symbols are required');
    const interpretation = interpretCardSymbols(cardName, symbols);
    return { content: [{ type: 'text', text: JSON.stringify(interpretation, null, 2) }] };
  }
);

// Define tool: get_color_meanings
server.tool(
  'get_color_meanings',
  'Get comprehensive color symbolism and meanings',
  {
    colors: { type: 'array', description: 'List of colors to interpret' },
  },
  async ({ colors }) => {
    if (!colors) throw new Error('colors is required');
    const colorMeanings = colors.map((color) => {
      const colorData = getSymbol('colors', color.toLowerCase());
      return { color, ...colorData };
    });
    return { content: [{ type: 'text', text: JSON.stringify(colorMeanings, null, 2) }] };
  }
);

// Define tool: get_numerological_insight
server.tool(
  'get_numerological_insight',
  'Get numerological meaning for a number or card position',
  {
    number: { type: 'string', description: 'Number to interpret (0-10)' },
  },
  async ({ number }) => {
    if (!number) throw new Error('number is required');
    const numData = getSymbol('numbers', number);
    return { content: [{ type: 'text', text: JSON.stringify(numData, null, 2) }] };
  }
);

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
  const _themes = [];
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
