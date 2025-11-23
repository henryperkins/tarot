/**
 * Symbolism Database
 * Handles symbol lookups, searches, and relationships
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load symbol database
const symbolsPath = join(__dirname, '../data/symbols.json');
const symbolDatabase = JSON.parse(readFileSync(symbolsPath, 'utf-8'));

/**
 * Search for symbols by query string
 */
export function searchSymbols(query, categoryFilter = null, limit = 10) {
  const queryLower = query.toLowerCase();
  const results = [];

  const categories = categoryFilter
    ? [categoryFilter]
    : Object.keys(symbolDatabase);

  categories.forEach((category) => {
    const categoryData = symbolDatabase[category];

    Object.entries(categoryData).forEach(([name, data]) => {
      // Check name match
      if (name.toLowerCase().includes(queryLower)) {
        results.push({
          name,
          category,
          relevance: 1.0,
          ...data,
        });
        return;
      }

      // Check keyword match
      if (data.keywords) {
        const keywordMatch = data.keywords.some((keyword) =>
          keyword.toLowerCase().includes(queryLower)
        );
        if (keywordMatch) {
          results.push({
            name,
            category,
            relevance: 0.8,
            ...data,
          });
          return;
        }
      }

      // Check meaning text match
      if (data.meanings) {
        const meaningText = JSON.stringify(data.meanings).toLowerCase();
        if (meaningText.includes(queryLower)) {
          results.push({
            name,
            category,
            relevance: 0.6,
            ...data,
          });
        }
      }
    });
  });

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Get a specific symbol by category and name
 */
export function getSymbol(category, name) {
  const categoryData = symbolDatabase[category];
  if (!categoryData) {
    throw new Error(`Unknown category: ${category}`);
  }

  const nameLower = name.toLowerCase();
  const symbolData = categoryData[nameLower];

  if (!symbolData) {
    throw new Error(`Symbol '${name}' not found in category '${category}'`);
  }

  return {
    name: nameLower,
    category,
    ...symbolData,
  };
}

/**
 * Get all symbols in a category
 */
export function getCategory(category) {
  const categoryData = symbolDatabase[category];
  if (!categoryData) {
    throw new Error(`Unknown category: ${category}`);
  }

  return {
    category,
    symbols: Object.entries(categoryData).map(([name, data]) => ({
      name,
      keywords: data.keywords,
      summary: data.meanings?.general || data.meanings?.tarot || 'No summary available',
    })),
  };
}

/**
 * Fuzzy match a symbol name across all categories
 */
export function fuzzyMatch(query) {
  const queryLower = query.toLowerCase();

  for (const [category, categoryData] of Object.entries(symbolDatabase)) {
    for (const [name, data] of Object.entries(categoryData)) {
      if (name.toLowerCase() === queryLower) {
        return {
          category,
          name,
          data,
        };
      }
    }
  }

  // Try partial match
  for (const [category, categoryData] of Object.entries(symbolDatabase)) {
    for (const [name, data] of Object.entries(categoryData)) {
      if (name.toLowerCase().includes(queryLower) || queryLower.includes(name.toLowerCase())) {
        return {
          category,
          name,
          data,
        };
      }
    }
  }

  return null;
}

/**
 * Get symbols related to a theme
 */
export function getRelatedSymbols(theme, limit = 10) {
  const themeLower = theme.toLowerCase();
  const results = [];

  Object.entries(symbolDatabase).forEach(([category, categoryData]) => {
    Object.entries(categoryData).forEach(([name, data]) => {
      let relevance = 0;

      // Check keywords
      if (data.keywords) {
        const keywordMatch = data.keywords.some((keyword) =>
          keyword.toLowerCase().includes(themeLower) || themeLower.includes(keyword.toLowerCase())
        );
        if (keywordMatch) {
          relevance += 0.5;
        }
      }

      // Check meanings
      if (data.meanings) {
        const meaningText = JSON.stringify(data.meanings).toLowerCase();
        if (meaningText.includes(themeLower)) {
          relevance += 0.3;
        }
      }

      // Check archetypal field
      if (data.archetypal && typeof data.archetypal === 'string') {
        if (data.archetypal.toLowerCase().includes(themeLower)) {
          relevance += 0.2;
        }
      }

      if (relevance > 0) {
        results.push({
          name,
          category,
          relevance,
          keywords: data.keywords,
          summary: data.meanings?.general || data.meanings?.tarot || '',
        });
      }
    });
  });

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Get symbol combinations (useful for multi-symbol interpretation)
 */
export function getSymbolCombination(symbols) {
  const symbolData = symbols.map((symbol) => {
    const match = fuzzyMatch(symbol);
    return match ? { name: symbol, ...match } : null;
  }).filter(Boolean);

  // Analyze thematic connections
  const allKeywords = symbolData.flatMap((s) => s.data.keywords || []);
  const keywordCounts = {};

  allKeywords.forEach((keyword) => {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  });

  const sharedThemes = Object.entries(keywordCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([keyword, _]) => keyword);

  return {
    symbols: symbolData,
    sharedThemes,
    interpretation: generateCombinationInterpretation(symbolData, sharedThemes),
  };
}

/**
 * Generate interpretation for symbol combination
 */
function generateCombinationInterpretation(symbolData, sharedThemes) {
  if (symbolData.length === 0) {
    return 'No symbols to interpret.';
  }

  if (symbolData.length === 1) {
    const symbol = symbolData[0];
    return symbol.data.meanings?.general || symbol.data.meanings?.tarot || 'Single symbol present.';
  }

  const symbolNames = symbolData.map((s) => s.name).join(', ');

  if (sharedThemes.length > 0) {
    return `The combination of ${symbolNames} creates a resonance around themes of ${sharedThemes.slice(0, 3).join(', ')}, suggesting a unified message about ${sharedThemes[0]}.`;
  }

  return `The symbols ${symbolNames} create a diverse tapestry, each contributing unique energy to the overall interpretation.`;
}
