#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ROOTS = ['src'];
const BASELINE_PATH = path.resolve(process.cwd(), 'scripts/evaluation/design-contract-baseline.json');

const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);

const COLOR_NAMES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
];

const SHADES = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950'
];

const ARBITRARY_TEXT_PX_RE = /\btext-\[\d+px\]/g;
const NON_TOKEN_TAILWIND_COLOR_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|caret|accent)-(${COLOR_NAMES.join('|')})-(${SHADES.join('|')})(?:\\/\\d+)?\\b`,
  'g'
);
const NON_TOKEN_TYPOGRAPHY_PROSE_COLOR_RE = new RegExp(
  `\\bprose-(${COLOR_NAMES.join('|')})\\b`,
  'g'
);
const RAW_RGBA_COLOR_LITERAL_RE = /\[color:rgba\(/g;

function parseArgs(argv) {
  const roots = [];
  let writeBaseline = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write-baseline') {
      writeBaseline = true;
      continue;
    }
    if (arg === '--root') {
      const value = argv[i + 1];
      if (value) roots.push(value);
      i += 1;
      continue;
    }
  }

  return { roots: roots.length ? roots : DEFAULT_ROOTS, writeBaseline };
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }

  return files;
}

function incrementCount(map, key, by = 1) {
  map[key] = (map[key] || 0) + by;
}

async function buildReport(roots) {
  const report = {
    createdAt: new Date().toISOString(),
    roots,
    arbitraryTextPx: {
      count: 0,
      matches: []
    },
    nonTokenTailwindColors: {
      total: 0,
      byColor: {}
    },
    nonTokenProseColors: {
      total: 0,
      byColor: {}
    },
    rawRgbaColorLiterals: {
      count: 0
    }
  };

  for (const root of roots) {
    const absRoot = path.resolve(process.cwd(), root);
    let files = [];
    try {
      files = await listFilesRecursive(absRoot);
    } catch (err) {
      console.error(`Unable to scan ${root}:`, err.message);
      process.exit(1);
    }

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf8');
      const relPath = path.relative(process.cwd(), filePath);

      // Arbitrary text sizes (px) - hard fail.
      if (content.includes('text-[')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const matches = line.match(ARBITRARY_TEXT_PX_RE);
          if (!matches) return;
          report.arbitraryTextPx.count += matches.length;
          report.arbitraryTextPx.matches.push({
            file: relPath,
            line: idx + 1,
            excerpt: line.trim().slice(0, 180)
          });
        });
      }

      // Tailwind numeric palette colors (non-token).
      for (const match of content.matchAll(NON_TOKEN_TAILWIND_COLOR_RE)) {
        const color = match[1];
        report.nonTokenTailwindColors.total += 1;
        incrementCount(report.nonTokenTailwindColors.byColor, color);
      }

      // Typography plugin palette classes like prose-amber (non-token).
      for (const match of content.matchAll(NON_TOKEN_TYPOGRAPHY_PROSE_COLOR_RE)) {
        const color = match[1];
        report.nonTokenProseColors.total += 1;
        incrementCount(report.nonTokenProseColors.byColor, color);
      }

      // Raw RGBA literals inside Tailwind arbitrary color syntax.
      const rgbaMatches = content.match(RAW_RGBA_COLOR_LITERAL_RE);
      if (rgbaMatches) {
        report.rawRgbaColorLiterals.count += rgbaMatches.length;
      }
    }
  }

  return report;
}

async function readBaseline() {
  try {
    return JSON.parse(await fs.readFile(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function writeBaseline(report) {
  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const { roots, writeBaseline: shouldWriteBaseline } = parseArgs(process.argv.slice(2));
  const report = await buildReport(roots);

  if (report.arbitraryTextPx.count > 0) {
    fail(`Design contract failed: found ${report.arbitraryTextPx.count} arbitrary text sizes like 'text-[13px]'.`);
    for (const match of report.arbitraryTextPx.matches.slice(0, 25)) {
      console.error(`- ${match.file}:${match.line} ${match.excerpt}`);
    }
    if (report.arbitraryTextPx.matches.length > 25) {
      console.error(`...and ${report.arbitraryTextPx.matches.length - 25} more.`);
    }
    return;
  }

  if (shouldWriteBaseline) {
    await writeBaseline(report);
    console.log(`Wrote design contract baseline to ${path.relative(process.cwd(), BASELINE_PATH)}`, {
      nonTokenTailwindColors: report.nonTokenTailwindColors,
      nonTokenProseColors: report.nonTokenProseColors,
      rawRgbaColorLiterals: report.rawRgbaColorLiterals
    });
    return;
  }

  const baseline = await readBaseline();
  if (!baseline) {
    fail(`Design contract baseline missing. Run: node ${path.relative(process.cwd(), BASELINE_PATH.replace('design-contract-baseline.json', 'verifyDesignContract.js'))} --write-baseline`);
    return;
  }

  const failures = [];

  // Guard against adding new Tailwind palette color usage.
  const baselineColors = baseline?.nonTokenTailwindColors?.byColor || {};
  for (const [color, count] of Object.entries(report.nonTokenTailwindColors.byColor)) {
    const prior = baselineColors[color] || 0;
    if (count > prior) failures.push(`Tailwind palette color '${color}' increased: ${prior} → ${count}`);
  }
  for (const color of Object.keys(report.nonTokenProseColors.byColor)) {
    const prior = baseline?.nonTokenProseColors?.byColor?.[color] || 0;
    const current = report.nonTokenProseColors.byColor[color] || 0;
    if (current > prior) failures.push(`Tailwind prose palette '${color}' increased: ${prior} → ${current}`);
  }

  const priorRgba = baseline?.rawRgbaColorLiterals?.count || 0;
  if (report.rawRgbaColorLiterals.count > priorRgba) {
    failures.push(`Raw rgba() literals increased: ${priorRgba} → ${report.rawRgbaColorLiterals.count}`);
  }

  if (failures.length) {
    fail(`Design contract failed: non-token color usage increased.\n- ${failures.join('\n- ')}`);
    return;
  }

  console.log('Design contract gate passed.', {
    nonTokenTailwindColors: report.nonTokenTailwindColors,
    nonTokenProseColors: report.nonTokenProseColors,
    rawRgbaColorLiterals: report.rawRgbaColorLiterals
  });
}

main().catch((err) => {
  console.error('Design contract gate failed:', err.message);
  process.exit(1);
});

