// Decode an MP3 loop and measure the levels a listener actually gets.
// Node-only: used by the ambience generator and by the unit suite.
import { MPEGDecoder } from 'mpg123-decoder';

const SEGMENT = 65536;
// Shorter than an MP3 encoder's lead-in, so an untrimmed stream shows up as a silent head.
const EDGE_SECONDS = 0.02;

/** Decode MP3 bytes to the first channel's samples. */
export async function decodeMp3(bytes) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const { channelData, samplesDecoded, sampleRate } = decoder.decode(bytes);
    return { samples: channelData[0].subarray(0, samplesDecoded), sampleRate };
  } finally {
    decoder.free();
  }
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    const stepRe = Math.cos(angle), stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wRe = 1, wIm = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k, b = a + size / 2;
        const tRe = re[b] * wRe - im[b] * wIm, tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe; im[b] = im[a] - tIm;
        re[a] += tRe; im[a] += tIm;
        const next = wRe * stepRe - wIm * stepIm;
        wIm = wRe * stepIm + wIm * stepRe;
        wRe = next;
      }
    }
  }
}

// Mean-square power in each frequency band, averaged over half-overlapping
// Hann windows. Tapered windows keep a strong subsonic component from
// leaking into the audible band, which a single untapered transform would do.
function bandPowers(samples, sampleRate, edges) {
  const window = Float64Array.from({ length: SEGMENT }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / SEGMENT));
  const windowPower = window.reduce((sum, w) => sum + w * w, 0);
  const powers = new Float64Array(edges.length - 1);
  const re = new Float64Array(SEGMENT), im = new Float64Array(SEGMENT);
  let segments = 0;
  for (let start = 0; start + SEGMENT <= samples.length; start += SEGMENT / 2) {
    for (let i = 0; i < SEGMENT; i++) { re[i] = samples[start + i] * window[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= SEGMENT / 2; k++) {
      const frequency = k * sampleRate / SEGMENT;
      const band = edges.findLastIndex(edge => frequency >= edge);
      if (band < 0 || band >= powers.length) continue;
      const power = (re[k] * re[k] + im[k] * im[k]) / (windowPower * SEGMENT);
      powers[band] += k === 0 || k === SEGMENT / 2 ? power : 2 * power;
    }
    segments++;
  }
  if (!segments) throw new Error(`Loop is shorter than one ${SEGMENT}-sample analysis window`);
  return powers.map(power => power / segments);
}

const toDb = power => 10 * Math.log10(Math.max(power, 1e-30));

function rms(samples, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

/**
 * Full-file measurements of a decoded loop.
 * `audibleDbfs` is the RMS level of the 20 Hz-20 kHz content; `subsonicShare`
 * is the fraction of all energy below 20 Hz. The edge fields describe the
 * join a looping player makes between the last sample and the first.
 */
export function measureLoop(samples, sampleRate) {
  const [subsonic, audible, ultrasonic] = bandPowers(samples, sampleRate, [0, 20, 20000, Infinity]);
  const edge = Math.round(EDGE_SECONDS * sampleRate);
  let peak = 0, sum = 0, steps = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
    peak = Math.max(peak, Math.abs(samples[i]));
    if (i) steps += Math.abs(samples[i] - samples[i - 1]);
  }
  return {
    seconds: samples.length / sampleRate,
    peakDbfs: 20 * Math.log10(peak || 1e-15),
    dcOffset: sum / samples.length,
    audibleDbfs: toDb(audible),
    subsonicShare: subsonic / (subsonic + audible + ultrasonic),
    headDbfs: 20 * Math.log10(rms(samples, 0, edge) || 1e-15),
    tailDbfs: 20 * Math.log10(rms(samples, samples.length - edge, samples.length) || 1e-15),
    joinStep: Math.abs(samples[0] - samples[samples.length - 1]),
    typicalStep: steps / (samples.length - 1)
  };
}
