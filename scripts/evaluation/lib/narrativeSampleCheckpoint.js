import fs from 'node:fs/promises';
import path from 'node:path';

// A later provider/validation failure must not erase earlier paid or subscription
// completions, or the raw completion which caused the failure. Never retry here.
// Checkpoints go to a sidecar file: the output path holds the last complete
// corpus (which unit tests and the metrics gate read), so a failed batch must
// not replace it with partial samples. Only a completed batch is promoted.
export function checkpointPathFor(outputPath) {
  return `${outputPath}.checkpoint`;
}

export async function generateSamplesWithCheckpoint(samples, generateSample, outputPath) {
  const generated = [];
  const checkpointPath = checkpointPathFor(outputPath);
  const write = async (status, failedSample = null) => {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const temporary = `${checkpointPath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ generatedAt: new Date().toISOString(), status, samples: generated,
      ...(failedSample ? { failedSample } : {}) }, null, 2), { mode: 0o600 });
    await fs.rename(temporary, checkpointPath);
  };
  for (const sample of samples) {
    try {
      generated.push(await generateSample(sample));
      await write('in_progress');
    } catch (error) {
      if (generated.length || error.unrenderedNarrative) {
        await write('failed', { id: sample.id, ...error.unrenderedNarrative,
          error: { code: error.code || null, message: error.message } });
      }
      throw error;
    }
  }
  await write('complete');
  await fs.rename(checkpointPath, outputPath);
  return generated;
}
