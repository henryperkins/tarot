import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyCueListener } from './readingCueValidationIdentity.mjs';

// Both checks apply to every selected spec, including application and qualification.
export default async function verifyLane() {
  const manifest = JSON.parse(await readFile(process.env.CUE_VALIDATION_MANIFEST, 'utf8'));
  const kind = process.env.CUE_VALIDATION_LANE === 'optimized' ? 'optimized' : 'frontend';
  const destination = path.join(process.env.CUE_VALIDATION_RUN_DIRECTORY, 'lane-integrity.json');
  const evidence = { kind, before: await verifyCueListener(manifest, kind) };
  await writeFile(destination, JSON.stringify(evidence, null, 2), { mode: 0o600, flag: 'wx' });
  return async () => {
    try { evidence.after = await verifyCueListener(manifest, kind); }
    catch (error) { evidence.after = { outputIntegrity: false, error: error.message }; throw error; }
    finally { await writeFile(destination, JSON.stringify(evidence, null, 2)); }
  };
}
