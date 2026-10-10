import { createHash } from 'node:crypto';
import { chmod, lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function hashOutputFiles(directory, prefix = '', requireFrozen = false) {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || (requireFrozen && (metadata.mode & 0o777) !== 0o555)) throw new Error('Invalid optimized output directory.');
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix + entry.name;
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await hashOutputFiles(location, relative + '/', requireFrozen));
    else if (entry.isFile()) {
      const metadata = await lstat(location);
      if (!metadata.isFile() || metadata.isSymbolicLink() || (requireFrozen && (metadata.mode & 0o777) !== 0o444)) throw new Error('Invalid optimized output file.');
      const bytes = await readFile(location);
      files.push({ path: relative, sha256: hash(bytes), bytes: bytes.length });
    } else throw new Error('Optimized output must contain only regular files/directories.');
  }
  return files;
}

export async function freezeOutput(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) await freezeOutput(location);
    else if (entry.isFile()) await chmod(location, 0o444);
    else throw new Error('Optimized output contains a link or special file.');
  }
  await chmod(directory, 0o555);
}

export async function verifyOutputIntegrity(directory, captured) {
  try { return JSON.stringify(await hashOutputFiles(directory, '', true)) === JSON.stringify(captured); }
  catch { return false; }
}
