#!/usr/bin/env node

/**
 * Post-install script to check for Swiss Ephemeris data files
 * and provide guidance if they're missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPHE_DIRS = [
  path.join(__dirname, '..', 'ephe'),
  path.join(__dirname, '..', '..', 'ephe'),
  '/usr/share/swisseph',
];

const REQUIRED_FILES = ['sepl_18.se1', 'semo_18.se1'];

function checkEphemerisFiles() {
  console.log('\n📡 Checking for Swiss Ephemeris data files...\n');

  // Check environment variable
  const envPath = process.env.SE_EPHE_PATH;
  if (envPath) {
    EPHE_DIRS.unshift(envPath);
  }

  let foundDir = null;
  let foundFiles = [];

  for (const dir of EPHE_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    const foundRequired = REQUIRED_FILES.filter(f => files.includes(f));

    if (foundRequired.length > 0) {
      foundDir = dir;
      foundFiles = foundRequired;
      break;
    }
  }

  if (foundDir && foundFiles.length === REQUIRED_FILES.length) {
    console.log('✅ Swiss Ephemeris data files found!');
    console.log(`   Location: ${foundDir}`);
    console.log(`   Files: ${foundFiles.join(', ')}\n`);
    return;
  }

  // Files not found or incomplete
  console.log('⚠️  Swiss Ephemeris data files not found or incomplete\n');
  console.log('This server requires ephemeris data files to calculate planetary positions.\n');
  console.log('Quick setup:\n');
  console.log('  1. Create the ephe directory:');
  console.log('     mkdir -p ephe\n');
  console.log('  2. Download essential files:');
  console.log('     cd ephe');
  console.log('     curl -O https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1');
  console.log('     curl -O https://www.astro.com/ftp/swisseph/ephe/semo_18.se1\n');
  console.log('     Or use wget:');
  console.log('     wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1');
  console.log('     wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1\n');
  console.log('For detailed instructions, see: EPHEMERIS_DATA_README.md\n');

  if (foundDir && foundFiles.length < REQUIRED_FILES.length) {
    console.log(`Found partial installation at ${foundDir}`);
    console.log(`Missing files: ${REQUIRED_FILES.filter(f => !foundFiles.includes(f)).join(', ')}\n`);
  }
}

checkEphemerisFiles();
