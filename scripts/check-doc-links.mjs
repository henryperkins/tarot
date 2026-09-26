import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const realRoot = realpathSync(root);
const markdownExtensions = new Set(['.md', '.mdx']);
const excludedDirectories = new Set([
  '.git',
  '.wrangler',
  '.worktrees',
  'coverage',
  'dist',
  'node_modules',
  'output',
  'playwright-report',
  'test-results',
  'tmp'
]);
const excludedRelativeDirectories = new Set([
  'docs/plans',
  'docs/reviews',
  'docs/superpowers',
  'data/evaluations'
]);

function isExcluded(relativePath) {
  const segments = relativePath.split('/');
  if (segments.some((segment) => excludedDirectories.has(segment))) return true;
  return segments.slice(0, -1).some((_, index) => {
    const prefix = segments.slice(0, index + 1).join('/');
    return excludedRelativeDirectories.has(prefix);
  });
}

function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    const relativePath = relative(root, absolutePath).replaceAll('\\', '/');
    if (isExcluded(relativePath)) continue;
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath));
    } else if (entry.isFile() && markdownExtensions.has(extname(entry.name))) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

// Blank fenced lines instead of dropping them so array indexes stay aligned
// with source line numbers in failure reports.
function blankFencedCode(lines) {
  let fence = null;
  return lines.map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      const marker = match[1][0];
      if (!fence) {
        fence = marker;
        return '';
      }
      if (fence === marker) {
        fence = null;
        return '';
      }
    }
    return fence ? '' : line;
  });
}

function extractTargets(line) {
  const targets = [];
  const inlinePattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = inlinePattern.exec(line))) {
    targets.push(match[1].trim());
  }
  const referencePattern = /^\s*\[[^\]]+\]:\s*(\S+)/;
  const referenceMatch = line.match(referencePattern);
  if (referenceMatch) targets.push(referenceMatch[1]);
  return targets;
}

function normalizeTarget(rawTarget) {
  let target = rawTarget;
  if (target.startsWith('<')) {
    const closing = target.indexOf('>');
    if (closing === -1) return null;
    target = target.slice(1, closing);
  } else {
    target = target.split(/\s+/, 1)[0];
  }
  target = target.replace(/^['"]|['"]$/g, '');
  if (!target || target.startsWith('#')) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(target) && !isHostPath(target)) return null;
  const hashIndex = target.indexOf('#');
  const pathPart = hashIndex === -1 ? target : target.slice(0, hashIndex);
  if (!pathPart) return null;
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
}

// file: URLs and Windows drive paths name a location on one machine, so they
// are reported instead of being skipped as external URLs.
function isHostPath(target) {
  return /^(?:file:|[A-Za-z]:[\\/])/i.test(target);
}

function resolveLocalTarget(sourceFile, target) {
  if (target.startsWith('/')) return resolve(root, target.slice(1));
  return resolve(dirname(sourceFile.absolutePath), target);
}

function isInsideRoot(targetPath, base = root) {
  const relativePath = relative(base, targetPath);
  return !isAbsolute(relativePath) &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`);
}

const files = collectMarkdownFiles(root);
const failures = [];
for (const file of files) {
  const lines = blankFencedCode(readFileSync(file.absolutePath, 'utf8').split(/\r?\n/));
  lines.forEach((line, index) => {
    for (const rawTarget of extractTargets(line)) {
      const target = normalizeTarget(rawTarget);
      if (!target) continue;
      const location = `${file.relativePath}:${index + 1}: ${rawTarget}`;
      if (isHostPath(target)) {
        failures.push(`${location} (machine-specific path; use a repository-relative link)`);
        continue;
      }
      const targetPath = resolveLocalTarget(file, target);
      if (!isInsideRoot(targetPath)) {
        failures.push(`${location} (resolves outside the repository)`);
      } else if (!existsSync(targetPath)) {
        failures.push(location);
      } else if (!isInsideRoot(realpathSync(targetPath), realRoot)) {
        failures.push(`${location} (resolves outside the repository through a symlink)`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error(`Found ${failures.length} broken local Markdown links:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} maintained Markdown files: all local links resolve.`);
}
