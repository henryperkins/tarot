#!/usr/bin/env node
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const targets = ['README.md', 'docs', 'scripts', 'functions/api', 'test-telemetry.js'];
const excludedDirectories = new Set(['node_modules', '__pycache__']);
const obsoleteCommand = /wrangler\s+pages\s+secret\s+put|pages\.dev/u;

function collectFiles(target) {
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) throw new Error(`Cannot inspect ${target}`);
  return readdirSync(target, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || excludedDirectories.has(entry.name)) return [];
    return collectFiles(path.join(target, entry.name));
  });
}

try {
  const files = targets.flatMap(collectFiles).sort();
  const failures = [];
  for (const file of files) {
    const content = readFileSync(file);
    if (content.includes(0)) continue;
    content.toString('utf8').split(/\r?\n/u).forEach((line, index) => {
      if (obsoleteCommand.test(line)) {
        failures.push(`${file.replaceAll('\\', '/')}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  if (failures.length) {
    console.error('Obsolete Cloudflare Pages configuration found:');
    failures.forEach(failure => console.error(failure));
    process.exitCode = 1;
  } else {
    console.log(`Checked ${files.length} files: Cloudflare command validation passed.`);
  }
} catch (error) {
  console.error(`Cloudflare command validation could not run: ${error.message}`);
  process.exitCode = 1;
}
