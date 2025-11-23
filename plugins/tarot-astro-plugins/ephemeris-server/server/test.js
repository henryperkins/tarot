#!/usr/bin/env node

/**
 * Simple test script for Swiss Ephemeris calculations
 */

import {
  getCurrentPositions,
  getMoonPhase,
  getPlanetaryAspects,
  getRetrogradePlanets,
  getEphemerisForReading
} from './ephemeris.js';

console.log('🧪 Testing Swiss Ephemeris Calculations\n');
console.log('=' .repeat(60));

try {
  console.log('\n1️⃣  Current Planetary Positions:');
  console.log('-'.repeat(60));
  const positions = getCurrentPositions();
  console.log(`Timestamp: ${positions.timestamp}`);
  console.log(`Julian Day: ${positions.julianDay}\n`);

  Object.entries(positions.positions).forEach(([planet, data]) => {
    const direction = data.isDirect ? '→' : '℞';
    console.log(`${planet.padEnd(10)} ${data.sign.padEnd(12)} ${data.degree.toFixed(2)}° ${direction} (speed: ${data.speed.toFixed(4)})`);
  });

  console.log('\n2️⃣  Moon Phase:');
  console.log('-'.repeat(60));
  const moon = getMoonPhase();
  console.log(`Phase: ${moon.phaseName}`);
  console.log(`Illumination: ${moon.illumination}%`);
  console.log(`Sign: ${moon.sign} ${moon.degree.toFixed(2)}°`);
  console.log(`Waxing: ${moon.isWaxing ? 'Yes' : 'No'}`);
  console.log(`Interpretation: ${moon.interpretation}`);

  console.log('\n3️⃣  Planetary Aspects (orb < 5°):');
  console.log('-'.repeat(60));
  const aspects = getPlanetaryAspects(null, 8);
  const tightAspects = aspects.filter(a => a.orb < 5);

  if (tightAspects.length === 0) {
    console.log('No tight aspects found.');
  } else {
    tightAspects.slice(0, 10).forEach(aspect => {
      const applying = aspect.applying ? '→' : '←';
      console.log(`${aspect.planet1} ${aspect.type} ${aspect.planet2} (orb: ${aspect.orb.toFixed(2)}°) ${applying}`);
      console.log(`  ${aspect.interpretation}`);
    });
  }

  console.log('\n4️⃣  Retrograde Planets:');
  console.log('-'.repeat(60));
  const retrogrades = getRetrogradePlanets();

  if (retrogrades.length === 0) {
    console.log('No planets currently retrograde.');
  } else {
    retrogrades.forEach(retro => {
      console.log(`${retro.planet} ℞ in ${retro.sign} ${retro.degree.toFixed(2)}°`);
      console.log(`  ${retro.interpretation}`);
    });
  }

  console.log('\n5️⃣  Complete Reading Context:');
  console.log('-'.repeat(60));
  const reading = getEphemerisForReading(new Date().toISOString());
  console.log(reading.readingContext);
  console.log(`\nEphemeris data path: ${reading.ephemerisPath || 'NOT FOUND'}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed successfully!\n');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error('\nMake sure you have:');
  console.error('1. Installed dependencies: npm install');
  console.error('2. Downloaded ephemeris files: see EPHEMERIS_DATA_README.md');
  console.error('3. Native build tools installed (node-gyp requirements)\n');
  process.exit(1);
}
