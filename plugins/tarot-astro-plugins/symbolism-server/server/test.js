#!/usr/bin/env node

/**
 * Simple test script for Symbolism Database
 */

import { searchSymbols, getSymbol, getCategory, getRelatedSymbols, fuzzyMatch } from './database.js';

console.log('🧪 Testing Symbolism Database\n');
console.log('='.repeat(60));

try {
  console.log('\n1️⃣  Search Symbols (keyword: "transformation"):');
  console.log('-'.repeat(60));
  const searchResults = searchSymbols('transformation', null, 5);
  searchResults.forEach(result => {
    console.log(`${result.category.toUpperCase()}: ${result.name}`);
    console.log(`  Keywords: ${result.keywords.join(', ')}`);
    console.log(`  General: ${result.meanings.general.substring(0, 80)}...`);
  });

  console.log('\n2️⃣  Get Specific Symbol (serpent):');
  console.log('-'.repeat(60));
  const serpent = getSymbol('animals', 'serpent');
  if (serpent) {
    console.log(`Name: serpent`);
    console.log(`Keywords: ${serpent.keywords.join(', ')}`);
    console.log(`General: ${serpent.meanings.general}`);
    console.log(`Tarot: ${serpent.meanings.tarot}`);
    console.log(`Archetypal: ${serpent.meanings.archetypal}`);
  }

  console.log('\n3️⃣  Get Category (colors):');
  console.log('-'.repeat(60));
  const colorsResult = getCategory('colors');
  console.log(`Found ${colorsResult.symbols.length} colors:`);
  colorsResult.symbols.slice(0, 5).forEach(symbol => {
    console.log(`  ${symbol.name}: ${symbol.keywords.join(', ')}`);
  });

  console.log('\n4️⃣  Get Related Symbols (theme: "wisdom"):');
  console.log('-'.repeat(60));
  const wisdomSymbols = getRelatedSymbols('wisdom', 5);
  wisdomSymbols.forEach(symbol => {
    console.log(`${symbol.category}/${symbol.name} - ${symbol.summary.substring(0, 60)}...`);
  });

  console.log('\n5️⃣  Fuzzy Match Test (query: "snak"):');
  console.log('-'.repeat(60));
  const fuzzyResult = fuzzyMatch('snak'); // Should find "serpent" or similar
  if (fuzzyResult) {
    console.log(`Match found: ${fuzzyResult.category}/${fuzzyResult.name}`);
    console.log(`Keywords: ${fuzzyResult.data.keywords.join(', ')}`);
  } else {
    console.log('No fuzzy match found');
  }

  console.log('\n6️⃣  Numerology Test (number: 7):');
  console.log('-'.repeat(60));
  const seven = getSymbol('numbers', '7');
  if (seven) {
    console.log(`Number: 7`);
    console.log(`Keywords: ${seven.keywords.join(', ')}`);
    console.log(`Tarot: ${seven.meanings.tarot}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed successfully!\n');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
