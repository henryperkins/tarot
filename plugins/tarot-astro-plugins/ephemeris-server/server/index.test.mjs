import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'ephemeris-protocol-test', version: '1.0.0' });
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

const date = '2024-01-01T12:00:00.000Z';
const datedTools = [
  'get_moon_phase', 'get_planetary_aspects',
  'get_retrograde_planets', 'get_daily_astrological_weather',
];

test('discovery tells clients which arguments are required and optional', async () => {
  const { tools } = await client.listTools();
  const schemas = Object.fromEntries(tools.map(tool => [tool.name, tool.inputSchema]));
  assert.equal(tools.length, 6);
  for (const name of datedTools) {
    assert.equal(schemas[name].properties.date.type, 'string', name);
    assert.ok(!schemas[name].required?.includes('date'), name);
  }
  assert.equal(schemas.get_planetary_aspects.properties.orb.type, 'number');
  assert.ok(!schemas.get_planetary_aspects.required?.includes('orb'));
  assert.deepEqual(schemas.get_ephemeris_for_reading.required, ['timestamp']);
  assert.equal(schemas.get_ephemeris_for_reading.properties.timestamp.type, 'string');
});

test('current positions returns finite positions for all ten planets', async () => {
  const start = Date.now();
  const result = await data('get_current_positions');
  assert.ok(Date.parse(result.timestamp) >= start);
  assert.equal(Object.keys(result.positions).length, 10);
  for (const position of Object.values(result.positions)) {
    assert.ok(Number.isFinite(position.longitude));
  }
});

for (const [input, timestamp] of [
  [date, date],
  ['2024-01-01', '2024-01-01T00:00:00.000Z'],
  ['2024-01-01T14:00:00+02:00', date],
]) {
  test(`moon phase honors the supplied date ${input}`, async () => {
    const moon = await data('get_moon_phase', { date: input });
    assert.equal(moon.timestamp, timestamp);
    assert.equal(moon.phaseName, 'Waning Gibbous');
    assert.ok(moon.illumination > 0 && moon.illumination < 100);
  });
}

test('aspects honors the supplied date and optional orb, including zero', async () => {
  const standard = await data('get_planetary_aspects', { date });
  assert.ok(standard.some(aspect => aspect.planet1 === 'Sun'
    && aspect.planet2 === 'Jupiter' && aspect.type === 'trine'));
  assert.deepEqual(await data('get_planetary_aspects', { date, orb: 8 }), standard);
  for (const orb of [0, 0.5]) {
    const narrowed = await data('get_planetary_aspects', { date, orb });
    // The calculation uses a separate six-degree orb for sextiles.
    assert.ok(narrowed.filter(aspect => aspect.type !== 'sextile')
      .every(aspect => aspect.orb <= orb));
    assert.ok(narrowed.length < standard.length);
  }
});

test('retrogrades honors a historical date instead of silently using today', async () => {
  const retrogrades = await data('get_retrograde_planets', { date });
  assert.deepEqual(retrogrades.map(item => item.planet), ['Mercury', 'Uranus']);
  assert.ok(retrogrades.every(item => item.speed < 0));
});

test('reading snapshot receives its required timestamp', async () => {
  const snapshot = await data('get_ephemeris_for_reading', { timestamp: date });
  assert.equal(snapshot.timestamp, date);
  assert.equal(snapshot.moon.timestamp, date);
  assert.equal(Object.keys(snapshot.positions).length, 10);
  assert.equal(snapshot.positions.Sun.sign, 'Capricorn');
});

test('daily weather uses the requested date throughout its snapshot', async () => {
  const weather = await data('get_daily_astrological_weather', { date });
  assert.equal(weather.date, date);
  assert.equal(weather.moon.timestamp, date);
  assert.deepEqual(weather.retrogrades.map(item => item.planet), ['Mercury', 'Uranus']);
  assert.ok(weather.dailyTheme.length > 0);
});

for (const name of datedTools) {
  test(`${name} still works when optional arguments are omitted`, async () => {
    const result = await data(name);
    if (Array.isArray(result)) {
      assert.ok(result.every(item => typeof item === 'object'));
    } else {
      assert.ok(Math.abs(Date.now() - Date.parse(result.timestamp || result.date)) < 10000);
    }
  });
}

for (const name of ['get_current_positions', ...datedTools]) {
  test(`${name} accepts a call with the arguments member omitted`, async () => {
    const result = await client.callTool({ name }, undefined, { timeout: 10000 });
    assert.ok(!result.isError, JSON.stringify(result.content));
    const value = JSON.parse(result.content.find(item => item.type === 'text').text);
    assert.ok(value && typeof value === 'object');
  });
}

test('omitting the arguments member does not bypass required timestamp validation', async () => {
  const result = await client.callTool({ name: 'get_ephemeris_for_reading' });
  assert.equal(result.isError, true, JSON.stringify(result.content));
});

for (const args of [null, 'invalid', []]) {
  test(`explicit invalid arguments ${JSON.stringify(args)} are not replaced with defaults`, async () => {
    await assert.rejects(
      client.callTool({ name: 'get_moon_phase', arguments: args }),
      /arguments/
    );
  });
}

const invalidCalls = [
  ['get_ephemeris_for_reading', {}, 'missing timestamp'],
  ['get_ephemeris_for_reading', { timestamp: 123 }, 'numeric timestamp'],
  ['get_ephemeris_for_reading', { timestamp: '' }, 'empty timestamp'],
  ['get_ephemeris_for_reading', { timestamp: 'not-a-date' }, 'invalid timestamp'],
  ...datedTools.flatMap(name => [
    [name, { date: 123 }, 'numeric date'],
    [name, { date: null }, 'null date'],
    [name, { date: '' }, 'empty date'],
    [name, { date: 'not-a-date' }, 'invalid date'],
  ]),
  ['get_planetary_aspects', { date, orb: '1' }, 'string orb'],
  ['get_planetary_aspects', { date, orb: null }, 'null orb'],
  ['get_planetary_aspects', { date, orb: -1 }, 'negative orb'],
];

for (const [name, args, reason] of invalidCalls) {
  test(`${name} rejects ${reason} through MCP`, async () => {
    const result = await call(name, args);
    assert.equal(result.isError, true, JSON.stringify(result.content));
    assert.ok(result.content.some(item => item.type === 'text' && item.text.length > 0));
  });
}
