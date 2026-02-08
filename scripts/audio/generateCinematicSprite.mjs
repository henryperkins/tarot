#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lamejs from 'lamejs';

const { Mp3Encoder } = lamejs;

const SAMPLE_RATE = 44100;
const BITRATE_KBPS = 128;
const TOTAL_DURATION_SECONDS = 11.2;
const TOTAL_SAMPLES = Math.ceil(TOTAL_DURATION_SECONDS * SAMPLE_RATE);

const CUES = {
  knock: { start: 0.0, duration: 0.28 },
  shuffle: { start: 0.32, duration: 0.62 },
  deal: { start: 1.0, duration: 0.42 },
  flip: { start: 1.46, duration: 0.38 },
  'reveal-bloom': { start: 1.9, duration: 0.78 },
  'narrative-ambient': { start: 2.74, duration: 6.2, loop: true },
  'phase-transition': { start: 9.04, duration: 0.9 },
  'complete-chime': { start: 10.0, duration: 1.12 }
};

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x7A2F9E1B);

function toSampleIndex(seconds) {
  return Math.max(0, Math.floor(seconds * SAMPLE_RATE));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function envelope(sampleIndex, totalSamples, attackSeconds, releaseSeconds) {
  if (totalSamples <= 1) return 1;
  const attack = Math.max(1, Math.floor(attackSeconds * SAMPLE_RATE));
  const release = Math.max(1, Math.floor(releaseSeconds * SAMPLE_RATE));
  if (sampleIndex < attack) {
    return sampleIndex / attack;
  }
  const releaseStart = totalSamples - release;
  if (sampleIndex >= releaseStart) {
    return Math.max(0, (totalSamples - sampleIndex) / release);
  }
  return 1;
}

function waveform(type, phase) {
  const normalized = phase % (Math.PI * 2);
  if (type === 'triangle') {
    return (2 / Math.PI) * Math.asin(Math.sin(normalized));
  }
  if (type === 'sawtooth') {
    return 2 * (normalized / (Math.PI * 2)) - 1;
  }
  if (type === 'square') {
    return Math.sign(Math.sin(normalized)) || 1;
  }
  return Math.sin(normalized);
}

function addTone(buffer, startSeconds, durationSeconds, {
  type = 'sine',
  frequency = 220,
  endFrequency = null,
  gain = 0.2,
  attack = 0.01,
  release = 0.08,
  vibratoHz = 0,
  vibratoDepth = 0
} = {}) {
  const start = toSampleIndex(startSeconds);
  const total = Math.max(1, toSampleIndex(durationSeconds));
  let phase = 0;

  for (let localIndex = 0; localIndex < total; localIndex += 1) {
    const targetIndex = start + localIndex;
    if (targetIndex >= buffer.length) break;

    const progress = total > 1 ? localIndex / (total - 1) : 0;
    const baseFrequency = endFrequency == null
      ? frequency
      : (frequency + ((endFrequency - frequency) * progress));
    const vibrato = vibratoHz > 0 && vibratoDepth > 0
      ? Math.sin((2 * Math.PI * vibratoHz * localIndex) / SAMPLE_RATE) * vibratoDepth
      : 0;
    const currentFrequency = Math.max(12, baseFrequency + vibrato);
    phase += (2 * Math.PI * currentFrequency) / SAMPLE_RATE;

    const amp = envelope(localIndex, total, attack, release) * gain;
    buffer[targetIndex] += waveform(type, phase) * amp;
  }
}

function addNoise(buffer, startSeconds, durationSeconds, {
  gain = 0.06,
  attack = 0.01,
  release = 0.1,
  color = 'soft'
} = {}) {
  const start = toSampleIndex(startSeconds);
  const total = Math.max(1, toSampleIndex(durationSeconds));
  let smooth = 0;
  let low = 0;

  for (let localIndex = 0; localIndex < total; localIndex += 1) {
    const targetIndex = start + localIndex;
    if (targetIndex >= buffer.length) break;

    const white = (random() * 2) - 1;
    smooth = (smooth * 0.9) + (white * 0.1);
    low = (low * 0.97) + (white * 0.03);

    let sample = white;
    if (color === 'soft') {
      sample = smooth;
    } else if (color === 'bright') {
      sample = white - low;
    } else if (color === 'air') {
      sample = (white * 0.7) + ((white - low) * 0.3);
    }

    const amp = envelope(localIndex, total, attack, release) * gain;
    buffer[targetIndex] += sample * amp;
  }
}

function addBell(buffer, startSeconds, durationSeconds, baseFrequency, gain) {
  addTone(buffer, startSeconds, durationSeconds, {
    type: 'sine',
    frequency: baseFrequency,
    endFrequency: baseFrequency * 0.998,
    gain,
    attack: 0.02,
    release: Math.max(0.2, durationSeconds * 0.72),
    vibratoHz: 5.5,
    vibratoDepth: 1.3
  });

  addTone(buffer, startSeconds, durationSeconds * 0.86, {
    type: 'triangle',
    frequency: baseFrequency * 2.003,
    endFrequency: baseFrequency * 1.995,
    gain: gain * 0.35,
    attack: 0.02,
    release: Math.max(0.16, durationSeconds * 0.64)
  });

  addTone(buffer, startSeconds, durationSeconds * 0.7, {
    type: 'sine',
    frequency: baseFrequency * 2.99,
    endFrequency: baseFrequency * 2.95,
    gain: gain * 0.18,
    attack: 0.01,
    release: Math.max(0.12, durationSeconds * 0.55)
  });
}

function composeSprite() {
  const buffer = new Float32Array(TOTAL_SAMPLES);

  // knock
  addTone(buffer, 0.0, 0.22, {
    type: 'sine',
    frequency: 94,
    endFrequency: 56,
    gain: 0.52,
    attack: 0.002,
    release: 0.13
  });
  addNoise(buffer, 0.0, 0.08, {
    gain: 0.22,
    attack: 0.001,
    release: 0.055,
    color: 'bright'
  });
  addTone(buffer, 0.01, 0.05, {
    type: 'triangle',
    frequency: 1850,
    endFrequency: 930,
    gain: 0.11,
    attack: 0.001,
    release: 0.03
  });

  // shuffle
  for (const offset of [0.0, 0.14, 0.27, 0.4]) {
    const start = CUES.shuffle.start + offset;
    addNoise(buffer, start, 0.16, {
      gain: 0.11,
      attack: 0.01,
      release: 0.1,
      color: 'air'
    });
    addTone(buffer, start + 0.01, 0.14, {
      type: 'sawtooth',
      frequency: 340,
      endFrequency: 165,
      gain: 0.08,
      attack: 0.006,
      release: 0.08
    });
  }
  addTone(buffer, 0.37, 0.08, {
    type: 'square',
    frequency: 1300,
    endFrequency: 620,
    gain: 0.035,
    attack: 0.001,
    release: 0.04
  });

  // deal
  addNoise(buffer, CUES.deal.start, 0.21, {
    gain: 0.09,
    attack: 0.004,
    release: 0.11,
    color: 'air'
  });
  addTone(buffer, CUES.deal.start + 0.02, 0.25, {
    type: 'triangle',
    frequency: 240,
    endFrequency: 530,
    gain: 0.16,
    attack: 0.004,
    release: 0.1
  });
  addTone(buffer, CUES.deal.start + 0.11, 0.06, {
    type: 'square',
    frequency: 1080,
    endFrequency: 720,
    gain: 0.05,
    attack: 0.002,
    release: 0.03
  });

  // flip
  addTone(buffer, CUES.flip.start, 0.07, {
    type: 'square',
    frequency: 930,
    endFrequency: 420,
    gain: 0.15,
    attack: 0.001,
    release: 0.03
  });
  addNoise(buffer, CUES.flip.start + 0.025, 0.12, {
    gain: 0.07,
    attack: 0.002,
    release: 0.08,
    color: 'soft'
  });
  addTone(buffer, CUES.flip.start + 0.07, 0.22, {
    type: 'triangle',
    frequency: 300,
    endFrequency: 590,
    gain: 0.11,
    attack: 0.01,
    release: 0.12
  });

  // reveal bloom
  addNoise(buffer, CUES['reveal-bloom'].start, 0.26, {
    gain: 0.04,
    attack: 0.01,
    release: 0.2,
    color: 'bright'
  });
  addTone(buffer, CUES['reveal-bloom'].start, 0.76, {
    type: 'sine',
    frequency: 230,
    endFrequency: 355,
    gain: 0.13,
    attack: 0.05,
    release: 0.38,
    vibratoHz: 4.2,
    vibratoDepth: 2.6
  });
  addTone(buffer, CUES['reveal-bloom'].start + 0.03, 0.72, {
    type: 'triangle',
    frequency: 292,
    endFrequency: 450,
    gain: 0.1,
    attack: 0.06,
    release: 0.33
  });
  addTone(buffer, CUES['reveal-bloom'].start + 0.06, 0.65, {
    type: 'sine',
    frequency: 388,
    endFrequency: 710,
    gain: 0.055,
    attack: 0.05,
    release: 0.3
  });

  // narrative ambient
  addTone(buffer, CUES['narrative-ambient'].start, CUES['narrative-ambient'].duration, {
    type: 'sine',
    frequency: 72,
    endFrequency: 69,
    gain: 0.078,
    attack: 0.7,
    release: 0.95,
    vibratoHz: 0.13,
    vibratoDepth: 1.7
  });
  addTone(buffer, CUES['narrative-ambient'].start, CUES['narrative-ambient'].duration, {
    type: 'triangle',
    frequency: 108,
    endFrequency: 102,
    gain: 0.038,
    attack: 0.9,
    release: 1.0,
    vibratoHz: 0.17,
    vibratoDepth: 1.1
  });
  addNoise(buffer, CUES['narrative-ambient'].start, CUES['narrative-ambient'].duration, {
    gain: 0.009,
    attack: 0.9,
    release: 1.0,
    color: 'soft'
  });

  // phase transition
  addNoise(buffer, CUES['phase-transition'].start, 0.78, {
    gain: 0.08,
    attack: 0.05,
    release: 0.22,
    color: 'bright'
  });
  addTone(buffer, CUES['phase-transition'].start + 0.02, 0.72, {
    type: 'sawtooth',
    frequency: 145,
    endFrequency: 418,
    gain: 0.085,
    attack: 0.03,
    release: 0.2
  });
  addTone(buffer, CUES['phase-transition'].start + 0.28, 0.22, {
    type: 'sine',
    frequency: 540,
    endFrequency: 420,
    gain: 0.06,
    attack: 0.01,
    release: 0.11
  });

  // complete chime
  addBell(buffer, CUES['complete-chime'].start, 1.02, 523.25, 0.16);
  addBell(buffer, CUES['complete-chime'].start + 0.1, 0.94, 659.25, 0.11);
  addBell(buffer, CUES['complete-chime'].start + 0.2, 0.86, 783.99, 0.085);
  addTone(buffer, CUES['complete-chime'].start, 1.12, {
    type: 'sine',
    frequency: 261.63,
    endFrequency: 260.5,
    gain: 0.04,
    attack: 0.05,
    release: 0.7
  });

  return buffer;
}

function finalizeMix(floatBuffer) {
  let peak = 0;

  for (let i = 0; i < floatBuffer.length; i += 1) {
    // Soft saturation for more natural transients.
    const shaped = Math.tanh(floatBuffer[i] * 1.1);
    floatBuffer[i] = shaped;
    const abs = Math.abs(shaped);
    if (abs > peak) peak = abs;
  }

  const targetPeak = 0.94;
  const scale = peak > targetPeak ? (targetPeak / peak) : 1;

  const pcm = new Int16Array(floatBuffer.length);
  for (let i = 0; i < floatBuffer.length; i += 1) {
    const sample = clamp(floatBuffer[i] * scale, -1, 1);
    pcm[i] = sample < 0
      ? Math.round(sample * 32768)
      : Math.round(sample * 32767);
  }
  return pcm;
}

function encodeMp3(monoPcm) {
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, BITRATE_KBPS);
  const blockSize = 1152;
  const chunks = [];

  for (let offset = 0; offset < monoPcm.length; offset += blockSize) {
    const sampleChunk = monoPcm.subarray(offset, offset + blockSize);
    const encoded = encoder.encodeBuffer(sampleChunk);
    if (encoded.length > 0) {
      chunks.push(Buffer.from(encoded));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    chunks.push(Buffer.from(flushed));
  }

  return Buffer.concat(chunks);
}

function resolveOutputPath() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const defaultPath = path.resolve(scriptDirectory, '../../public/audio/cinematic-sprite.mp3');
  const requestedPath = process.argv[2];
  return requestedPath
    ? path.resolve(process.cwd(), requestedPath)
    : defaultPath;
}

function main() {
  const outputPath = resolveOutputPath();
  const mix = composeSprite();
  const pcm = finalizeMix(mix);
  const mp3 = encodeMp3(pcm);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, mp3);

  const sizeKb = (mp3.length / 1024).toFixed(1);
  console.log(
    `Generated cinematic sprite: ${outputPath} (${sizeKb} KB, ${TOTAL_DURATION_SECONDS.toFixed(2)}s @ ${SAMPLE_RATE}Hz)`
  );
}

main();
