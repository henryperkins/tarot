import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'symbolism-protocol-test', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['server/index.js'],
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stderr: 'pipe',
});
transport.stderr?.resume();

before(() => client.connect(transport, { timeout: 10000 }));
after(() => client.close());

function call(name, args = {}) {
  return client.callTool({ name, arguments: args }, undefined, { timeout: 10000 });
}

async function data(name, args) {
  const result = await call(name, args);
  assert.ok(!result.isError, JSON.stringify(result.content));
  return JSON.parse(result.content.find(item => item.type === 'text').text);
}

const requiredArguments = {
  search_symbols: { query: 'string' },
  get_symbol: { category: 'string', name: 'string' },
  get_category: { category: 'string' },
  get_related_symbols: { theme: 'string' },
  interpret_card_symbols: { cardName: 'string', symbols: 'array' },
  get_color_meanings: { colors: 'array' },
  get_numerological_insight: { number: 'string' },
};

test('discovery publishes required fields and string array items to clients', async () => {
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  for (const tool of tools) {
    const fields = requiredArguments[tool.name];
    assert.deepEqual([...tool.inputSchema.required].sort(), Object.keys(fields).sort());
    for (const [field, type] of Object.entries(fields)) {
      assert.equal(tool.inputSchema.properties[field].type, type);
      if (type === 'array') assert.equal(tool.inputSchema.properties[field].items.type, 'string');
    }
    if (['search_symbols', 'get_related_symbols'].includes(tool.name)) {
      assert.equal(tool.inputSchema.properties.limit.type, 'integer');
      assert.ok(!tool.inputSchema.required.includes('limit'));
    }
    if (tool.name === 'search_symbols') {
      assert.equal(tool.inputSchema.properties.category.type, 'string');
      assert.ok(!tool.inputSchema.required.includes('category'));
    }
  }
});

test('search accepts its query and honors category and result limits', async () => {
  const results = await data('search_symbols', { query: 'red' });
  assert.equal(results[0].name, 'red');
  assert.equal(results[0].category, 'colors');
  assert.ok(results.length <= 10);
  const filtered = await data('search_symbols', { query: 'a', category: 'colors', limit: 1 });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].category, 'colors');
  assert.deepEqual(await data('search_symbols', { query: 'red', limit: 0 }), []);
});

test('symbol lookup receives both category and name', async () => {
  const symbol = await data('get_symbol', { category: 'animals', name: 'serpent' });
  assert.equal(symbol.name, 'serpent');
  assert.equal(symbol.category, 'animals');
  assert.ok(symbol.keywords.includes('transformation'));
});

test('category lookup returns the requested symbols', async () => {
  const category = await data('get_category', { category: 'colors' });
  assert.equal(category.category, 'colors');
  assert.ok(category.symbols.some(symbol => symbol.name === 'red'));
  assert.ok(category.symbols.some(symbol => symbol.name === 'blue'));
});

test('related symbols receives its theme and honors optional limits', async () => {
  const results = await data('get_related_symbols', { theme: 'wisdom' });
  assert.ok(results.length > 1 && results.length <= 10);
  assert.deepEqual(await data('get_related_symbols', { theme: 'wisdom', limit: 1 }), results.slice(0, 1));
  assert.deepEqual(await data('get_related_symbols', { theme: 'wisdom', limit: 0 }), []);
});

test('card interpretation receives the card name and each symbol', async () => {
  const card = await data('interpret_card_symbols', {
    cardName: 'The Magician', symbols: ['rose', 'serpent'],
  });
  assert.equal(card.card, 'The Magician');
  assert.deepEqual(card.symbols.map(item => item.symbol), ['rose', 'serpent']);
  assert.deepEqual(card.symbols.map(item => item.category), ['plants', 'animals']);
  assert.equal(card.synthesis.symbolCount, 2);
});

test('color meanings receives a string array and normalizes color case', async () => {
  const colors = await data('get_color_meanings', { colors: ['Red', 'blue'] });
  assert.deepEqual(colors.map(item => item.name), ['red', 'blue']);
  assert.ok(colors.every(item => item.category === 'colors' && item.keywords.length > 0));
});

test('numerological insight receives the requested number as a string', async () => {
  const number = await data('get_numerological_insight', { number: '7' });
  assert.equal(number.name, '7');
  assert.equal(number.category, 'numbers');
  assert.ok(number.keywords.length > 0);
});

const validCalls = {
  search_symbols: { query: 'red' },
  get_symbol: { category: 'animals', name: 'serpent' },
  get_category: { category: 'colors' },
  get_related_symbols: { theme: 'wisdom' },
  interpret_card_symbols: { cardName: 'The Magician', symbols: ['rose'] },
  get_color_meanings: { colors: ['red'] },
  get_numerological_insight: { number: '7' },
};

for (const [name, fields] of Object.entries(requiredArguments)) {
  for (const [field, type] of Object.entries(fields)) {
    for (const [reason, value] of [
      ['missing', undefined], ['wrong type', 123],
      ...(type === 'array' ? [['invalid array item', [123]]] : [['empty', '']]),
    ]) {
      test(`${name} rejects ${reason} ${field} through MCP`, async () => {
        const args = { ...validCalls[name], [field]: value };
        const result = await call(name, args);
        assert.equal(result.isError, true, JSON.stringify(result.content));
        assert.ok(result.content.some(item => item.type === 'text' && item.text.length > 0));
      });
    }
  }
}

for (const name of ['search_symbols', 'get_related_symbols']) {
  for (const limit of ['1', null, -1, 1.5]) {
    test(`${name} rejects invalid limit ${JSON.stringify(limit)}`, async () => {
      const result = await call(name, { ...validCalls[name], limit });
      assert.equal(result.isError, true, JSON.stringify(result.content));
    });
  }
}
